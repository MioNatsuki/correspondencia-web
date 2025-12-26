from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import Dict, Any
from datetime import datetime, timedelta
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Usuario, Proyecto, Plantilla, EmisionTemp, Bitacora

# Intentar importar EmisionesFinal, si no existe la creamos
try:
    from app.models import EmisionesFinal
except ImportError:
    # Crear clase temporal si no existe
    from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
    from sqlalchemy.sql import func
    from sqlalchemy.orm import relationship
    from app.database import Base
    
    class EmisionesFinal(Base):
        __tablename__ = "emisiones_final"
        
        id = Column(Integer, primary_key=True, index=True)
        emision_temp_id = Column(Integer)
        proyecto_id = Column(Integer, ForeignKey("proyectos.id"))
        plantilla_id = Column(Integer, ForeignKey("plantillas.id"))
        usuario_id = Column(Integer, ForeignKey("usuarios.id"))
        datos_completos = Column(JSON)
        archivo_generado = Column(String(500))
        fecha_generacion = Column(DateTime(timezone=True))
        estado_generacion = Column(String(20))
        fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
        
        proyecto = relationship("Proyecto")
        plantilla = relationship("Plantilla")
        usuario = relationship("Usuario")

router = APIRouter(prefix="/estadisticas", tags=["Estadísticas"])

@router.get("/dashboard")
async def obtener_estadisticas_dashboard(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Obtiene estadísticas para el dashboard
    """
    try:
        print(f"Obteniendo estadísticas para usuario {current_user.id}")
        
        # 1. Proyectos
        total_proyectos = db.query(Proyecto).filter(
            Proyecto.is_deleted == False
        ).count()
        
        proyectos_activos = db.query(Proyecto).filter(
            Proyecto.is_deleted == False,
            Proyecto.activo == True
        ).count()
        
        # 2. Plantillas - SOLO DE PROYECTOS NO ELIMINADOS
        total_plantillas = db.query(Plantilla).join(Proyecto).filter(
            Plantilla.is_deleted == False,
            Proyecto.is_deleted == False
        ).count()
        
        plantillas_activas = db.query(Plantilla).join(Proyecto).filter(
            Plantilla.is_deleted == False,
            Plantilla.activa == True,
            Proyecto.is_deleted == False
        ).count()
        
        # 3. Emisiones del usuario actual
        emisiones_usuario = db.query(EmisionTemp).filter(
            EmisionTemp.usuario_id == current_user.id
        ).count()
        
        # 4. Documentos generados (de emisiones completadas)
        documentos_generados = 0
        try:
            # Verificar si existe la tabla emisiones_final
            from sqlalchemy import inspect
            inspector = inspect(db.bind)
            tabla_existe = 'emisiones_final' in inspector.get_table_names()
            
            if tabla_existe:
                documentos_generados = db.query(EmisionesFinal).filter(
                    EmisionesFinal.usuario_id == current_user.id,
                    EmisionesFinal.estado_generacion == 'completado'
                ).count()
        except Exception as e:
            print(f"Advertencia contando documentos generados: {e}")
        
        # 5. Documentos hoy
        documentos_hoy = 0
        try:
            from datetime import datetime
            hoy = datetime.utcnow().date()
            
            if tabla_existe:
                documentos_hoy = db.query(EmisionesFinal).filter(
                    EmisionesFinal.usuario_id == current_user.id,
                    EmisionesFinal.estado_generacion == 'completado',
                    db.func.date(EmisionesFinal.fecha_generacion) == hoy
                ).count()
        except Exception as e:
            print(f"Advertencia contando documentos hoy: {e}")
        
        # 6. Proyectos recientes (últimos 5) - SOLO NO ELIMINADOS
        proyectos_recientes = db.query(Proyecto).filter(
            Proyecto.is_deleted == False
        ).order_by(Proyecto.fecha_creacion.desc()).limit(5).all()
        
        proyectos_list = []
        for proyecto in proyectos_recientes:
            # Contar plantillas de este proyecto (solo activas y no eliminadas)
            num_plantillas = db.query(Plantilla).filter(
                Plantilla.proyecto_id == proyecto.id,
                Plantilla.is_deleted == False
            ).count()
            
            proyectos_list.append({
                "id": proyecto.id,
                "nombre": proyecto.nombre,
                "activo": proyecto.activo,
                "plantillas": num_plantillas,
                "fecha_creacion": proyecto.fecha_creacion.isoformat() if proyecto.fecha_creacion else None
            })
        
        # 7. Actividad reciente del usuario (últimas 10 acciones)
        actividad_reciente = db.query(Bitacora).filter(
            Bitacora.usuario_id == current_user.id
        ).order_by(Bitacora.fecha_evento.desc()).limit(10).all()
        
        actividad_list = []
        for actividad in actividad_reciente:
            actividad_list.append({
                "accion": actividad.accion,
                "modulo": actividad.modulo,
                "fecha": actividad.fecha_evento.isoformat() if actividad.fecha_evento else None,
                "detalles": actividad.detalles
            })
        
        return {
            "proyectos": {
                "total": total_proyectos,
                "activos": proyectos_activos,
                "inactivos": total_proyectos - proyectos_activos
            },
            "plantillas": {
                "total": total_plantillas,
                "activas": plantillas_activas,
                "inactivas": total_plantillas - plantillas_activas
            },
            "emisiones": {
                "usuario": emisiones_usuario,
                "documentos_generados": documentos_generados,
                "documentos_hoy": documentos_hoy
            },
            "proyectos_recientes": proyectos_list,
            "actividad_reciente": actividad_list,
            "usuario": {
                "nombre": current_user.nombre,
                "rol": current_user.rol,
                "ultimo_login": current_user.ultimo_login.isoformat() if current_user.ultimo_login else None
            }
        }
        
    except Exception as e:
        print(f"Error crítico en estadísticas: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo estadísticas: {str(e)}"
        )

@router.get("/usuario/{usuario_id}")
async def obtener_estadisticas_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Obtiene estadísticas específicas de un usuario (solo admin/superadmin)
    """
    # Verificar permisos
    if current_user.rol not in ["admin", "superadmin"] and current_user.id != usuario_id:
        raise HTTPException(
            status_code=403,
            detail="No tiene permisos para ver estas estadísticas"
        )
    
    try:
        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        # Emisiones del usuario
        total_emisiones = db.query(EmisionTemp).filter(
            EmisionTemp.usuario_id == usuario_id
        ).count()
        
        # Documentos generados
        documentos_generados = 0
        try:
            # Verificar si existe la tabla
            result = db.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'emisiones_final'
                )
            """))
            tabla_existe = result.scalar()
            
            if tabla_existe:
                documentos_generados = db.query(EmisionesFinal).filter(
                    EmisionesFinal.usuario_id == usuario_id,
                    EmisionesFinal.estado_generacion == 'completado'
                ).count()
        except:
            documentos_generados = 0
        
        # Última actividad
        ultima_actividad = db.query(Bitacora).filter(
            Bitacora.usuario_id == usuario_id
        ).order_by(Bitacora.fecha_evento.desc()).first()
        
        return {
            "usuario": {
                "id": usuario.id,
                "nombre": usuario.nombre,
                "rol": usuario.rol,
                "activo": usuario.activo
            },
            "estadisticas": {
                "total_emisiones": total_emisiones,
                "documentos_generados": documentos_generados,
                "ultima_actividad": ultima_actividad.fecha_evento.isoformat() if ultima_actividad else None,
                "ultima_accion": ultima_actividad.accion if ultima_actividad else None
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo estadísticas de usuario: {str(e)}"
        )