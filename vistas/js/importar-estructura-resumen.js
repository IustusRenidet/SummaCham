/**
 * IMPORTADOR DE ESTRUCTURA RESUMEN 2025
 * 
 * Este script carga las 47 operaciones predefinidas en tu layout RESUMEN actual
 * Ejecuta esto desde la consola del navegador cuando estés en plantillas.html
 */

async function importarOperacionesResumen2025() {
  console.log("🔄 Iniciando importación de estructura RESUMEN 2025...");
  
  try {
    // 1. Intentar cargar desde JSON primero
    let estructura = null;
    
    const posiblesPaths = [
      "ESTRUCTURA_OPERACIONES_RESUMEN_2025.json",
      "./ESTRUCTURA_OPERACIONES_RESUMEN_2025.json",
      "../ESTRUCTURA_OPERACIONES_RESUMEN_2025.json"
    ];
    
    for (const path of posiblesPaths) {
      try {
        const response = await fetch(path);
        if (response.ok) {
          const text = await response.text();
          // Verificar que no sea HTML
          if (!text.trim().startsWith('<!DOCTYPE') && !text.trim().startsWith('<html')) {
            estructura = JSON.parse(text);
            console.log(`✅ JSON cargado desde: ${path}`);
            break;
          }
        }
      } catch (err) {
        console.log(`⚠️ No se pudo cargar desde ${path}`);
      }
    }
    
    // 2. Si no se pudo cargar, usar estructura embebida
    if (!estructura) {
      console.log("⚠️ No se pudo cargar JSON externo, usando estructura embebida");
      // Preguntar al usuario si desea continuar
      const continuar = confirm(
        "No se pudo cargar el archivo JSON de estructura.\n\n" +
        "¿Deseas usar la estructura embebida con las 47 operaciones predefinidas?"
      );
      
      if (!continuar) {
        console.log("❌ Importación cancelada por el usuario");
        return;
      }
      
      // Usar fetch inline del archivo local
      try {
        const response = await fetch('/ESTRUCTURA_OPERACIONES_RESUMEN_2025.json');
        if (response.ok) {
          estructura = await response.json();
        }
      } catch (err) {
        throw new Error(
          "No se pudo cargar la estructura. Asegúrate de que el archivo " +
          "ESTRUCTURA_OPERACIONES_RESUMEN_2025.json esté en la carpeta vistas/ o en la raíz del proyecto."
        );
      }
    }
    const operacionesNuevas = estructura.operaciones_orden_aparicion;
    
    console.log(`📦 Cargadas ${operacionesNuevas.length} operaciones del JSON`);
    
    // 2. Convertir al formato del sistema
    window.state = window.state || {};
    const operacionesConvertidas = operacionesNuevas.map((op, index) => {
      const newOp = {
        OperacionId: op.id,
        Clase: op.nombre,
        orden: op.orden || index + 1,
        CAPITULO: window.state.capitulo || "CIUDAD DE MÉXICO",
      };

      // Asignar tipo de fila
      switch (op.tipo) {
        case "sum-row":
          newOp["sum-row"] = op.nombre;
          if (op.cuentas) {
            newOp.SECCION = op.cuentas.join(" + ");
          }
          break;
        case "sum-row-sumavarios":
          newOp["sum-row-sumavarios"] = op.nombre;
          break;
        case "sum-row-sumavarios-consolidado":
          newOp["sum-row-sumavarios-consolidado"] = op.nombre;
          break;
        case "sum-row-operativo":
          newOp["sum-row-operativo"] = op.nombre;
          break;
        case "result-net-row":
          newOp["result-net-row"] = op.nombre;
          break;
      }

      // Asignar formula_terms
      if (op.formula_terms && op.formula_terms.length > 0) {
        newOp.formula_terms = op.formula_terms;
        
        // También llenar signos para compatibilidad
        newOp.signos = {};
        op.formula_terms.forEach((term, idx) => {
          const key = `seccion_${idx + 1}`;
          newOp[key] = term.value;
          newOp.signos[key] = term.operator === "-" ? -1 : 1;
        });
      }

      return newOp;
    });
    
    console.log(`✅ Convertidas ${operacionesConvertidas.length} operaciones`);
    
    // 3. Reemplazar operaciones en el estado
    if (!window.state) {
      throw new Error("❌ No se encontró window.state. Asegúrate de estar en la página de plantillas.");
    }
    
    window.state.operaciones = operacionesConvertidas;
    console.log(`✅ Operaciones actualizadas en window.state`);
    
    // 4. Renderizar
    if (typeof window.renderLayout === "function") {
      window.renderLayout();
      console.log(`✅ Layout renderizado`);
    } else {
      console.warn("⚠️ window.renderLayout no está disponible");
    }
    
    // 5. Guardar automáticamente
    const guardar = confirm(
      `✅ Se importaron ${operacionesConvertidas.length} operaciones.\n\n¿Deseas GUARDAR automáticamente?`
    );
    
    if (guardar && typeof window.saveLayout === "function") {
      await window.saveLayout();
      console.log(`💾 Layout guardado correctamente`);
    } else {
      console.log(`⚠️ No se guardó automáticamente. Haz clic en "Guardar" manualmente.`);
    }
    
    alert(`✅ Importación completada!\n\n${operacionesConvertidas.length} operaciones cargadas en el layout.`);
    
  } catch (error) {
    console.error("❌ Error en importación:", error);
    alert(`❌ Error: ${error.message}`);
  }
}

// Ejecutar automáticamente si se incluye en la página
if (typeof window !== "undefined") {
  window.importarOperacionesResumen2025 = importarOperacionesResumen2025;
  console.log("✅ Función importarOperacionesResumen2025() disponible");
  console.log("💡 Ejecuta: importarOperacionesResumen2025()");
}
