"""
Endpoints completos para procesamiento de CSV y generación de PDFs
Incluye campos dinámicos y flujo completo de emisión
"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks, Query
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import Dict, List, Optional, Any
import os
import uuid
import tempfile
from pathlib import Path
import zipfile
import shutil
from datetime import datetime, timedelta
import asyncio
import logging

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import (
    Usuario, Plantilla, Proyecto, EmisionTemp, EmisionesFinal, EmisionesAcumuladas,
    OrdenImpresion, HistoricoContadores, ConfiguracionCamposDinamicos, PadronMaestro,
    CampoPlantilla, Bitacora, MatchExcepciones
)
from app.schemas import (
    CSVUploadRequest, PDFPreviewRequest, PDFGenerateRequest,
    SuccessResponse, ErrorResponse
)
from app.utils.file_utils import guardar_archivo, eliminar_archivo, validar_archivo_pdf, calcular_hash_archivo
from app.core.pdf_converter import PDFConverter
from app.core.csv_service import csv_service
from app.core.pdf_service import pdf_generator
from app.core.dynamic_fields_service import DynamicFieldsService
from app.config import settings
from app.utils.logger import log_auditoria, logger

router = APIRouter(prefix="/procesamiento", tags=["Procesamiento"])

# ========== FUNCIONES DE BACKGROUND ==========

async def _generar_pdfs_completos(
    session_id: str,
    plantilla_id: int,
    usuario_id: int,
    db: Session
):
    """
    Función que se ejecuta en background para generar PDFs completos
    Incluye campos dinámicos y guardado en acumulados
    """
    try:
        # Obtener todos los registros finales pendientes
        registros_final = db.query(EmisionesFinal).filter(
            EmisionesFinal.emision_temp_id.in_(
                db.query(EmisionTemp.id).filter(EmisionTemp.sesion_id == session_id)
            ),
            EmisionesFinal.estado_generacion.in_(["pendiente", "generando"])
        ).all()
        
        if not registros_final:
            logger.info(f"No hay registros pendientes para la sesión {session_id}")
            return
        
        # Obtener proyecto y plantilla
        primer_registro = registros_final[0]
        proyecto_id = primer_registro.proyecto_id
        plantilla_id = primer_registro.plantilla_id
        
        plantilla = db.query(Plantilla).filter(
            Plantilla.id == plantilla_id
        ).first()
        
        if not plantilla:
            logger.error(f"Plantilla {plantilla_id} no encontrada")
            return
        
        # Obtener campos de la plantilla
        campos_plantilla = db.query(CampoPlantilla).filter(
            CampoPlantilla.plantilla_id == plantilla_id,
            CampoPlantilla.activo == True
        ).order_by(CampoPlantilla.orden).all()
        
        # Preparar definición de plantilla
        plantilla_def = {
            "pdf_base": plantilla.ruta_archivo if plantilla.ruta_archivo and os.path.exists(plantilla.ruta_archivo) else None,
            "campos": campos_plantilla,
            "configuracion": plantilla.campos_json or {}
        }
        
        # Crear directorio de salida
        output_dir = os.path.join(settings.UPLOAD_DIR, "generados", session_id)
        os.makedirs(output_dir, exist_ok=True)
        
        # Servicio de campos dinámicos
        dynamic_service = DynamicFieldsService(db)
        
        archivos_generados = []
        emisiones_acumuladas_ids = []
        
        for i, registro in enumerate(registros_final):
            try:
                # Actualizar estado a procesando
                registro.estado_generacion = "generando"
                db.commit()
                
                # Obtener datos del registro
                datos_completos = registro.datos_completos or {}
                
                # Asegurar que tenemos cuenta
                cuenta = datos_completos.get('cuenta') or datos_completos.get('CUENTA') or f"doc_{i:06d}"
                
                # Generar PDF individual
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                output_path = os.path.join(output_dir, f"{cuenta}_{timestamp}.pdf")
                
                # Aplicar campos dinámicos si no están en datos
                if 'campos_dinamicos' not in datos_completos:
                    datos_completos = await dynamic_service.aplicar_campos_dinamicos(
                        datos_completos,
                        proyecto_id,
                        plantilla_id,
                        usuario_id
                    )
                
                # Generar PDF
                success, message, pdf_path = pdf_generator.generar_pdf_individual(
                    plantilla_def,
                    datos_completos,
                    output_path
                )
                
                if success:
                    # Actualizar registro final
                    registro.estado_generacion = "completado"
                    registro.archivo_generado = pdf_path
                    registro.fecha_generacion = datetime.utcnow()
                    
                    # Guardar en acumulados
                    emision_acumulada = EmisionesAcumuladas(
                        proyecto_id=proyecto_id,
                        plantilla_id=plantilla_id,
                        usuario_id=usuario_id,
                        cuenta=cuenta,
                        codigo_afiliado=datos_completos.get('codigo_afiliado') or datos_completos.get('CODIGO_AFILIADO'),
                        nombre_afiliado=datos_completos.get('nombre_completo') or datos_completos.get('NOMBRE') or datos_completos.get('nombre'),
                        datos_completos=datos_completos,
                        nombre_archivo=os.path.basename(pdf_path),
                        ruta_archivo=pdf_path,
                        fecha_emision=datetime.utcnow(),
                        # Campos dinámicos
                        campos_dinamicos=datos_completos.get('campos_dinamicos'),
                        visita_actual=datos_completos.get('visita_actual'),
                        pmo_actual=datos_completos.get('pmo_actual'),
                        tipo_documento=datos_completos.get('tipo_documento'),
                        codebar_generado=datos_completos.get('codebar_generado')
                    )
                    
                    db.add(emision_acumulada)
                    db.flush()  # Para obtener el ID
                    
                    emisiones_acumuladas_ids.append(emision_acumulada.id)
                    archivos_generados.append(pdf_path)
                    
                    # Registrar cambios en histórico si hay campos dinámicos
                    campos_dinamicos = datos_completos.get('campos_dinamicos', {})
                    
                    # Registrar visita si cambió
                    visita_actual = datos_completos.get('visita_actual')
                    if visita_actual:
                        # Buscar última visita
                        ultima_visita = db.query(HistoricoContadores).filter(
                            HistoricoContadores.proyecto_id == proyecto_id,
                            HistoricoContadores.cuenta == cuenta,
                            HistoricoContadores.tipo == 'visita'
                        ).order_by(HistoricoContadores.fecha_cambio.desc()).first()
                        
                        valor_anterior = ultima_visita.valor_nuevo if ultima_visita else None
                        
                        if not ultima_visita or ultima_visita.valor_nuevo != visita_actual:
                            historico_visita = HistoricoContadores(
                                proyecto_id=proyecto_id,
                                cuenta=cuenta,
                                tipo='visita',
                                valor_anterior=valor_anterior,
                                valor_nuevo=visita_actual,
                                usuario_id=usuario_id,
                                emision_id=emision_acumulada.id
                            )
                            db.add(historico_visita)
                    
                    # Registrar PMO si cambió
                    pmo_actual = datos_completos.get('pmo_actual')
                    if pmo_actual:
                        ultimo_pmo = db.query(HistoricoContadores).filter(
                            HistoricoContadores.proyecto_id == proyecto_id,
                            HistoricoContadores.cuenta == cuenta,
                            HistoricoContadores.tipo == 'pmo'
                        ).order_by(HistoricoContadores.fecha_cambio.desc()).first()
                        
                        valor_anterior = ultimo_pmo.valor_nuevo if ultimo_pmo else None
                        
                        if not ultimo_pmo or ultimo_pmo.valor_nuevo != str(pmo_actual):
                            historico_pmo = HistoricoContadores(
                                proyecto_id=proyecto_id,
                                cuenta=cuenta,
                                tipo='pmo',
                                valor_anterior=valor_anterior,
                                valor_nuevo=str(pmo_actual),
                                usuario_id=usuario_id,
                                emision_id=emision_acumulada.id
                            )
                            db.add(historico_pmo)
                    
                    db.commit()
                    
                else:
                    registro.estado_generacion = "error"
                    registro.archivo_generado = None
                    db.commit()
                
                # Pequeña pausa para no saturar
                if i % 10 == 0:
                    await asyncio.sleep(0.05)
                    
            except Exception as e:
                logger.error(f"Error procesando registro {i}: {str(e)}")
                registro.estado_generacion = "error"
                db.commit()
                continue
        
        # Crear ZIP con todos los PDFs generados
        if archivos_generados:
            zip_path = os.path.join(output_dir, f"{session_id}.zip")
            success, message = pdf_generator.crear_zip_de_pdfs(archivos_generados, zip_path)
            
            if success:
                logger.info(f"ZIP creado exitosamente: {zip_path}")
                
                # Registrar en bitácora
                log_auditoria(
                    db=db,
                    usuario_id=usuario_id,
                    accion="generacion_completada",
                    modulo="procesamiento",
                    detalles={
                        "session_id": session_id,
                        "archivos_generados": len(archivos_generados),
                        "zip_path": zip_path,
                        "proyecto_id": proyecto_id,
                        "plantilla_id": plantilla_id,
                        "total_registros": len(registros_final)
                    }
                )
            else:
                logger.error(f"Error creando ZIP: {message}")
        
        # Limpiar tablas temporales (opcional)
        try:
            # Eliminar registros temporales ya procesados
            db.query(EmisionesFinal).filter(
                EmisionesFinal.emision_temp_id.in_(
                    db.query(EmisionTemp.id).filter(EmisionTemp.sesion_id == session_id)
                ),
                EmisionesFinal.estado_generacion == "completado"
            ).delete(synchronize_session=False)
            
            db.query(EmisionTemp).filter(
                EmisionTemp.sesion_id == session_id
            ).delete(synchronize_session=False)
            
            db.commit()
            logger.info(f"Registros temporales limpiados para sesión {session_id}")
            
        except Exception as e:
            logger.warning(f"No se pudieron limpiar registros temporales: {str(e)}")
            db.rollback()
        
        logger.info(f"Generación completada para sesión {session_id}: {len(archivos_generados)}/{len(registros_final)} exitosos")
        
    except Exception as e:
        logger.error(f"Error en generación completa: {str(e)}", exc_info=True)
    finally:
        db.close()

# ========== ENDPOINT 1: CARGAR CSV (ACTUALIZADO) ==========
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
    Versión actualizada para flujo completo
    """
    try:
        # Validar archivo
        if not file.filename or not file.filename.lower().endswith('.csv'):
            raise HTTPException(400, "Archivo debe ser CSV (.csv)")
        
        # Verificar proyecto
        proyecto = db.query(Proyecto).filter(
            Proyecto.id == proyecto_id,
            Proyecto.is_deleted == False
        ).first()
        
        if not proyecto:
            raise HTTPException(404, "Proyecto no encontrado")
        
        # Verificar plantilla si se especifica
        plantilla = None
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

