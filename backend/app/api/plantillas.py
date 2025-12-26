# backend/app/api/plantillas.py - VERSIÓN CORREGIDA Y SIMPLIFICADA
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from pathlib import Path
from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import Usuario, Plantilla, Proyecto, CampoPlantilla, IdentificadorPadrones
from app.schemas import (
    PlantillaCreate, PlantillaUpdate, PlantillaResponse,
    CampoTexto, CampoDinamico, CampoCompuesto, CampoTabla,
    SuccessResponse
)
from app.utils.file_utils import guardar_archivo, eliminar_archivo, validar_archivo_pdf
from app.core.pdf_converter import PDFConverter
from app.config import settings
from typing import Dict, Any
from datetime import datetime
import fitz

router = APIRouter(prefix="/plantillas", tags=["Plantillas"])

# ========== HELPERS ==========
def verificar_acceso_proyecto(usuario: Usuario, proyecto_id: int, db: Session):
    """Verifica si el usuario tiene acceso al proyecto"""
    proyecto = db.query(Proyecto).filter(
        Proyecto.id == proyecto_id,
        Proyecto.is_deleted == False
    ).first()
    
    if not proyecto:
        raise HTTPException(404, "Proyecto no encontrado")
    
    if usuario.rol == "lector":
        proyectos_permitidos = usuario.proyecto_permitido or ""
        ids_permitidos = [int(pid.strip()) for pid in proyectos_permitidos.split(",") if pid.strip().isdigit()]
        if proyecto.id not in ids_permitidos:
            raise HTTPException(
                status_code=403,
                detail="No tienes permiso para acceder a este proyecto"
            )
    
    return proyecto

def normalizar_ruta_pdf(ruta: str) -> str:
    """Normaliza la ruta del PDF para el frontend"""
    if not ruta:
        return None
    
    # Convertir rutas Windows a Unix
    ruta_normalizada = ruta.replace('\\', '/')
    
    # Extraer nombre del archivo
    nombre_archivo = os.path.basename(ruta_normalizada)
    
    # Determinar si es pdf o preview
    if nombre_archivo.endswith('.pdf'):
        return f"/uploads/pdfs/{nombre_archivo}"
    elif nombre_archivo.endswith('.png'):
        return f"/uploads/previews/{nombre_archivo}"
    
    return ruta_normalizada

# ========== ENDPOINTS PRINCIPALES ==========

