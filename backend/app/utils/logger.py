import logging
import sys
from datetime import datetime
import os

def setup_logger():
    """Configura el logger de la aplicación"""
    
    # Crear directorio de logs si no existe
    log_dir = "logs"
    os.makedirs(log_dir, exist_ok=True)
    
    # Nombre del archivo con fecha
    log_file = os.path.join(log_dir, f"correspondencia_{datetime.now().strftime('%Y%m')}.log")
    
    # Configurar logger
    logger = logging.getLogger("correspondencia")
    logger.setLevel(logging.INFO)
    
    # Formato
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Handler para archivo
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)
    
    # Handler para consola
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)
    
    # Agregar handlers
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger

# Logger global
logger = setup_logger()

def log_auditoria(db, usuario_id, accion, modulo, detalles=None, ip_address=None, user_agent=None):
    """Registra evento en la bitácora (similar a tu función original)"""
    try:
        from app.models import Bitacora
        registro = Bitacora(
            usuario_id=usuario_id,
            accion=accion,
            modulo=modulo,
            detalles=detalles,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(registro)
        db.commit()
        
        logger.info(f"AUDITORIA - {modulo}.{accion} - Usuario: {usuario_id}")
        
    except Exception as e:
        logger.error(f"Error en auditoría: {e}")
        db.rollback()