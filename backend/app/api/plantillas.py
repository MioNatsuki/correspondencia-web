# backend/app/api/plantillas.py - CONTENIDO COMPLETO
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from pathlib import Path
from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import Usuario, Plantilla, Proyecto, CampoPlantilla, IdentificadorPadrones
from app.schemas import (
    PlantillaCreate, PlantillaUpdate, PlantillaResponse,
    Campo, CampoTexto, CampoDinamico, CampoCompuesto, CampoTabla,
    SuccessResponse, ErrorResponse
)
from app.utils.file_utils import guardar_archivo, eliminar_archivo, validar_archivo_pdf
from app.core.pdf_converter import PDFConverter
from app.config import settings
from typing import Dict, Any
import datetime
from fastapi.responses import FileResponse

router = APIRouter(prefix="/plantillas", tags=["Plantillas"])

# ========== LISTAR PLANTILLAS ==========
@router.get("/", response_model=List[PlantillaResponse])
async def listar_plantillas(
    proyecto_id: Optional[int] = None,
    activas: bool = True,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Lista plantillas, filtradas por proyecto si se especifica
    """
    try:
        query = db.query(Plantilla).filter(Plantilla.is_deleted == False)
        
        if proyecto_id:
            # Verificar acceso al proyecto
            proyecto = db.query(Proyecto).filter(
                Proyecto.id == proyecto_id,
                Proyecto.is_deleted == False
            ).first()
            
            if not proyecto:
                raise HTTPException(404, "Proyecto no encontrado")
            
            if current_user.rol == "lector":
                proyectos_permitidos = current_user.proyecto_permitido or ""
                ids_permitidos = [int(pid.strip()) for pid in proyectos_permitidos.split(",") if pid.strip().isdigit()]
                if proyecto.id not in ids_permitidos:
                    raise HTTPException(
                        status_code=403,
                        detail="No tienes permiso para acceder a este proyecto"
                    )
            query = query.filter(Plantilla.proyecto_id == proyecto_id)
        
        if activas:
            query = query.filter(Plantilla.activa == True)
        
        plantillas = query.offset(skip).limit(limit).all()
        return plantillas
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error listando plantillas: {str(e)}")

# ========== OBTENER PLANTILLA ==========
@router.get("/{plantilla_id}", response_model=PlantillaResponse)
async def obtener_plantilla(
    plantilla_id: int,
    incluir_campos: bool = True,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Obtiene una plantilla específica con sus campos
    """
    try:
        plantilla = db.query(Plantilla).filter(
            Plantilla.id == plantilla_id,
            Plantilla.is_deleted == False
        ).first()
        
        if not plantilla:
            raise HTTPException(404, "Plantilla no encontrada")
        if current_user.rol == "lector":
            proyectos_permitidos = current_user.proyecto_permitido or ""
            ids_permitidos = [int(pid.strip()) for pid in proyectos_permitidos.split(",") if pid.strip().isdigit()]
            if proyecto.id not in ids_permitidos:
                raise HTTPException(
                    status_code=403,
                    detail="No tienes permiso para acceder a este proyecto"
                )
        # Verificar acceso al proyecto
        proyecto = db.query(Proyecto).filter(
            Proyecto.id == plantilla.proyecto_id,
            Proyecto.is_deleted == False
        ).first()
        
        if not proyecto:
            raise HTTPException(404, "Proyecto de la plantilla no encontrado")
        
        # Cargar campos si se solicita
        if incluir_campos:
            campos = db.query(CampoPlantilla).filter(
                CampoPlantilla.plantilla_id == plantilla_id,
                CampoPlantilla.activo == True
            ).order_by(CampoPlantilla.orden).all()
            
            plantilla.campos = campos
        
        return plantilla
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo plantilla: {str(e)}")

# ========== CREAR PLANTILLA ==========
@router.post("/", response_model=PlantillaResponse)
async def crear_plantilla(
    nombre: str = Query(...),
    descripcion: Optional[str] = None,
    proyecto_id: int = Query(...),
    pdf_base: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """
    Crea una nueva plantilla subiendo un PDF base
    """
    try:
        # 1. Verificar proyecto
        proyecto = db.query(Proyecto).filter(
            Proyecto.id == proyecto_id,
            Proyecto.is_deleted == False
        ).first()
        
        if not proyecto:
            raise HTTPException(404, "Proyecto no encontrado")
        
        # 2. Validar PDF
        es_valido, mensaje = validar_archivo_pdf(pdf_base)
        if not es_valido:
            raise HTTPException(400, mensaje)
        
        # 3. Guardar PDF
        pdf_path = guardar_archivo(pdf_base, "pdfs")
        
        # 4. Crear plantilla
        plantilla = Plantilla(
            nombre=nombre.strip(),
            descripcion=descripcion.strip() if descripcion else None,
            proyecto_id=proyecto_id,
            pdf_base=pdf_path,
            usuario_creador_id=current_user.id,
            activa=True,
            config_json={"paginas": 1, "dimensiones": "A4"}
        )
        
        db.add(plantilla)
        db.commit()
        db.refresh(plantilla)
        
        # 5. Generar preview de la primera página
        preview_path, error = PDFConverter.pdf_a_imagen(pdf_path, 1, 1.0)
        
        if not error:
            plantilla.config_json["preview_url"] = f"/uploads/previews/{os.path.basename(preview_path)}"
            db.commit()
        
        return plantilla
        
    except HTTPException:
        raise
    except Exception as e:
        # Limpiar archivos si hubo error
        if 'pdf_path' in locals() and os.path.exists(pdf_path):
            eliminar_archivo(pdf_path)
        db.rollback()
        raise HTTPException(500, f"Error creando plantilla: {str(e)}")

# ========== ACTUALIZAR PLANTILLA ==========
@router.put("/{plantilla_id}", response_model=PlantillaResponse)
async def actualizar_plantilla(
    plantilla_id: int,
    datos: PlantillaUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """
    Actualiza una plantilla existente
    """
    try:
        plantilla = db.query(Plantilla).filter(
            Plantilla.id == plantilla_id,
            Plantilla.is_deleted == False
        ).first()
        
        if not plantilla:
            raise HTTPException(404, "Plantilla no encontrada")
        
        # Actualizar campos
        update_data = datos.dict(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None and hasattr(plantilla, field):
                setattr(plantilla, field, value)
        
        db.commit()
        db.refresh(plantilla)
        
        return plantilla
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Error actualizando plantilla: {str(e)}")

# ========== ELIMINAR PLANTILLA ==========
@router.delete("/{plantilla_id}")
async def eliminar_plantilla(
    plantilla_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """
    Elimina (soft delete) una plantilla
    """
    try:
        plantilla = db.query(Plantilla).filter(
            Plantilla.id == plantilla_id,
            Plantilla.is_deleted == False
        ).first()
        
        if not plantilla:
            raise HTTPException(404, "Plantilla no encontrada")
        
        # Soft delete
        plantilla.is_deleted = True
        db.commit()
        
        return SuccessResponse(message="Plantilla eliminada exitosamente")
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Error eliminando plantilla: {str(e)}")

# ========== OBTENER CAMPOS ==========
@router.get("/{plantilla_id}/campos")
async def obtener_campos_plantilla(
    plantilla_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Obtiene todos los campos de una plantilla
    """
    try:
        campos = db.query(CampoPlantilla).filter(
            CampoPlantilla.plantilla_id == plantilla_id,
            CampoPlantilla.activo == True
        ).order_by(CampoPlantilla.orden).all()
        
        return campos
        
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo campos: {str(e)}")

# ========== ACTUALIZAR CAMPOS ==========
@router.put("/{plantilla_id}/campos")
async def actualizar_campos_plantilla(
    plantilla_id: int,
    campos: List[Campo],
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """
    Actualiza todos los campos de una plantilla (reemplazo completo)
    """
    try:
        # Verificar plantilla
        plantilla = db.query(Plantilla).filter(
            Plantilla.id == plantilla_id,
            Plantilla.is_deleted == False
        ).first()
        
        if not plantilla:
            raise HTTPException(404, "Plantilla no encontrada")
        
        # Eliminar campos existentes
        db.query(CampoPlantilla).filter(
            CampoPlantilla.plantilla_id == plantilla_id
        ).delete()
        
        # Crear nuevos campos
        for idx, campo_data in enumerate(campos):
            # Convertir schema a dict para guardar
            if isinstance(campo_data, CampoTexto):
                tipo = "texto"
                texto_fijo = campo_data.contenido
                columna_padron = None
            elif isinstance(campo_data, CampoDinamico):
                tipo = "campo"
                texto_fijo = None
                columna_padron = campo_data.columna
            elif isinstance(campo_data, CampoCompuesto):
                tipo = "compuesto"
                texto_fijo = None
                columna_padron = None
            else:  # CampoTabla
                tipo = "tabla"
                texto_fijo = None
                columna_padron = None
            
            campo = CampoPlantilla(
                plantilla_id=plantilla_id,
                nombre=campo_data.nombre,
                tipo=tipo,
                x=campo_data.x,
                y=campo_data.y,
                ancho=campo_data.ancho,
                alto=campo_data.alto,
                alineacion=campo_data.estilo.alineacion,
                fuente=campo_data.estilo.fuente,
                tamano_fuente=campo_data.estilo.tamano,
                color=campo_data.estilo.color,
                negrita=campo_data.estilo.negrita,
                cursiva=campo_data.estilo.cursiva,
                texto_fijo=texto_fijo,
                columna_padron=columna_padron,
                componentes_json=campo_data.componentes if hasattr(campo_data, 'componentes') else [],
                tabla_config_json=campo_data.tabla_config if hasattr(campo_data, 'tabla_config') else {},
                orden=idx,
                activo=True
            )
            
            db.add(campo)
        
        db.commit()
        
        return SuccessResponse(message=f"{len(campos)} campos actualizados")
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Error actualizando campos: {str(e)}")

# ========== PREVIEW PLANTILLA ==========
@router.post("/{plantilla_id}/preview")
async def preview_plantilla(
    plantilla_id: int,
    datos_ejemplo: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Genera preview de una plantilla con datos de ejemplo
    """
    try:
        # Obtener plantilla con campos
        plantilla = db.query(Plantilla).filter(
            Plantilla.id == plantilla_id,
            Plantilla.is_deleted == False
        ).first()
        
        if not plantilla:
            raise HTTPException(404, "Plantilla no encontrada")
        
        # Si no se proporcionan datos, usar datos dummy
        if not datos_ejemplo:
            # Obtener columnas del padrón del proyecto
            proyecto = db.query(Proyecto).filter(
                Proyecto.id == plantilla.proyecto_id
            ).first()
            
            if proyecto and proyecto.tabla_padron:
                from app.api.padrones import obtener_datos_ejemplo
                
                try:
                    datos_padron = await obtener_datos_ejemplo(
                        proyecto.tabla_padron, 
                        1,  # limit
                        db, 
                        current_user
                    )
                    
                    if datos_padron and len(datos_padron) > 0:
                        datos_ejemplo = datos_padron[0].datas if hasattr(datos_padron[0], 'datas') else {}
                except:
                    pass
            
            # Si aún no hay datos, usar dummy
            if not datos_ejemplo:
                datos_ejemplo = {
                    "nombre": "JUAN PÉREZ GONZÁLEZ",
                    "cuenta": "100001",
                    "codigo_afiliado": "AF001",
                    "direccion": "AV. PRINCIPAL 123, COL. CENTRO",
                    "telefono": "555-123-4567",
                    "monto": "2,500.00",
                    "fecha": datetime.now().strftime("%d/%m/%Y")
                }
        
        # Construir definición de plantilla para PDFGenerator
        # Obtener campos de la plantilla
        campos = db.query(CampoPlantilla).filter(
            CampoPlantilla.plantilla_id == plantilla_id,
            CampoPlantilla.activo == True
        ).order_by(CampoPlantilla.orden).all()
        
        # Convertir campos a formato para PDFGenerator
        elementos = []
        for campo in campos:
            elemento = {
                "id": campo.id,
                "nombre": campo.nombre,
                "tipo": campo.tipo,
                "x": float(campo.x),
                "y": float(campo.y),
                "ancho": float(campo.ancho),
                "alto": float(campo.alto),
                "alineacion": campo.alineacion,
                "fuente": campo.fuente,
                "tamano_fuente": campo.tamano_fuente,
                "color": campo.color,
                "negrita": campo.negrita,
                "cursiva": campo.cursiva,
                "activo": campo.activo
            }
            
            if campo.tipo == "texto":
                elemento["texto_fijo"] = campo.texto_fijo
            elif campo.tipo == "campo":
                elemento["columna_padron"] = campo.columna_padron
            elif campo.tipo == "compuesto":
                elemento["componentes_json"] = campo.componentes_json
            elif campo.tipo == "tabla":
                elemento["tabla_config_json"] = campo.tabla_config_json
            
            elementos.append(elemento)
        
        plantilla_def = {
            "pdf_base": plantilla.pdf_base if plantilla.pdf_base and os.path.exists(plantilla.pdf_base) else None,
            "elementos": elementos
        }
        
        # Generar PDF temporal
        from app.core.pdf_service import pdf_generator
        
        success, message, pdf_path = pdf_generator.generar_pdf_individual(
            plantilla_def, datos_ejemplo
        )
        
        if not success:
            raise HTTPException(500, f"Error generando preview: {message}")
        
        # Convertir primera página a imagen
        img_path, error = PDFConverter.pdf_a_imagen(pdf_path, 1, 1.5, "PNG")
        
        if error:
            # Si no se puede convertir, devolver el PDF
            return FileResponse(
                pdf_path,
                media_type="application/pdf",
                filename=f"preview_{plantilla_id}.pdf"
            )
        
        # Preparar respuesta
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
            "datos_usados": datos_ejemplo,
            "plantilla_id": plantilla_id,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error generando preview: {str(e)}")

@router.post("/{plantilla_id}/upload-pdf")
async def upload_pdf_plantilla(
    plantilla_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """Sube o reemplaza el PDF base de una plantilla"""
    try:
        plantilla = db.query(Plantilla).filter(
            Plantilla.id == plantilla_id,
            Plantilla.is_deleted == False
        ).first()
        
        if not plantilla:
            raise HTTPException(404, "Plantilla no encontrada")
        
        # Validar PDF
        es_valido, mensaje = validar_archivo_pdf(file)
        if not es_valido:
            raise HTTPException(400, mensaje)
        
        # Eliminar PDF anterior si existe
        if plantilla.pdf_base and os.path.exists(plantilla.pdf_base):
            eliminar_archivo(plantilla.pdf_base)
        
        # Guardar nuevo PDF
        pdf_path = guardar_archivo(file, "pdfs")
        
        # Actualizar plantilla
        plantilla.pdf_base = pdf_path
        
        # Obtener metadatos del PDF
        metadata = PDFConverter.obtener_metadatos_pdf(pdf_path)
        plantilla.config_json = {
            **plantilla.config_json,
            "paginas": metadata.get("paginas", 1),
            "dimensiones": {
                "ancho_mm": metadata.get("ancho_mm"),
                "alto_mm": metadata.get("alto_mm")
            },
            "tamano_pagina": "personalizado"
        }
        
        db.commit()
        
        # Generar preview
        preview_path, error = PDFConverter.pdf_a_imagen(pdf_path, 1, 0.5)
        preview_url = None
        if not error:
            preview_filename = os.path.basename(preview_path)
            preview_url = f"/uploads/previews/{preview_filename}"
        
        return {
            "success": True,
            "message": "PDF actualizado exitosamente",
            "pdf_path": pdf_path,
            "preview_url": preview_url,
            "metadata": metadata
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Error actualizando PDF: {str(e)}")

@router.get("/{plantilla_id}/columnas-disponibles")
async def obtener_columnas_disponibles(
    plantilla_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene las columnas disponibles del padrón para insertar campos"""
    try:
        plantilla = db.query(Plantilla).filter(
            Plantilla.id == plantilla_id,
            Plantilla.is_deleted == False
        ).first()
        
        if not plantilla:
            raise HTTPException(404, "Plantilla no encontrada")
        
        # Obtener proyecto
        proyecto = db.query(Proyecto).filter(
            Proyecto.id == plantilla.proyecto_id,
            Proyecto.is_deleted == False
        ).first()
        
        if not proyecto:
            raise HTTPException(404, "Proyecto no encontrado")
        
        if not proyecto.tabla_padron:
            return {"columnas": [], "mensaje": "El proyecto no tiene padrón asignado"}
        
        # Obtener el nombre de la tabla del padrón
        padron = db.query(IdentificadorPadrones).filter(
            IdentificadorPadrones.uuid_padron == proyecto.tabla_padron
        ).first()
        
        if not padron:
            return {"columnas": [], "mensaje": "Padrón no encontrado"}
        
        # Obtener columnas de la tabla
        from sqlalchemy import text
        query = text("""
            SELECT 
                column_name as nombre,
                data_type as tipo,
                is_nullable as nullable
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = :nombre_tabla
            ORDER BY ordinal_position
        """)
        
        result = db.execute(query, {"nombre_tabla": padron.nombre_tabla})
        columnas = []
        
        for row in result:
            columnas.append({
                "nombre": row.nombre,
                "tipo": row.tipo,
                "nullable": row.nullable == 'YES',
                "etiqueta": row.nombre.replace('_', ' ').title()
            })
        
        return {
            "columnas": columnas,
            "total": len(columnas),
            "nombre_tabla": padron.nombre_tabla,
            "uuid_padron": proyecto.tabla_padron
        }
        
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo columnas: {str(e)}")

@router.post("/{plantilla_id}/datos-ejemplo")
async def obtener_datos_ejemplo(
    plantilla_id: int,
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene datos de ejemplo del padrón para vista previa"""
    try:
        plantilla = db.query(Plantilla).filter(
            Plantilla.id == plantilla_id,
            Plantilla.is_deleted == False
        ).first()
        
        if not plantilla:
            raise HTTPException(404, "Plantilla no encontrada")
        
        # Obtener proyecto
        proyecto = db.query(Proyecto).filter(
            Proyecto.id == plantilla.proyecto_id,
            Proyecto.is_deleted == False
        ).first()
        
        if not proyecto:
            raise HTTPException(404, "Proyecto no encontrado")
        
        if not proyecto.tabla_padron:
            return {"datos": [], "mensaje": "El proyecto no tiene padrón asignado"}
        
        # Obtener el nombre de la tabla del padrón
        padron = db.query(IdentificadorPadrones).filter(
            IdentificadorPadrones.uuid_padron == proyecto.tabla_padron
        ).first()
        
        if not padron:
            return {"datos": [], "mensaje": "Padrón no encontrado"}
        
        # Obtener algunos registros de ejemplo
        from sqlalchemy import text
        query = text(f"SELECT * FROM {padron.nombre_tabla} LIMIT :limit")
        
        result = db.execute(query, {"limit": limit})
        datos = []
        
        for row in result:
            datos.append(dict(row._mapping))
        
        return {
            "datos": datos,
            "total": len(datos),
            "nombre_tabla": padron.nombre_tabla
        }
        
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo datos de ejemplo: {str(e)}")
    
@router.get("/{plantilla_id}/campos-disponibles")
async def obtener_campos_disponibles(
    plantilla_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene las columnas disponibles del padrón para una plantilla"""
    try:
        # Obtener plantilla
        plantilla = db.query(Plantilla).filter(
            Plantilla.id == plantilla_id,
            Plantilla.is_deleted == False
        ).first()
        
        if not plantilla:
            raise HTTPException(404, "Plantilla no encontrada")
        
        # Obtener proyecto
        proyecto = db.query(Proyecto).filter(
            Proyecto.id == plantilla.proyecto_id
        ).first()
        
        if not proyecto:
            raise HTTPException(404, "Proyecto no encontrado")
        
        # Si no tiene padrón asignado
        if not proyecto.tabla_padron:
            return {
                "columnas": [],
                "nombre_tabla": None,
                "mensaje": "El proyecto no tiene padrón asignado"
            }
        
        # Obtener nombre de tabla del padrón
        padron = db.query(IdentificadorPadrones).filter(
            IdentificadorPadrones.uuid_padron == proyecto.tabla_padron
        ).first()
        
        if not padron:
            return {
                "columnas": [],
                "nombre_tabla": None,
                "mensaje": "Padrón no encontrado"
            }
        
        # Obtener columnas de la tabla
        from sqlalchemy import text, inspect
        from sqlalchemy.engine import reflection
        
        inspector = inspect(db.bind)
        columnas_info = inspector.get_columns(padron.nombre_tabla)
        
        columnas = []
        for col in columnas_info:
            # Determinar tipo amigable
            tipo = str(col['type']).lower()
            tipo_amigable = "texto"
            if 'int' in tipo or 'numeric' in tipo or 'decimal' in tipo:
                tipo_amigable = "número"
            elif 'date' in tipo or 'time' in tipo:
                tipo_amigable = "fecha"
            elif 'bool' in tipo:
                tipo_amigable = "booleano"
            
            columnas.append({
                "nombre": col['name'],
                "tipo": tipo,
                "tipo_amigable": tipo_amigable,
                "nullable": col.get('nullable', True),
                "etiqueta": col['name'].replace('_', ' ').title()
            })
        
        return {
            "columnas": columnas,
            "total": len(columnas),
            "nombre_tabla": padron.nombre_tabla,
            "uuid_padron": proyecto.tabla_padron
        }
        
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo columnas: {str(e)}")