from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, ForeignKey, Numeric, Date
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base
import bcrypt
from datetime import datetime

class Usuario(Base):
    __tablename__ = "usuarios"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    usuario = Column(String(50), unique=True, index=True, nullable=False)
    contraseña_hash = Column(String(255), nullable=False)
    rol = Column(String(20), nullable=False)  # superadmin, admin, lector
    activo = Column(Boolean, default=True)
    proyecto_permitido = Column(String(200))  # IDs separados por coma
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    ultimo_login = Column(DateTime(timezone=True))
    
    # Relaciones
    bitacoras = relationship("Bitacora", back_populates="usuario")
    
    def set_password(self, password: str):
        """Encripta y establece la contraseña"""
        salt = bcrypt.gensalt(rounds=12)
        self.contraseña_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def check_password(self, password: str) -> bool:
        """Verifica si la contraseña coincide"""
        try:
            return bcrypt.checkpw(password.encode('utf-8'), self.contraseña_hash.encode('utf-8'))
        except Exception:
            return False
    
    def __repr__(self):
        return f"<Usuario(id={self.id}, usuario='{self.usuario}', rol='{self.rol}')>"

class Proyecto(Base):
    __tablename__ = "proyectos"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    tabla_padron = Column(String(100))  # UUID del padrón
    logo = Column(String(500))  # Ruta del logo
    activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    config_json = Column(JSON, default={})
    is_deleted = Column(Boolean, default=False)
    
    # Relaciones
    plantillas = relationship("Plantilla", back_populates="proyecto")

class IdentificadorPadrones(Base):
    __tablename__ = "identificador_padrones"
    
    uuid_padron = Column(String(100), primary_key=True, index=True)
    nombre_tabla = Column(String(100), unique=True, nullable=False)
    activo = Column(Boolean, default=True)
    descripcion = Column(Text)
    fecha_registro = Column(DateTime(timezone=True), server_default=func.now())

class Plantilla(Base):
    __tablename__ = "plantillas"
    
    id = Column(Integer, primary_key=True, index=True)
    proyecto_id = Column(Integer, ForeignKey("proyectos.id"), nullable=False)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(Text)
    ruta_archivo = Column(String(500))  # ← NUEVO (nombre real en BD)
    tipo_plantilla = Column(String(100))  # Si existe en BD
    campos_json = Column(JSON)  # Si existe en BD
    activa = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    usuario_creador = Column(Integer, ForeignKey("usuarios.id"))
    is_deleted = Column(Boolean, default=False)
    campos_json_backup = Column(JSON)  # Si existe en BD
    
    # Relaciones
    proyecto = relationship("Proyecto", back_populates="plantillas")
    creador = relationship("Usuario", foreign_keys=[usuario_creador])

class CampoPlantilla(Base):
    __tablename__ = "campos_plantilla"
    
    id = Column(Integer, primary_key=True, index=True)
    plantilla_id = Column(Integer, ForeignKey("plantillas.id"), nullable=False)
    
    # Datos básicos
    nombre = Column(String(100), nullable=False)
    tipo = Column(String(20), nullable=False)  # 'texto', 'campo', 'compuesto', 'tabla'
    
    # Posición y tamaño (EN MILÍMETROS)
    x = Column(Numeric(10, 2), nullable=False)  # mm desde izquierda
    y = Column(Numeric(10, 2), nullable=False)  # mm desde arriba
    ancho = Column(Numeric(10, 2), nullable=False)  # mm
    alto = Column(Numeric(10, 2), nullable=False)  # mm
    
    # Estilo
    alineacion = Column(String(10), default='left')
    fuente = Column(String(50), default='Helvetica')
    tamano_fuente = Column(Integer, default=12)
    color = Column(String(7), default='#000000')
    negrita = Column(Boolean, default=False)
    cursiva = Column(Boolean, default=False)
    
    # Contenido (depende del tipo)
    texto_fijo = Column(Text)
    columna_padron = Column(String(100))
    componentes_json = Column(JSON)  # Para campos compuestos
    tabla_config_json = Column(JSON)  # Para tablas
    
    # Metadata
    orden = Column(Integer, default=0)
    activo = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relación
    plantilla = relationship("Plantilla", backref="campos")

class Bitacora(Base):
    __tablename__ = "bitacora"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    accion = Column(String(50), nullable=False)
    modulo = Column(String(50), nullable=False)
    detalles = Column(JSON)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    fecha_evento = Column(DateTime(timezone=True), server_default=func.now())
    
    usuario = relationship("Usuario", back_populates="bitacoras")

class EmisionTemp(Base):
    __tablename__ = "emisiones_temp"
    
    id = Column(Integer, primary_key=True, index=True)
    proyecto_id = Column(Integer, ForeignKey("proyectos.id"))
    plantilla_id = Column(Integer, ForeignKey("plantillas.id"))
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    datos_json = Column(JSON)
    cuenta = Column(String(50))
    codigo_afiliado = Column(String(50))
    estado = Column(String(20))
    error_mensaje = Column(Text)
    fecha_carga = Column(DateTime(timezone=True), server_default=func.now())
    sesion_id = Column(String(100))

class ConfiguracionSistema(Base):
    __tablename__ = "configuracion_sistema"
    
    id = Column(Integer, primary_key=True, index=True)
    clave = Column(String(50), unique=True, nullable=False)
    valor = Column(Text)
    tipo = Column(String(20))
    descripcion = Column(Text)
    editable = Column(Boolean, default=True)
class MatchExcepciones(Base):
    __tablename__ = "match_excepciones"
    
    id = Column(Integer, primary_key=True, index=True)
    proyecto_id = Column(Integer, ForeignKey("proyectos.id"))
    cuenta_csv = Column(String(100))
    codigo_csv = Column(String(100))
    cuenta_padron = Column(String(100))
    codigo_padron = Column(String(100))
    tipo_match = Column(String(50))
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    fecha_registro = Column(DateTime(timezone=True), server_default=func.now())
    activo = Column(Boolean, default=True)
    
    # Relationships (optional but good for clarity)
    proyecto = relationship("Proyecto")
    usuario = relationship("Usuario")

class EmisionesFinal(Base):
    __tablename__ = "emisiones_final"
    
    id = Column(Integer, primary_key=True, index=True)
    emision_temp_id = Column(Integer)
    proyecto_id = Column(Integer, ForeignKey("proyectos.id"))
    plantilla_id = Column(Integer, ForeignKey("plantillas.id"))
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    datos_completos = Column(JSON)
    archivo_generado = Column(String(500))
    fecha_generacion = Column(DateTime(timezone=True))
    estado_generacion = Column(String(20))
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relaciones
    proyecto = relationship("Proyecto")
    plantilla = relationship("Plantilla")
    usuario = relationship("Usuario")