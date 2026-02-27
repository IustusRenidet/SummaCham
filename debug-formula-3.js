/**
 * debug-formula-3.js - Usando los nombres de input correctos (usuario/contrasena)
 */
const { chromium } = require('playwright');

const LOGIN_URL = 'https://panelamcham.amcham.com.mx/login.html';
const PLANTILLAS_URL = 'https://panelamcham.amcham.com.mx/plantillas.html';
const USER = 'ICONET';
const PASS = '4zxb63NyI43?';

async function main() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Intercept API calls
    const apiCalls = [];
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/layouts')) {
            const body = await response.json().catch(() => null);
            apiCalls.push({ url, status: response.status(), body });
        }
    });

    // ── 1. Login ────────────────────────────────────────────────────────────────
    console.log('→ Login...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 30000 });

    await page.fill('#usuario', USER);
    await page.fill('#contrasena', PASS);

    // Encontrar el botón de submit
    const submitBtn = await page.$('button[type="submit"]') || await page.$('input[type="submit"]') || await page.$('button');
    if (submitBtn) {
        await submitBtn.click();
    } else {
        await page.keyboard.press('Enter');
    }

    await page.waitForURL('**/app.html', { timeout: 15000 }).catch(async () => {
        console.log('URL após click:', page.url());
        // Try to find and click the button by text
        await page.locator('button').first().click().catch(() => { });
        await page.waitForTimeout(3000);
        console.log('URL final:', page.url());
    });

    console.log('✓ URL:', page.url());

    // ── 2. Navegar a plantillas.html ─────────────────────────────────────────────
    await page.goto(PLANTILLAS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    console.log('→ En:', page.url());

    // ── 3. Obtener el empresaId y API base ────────────────────────────────────────
    const appInfo = await page.evaluate(() => {
        return {
            API_BASE: window.API_BASE || null,
            state: window.state ? {
                modulo: window.state.modulo,
                anio: window.state.anio,
                capitulo: window.state.capitulo,
                empresaId: window.state.empresaId,
            } : null,
            cookies: document.cookie,
            localStorage: Object.assign({}, localStorage),
            sessionStorage: Object.assign({}, sessionStorage),
        };
    });
    console.log('\nApp info:', JSON.stringify(appInfo, null, 2));

    // ── 4. Usar la API con cookies de sesión ─────────────────────────────────────
    // Intentar obtener la lista de módulos disponibles
    const modulosCheck = await page.evaluate(async () => {
        const apiBase = window.API_BASE || '/api/layouts';
        const empresaId = window.state?.empresaId || 'EMPRESA01';

        // Intentar obtener años para RESUMEN
        const results = {};
        const modulos = ['RESUMEN', 'RH', 'FINANZAS', 'COMITES', 'CDMX', 'GDL', 'MTY', 'QRO'];

        for (const m of modulos) {
            try {
                const res = await fetch(`${apiBase}/${m}/anios?empresaId=${empresaId}`, {
                    credentials: 'same-origin',
                    headers: { 'Accept': 'application/json' }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data.anios) && data.anios.length > 0) {
                        results[m] = data.anios;
                    }
                }
            } catch (e) { }
        }

        return { apiBase, empresaId, results };
    });

    console.log('\n=== MÓDULOS/AÑOS ===');
    console.log(JSON.stringify(modulosCheck, null, 2));

    // ── 5. Cargar un layout y analizar fórmulas ───────────────────────────────────
    const modulos = Object.keys(modulosCheck.results);
    if (modulos.length === 0) {
        // Intentar directamente con el selector en el UI
        console.log('\n→ Intentando seleccionar módulo desde UI...');

        const uiModulos = await page.evaluate(() => {
            const sel = document.getElementById('moduloSelect') || document.querySelector('[id*="modulo"]');
            return sel ? Array.from(sel.options).map(o => ({ value: o.value, text: o.text })) : [];
        });
        console.log('Módulos en UI:', JSON.stringify(uiModulos));

        // Intentar cargar un módulo
        if (uiModulos.length > 0) {
            await page.evaluate((firstModulo) => {
                const sel = document.getElementById('moduloSelect') || document.querySelector('[id*="modulo"]');
                if (sel) {
                    sel.value = firstModulo.value;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, uiModulos.find(m => m.value) || uiModulos[0]);

            await page.waitForTimeout(3000);
        }
    }

    // ── 6. Analizar formula terms directamente ────────────────────────────────────
    const formulaAnalysis = await page.evaluate(async () => {
        const apiBase = window.API_BASE || '/api/layouts';
        const empresaId = window.state?.empresaId || 'EMPRESA01';
        const results = [];

        // Obtener todos los módulos disponibles
        const res = await fetch(`${apiBase}/RESUMEN/2026/capitulos?empresaId=${empresaId}`, {
            credentials: 'same-origin'
        }).catch(() => null);

        if (res?.ok) {
            const data = await res.json();
            const capitulos = data.capitulos || [];

            for (const cap of capitulos.slice(0, 3)) {
                const layoutRes = await fetch(`${apiBase}/RESUMEN/2026/${encodeURIComponent(cap)}?empresaId=${empresaId}`, {
                    credentials: 'same-origin'
                }).catch(() => null);

                if (layoutRes?.ok) {
                    const layout = await layoutRes.json();
                    const ops = layout.layout?.operaciones || [];

                    results.push({
                        modulo: 'RESUMEN',
                        anio: 2026,
                        capitulo: cap,
                        opsTotal: ops.length,
                        opsConFormula: ops.filter(o => (o.formula_terms || []).length > 0 || o.formula_json).length,
                        sampleOps: ops.slice(0, 3).map(o => ({
                            id: o.OperacionId || o.Clase,
                            termsCount: (o.formula_terms || []).length,
                            terms: (o.formula_terms || []).map(t => `${t.operator || '+'}[${t.type}]${t.value}`),
                            formula_json_preview: o.formula_json ? String(o.formula_json).substring(0, 100) : null,
                        }))
                    });
                }
            }
        }

        return results;
    });

    console.log('\n=== ANÁLISIS DE FÓRMULAS ===');
    console.log(JSON.stringify(formulaAnalysis, null, 2));

    // ── 7. Intentar obtener las API calls que hizo el gestor ─────────────────────
    console.log('\n=== API CALLS CAPTURADAS ===');
    apiCalls.slice(0, 10).forEach(c => {
        console.log(`  ${c.status} ${c.url}`);
        if (c.body?.layout?.operaciones) {
            console.log(`    → ${c.body.layout.operaciones.length} operaciones`);
        }
    });

    await browser.close();
    console.log('\n✓ Diagnóstico completado');
}

main().catch(err => {
    console.error('Error fatal:', err.message);
    process.exit(1);
});
