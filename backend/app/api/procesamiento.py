# backend/app/api/procesamiento.py - CONTENIDO COMPLETO
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import os
from pathlib import Path
from typing import Dict, Any
from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import Usuario, Plantilla, Proyecto, EmisionTemp
from app.schemas import (
    CSVUploadRequest, PDFPreviewRequest, PDFGenerateRequest,
    SuccessResponse, ErrorResponse
)
from app.utils.file_utils import guardar_archivo, eliminar_archivo, validar_archivo_pdf
from app.core.pdf_converter import PDFConverter
from app.core.csv_service import CSVService
from app.config import settings

router = APIRouter(prefix="/procesamiento", tags=["Procesamiento"])

# ========== ENDPOINT 1: CONVERTIR PDF A IMAGEN ==========
@router.post("/convertir-pdf")
async def convertir_pdf_a_imagen(
    file: UploadFile = File(...),
    pagina: int = 1,
    escala: float = 1.5,
    formato: str = "PNG",
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Convierte una página de PDF a imagen para el editor visual
    
    Args:
        file: Archivo PDF
        pagina: Número de página (comienza en 1)
        escala: Factor de zoom (1.0 = 72 DPI, 2.0 = 144 DPI)
        formato: Formato de imagen (PNG, JPEG)
    
    Returns:
        URL de la imagen generada y metadatos
    """
    try:
        # 1. Validar archivo
        if not file.filename:
            raise HTTPException(400, "Nombre de archivo requerido")
        
        es_valido, mensaje = validar_archivo_pdf(file)
        if not es_valido:
            raise HTTPException(400, mensaje)
        
        # 2. Guardar temporalmente
        temp_dir = os.path.join(settings.UPLOAD_DIR, "temp")
        os.makedirs(temp_dir, exist_ok=True)
        
        temp_path = os.path.join(temp_dir, f"temp_{current_user.id}_{Path(file.filename).name}")
        
        with open(temp_path, "wb") as buffer:
            contenido = await file.read()
            buffer.write(contenido)
        
        # 3. Convertir a imagen
        img_path, error = PDFConverter.pdf_a_imagen(temp_path, pagina, escala, formato)
        
        if error:
            eliminar_archivo(temp_path)
            raise HTTPException(500, error)
        
        # 4. Obtener metadatos
        metadata = PDFConverter.obtener_metadatos_pdf(temp_path)
        
        # 5. Crear URL relativa
        img_filename = os.path.basename(img_path)
        img_url = f"/uploads/previews/{img_filename}"
        
        # 6. Limpiar archivo temporal
        eliminar_archivo(temp_path)
        
        return {
            "success": True,
            "imagen_url": img_url,
            "pagina_actual": pagina,
            "total_paginas": metadata.get("paginas", 1),
            "dimensiones": {
                "ancho_px": metadata.get("ancho", 0) * escala,
                "alto_px": metadata.get("alto", 0) * escala,
                "ancho_mm": metadata.get("ancho_mm", 210),
                "alto_mm": metadata.get("alto_mm", 297)
            },
            "formato": formato
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error procesando PDF: {str(e)}")

# ========== ENDPOINT 2: CARGAR CSV (placeholder) ==========
@router.post("/cargar-csv")
async def cargar_csv(
    request: CSVUploadRequest,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """Carga y procesa archivo CSV (placeholder)"""
    return {
        "success": False,
        "message": "Endpoint en desarrollo",
        "session_id": "temp_123"
    }

# ========== ENDPOINT 3: PREVIEW PDF (placeholder) ==========
@router.post("/preview-pdf")
async def preview_pdf(
    request: PDFPreviewRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Genera preview de PDF con datos (placeholder)"""
    return {
        "success": False,
        "message": "Endpoint en desarrollo",
        "preview_url": "/uploads/previews/placeholder.png"
    }