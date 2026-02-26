const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const baseUrl = 'http://127.0.0.1:3005';
  const outPath = path.join(process.cwd(), 'tmp', 'repro-delete-comites-cdmx.json');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1520, height: 1200 } });
  const page = await context.newPage();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const scan = async () =>
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
          text: (tr.textContent || '').replace(/\s+/g, ' ').trim(),
        };
      });
      return {
        total: mapped.length,
        sections: mapped.filter((r) => r.cls.includes('section-header-row')).map((r) => r.c1 || r.c0),
        targetRows: mapped.filter((r) => /POR\s*PROGRAMA/i.test(r.c0) && /COMIT/i.test(r.c1)),
      };
    });

  try {
    await page.goto(`${baseUrl}/login.html`);
    await page.fill('#usuario', 'ICONET');
    await page.fill('#contrasena', '4zxb63NyI43?');
    await Promise.all([
      page.waitForURL('**/app.html', { timeout: 15000 }),
      page.click('#botonIngresar'),
    ]);

    await page.goto(`${baseUrl}/Comit%C3%A9s.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tablaComparacion', { timeout: 30000 });
    await page.evaluate(() => window.Sesion?.establecerEmpresaActiva?.('empresa1'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tablaComparacion', { timeout: 30000 });
    await sleep(2600);

    await page.evaluate(() => window.CuentasModulo?.setEditMode?.(true));

    const before = await scan();

    const targetIndex = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#tablaComparacion tbody tr'));
      return rows.findIndex((tr) => {
        const td = tr.querySelectorAll('td');
        const c0 = (td[0]?.textContent || '').trim();
        const c1 = (td[1]?.textContent || '').trim();
        return /POR\s*PROGRAMA/i.test(c0) && /COMIT/i.test(c1);
      });
    });

    let menu = null;
    let clickedDelete = false;
    if (targetIndex >= 0) {
      const target = page.locator('#tablaComparacion tbody tr').nth(targetIndex);
      await target.click({ button: 'right' });
      await sleep(450);
      menu = await page.evaluate(() => {
        const el = document.querySelector('.planeacion-context-menu');
        const items = Array.from(document.querySelectorAll('.planeacion-context-menu button')).map((b) => (b.textContent || '').trim());
        const rect = el ? el.getBoundingClientRect() : null;
        return {
          exists: Boolean(el),
          hidden: el ? Boolean(el.hidden) : null,
          rect: rect ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height } : null,
          items,
        };
      });
      clickedDelete = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('.planeacion-context-menu button')).find((b) => /ELIMINAR\s+FILA/i.test((b.textContent || '').trim()));
        if (!btn) return false;
        btn.click();
        return true;
      });
      await sleep(1200);
    }

    const after = await scan();
    fs.writeFileSync(outPath, JSON.stringify({ targetIndex, menu, clickedDelete, before, after }, null, 2), 'utf8');
  } finally {
    await browser.close();
  }
})();
