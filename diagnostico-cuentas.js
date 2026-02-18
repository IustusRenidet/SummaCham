// Script de diagnóstico para verificar cuentas (especialmente consolidadas)
// Ejecutar en la consola del navegador

(async () => {
    console.log("=== DIAGNÓSTICO DE CUENTAS ===");

    // 1. Obtener contexto
    const empresaId = window.state?.empresaId || 'EMPRESA01';
    const anio = window.state?.anio || 2026;
    const modulo = window.state?.modulo || 'RESUMEN';
    const capitulo = window.state?.capitulo || 'GUADALAJARA';

    console.log(`Contexto: Empresa=${empresaId}, Año=${anio}, Modulo=${modulo}, Capitulo=${capitulo}`);

    // 2. Verificar en el estado local (si estamos en Plantillas)
    console.log("\n--- Verificando en estado local (window.state.cuentas) ---");
    if (window.state && Array.isArray(window.state.cuentas)) {
        const ctaLocal = window.state.cuentas.find(c => {
            const num = (c.CUENTA || c.cuenta || c.num_cta || "").toString();
            return num === "450-000-000-00";
        });

        if (ctaLocal) {
            console.log("✅ Cuenta 450-000-000-00 encontrada en el estado local:");
            console.log(ctaLocal);
        } else {
            console.log("❌ Cuenta 450-000-000-00 NO encontrada en el estado local.");
        }
    } else {
        console.log("⚠️ No hay estado local de cuentas (window.state.cuentas).");
    }

    // 3. Consultar API de Presupuestos (Base de datos real)
    console.log("\n--- Consultando API /api/presupuestos (Base de Datos) ---");
    try {
        // Necesitamos headers de auth si existen
        let headers = {};
        if (window.Sesion && window.Sesion.headersAutenticacion) {
            headers = window.Sesion.headersAutenticacion();
        } else if (window.Sesion && window.Sesion.token) {
            headers['Authorization'] = `Bearer ${window.Sesion.token}`;
        }

        // URL para obtener presupuesto global/mayor
        const url = `/api/presupuestos?empresaId=${encodeURIComponent(empresaId)}&anio=${anio}`;
        console.log(`Fetch: ${url}`);

        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const cuentasDB = data.cuentas || [];

        const ctaDB = cuentasDB.find(c => {
            const num = (c.NUM_CTA || c.num_cta || c.cuenta || "").toString().trim();
            return num === "450-000-000-00";
        });

        if (ctaDB) {
            console.log("✅ Cuenta 450-000-000-00 encontrada en DB (PRESUP):");
            console.log("Valores:", ctaDB);

            // Checar si tiene valores no cero
            const tieneValores = Object.keys(ctaDB).some(k => k.startsWith('PRESUP') && Number(ctaDB[k]) !== 0);
            if (tieneValores) {
                console.log("💰 La cuenta TIENE valores en el presupuesto.");
            } else {
                console.log("⚠️ La cuenta existe pero sus valores son 0.");
            }
        } else {
            console.log("❌ Cuenta 450-000-000-00 NO existe en la respuesta de presupuestos.");
            console.log("Nota: Si es una cuenta consolidada, asegúrate de haber corrido 'actualizar-presupuestos-consolidados'.");
        }

    } catch (err) {
        console.error("Error consultando API:", err);
    }

    console.log("=== FIN DIAGNÓSTICO ===");
})();
