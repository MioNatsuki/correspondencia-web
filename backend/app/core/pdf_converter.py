import fitz  # PyMuPDF
from PIL import Image
import io
import os
from pathlib import Path
from typing import Tuple, Optional
from app.config import settings
from app.utils.file_utils import generar_nombre_unico

class PDFConverter:
    """Servicio para convertir PDF a imágenes y otras operaciones"""
    
    @staticmethod
    def pdf_a_imagen(
        pdf_path: str, 
        pagina: int = 1, 
        escala: float = 1.5,
        formato: str = "PNG"
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Convierte una página de PDF a imagen
        
        Args:
            pdf_path: Ruta al archivo PDF
            pagina: Número de página (1-indexed)
            escala: Factor de escala (1.0 = 72 DPI)
            formato: Formato de imagen (PNG, JPEG)
            
        Returns:
            Tuple (ruta_imagen, error_message)
        """
        try:
            # Validar archivo
            if not os.path.exists(pdf_path):
                return None, f"Archivo no encontrado: {pdf_path}"
            
            # Abrir PDF
            doc = fitz.open(pdf_path)
            
            # Validar página
            if pagina < 1 or pagina > len(doc):
                doc.close()
                return None, f"Página {pagina} no válida. PDF tiene {len(doc)} páginas."
            
            # Renderizar página
            page = doc[pagina - 1]
            zoom = escala
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            
            # Convertir a PIL Image
            img_data = pix.tobytes("ppm")
            img = Image.open(io.BytesIO(img_data))
            
            # Crear nombre único para la imagen
            pdf_name = Path(pdf_path).stem
            img_name = f"{pdf_name}_pagina{pagina}_{int(escala*100)}.{formato.lower()}"
            img_path = os.path.join(settings.UPLOAD_DIR, "previews", img_name)
            
            # Crear directorio si no existe
            os.makedirs(os.path.dirname(img_path), exist_ok=True)
            
            # Guardar imagen
            img.save(img_path, formato)
            
            # Liberar recursos
            doc.close()
            
            return img_path, None
            
        except Exception as e:
            return None, f"Error convirtiendo PDF: {str(e)}"
    
    @staticmethod
    def obtener_metadatos_pdf(pdf_path: str) -> dict:
        """Obtiene metadatos de un PDF"""
        try:
            doc = fitz.open(pdf_path)
            metadata = doc.metadata
            metadata["paginas"] = len(doc)
            
            # Obtener dimensiones de la primera página
            if len(doc) > 0:
                page = doc[0]
                metadata["ancho"] = page.rect.width  # puntos
                metadata["alto"] = page.rect.height  # puntos
                # Convertir a mm (1 punto = 0.352778 mm)
                metadata["ancho_mm"] = page.rect.width * 0.352778
                metadata["alto_mm"] = page.rect.height * 0.352778
            
            doc.close()
            return metadata
            
        except Exception as e:
            return {"error": str(e)}
    
    @staticmethod
    def extraer_texto_pdf(pdf_path: str, pagina: int = 1) -> str:
        """Extrae texto de una página específica del PDF"""
        try:
            doc = fitz.open(pdf_path)
            if pagina < 1 or pagina > len(doc):
                return f"Página {pagina} no válida"
            
            page = doc[pagina - 1]
            texto = page.get_text()
            doc.close()
            
            return texto
            
        except Exception as e:
            return f"Error extrayendo texto: {str(e)}"
    
    @staticmethod
    def validar_pdf(pdf_path: str) -> Tuple[bool, str]:
        """Valida que un PDF sea legible y no esté corrupto"""
        try:
            doc = fitz.open(pdf_path)
            num_paginas = len(doc)
            
            if num_paginas == 0:
                doc.close()
                return False, "PDF no tiene páginas"
            
            # Verificar que se pueda leer la primera página
            page = doc[0]
            _ = page.get_pixmap()  # Intentar renderizar
            
            doc.close()
            return True, f"PDF válido con {num_paginas} páginas"
            
        except Exception as e:
            return False, f"PDF corrupto o no válido: {str(e)}"
    
    @staticmethod
    def dividir_pdf(pdf_path: str, paginas: list = None) -> list:
        """
        Divide un PDF en páginas individuales
        
        Args:
            pdf_path: Ruta al PDF original
            paginas: Lista de números de página a extraer (1-indexed)
            
        Returns:
            Lista de rutas a los PDFs individuales
        """
        try:
            doc = fitz.open(pdf_path)
            output_files = []
            output_dir = os.path.join(settings.UPLOAD_DIR, "divididos")
            os.makedirs(output_dir, exist_ok=True)
            
            # Si no se especifican páginas, usar todas
            if paginas is None:
                paginas = list(range(1, len(doc) + 1))
            
            for pagina_num in paginas:
                if 1 <= pagina_num <= len(doc):
                    # Crear nuevo PDF con solo esta página
                    nuevo_doc = fitz.open()
                    nuevo_doc.insert_pdf(doc, from_page=pagina_num-1, to_page=pagina_num-1)
                    
                    # Guardar
                    nombre_base = Path(pdf_path).stem
                    output_path = os.path.join(output_dir, f"{nombre_base}_pagina{pagina_num}.pdf")
                    nuevo_doc.save(output_path)
                    nuevo_doc.close()
                    
                    output_files.append(output_path)
            
            doc.close()
            return output_files
            
        except Exception as e:
            raise Exception(f"Error dividiendo PDF: {str(e)}")