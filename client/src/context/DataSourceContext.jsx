import React, { createContext, useContext, useState, useEffect } from 'react';

const DataSourceContext = createContext();

export const useDataSource = () => {
  const context = useContext(DataSourceContext);
  if (!context) {
    throw new Error('useDataSource debe usarse dentro de DataSourceProvider');
  }
  return context;
};

export const DataSourceProvider = ({ children }) => {
  const [dataSource, setDataSource] = useState({
    mode: 'bd',
    description: 'Cargando...',
    features: {
      listado: false,
      fotos: false,
      categorias: false,
      busqueda: false
    }
  });
  const [loading, setLoading] = useState(true);

  const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
  const API_BASE = `${API_BASE_URL.replace(/\/$/, '')}`;

  useEffect(() => {
    fetchDataSourceInfo();
  }, []);

  const fetchDataSourceInfo = async () => {
    try {
      const response = await fetch(`${API_BASE}/info`);
      const data = await response.json();
      
      if (data.success) {
        setDataSource(data.data);
        console.log('[DataSource] Modo actual:', data.data.mode.toUpperCase());
      }
    } catch (error) {
      console.error('[DataSource] Error obteniendo info:', error);
      // Default a BD si hay error
      setDataSource({
        mode: 'bd',
        description: 'Usando Base de Datos PostgreSQL local',
        features: {
          listado: true,
          fotos: true,
          categorias: true,
          busqueda: true
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    setLoading(true);
    fetchDataSourceInfo();
  };

  return (
    <DataSourceContext.Provider value={{ dataSource, loading, refresh }}>
      {children}
    </DataSourceContext.Provider>
  );
};
