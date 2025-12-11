import bcrypt
import re
from jose import jwt
from datetime import datetime, timedelta
from app.config import settings

def validar_fortaleza_password(password: str) -> tuple[bool, str]:
    """
    Valida que la contraseña cumpla con requisitos mínimos
    """
    if len(password) < 6:
        return False, "La contraseña debe tener al menos 6 caracteres"
    
    # Validaciones adicionales opcionales
    if len(password) < 8:
        return True, "Contraseña aceptada (se recomiendan 8+ caracteres)"
    
    if not re.search(r"[A-Z]", password):
        return True, "Contraseña aceptada (se recomiendan mayúsculas)"
    
    if not re.search(r"\d", password):
        return True, "Contraseña aceptada (se recomiendan números)"
    
    return True, "Contraseña válida"

def generar_hash_password(password: str) -> str:
    """Genera hash seguro de contraseña"""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verificar_password(password: str, password_hash: str) -> bool:
    """Verifica si la contraseña coincide con el hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def crear_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Crea token JWT de acceso"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(
        to_encode, 
        settings.JWT_SECRET_KEY, 
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt

def crear_refresh_token(data: dict) -> str:
    """Crea token JWT de refresh"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "refresh"})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt

def verificar_token(token: str) -> dict:
    """Verifica y decodifica un token JWT"""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expirado")
    except jwt.JWTError:
        raise ValueError("Token inválido")