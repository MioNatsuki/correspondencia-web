from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.dependencies import get_current_user
from app.models import IdentificadorPadrones, Usuario

router = APIRouter(prefix="/padrones", tags=["Padrones"])

@router.get("/")
async def obtener_padrones(
    activos: bool = True,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> List[dict]:
    """
    Obtiene todos los padrones de identificador_padrones
    """
    try:
        query = db.query(IdentificadorPadrones)
        
        if activos:
            query = query.filter(IdentificadorPadrones.activo == True)
        
        padrones = query.order_by(IdentificadorPadrones.nombre_tabla).all()
        
        return [
            {
                "uuid_padron": padron.uuid_padron,
                "nombre_tabla": padron.nombre_tabla,
                "descripcion": padron.descripcion,
                "activo": padron.activo
            }
            for padron in padrones
        ]
        
    except Exception as e:
        print(f"Error obteniendo padrones: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo padrones: {str(e)}"
        )

@router.get("/{uuid_padron}")
async def obtener_padron(
    uuid_padron: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
) -> dict:
    """
    Obtiene un padrón específico por UUID
    """
    try:
        padron = db.query(IdentificadorPadrones).filter(
            IdentificadorPadrones.uuid_padron == uuid_padron
        ).first()
        
        if not padron:
            raise HTTPException(
                status_code=404,
                detail=f"Padrón con UUID {uuid_padron} no encontrado"
            )
        
        return {
            "uuid_padron": padron.uuid_padron,
            "nombre_tabla": padron.nombre_tabla,
            "descripcion": padron.descripcion,
            "activo": padron.activo
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo padrón: {str(e)}"
        )