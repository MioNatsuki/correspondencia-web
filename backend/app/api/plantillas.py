# backend/app/api/plantillas.py - CONTENIDO COMPLETO
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from pathlib import Path
from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import Usuario, Plantilla, Proyecto, CampoPlantilla
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