"""
Servicio completo para generación de PDFs con datos dinámicos
"""
import os
import io
import tempfile
from typing import Dict, List, Tuple, Optional, Any
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import fitz  # PyMuPDF
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import mm, inch
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
import zipfile
from datetime import datetime
import logging

from app.config import settings
from app.utils.logger import logger
from app.utils.file_utils import generar_nombre_unico, calcular_hash_archivo

# Configurar fuentes ReportLab (opcional)
try:
    pdfmetrics.registerFont(TTFont('Arial', 'arial.ttf'))
    pdfmetrics.registerFont(TTFont('Arial-Bold', 'arialbd.ttf'))
    pdfmetrics.registerFont(TTFont('Arial-Italic', 'ariali.ttf'))
    pdfmetrics.registerFont(TTFont('Arial-BoldItalic', 'arialbi.ttf'))
    pdfmetrics.registerFont(TTFont('Helvetica', 'Helvetica.ttf'))
    pdfmetrics.registerFont(TTFont('Helvetica-Bold', 'Helvetica-Bold.ttf'))
    pdfmetrics.registerFont(TTFont('Times-Roman', 'times.ttf'))
except:
    logger.warning("No se pudieron registrar fuentes TTF, usando fuentes estándar")

class PDFGenerator:
    """Servicio principal para generación de PDFs"""
    
    # Dimensiones OFICIO MEXICO en mm
    PAGE_WIDTH_MM = 215.9
    PAGE_HEIGHT_MM = 340.1
    MM_TO_POINTS = 2.83465  # 1mm = 2.83465 puntos (ReportLab)
    
    # Mapeo de alineaciones
    ALIGN_MAP = {
        'left': TA_LEFT,
        'center': TA_CENTER,
        'right': TA_RIGHT,
        'justify': TA_JUSTIFY
    }
    
    # Mapeo de fuentes compatibles
    FONT_MAP = {
        'Arial': 'Helvetica',
        'Helvetica': 'Helvetica',
        'Times New Roman': 'Times-Roman',
        'Courier': 'Courier',
        'Verdana': 'Helvetica',  # Fallback a Helvetica
        'Tahoma': 'Helvetica',
    }
    
    def __init__(self):
        self.cache_fondos = {}  # Cache para PDFs base
        self.max_workers = 4  # Número máximo de workers concurrentes
        
    # ========== MÉTODO PRINCIPAL ==========
    def generar_pdf_individual(
        self, 
        plantilla_def: Dict[str, Any], 
        datos_registro: Dict[str, Any],
        output_path: Optional[str] = None
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Genera un PDF individual con datos específicos
        
        Args:
            plantilla_def: Definición completa de la plantilla
            datos_registro: Diccionario con datos del registro
            output_path: Ruta opcional para guardar (si no se proporciona, se genera automáticamente)
            
        Returns:
            Tuple: (success, message, pdf_path_or_bytes)
        """
        try:
            # Validar entrada
            if not plantilla_def or not datos_registro:
                return False, "Datos de entrada inválidos", None
            
            # Generar ruta de salida si no se proporciona
            if not output_path:
                output_dir = os.path.join(settings.UPLOAD_DIR, "generados", "individual")
                os.makedirs(output_dir, exist_ok=True)
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                output_path = os.path.join(output_dir, f"doc_{timestamp}_{hash(str(datos_registro))[:8]}.pdf")
            
            # Determinar método de generación
            pdf_base_path = plantilla_def.get('pdf_base')
            elementos = plantilla_def.get('elementos', [])
            
            if pdf_base_path and os.path.exists(pdf_base_path):
                # Método 1: Superponer sobre PDF base existente
                success, message = self._generar_sobre_pdf_base(
                    pdf_base_path, elementos, datos_registro, output_path
                )
            else:
                # Método 2: Crear PDF desde cero
                success, message = self._generar_pdf_desde_cero(
                    elementos, datos_registro, output_path
                )
            
            if success:
                # Calcular hash para integridad
                file_hash = calcular_hash_archivo(output_path)
                return True, "PDF generado exitosamente", output_path
            else:
                return False, message, None
                
        except Exception as e:
            error_msg = f"Error generando PDF individual: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return False, error_msg, None
    
    # ========== GENERACIÓN MASIVA ==========
    def generar_lote_pdfs(
        self,
        plantilla_def: Dict[str, Any],
        lista_datos: List[Dict[str, Any]],
        output_dir: str,
        max_workers: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Genera múltiples PDFs de forma concurrente
        
        Args:
            plantilla_def: Definición de plantilla
            lista_datos: Lista de diccionarios con datos
            output_dir: Directorio donde guardar los PDFs
            max_workers: Número máximo de threads (None = usar default)
            
        Returns:
            Dict con resultados del proceso
        """
        resultados = {
            "total": len(lista_datos),
            "exitosos": 0,
            "fallidos": 0,
            "archivos": [],
            "errores": [],
            "tiempo_inicio": datetime.now().isoformat()
        }
        
        # Crear directorio de salida
        os.makedirs(output_dir, exist_ok=True)
        
        # Usar ThreadPoolExecutor para generación concurrente
        workers = max_workers or self.max_workers
        
        try:
            with ThreadPoolExecutor(max_workers=workers) as executor:
                # Preparar tareas
                futures = {}
                for idx, datos in enumerate(lista_datos):
                    # Crear nombre único para cada archivo
                    cuenta = datos.get('cuenta', str(idx))
                    codigo = datos.get('codigo_afiliado', '')
                    filename = f"doc_{cuenta}_{codigo}_{idx:06d}.pdf".replace('/', '_')
                    output_path = os.path.join(output_dir, filename)
                    
                    # Enviar tarea al executor
                    future = executor.submit(
                        self.generar_pdf_individual,
                        plantilla_def,
                        datos,
                        output_path
                    )
                    futures[future] = (idx, cuenta, output_path)
                
                # Procesar resultados conforme se completan
                for future in as_completed(futures):
                    idx, cuenta, output_path = futures[future]
                    
                    try:
                        success, message, result_path = future.result(timeout=300)  # 5min timeout
                        
                        if success:
                            resultados["exitosos"] += 1
                            resultados["archivos"].append({
                                "indice": idx,
                                "cuenta": cuenta,
                                "ruta": result_path,
                                "hash": calcular_hash_archivo(result_path),
                                "tamano": os.path.getsize(result_path)
                            })
                        else:
                            resultados["fallidos"] += 1
                            resultados["errores"].append({
                                "indice": idx,
                                "cuenta": cuenta,
                                "error": message
                            })
                            
                    except Exception as e:
                        resultados["fallidos"] += 1
                        resultados["errores"].append({
                            "indice": idx,
                            "cuenta": cuenta,
                            "error": f"Error en generación: {str(e)}"
                        })
                        
        except Exception as e:
            error_msg = f"Error en generación masiva: {str(e)}"
            logger.error(error_msg, exc_info=True)
            resultados["error_global"] = error_msg
            
        resultados["tiempo_fin"] = datetime.now().isoformat()
        return resultados
    
    # ========== MÉTODOS PRIVADOS ==========
    def _generar_sobre_pdf_base(
        self,
        pdf_base_path: str,
        elementos: List[Dict[str, Any]],
        datos_registro: Dict[str, Any],
        output_path: str
    ) -> Tuple[bool, str]:
        """Superpone texto sobre PDF base usando PyMuPDF"""
        try:
            # Abrir PDF base (usar cache si está disponible)
            if pdf_base_path in self.cache_fondos:
                doc = self.cache_fondos[pdf_base_path].copy()
            else:
                doc = fitz.open(pdf_base_path)
                # Guardar en cache para reutilización (solo copia de referencia)
                self.cache_fondos[pdf_base_path] = doc
            
            # Obtener primera página (asumimos plantilla de 1 página)
            if len(doc) == 0:
                return False, "PDF base no tiene páginas"
            
            page = doc[0]
            
            # Procesar cada elemento
            for elemento in elementos:
                if not elemento.get('activo', True):
                    continue
                
                # Obtener texto procesado
                texto = self._procesar_texto_elemento(elemento, datos_registro)
                if not texto:
                    continue
                
                # Convertir posición de mm a puntos (PyMuPDF usa puntos)
                x_pt = elemento['x'] * self.MM_TO_POINTS
                y_pt = elemento['y'] * self.MM_TO_POINTS
                ancho_pt = elemento.get('ancho', 100) * self.MM_TO_POINTS
                alto_pt = elemento.get('alto', 10) * self.MM_TO_POINTS
                
                # Crear rectángulo para el texto
                rect = fitz.Rect(x_pt, y_pt, x_pt + ancho_pt, y_pt + alto_pt)
                
                # Configurar propiedades del texto
                fontname = self._mapear_fuente_pymupdf(elemento.get('fuente', 'Helvetica'))
                fontsize = elemento.get('tamano_fuente', 12)
                
                # Convertir color hex a RGB
                color_hex = elemento.get('color', '#000000')
                color_rgb = self._hex_a_rgb(color_hex)
                
                # Configurar alineación
                align = 0  # 0=left, 1=center, 2=right
                if elemento.get('alineacion') == 'center':
                    align = 1
                elif elemento.get('alineacion') == 'right':
                    align = 2
                
                # Insertar texto en la página
                page.insert_textbox(
                    rect,
                    texto,
                    fontname=fontname,
                    fontsize=fontsize,
                    color=color_rgb,
                    align=align,
                    rotate=0,
                    overlay=True  # Superponer sobre contenido existente
                )
            
            # Guardar PDF modificado
            doc.save(output_path, garbage=4, deflate=True, clean=True)
            
            # No cerrar el documento si está en cache
            if pdf_base_path not in self.cache_fondos:
                doc.close()
            
            return True, "PDF generado exitosamente sobre base"
            
        except Exception as e:
            error_msg = f"Error generando sobre PDF base: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return False, error_msg
    
    def _generar_pdf_desde_cero(
        self,
        elementos: List[Dict[str, Any]],
        datos_registro: Dict[str, Any],
        output_path: str
    ) -> Tuple[bool, str]:
        """Crea PDF desde cero usando ReportLab"""
        try:
            # Crear canvas con tamaño OFICIO MEXICO
            c = canvas.Canvas(
                output_path,
                pagesize=(self.PAGE_WIDTH_MM*mm, self.PAGE_HEIGHT_MM*mm)
            )
            
            # Configurar título del documento
            c.setTitle("Documento Generado")
            c.setSubject("Combinación de Correspondencia")
            c.setAuthor("Sistema de Correspondencia Web")
            c.setCreator(f"Sistema v{settings.APP_VERSION}")
            
            # Procesar cada elemento
            for elemento in elementos:
                if not elemento.get('activo', True):
                    continue
                
                # Obtener texto procesado
                texto = self._procesar_texto_elemento(elemento, datos_registro)
                if not texto:
                    continue
                
                # Configurar fuente
                font_name = self._mapear_fuente_reportlab(elemento.get('fuente', 'Helvetica'))
                font_size = elemento.get('tamano_fuente', 12)
                
                # Configurar estilo de fuente
                if elemento.get('negrita') and elemento.get('cursiva'):
                    font_name += "-BoldOblique"
                elif elemento.get('negrita'):
                    font_name += "-Bold"
                elif elemento.get('cursiva'):
                    font_name += "-Oblique"
                
                # Configurar color
                color_hex = elemento.get('color', '#000000')
                c.setFillColor(HexColor(color_hex))
                c.setFont(font_name, font_size)
                
                # Calcular posición (ReportLab: origen abajo-izquierda)
                x = elemento['x'] * mm
                y = self.PAGE_HEIGHT_MM*mm - (elemento['y'] * mm) - font_size
                
                # Dibujar texto con alineación
                alineacion = elemento.get('alineacion', 'left')
                
                if alineacion == 'center':
                    c.drawCentredString(x + (elemento.get('ancho', 100)*mm)/2, y, texto)
                elif alineacion == 'right':
                    c.drawRightString(x + elemento.get('ancho', 100)*mm, y, texto)
                else:  # left
                    c.drawString(x, y, texto)
            
            # Finalizar página
            c.showPage()
            c.save()
            
            return True, "PDF generado exitosamente desde cero"
            
        except Exception as e:
            error_msg = f"Error generando PDF desde cero: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return False, error_msg
    
    def _procesar_texto_elemento(self, elemento: Dict[str, Any], datos: Dict[str, Any]) -> str:
        """Procesa texto, reemplazando campos <<nombre>> con valores reales"""
        try:
            tipo = elemento.get('tipo', 'texto')
            
            if tipo == 'campo':
                # Campo directo del padrón
                campo = elemento.get('columna_padron', '')
                if campo:
                    valor = datos.get(campo, f'[{campo}]')
                    return str(valor).strip()
                return ''
            
            elif tipo == 'texto':
                # Texto fijo que puede contener campos
                texto = elemento.get('texto_fijo', '')
                if not texto:
                    return ''
                
                # Buscar y reemplazar campos del tipo <<nombre_campo>>
                import re
                
                def reemplazar_campo(match):
                    campo = match.group(1).strip()
                    valor = datos.get(campo, f'[{campo}]')
                    return str(valor)
                
                # Reemplazar todos los campos encontrados
                texto_procesado = re.sub(r'<<(.+?)>>', reemplazar_campo, texto)
                return texto_procesado
            
            elif tipo == 'compuesto':
                # Texto con múltiples componentes
                componentes = elemento.get('componentes_json', [])
                if not componentes:
                    return ''
                
                texto_final = ''
                for comp in componentes:
                    if not comp.get('visible', True):
                        continue
                    
                    if comp.get('tipo') == 'texto':
                        texto_final += comp.get('valor', '')
                    elif comp.get('tipo') == 'campo':
                        campo = comp.get('valor', '')
                        valor = datos.get(campo, f'[{campo}]')
                        texto_final += str(valor)
                
                return texto_final
            
            else:
                return ''
                
        except Exception as e:
            logger.error(f"Error procesando texto: {str(e)}")
            return f"[Error: {str(e)}]"
    
    def _mapear_fuente_reportlab(self, fuente: str) -> str:
        """Mapea nombres de fuentes amigables a fuentes ReportLab"""
        return self.FONT_MAP.get(fuente, 'Helvetica')
    
    def _mapear_fuente_pymupdf(self, fuente: str) -> str:
        """Mapea nombres de fuentes a fuentes PyMuPDF"""
        # PyMuPDF usa: helv, ti-ro, co, etc.
        fuente_lower = fuente.lower()
        if 'arial' in fuente_lower:
            return 'helv'
        elif 'times' in fuente_lower:
            return 'ti-ro'
        elif 'courier' in fuente_lower:
            return 'co'
        else:
            return 'helv'  # Helvetica por defecto
    
    def _hex_a_rgb(self, hex_color: str) -> tuple:
        """Convierte color hex (#RRGGBB) a RGB tuple (0-1)"""
        try:
            hex_color = hex_color.lstrip('#')
            if len(hex_color) == 6:
                r = int(hex_color[0:2], 16) / 255.0
                g = int(hex_color[2:4], 16) / 255.0
                b = int(hex_color[4:6], 16) / 255.0
                return (r, g, b)
            else:
                return (0, 0, 0)  # Negro por defecto
        except:
            return (0, 0, 0)
    
    # ========== MÉTODOS UTILITARIOS ==========
    def crear_zip_de_pdfs(self, lista_archivos: List[str], output_zip: str) -> Tuple[bool, str]:
        """Crea archivo ZIP con múltiples PDFs"""
        try:
            with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for archivo in lista_archivos:
                    if os.path.exists(archivo):
                        nombre = os.path.basename(archivo)
                        zipf.write(archivo, nombre)
            
            return True, f"ZIP creado: {output_zip}"
        except Exception as e:
            return False, f"Error creando ZIP: {str(e)}"
    
    def obtener_metadatos_pdf(self, pdf_path: str) -> Dict[str, Any]:
        """Obtiene metadatos de un PDF generado"""
        try:
            doc = fitz.open(pdf_path)
            metadata = {
                "paginas": len(doc),
                "tamano_bytes": os.path.getsize(pdf_path),
                "hash": calcular_hash_archivo(pdf_path),
                "fecha_generacion": datetime.fromtimestamp(os.path.getctime(pdf_path)).isoformat()
            }
            doc.close()
            return metadata
        except:
            return {}
    
    def limpiar_cache(self):
        """Limpia cache de PDFs base"""
        for doc in self.cache_fondos.values():
            try:
                doc.close()
            except:
                pass
        self.cache_fondos.clear()


# Instancia global del servicio
pdf_generator = PDFGenerator()