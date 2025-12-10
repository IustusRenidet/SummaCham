// Script de verificación de sesión para todos los módulos
// Se ejecuta ANTES de cargar cualquier contenido del módulo
(function() {
  'use strict';
  
  // Verificar que Sesion esté disponible
  if (typeof Sesion === 'undefined' || typeof Sesion.requerirSesion !== 'function') {
    console.error('❌ Módulo Sesion no cargado');
    window.location.replace('login.html');
    return;
  }
  
  // Verificar sesión válida
  const sesion = Sesion.requerirSesion({ redirectTo: 'login.html' });
  
  if (!sesion) {
    // requerirSesion ya redirigió a login
    return;
  }
  
  // Sesión válida - guardar en window.sesion para uso global del módulo
  window.sesion = sesion;
  
  console.log('✅ Sesión verificada:', sesion.usuario?.usuario || 'Usuario');
})();
