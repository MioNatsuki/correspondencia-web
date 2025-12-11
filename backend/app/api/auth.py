from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import LoginRequest, Token, SuccessResponse, ErrorResponse
from app.core.auth_service import AuthService
from app.dependencies import get_current_user
from app.models import Usuario

router = APIRouter(prefix="/auth", tags=["Autenticación"])

@router.post("/login", response_model=Token)
async def login(
    request: LoginRequest,
    db: Session = Depends(get_db),
    http_request: Request = None
):
    """
    Autentica un usuario y devuelve tokens JWT
    """
    auth_service = AuthService(db)
    
    # Obtener IP y User-Agent
    ip_address = http_request.client.host if http_request else None
    user_agent = http_request.headers.get("user-agent") if http_request else None
    
    try:
        token = auth_service.autenticar_usuario(
            request, 
            ip_address=ip_address, 
            user_agent=user_agent
        )
        return token
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en autenticación: {str(e)}"
        )

@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_token: str,
    db: Session = Depends(get_db)
):
    """
    Refresca el token de acceso usando refresh token
    """
    auth_service = AuthService(db)
    
    try:
        token = auth_service.refrescar_token(refresh_token)
        return token
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )

@router.post("/logout")
async def logout(
    current_user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cierra sesión del usuario (registra en bitácora)
    """
    from app.utils.logger import log_auditoria
    
    log_auditoria(
        db=db,
        usuario_id=current_user.id,
        accion="logout",
        modulo="auth"
    )
    
    return SuccessResponse(message="Sesión cerrada exitosamente")

@router.get("/me")
async def obtener_usuario_actual(
    current_user: Usuario = Depends(get_current_user)
):
    """
    Obtiene información del usuario actual
    """
    return {
        "id": current_user.id,
        "nombre": current_user.nombre,
        "usuario": current_user.usuario,
        "rol": current_user.rol,
        "proyecto_permitido": current_user.proyecto_permitido,
        "activo": current_user.activo,
        "ultimo_login": current_user.ultimo_login
    }

@router.post("/verificar-token")
async def verificar_token(
    current_user: Usuario = Depends(get_current_user)
):
    """
    Verifica si el token JWT es válido
    """
    return SuccessResponse(message="Token válido")