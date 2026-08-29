/**
 * copiar-presupuesto.js
 * Modal para copiar el presupuesto (PRESUP de Firebird) de un año a otro,
 * dentro de la misma empresa/capítulo. Autocontenido: no depende de
 * cuentas-modulo.js ni de flujo-autorizacion.js, solo lee la empresa activa
 * y la lista de años ya cargada en el selector de la página.
 *
 * Flujo: elegir año origen/destino -> "Ver vista previa" (GET, no escribe
 * nada) -> si hay cuentas que se sobrescribirían, pide marcar la casilla de
 * confirmación -> "Copiar presupuesto" (POST). El backend hace todo el lote
 * en una sola transacción de Firebird: si algo falla, no se guarda nada.
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

  let vistaPreviaVigente = null;

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

  const resetResumen = () => {
    vistaPreviaVigente = null;
    $("copiarPresupuestoResumen")?.classList.add("d-none");
    $("copiarPresupuestoConfirmarWrap")?.classList.add("d-none");
    if ($("copiarPresupuestoConfirmarCheck")) {
      $("copiarPresupuestoConfirmarCheck").checked = false;
    }
    $("btnConfirmarCopiaPresupuesto")?.classList.add("d-none");
    mostrarError("");
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
    resetResumen();
    const modalEl = $("copiarPresupuestoModal");
    if (modalEl && window.bootstrap?.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  };

  const solicitarVistaPrevia = async () => {
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
    const boton = $("btnVerVistaPreviaCopia");
    if (boton) {
      boton.disabled = true;
      boton.textContent = "Consultando...";
    }
    try {
      const params = new URLSearchParams({ empresaId, anioOrigen, anioDestino });
      const resp = await fetch(`${API_BASE}/presupuestos/copiar/vista-previa?${params.toString()}`, {
        headers: headers(),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.mensaje || "No fue posible calcular la vista previa.");
      }
      vistaPreviaVigente = data;

      const partes = [];
      partes.push(`Se copiarían <strong>${data.totalACopiar}</strong> de ${data.totalEnOrigen} cuenta(s) con presupuesto en ${data.anioOrigen}.`);
      if (data.sobrescribiran > 0) {
        partes.push(`<strong>${data.sobrescribiran}</strong> ya tienen presupuesto capturado en ${data.anioDestino} y se sobrescribirían.`);
      }
      if (data.omitidas > 0) {
        partes.push(`${data.omitidas} cuenta(s) no existen en el catálogo de ${data.anioDestino} y no se pueden copiar.`);
      }
      if (!data.totalACopiar) {
        partes.push("No hay nada que copiar con esta selección.");
      }

      $("copiarPresupuestoResumenTexto").innerHTML = partes.join(" ");
      $("copiarPresupuestoResumen")?.classList.remove("d-none");

      const necesitaConfirmacion = data.sobrescribiran > 0;
      $("copiarPresupuestoConfirmarWrap")?.classList.toggle("d-none", !necesitaConfirmacion);
      if ($("copiarPresupuestoConfirmarCheck")) {
        $("copiarPresupuestoConfirmarCheck").checked = false;
      }

      $("btnConfirmarCopiaPresupuesto")?.classList.toggle("d-none", !data.totalACopiar);
    } catch (err) {
      mostrarError(err.message || "No fue posible calcular la vista previa.");
    } finally {
      if (boton) {
        boton.disabled = false;
        boton.textContent = "Ver vista previa";
      }
    }
  };

  const confirmarCopia = async () => {
    if (!vistaPreviaVigente) return;
    if (vistaPreviaVigente.sobrescribiran > 0 && !$("copiarPresupuestoConfirmarCheck")?.checked) {
      mostrarError("Marca la casilla para confirmar que se sobrescribirá presupuesto existente.");
      return;
    }
    const empresaId = obtenerEmpresaActivaId();
    const boton = $("btnConfirmarCopiaPresupuesto");
    if (boton) {
      boton.disabled = true;
      boton.textContent = "Copiando...";
    }
    mostrarError("");
    try {
      const resp = await fetch(`${API_BASE}/presupuestos/copiar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({
          empresaId,
          anioOrigen: vistaPreviaVigente.anioOrigen,
          anioDestino: vistaPreviaVigente.anioDestino,
          permitirSobrescritura: vistaPreviaVigente.sobrescribiran > 0,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data.mensaje || "No fue posible copiar el presupuesto.");
      }

      const modalEl = $("copiarPresupuestoModal");
      if (modalEl && window.bootstrap?.Modal) {
        window.bootstrap.Modal.getInstance(modalEl)?.hide();
      }
      alert(
        `Presupuesto copiado: ${data.copiadas} cuenta(s) de ${data.anioOrigen} a ${data.anioDestino}.` +
          (data.omitidas ? ` ${data.omitidas} cuenta(s) se omitieron por no existir en ${data.anioDestino}.` : "")
      );
      // Si el año destino es el que se está viendo ahora, refresca para ver los nuevos números.
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
    $("btnVerVistaPreviaCopia")?.addEventListener("click", solicitarVistaPrevia);
    $("btnConfirmarCopiaPresupuesto")?.addEventListener("click", confirmarCopia);
    $("copiarAnioOrigen")?.addEventListener("change", resetResumen);
    $("copiarAnioDestino")?.addEventListener("change", resetResumen);
  });
})();
