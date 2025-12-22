// frontend/src/utils/constants.js
export const API_BASE_URL = 'http://localhost:8000/api';
export const UPLOADS_BASE_URL = 'http://localhost:8000/uploads';

// Tamaños de página (en mm)
export const PAGE_SIZES = {
    CARTA: {
        name: 'Carta',
        width: 215.9,  // mm
        height: 279.4, // mm
        description: 'Tamaño carta estándar'
    },
    OFICIO_MEXICO: {
        name: 'Oficio México',
        width: 215.9,  // mm
        height: 340.1, // mm
        description: 'Tamaño oficio utilizado en México'
    }
};

// Roles de usuario
export const USER_ROLES = {
    SUPERADMIN: 'superadmin',
    ADMIN: 'admin',
    USER: 'user',
    LECTOR: 'lector'
};

// Estados de procesamiento
export const PROCESS_STATUS = {
    PENDING: 'pendiente',
    PROCESSING: 'procesando',
    COMPLETED: 'completado',
    ERROR: 'error',
    CANCELLED: 'cancelado'
};

// Tipos de campos en plantillas
export const FIELD_TYPES = {
    TEXT: 'texto',
    FIELD: 'campo',
    COMPOUND: 'compuesto',
    TABLE: 'tabla'
};

// Alineaciones de texto
export const TEXT_ALIGN = {
    LEFT: 'left',
    CENTER: 'center',
    RIGHT: 'right',
    JUSTIFY: 'justify'
};

// Fuentes disponibles
export const AVAILABLE_FONTS = [
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Courier New',
    'Verdana',
    'Tahoma',
    'Georgia',
    'Palatino',
    'Garamond',
    'Bookman'
];

// Colores predefinidos
export const COLORS = [
    '#000000', // Negro
    '#FFFFFF', // Blanco
    '#FF0000', // Rojo
    '#00FF00', // Verde
    '#0000FF', // Azul
    '#FFFF00', // Amarillo
    '#FF00FF', // Magenta
    '#00FFFF', // Cian
    '#FFA500', // Naranja
    '#800080', // Púrpura
    '#808080', // Gris
    '#A52A2A', // Marrón
    '#008000', // Verde oscuro
    '#000080', // Azul marino
    '#800000', // Rojo oscuro
];

// Tamaños de fuente
export const FONT_SIZES = [
    8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72
];

export default {
    API_BASE_URL,
    UPLOADS_BASE_URL,
    PAGE_SIZES,
    USER_ROLES,
    PROCESS_STATUS,
    FIELD_TYPES,
    TEXT_ALIGN,
    AVAILABLE_FONTS,
    COLORS,
    FONT_SIZES
};