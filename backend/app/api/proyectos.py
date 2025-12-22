from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional, Dict 
import os
from pathlib import Path
import uuid
from datetime import datetime

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import Usuario, Proyecto, IdentificadorPadrones, Plantilla 
from app.schemas import (
    ProyectoCreate, ProyectoUpdate, ProyectoResponse,
    SuccessResponse, ErrorResponse
)
from app.utils.logger import log_auditoria
from app.utils.file_utils import guardar_archivo, eliminar_archivo
from app.config import settings

router = APIRouter(prefix="/proyectos", tags=["Proyectos"])
    
@router.get("/{proyecto_id}", response_model=ProyectoResponse)
async def obtener_proyecto(
    proyecto_id: int,
    incluir_eliminado: bool = False,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Obtiene un proyecto específico por ID - VERSIÓN CORREGIDA
    """
    try:
        # 1. Construir query base
        query = db.query(Proyecto).filter(Proyecto.id == proyecto_id)
        
        if not incluir_eliminado:
            query = query.filter(Proyecto.is_deleted == False)
        
        proyecto = query.first()
        
        if not proyecto:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proyecto no encontrado"
            )
        
        # 2. Verificar permisos de usuario
        if current_user.rol not in ["admin", "superadmin"]:
            if not current_user.proyecto_permitido:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No tiene acceso a este proyecto"
                )
            
            proyectos_permitidos = [
                int(p.strip()) for p in current_user.proyecto_permitido.split(',') 
                if p.strip().isdigit()
            ]
            
            if proyecto.id not in proyectos_permitidos:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No tiene acceso a este proyecto"
                )
        
        # 3. Obtener estadísticas adicionales
        num_plantillas = db.query(Plantilla).filter(
            Plantilla.proyecto_id == proyecto.id,
            Plantilla.is_deleted == False
        ).count()
        
        # 4. Construir respuesta del proyecto - ¡CORRECCIÓN AQUÍ!
        proyecto_dict = {
            "id": proyecto.id,
            "nombre": proyecto.nombre,
            "descripcion": proyecto.descripcion,
            "tabla_padron": proyecto.tabla_padron,  # Este es el UUID
            "logo": proyecto.logo,
            "activo": proyecto.activo,
            "fecha_creacion": proyecto.fecha_creacion,
            "config_json": proyecto.config_json or {},
            "is_deleted": proyecto.is_deleted,
            "num_plantillas": num_plantillas,
            "padron_info": None  # Inicializar como None
        }
        
        # 5. Obtener información REAL del padrón usando el UUID
        # ¡IMPORTANTE! Esto es lo que estaba fallando
        if proyecto.tabla_padron:
            try:
                # Consultar la tabla identificador_padrones usando el UUID
                padron = db.query(IdentificadorPadrones).filter(
                    IdentificadorPadrones.uuid_padron == proyecto.tabla_padron
                ).first()
                
                if padron:
                    # ¡CORRECTO! La columna se llama 'nombre_tabla', no 'nombre'
                    proyecto_dict["padron_info"] = {
                        "nombre_tabla": padron.nombre_tabla,
                        "descripcion": padron.descripcion,
                        "activo": padron.activo,
                        "uuid": padron.uuid_padron
                    }
                    print(f"DEBUG: Padrón encontrado: {padron.nombre_tabla}")
                else:
                    print(f"DEBUG: No se encontró padrón con UUID: {proyecto.tabla_padron}")
                    
            except Exception as e:
                print(f"DEBUG: Error consultando padrón: {str(e)}")
                # No fallar si hay error con el padrón
                proyecto_dict["padron_info"] = {
                    "nombre_tabla": f"UUID: {proyecto.tabla_padron[:8]}...",
                    "descripcion": "Error cargando información",
                    "activo": False,
                    "uuid": proyecto.tabla_padron
                }
        
        # 6. Devolver respuesta
        print(f"DEBUG: Proyecto {proyecto_id} cargado exitosamente")
        return proyecto_dict
        
    except HTTPException:
        # Re-lanzar excepciones HTTP
        raise
    except Exception as e:
        # Log detallado del error
        print(f"ERROR CRÍTICO en obtener_proyecto: {str(e)}")
        import traceback
        traceback.print_exc()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno obteniendo proyecto: {str(e)[:100]}"
        )

@router.post("/", response_model=ProyectoResponse)
async def crear_proyecto(
    nombre: str = Form(...),
    descripcion: Optional[str] = Form(None),
    tabla_padron: str = Form(...),
    logo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """
    Crea un nuevo proyecto (solo admin/superadmin)
    """
    try:
        print(f"📝 Creando proyecto: {nombre}, padrón: {tabla_padron}")
        
        # Verificar que no exista proyecto con mismo nombre
        existente = db.query(Proyecto).filter(
            Proyecto.nombre == nombre,
            Proyecto.is_deleted == False
        ).first()
        
        if existente:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe un proyecto con este nombre"
            )
        
        # Verificar que el padrón exista
        padron = db.query(IdentificadorPadrones).filter(
            IdentificadorPadrones.uuid_padron == tabla_padron
        ).first()

        if not padron:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Padrón con UUID {tabla_padron} no encontrado"
            )
        
        # Guardar logo si se proporciona
        logo_path = None
        if logo and logo.filename:
            # Directorio para logos
            logos_dir = Path(settings.UPLOAD_DIR) / "logos"
            logos_dir.mkdir(parents=True, exist_ok=True)
            
            # Generar nombre único
            ext = Path(logo.filename).suffix.lower()
            logo_name = f"proyecto_{uuid.uuid4().hex[:8]}{ext}"
            logo_path = f"logos/{logo_name}"
            full_path = logos_dir / logo_name
            
            # Guardar archivo
            with open(full_path, "wb") as buffer:
                content = await logo.read()
                buffer.write(content)
            
            print(f"📸 Logo guardado: {full_path}")
        
        # Crear proyecto
        proyecto = Proyecto(
            nombre=nombre.strip(),
            descripcion=descripcion.strip() if descripcion else None,
            tabla_padron=tabla_padron,
            logo=logo_path,
            activo=True,
            config_json={
                "creado_por": current_user.id,
                "fecha_creacion": datetime.now().isoformat(),
                "padron_nombre": padron.nombre_tabla
            }
        )
        
        db.add(proyecto)
        db.commit()
        db.refresh(proyecto)
        
        print(f"✅ Proyecto creado exitosamente: {proyecto.id}")
        
        # Registrar en bitácora
        log_auditoria(
            db=db,
            usuario_id=current_user.id,
            accion="crear",
            modulo="proyectos",
            detalles={
                "proyecto_id": proyecto.id,
                "nombre": proyecto.nombre,
                "padron": proyecto.tabla_padron
            }
        )
        
        return proyecto
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error creando proyecto: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creando proyecto: {str(e)}"
        )

@router.put("/{proyecto_id}", response_model=ProyectoResponse)
@router.put("/{proyecto_id}", response_model=ProyectoResponse)
async def actualizar_proyecto(
    proyecto_id: int,
    nombre: Optional[str] = Form(None),
    descripcion: Optional[str] = Form(None),
    tabla_padron: Optional[str] = Form(None),
    logo: Optional[UploadFile] = File(None),
    eliminar_logo: bool = Form(False),
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
        
        # Verificar nombre único si se está cambiando
        if nombre and nombre != proyecto.nombre:
            existente = db.query(Proyecto).filter(
                Proyecto.nombre == nombre,
                Proyecto.is_deleted == False,
                Proyecto.id != proyecto_id
            ).first()
            
            if existente:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ya existe otro proyecto con este nombre"
                )
        
        # Verificar padrón si se está cambiando
        if tabla_padron and tabla_padron != proyecto.tabla_padron:
            padron = db.query(IdentificadorPadrones).filter(
                IdentificadorPadrones.uuid_padron == tabla_padron
            ).first()
            
            if not padron:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Padrón con UUID {tabla_padron} no encontrado"
                )
        
        # Manejar logo
        if eliminar_logo and proyecto.logo:
            # Eliminar archivo físico
            eliminar_archivo(proyecto.logo)
            proyecto.logo = None
        elif logo and logo.filename:
            # Eliminar logo anterior si existe
            if proyecto.logo:
                eliminar_archivo(proyecto.logo)
            
            # Guardar nuevo logo
            allowed_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg']
            ext = Path(logo.filename).suffix.lower()
            if ext not in allowed_extensions:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Formato de imagen no permitido. Use: {', '.join(allowed_extensions)}"
                )
            
            logo_path = guardar_archivo(logo, "logos")
            proyecto.logo = logo_path
        
        # Actualizar campos
        if nombre is not None:
            proyecto.nombre = nombre
        if descripcion is not None:
            proyecto.descripcion = descripcion
        if tabla_padron is not None:
            proyecto.tabla_padron = tabla_padron
        
        db.commit()
        db.refresh(proyecto)
        
        # Registrar en bitácora
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
    eliminacion_permanente: bool = False,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Elimina un proyecto (soft delete por defecto)
    Solo superadmin puede hacer eliminación permanente
    """
    try:
        proyecto = db.query(Proyecto).filter(Proyecto.id == proyecto_id).first()
        
        if not proyecto:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proyecto no encontrado"
            )
        
        if eliminacion_permanente:
            # Solo superadmin puede eliminar permanentemente
            if current_user.rol != "superadmin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Solo superadmin puede eliminar proyectos permanentemente"
                )
            
            # Verificar que no tenga plantillas asociadas
            tiene_plantillas = db.query(Plantilla).filter(
                Plantilla.proyecto_id == proyecto_id,
                Plantilla.is_deleted == False
            ).count() > 0
            
            if tiene_plantillas:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No se puede eliminar permanentemente un proyecto con plantillas activas"
                )
            
            # Eliminar logo si existe
            if proyecto.logo:
                eliminar_archivo(proyecto.logo)
            
            # Eliminación física
            db.delete(proyecto)
            accion = "eliminar_permanentemente"
            
        else:
            # Soft delete
            proyecto.is_deleted = True
            proyecto.activo = False
            accion = "eliminar_soft"
        
        db.commit()
        
        # Registrar en bitácora
        log_auditoria(
            db=db,
            usuario_id=current_user.id,
            accion=accion,
            modulo="proyectos",
            detalles={
                "proyecto_id": proyecto_id,
                "nombre": proyecto.nombre,
                "permanente": eliminacion_permanente
            }
        )
        
        message = "Proyecto eliminado permanentemente" if eliminacion_permanente else "Proyecto eliminado (se puede restaurar)"
        
        return SuccessResponse(message=message)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error eliminando proyecto: {str(e)}"
        )

