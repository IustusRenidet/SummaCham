const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const base = 'http://127.0.0.1:3005';

  await page.goto(`${base}/login.html`);
  if (page.url().includes('login.html')) {
    await page.fill('#usuario', 'ICONET');
    await page.fill('#contrasena', '4zxb63NyI43?');
    await Promise.all([page.waitForURL('**/app.html'), page.click('#botonIngresar')]);
  }

  await page.goto(`${base}/Comités.html`);
  await page.waitForSelector('#tablaComparacion', { timeout: 30000 });
  await page.waitForTimeout(3000);

  const data = await page.evaluate(async () => {
    const headers = window.Sesion?.headersAutenticacion?.() || {};
    const caps = ['CIUDAD DE MÉXICO', 'CIUDAD DE MEXICO', 'CDMX'];
    const out = [];

    for (const cap of caps) {
      const url = `/api/layouts/${encodeURIComponent('Comités')}/2026/${encodeURIComponent(cap)}?empresaId=empresa1&includeSecciones=1`;
      const res = await fetch(url, { headers });
      const json = await res.json().catch(() => ({}));
      const layout = json.layout || {};
      const ops = Array.isArray(layout.operaciones) ? layout.operaciones : [];
      const secs = Array.isArray(layout.secciones) ? layout.secciones : [];
      const cu = Array.isArray(layout.cuentas) ? layout.cuentas : [];

      out.push({
        cap,
        ok: res.ok,
        status: res.status,
        returnedCap: layout.capitulo,
        cuentas: cu.length,
        operaciones: ops.length,
        secciones: secs.length,
        opsWithParentSection: ops.filter((o) => o.parentSection).length,
        opsWithSECCION: ops.filter((o) => o.SECCION || o.seccion).length,
        opsWithOperativo: ops.filter((o) => o['sum-row-operativo'] || o['sum-row-operativo-consolidado']).length,
        sampleOps: ops.slice(0, 8).map((o) => ({
          id: o.OperacionId || o.Clase || o.clase,
          seccion: o.SECCION || o.seccion || '',
          parentSection: o.parentSection || '',
          parentSubsection: o.parentSubsection || '',
          free: o['free-operation'] || '',
          sum: o['sum-row'] || '',
          sumop: o['sum-row-operativo'] || o['sum-row-operativo-consolidado'] || '',
          label: o.operacion_label || o.operacion_etiqueta || '',
        })),
      });
    }

    return out;
  });

  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
