from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    """Configuración de la aplicación desde variables de entorno"""
    
    # Base de datos
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    
    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Aplicación
    APP_NAME: str = "Correspondencia Web"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    
    # Archivos
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS_PDF: str = ".pdf,.PDF"
    ALLOWED_EXTENSIONS_IMAGE: str = ".png,.jpg,.jpeg,.gif"
    
    # Servidor
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    BASE_URL: str = f"http://{HOST}:{PORT}"
    
    @property
    def ALLOWED_ORIGINS_LIST(self) -> List[str]:
        """Convierte los orígenes permitidos a lista"""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]
    
    @property
    def ALLOWED_PDF_EXTENSIONS(self) -> List[str]:
        """Extensiones permitidas para PDFs"""
        return [ext.strip() for ext in self.ALLOWED_EXTENSIONS_PDF.split(",")]
    
    @property
    def ALLOWED_IMAGE_EXTENSIONS(self) -> List[str]:
        """Extensiones permitidas para imágenes"""
        return [ext.strip() for ext in self.ALLOWED_EXTENSIONS_IMAGE.split(",")]
    
    @property
    def UPLOAD_URL(self) -> str:
        """URL base para archivos subidos"""
        return f"{self.BASE_URL}/uploads"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Instancia global de configuración
settings = Settings()

# Crear directorio de uploads si no existe
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "pdfs"), exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "previews"), exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "generados"), exist_ok=True)