const DEFAULT_API_BASE_URL = 'https://amcham.iconetcloud.com.mx/api';

const API_BASE_URL = process.env.API_BASE_URL || DEFAULT_API_BASE_URL;
const CLIENTE_REMOTO = String(process.env.CLIENTE_REMOTO || '').toLowerCase() === 'true';

module.exports = {
  API_BASE_URL,
  CLIENTE_REMOTO
};
