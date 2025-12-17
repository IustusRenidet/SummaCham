// Script de verificación de sesión para todos los módulos
// Se ejecuta ANTES de cargar cualquier contenido del módulo
(function() {
  'use strict';

  // Función auxiliar para redirigir al login desde cualquier contexto (iframe o ventana principal)
  const redirigirALogin = () => {
    const destino = 'login.html';
    // Si estamos dentro de un iframe, redirigir la ventana principal (top)
    if (window.top !== window.self) {
      window.top.location.replace(destino);
    } else {
      window.location.replace(destino);
    }
  };

  // Verificar que Sesion esté disponible
  if (typeof Sesion === 'undefined' || typeof Sesion.requerirSesion !== 'function') {
    console.error('❌ Módulo Sesion no cargado');
    redirigirALogin();
    return;
  }

  // Verificar sesión válida (ahora con soporte para iframe)
  const sesion = Sesion.requerirSesion({ redirectTo: 'login.html', usarTop: true });

  if (!sesion) {
    // requerirSesion ya redirigió a login
    return;
  }

  // Sesión válida - guardar en window.sesion para uso global del módulo
  window.sesion = sesion;

  console.log('✅ Sesión verificada:', sesion.usuario?.usuario || 'Usuario');
})();
