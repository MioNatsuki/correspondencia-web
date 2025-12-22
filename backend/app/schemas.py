from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

# Enums
class TipoCampo(str, Enum):
    TEXTO = "texto"
    CAMPO = "campo"
    COMPUESTO = "compuesto"
    TABLA = "tabla"

class AlineacionTexto(str, Enum):
    LEFT = "left"
    CENTER = "center"
    RIGHT = "right"
    JUSTIFY = "justify"

class RolUsuario(str, Enum):
    SUPERADMIN = "superadmin"
    ADMIN = "admin"
    LECTOR = "lector"

# Schemas base
class BaseSchema(BaseModel):
    class Config:
        from_attributes = True  # Reemplaza orm_mode en Pydantic v2

# Auth
class Token(BaseSchema):
    access_token: str
    token_type: str
    usuario: Dict[str, Any]

class TokenData(BaseSchema):
    usuario_id: Optional[int] = None
    rol: Optional[str] = None

class LoginRequest(BaseSchema):
    usuario: str
    contraseña: str

# Usuarios
class UsuarioBase(BaseSchema):
    nombre: str
    usuario: str
    rol: RolUsuario
    proyecto_permitido: Optional[str] = None
    activo: bool = True

class UsuarioCreate(UsuarioBase):
    contraseña: str = Field(..., min_length=6)
    
    @validator('contraseña')
    def validar_contraseña_fuerte(cls, v):
        if len(v) < 6:
            raise ValueError('La contraseña debe tener al menos 6 caracteres')
        return v

class UsuarioUpdate(BaseSchema):
    nombre: Optional[str] = None
    usuario: Optional[str] = None
    rol: Optional[RolUsuario] = None
    proyecto_permitido: Optional[str] = None
    activo: Optional[bool] = None

class UsuarioResponse(UsuarioBase):
    id: int
    fecha_creacion: datetime
    ultimo_login: Optional[datetime] = None
    
    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }

# Proyectos
class ProyectoBase(BaseSchema):
    nombre: str
    descripcion: Optional[str] = None
    tabla_padron: str  # UUID del padrón
    logo: Optional[str] = None

class ProyectoCreate(ProyectoBase):
    pass

class ProyectoUpdate(BaseSchema):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    tabla_padron: Optional[str] = None
    logo: Optional[str] = None
    activo: Optional[bool] = None

class ProyectoResponse(ProyectoBase):
    id: int
    activo: bool
    fecha_creacion: datetime
    config_json: Optional[Dict[str, Any]] = None

# Campos de plantilla
class ComponenteCampo(BaseSchema):
    tipo: TipoCampo
    valor: str
    visible: bool = True

class EstiloCampo(BaseSchema):
    fuente: str = "Helvetica"
    tamano: int = Field(12, ge=6, le=72)
    negrita: bool = False
    cursiva: bool = False
    color: str = "#000000"
    alineacion: AlineacionTexto = AlineacionTexto.LEFT

class CampoBase(BaseSchema):
    nombre: str
    tipo: TipoCampo
    x: float = Field(..., ge=0)  # mm
    y: float = Field(..., ge=0)  # mm
    ancho: float = Field(..., gt=0)  # mm
    alto: float = Field(..., gt=0)  # mm
    estilo: EstiloCampo = EstiloCampo()

class CampoTexto(CampoBase):
    tipo: TipoCampo = TipoCampo.TEXTO
    contenido: str = ""  # Texto fijo

class CampoDinamico(CampoBase):
    tipo: TipoCampo = TipoCampo.CAMPO
    columna: str  # Nombre de columna en el padrón

class CampoCompuesto(CampoBase):
    tipo: TipoCampo = TipoCampo.COMPUESTO
    componentes: List[ComponenteCampo] = []

class TablaConfig(BaseSchema):
    columnas: int = Field(..., ge=1, le=10)
    filas: int = Field(..., ge=1, le=50)
    encabezado: bool = True
    borde: bool = True
    celdas: List[List[ComponenteCampo]] = []

class CampoTabla(CampoBase):
    tipo: TipoCampo = TipoCampo.TABLA
    tabla_config: TablaConfig

# Union type para todos los tipos de campo
Campo = CampoTexto | CampoDinamico | CampoCompuesto | CampoTabla

# Plantillas
class PlantillaBase(BaseSchema):
    nombre: str
    descripcion: Optional[str] = None
    pdf_base: Optional[str] = None  # Ruta del PDF

class PlantillaCreate(PlantillaBase):
    proyecto_id: int
    campos: List[Campo] = []

class PlantillaUpdate(BaseSchema):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    pdf_base: Optional[str] = None
    activa: Optional[bool] = None
    campos: Optional[List[Campo]] = None

class PlantillaResponse(PlantillaBase):
    id: int
    proyecto_id: int
    activa: bool
    fecha_creacion: datetime
    usuario_creador_id: Optional[int] = None
    config_json: Optional[Dict[str, Any]] = None
    pdf_base: Optional[str] = None  # ← AGREGAR ESTO
    campos: Optional[List[Campo]] = None  # ← AGREGAR ESTO   
    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }

# Padrones
class ColumnaPadron(BaseSchema):
    nombre: str
    tipo_db: str
    tipo: str  # texto, numero, fecha, booleano
    nullable: bool
    valor_default: Optional[str] = None

class RegistroPadron(BaseSchema):
    datos: Dict[str, Any]

# Procesamiento
class CSVUploadRequest(BaseSchema):
    proyecto_id: int
    plantilla_id: int
    delimiter: str = ","
    encoding: str = "utf-8"

class PDFPreviewRequest(BaseSchema):
    plantilla_id: int
    registro_idx: int = 0

class PDFGenerateRequest(BaseSchema):
    sesion_id: str
    ruta_salida: Optional[str] = None

# Respuestas
class SuccessResponse(BaseSchema):
    success: bool = True
    message: str
    data: Optional[Dict[str, Any]] = None

class ErrorResponse(BaseSchema):
    success: bool = False
    error: str
    details: Optional[Dict[str, Any]] = None