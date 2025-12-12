"""
Servicio completo para procesamiento de archivos CSV
"""
import csv
import io
import os
import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Any, Optional
from datetime import datetime
import uuid
import hashlib
import chardet
import logging
from sqlalchemy import text, create_engine
from sqlalchemy.exc import SQLAlchemyError

from app.database import SessionLocal
from app.models import EmisionTemp, Proyecto, IdentificadorPadrones, MatchExcepciones
from app.config import settings
from app.utils.logger import logger
from app.utils.file_utils import calcular_hash_archivo

class CSVService:
    """Servicio para procesamiento de archivos CSV"""
    
    def __init__(self):
        self.db = SessionLocal()
        self.encoding_detectados = ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']
    
    # ========== MÉTODO PRINCIPAL ==========
    def procesar_csv(
        self,
        archivo_path: str,
        proyecto_id: int,
        usuario_id: int,
        plantilla_id: Optional[int] = None,
        delimitador: str = ',',
        encoding: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Procesa archivo CSV completo: lectura, validación y match con padrón
        
        Args:
            archivo_path: Ruta al archivo CSV
            proyecto_id: ID del proyecto
            usuario_id: ID del usuario que sube
            plantilla_id: ID de plantilla opcional
            delimitador: Delimitador CSV (',', ';', '|', '\t')
            encoding: Codificación forzada (si None, se detecta)
            
        Returns:
            Dict con resultados del procesamiento
        """
        session_id = str(uuid.uuid4())
        resultados = {
            "session_id": session_id,
            "proyecto_id": proyecto_id,
            "usuario_id": usuario_id,
            "plantilla_id": plantilla_id,
            "estado": "procesando",
            "total_registros": 0,
            "registros_procesados": 0,
            "match_exactos": 0,
            "match_parciales": 0,
            "sin_match": 0,
            "errores": [],
            "advertencias": [],
            "tiempo_inicio": datetime.now().isoformat(),
            "archivo_csv": archivo_path,
            "hash_csv": calcular_hash_archivo(archivo_path)
        }
        
        try:
            # 1. Validar proyecto
            proyecto = self.db.query(Proyecto).filter(
                Proyecto.id == proyecto_id,
                Proyecto.is_deleted == False
            ).first()
            
            if not proyecto:
                resultados["estado"] = "error"
                resultados["errores"].append("Proyecto no encontrado")
                return resultados
            
            # 2. Obtener información del padrón
            padron_info = self.db.query(IdentificadorPadrones).filter(
                IdentificadorPadrones.uuid_padron == proyecto.tabla_padron,
                IdentificadorPadrones.activo == True
            ).first()
            
            if not padron_info:
                resultados["estado"] = "error"
                resultados["errores"].append(f"Padrón no encontrado: {proyecto.tabla_padron}")
                return resultados
            
            # 3. Leer y validar CSV
            df_csv, encoding_usado = self._leer_y_validar_csv(
                archivo_path, delimitador, encoding
            )
            
            if df_csv is None:
                resultados["estado"] = "error"
                return resultados
            
            resultados["total_registros"] = len(df_csv)
            resultados["encoding_usado"] = encoding_usado
            resultados["columnas_csv"] = df_csv.columns.tolist()
            
            # 4. Hacer match con el padrón
            registros_procesados = self._hacer_match_con_padron(
                df_csv, padron_info.nombre_tabla, proyecto_id, usuario_id, session_id
            )
            
            resultados["registros_procesados"] = len(registros_procesados)
            
            # 5. Calcular estadísticas de match
            for registro in registros_procesados:
                match_type = registro.get('match_tipo', 'sin_match')
                if match_type == 'exacto':
                    resultados["match_exactos"] += 1
                elif match_type == 'parcial':
                    resultados["match_parciales"] += 1
                else:
                    resultados["sin_match"] += 1
            
            # 6. Guardar registros en emisiones_temp
            self._guardar_en_emisiones_temp(
                registros_procesados, proyecto_id, usuario_id, plantilla_id, session_id
            )
            
            resultados["estado"] = "completado"
            
        except Exception as e:
            error_msg = f"Error procesando CSV: {str(e)}"
            logger.error(error_msg, exc_info=True)
            resultados["estado"] = "error"
            resultados["errores"].append(error_msg)
            
            # Rollback en caso de error
            self.db.rollback()
            
        finally:
            resultados["tiempo_fin"] = datetime.now().isoformat()
            self.db.close()
        
        return resultados
    
    # ========== MÉTODOS PRIVADOS ==========
    def _leer_y_validar_csv(
        self, 
        archivo_path: str, 
        delimitador: str = ',',
        encoding_forzado: Optional[str] = None
    ) -> Tuple[Optional[pd.DataFrame], str]:
        """Lee y valida archivo CSV"""
        try:
            # Detectar encoding si no se fuerza
            encoding = encoding_forzado
            if not encoding:
                encoding = self._detectar_encoding(archivo_path)
            
            # Intentar leer con diferentes enfoques
            df = None
            intentos_encoding = [encoding] + self.encoding_detectados
            
            for enc in intentos_encoding:
                try:
                    # Leer CSV con pandas
                    df = pd.read_csv(
                        archivo_path,
                        delimiter=delimitador,
                        encoding=enc,
                        dtype=str,  # Leer todo como string
                        na_filter=False,  # No convertir NaN
                        engine='python'  # Usar engine python para mejor compatibilidad
                    )
                    
                    # Reemplazar NaN por strings vacíos
                    df = df.fillna('')
                    
                    # Validar columnas mínimas
                    if len(df.columns) == 0:
                        raise ValueError("CSV no tiene columnas")
                    
                    # Validar que tenga datos
                    if len(df) == 0:
                        raise ValueError("CSV está vacío")
                    
                    # Normalizar nombres de columnas (eliminar espacios, mayúsculas)
                    df.columns = [str(col).strip().upper() for col in df.columns]
                    
                    logger.info(f"CSV leído exitosamente: {len(df)} registros, encoding: {enc}")
                    return df, enc
                    
                except (UnicodeDecodeError, pd.errors.ParserError) as e:
                    logger.warning(f"Encoding {enc} falló: {str(e)}")
                    continue
            
            # Si todos los encoding fallaron
            raise ValueError(f"No se pudo leer el CSV con los encodings probados: {intentos_encoding}")
            
        except Exception as e:
            error_msg = f"Error leyendo CSV: {str(e)}"
            logger.error(error_msg)
            return None, "unknown"
    
    def _detectar_encoding(self, archivo_path: str) -> str:
        """Detecta encoding del archivo"""
        try:
            # Leer muestra del archivo para detección
            with open(archivo_path, 'rb') as f:
                raw_data = f.read(10000)  # Leer primeros 10KB
            
            # Detectar encoding
            deteccion = chardet.detect(raw_data)
            encoding = deteccion.get('encoding', 'utf-8')
            
            # Mapear encoding comunes
            encoding_map = {
                'ISO-8859-1': 'latin-1',
                'Windows-1252': 'cp1252',
                'ascii': 'utf-8'
            }
            
            encoding = encoding_map.get(encoding, encoding)
            
            # Validar que el encoding sea válido
            if encoding and encoding.lower() in ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']:
                return encoding
            
            return 'utf-8'  # Default
            
        except Exception:
            return 'utf-8'  # Default si falla la detección
    
    def _hacer_match_con_padron(
        self,
        df_csv: pd.DataFrame,
        nombre_tabla_padron: str,
        proyecto_id: int,
        usuario_id: int,
        session_id: str
    ) -> List[Dict[str, Any]]:
        """Realiza match entre CSV y tabla de padrón"""
        registros_procesados = []
        
        try:
            # Obtener columnas clave del padrón
            columnas_padron = self._obtener_columnas_padron(nombre_tabla_padron)
            columnas_clave = self._identificar_columnas_clave(columnas_padron)
            
            # Obtener columnas clave del CSV
            columnas_csv = df_csv.columns.tolist()
            columnas_match = self._mapear_columnas_match(columnas_csv, columnas_clave)
            
            # Crear conexión directa para queries eficientes
            engine = create_engine(settings.DATABASE_URL)
            
            # Procesar cada fila del CSV
            for idx, fila in df_csv.iterrows():
                try:
                    registro = self._procesar_fila_csv(
                        fila, idx, columnas_match, nombre_tabla_padron, 
                        columnas_padron, engine, proyecto_id, usuario_id
                    )
                    registros_procesados.append(registro)
                    
                except Exception as e:
                    logger.error(f"Error procesando fila {idx}: {str(e)}")
                    # Registrar como error pero continuar
                    registros_procesados.append({
                        'indice_csv': idx,
                        'match_tipo': 'error',
                        'datos_csv': fila.to_dict(),
                        'datos_padron': {},
                        'error': str(e)
                    })
            
            engine.dispose()
            return registros_procesados
            
        except Exception as e:
            logger.error(f"Error en match con padrón: {str(e)}")
            raise
    
    def _obtener_columnas_padron(self, nombre_tabla: str) -> List[Dict[str, Any]]:
        """Obtiene metadatos de columnas del padrón"""
        try:
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
            
            result = self.db.execute(query, {"nombre_tabla": nombre_tabla})
            columnas = []
            
            for row in result:
                columnas.append({
                    "nombre": row.nombre,
                    "tipo": row.tipo,
                    "nullable": row.nullable == 'YES'
                })
            
            return columnas
            
        except Exception as e:
            logger.error(f"Error obteniendo columnas del padrón: {str(e)}")
            return []
    
    def _identificar_columnas_clave(self, columnas_padron: List[Dict]) -> List[str]:
        """Identifica columnas que pueden usarse para match"""
        columnas_clave = []
        
        # Buscar columnas comunes para match
        posibles_claves = ['CUENTA', 'CODIGO', 'ID', 'RFC', 'CLAVE', 'NUMERO']
        
        for col in columnas_padron:
            nombre = col['nombre'].upper()
            
            # Verificar si es columna clave
            for clave in posibles_claves:
                if clave in nombre:
                    columnas_clave.append(col['nombre'])
                    break
            
            # También considerar columnas únicas
            if any(x in nombre for x in ['UNICO', 'UNICA', 'PRIMARY', 'KEY']):
                columnas_clave.append(col['nombre'])
        
        # Si no encontramos, usar primeras columnas
        if not columnas_clave and columnas_padron:
            columnas_clave = [col['nombre'] for col in columnas_padron[:3]]
        
        return columnas_clave
    
    def _mapear_columnas_match(self, columnas_csv: List[str], columnas_clave: List[str]) -> Dict[str, str]:
        """Mapea columnas del CSV a columnas del padrón"""
        mapeo = {}
        
        # Normalizar nombres para matching
        columnas_csv_norm = [col.upper().replace('_', '').replace(' ', '') for col in columnas_csv]
        columnas_clave_norm = [col.upper().replace('_', '').replace(' ', '') for col in columnas_clave]
        
        # Intentar hacer match exacto primero
        for idx_csv, col_csv_norm in enumerate(columnas_csv_norm):
            for idx_pad, col_pad_norm in enumerate(columnas_clave_norm):
                if col_csv_norm == col_pad_norm:
                    mapeo[columnas_csv[idx_csv]] = columnas_clave[idx_pad]
                    break
        
        # Si no hay suficientes matches, intentar matching parcial
        if len(mapeo) < len(columnas_clave):
            for col_pad in columnas_clave:
                if col_pad not in mapeo.values():
                    col_pad_norm = col_pad.upper().replace('_', '').replace(' ', '')
                    
                    # Buscar columna CSV similar
                    for col_csv in columnas_csv:
                        col_csv_norm = col_csv.upper().replace('_', '').replace(' ', '')
                        
                        # Matching parcial
                        if col_pad_norm in col_csv_norm or col_csv_norm in col_pad_norm:
                            mapeo[col_csv] = col_pad
                            break
        
        return mapeo
    
    def _procesar_fila_csv(
        self,
        fila: pd.Series,
        indice: int,
        columnas_match: Dict[str, str],
        nombre_tabla_padron: str,
        columnas_padron: List[Dict],
        engine,
        proyecto_id: int,
        usuario_id: int
    ) -> Dict[str, Any]:
        """Procesa una fila individual del CSV"""
        resultado = {
            'indice_csv': indice,
            'datos_csv': fila.to_dict(),
            'datos_padron': {},
            'match_tipo': 'sin_match',
            'columnas_encontradas': []
        }
        
        try:
            # Construir condiciones WHERE para la búsqueda
            condiciones = []
            valores = {}
            
            for col_csv, col_padron in columnas_match.items():
                if col_csv in fila and pd.notna(fila[col_csv]):
                    valor = str(fila[col_csv]).strip()
                    if valor:  # Solo buscar si hay valor
                        condiciones.append(f"{col_padron} = :{col_padron}")
                        valores[col_padron] = valor
                        resultado['columnas_encontradas'].append(col_padron)
            
            # Si no hay condiciones, no buscar
            if not condiciones:
                return resultado
            
            # Construir y ejecutar query
            where_clause = " OR ".join(condiciones)
            query = text(f"""
                SELECT * FROM {nombre_tabla_padron} 
                WHERE {where_clause}
                LIMIT 1
            """)
            
            with engine.connect() as conn:
                result = conn.execute(query, valores)
                row = result.fetchone()
                
                if row:
                    # Convertir resultado a dict
                    datos_padron = dict(row._mapping)
                    resultado['datos_padron'] = datos_padron
                    
                    # Determinar tipo de match
                    match_exacto = True
                    for col_csv, col_padron in columnas_match.items():
                        if col_csv in fila and col_padron in datos_padron:
                            val_csv = str(fila[col_csv]).strip()
                            val_pad = str(datos_padron[col_padron]).strip()
                            if val_csv and val_pad and val_csv != val_pad:
                                match_exacto = False
                                break
                    
                    resultado['match_tipo'] = 'exacto' if match_exacto else 'parcial'
                    
                    # Registrar excepción si es match parcial
                    if resultado['match_tipo'] == 'parcial':
                        self._registrar_match_excepcion(
                            fila, datos_padron, proyecto_id, usuario_id, columnas_match
                        )
                
            return resultado
            
        except Exception as e:
            logger.error(f"Error procesando fila {indice}: {str(e)}")
            resultado['error'] = str(e)
            resultado['match_tipo'] = 'error'
            return resultado
    
    def _registrar_match_excepcion(
        self,
        fila_csv: pd.Series,
        datos_padron: Dict[str, Any],
        proyecto_id: int,
        usuario_id: int,
        columnas_match: Dict[str, str]
    ):
        """Registra match parcial para revisión manual"""
        try:
            # Buscar columnas clave para identificar
            cuenta_csv = None
            codigo_csv = None
            cuenta_padron = None
            codigo_padron = None
            
            for col_csv, col_padron in columnas_match.items():
                if 'CUENTA' in col_padron.upper():
                    cuenta_csv = str(fila_csv.get(col_csv, ''))
                    cuenta_padron = str(datos_padron.get(col_padron, ''))
                elif 'CODIGO' in col_padron.upper() or 'ID' in col_padron.upper():
                    codigo_csv = str(fila_csv.get(col_csv, ''))
                    codigo_padron = str(datos_padron.get(col_padron, ''))
            
            # Crear registro de excepción
            excepcion = MatchExcepciones(
                proyecto_id=proyecto_id,
                cuenta_csv=cuenta_csv,
                codigo_csv=codigo_csv,
                cuenta_padron=cuenta_padron,
                codigo_padron=codigo_padron,
                tipo_match='parcial',
                usuario_id=usuario_id,
                fecha_registro=datetime.utcnow(),
                activo=True
            )
            
            self.db.add(excepcion)
            
        except Exception as e:
            logger.error(f"Error registrando excepción: {str(e)}")
    
    def _guardar_en_emisiones_temp(
        self,
        registros: List[Dict[str, Any]],
        proyecto_id: int,
        usuario_id: int,
        plantilla_id: Optional[int],
        session_id: str
    ):
        """Guarda registros procesados en la tabla temporal"""
        try:
            for registro in registros:
                # Combinar datos CSV y padrón
                datos_completos = {**registro.get('datos_csv', {}), **registro.get('datos_padron', {})}
                
                # Extraer cuenta y código para búsqueda rápida
                cuenta = None
                codigo = None
                
                for key, value in datos_completos.items():
                    if key and value:
                        key_upper = str(key).upper()
                        if 'CUENTA' in key_upper:
                            cuenta = str(value)
                        elif 'CODIGO' in key_upper or 'IDAFILIADO' in key_upper:
                            codigo = str(value)
                
                # Crear registro en emisiones_temp
                emision = EmisionTemp(
                    proyecto_id=proyecto_id,
                    plantilla_id=plantilla_id,
                    usuario_id=usuario_id,
                    datos_json=datos_completos,
                    cuenta=cuenta,
                    codigo_afiliado=codigo,
                    estado='pendiente',
                    error_mensaje=registro.get('error'),
                    fecha_carga=datetime.utcnow(),
                    sesion_id=session_id
                )
                
                self.db.add(emision)
            
            # Commit masivo
            self.db.commit()
            
        except Exception as e:
            self.db.rollback()
            raise
    
    # ========== MÉTODOS UTILITARIOS ==========
    def obtener_estadisticas_csv(self, archivo_path: str) -> Dict[str, Any]:
        """Obtiene estadísticas del archivo CSV"""
        try:
            df = pd.read_csv(archivo_path, nrows=0)  # Solo leer encabezados
            return {
                "columnas": df.columns.tolist(),
                "num_columnas": len(df.columns),
                "tamano_bytes": os.path.getsize(archivo_path),
                "hash": calcular_hash_archivo(archivo_path)
            }
        except Exception as e:
            return {"error": str(e)}
    
    def validar_estructura_csv(self, archivo_path: str, columnas_requeridas: List[str]) -> Tuple[bool, List[str]]:
        """Valida que el CSV tenga las columnas requeridas"""
        try:
            df = pd.read_csv(archivo_path, nrows=0)
            columnas_csv = [col.upper() for col in df.columns]
            columnas_faltantes = []
            
            for col_req in columnas_requeridas:
                if col_req.upper() not in columnas_csv:
                    columnas_faltantes.append(col_req)
            
            return len(columnas_faltantes) == 0, columnas_faltantes
            
        except Exception as e:
            return False, [f"Error leyendo CSV: {str(e)}"]
    
    def limpiar_sesion_temporal(self, session_id: str, horas_antiguedad: int = 24):
        """Limpia registros temporales antiguos"""
        try:
            from datetime import datetime, timedelta
            
            fecha_limite = datetime.utcnow() - timedelta(hours=horas_antiguedad)
            
            # Eliminar registros antiguos
            self.db.query(EmisionTemp).filter(
                EmisionTemp.fecha_carga < fecha_limite,
                EmisionTemp.sesion_id == session_id
            ).delete()
            
            self.db.commit()
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error limpiando sesión {session_id}: {str(e)}")
            return False


# Instancia global del servicio
csv_service = CSVService()