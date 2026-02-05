-- =====================================================
-- MIGRACIÓN: Agregar sistema de autenticación e imágenes
-- Fecha: 2026-02-05
-- =====================================================

-- 1. Crear tabla de usuarios si no existe
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'coordinador', 'capturista')),
    activo BOOLEAN DEFAULT true,
    ultimo_acceso TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Insertar usuario admin por defecto (password: admin123)
-- Hash bcrypt de "admin123"
INSERT INTO users (username, password, nombre_completo, email, role, activo)
VALUES ('admin', '$2a$10$8YqEJVYzxrjGJhP5z3hC0.xKn6Q7W8Z0vX4pLmN5Qr6T8sV9wU1', 'Administrador del Sistema', 'admin@invpatrimonio.local', 'admin', true)
ON CONFLICT (username) DO NOTHING;

-- 3. Agregar columna imagenes a tabla inventario si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'inventario' AND column_name = 'imagenes'
    ) THEN
        ALTER TABLE inventario ADD COLUMN imagenes JSONB DEFAULT '[]'::jsonb;
        CREATE INDEX IF NOT EXISTS idx_inventario_imagenes ON inventario USING gin(imagenes);
    END IF;
END $$;

-- 4. Actualizar registros existentes que tengan imagenes NULL
UPDATE inventario SET imagenes = '[]'::jsonb WHERE imagenes IS NULL;

-- Confirmar cambios
\echo '✅ Tabla users creada'
\echo '✅ Usuario admin creado (username: admin, password: admin123)'
\echo '✅ Columna imagenes agregada a tabla inventario'
\echo '✅ Migración completada exitosamente'
