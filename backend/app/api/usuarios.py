from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import Usuario
from app.schemas import UsuarioCreate, UsuarioUpdate, UsuarioResponse, SuccessResponse
from app.utils.security import generar_hash_password

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])

@router.get("/", response_model=List[UsuarioResponse])
async def listar_usuarios(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    activos: bool = True,
    rol: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """Lista usuarios (solo admin/superadmin)"""
    try:
        query = db.query(Usuario)
        
        if activos:
            query = query.filter(Usuario.activo == True)
        
        if rol:
            query = query.filter(Usuario.rol == rol)
        
        usuarios = query.offset(skip).limit(limit).all()
        return usuarios
        
    except Exception as e:
        raise HTTPException(500, f"Error listando usuarios: {str(e)}")

@router.get("/{usuario_id}", response_model=UsuarioResponse)
async def obtener_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Obtiene un usuario específico"""
    try:
        # Superadmin puede ver todos, otros solo a sí mismos
        if current_user.rol != "superadmin" and current_user.id != usuario_id:
            raise HTTPException(403, "Solo puedes ver tu propio perfil")
        
        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
        
        if not usuario:
            raise HTTPException(404, "Usuario no encontrado")
        
        return usuario
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error obteniendo usuario: {str(e)}")

@router.post("/", response_model=UsuarioResponse)
async def crear_usuario(
    usuario_data: UsuarioCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """Crea un nuevo usuario (solo admin/superadmin)"""
    try:
        # Verificar que no exista usuario con mismo nombre
        existente = db.query(Usuario).filter(Usuario.usuario == usuario_data.usuario).first()
        if existente:
            raise HTTPException(400, "Nombre de usuario ya existe")
        
        # Crear usuario
        usuario = Usuario(
            nombre=usuario_data.nombre,
            usuario=usuario_data.usuario,
            rol=usuario_data.rol,
            proyecto_permitido=usuario_data.proyecto_permitido,
            activo=usuario_data.activo
        )
        
        usuario.set_password(usuario_data.contraseña)
        
        db.add(usuario)
        db.commit()
        db.refresh(usuario)
        
        return usuario
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Error creando usuario: {str(e)}")

@router.put("/{usuario_id}", response_model=UsuarioResponse)
async def actualizar_usuario(
    usuario_id: int,
    usuario_data: UsuarioUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """Actualiza un usuario (solo admin/superadmin)"""
    try:
        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
        
        if not usuario:
            raise HTTPException(404, "Usuario no encontrado")
        
        # Actualizar campos
        update_data = usuario_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None and hasattr(usuario, field):
                setattr(usuario, field, value)
        
        db.commit()
        db.refresh(usuario)
        
        return usuario
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Error actualizando usuario: {str(e)}")

@router.delete("/{usuario_id}")
async def eliminar_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin)
):
    """Desactiva un usuario (solo admin/superadmin)"""
    try:
        # No permitir eliminar superadmin (excepto si es el mismo superadmin)
        if current_user.rol != "superadmin" and current_user.id != usuario_id:
            raise HTTPException(403, "Solo superadmin puede eliminar otros usuarios")
        
        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
        
        if not usuario:
            raise HTTPException(404, "Usuario no encontrado")
        
        if usuario.rol == "superadmin" and current_user.id != usuario_id:
            raise HTTPException(403, "No puedes eliminar otro superadmin")
        
        # Soft delete (desactivar)
        usuario.activo = False
        db.commit()
        
        return SuccessResponse(message="Usuario desactivado exitosamente")
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Error eliminando usuario: {str(e)}")

@router.post("/{usuario_id}/cambiar-password")
async def cambiar_password(
    usuario_id: int,
    nueva_password: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Cambia contraseña de usuario"""
    try:
        # Solo el propio usuario o superadmin puede cambiar contraseña
        if current_user.rol != "superadmin" and current_user.id != usuario_id:
            raise HTTPException(403, "Solo puedes cambiar tu propia contraseña")
        
        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
        
        if not usuario:
            raise HTTPException(404, "Usuario no encontrado")
        
        usuario.set_password(nueva_password)
        db.commit()
        
        return SuccessResponse(message="Contraseña cambiada exitosamente")
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Error cambiando contraseña: {str(e)}")