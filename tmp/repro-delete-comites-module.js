const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const baseUrl = 'http://127.0.0.1:3005';
  const outPath = path.join(process.cwd(), 'tmp', 'repro-delete-comites-module.json');
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
        resultadosOperativos: mapped.filter((r) => /RESULTADOS?\s+OPERATIVOS?/i.test(`${r.sec} ${r.c0} ${r.c1}`)).length,
        targetCount: mapped.filter((r) => /POR\s*PROGRAMA/i.test(r.c0) && /COMIT/i.test(r.c1)).length,
        sample: mapped.filter((r) => /POR\s*PROGRAMA|COMIT|RESULTADOS?\s+OPERATIVOS?/i.test(`${r.c0} ${r.c1} ${r.sec}`)).slice(0, 30),
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
    await page.evaluate(() => window.Sesion?.establecerEmpresaActiva?.('empresa2'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#tablaComparacion', { timeout: 30000 });
    await sleep(2600);

    await page.evaluate(() => {
      window.CuentasModulo?.setEditMode?.(true);
    });

    const before = await scan();

    const targetIndex = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#tablaComparacion tbody tr'));
      return rows.findIndex((tr) => {
        if (!tr.classList.contains('fila-cuenta') && !tr.classList.contains('account-row')) return false;
        const td = tr.querySelectorAll('td');
        const c0 = (td[0]?.textContent || '').trim();
        const c1 = (td[1]?.textContent || '').trim();
        return /POR\s*PROGRAMA/i.test(c0) && /COMIT/i.test(c1);
      });
    });

    if (targetIndex < 0) {
      fs.writeFileSync(outPath, JSON.stringify({ error: 'target-row-not-found', before }, null, 2), 'utf8');
      await browser.close();
      return;
    }

    const target = page.locator('#tablaComparacion tbody tr').nth(targetIndex);
    await target.click({ button: 'right' });
    await sleep(400);

    const menu = await page.evaluate(() => {
      const el = document.querySelector('.planeacion-context-menu');
      const items = Array.from(document.querySelectorAll('.planeacion-context-menu button')).map((b) => (b.textContent || '').trim());
      const rect = el ? el.getBoundingClientRect() : null;
      return {
        exists: Boolean(el),
        hidden: el ? Boolean(el.hidden) : null,
        rect: rect
          ? { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
          : null,
        items,
      };
    });

    const clickedDelete = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('.planeacion-context-menu button')).find((b) => /ELIMINAR\s+FILA/i.test((b.textContent || '').trim()));
      if (!btn) return false;
      btn.click();
      return true;
    });

    await sleep(1200);
    const after = await scan();

    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          targetIndex,
          menu,
          clickedDelete,
          before,
          after,
          assertions: {
            removedOneRow: before.total - after.total === 1,
            targetRemoved: after.targetCount === 0,
            sectionsStable: before.sections.length === after.sections.length,
            noExplosionResultadosOperativos: Math.abs(before.resultadosOperativos - after.resultadosOperativos) <= 1,
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
