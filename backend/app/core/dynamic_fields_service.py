"""
Servicio para manejo de campos dinámicos: codebar, visita, PMO, etc.
"""
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
from sqlalchemy.orm import Session
import uuid
import re

from app.models import HistoricoContadores, EmisionesAcumuladas
from app.utils.logger import logger

class DynamicFieldsService:
    
    def __init__(self, db: Session):
        self.db = db
    
    async def calcular_codebar(self, registro: Dict, config: Dict) -> str:
        """Genera código de barras: *{cuenta}{fecha}{visita}*"""
        try:
            cuenta = registro.get('cuenta') or registro.get('CUENTA') or ''
            fecha_emision = registro.get('fecha_emision') or datetime.now()
            
            if isinstance(fecha_emision, str):
                fecha_str = fecha_emision.replace('-', '').replace('/', '')
                if len(fecha_str) > 8:
                    fecha_str = fecha_str[:8]
            else:
                fecha_str = fecha_emision.strftime('%Y%m%d')
            
            visita = registro.get('visita_actual') or registro.get('visita_sugerida') or 'N1'
            
            # Formato por defecto
            codebar = f"*{cuenta}{fecha_str}{visita}*"
            
            # Aplicar formato personalizado si se especifica
            formato = config.get('formato', '*{cuenta}{fecha}{visita}*')
            if '{' in formato:
                try:
                    codebar = formato.format(
                        cuenta=cuenta,
                        fecha=fecha_str,
                        visita=visita,
                        pmo=registro.get('pmo_actual', 1),
                        codigo=registro.get('codigo_afiliado') or registro.get('CODIGO_AFILIADO', '')
                    )
                except:
                    # Si falla el formato, usar el por defecto
                    pass
            
            return codebar
            
        except Exception as e:
            logger.error(f"Error calculando codebar: {str(e)}")
            return f"*ERROR_{uuid.uuid4().hex[:8]}*"
    
    async def calcular_siguiente_visita(
        self, 
        cuenta: str, 
        proyecto_id: int, 
        tipo_documento: str = None
    ) -> Tuple[str, Optional[str]]:
        """
        Calcula siguiente visita basado en histórico
        Returns: (siguiente_visita, ultima_visita)
        """
        try:
            # Determinar abreviatura del tipo de documento
            if not tipo_documento:
                tipo_documento = 'Notificación'
            
            abreviaciones = {
                'Notificación': 'N',
                'Apercibimiento': 'A', 
                'Embargo': 'E',
                'Carta Invitación': 'CI',
                'Carta': 'C',
                'Aviso': 'AV'
            }
            
            # Buscar la abreviatura correcta
            abrev = None
            for key, value in abreviaciones.items():
                if key in tipo_documento:
                    abrev = value
                    break
            
            if not abrev:
                # Si no encuentra, usar primera letra
                abrev = tipo_documento[0].upper()
            
            # Obtener última visita del histórico
            ultima = self.db.query(HistoricoContadores).filter(
                HistoricoContadores.proyecto_id == proyecto_id,
                HistoricoContadores.cuenta == cuenta,
                HistoricoContadores.tipo == 'visita'
            ).order_by(HistoricoContadores.fecha_cambio.desc()).first()
            
            if ultima and ultima.valor_nuevo:
                # Extraer número de la última visita
                import re
                match = re.search(r'(\d+)', ultima.valor_nuevo)
                if match:
                    numero = int(match.group(1))
                    # Verificar que la abreviatura coincida
                    if ultima.valor_nuevo.startswith(abrev):
                        siguiente = f"{abrev}{numero + 1}"
                    else:
                        # Cambio de tipo de documento, reiniciar
                        siguiente = f"{abrev}1"
                else:
                    siguiente = f"{abrev}1"
            else:
                # Primera visita
                siguiente = f"{abrev}1"
                ultima = None
            
            return siguiente, ultima.valor_nuevo if ultima else None
            
        except Exception as e:
            logger.error(f"Error calculando siguiente visita: {str(e)}")
            return f"{abrev}1", None
    
    async def calcular_siguiente_pmo(
        self, 
        cuenta: str, 
        proyecto_id: int
    ) -> Tuple[int, Optional[int]]:
        """Calcula siguiente PMO basado en histórico"""
        try:
            # Buscar último PMO en histórico
            ultimo = self.db.query(HistoricoContadores).filter(
                HistoricoContadores.proyecto_id == proyecto_id,
                HistoricoContadores.cuenta == cuenta,
                HistoricoContadores.tipo == 'pmo'
            ).order_by(HistoricoContadores.fecha_cambio.desc()).first()
            
            if ultimo and ultimo.valor_nuevo:
                try:
                    ultimo_pmo = int(ultimo.valor_nuevo)
                    siguiente = ultimo_pmo + 1
                except (ValueError, TypeError):
                    siguiente = 1
                valor_anterior = ultimo.valor_nuevo
            else:
                siguiente = 1
                valor_anterior = None
            
            return siguiente, valor_anterior
            
        except Exception as e:
            logger.error(f"Error calculando siguiente PMO: {str(e)}")
            return 1, None
    
    async def aplicar_campos_dinamicos(
        self,
        registro: Dict,
        proyecto_id: int,
        plantilla_id: int,
        usuario_id: int
    ) -> Dict:
        """
        Aplica todos los campos dinámicos a un registro
        """
        from app.models import ConfiguracionCamposDinamicos
        
        # Obtener configuración de campos dinámicos
        configs = self.db.query(ConfiguracionCamposDinamicos).filter(
            ConfiguracionCamposDinamicos.activo == True
        ).filter(
            (ConfiguracionCamposDinamicos.proyecto_id == proyecto_id) |
            (ConfiguracionCamposDinamicos.plantilla_id == plantilla_id)
        ).all()
        
        resultado = registro.copy()
        campos_dinamicos = {}
        
        for config in configs:
            if config.tipo == 'codebar':
                codebar = await self.calcular_codebar(registro, config.configuracion)
                campos_dinamicos['codebar'] = codebar
                resultado['codebar_generado'] = codebar
                
            elif config.tipo == 'visita':
                tipo_doc = registro.get('tipo_documento', 'Notificación')
                siguiente_visita, ultima = await self.calcular_siguiente_visita(
                    registro.get('cuenta') or registro.get('CUENTA', ''),
                    proyecto_id,
                    tipo_doc
                )
                campos_dinamicos['visita_sugerida'] = siguiente_visita
                campos_dinamicos['visita_anterior'] = ultima
                resultado['visita_actual'] = siguiente_visita
                
            elif config.tipo == 'pmo':
                siguiente_pmo, ultimo = await self.calcular_siguiente_pmo(
                    registro.get('cuenta') or registro.get('CUENTA', ''),
                    proyecto_id
                )
                campos_dinamicos['pmo_sugerido'] = siguiente_pmo
                campos_dinamicos['pmo_anterior'] = ultimo
                resultado['pmo_actual'] = siguiente_pmo
                
            elif config.tipo == 'documento':
                # Mantener tipo de documento si ya existe
                if 'tipo_documento' not in resultado:
                    resultado['tipo_documento'] = 'Notificación'
                    
            elif config.tipo == 'fecha':
                # Fecha de emisión (por defecto hoy, pero editable)
                if 'fecha_emision' not in resultado:
                    resultado['fecha_emision'] = datetime.now().isoformat()
        
        resultado['campos_dinamicos'] = campos_dinamicos
        return resultado
    
    async def registrar_cambio_contador(
        self,
        proyecto_id: int,
        cuenta: str,
        tipo: str,
        valor_anterior: str,
        valor_nuevo: str,
        usuario_id: int,
        emision_id: int = None
    ):
        """Registra cambio de contador (visita/PMO) en histórico"""
        try:
            historico = HistoricoContadores(
                proyecto_id=proyecto_id,
                cuenta=cuenta,
                tipo=tipo,
                valor_anterior=valor_anterior,
                valor_nuevo=valor_nuevo,
                usuario_id=usuario_id,
                emision_id=emision_id,
                fecha_cambio=datetime.utcnow()
            )
            
            self.db.add(historico)
            self.db.commit()
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error registrando cambio de contador: {str(e)}")
            raise