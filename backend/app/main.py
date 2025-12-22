from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
from pathlib import Path
from app.config import settings
from app.database import init_db, engine
from app.middleware.auth_middleware import AuthMiddleware
from app.api import api_router
from fastapi.staticfiles import StaticFiles

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Maneja eventos de inicio y cierre de la aplicación"""
    # Startup
    print(f"Iniciando {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"Conectando a: {settings.DATABASE_URL}")
    
    # Inicializar base de datos
    try:
        init_db()
        print("La base de datos se inició exitosamente")
    except Exception as e:
        print(f"Error inicializando base de datos: {e}")
    
    # Crear directorio de uploads si no existe
    uploads_dir = Path("uploads")
    logos_dir = uploads_dir / "logos"
    logos_dir.mkdir(parents=True, exist_ok=True)
    print(f"Directorio de uploads verificado: {uploads_dir.absolute()}")
    
    yield
    
    # Shutdown
    print("Cerrando aplicación...")
    engine.dispose()
    print("Recursos liberados")

# Crear aplicación FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Combinación de documentos PDF con datos dinámicos",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Agregar middleware de autenticación y logging
app.add_middleware(AuthMiddleware)

# Incluir routers
app.include_router(api_router)

# Directorio estático - servir archivos desde /uploads
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Rutas de salud
@app.get("/")
async def root():
    """Endpoint raíz - Información de la API"""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/api/docs",
        "endpoints": {
            "auth": "/api/auth",
            "proyectos": "/api/proyectos",
            "plantillas": "/api/plantillas",
            "padrones": "/api/padrones",
            "procesamiento": "/api/procesamiento"
        }
    }

@app.get("/health")
async def health_check():
    """Health check para monitoreo"""
    from datetime import datetime
    return {
        "status": "healthy", 
        "timestamp": datetime.utcnow().isoformat()
    }

# Ejecutar servidor
if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info" if settings.DEBUG else "warning"
    )