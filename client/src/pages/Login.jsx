import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';
import logoUmsnh from '../assets/UMSNHLogo1.png';

const CAMPUS_IMAGES = [
  '/images/campus-background.jpg',
  '/images/campus-2.jpg',
  '/images/campus-3.jpg',
  '/images/campus-4.jpg',
];

const ImageSlideshow = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % CAMPUS_IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {CAMPUS_IMAGES.map((src, index) => (
        <div
          key={src}
          className="slideshow-slide"
          style={{
            backgroundImage: `url('${src}')`,
            opacity: index === currentIndex ? 1 : 0,
          }}
        />
      ))}
    </>
  );
};

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!credentials.username || !credentials.password) {
      setError('Por favor completa todos los campos');
      return;
    }
    setLoading(true);
    setError('');
    const result = await login({
      username: credentials.username.trim(),
      password: credentials.password,
    });
    if (result?.success) {
      navigate('/interno');
    } else {
      setError(result?.error || 'Error de autenticación');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Panel izquierdo — imagen + branding */}
      <div className="login-left-panel">
        <ImageSlideshow />
        <div className="login-left-overlay" />
        <div className="login-left-glow login-left-glow--top" />
        <div className="login-left-glow login-left-glow--bottom" />

        <div className="login-left-content">
          {/* Logo + nombre */}
          <div className="login-brand">
            <img
              src={logoUmsnh}
              alt="Logo UMSNH"
              className="login-brand-logo"
            />
            <div>
              <h1 className="login-brand-title">UMSNH</h1>
              <p className="login-brand-subtitle">Universidad Michoacana de San Nicolás de Hidalgo</p>
            </div>
          </div>

          {/* Título principal */}
          <div className="login-left-main">
            <h2 className="login-left-heading">
              Sistema Integral de Administración Facultaria
            </h2>
            <p className="login-left-desc">
              Accede a los recursos académicos y administrativos de la universidad.
            </p>

            <div className="login-left-quote">
              <p className="login-left-quote-text">
                "Cuna de héroes, crisol de pensadores"
              </p>
              <p className="login-left-quote-sub">
                Formando profesionales con compromiso social desde 1917
              </p>
            </div>
          </div>

          <div className="login-left-footer">
            © 2026 UMSNH - Todos los derechos reservados
          </div>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="login-right-panel">
        <div className="login-right-inner">
          {/* Logo mobile */}
          <div className="login-mobile-brand">
            <img src={logoUmsnh} alt="Logo UMSNH" className="login-mobile-logo" />
            <div className="login-mobile-brand-text">
              <h1 className="login-mobile-title">UMSNH</h1>
              <p className="login-mobile-subtitle">Universidad Michoacana de San Nicolás de Hidalgo</p>
            </div>
          </div>

          <div className="login-card">
            <div className="login-card-header">
              <h2 className="login-card-title">Bienvenido</h2>
              <p className="login-card-desc">Ingresa tus credenciales institucionales para acceder</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
              {error && <div className="login-error">{error}</div>}

              <div className="form-group">
                <label htmlFor="username">Usuario</label>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={credentials.username}
                    onChange={handleInputChange}
                    placeholder="Ingresa tu usuario"
                    autoComplete="off"
                    disabled={loading}
                    maxLength={100}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Contraseña</label>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={credentials.password}
                    onChange={handleInputChange}
                    placeholder="Ingresa tu contraseña"
                    autoComplete="new-password"
                    disabled={loading}
                    maxLength={128}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? (
                  <>
                    <div className="loading-spinner" />
                    Iniciando sesión...
                  </>
                ) : (
                  'Iniciar Sesión'
                )}
              </button>

              <p className="login-help-text">
                Si tienes problemas para acceder, contacta al{' '}
                <span className="login-help-link">Departamento de Infraestructura Informática</span>
              </p>
            </form>
          </div>

          {/* Badge de seguridad */}
          <div className="login-security-badge">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Conexión segura con cifrado SSL</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
