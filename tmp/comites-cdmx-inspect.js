const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseUrl = 'http://127.0.0.1:3005';
const credentials = { usuario: 'ICONET', contrasena: '4zxb63NyI43?' };

const normalize = (v) =>
  String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

async function ensureLoggedIn(page) {
  await page.goto(`${baseUrl}/login.html`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('login.html')) {
    await page.fill('#usuario', credentials.usuario);
    await page.fill('#contrasena', credentials.contrasena);
    await Promise.all([
      page.waitForURL('**/app.html', { timeout: 15000 }),
      page.click('#botonIngresar'),
    ]);
  }
}

async function ensureEmpresa(page, empresaId) {
  await page.evaluate((id) => {
    try {
      window.Sesion?.establecerEmpresaActiva?.(id);
    } catch (_) {
      // ignore
    }
  }, empresaId);
  await page.waitForTimeout(400);
}

async function loadPlantillasContext(page, chapterHint) {
  await page.goto(`${baseUrl}/plantillas.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#moduloSelect', { timeout: 20000 });
  await ensureEmpresa(page, 'empresa1');

  await page.selectOption('#moduloSelect', 'Comités');

  await page.waitForFunction(() => {
    const sel = document.querySelector('#anioSelect');
    if (!sel) return false;
    return Array.from(sel.options || []).some((o) => String(o.value) === '2026');
  }, { timeout: 20000 });

  await page.selectOption('#anioSelect', '2026');

  await page.waitForFunction(() => {
    const sel = document.querySelector('#capituloSelect');
    return !!sel && Array.from(sel.options || []).length > 0;
  }, { timeout: 20000 });

  const selectedChapter = await page.evaluate((hintRaw) => {
    const norm = (v) =>
      String(v || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();
    const hint = norm(hintRaw);
    const sel = document.querySelector('#capituloSelect');
    if (!sel) return null;
    const options = Array.from(sel.options || []).map((o) => ({
      value: String(o.value || ''),
      label: String(o.textContent || o.value || ''),
      nValue: norm(o.value || ''),
      nLabel: norm(o.textContent || o.value || ''),
    }));

    const exact = options.find((o) => o.nValue === hint || o.nLabel === hint);
    const fuzzy = options.find((o) => o.nValue.includes(hint) || o.nLabel.includes(hint));
    const match = exact || fuzzy || options[0] || null;
    if (!match) return null;
    sel.value = match.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return { value: match.value, label: match.label, options };
  }, chapterHint);

  if (!selectedChapter) {
    throw new Error(`No se pudo seleccionar capítulo para hint=${chapterHint}`);
  }

  await page.click('#btnCargar');

  await page.waitForFunction(
    () =>
      window.state &&
      String(window.state.modulo || '') === 'Comités' &&
      String(window.state.anio || '') === '2026',
    { timeout: 30000 },
  );

  await page.waitForTimeout(1800);

  const plantillasData = await page.evaluate(async () => {
    const norm = (v) =>
      String(v || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();

    const rows = typeof window.getTemplateRowsForReorder === 'function'
      ? window.getTemplateRowsForReorder()
      : [];

    const mapped = rows.map((r, i) => ({
      i,
      type: String(r?.type || ''),
      label: String(r?.label || '').trim(),
      principalName: String(r?.principalName || '').trim(),
      subsectionName: String(r?.subsectionName || '').trim(),
      operationId: String(r?.operationId || r?.rowId || '').trim(),
      accountCode: String(r?.accountCode || '').trim(),
    }));

    const counts = mapped.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    }, {});

    const state = {
      modulo: String(window.state?.modulo || ''),
      anio: String(window.state?.anio || ''),
      capitulo: String(window.state?.capitulo || ''),
      empresaId: String(window.state?.empresaId || ''),
    };

    const params = new URLSearchParams({
      empresaId: 'EMPRESA01',
      includeSecciones: '1',
    });
    const url = `/api/layouts/${encodeURIComponent(state.modulo)}/${encodeURIComponent(
      state.anio,
    )}/${encodeURIComponent(state.capitulo)}?${params.toString()}`;
    const headers = typeof window.getAuthHeaders === 'function' ? window.getAuthHeaders() : {};
    let layoutInfo = null;
    try {
      const res = await fetch(url, { headers });
      const json = await res.json();
      const layout = json?.layout || {};
      const cuentas = Array.isArray(layout?.cuentas) ? layout.cuentas : [];
      const operaciones = Array.isArray(layout?.operaciones) ? layout.operaciones : [];
      const secciones = Array.isArray(layout?.secciones) ? layout.secciones : [];

      const cuentasPorSeccion = {};
      cuentas.forEach((c) => {
        const key = String(
          c?.['SECCIÓN Principal'] || c?.['SECCION Principal'] || c?.seccion_principal || c?.SECCION || '',
        ).trim();
        if (!key) return;
        cuentasPorSeccion[key] = (cuentasPorSeccion[key] || 0) + 1;
      });

      const opsPorSeccion = {};
      operaciones.forEach((op) => {
        if (op?.visible === false) return;
        const key = String(op?.SECCION || op?.seccion || op?.parentSection || '').trim();
        if (!key) return;
        opsPorSeccion[key] = (opsPorSeccion[key] || 0) + 1;
      });

      layoutInfo = {
        ok: res.ok,
        status: res.status,
        cuentasTotal: cuentas.length,
        operacionesTotal: operaciones.length,
        seccionesTotal: secciones.length,
        cuentasPorSeccion,
        opsPorSeccion,
        secciones: secciones.map((s) => ({
          tipo: s?.tipo,
          seccion_principal: s?.seccion_principal,
          seccion_secundaria: s?.seccion_secundaria,
          visible: s?.visible,
          orden_presentacion: s?.orden_presentacion,
        })),
        operacionesConOperativo: operaciones
          .filter((op) => op?.['sum-row-operativo'] || op?.['sum-row-operativo-consolidado'])
          .map((op) => ({
            clase: op?.clase || op?.Clase || op?.OperacionId,
            seccion: op?.SECCION || op?.seccion || '',
            operativo: op?.['sum-row-operativo'] || op?.['sum-row-operativo-consolidado'] || '',
            visible: op?.visible,
            orden_presentacion: op?.orden_presentacion,
          })),
      };
    } catch (e) {
      layoutInfo = { ok: false, error: String(e?.message || e) };
    }

    return {
      state,
      counts,
      principals: [...new Set(mapped.filter((r) => r.type === 'principal').map((r) => r.label))],
      subsections: [...new Set(mapped.filter((r) => r.type === 'subsection').map((r) => r.label))],
      operationRows: mapped
        .filter((r) => r.type === 'operation')
        .map((r) => ({ label: r.label, principalName: r.principalName, subsectionName: r.subsectionName, operationId: r.operationId })),
      layoutInfo,
    };
  });

  return { selectedChapter, plantillasData };
}

async function inspectComitesPage(page) {
  await page.goto(`${baseUrl}/Comités.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#tablaComparacion', { timeout: 30000 });
  await ensureEmpresa(page, 'empresa1');

  await page.evaluate(() => {
    const sel = document.querySelector('#comitesYearSelect');
    if (sel) {
      const has2026 = Array.from(sel.options || []).some((o) => String(o.value) === '2026');
      if (has2026) {
        sel.value = '2026';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  await page.waitForTimeout(5000);

  return page.evaluate(() => {
    const norm = (v) =>
      String(v || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();

    const rows = Array.from(document.querySelectorAll('#tablaComparacion tbody tr'));
    const sectionHeaders = rows
      .filter((tr) => tr.classList.contains('section-header-row'))
      .map((tr) => ({
        text: (tr.textContent || '').trim().replace(/\s+/g, ' '),
        dataSeccion: tr.getAttribute('data-seccion') || '',
        dataSectionName: tr.getAttribute('data-section-name') || '',
      }));

    const opRows = rows
      .filter(
        (tr) =>
          tr.classList.contains('sum-row-operativo') ||
          tr.classList.contains('operation-row') ||
          tr.classList.contains('free-operation-row') ||
          tr.classList.contains('sum-row-sumavarios') ||
          tr.classList.contains('sum-row') ||
          tr.classList.contains('result-row'),
      )
      .map((tr) => ({
        className: tr.className,
        text: (tr.textContent || '').trim().replace(/\s+/g, ' '),
        dataSeccion: tr.getAttribute('data-seccion') || '',
        dataSectionName: tr.getAttribute('data-section-name') || '',
      }));

    const containsResultadosOperativosSection = sectionHeaders.some((s) => {
      const t = norm(s.text);
      return t.includes('RESULTADO OPERATIVO') || t.includes('RESULTADOS OPERATIVOS');
    });

    const operativoRows = opRows.filter((r) => norm(r.text).includes('RESULTADO OPERATIVO'));

    return {
      yearLabel: (document.querySelector('#yearLabel')?.textContent || '').trim(),
      empresaLabel: (document.querySelector('#empresaLabel')?.textContent || '').trim(),
      sectionHeaders,
      containsResultadosOperativosSection,
      operativoRows,
      opRowsTop: opRows.slice(0, 40),
      rowCount: rows.length,
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  const page = await context.newPage();

  const chapterHints = ['CDMX', 'CIUDAD DE MEXICO'];
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    empresa: 'empresa1',
    modulo: 'Comités',
    anio: 2026,
    chapters: [],
  };

  try {
    await ensureLoggedIn(page);

    for (const hint of chapterHints) {
      const chapterEntry = { hint };
      try {
        const plantillas = await loadPlantillasContext(page, hint);
        const tabla = await inspectComitesPage(page);
        chapterEntry.selectedChapter = plantillas.selectedChapter;
        chapterEntry.plantillas = plantillas.plantillasData;
        chapterEntry.comitesPage = tabla;
      } catch (error) {
        chapterEntry.error = String(error?.message || error);
      }
      report.chapters.push(chapterEntry);
    }

    try {
      await page.screenshot({ path: path.join(process.cwd(), 'tmp', 'comites-cdmx-inspect.png'), fullPage: true });
    } catch (_) {
      // ignore screenshot errors
    }
  } finally {
    await browser.close();
  }

  const outFile = path.join(process.cwd(), 'tmp', 'comites-cdmx-inspect-output.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8');
  console.log(outFile);
})();
