import React from 'react';
import { useDataSource } from '../context/DataSourceContext';
import './DataSourceIndicator.css';

const DataSourceIndicator = () => {
  const { dataSource, loading } = useDataSource();

  if (loading) return null;

  const modeColor = dataSource.mode === 'bd' ? '#4CAF50' : '#2196F3';
  const modeIcon = dataSource.mode === 'bd' ? '🗄️' : '🌐';
  const modeText = dataSource.mode === 'bd' ? 'Base de Datos' : 'API Externa';

  return (
    <div className="data-source-indicator" style={{ backgroundColor: modeColor }}>
      <span className="mode-icon">{modeIcon}</span>
      <div className="mode-info">
        <strong>{modeText}</strong>
        <small>{dataSource.description}</small>
      </div>
    </div>
  );
};

export default DataSourceIndicator;
