"""
Servicio para manejo de tablas de padrón
"""
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from app.models import IdentificadorPadrones, Proyecto
from app.schemas import ColumnaPadron, RegistroPadron

class PadronService:
    """Servicio para operaciones específicas con padrones"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def obtener_estadisticas_padron(self, uuid_padron: str) -> Dict[str, Any]:
        """Obtiene estadísticas de una tabla de padrón"""
        try:
            padron = self.db.query(IdentificadorPadrones).filter(
                IdentificadorPadrones.uuid_padron == uuid_padron
            ).first()
            
            if not padron:
                raise ValueError(f"Padrón {uuid_padron} no encontrado")
            
            # Contar registros
            count_query = text(f"SELECT COUNT(*) as total FROM {padron.nombre_tabla}")
            result = self.db.execute(count_query)
            total_registros = result.scalar() or 0
            
            # Obtener columnas
            columns_query = text("""
                SELECT COUNT(*) as total_columnas 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = :table_name
            """)
            result = self.db.execute(columns_query, {"table_name": padron.nombre_tabla})
            total_columnas = result.scalar() or 0
            
            return {
                "uuid_padron": uuid_padron,
                "nombre_tabla": padron.nombre_tabla,
                "descripcion": padron.descripcion,
                "activo": padron.activo,
                "estadisticas": {
                    "total_registros": total_registros,
                    "total_columnas": total_columnas,
                    "proyectos_asociados": self._contar_proyectos_asociados(uuid_padron)
                }
            }
            
        except Exception as e:
            raise ValueError(f"Error obteniendo estadísticas: {str(e)}")
    
    def _contar_proyectos_asociados(self, uuid_padron: str) -> int:
        """Cuenta cuántos proyectos usan este padrón"""
        return self.db.query(Proyecto).filter(
            Proyecto.tabla_padron == uuid_padron,
            Proyecto.is_deleted == False
        ).count()
    
    def buscar_valores_unicos(self, uuid_padron: str, columna: str, limit: int = 100) -> List[Any]:
        """Busca valores únicos en una columna del padrón"""
        try:
            padron = self.db.query(IdentificadorPadrones).filter(
                IdentificadorPadrones.uuid_padron == uuid_padron
            ).first()
            
            if not padron:
                raise ValueError("Padrón no encontrado")
            
            # Verificar que la columna existe
            columnas = self.obtener_columnas_padron(uuid_padron)
            if not any(c.nombre == columna for c in columnas):
                raise ValueError(f"Columna '{columna}' no existe en el padrón")
            
            # Query para valores únicos
            query = text(f"""
                SELECT DISTINCT {columna} as valor 
                FROM {padron.nombre_tabla} 
                WHERE {columna} IS NOT NULL 
                AND {columna} != ''
                ORDER BY {columna}
                LIMIT :limit
            """)
            
            result = self.db.execute(query, {"limit": limit})
            return [row.valor for row in result]
            
        except Exception as e:
            raise ValueError(f"Error buscando valores únicos: {str(e)}")
    
    def obtener_columnas_padron(self, uuid_padron: str) -> List[ColumnaPadron]:
        """Obtiene metadatos de columnas del padrón"""
        try:
            padron = self.db.query(IdentificadorPadrones).filter(
                IdentificadorPadrones.uuid_padron == uuid_padron
            ).first()
            
            if not padron:
                raise ValueError(f"Padrón {uuid_padron} no encontrado")
            
            query = text("""
                SELECT 
                    column_name as nombre,
                    data_type as tipo_db,
                    is_nullable as nullable,
                    column_default as valor_default
                FROM information_schema.columns 
                WHERE table_schema = 'public'
                AND table_name = :table_name
                ORDER BY ordinal_position
            """)
            
            result = self.db.execute(query, {"table_name": padron.nombre_tabla})
            columnas = []
            
            for row in result:
                # Determinar tipo amigable
                tipo_db = row.tipo_db.lower()
                
                if 'char' in tipo_db or 'text' in tipo_db or 'uuid' in tipo_db:
                    tipo_amigable = 'texto'
                elif 'int' in tipo_db or 'numeric' in tipo_db or 'decimal' in tipo_db or 'real' in tipo_db or 'float' in tipo_db or 'double' in tipo_db:
                    tipo_amigable = 'numero'
                elif 'date' in tipo_db or 'time' in tipo_db:
                    tipo_amigable = 'fecha'
                elif 'bool' in tipo_db:
                    tipo_amigable = 'booleano'
                else:
                    tipo_amigable = 'texto'
                
                columnas.append(
                    ColumnaPadron(
                        nombre=row.nombre,
                        tipo_db=row.tipo_db,
                        tipo=tipo_amigable,
                        nullable=row.nullable == 'YES',
                        valor_default=row.valor_default
                    )
                )
            
            return columnas
            
        except Exception as e:
            raise ValueError(f"Error obteniendo columnas: {str(e)}")
    
    def crear_indice_busqueda(self, uuid_padron: str, columnas: List[str]) -> bool:
        """Crea índices para mejorar búsquedas en el padrón"""
        try:
            padron = self.db.query(IdentificadorPadrones).filter(
                IdentificadorPadrones.uuid_padron == uuid_padron
            ).first()
            
            if not padron:
                return False
            
            for columna in columnas:
                # Verificar que la columna existe
                columnas_existentes = self.obtener_columnas_padron(uuid_padron)
                if not any(c.nombre == columna for c in columnas_existentes):
                    continue
                
                # Crear índice si no existe
                index_name = f"idx_{padron.nombre_tabla}_{columna}_busqueda"
                create_index_query = text(f"""
                    CREATE INDEX IF NOT EXISTS {index_name} 
                    ON {padron.nombre_tabla} ({columna})
                """)
                
                self.db.execute(create_index_query)
            
            self.db.commit()
            return True
            
        except Exception as e:
            self.db.rollback()
            raise ValueError(f"Error creando índices: {str(e)}")