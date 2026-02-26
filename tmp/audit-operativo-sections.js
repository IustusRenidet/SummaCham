const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseUrl = 'http://127.0.0.1:3005';
const modules = [
  'Membresía.html',
  'Eventos.html',
  'Comunicación.html',
  'Dirección.html',
  'Serv_Membresía.html',
  'Comités.html',
  'T&IC.html',
  'RH.html',
  'VPE.html',
  'Finanzas.html',
  'GastosGenerales.html',
  'Nomina.html',
  'Gtos_Corporativos.html',
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
  const page = await context.newPage();

  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push(String(err?.message || err));
  });

  await page.goto(`${baseUrl}/login.html`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('login.html')) {
    await page.fill('#usuario', 'ICONET');
    await page.fill('#contrasena', '4zxb63NyI43?');
    await Promise.all([page.waitForURL('**/app.html', { timeout: 15000 }), page.click('#botonIngresar')]);
  }

  const results = [];

  for (const html of modules) {
    const entry = { html, ok: false, error: null };
    try {
      await page.goto(`${baseUrl}/${encodeURI(html)}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#tablaComparacion', { timeout: 30000 });

      await page.evaluate(() => {
        try { window.Sesion?.establecerEmpresaActiva?.('empresa1'); } catch (_) {}
      });

      await page.evaluate(() => {
        const sel =
          document.querySelector('select[id$="YearSelect"]') ||
          document.querySelector('[data-role="module-year-select"]') ||
          document.querySelector('select[name="anio"]');
        if (!sel) return;
        const has2026 = Array.from(sel.options || []).some((o) => String(o.value) === '2026');
        if (!has2026) return;
        sel.value = '2026';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });

      await page.waitForTimeout(5000);

      entry.data = await page.evaluate(() => {
        const norm = (v) =>
          String(v || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase();

        const rows = Array.from(document.querySelectorAll('#tablaComparacion tbody tr'));
        const headers = rows
          .filter((tr) => tr.classList.contains('section-header-row'))
          .map((tr) => (tr.textContent || '').trim().replace(/\s+/g, ' '));

        const operationRows = rows
          .filter(
            (tr) =>
              tr.classList.contains('operation-row') ||
              tr.classList.contains('sum-row-operativo') ||
              tr.classList.contains('sum-row') ||
              tr.classList.contains('sum-row-sumavarios') ||
              tr.classList.contains('result-row'),
          )
          .map((tr) => ({
            className: tr.className,
            text: (tr.textContent || '').trim().replace(/\s+/g, ' '),
            seccion: tr.getAttribute('data-seccion') || '',
            seccionName: tr.getAttribute('data-section-name') || '',
          }));

        const operativoRows = operationRows.filter((r) => norm(r.text).includes('RESULTADO OPERATIVO'));
        const operativoUngrouped = operativoRows.filter((r) => !String(r.seccion || '').trim());

        return {
          rowCount: rows.length,
          sectionHeaders: headers,
          sectionCount: headers.length,
          operativoTotal: operativoRows.length,
          operativoUngrouped: operativoUngrouped.length,
          operativoUngroupedSample: operativoUngrouped.slice(0, 5),
        };
      });

      entry.ok = true;
    } catch (error) {
      entry.error = String(error?.message || error);
    }
    results.push(entry);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    modules: results,
    pageErrors: pageErrors.slice(0, 200),
  };

  const out = path.join(process.cwd(), 'tmp', 'audit-operativo-sections.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
  console.log(out);

  await browser.close();
})();
