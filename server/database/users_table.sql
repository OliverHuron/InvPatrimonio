-- Crear tabla de usuarios para sistema de autenticación
-- InvPatrimonio - Sistema Integral de Administración Facultaria

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
    department VARCHAR(100),
    position VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para optimizar consultas
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insertar usuario administrador por defecto
-- Password: admin123 (debe cambiarse en producción)
INSERT INTO users (username, email, password_hash, full_name, role, department, position) 
VALUES (
    'admin',
    'admin@siaf.edu',
    '$2b$10$mMKjRtI9UJBJjkEGlNYQWumhGQrJM2M2gVEjZGXGMz2WJrNjC0lDq',
    'Administrador SIAF',
    'admin',
    'Infraestructura Informática',
    'Administrador del Sistema'
) ON CONFLICT (username) DO NOTHING;

-- Comentarios para documentación
COMMENT ON TABLE users IS 'Tabla de usuarios del sistema SIAF InvPatrimonio';
COMMENT ON COLUMN users.role IS 'Roles: admin, user, viewer';
COMMENT ON COLUMN users.password_hash IS 'Hash BCrypt de la contraseña';
COMMENT ON COLUMN users.is_active IS 'Estado activo del usuario';