// firebird-config.js - Gestión de Conexiones Firebird
(function () {
  'use strict';

  const API_BASE = '/api/firebird-config';
  let configActual = null;
  let empresaEditando = null;

  // ==================== Inicialización ====================
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    verificarAutenticacion();
    setupEventListeners();
    cargarConfiguracion();
  }

  // ==================== Autenticación ====================
  async function verificarAutenticacion() {
    try {
      const res = await fetch('/api/sesion/verificar');
      if (!res.ok) {
        window.location.href = '/login.html';
        return;
      }
      const data = await res.json();
      
      if (!data.esAdminGlobal) {
        mostrarAlerta('error', 'Acceso denegado. Solo administradores globales pueden acceder.');
        setTimeout(() => window.location.href = '/app.html', 2000);
        return;
      }

      document.getElementById('usuarioActual').textContent = data.usuario || 'Usuario';
    } catch (error) {
      console.error('Error al verificar autenticación:', error);
      window.location.href = '/login.html';
    }
  }

  // ==================== Event Listeners ====================
  function setupEventListeners() {
    document.getElementById('btnVolver').addEventListener('click', () => {
      window.location.href = '/app.html';
    });

    document.getElementById('btnEditarBase').addEventListener('click', mostrarFormularioBase);
    document.getElementById('btnCancelarBase').addEventListener('click', ocultarFormularioBase);
    document.getElementById('formConfigBase').addEventListener('submit', guardarConfigBase);

    document.getElementById('searchEmpresas').addEventListener('input', filtrarEmpresas);

    document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
    document.getElementById('btnCancelarModal').addEventListener('click', cerrarModal);
    document.getElementById('btnGuardarEmpresa').addEventListener('click', guardarEmpresa);
    document.getElementById('modalRestaurarDefault').addEventListener('change', (e) => {
      document.getElementById('modalRutaBD').disabled = e.target.checked;
    });

    // Cerrar modal al hacer click fuera
    document.getElementById('modalEditarEmpresa').addEventListener('click', (e) => {
      if (e.target.id === 'modalEditarEmpresa') {
        cerrarModal();
      }
    });
  }

  // ==================== Carga de Configuración ====================
  async function cargarConfiguracion() {
    mostrarLoading(true);
    try {
      const res = await fetch(API_BASE);
      if (!res.ok) {
        throw new Error('Error al cargar configuración');
      }
      configActual = await res.json();
      renderizarConfigBase(configActual.configBase);
      renderizarEmpresas(configActual.empresas);
    } catch (error) {
      console.error('Error:', error);
      mostrarAlerta('error', 'No se pudo cargar la configuración: ' + error.message);
    } finally {
      mostrarLoading(false);
    }
  }

  // ==================== Config Base ====================
  function renderizarConfigBase(config) {
    document.getElementById('viewHost').textContent = config.host || '-';
    document.getElementById('viewPort').textContent = config.port || '-';
    document.getElementById('viewUser').textContent = config.user || '-';
  }

  function mostrarFormularioBase() {
    const config = configActual?.configBase || {};
    document.getElementById('inputHost').value = config.host || '127.0.0.1';
    document.getElementById('inputPort').value = config.port || 3050;
    document.getElementById('inputUser').value = config.user || 'sysdba';
    document.getElementById('inputPassword').value = config.password || '';

    document.getElementById('configBaseView').style.display = 'none';
    document.getElementById('formConfigBase').style.display = 'block';
    document.getElementById('btnEditarBase').style.display = 'none';
  }

  function ocultarFormularioBase() {
    document.getElementById('configBaseView').style.display = 'block';
    document.getElementById('formConfigBase').style.display = 'none';
    document.getElementById('btnEditarBase').style.display = 'inline-block';
  }

  async function guardarConfigBase(e) {
    e.preventDefault();
    
    const data = {
      host: document.getElementById('inputHost').value.trim(),
      port: parseInt(document.getElementById('inputPort').value),
      user: document.getElementById('inputUser').value.trim(),
      password: document.getElementById('inputPassword').value
    };

    mostrarLoading(true);
    try {
      const res = await fetch(`${API_BASE}/base`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.mensaje || 'Error al guardar');
      }

      mostrarAlerta('success', 'Configuración base actualizada correctamente');
      ocultarFormularioBase();
      await cargarConfiguracion();
    } catch (error) {
      console.error('Error:', error);
      mostrarAlerta('error', 'No se pudo guardar: ' + error.message);
    } finally {
      mostrarLoading(false);
    }
  }

  // ==================== Empresas ====================
  function renderizarEmpresas(empresas) {
    const tbody = document.getElementById('empresasTableBody');
    
    if (!empresas || empresas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="no-data">No hay empresas configuradas</td></tr>';
      return;
    }

    tbody.innerHTML = empresas.map(empresa => `
      <tr data-empresa-id="${empresa.id}" data-empresa-nombre="${empresa.nombre}">
        <td class="empresa-nombre">
          ${empresa.nombre}
          ${empresa.tieneOverride ? '<span class="badge-override">Personalizado</span>' : ''}
        </td>
        <td class="empresa-ruta">
          <code>${empresa.rutaBaseDatos || '-'}</code>
        </td>
        <td class="empresa-estado">
          <span class="status-badge status-unknown" data-empresa-id="${empresa.id}">
            <span class="status-dot"></span>
            No probado
          </span>
        </td>
        <td class="empresa-acciones">
          <button class="btn-icon btn-test" data-empresa-id="${empresa.id}" title="Probar conexión">
            🔌
          </button>
          <button class="btn-icon btn-edit" data-empresa-id="${empresa.id}" title="Editar ruta">
            ✏️
          </button>
          ${empresa.tieneOverride ? `
            <button class="btn-icon btn-reset" data-empresa-id="${empresa.id}" title="Restaurar a default">
              ↺
            </button>
          ` : ''}
        </td>
      </tr>
    `).join('');

    // Attach event listeners
    tbody.querySelectorAll('.btn-test').forEach(btn => {
      btn.addEventListener('click', () => probarConexion(btn.dataset.empresaId));
    });

    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => abrirModalEdicion(btn.dataset.empresaId));
    });

    tbody.querySelectorAll('.btn-reset').forEach(btn => {
      btn.addEventListener('click', () => restaurarDefault(btn.dataset.empresaId));
    });
  }

  function filtrarEmpresas() {
    const search = document.getElementById('searchEmpresas').value.toLowerCase();
    const rows = document.querySelectorAll('#empresasTableBody tr');
    
    rows.forEach(row => {
      const nombre = row.dataset.empresaNombre?.toLowerCase() || '';
      row.style.display = nombre.includes(search) ? '' : 'none';
    });
  }

  async function probarConexion(empresaId) {
    const statusBadge = document.querySelector(`.status-badge[data-empresa-id="${empresaId}"]`);
    const originalHTML = statusBadge.innerHTML;
    
    statusBadge.className = 'status-badge status-testing';
    statusBadge.innerHTML = '<span class="status-dot"></span>Probando...';

    try {
      const res = await fetch(`${API_BASE}/test/${empresaId}`, { method: 'POST' });
      const data = await res.json();

      if (data.disponible) {
        statusBadge.className = 'status-badge status-success';
        statusBadge.innerHTML = '<span class="status-dot"></span>Conectado';
        mostrarAlerta('success', `Conexión exitosa a ${data.empresaNombre}`);
      } else {
        statusBadge.className = 'status-badge status-error';
        statusBadge.innerHTML = '<span class="status-dot"></span>Error';
        mostrarAlerta('error', `No se pudo conectar a ${data.empresaNombre}`);
      }
    } catch (error) {
      console.error('Error:', error);
      statusBadge.className = 'status-badge status-error';
      statusBadge.innerHTML = '<span class="status-dot"></span>Error';
      mostrarAlerta('error', 'Error al probar conexión: ' + error.message);
    }
  }

  // ==================== Modal ====================
  function abrirModalEdicion(empresaId) {
    const empresa = configActual.empresas.find(e => e.id === empresaId);
    if (!empresa) return;

    empresaEditando = empresa;
    
    document.getElementById('modalEmpresaNombre').value = empresa.nombre;
    document.getElementById('modalRutaBD').value = empresa.rutaBaseDatos || '';
    document.getElementById('modalRestaurarDefault').checked = false;
    document.getElementById('modalRutaBD').disabled = false;

    document.getElementById('modalEditarEmpresa').style.display = 'flex';
  }

  function cerrarModal() {
    document.getElementById('modalEditarEmpresa').style.display = 'none';
    empresaEditando = null;
  }

  async function guardarEmpresa() {
    if (!empresaEditando) return;

    const restaurar = document.getElementById('modalRestaurarDefault').checked;
    
    if (restaurar) {
      await restaurarDefault(empresaEditando.id);
      cerrarModal();
      return;
    }

    const rutaBD = document.getElementById('modalRutaBD').value.trim();
    
    if (!rutaBD) {
      mostrarAlerta('error', 'Debes especificar una ruta de base de datos');
      return;
    }

    mostrarLoading(true);
    try {
      const res = await fetch(`${API_BASE}/empresa/${empresaEditando.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rutaBaseDatos: rutaBD })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.mensaje || 'Error al guardar');
      }

      mostrarAlerta('success', `Ruta actualizada para ${empresaEditando.nombre}`);
      cerrarModal();
      await cargarConfiguracion();
    } catch (error) {
      console.error('Error:', error);
      mostrarAlerta('error', 'No se pudo guardar: ' + error.message);
    } finally {
      mostrarLoading(false);
    }
  }

  async function restaurarDefault(empresaId) {
    const empresa = configActual.empresas.find(e => e.id === empresaId);
    if (!empresa) return;

    if (!confirm(`¿Restaurar la configuración de ${empresa.nombre} a los valores por defecto?`)) {
      return;
    }

    mostrarLoading(true);
    try {
      const res = await fetch(`${API_BASE}/empresa/${empresaId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.mensaje || 'Error al restaurar');
      }

      mostrarAlerta('success', `Configuración de ${empresa.nombre} restaurada`);
      await cargarConfiguracion();
    } catch (error) {
      console.error('Error:', error);
      mostrarAlerta('error', 'No se pudo restaurar: ' + error.message);
    } finally {
      mostrarLoading(false);
    }
  }

  // ==================== UI Helpers ====================
  function mostrarAlerta(tipo, mensaje) {
    const container = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${tipo}`;
    alert.textContent = mensaje;
    
    container.appendChild(alert);
    
    setTimeout(() => {
      alert.classList.add('alert-fade-out');
      setTimeout(() => alert.remove(), 300);
    }, 5000);
  }

  function mostrarLoading(mostrar) {
    document.getElementById('loadingOverlay').style.display = mostrar ? 'flex' : 'none';
  }

})();
