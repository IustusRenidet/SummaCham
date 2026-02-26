const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const outPath = path.join(process.cwd(), 'tmp', 'repro-delete-comites-direct.json');
  const baseUrl = 'http://127.0.0.1:3005';
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1520, height: 1200 } })).newPage();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const snap = async () =>
    page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#tablaComparacion tbody tr'));
      const mapped = rows.map((tr, idx) => {
        const td = tr.querySelectorAll('td');
        return {
          idx,
          cls: tr.className,
          c0: (td[0]?.textContent || '').trim(),
          c1: (td[1]?.textContent || '').trim(),
          sec: (tr.dataset?.seccion || tr.dataset?.sectionName || '').trim(),
        };
      });
      return {
        total: mapped.length,
        sections: mapped.filter((r) => r.cls.includes('section-header-row')).map((r) => r.c1 || r.c0),
        resOpsRows: mapped.filter((r) => /RESULTADOS?\s+OPERATIVOS?/i.test(`${r.sec} ${r.c0} ${r.c1}`)).length,
        targetRows: mapped.filter((r) => /POR\s*PROGRAMA/i.test(r.c0) && /COMIT/i.test(r.c1)),
        sample: mapped.filter((r) => /POR\s*PROGRAMA|COMIT|RESULTADOS?\s+OPERATIVOS?/i.test(`${r.c0} ${r.c1} ${r.sec}`)).slice(0, 35),
      };
    });

  try {
    await page.goto(baseUrl + '/login.html');
    await page.fill('#usuario', 'ICONET');
    await page.fill('#contrasena', '4zxb63NyI43?');
    await Promise.all([page.waitForURL('**/app.html', { timeout: 15000 }), page.click('#botonIngresar')]);

    await page.goto(baseUrl + '/Comit%C3%A9s.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tablaComparacion', { timeout: 30000 });
    await page.evaluate(() => window.Sesion?.establecerEmpresaActiva?.('empresa1'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tablaComparacion', { timeout: 30000 });
    await sleep(2500);

    await page.evaluate(() => window.CuentasModulo?.setEditMode?.(true));
    const before = await snap();

    const res = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('#tablaComparacion tbody tr')).find((tr) => {
        const td = tr.querySelectorAll('td');
        const c0 = (td[0]?.textContent || '').trim();
        const c1 = (td[1]?.textContent || '').trim();
        return /POR\s*PROGRAMA/i.test(c0) && /COMIT/i.test(c1);
      });
      if (!row) return { found: false, removed: false };
      const removed = window.CuentasModulo?.eliminarFila?.(row);
      return { found: true, removed: Boolean(removed) };
    });

    await sleep(900);
    const after = await snap();

    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          deleteResult: res,
          before,
          after,
          assertions: {
            removedOneRow: before.total - after.total === 1,
            targetRemoved: after.targetRows.length === 0,
            sectionsStable: before.sections.length === after.sections.length,
            resOpsReducedByOne: before.resOpsRows - after.resOpsRows === 1,
          },
        },
        null,
        2,
      ),
      'utf8',
    );
  } finally {
    await browser.close();
  }
})();
