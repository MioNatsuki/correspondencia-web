import { padronesAPI } from '../api/padrones';

// Cache para evitar múltiples llamadas
let padronesCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export const padronHelper = {
  // Obtener todos los padrones (con cache)
  async getPadronesCache() {
    const now = Date.now();
    if (!padronesCache || (now - lastFetchTime) > CACHE_DURATION) {
      try {
        padronesCache = await padronesAPI.getPadrones({ activos: true });
        lastFetchTime = now;
      } catch (error) {
        console.error('Error obteniendo padrones:', error);
        padronesCache = [];
      }
    }
    return padronesCache;
  },
  
  // Obtener nombre del padrón por UUID
  async getNombrePadron(uuid) {
    if (!uuid) return null;
    const padrones = await this.getPadronesCache();
    const padron = padrones.find(p => p.uuid_padron === uuid);
    return padron ? padron.nombre_tabla : null;
  },
  
  // Obtener info completa del padrón por UUID
  async getPadronInfo(uuid) {
    if (!uuid) return null;
    const padrones = await this.getPadronesCache();
    return padrones.find(p => p.uuid_padron === uuid) || null;
  },
  
  // Limpiar cache (útil cuando se crea/actualiza un proyecto)
  clearCache() {
    padronesCache = null;
    lastFetchTime = 0;
  }
};