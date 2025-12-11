from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import Usuario, Proyecto
from app.schemas import (
    ProyectoCreate, ProyectoUpdate, ProyectoResponse,
    SuccessResponse, ErrorResponse
)
from app.core.auth_service import AuthService

router = APIRouter(prefix="/proyectos", tags=["Proyectos"])

@router.get("/", response_model=List[ProyectoResponse])
async def obtener_proyectos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    solo_activos: bool = True,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Obtiene lista de proyectos según permisos del usuario
    """
    auth_service = AuthService(db)
    
    # Construir query base
    query = db.query(Proyecto).filter(Proyecto.is_deleted == False)
    
    if solo_activos:
        query = query.filter(Proyecto.activo == True)
    
    # Filtrar por permisos si no es superadmin
    if current_user.rol != "superadmin":
        if current_user.rol == "admin":
            # Admin ve todos los proyectos activos
            pass
        else:  # lector
            if not current_user.proyecto_permitido:
                return []
            
            proyectos_permitidos = [
                int(p.strip()) for p in current_user.proyecto_permitido.split(',') 
                if p.strip().isdigit()
            ]
            
            if proyectos_permitidos:
                query = query.filter(Proyecto.id.in_(proyectos_permitidos))
            else:
                return []
    
    # Aplicar paginación
    proyectos = query.offset(skip).limit(limit).all()
    
    return proyectos

@router.get("/{proyecto_id}", response_model=ProyectoResponse)
async def obtener_proyecto(
    proyecto_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Obtiene un proyecto específico por ID
    """
    auth_service = AuthService(db)
    
    # Verificar permisos
    if not auth_service.verificar_permisos_proyecto(current_user, proyecto_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene acceso a este proyecto"
        )
    
    proyecto = db.query(Proyecto).filter(
        Proyecto.id == proyecto_id,
        Proyecto.is_deleted == False
    ).first()
    
    if not proyecto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proyecto no encontrado"
        )
    
    return proyecto

@router.post("/", response_model=ProyectoResponse)
async def crear_proyecto(
    proyecto_data: ProyectoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """
    Crea un nuevo proyecto (solo admin/superadmin)
    """
    try:
        # Verificar que el padrón exista
        from app.models import IdentificadorPadrones
        padron = db.query(IdentificadorPadrones).filter(
            IdentificadorPadrones.uuid_padron == proyecto_data.tabla_padron
        ).first()
        
        if not padron:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Padrón con UUID {proyecto_data.tabla_padron} no encontrado"
            )
        
        # Crear proyecto
        proyecto = Proyecto(
            nombre=proyecto_data.nombre,
            descripcion=proyecto_data.descripcion,
            tabla_padron=proyecto_data.tabla_padron,
            logo=proyecto_data.logo,
            config_json={}
        )
        
        db.add(proyecto)
        db.commit()
        db.refresh(proyecto)
        
        # Registrar en bitácora
        from app.utils.logger import log_auditoria
        log_auditoria(
            db=db,
            usuario_id=current_user.id,
            accion="crear",
            modulo="proyectos",
            detalles={"proyecto_id": proyecto.id, "nombre": proyecto.nombre}
        )
        
        return proyecto
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creando proyecto: {str(e)}"
        )

@router.put("/{proyecto_id}", response_model=ProyectoResponse)
async def actualizar_proyecto(
    proyecto_id: int,
    proyecto_data: ProyectoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """
    Actualiza un proyecto existente (solo admin/superadmin)
    """
    try:
        proyecto = db.query(Proyecto).filter(
            Proyecto.id == proyecto_id,
            Proyecto.is_deleted == False
        ).first()
        
        if not proyecto:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proyecto no encontrado"
            )
        
        # Actualizar campos
        update_data = proyecto_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None and hasattr(proyecto, field):
                setattr(proyecto, field, value)
        
        db.commit()
        db.refresh(proyecto)
        
        # Registrar en bitácora
        from app.utils.logger import log_auditoria
        log_auditoria(
            db=db,
            usuario_id=current_user.id,
            accion="actualizar",
            modulo="proyectos",
            detalles={"proyecto_id": proyecto.id}
        )
        
        return proyecto
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error actualizando proyecto: {str(e)}"
        )

@router.delete("/{proyecto_id}")
async def eliminar_proyecto(
    proyecto_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Elimina (soft delete) un proyecto (solo superadmin)
    """
    # Solo superadmin puede eliminar
    if current_user.rol != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo superadmin puede eliminar proyectos"
        )
    
    try:
        proyecto = db.query(Proyecto).filter(
            Proyecto.id == proyecto_id,
            Proyecto.is_deleted == False
        ).first()
        
        if not proyecto:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proyecto no encontrado"
            )
        
        # Soft delete
        proyecto.is_deleted = True
        db.commit()
        
        # Registrar en bitácora
        from app.utils.logger import log_auditoria
        log_auditoria(
            db=db,
            usuario_id=current_user.id,
            accion="eliminar",
            modulo="proyectos",
            detalles={"proyecto_id": proyecto.id}
        )
        
        return SuccessResponse(message="Proyecto eliminado exitosamente")
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error eliminando proyecto: {str(e)}"
        )

@router.get("/{proyecto_id}/estadisticas")
async def obtener_estadisticas_proyecto(
    proyecto_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Obtiene estadísticas de un proyecto
    """
    auth_service = AuthService(db)
    
    # Verificar permisos
    if not auth_service.verificar_permisos_proyecto(current_user, proyecto_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene acceso a este proyecto"
        )
    
    # Contar plantillas
    from app.models import Plantilla
    total_plantillas = db.query(Plantilla).filter(
        Plantilla.proyecto_id == proyecto_id,
        Plantilla.is_deleted == False
    ).count()
    
    plantillas_activas = db.query(Plantilla).filter(
        Plantilla.proyecto_id == proyecto_id,
        Plantilla.activa == True,
        Plantilla.is_deleted == False
    ).count()
    
    # Contar emisiones recientes
    from app.models import EmisionTemp
    from datetime import datetime, timedelta
    
    hoy = datetime.utcnow().date()
    emisiones_hoy = db.query(EmisionTemp).filter(
        EmisionTemp.proyecto_id == proyecto_id,
        db.func.date(EmisionTemp.fecha_carga) == hoy
    ).count()
    
    return {
        "proyecto_id": proyecto_id,
        "plantillas": {
            "total": total_plantillas,
            "activas": plantillas_activas,
            "inactivas": total_plantillas - plantillas_activas
        },
        "emisiones_hoy": emisiones_hoy
    }