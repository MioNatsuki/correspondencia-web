from sqlalchemy.orm import Session
from app.models import Usuario
from app.utils.security import (
    verificar_password, crear_access_token, crear_refresh_token
)
from app.utils.logger import log_auditoria
from app.schemas import LoginRequest, Token
from datetime import datetime
import socket

class AuthService:
    def __init__(self, db: Session):
        self.db = db
    
    def autenticar_usuario(self, login_data: LoginRequest, ip_address: str = None, user_agent: str = None) -> Token:
        """
        Autentica un usuario y devuelve tokens JWT
        """
        # Obtener usuario
        usuario = self.db.query(Usuario).filter(Usuario.usuario == login_data.usuario).first()
        
        if not usuario:
            self.registrar_intento_fallido(login_data.usuario, ip_address, user_agent, "Usuario no existe")
            raise ValueError("Credenciales incorrectas")
        
        if not usuario.activo:
            self.registrar_intento_fallido(login_data.usuario, ip_address, user_agent, "Usuario inactivo")
            raise ValueError("Usuario inactivo")
        
        # Verificar contraseña
        if not verificar_password(login_data.contraseña, usuario.contraseña_hash):
            self.registrar_intento_fallido(login_data.usuario, ip_address, user_agent, "Contraseña incorrecta")
            raise ValueError("Credenciales incorrectas")
        
        # Actualizar último login
        usuario.ultimo_login = datetime.utcnow()
        self.db.commit()
        
        # Crear tokens
        token_data = {
            "sub": str(usuario.id),
            "rol": usuario.rol,
            "nombre": usuario.nombre
        }
        
        access_token = crear_access_token(token_data)
        refresh_token = crear_refresh_token(token_data)
        
        # Registrar en bitácora
        log_auditoria(
            db=self.db,
            usuario_id=usuario.id,
            accion="login",
            modulo="auth",
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        # Preparar respuesta de usuario
        usuario_respuesta = {
            "id": usuario.id,
            "nombre": usuario.nombre,
            "usuario": usuario.usuario,
            "rol": usuario.rol,
            "proyecto_permitido": usuario.proyecto_permitido
        }
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            usuario=usuario_respuesta
        )
    
    def registrar_intento_fallido(self, usuario: str, ip_address: str, user_agent: str, motivo: str):
        """Registra intento fallido de login"""
        detalles = {
            "usuario_intento": usuario,
            "motivo": motivo
        }
        
        log_auditoria(
            db=self.db,
            usuario_id=None,
            accion="login_fallido",
            modulo="auth",
            detalles=detalles,
            ip_address=ip_address,
            user_agent=user_agent
        )
    
    def obtener_ip_real(self) -> str:
        """Obtiene la IP real del cliente"""
        try:
            hostname = socket.gethostname()
            local_ip = socket.gethostbyname(hostname)
            return local_ip
        except:
            return "127.0.0.1"
    
    def verificar_permisos_proyecto(self, usuario: Usuario, proyecto_id: int) -> bool:
        """Verifica si usuario tiene acceso al proyecto"""
        if usuario.rol == "superadmin":
            return True
        
        if not usuario.proyecto_permitido:
            return False
        
        proyectos_permitidos = [p.strip() for p in usuario.proyecto_permitido.split(',')]
        return str(proyecto_id) in proyectos_permitidos

    def refrescar_token(self, refresh_token: str) -> Token:
        """Refresca el access token usando refresh token"""
        try:
            from app.utils.security import verificar_token
            
            payload = verificar_token(refresh_token)
            if payload.get("type") != "refresh":
                raise ValueError("Token inválido")
            
            usuario_id = payload.get("sub")
            usuario = self.db.query(Usuario).filter(Usuario.id == usuario_id).first()
            
            if not usuario or not usuario.activo:
                raise ValueError("Usuario no encontrado o inactivo")
            
            # Crear nuevo access token
            token_data = {
                "sub": str(usuario.id),
                "rol": usuario.rol,
                "nombre": usuario.nombre
            }
            
            access_token = crear_access_token(token_data)
            
            return Token(
                access_token=access_token,
                token_type="bearer",
                usuario={
                    "id": usuario.id,
                    "nombre": usuario.nombre,
                    "usuario": usuario.usuario,
                    "rol": usuario.rol,
                    "proyecto_permitido": usuario.proyecto_permitido
                }
            )
            
        except Exception as e:
            raise ValueError(f"Error refrescando token: {str(e)}")