@router.get("/", response_model=List[PlantillaResponse])
async def listar_plantillas(
    proyecto_id: Optional[int] = None,
    activas: bool = True,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista plantillas, filtradas por proyecto si se especifica"""
    try:
        query = db.query(Plantilla).filter(Plantilla.is_deleted == False)
        
        if proyecto_id:
            verificar_acceso_proyecto(current_user, proyecto_id, db)
            query = query.filter(Plantilla.proyecto_id == proyecto_id)
        
        if activas:
            query = query.filter(Plantilla.activa == True)
        
        plantillas = query.offset(skip).limit(limit).all()
        return plantillas
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error listando plantillas: {str(e)}")

@router.get("/{plantilla_id}", response_model=PlantillaResponse)
async def obtener_plantilla(
    plantilla_id: int,
    incluir_campos: bool = True,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene una plantilla específica con sus campos"""
    try:
        plantilla = db.query(Plantilla).filter(
            Plantilla.id == plantilla_id,
            Plantilla.is_deleted == False
        ).first()
        
        if not plantilla:
            raise HTTPException(404, "Plantilla no encontrada")
        
        # Verificar acceso al proyecto
        verificar_acceso_proyecto(current_user, plantilla.proyecto_id, db)
        
        # Cargar campos si se solicita
        if incluir_campos:
            campos = db.query(CampoPlantilla).filter(
                CampoPlantilla.plantilla_id == plantilla_id,
                CampoPlantilla.activo == True
            ).order_by(CampoPlantilla.orden).all()
            
            plantilla.campos = campos
        
        # Normalizar rutas para el frontend
        if plantilla.ruta_archivo:
            plantilla.pdf_base = normalizar_ruta_pdf(plantilla.ruta_archivo)
        
        return plantilla
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo plantilla: {str(e)}")

@router.post("/")
async def crear_plantilla(
    nombre: str = Form(...),
    descripcion: Optional[str] = Form(None),
    proyecto_id: int = Form(...),
    pdf_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """
    Crea una nueva plantilla INACTIVA por defecto.
    Se activará cuando el usuario guarde los campos en el editor.
    """
    try:
        print(f"Creando plantilla INACTIVA: {nombre} para proyecto {proyecto_id}")
        
        # 1. Verificar proyecto
        proyecto = verificar_acceso_proyecto(current_user, proyecto_id, db)
        
        # 2. Validar PDF
        es_valido, mensaje = validar_archivo_pdf(pdf_file)
        if not es_valido:
            raise HTTPException(400, mensaje)
        
        # 3. Guardar PDF
        pdf_path = guardar_archivo(pdf_file, "pdfs")
        print(f"PDF guardado en: {pdf_path}")
        
        # 4. Crear plantilla INACTIVA
        plantilla = Plantilla(
            nombre=nombre.strip(),
            descripcion=descripcion.strip() if descripcion else None,
            proyecto_id=proyecto_id,
            ruta_archivo=pdf_path,
            usuario_creador=current_user.id,
            activa=False,  # ← IMPORTANTE: INACTIVA por defecto
            campos_json={
                "version": "1.0",
                "creado_por": current_user.nombre,
                "fecha_creacion": datetime.now().isoformat(),
                "estado": "borrador"
            }
        )
        
        db.add(plantilla)
        db.commit()
        db.refresh(plantilla)
        
        print(f"Plantilla INACTIVA creada con ID: {plantilla.id}")
        
        # 5. Generar preview
        preview_url = None
        try:
            preview_path, error = PDFConverter.pdf_a_imagen(pdf_path, 1, 0.5)
            if not error:
                preview_filename = os.path.basename(preview_path)
                preview_url = f"/uploads/previews/{preview_filename}"
                print(f"Preview generado: {preview_path}")
        except Exception as preview_error:
            print(f"Error generando preview: {preview_error}")
        
        return {
            "id": plantilla.id,
            "nombre": plantilla.nombre,
            "descripcion": plantilla.descripcion,
            "ruta_archivo": normalizar_ruta_pdf(plantilla.ruta_archivo),
            "preview_url": preview_url,
            "proyecto_id": plantilla.proyecto_id,
            "activa": plantilla.activa,
            "message": "Plantilla creada (inactiva). Edítala y guárdala para activarla."
        }
        
    except HTTPException as he:
        print(f"HTTPException en crear_plantilla: {he.detail}")
        raise
    except Exception as e:
        print(f"Error crítico en crear_plantilla: {str(e)}")
        import traceback
        traceback.print_exc()
        # Limpiar archivos si hubo error
        if 'pdf_path' in locals() and os.path.exists(pdf_path):
            try:
                eliminar_archivo(pdf_path)
                print(f"PDF eliminado tras error: {pdf_path}")
            except:
                pass
        if 'db' in locals():
            db.rollback()
        raise HTTPException(500, f"Error creando plantilla: {str(e)}")

@router.put("/{plantilla_id}", response_model=PlantillaResponse)
async def actualizar_plantilla(
    plantilla_id: int,
    datos: PlantillaUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """Actualiza una plantilla existente"""
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
        
        # Normalizar rutas
        if plantilla.ruta_archivo:
            plantilla.pdf_base = normalizar_ruta_pdf(plantilla.ruta_archivo)
        
        return plantilla
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Error actualizando plantilla: {str(e)}")

@router.delete("/{plantilla_id}")
async def eliminar_plantilla(
    plantilla_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """Elimina (soft delete) una plantilla"""
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

# ========== ENDPOINTS PARA EDITOR ==========

@router.get("/{plantilla_id}/campos")
async def obtener_campos_plantilla(
    plantilla_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene todos los campos de una plantilla"""
    try:
        campos = db.query(CampoPlantilla).filter(
            CampoPlantilla.plantilla_id == plantilla_id,
            CampoPlantilla.activo == True
        ).order_by(CampoPlantilla.orden).all()
        
        return campos
        
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo campos: {str(e)}")

@router.post("/{plantilla_id}/guardar-campos")
async def guardar_campos_plantilla(
    plantilla_id: int,
    campos: List[dict],
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """Guarda los campos de una plantilla y la ACTIVA"""
    try:
        # Verificar plantilla
        plantilla = db.query(Plantilla).filter(
            Plantilla.id == plantilla_id,
            Plantilla.is_deleted == False
        ).first()
        
        if not plantilla:
            raise HTTPException(404, "Plantilla no encontrada")
        
        # Eliminar campos existentes (soft delete)
        existing_campos = db.query(CampoPlantilla).filter(
            CampoPlantilla.plantilla_id == plantilla_id
        ).all()
        
        for campo in existing_campos:
            campo.activo = False
        
        # Crear nuevos campos
        for idx, campo_data in enumerate(campos):
            campo = CampoPlantilla(
                plantilla_id=plantilla_id,
                nombre=campo_data.get('nombre', f'Campo {idx + 1}'),
                tipo=campo_data.get('tipo', 'texto'),
                x=campo_data.get('x', 0),
                y=campo_data.get('y', 0),
                ancho=campo_data.get('ancho', 100),
                alto=campo_data.get('alto', 40),
                alineacion=campo_data.get('alineacion', 'left'),
                fuente=campo_data.get('fuente', 'Arial'),
                tamano_fuente=campo_data.get('tamano_fuente', 12),
                color=campo_data.get('color', '#000000'),
                negrita=campo_data.get('negrita', False),
                cursiva=campo_data.get('cursiva', False),
                texto_fijo=campo_data.get('texto_fijo'),
                columna_padron=campo_data.get('columna_padron'),
                componentes_json=campo_data.get('componentes_json'),
                tabla_config_json=campo_data.get('tabla_config_json'),
                orden=idx,
                activo=True
            )
            db.add(campo)
        
        # ACTIVAR la plantilla ahora que se han guardado los campos
        plantilla.activa = True
        plantilla.campos_json = {
            **plantilla.campos_json,
            "ultima_actualizacion": datetime.now().isoformat(),
            "total_campos": len(campos),
            "estado": "completada"
        }
        
        db.commit()
        
        return {
            "success": True,
            "message": f"{len(campos)} campos guardados y plantilla activada",
            "plantilla_id": plantilla_id,
            "activa": True
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Error guardando campos: {str(e)}")

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
        
        # Obtener columnas de la tabla usando inspect
        from sqlalchemy import inspect
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

@router.get("/{plantilla_id}/datos-ejemplo")
async def obtener_datos_ejemplo(
    plantilla_id: int,
    limit: int = Query(5, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene datos REALES del padrón para vista previa"""
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
            return {
                "datos": [],
                "mensaje": "El proyecto no tiene padrón asignado",
                "success": False
            }
        
        # Obtener el nombre de la tabla del padrón
        padron = db.query(IdentificadorPadrones).filter(
            IdentificadorPadrones.uuid_padron == proyecto.tabla_padron
        ).first()
        
        if not padron:
            return {
                "datos": [],
                "mensaje": "Padrón no encontrado",
                "success": False
            }
        
        # Obtener registros REALES del padrón
        try:
            from sqlalchemy import text
            
            # Primero obtener columnas para construir SELECT
            from sqlalchemy import inspect
            inspector = inspect(db.bind)
            columns = inspector.get_columns(padron.nombre_tabla)
            column_names = [col['name'] for col in columns]
            
            if not column_names:
                return {
                    "datos": [],
                    "mensaje": "El padrón no tiene columnas",
                    "success": False
                }
            
            # Construir query dinámica
            columns_str = ', '.join([f'"{col}"' for col in column_names])
            query = text(f'SELECT {columns_str} FROM "{padron.nombre_tabla}" LIMIT :limit')
            
            result = db.execute(query, {"limit": limit})
            datos = []
            
            for row in result:
                row_dict = {}
                for i, col in enumerate(column_names):
                    value = row[i]
                    # Convertir valores None a string vacío
                    row_dict[col] = '' if value is None else str(value)
                datos.append(row_dict)
            
            return {
                "datos": datos,
                "total": len(datos),
                "nombre_tabla": padron.nombre_tabla,
                "success": True
            }
            
        except Exception as query_error:
            print(f"Error en query SQL: {str(query_error)}")
        
    except Exception as e:
        print(f"Error obteniendo datos de ejemplo: {str(e)}")
        raise HTTPException(500, f"Error obteniendo datos: {str(e)}")

@router.get("/{plantilla_id}/pdf-preview")
async def obtener_preview_pdf(
    plantilla_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene el preview (imagen) del PDF de la plantilla"""
    try:
        plantilla = db.query(Plantilla).filter(
            Plantilla.id == plantilla_id,
            Plantilla.is_deleted == False
        ).first()
        
        if not plantilla:
            raise HTTPException(404, "Plantilla no encontrada")
        
        if not plantilla.ruta_archivo:
            raise HTTPException(404, "La plantilla no tiene PDF")
        
        # Verificar si el archivo PDF existe
        if not os.path.exists(plantilla.ruta_archivo):
            raise HTTPException(404, "Archivo PDF no encontrado en el servidor")
        
        # Buscar preview existente
        pdf_filename = os.path.basename(plantilla.ruta_archivo)
        preview_filename = f"{os.path.splitext(pdf_filename)[0]}_pagina1_50.png"
        preview_dir = os.path.join(settings.UPLOAD_DIR, "previews")
        preview_path = os.path.join(preview_dir, preview_filename)
        
        # Si no existe, generarlo
        if not os.path.exists(preview_path):
            os.makedirs(preview_dir, exist_ok=True)
            preview_path, error = PDFConverter.pdf_a_imagen(plantilla.ruta_archivo, 1, 0.5)
            if error:
                print(f"Error generando preview: {error}")
                # Usar placeholder si falla
                placeholder_path = os.path.join(preview_dir, "placeholder.png")
                if not os.path.exists(placeholder_path):
                    from PIL import Image, ImageDraw
                    img = Image.new('RGB', (800, 1000), color=(240, 240, 240))
                    d = ImageDraw.Draw(img)
                    d.text((400, 500), "PDF No Disponible", fill=(150, 150, 150), anchor="mm")
                    img.save(placeholder_path)
                preview_path = placeholder_path
        
        preview_url = f"/uploads/previews/{os.path.basename(preview_path)}"
        
        return {
            "preview_url": preview_url,
            "pdf_exists": os.path.exists(plantilla.ruta_archivo),
            "preview_exists": os.path.exists(preview_path)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error obteniendo preview: {str(e)}")
        raise HTTPException(500, f"Error obteniendo preview: {str(e)}")