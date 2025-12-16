from fastapi import APIRouter

# Crear router principal
api_router = APIRouter(prefix="/api")

# Importar y incluir routers de cada módulo
from . import auth, proyectos, plantillas, padrones, procesamiento, usuarios, estadisticas

api_router.include_router(auth.router, tags=["Autenticación"])
api_router.include_router(usuarios.router, tags=["Usuarios"])
api_router.include_router(proyectos.router, tags=["Proyectos"])
api_router.include_router(plantillas.router, tags=["Plantillas"])
api_router.include_router(padrones.router, tags=["Padrones"])
api_router.include_router(procesamiento.router, tags=["Procesamiento"])
api_router.include_router(estadisticas.router, tags=["Estadísticas"])