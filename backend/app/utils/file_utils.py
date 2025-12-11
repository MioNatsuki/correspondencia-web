import os
import uuid
import hashlib
from pathlib import Path
from typing import Tuple
from fastapi import UploadFile, HTTPException
from app.config import settings

def generar_nombre_unico(original_filename: str, prefix: str = "") -> str:
    """
    Genera un nombre único para un archivo
    """
    ext = Path(original_filename).suffix.lower()
    nombre_unico = f"{prefix}_{uuid.uuid4().hex}{ext}"
    return nombre_unico

def calcular_hash_archivo(file_path: str) -> str:
    """Calcula el hash MD5 de un archivo"""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def validar_archivo_pdf(archivo: UploadFile) -> Tuple[bool, str]:
    """
    Valida que el archivo sea un PDF válido
    """
    # Verificar extensión
    ext = Path(archivo.filename).suffix.lower()
    if ext not in settings.ALLOWED_PDF_EXTENSIONS:
        return False, f"Extensión no permitida. Use: {', '.join(settings.ALLOWED_PDF_EXTENSIONS)}"
    
    # Verificar tamaño
    archivo.file.seek(0, 2)  # Ir al final
    tamaño = archivo.file.tell()
    archivo.file.seek(0)  # Volver al inicio
    
    if tamaño > settings.MAX_UPLOAD_SIZE:
        return False, f"Archivo demasiado grande. Máximo: {settings.MAX_UPLOAD_SIZE / 1024 / 1024}MB"
    
    # Verificar magic number (opcional)
    if tamaño > 4:
        magic = archivo.file.read(4)
        archivo.file.seek(0)
        if magic != b'%PDF':
            return False, "El archivo no es un PDF válido"
    
    return True, ""

def guardar_archivo(upload_file: UploadFile, subdir: str = "") -> str:
    """
    Guarda un archivo subido en el directorio de uploads
    """
    # Validar
    if upload_file.filename is None:
        raise HTTPException(status_code=400, detail="Nombre de archivo requerido")
    
    # Crear directorio si no existe
    target_dir = os.path.join(settings.UPLOAD_DIR, subdir)
    os.makedirs(target_dir, exist_ok=True)
    
    # Generar nombre único
    nombre_unico = generar_nombre_unico(upload_file.filename, subdir or "file")
    file_path = os.path.join(target_dir, nombre_unico)
    
    # Guardar archivo
    with open(file_path, "wb") as buffer:
        contenido = upload_file.file.read()
        buffer.write(contenido)
    
    return file_path

def eliminar_archivo(file_path: str) -> bool:
    """Elimina un archivo si existe"""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
    except Exception:
        pass
    return False

def obtener_tamano_archivo(file_path: str) -> int:
    """Obtiene el tamaño de un archivo en bytes"""
    try:
        return os.path.getsize(file_path)
    except:
        return 0