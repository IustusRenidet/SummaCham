/**
 * copiar-presupuesto.js
 * Modal para copiar el presupuesto (PRESUP de Firebird) de un año a otro,
 * completo, dentro de la misma empresa/capítulo. Un solo paso: elegir año
 * origen/destino y "Copiar presupuesto". Si el año destino ya tiene
 * presupuesto capturado en algunas cuentas, el backend responde 409 con el
 * conteo y aquí se le pregunta al usuario con un solo confirm() -- no hay
 * pantalla de vista previa aparte, porque la única decisión real es esa:
 * sobrescribir o no.
 */
(() => {
  const origin =
    window.location.protocol === "file:"
      ? "http://localhost:3005"
      : window.location.origin;
  const API_BASE = `${origin}/api`;

  const headers = () =>
    typeof Sesion?.headersAutenticacion === "function"
      ? Sesion.headersAutenticacion()
      : {};

  const $ = (id) => document.getElementById(id);

  const obtenerEmpresaActivaId = () => {
    try {
      return Sesion?.obtenerEmpresaActiva?.()?.id || null;
    } catch (_) {
      return null;
    }
  };

  const poblarSelectAnios = (select, anioSeleccionadoPreferido) => {
    const origenSelect = $("presupuestosYearSelect");
    if (!select || !origenSelect) return;
    const opciones = Array.from(origenSelect.options)
      .map((op) => op.value)
      .filter((v) => v && !Number.isNaN(Number(v)));
    select.innerHTML = "";
    opciones.forEach((valor) => {
      const opt = document.createElement("option");
      opt.value = valor;
      opt.textContent = valor;
      select.appendChild(opt);
    });
    if (anioSeleccionadoPreferido && opciones.includes(String(anioSeleccionadoPreferido))) {
      select.value = String(anioSeleccionadoPreferido);
    }
  };

  const mostrarError = (mensaje) => {
    const el = $("copiarPresupuestoError");
    if (!el) return;
    if (!mensaje) {
      el.classList.add("d-none");
      el.textContent = "";
      return;
    }
    el.textContent = mensaje;
    el.classList.remove("d-none");
  };

  const abrirModal = () => {
    const empresaId = obtenerEmpresaActivaId();
    if (!empresaId) {
      alert("Selecciona una empresa antes de copiar presupuesto.");
      return;
    }
    const anioActual = $("presupuestosYearSelect")?.value || "";
    poblarSelectAnios($("copiarAnioOrigen"), anioActual);
    poblarSelectAnios($("copiarAnioDestino"), "");
    mostrarError("");
    const modalEl = $("copiarPresupuestoModal");
    if (modalEl && window.bootstrap?.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  };

  const ejecutarCopia = async ({ empresaId, anioOrigen, anioDestino, permitirSobrescritura }) => {
    const resp = await fetch(`${API_BASE}/presupuestos/copiar`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers() },
      body: JSON.stringify({ empresaId, anioOrigen, anioDestino, permitirSobrescritura }),
    });
    const data = await resp.json().catch(() => ({}));
    return { status: resp.status, data };
  };

  const confirmarCopia = async () => {
    mostrarError("");
    const empresaId = obtenerEmpresaActivaId();
    const anioOrigen = $("copiarAnioOrigen")?.value;
    const anioDestino = $("copiarAnioDestino")?.value;
    if (!empresaId || !anioOrigen || !anioDestino) {
      mostrarError("Selecciona el año de origen y el año destino.");
      return;
    }
    if (anioOrigen === anioDestino) {
      mostrarError("El año de origen y el de destino deben ser distintos.");
      return;
    }

    const boton = $("btnConfirmarCopiaPresupuesto");
    if (boton) {
      boton.disabled = true;
      boton.textContent = "Copiando...";
    }
    try {
      let { status, data } = await ejecutarCopia({ empresaId, anioOrigen, anioDestino, permitirSobrescritura: false });

      if (status === 409) {
        const totalACopiar = data.preview?.totalACopiar ?? "varias";
        const sobrescribiran = data.preview?.sobrescribiran ?? "algunas";
        const confirmado = confirm(
          `El presupuesto ${anioDestino} ya tiene capturadas ${sobrescribiran} de las ${totalACopiar} cuentas que se copiarían desde ${anioOrigen}.\n\n` +
            `¿Sobrescribir esas cuentas con los valores de ${anioOrigen}?`
        );
        if (!confirmado) {
          return;
        }
        ({ status, data } = await ejecutarCopia({ empresaId, anioOrigen, anioDestino, permitirSobrescritura: true }));
      }

      if (status < 200 || status >= 300) {
        throw new Error(data.mensaje || "No fue posible copiar el presupuesto.");
      }

      const modalEl = $("copiarPresupuestoModal");
      if (modalEl && window.bootstrap?.Modal) {
        window.bootstrap.Modal.getInstance(modalEl)?.hide();
      }
      alert(`Presupuesto copiado: ${data.copiadas} cuenta(s) de ${data.anioOrigen} a ${data.anioDestino}.`);
      if (String($("presupuestosYearSelect")?.value) === String(data.anioDestino)) {
        window.location.reload();
      }
    } catch (err) {
      mostrarError(err.message || "No fue posible copiar el presupuesto.");
    } finally {
      if (boton) {
        boton.disabled = false;
        boton.textContent = "Copiar presupuesto";
      }
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    $("btnCopiarPresupuesto")?.addEventListener("click", abrirModal);
    $("btnConfirmarCopiaPresupuesto")?.addEventListener("click", confirmarCopia);
  });
})();
