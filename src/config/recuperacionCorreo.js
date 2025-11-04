/**
 * Configuración base para la integración de recuperación de contraseña
 * mediante Nodemailer y Brave. Ajusta los valores conforme a tu entorno
 * antes de habilitar el envío de correos.
 */
module.exports = {
  nodemailer: {
    host: '',
    port: 465,
    secure: true,
    auth: {
      user: '',
      pass: ''
    }
  },
  brave: {
    /**
     * URL del servicio o endpoint que expone Brave para el envío de correos.
     */
    endpoint: '',
    /**
     * Token o credencial necesaria para autenticarte con Brave.
     */
    token: ''
  }
};