# ========== ENDPOINT NUEVO: INICIAR EMISIÓN COMPLETA ==========
@router.post("/iniciar-emision-completa")
async def iniciar_emision_completa(
    proyecto_id: int,
    plantilla_id: int,
    csv_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """
    Inicia proceso completo de emisión con campos dinámicos
    """
    try:
        # 1. Validar archivo
        if not csv_file.filename or not csv_file.filename.lower().endswith('.csv'):
            raise HTTPException(400, "Archivo debe ser CSV (.csv)")
        
        # 2. Validar proyecto
        proyecto = db.query(Proyecto).filter(
            Proyecto.id == proyecto_id,
            Proyecto.is_deleted == False,
            Proyecto.activo == True
        ).first()
        
        if not proyecto:
            raise HTTPException(404, "Proyecto no encontrado o inactivo")
        
        # 3. Validar plantilla
        plantilla = db.query(Plantilla).filter(
            Plantilla.id == plantilla_id,
            Plantilla.proyecto_id == proyecto_id,
            Plantilla.is_deleted == False,
            Plantilla.activa == True
        ).first()
        
        if not plantilla:
            raise HTTPException(404, "Plantilla no encontrada o inactiva")
        
        # 4. Guardar CSV temporal
        temp_dir = os.path.join(settings.UPLOAD_DIR, "temp_emisiones")
        os.makedirs(temp_dir, exist_ok=True)
        
        session_id = f"emision_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        temp_csv_path = os.path.join(temp_dir, f"{session_id}.csv")
        
        with open(temp_csv_path, "wb") as f:
            contenido = await csv_file.read()
            f.write(contenido)
        
        # 5. Procesar CSV (match con padrón)
        resultados_csv = csv_service.procesar_csv(
            archivo_path=temp_csv_path,
            proyecto_id=proyecto_id,
            usuario_id=current_user.id,
            plantilla_id=plantilla_id,
            delimitador=",",
            encoding=None
        )
        
        if resultados_csv.get("estado") != "completado":
            # Limpiar archivo temporal
            try:
                os.remove(temp_csv_path)
            except:
                pass
            
            errores = resultados_csv.get("errores", ["Error desconocido en procesamiento CSV"])
            raise HTTPException(400, f"Error procesando CSV: {errores[0]}")
        
        # 6. Crear orden de impresión (usar orden del CSV si existe, si no secuencial)
        registros_temp = db.query(EmisionTemp).filter(
            EmisionTemp.sesion_id == session_id
        ).order_by(EmisionTemp.id).all()
        
        for idx, registro in enumerate(registros_temp):
            orden = OrdenImpresion(
                sesion_id=session_id,
                cuenta=registro.cuenta or f"reg_{idx:06d}",
                orden=idx + 1
            )
            db.add(orden)
        
        db.commit()
        
        # 7. Preparar previsualización con campos dinámicos
        dynamic_service = DynamicFieldsService(db)
        
        # Tomar primeros 3 registros para previsualización
        preview_registros = []
        for registro in registros_temp[:3]:
            datos_con_dinamicos = await dynamic_service.aplicar_campos_dinamicos(
                registro.datos_json or {},
                proyecto_id,
                plantilla_id,
                current_user.id
            )
            preview_registros.append({
                "cuenta": registro.cuenta,
                "datos_completos": datos_con_dinamicos,
                "campos_dinamicos": datos_con_dinamicos.get('campos_dinamicos', {})
            })
        
        # 8. Obtener configuración de campos dinámicos
        config_dinamicos = db.query(ConfiguracionCamposDinamicos).filter(
            ConfiguracionCamposDinamicos.activo == True
        ).filter(
            (ConfiguracionCamposDinamicos.proyecto_id == proyecto_id) |
            (ConfiguracionCamposDinamicos.plantilla_id == plantilla_id)
        ).all()
        
        config_dict = {}
        for config in config_dinamicos:
            config_dict[config.nombre] = {
                "tipo": config.tipo,
                "configuracion": config.configuracion,
                "requerir_aprobacion": config.requerir_aprobacion,
                "formula_calculo": config.formula_calculo
            }
        
        # 9. Crear registros en EmisionesFinal (estado pendiente)
        for registro in registros_temp:
            datos_completos = registro.datos_json or {}
            
            # Aplicar campos dinámicos básicos
            datos_con_dinamicos = await dynamic_service.aplicar_campos_dinamicos(
                datos_completos,
                proyecto_id,
                plantilla_id,
                current_user.id
            )
            
            emision_final = EmisionesFinal(
                emision_temp_id=registro.id,
                proyecto_id=proyecto_id,
                plantilla_id=plantilla_id,
                usuario_id=current_user.id,
                datos_completos=datos_con_dinamicos,
                estado_generacion="pendiente",
                fecha_creacion=datetime.utcnow()
            )
            db.add(emision_final)
        
        db.commit()
        
        # 10. Limpiar archivo temporal
        try:
            os.remove(temp_csv_path)
        except:
            pass
        
        # Registrar en bitácora
        log_auditoria(
            db=db,
            usuario_id=current_user.id,
            accion="iniciar_emision_completa",
            modulo="procesamiento",
            detalles={
                "session_id": session_id,
                "proyecto_id": proyecto_id,
                "plantilla_id": plantilla_id,
                "total_registros": len(registros_temp),
                "campos_dinamicos_config": len(config_dinamicos)
            }
        )
        
        return {
            "success": True,
            "session_id": session_id,
            "proyecto_id": proyecto_id,
            "plantilla_id": plantilla_id,
            "total_registros": len(registros_temp),
            "preview_registros": preview_registros,
            "configuracion_dinamicos": config_dict,
            "campos_dinamicos_sugeridos": preview_registros[0].get('campos_dinamicos', {}) if preview_registros else {},
            "next_step": "aprobar_campos_dinamicos",
            "message": "CSV procesado correctamente. Revise los campos dinámicos sugeridos antes de generar PDFs."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error iniciando emisión completa: {str(e)}")

# ========== ENDPOINT NUEVO: APROBAR CAMPOS DINÁMICOS ==========
@router.post("/aprobar-campos-dinamicos")
async def aprobar_campos_dinamicos(
    session_id: str,
    aprobaciones: dict,  # {campo: valor_aprobado}
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Acepta o modifica valores de campos dinámicos antes de generar PDFs
    """
    try:
        # Obtener registros finales de la sesión
        registros_final = db.query(EmisionesFinal).filter(
            EmisionesFinal.emision_temp_id.in_(
                db.query(EmisionTemp.id).filter(EmisionTemp.sesion_id == session_id)
            ),
            EmisionesFinal.estado_generacion == "pendiente"
        ).all()
        
        if not registros_final:
            raise HTTPException(404, "No hay registros pendientes para esta sesión")
        
        # Obtener proyecto y plantilla del primer registro
        primer_registro = registros_final[0]
        proyecto_id = primer_registro.proyecto_id
        plantilla_id = primer_registro.plantilla_id
        
        dynamic_service = DynamicFieldsService(db)
        registros_actualizados = 0
        
        for registro in registros_final:
            datos_completos = registro.datos_completos or {}
            campos_dinamicos = datos_completos.get('campos_dinamicos', {})
            
            # Aplicar aprobaciones
            for campo, valor_aprobado in aprobaciones.items():
                if campo in campos_dinamicos:
                    campos_dinamicos[campo] = valor_aprobado
                    
                    # Actualizar campos específicos
                    if campo == 'visita_sugerida':
                        datos_completos['visita_actual'] = valor_aprobado
                    elif campo == 'pmo_sugerido':
                        datos_completos['pmo_actual'] = valor_aprobado
                    elif campo == 'tipo_documento':
                        datos_completos['tipo_documento'] = valor_aprobado
                    elif campo == 'fecha_emision':
                        datos_completos['fecha_emision'] = valor_aprobado
                    elif campo == 'codebar':
                        datos_completos['codebar_generado'] = valor_aprobado
            
            # Actualizar campos dinámicos
            datos_completos['campos_dinamicos'] = campos_dinamicos
            
            # Recalcular codebar si se modificaron campos relacionados
            if any(field in aprobaciones for field in ['cuenta', 'fecha_emision', 'visita_sugerida']):
                # Obtener configuración de codebar
                config_codebar = db.query(ConfiguracionCamposDinamicos).filter(
                    ConfiguracionCamposDinamicos.activo == True,
                    ConfiguracionCamposDinamicos.tipo == 'codebar'
                ).filter(
                    (ConfiguracionCamposDinamicos.proyecto_id == proyecto_id) |
                    (ConfiguracionCamposDinamicos.plantilla_id == plantilla_id)
                ).first()
                
                if config_codebar:
                    codebar = await dynamic_service.calcular_codebar(
                        datos_completos,
                        config_codebar.configuracion
                    )
                    datos_completos['codebar_generado'] = codebar
                    campos_dinamicos['codebar'] = codebar
            
            # Actualizar registro
            registro.datos_completos = datos_completos
            registros_actualizados += 1
        
        db.commit()
        
        # Registrar en bitácora
        log_auditoria(
            db=db,
            usuario_id=current_user.id,
            accion="aprobar_campos_dinamicos",
            modulo="procesamiento",
            detalles={
                "session_id": session_id,
                "registros_actualizados": registros_actualizados,
                "aprobaciones": aprobaciones
            }
        )
        
        return {
            "success": True,
            "message": f"Campos dinámicos aprobados para {registros_actualizados} registros",
            "session_id": session_id,
            "registros_actualizados": registros_actualizados,
            "next_step": "generar_pdfs"
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Error aprobando campos dinámicos: {str(e)}")

# ========== ENDPOINT NUEVO: GENERAR PDFs COMPLETOS ==========
@router.post("/generar-pdfs-completos")
async def generar_pdfs_completos(
    session_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Inicia generación de PDFs completos en background
    """
    try:
        # Verificar que existan registros en emisiones_final
        registros_final = db.query(EmisionesFinal).filter(
            EmisionesFinal.emision_temp_id.in_(
                db.query(EmisionTemp.id).filter(EmisionTemp.sesion_id == session_id)
            ),
            EmisionesFinal.estado_generacion == "pendiente"
        ).all()
        
        if not registros_final:
            raise HTTPException(404, "No hay registros pendientes para generar")
        
        # Obtener plantilla del primer registro
        primer_registro = registros_final[0]
        plantilla_id = primer_registro.plantilla_id
        
        # Iniciar generación en background
        background_tasks.add_task(
            _generar_pdfs_completos,
            session_id,
            plantilla_id,
            current_user.id,
            db
        )
        
        # Registrar en bitácora
        log_auditoria(
            db=db,
            usuario_id=current_user.id,
            accion="iniciar_generacion_pdfs",
            modulo="procesamiento",
            detalles={
                "session_id": session_id,
                "total_registros": len(registros_final),
                "plantilla_id": plantilla_id
            }
        )
        
        return {
            "success": True,
            "message": "Generación de PDFs iniciada en segundo plano",
            "session_id": session_id,
            "total_registros": len(registros_final),
            "estado": "procesando",
            "monitor_url": f"/api/procesamiento/estado/{session_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error iniciando generación: {str(e)}")

# ========== ENDPOINT 4: ESTADO DE GENERACIÓN (ACTUALIZADO) ==========
@router.get("/estado/{session_id}")
async def obtener_estado_generacion(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Obtiene estado de generación de una sesión (actualizado para flujo completo)
    """
    try:
        # Contar registros por estado en emisiones_final
        total_final = db.query(EmisionesFinal).filter(
            EmisionesFinal.emision_temp_id.in_(
                db.query(EmisionTemp.id).filter(EmisionTemp.sesion_id == session_id)
            )
        ).count()
        
        procesados = db.query(EmisionesFinal).filter(
            EmisionesFinal.emision_temp_id.in_(
                db.query(EmisionTemp.id).filter(EmisionTemp.sesion_id == session_id)
            ),
            EmisionesFinal.estado_generacion == 'completado'
        ).count()
        
        error = db.query(EmisionesFinal).filter(
            EmisionesFinal.emision_temp_id.in_(
                db.query(EmisionTemp.id).filter(EmisionTemp.sesion_id == session_id)
            ),
            EmisionesFinal.estado_generacion == 'error'
        ).count()
        
        generando = db.query(EmisionesFinal).filter(
            EmisionesFinal.emision_temp_id.in_(
                db.query(EmisionTemp.id).filter(EmisionTemp.sesion_id == session_id)
            ),
            EmisionesFinal.estado_generacion == 'generando'
        ).count()
        
        pendientes = total_final - procesados - error - generando
        
        porcentaje = (procesados / total_final * 100) if total_final > 0 else 0
        
        # Obtener primer registro para metadata
        primer_registro = db.query(EmisionesFinal).filter(
            EmisionesFinal.emision_temp_id.in_(
                db.query(EmisionTemp.id).filter(EmisionTemp.sesion_id == session_id)
            )
        ).first()
        
        metadata = {}
        if primer_registro:
            metadata = {
                "proyecto_id": primer_registro.proyecto_id,
                "plantilla_id": primer_registro.plantilla_id,
                "fecha_creacion": primer_registro.fecha_creacion.isoformat() if primer_registro.fecha_creacion else None
            }
        
        # Verificar si ya se generaron PDFs acumulados
        acumulados_generados = db.query(EmisionesAcumuladas).filter(
            EmisionesAcumuladas.proyecto_id == metadata.get('proyecto_id')
        ).filter(
            EmisionesAcumuladas.fecha_emision >= datetime.utcnow() - timedelta(hours=24)
        ).count()
        
        # Determinar estado general
        estado_general = "pendiente"
        if generando > 0:
            estado_general = "generando"
        elif error > 0 and pendientes == 0:
            estado_general = "error"
        elif procesados > 0 and pendientes == 0:
            estado_general = "completado"
        
        return {
            "session_id": session_id,
            "estado": estado_general,
            "progreso": {
                "total": total_final,
                "procesados": procesados,
                "generando": generando,
                "pendientes": pendientes,
                "error": error,
                "porcentaje": round(porcentaje, 2),
                "acumulados_generados": acumulados_generados
            },
            "metadata": metadata,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo estado: {str(e)}")

# ========== ENDPOINT 5: DESCARGAR RESULTADOS (ACTUALIZADO) ==========
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
        registros_pendientes = db.query(EmisionesFinal).filter(
            EmisionesFinal.emision_temp_id.in_(
                db.query(EmisionTemp.id).filter(EmisionTemp.sesion_id == session_id)
            ),
            EmisionesFinal.estado_generacion.in_(['pendiente', 'generando'])
        ).count()
        
        if registros_pendientes > 0:
            raise HTTPException(400, "La generación aún no ha finalizado")
        
        # Buscar archivo ZIP generado
        output_dir = os.path.join(settings.UPLOAD_DIR, "generados", session_id)
        zip_path = os.path.join(output_dir, f"{session_id}.zip")
        
        if not os.path.exists(zip_path):
            # Buscar en directorio de sesiones antiguas
            import glob
            zip_pattern = os.path.join(settings.UPLOAD_DIR, "generados", "*", f"{session_id}.zip")
            old_zips = glob.glob(zip_pattern)
            
            if old_zips:
                zip_path = old_zips[0]
            else:
                # Buscar en directorio raíz de generados
                zip_pattern2 = os.path.join(settings.UPLOAD_DIR, "generados", f"{session_id}.zip")
                if os.path.exists(zip_pattern2):
                    zip_path = zip_pattern2
                else:
                    raise HTTPException(404, "Archivos de resultados no encontrados")
        
        # Verificar que el ZIP no esté vacío
        if os.path.getsize(zip_path) == 0:
            raise HTTPException(404, "El archivo ZIP está vacío")
        
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

# ========== ENDPOINT 6: CANCELAR GENERACIÓN (ACTUALIZADO) ==========
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
        registros_actualizados = db.query(EmisionesFinal).filter(
            EmisionesFinal.emision_temp_id.in_(
                db.query(EmisionTemp.id).filter(EmisionTemp.sesion_id == session_id)
            ),
            EmisionesFinal.estado_generacion.in_(['pendiente', 'generando'])
        ).update({"estado_generacion": "cancelado"})
        
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

# ========== ENDPOINT NUEVO: OBTENER PREVIEW CON CAMPOS DINÁMICOS ==========
@router.get("/preview-campos-dinamicos/{session_id}/{registro_idx}")
async def obtener_preview_campos_dinamicos(
    session_id: str,
    registro_idx: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Obtiene preview de un registro específico con campos dinámicos aplicados
    """
    try:
        # Obtener registro específico
        registros_temp = db.query(EmisionTemp).filter(
            EmisionTemp.sesion_id == session_id
        ).order_by(EmisionTemp.id).offset(registro_idx).limit(1).all()
        
        if not registros_temp:
            raise HTTPException(404, "Registro no encontrado")
        
        registro = registros_temp[0]
        
        # Obtener proyecto y plantilla
        proyecto_id = registro.proyecto_id
        plantilla_id = registro.plantilla_id
        
        # Aplicar campos dinámicos
        dynamic_service = DynamicFieldsService(db)
        datos_con_dinamicos = await dynamic_service.aplicar_campos_dinamicos(
            registro.datos_json or {},
            proyecto_id,
            plantilla_id,
            current_user.id
        )
        
        return {
            "success": True,
            "registro_idx": registro_idx,
            "cuenta": registro.cuenta,
            "datos_completos": datos_con_dinamicos,
            "campos_dinamicos": datos_con_dinamicos.get('campos_dinamicos', {})
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo preview: {str(e)}")

# ========== ENDPOINT NUEVO: OBTENER HISTÓRICO DE CAMPOS DINÁMICOS ==========
@router.get("/historico-campos/{proyecto_id}/{cuenta}")
async def obtener_historico_campos(
    proyecto_id: int,
    cuenta: str,
    tipo: Optional[str] = None,  # 'visita', 'pmo', 'documento'
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Obtiene histórico de campos dinámicos para una cuenta específica
    """
    try:
        query = db.query(HistoricoContadores).filter(
            HistoricoContadores.proyecto_id == proyecto_id,
            HistoricoContadores.cuenta == cuenta
        )
        
        if tipo:
            query = query.filter(HistoricoContadores.tipo == tipo)
        
        historicos = query.order_by(HistoricoContadores.fecha_cambio.desc()).limit(limit).all()
        
        resultados = []
        for historico in historicos:
            resultados.append({
                "tipo": historico.tipo,
                "valor_anterior": historico.valor_anterior,
                "valor_nuevo": historico.valor_nuevo,
                "fecha_cambio": historico.fecha_cambio.isoformat() if historico.fecha_cambio else None,
                "usuario_id": historico.usuario_id,
                "emision_id": historico.emision_id
            })
        
        # También obtener información de emisiones acumuladas
        emisiones = db.query(EmisionesAcumuladas).filter(
            EmisionesAcumuladas.proyecto_id == proyecto_id,
            EmisionesAcumuladas.cuenta == cuenta
        ).order_by(EmisionesAcumuladas.fecha_emision.desc()).limit(5).all()
        
        emisiones_info = []
        for emision in emisiones:
            emisiones_info.append({
                "id": emision.id,
                "plantilla_id": emision.plantilla_id,
                "fecha_emision": emision.fecha_emision.isoformat() if emision.fecha_emision else None,
                "visita_actual": emision.visita_actual,
                "pmo_actual": emision.pmo_actual,
                "tipo_documento": emision.tipo_documento,
                "codebar_generado": emision.codebar_generado
            })
        
        return {
            "success": True,
            "proyecto_id": proyecto_id,
            "cuenta": cuenta,
            "historicos": resultados,
            "ultimas_emisiones": emisiones_info,
            "total_historicos": len(historicos),
            "total_emisiones": len(emisiones_info)
        }
        
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo histórico: {str(e)}")

# ========== ENDPOINT NUEVO: LIMPIAR SESIONES TEMPORALES ==========
@router.post("/limpiar-sesiones-temporales")
async def limpiar_sesiones_temporales(
    horas_antiguedad: int = Query(24, ge=1, le=720),  # Por defecto 24 horas
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """
    Limpia sesiones temporales antiguas
    """
    try:
        fecha_limite = datetime.utcnow() - timedelta(hours=horas_antiguedad)
        
        # Contar registros a eliminar
        sesiones_a_limpiar = db.query(EmisionTemp.sesion_id).filter(
            EmisionTemp.fecha_carga < fecha_limite
        ).distinct().count()
        
        # Eliminar registros antiguos
        registros_eliminados = db.query(EmisionTemp).filter(
            EmisionTemp.fecha_carga < fecha_limite
        ).delete(synchronize_session=False)
        
        db.commit()
        
        log_auditoria(
            db=db,
            usuario_id=current_user.id,
            accion="limpiar_sesiones_temporales",
            modulo="procesamiento",
            detalles={
                "horas_antiguedad": horas_antiguedad,
                "fecha_limite": fecha_limite.isoformat(),
                "sesiones_afectadas": sesiones_a_limpiar,
                "registros_eliminados": registros_eliminados
            }
        )
        
        return {
            "success": True,
            "message": f"Se eliminaron {registros_eliminados} registros temporales con más de {horas_antiguedad} horas de antigüedad",
            "sesiones_afectadas": sesiones_a_limpiar,
            "registros_eliminados": registros_eliminados
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Error limpiando sesiones temporales: {str(e)}")