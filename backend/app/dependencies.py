from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Usuario
from app.config import settings
from app.schemas import TokenData
from typing import List

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Usuario:
    """Obtiene el usuario actual a partir del token JWT"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        usuario_id: int = payload.get("sub")
        if usuario_id is None:
            raise credentials_exception
        
        token_data = TokenData(
            usuario_id=usuario_id,
            rol=payload.get("rol")
        )
    except JWTError:
        raise credentials_exception
    
    usuario = db.query(Usuario).filter(Usuario.id == token_data.usuario_id).first()
    if usuario is None or not usuario.activo:
        raise credentials_exception
    
    return usuario

def get_current_active_user(
    current_user: Usuario = Depends(get_current_user)
) -> Usuario:
    """Verifica que el usuario esté activo"""
    if not current_user.activo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario inactivo"
        )
    return current_user

def require_role(required_role: str):
    """Decorator para verificar rol del usuario"""
    def role_checker(current_user: Usuario = Depends(get_current_active_user)):
        if current_user.rol != required_role and current_user.rol != "superadmin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Se requiere rol {required_role}"
            )
        return current_user
    return role_checker

def require_admin(
    current_user: Usuario = Depends(get_current_active_user)
) -> Usuario:
    """Verifica que el usuario sea admin o superadmin"""
    if current_user.rol not in ["admin", "superadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de administrador"
        )
    return current_user

def verificar_permisos_proyecto(usuario: Usuario, proyecto_id: int, roles_permitidos: List[str] = None):
    """Verifica si usuario tiene acceso a proyecto con roles específicos"""
    from app.models import UsuarioProyecto
    
    # Superadmin tiene acceso completo
    if usuario.rol == "superadmin":
        return True
    
    # Buscar asignación específica
    asignacion = UsuarioProyecto.query.filter(
        UsuarioProyecto.usuario_id == usuario.id,
        UsuarioProyecto.proyecto_id == proyecto_id,
        UsuarioProyecto.activo == True
    ).first()
    
    if not asignacion:
        raise HTTPException(
            status_code=403,
            detail="No tiene acceso a este proyecto"
        )
    
    # Verificar roles si se especifican
    if roles_permitidos and asignacion.rol not in roles_permitidos:
        raise HTTPException(
            status_code=403,
            detail=f"Se requiere uno de estos roles: {', '.join(roles_permitidos)}"
        )
    
    return asignacion.rol

def require_project_access(roles_permitidos: List[str] = None):
    def decorator(current_user: Usuario = Depends(get_current_active_user)):
        def inner(proyecto_id: int):
            verificar_permisos_proyecto(current_user, proyecto_id, roles_permitidos)
            return current_user
        return inner
    return decorator