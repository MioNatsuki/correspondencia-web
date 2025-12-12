"""
Endpoints completos para procesamiento de CSV y generación de PDFs
"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import Dict, List, Optional
import os
import uuid
import tempfile
from pathlib import Path
import zipfile
import shutil
from datetime import datetime
import logging 

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import Usuario, Plantilla, Proyecto, EmisionTemp
from app.schemas import (
    CSVUploadRequest, PDFPreviewRequest, PDFGenerateRequest,
    SuccessResponse, ErrorResponse
)
from app.utils.file_utils import guardar_archivo, eliminar_archivo, validar_archivo_pdf
from app.core.pdf_converter import PDFConverter
from app.core.csv_service import csv_service
from app.core.pdf_service import pdf_generator
from app.config import settings
from app.utils.logger import log_auditoria

router = APIRouter(prefix="/procesamiento", tags=["Procesamiento"])
logger = logging.getLogger(__name__)

# ========== ENDPOINT 1: CARGAR CSV ==========
@router.post("/cargar-csv")
async def cargar_csv(
    proyecto_id: int,
    plantilla_id: Optional[int] = None,
    delimitador: str = ",",
    encoding: Optional[str] = None,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """
    Carga y procesa archivo CSV, hace match con padrón
    """
    try:
        # Validar archivo
        if not file.filename or not file.filename.endswith('.csv'):
            raise HTTPException(400, "Archivo debe ser CSV (.csv)")
        
        # Verificar proyecto
        proyecto = db.query(Proyecto).filter(
            Proyecto.id == proyecto_id,
            Proyecto.is_deleted == False
        ).first()
        
        if not proyecto:
            raise HTTPException(404, "Proyecto no encontrado")
        
        # Verificar plantilla si se especifica
        if plantilla_id:
            plantilla = db.query(Plantilla).filter(
                Plantilla.id == plantilla_id,
                Plantilla.is_deleted == False
            ).first()
            
            if not plantilla:
                raise HTTPException(404, "Plantilla no encontrada")
        
        # Guardar archivo temporalmente
        temp_dir = os.path.join(settings.UPLOAD_DIR, "temp_csv")
        os.makedirs(temp_dir, exist_ok=True)
        
        temp_filename = f"csv_{current_user.id}_{uuid.uuid4().hex[:8]}.csv"
        temp_path = os.path.join(temp_dir, temp_filename)
        
        # Guardar contenido
        with open(temp_path, "wb") as buffer:
            contenido = await file.read()
            buffer.write(contenido)
        
        # Procesar CSV
        resultados = csv_service.procesar_csv(
            archivo_path=temp_path,
            proyecto_id=proyecto_id,
            usuario_id=current_user.id,
            plantilla_id=plantilla_id,
            delimitador=delimitador,
            encoding=encoding
        )
        
        # Registrar en bitácora
        log_auditoria(
            db=db,
            usuario_id=current_user.id,
            accion="cargar_csv",
            modulo="procesamiento",
            detalles={
                "proyecto_id": proyecto_id,
                "plantilla_id": plantilla_id,
                "session_id": resultados.get("session_id"),
                "total_registros": resultados.get("total_registros", 0),
                "registros_procesados": resultados.get("registros_procesados", 0)
            }
        )
        
        # Limpiar archivo temporal
        try:
            os.remove(temp_path)
        except:
            pass
        
        return resultados
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error procesando CSV: {str(e)}")

# ========== ENDPOINT 2: PREVIEW PLANTILLA CON DATOS ==========
@router.post("/preview-plantilla")
async def preview_plantilla(
    plantilla_id: int,
    registro_idx: int = 0,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Genera preview de plantilla con datos de ejemplo
    """
    try:
        # Obtener plantilla
        plantilla = db.query(Plantilla).filter(
            Plantilla.id == plantilla_id,
            Plantilla.is_deleted == False
        ).first()
        
        if not plantilla:
            raise HTTPException(404, "Plantilla no encontrada")
        
        # Obtener un registro de ejemplo del padrón del proyecto
        proyecto = db.query(Proyecto).filter(
            Proyecto.id == plantilla.proyecto_id
        ).first()
        
        if not proyecto:
            raise HTTPException(404, "Proyecto no encontrado")
        
        # Obtener datos de ejemplo del padrón
        from app.api.padrones import obtener_datos_ejemplo
        datos_ejemplo = await obtener_datos_ejemplo(
            proyecto.tabla_padron, 
            1,  # limit
            db, 
            current_user
        )
        
        if not datos_ejemplo or len(datos_ejemplo) == 0:
            # Usar datos dummy si no hay ejemplo
            datos_registro = {"nombre": "EJEMPLO", "cuenta": "123456", "codigo": "TEST001"}
        else:
            datos_registro = datos_ejemplo[0].datas if hasattr(datos_ejemplo[0], 'datas') else {}
        
        # Preparar definición de plantilla
        # (Aquí necesitaríamos obtener la estructura real de campos)
        plantilla_def = {
            "pdf_base": plantilla.pdf_base,
            "elementos": []  # Esto debería venir de plantilla.campos_json
        }
        
        # Generar PDF de preview
        success, message, pdf_path = pdf_generator.generar_pdf_individual(
            plantilla_def, datos_registro
        )
        
        if not success:
            raise HTTPException(500, f"Error generando preview: {message}")
        
        # Convertir PDF a imagen para mostrar en frontend
        img_path, error = PDFConverter.pdf_a_imagen(pdf_path, 1, 1.5, "PNG")
        
        if error:
            # Si no se puede convertir, devolver el PDF
            return FileResponse(
                pdf_path,
                media_type="application/pdf",
                filename=f"preview_{plantilla_id}.pdf"
            )
        
        # Devolver URL de la imagen
        img_filename = os.path.basename(img_path)
        img_url = f"/uploads/previews/{img_filename}"
        
        # Limpiar PDF temporal
        try:
            os.remove(pdf_path)
        except:
            pass
        
        return {
            "success": True,
            "preview_url": img_url,
            "datos_usados": datos_registro
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error generando preview: {str(e)}")

# ========== ENDPOINT 3: GENERAR PDFs MASIVOS ==========
@router.post("/generar-lote")
async def generar_lote_pdfs(
    session_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """
    Inicia generación masiva de PDFs para una sesión CSV
    """
    try:
        # Verificar que exista la sesión
        registros = db.query(EmisionTemp).filter(
            EmisionTemp.sesion_id == session_id
        ).count()
        
        if registros == 0:
            raise HTTPException(404, f"Sesión {session_id} no encontrada")
        
        # Obtener información de la sesión
        primer_registro = db.query(EmisionTemp).filter(
            EmisionTemp.sesion_id == session_id
        ).first()
        
        if not primer_registro:
            raise HTTPException(404, "No hay registros en la sesión")
        
        # Obtener plantilla
        plantilla = None
        if primer_registro.plantilla_id:
            plantilla = db.query(Plantilla).filter(
                Plantilla.id == primer_registro.plantilla_id
            ).first()
        
        if not plantilla:
            raise HTTPException(404, "Plantilla no encontrada")
        
        # Preparar tarea en background
        background_tasks.add_task(
            _generar_pdfs_en_segundo_plano,
            session_id,
            plantilla.id,
            current_user.id,
            db
        )
        
        # Registrar en bitácora
        log_auditoria(
            db=db,
            usuario_id=current_user.id,
            accion="iniciar_generacion",
            modulo="procesamiento",
            detalles={
                "session_id": session_id,
                "plantilla_id": plantilla.id,
                "total_registros": registros
            }
        )
        
        return {
            "success": True,
            "message": "Generación iniciada en segundo plano",
            "job_id": session_id,
            "total_registros": registros,
            "estado": "procesando",
            "url_monitoreo": f"/api/procesamiento/estado/{session_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error iniciando generación: {str(e)}")

# ========== ENDPOINT 4: ESTADO DE GENERACIÓN ==========
@router.get("/estado/{session_id}")
async def obtener_estado_generacion(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Obtiene estado de generación de una sesión
    """
    try:
        # Contar registros por estado
        total = db.query(EmisionTemp).filter(
            EmisionTemp.sesion_id == session_id
        ).count()
        
        procesados = db.query(EmisionTemp).filter(
            EmisionTemp.sesion_id == session_id,
            EmisionTemp.estado == 'completado'
        ).count()
        
        error = db.query(EmisionTemp).filter(
            EmisionTemp.sesion_id == session_id,
            EmisionTemp.estado == 'error'
        ).count()
        
        pendientes = total - procesados - error
        
        porcentaje = (procesados / total * 100) if total > 0 else 0
        
        # Obtener primer registro para metadata
        primer_registro = db.query(EmisionTemp).filter(
            EmisionTemp.sesion_id == session_id
        ).first()
        
        metadata = {}
        if primer_registro:
            metadata = {
                "proyecto_id": primer_registro.proyecto_id,
                "plantilla_id": primer_registro.plantilla_id,
                "fecha_carga": primer_registro.fecha_carga.isoformat() if primer_registro.fecha_carga else None
            }
        
        return {
            "session_id": session_id,
            "estado": "completado" if pendientes == 0 else "procesando",
            "progreso": {
                "total": total,
                "procesados": procesados,
                "pendientes": pendientes,
                "error": error,
                "porcentaje": round(porcentaje, 2)
            },
            "metadata": metadata,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo estado: {str(e)}")

# ========== ENDPOINT 5: DESCARGAR RESULTADOS ==========
@router.get("/descargar/{session_id}")
async def descargar_resultados(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Descarga ZIP con todos los PDFs generados en una sesión
    """
    try:
        # Verificar que la sesión existe y está completada
        registros_pendientes = db.query(EmisionTemp).filter(
            EmisionTemp.sesion_id == session_id,
            EmisionTemp.estado.in_(['pendiente', 'procesando'])
        ).count()
        
        if registros_pendientes > 0:
            raise HTTPException(400, "La generación aún no ha finalizado")
        
        # Buscar archivo ZIP generado
        output_dir = os.path.join(settings.UPLOAD_DIR, "generados", session_id)
        zip_path = os.path.join(output_dir, f"{session_id}.zip")
        
        if not os.path.exists(zip_path):
            # Buscar en directorio de sesiones antiguas
            old_zips = list(Path(settings.UPLOAD_DIR).glob(f"**/{session_id}.zip"))
            if old_zips:
                zip_path = str(old_zips[0])
            else:
                raise HTTPException(404, "Archivos de resultados no encontrados")
        
        # Registrar descarga en bitácora
        log_auditoria(
            db=db,
            usuario_id=current_user.id,
            accion="descargar_resultados",
            modulo="procesamiento",
            detalles={"session_id": session_id}
        )
        
        # Devolver archivo ZIP
        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename=f"resultados_{session_id}.zip"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error descargando resultados: {str(e)}")

# ========== ENDPOINT 6: CANCELAR GENERACIÓN ==========
@router.post("/cancelar/{session_id}")
async def cancelar_generacion(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """
    Cancela una generación en progreso
    """
    try:
        # Actualizar estado de registros
        registros_actualizados = db.query(EmisionTemp).filter(
            EmisionTemp.sesion_id == session_id,
            EmisionTemp.estado.in_(['pendiente', 'procesando'])
        ).update({"estado": "cancelado"})
        
        db.commit()
        
        log_auditoria(
            db=db,
            usuario_id=current_user.id,
            accion="cancelar_generacion",
            modulo="procesamiento",
            detalles={"session_id": session_id, "registros_afectados": registros_actualizados}
        )
        
        return {
            "success": True,
            "message": f"Generación cancelada. {registros_actualizados} registros afectados."
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Error cancelando generación: {str(e)}")

# ========== FUNCIÓN DE BACKGROUND ==========
def _generar_pdfs_en_segundo_plano(session_id: str, plantilla_id: int, usuario_id: int, db):
    """
    Función que se ejecuta en segundo plano para generar PDFs
    """
    try:
        # Obtener todos los registros de la sesión
        registros = db.query(EmisionTemp).filter(
            EmisionTemp.sesion_id == session_id,
            EmisionTemp.estado == 'pendiente'
        ).all()
        
        if not registros:
            return
        
        # Obtener plantilla
        plantilla = db.query(Plantilla).filter(Plantilla.id == plantilla_id).first()
        if not plantilla:
            # Actualizar todos como error
            for registro in registros:
                registro.estado = 'error'
                registro.error_mensaje = "Plantilla no encontrada"
            db.commit()
            return
        
        # Preparar definición de plantilla
        # NOTA: Aquí necesitamos obtener la estructura real de campos
        # Por ahora usamos estructura básica
        plantilla_def = {
            "pdf_base": plantilla.pdf_base if plantilla.pdf_base and os.path.exists(plantilla.pdf_base) else None,
            "elementos": plantilla.config_json.get("elementos", []) if plantilla.config_json else []
        }
        
        # Crear directorio de salida
        output_dir = os.path.join(settings.UPLOAD_DIR, "generados", session_id)
        os.makedirs(output_dir, exist_ok=True)
        
        # Procesar registros en lotes
        archivos_generados = []
        
        for i, registro in enumerate(registros):
            try:
                # Actualizar estado a procesando
                registro.estado = 'procesando'
                db.commit()
                
                # Generar PDF individual
                datos = registro.datos_json if registro.datos_json else {}
                cuenta = registro.cuenta or f"doc_{i:06d}"
                
                output_path = os.path.join(output_dir, f"{cuenta}.pdf")
                success, message, _ = pdf_generator.generar_pdf_individual(
                    plantilla_def, datos, output_path
                )
                
                if success:
                    registro.estado = 'completado'
                    archivos_generados.append(output_path)
                else:
                    registro.estado = 'error'
                    registro.error_mensaje = message[:500]  # Limitar tamaño
                
                db.commit()
                
                # Pequeña pausa para no saturar
                if i % 10 == 0:
                    import time
                    time.sleep(0.01)
                    
            except Exception as e:
                registro.estado = 'error'
                registro.error_mensaje = str(e)[:500]
                db.commit()
                continue
        
        # Crear ZIP con todos los PDFs generados
        if archivos_generados:
            zip_path = os.path.join(output_dir, f"{session_id}.zip")
            success, message = pdf_generator.crear_zip_de_pdfs(archivos_generados, zip_path)
            
            if success:
                logger.info(f"ZIP creado exitosamente: {zip_path}")
            else:
                logger.error(f"Error creando ZIP: {message}")
        
        # Limpiar cache
        pdf_generator.limpiar_cache()
        
        logger.info(f"Generación completada para sesión {session_id}: {len(archivos_generados)}/{len(registros)} exitosos")
        
    except Exception as e:
        logger.error(f"Error en generación en segundo plano: {str(e)}", exc_info=True)
    finally:
        db.close()