@router.get("/", response_model=List[ProyectoResponse])
async def listar_proyectos(
    solo_activos: bool = True,
    incluir_eliminados: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Lista todos los proyectos (filtrados por usuario si no es admin)
    """
    try:
        # Construir query base - SIMPLIFICADO PARA EVITAR ERRORES
        query = db.query(Proyecto)
        
        # Si no se incluyen eliminados, filtrar
        if not incluir_eliminados:
            query = query.filter(Proyecto.is_deleted == False)
        
        # Filtrar por activos si se solicita
        if solo_activos:
            query = query.filter(Proyecto.activo == True)
        
        # Si el usuario no es admin, filtrar por proyectos permitidos
        if current_user.rol not in ["admin", "superadmin"]:
            if not current_user.proyecto_permitido or current_user.proyecto_permitido == "":
                return []  # No tiene proyectos asignados
            
            # Convertir string de proyectos permitidos a lista de IDs
            proyectos_permitidos = [
                int(p.strip()) for p in current_user.proyecto_permitido.split(',') 
                if p.strip().isdigit()
            ]
            
            if proyectos_permitidos:
                query = query.filter(Proyecto.id.in_(proyectos_permitidos))
            else:
                return []  # No hay proyectos válidos
        
        # Ordenar y paginar
        proyectos = query.order_by(Proyecto.fecha_creacion.desc()).offset(skip).limit(limit).all()
        
        # SIMPLIFICAR: solo devolver datos básicos sin contar plantillas
        proyectos_con_info = []
        for proyecto in proyectos:
            proyecto_dict = {
                "id": proyecto.id,
                "nombre": proyecto.nombre,
                "descripcion": proyecto.descripcion,
                "tabla_padron": proyecto.tabla_padron,
                "logo": proyecto.logo,
                "activo": proyecto.activo,
                "fecha_creacion": proyecto.fecha_creacion,
                "config_json": proyecto.config_json or {},
                "is_deleted": proyecto.is_deleted,
                "num_plantillas": 0,  # Valor temporal
            }
            
            proyectos_con_info.append(proyecto_dict)
        
        return proyectos_con_info
        
    except Exception as e:
        print(f"Error listando proyectos: {str(e)}")  # Debug
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listando proyectos: {str(e)}"
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
    try:
        # Verificar que el proyecto existe y el usuario tiene acceso
        proyecto = db.query(Proyecto).filter(
            Proyecto.id == proyecto_id,
            Proyecto.is_deleted == False
        ).first()
        
        if not proyecto:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Proyecto no encontrado"
            )
        
        # Verificar permisos
        if current_user.rol not in ["admin", "superadmin"]:
            if not current_user.proyecto_permitido:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No tiene acceso a este proyecto"
                )
            
            proyectos_permitidos = [
                int(p.strip()) for p in current_user.proyecto_permitido.split(',') 
                if p.strip().isdigit()
            ]
            
            if proyecto.id not in proyectos_permitidos:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No tiene acceso a este proyecto"
                )
        
        # Contar plantillas
        total_plantillas = db.query(Plantilla).filter(
            Plantilla.proyecto_id == proyecto_id,
            Plantilla.is_deleted == False
        ).count()
        
        plantillas_activas = db.query(Plantilla).filter(
            Plantilla.proyecto_id == proyecto_id,
            Plantilla.is_deleted == False,
            Plantilla.activa == True
        ).count()
        
        # Obtener padrón asociado
        padron_info = None
        if proyecto.tabla_padron:
            padron = db.query(IdentificadorPadrones).filter(
                IdentificadorPadrones.uuid_padron == proyecto.tabla_padron
            ).first()
            
            if padron:
                padron_info = {
                    "nombre": padron.nombre_tabla,
                    "descripcion": padron.descripcion,
                    "activo": padron.activo
                }
        
        # Obtener fecha de última modificación
        ultima_plantilla = db.query(Plantilla).filter(
            Plantilla.proyecto_id == proyecto_id,
            Plantilla.is_deleted == False
        ).order_by(Plantilla.fecha_creacion.desc()).first()
        
        return {
            "proyecto_id": proyecto_id,
            "nombre": proyecto.nombre,
            "plantillas": {
                "total": total_plantillas,
                "activas": plantillas_activas,
                "inactivas": total_plantillas - plantillas_activas
            },
            "padron": padron_info,
            "ultima_actualizacion": ultima_plantilla.fecha_creacion.isoformat() if ultima_plantilla else proyecto.fecha_creacion.isoformat(),
            "estado": "activo" if proyecto.activo else "inactivo",
            "creado": proyecto.fecha_creacion.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error obteniendo estadísticas: {str(e)}"
        )