(() => {
  const API_BASE = (() => {
    if (window.location.protocol === 'file:') return 'http://localhost:3005/api';
    return `${window.location.origin.replace(/\/$/, '')}/api`;
  })();

  const crearTarjeta = (item = {}) => {
    const titulo = item.titulo || item.title || 'Elemento sin nombre';
    const descripcion = item.descripcion || item.description || '';
    const meta = item.meta || item.details || null;
    const valores = Array.isArray(item.valores || item.values) ? item.valores || item.values : [];

    const metaTexto = typeof meta === 'string' ? meta : '';

    const listaValores = valores
      .map((valor) => `<li class="list-group-item">${valor}</li>`)
      .join('');

    return `
      <article class="card h-100 shadow-sm">
        <div class="card-body">
          <h3 class="h6 fw-bold text-success mb-2">${titulo}</h3>
          ${metaTexto ? `<p class="text-muted small mb-2">${metaTexto}</p>` : ''}
          ${descripcion ? `<p class="mb-3">${descripcion}</p>` : ''}
          ${listaValores ? `<ul class="list-group list-group-flush">${listaValores}</ul>` : ''}
        </div>
      </article>
    `;
  };

  window.initGenericModule = (moduloId) => {
    const contenedor = document.getElementById('moduleDynamicList');
    const estado = document.getElementById('moduleStatus');
    const cargador = document.getElementById('moduleLoader');

    const sesion = Sesion.requerirSesion();
    if (!sesion) {
      return;
    }

    const cargarDatos = async () => {
      estado.className = 'alert visually-hidden';
      estado.textContent = '';
      if (cargador) {
        cargador.classList.remove('visually-hidden');
      }
      if (contenedor) {
        contenedor.innerHTML = '';
      }

      try {
        const respuesta = await fetch(`${API_BASE}/modulos/${moduloId}`, {
          headers: Sesion.headersAutenticacion()
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible obtener la información del módulo.');
        }

        const elementos = datos.items || [];
        if (!contenedor) {
          return;
        }

        if (elementos.length === 0) {
          estado.textContent = 'No hay datos disponibles para mostrar en este módulo. Vuelve más tarde.';
          estado.className = 'alert alert-info';
          return;
        }

        const tarjetas = elementos.map((item) => crearTarjeta(item)).join('');
        contenedor.innerHTML = tarjetas;
      } catch (error) {
        console.error('Error al cargar módulo', moduloId, error);
        estado.textContent = error.message || 'Ocurrió un error al cargar los datos.';
        estado.className = 'alert alert-danger';
      } finally {
        if (cargador) {
          cargador.classList.add('visually-hidden');
        }
      }
    };

    cargarDatos();
  };
})();
