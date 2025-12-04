const { API_BASE_URL } = require('../config/apiConfig');

const parsearJson = async (respuesta) => {
  const texto = await respuesta.text();
  try {
    return JSON.parse(texto);
  } catch (error) {
    throw new Error(`No se pudo interpretar la respuesta del API: ${texto}`);
  }
};

const solicitarAPI = async (ruta, opciones = {}) => {
  const url = ruta.startsWith('http') ? ruta : `${API_BASE_URL}${ruta}`;
  const respuesta = await fetch(url, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(opciones.headers || {})
    }
  });

  if (!respuesta.ok) {
    const cuerpo = await respuesta.text();
    throw new Error(`API remota respondió ${respuesta.status}: ${cuerpo}`);
  }

  return parsearJson(respuesta);
};

module.exports = {
  API_BASE_URL,
  solicitarAPI
};
