from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import time
from app.utils.logger import logger

class AuthMiddleware(BaseHTTPMiddleware):
    """Middleware para logging y manejo básico de auth"""
    
    async def dispatch(self, request: Request, call_next):
        # Ignorar rutas públicas
        public_paths = ["/api/auth/login", "/api/docs", "/api/openapi.json"]
        if request.url.path in public_paths:
            return await call_next(request)
        
        # Medir tiempo de respuesta
        start_time = time.time()
        
        try:
            response = await call_next(request)
            
            # Log de la petición
            process_time = (time.time() - start_time) * 1000
            
            logger.info(
                f"API Request: {request.method} {request.url.path} "
                f"Status: {response.status_code} "
                f"Time: {process_time:.2f}ms"
            )
            
            return response
            
        except HTTPException as e:
            # Manejo de errores HTTP
            logger.error(f"HTTP Error {e.status_code}: {e.detail}")
            return JSONResponse(
                status_code=e.status_code,
                content={"error": str(e.detail)}
            )
        except Exception as e:
            # Manejo de errores inesperados
            logger.error(f"Unexpected error: {str(e)}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"error": "Error interno del servidor"}
            )