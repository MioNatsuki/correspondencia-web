# backend/app/api/padrones.py - CONTENIDO COMPLETO
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from sqlalchemy import text
from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import Usuario, IdentificadorPadrones, Proyecto
from app.schemas import (
    ColumnaPadron, RegistroPadron, SuccessResponse, ErrorResponse
)
from typing import Dict

router = APIRouter(prefix="/padrones", tags=["Padrones"])

# ========== LISTAR PADRONES ==========
@router.get("/")
async def listar_padrones(
    activos: bool = True,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> List[Dict]:
    """
    Lista todos los padrones disponibles
    """
    try:
        query = db.query(IdentificadorPadrones)
        
        if activos:
            query = query.filter(IdentificadorPadrones.activo == True)
        
        padrones = query.offset(skip).limit(limit).all()
        
        resultado = []
        for padron in padrones:
            # Obtener proyectos que usan este padrón
            proyectos = db.query(Proyecto).filter(
                Proyecto.tabla_padron == padron.uuid_padron
            ).count()
            
            resultado.append({
                "uuid": padron.uuid_padron,
                "nombre_tabla": padron.nombre_tabla,
                "descripcion": padron.descripcion,
                "activo": padron.activo,
                "fecha_registro": padron.fecha_registro,
                "proyectos_usando": proyectos
            })
        
        return resultado
        
    except Exception as e:
        raise HTTPException(500, f"Error listando padrones: {str(e)}")

# ========== OBTENER COLUMNAS ==========
@router.get("/{uuid_padron}/columnas")
async def obtener_columnas_padron(
    uuid_padron: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> List[ColumnaPadron]:
    """
    Obtiene las columnas REALES de una tabla de padrón
    """
    try:
        # 1. Verificar que el padrón existe
        padron = db.query(IdentificadorPadrones).filter(
            IdentificadorPadrones.uuid_padron == uuid_padron
        ).first()
        
        if not padron:
            raise HTTPException(404, f"Padrón {uuid_padron} no encontrado")
        
        # 2. Consultar información de columnas REALES
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
        
        result = db.execute(query, {"table_name": padron.nombre_tabla})
        columnas = []
        
        for row in result:
            # Determinar tipo amigable
            tipo_db = row.tipo_db.lower()
            
            if 'char' in tipo_db or 'text' in tipo_db:
                tipo_amigable = 'texto'
            elif 'int' in tipo_db or 'numeric' in tipo_db or 'decimal' in tipo_db:
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
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo columnas: {str(e)}")

# ========== OBTENER DATOS EJEMPLO ==========
@router.get("/{uuid_padron}/datos-ejemplo")
async def obtener_datos_ejemplo(
    uuid_padron: str,
    limit: int = Query(5, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> List[RegistroPadron]:
    """
    Obtiene datos de ejemplo del padrón (para preview en editor)
    """
    try:
        padron = db.query(IdentificadorPadrones).filter(
            IdentificadorPadrones.uuid_padron == uuid_padron
        ).first()
        
        if not padron:
            raise HTTPException(404, f"Padrón {uuid_padron} no encontrado")
        
        # Consultar datos reales
        query = text(f"SELECT * FROM {padron.nombre_tabla} LIMIT :limit")
        result = db.execute(query, {"limit": limit})
        
        registros = []
        for row in result:
            registros.append(RegistroPadron(datos=dict(row._mapping)))
        
        return registros
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo datos: {str(e)}")

# ========== BUSCAR EN PADRÓN ==========
@router.get("/{uuid_padron}/buscar")
async def buscar_en_padron(
    uuid_padron: str,
    columna: str,
    valor: str,
    exacto: bool = True,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> List[RegistroPadron]:
    """
    Busca registros en el padrón por columna y valor
    """
    try:
        padron = db.query(IdentificadorPadrones).filter(
            IdentificadorPadrones.uuid_padron == uuid_padron
        ).first()
        
        if not padron:
            raise HTTPException(404, "Padrón no encontrado")
        
        # Verificar que la columna existe
        columnas = await obtener_columnas_padron(uuid_padron, db, current_user)
        columnas_nombres = [c.nombre for c in columnas]
        
        if columna not in columnas_nombres:
            raise HTTPException(400, f"Columna '{columna}' no existe en el padrón")
        
        # Construir query según tipo de búsqueda
        if exacto:
            query = text(f"""
                SELECT * FROM {padron.nombre_tabla} 
                WHERE {columna} = :valor 
                LIMIT :limit
            """)
        else:
            query = text(f"""
                SELECT * FROM {padron.nombre_tabla} 
                WHERE {columna} ILIKE :valor 
                LIMIT :limit
            """)
            valor = f"%{valor}%"
        
        result = db.execute(query, {"valor": valor, "limit": limit})
        
        registros = []
        for row in result:
            registros.append(RegistroPadron(datos=dict(row._mapping)))
        
        return registros
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error buscando en padrón: {str(e)}")