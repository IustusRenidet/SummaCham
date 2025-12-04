(() => {
  const DEFAULT_API_BASE_URL = 'https://amcham.iconetcloud.com.mx/api';

  const sanitizeBase = (valor) => {
    const limpio = (valor || '').toString().trim();
    if (!limpio) return '';
    return limpio.replace(/\/$/, '');
  };

  const detectarBasePorUbicacion = () => {
    if (window.location.protocol === 'file:') {
      return DEFAULT_API_BASE_URL;
    }
    return `${window.location.origin}/api`;
  };

  const apiBase = sanitizeBase(window.API_BASE_URL) || detectarBasePorUbicacion();

  const construirUrl = (ruta = '') => {
    const prefijo = ruta.startsWith('/') ? '' : '/';
    return `${apiBase}${prefijo}${ruta}`;
  };

  window.API_BASE_URL = apiBase;
  window.apiUrl = construirUrl;
})();
