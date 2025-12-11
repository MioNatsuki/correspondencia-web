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