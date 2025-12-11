#!/usr/bin/env python3
"""
Script para inicializar la base de datos
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.database import init_db, SessionLocal
from app.models import Usuario, IdentificadorPadrones
from app.utils.security import generar_hash_password

def crear_superadmin():
    """Crea usuario superadmin por defecto si no existe"""
    db = SessionLocal()
    try:
        # Verificar si ya existe
        superadmin = db.query(Usuario).filter(Usuario.usuario == "superadmin").first()
        
        if not superadmin:
            superadmin = Usuario(
                nombre="Administrador Principal",
                usuario="superadmin",
                rol="superadmin",
                activo=True,
                proyecto_permitido="*"
            )
            superadmin.set_password("admin123")
            
            db.add(superadmin)
            db.commit()
            print("Usuario superadmin creado")
            print("Usuario: superadmin")
            print("Contraseña: admin123")
            print("Cambia la contraseña después del primer login!")
        else:
            print("Usuario superadmin ya existe")
            
    except Exception as e:
        print(f"Error creando superadmin: {e}")
        db.rollback()
    finally:
        db.close()

def crear_padron_ejemplo():
    """Crea un padrón de ejemplo para pruebas"""
    db = SessionLocal()
    try:
        # Verificar si ya existe padrón de ejemplo
        padron = db.query(IdentificadorPadrones).filter(
            IdentificadorPadrones.nombre_tabla == "padron_completo_ejemplo"
        ).first()
        
        if not padron:
            # Crear tabla en la base de datos (ejemplo simple)
            from sqlalchemy import text
            
            # Crear tabla de ejemplo si no existe
            create_table_sql = """
            CREATE TABLE IF NOT EXISTS padron_completo_ejemplo (
                id SERIAL PRIMARY KEY,
                cuenta VARCHAR(50) UNIQUE NOT NULL,
                codigo_afiliado VARCHAR(50),
                nombre_completo VARCHAR(200),
                direccion TEXT,
                telefono VARCHAR(20),
                email VARCHAR(100),
                fecha_nacimiento DATE,
                monto_pension DECIMAL(10,2),
                fecha_ingreso DATE,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
            
            # Insertar datos de ejemplo
            insert_data_sql = """
            INSERT INTO padron_completo_ejemplo 
            (cuenta, codigo_afiliado, nombre_completo, direccion, telefono, email, fecha_nacimiento, monto_pension, fecha_ingreso)
            VALUES 
            ('100001', 'AF001', 'JUAN PÉREZ GONZÁLEZ', 'AV. PRINCIPAL 123, COL. CENTRO', '555-123-4567', 'juan@ejemplo.com', '1975-03-15', 2500.00, '2010-01-15'),
            ('100002', 'AF002', 'MARÍA LÓPEZ SÁNCHEZ', 'CALLE SECUNDARIA 456, COL. NORTE', '555-987-6543', 'maria@ejemplo.com', '1980-07-22', 2800.50, '2012-05-20'),
            ('100003', 'AF003', 'CARLOS RAMÍREZ MARTÍNEZ', 'PRIVADA 789, COL. SUR', '555-456-7890', 'carlos@ejemplo.com', '1978-11-30', 2200.00, '2015-08-10')
            ON CONFLICT (cuenta) DO NOTHING;
            """
            
            # Ejecutar SQL
            db.execute(text(create_table_sql))
            db.execute(text(insert_data_sql))
            db.commit()
            
            # Registrar el padrón
            import uuid
            padron = IdentificadorPadrones(
                uuid_padron=str(uuid.uuid4()),
                nombre_tabla="padron_completo_ejemplo",
                descripcion="Padrón de ejemplo para pruebas del sistema",
                activo=True
            )
            
            db.add(padron)
            db.commit()
            print("Padrón de ejemplo creado")
            print(f"UUID: {padron.uuid_padron}")
            print(f"Tabla: {padron.nombre_tabla}")
            
    except Exception as e:
        print(f"Error creando padrón de ejemplo: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Inicializando base de datos...")
    
    try:
        # Crear tablas
        init_db()
        
        # Crear superadmin
        crear_superadmin()
        
        # Crear padrón de ejemplo
        crear_padron_ejemplo()
        
        print("\nInicialización completada exitosamente!")
        print("\nPara iniciar el servidor:")
        print("cd backend")
        print("uvicorn app.main:app --reload")
        print("\nAccede a:")
        print("API: http://localhost:8000")
        print("Docs: http://localhost:8000/api/docs")
        
    except Exception as e:
        print(f"\nError en inicialización: {e}")
        sys.exit(1)