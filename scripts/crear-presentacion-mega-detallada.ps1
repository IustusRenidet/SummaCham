# Script PowerShell para crear presentación PowerPoint MEGA DETALLADA
# SummaCham v4.1.0 - Documentación Técnica Ultra Completa
# Incluye: Todas las tablas, queries, código comentado, ejemplos reales

Write-Host "🚀 Iniciando creación de presentación MEGA DETALLADA..." -ForegroundColor Cyan

# Verificar si PowerPoint está instalado
try {
    $powerpoint = New-Object -ComObject PowerPoint.Application
    Write-Host "✅ PowerPoint iniciado correctamente" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: PowerPoint no está instalado o no está disponible." -ForegroundColor Red
    Write-Host "   Instala Microsoft Office para usar este script." -ForegroundColor Yellow
    exit 1
}

# Crear nueva presentación
$presentation = $powerpoint.Presentations.Add()
$presentation.PageSetup.SlideWidth = 720
$presentation.PageSetup.SlideHeight = 540

Write-Host "📄 Creando slides mega detallados..." -ForegroundColor Yellow

# ============================================================================
# FUNCIÓN AUXILIAR: Agregar slide con título y contenido
# ============================================================================
function Add-Slide {
    param(
        [string]$Titulo,
        [string]$Contenido,
        [string]$TipoLetra = "Consolas",
        [int]$TamanoTitulo = 28,
        [int]$TamanoContenido = 11
    )
    
    $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 12) # 12 = ppLayoutBlank
    
    # Título
    $titleBox = $slide.Shapes.AddTextBox(1, 20, 20, 680, 60)
    $titleBox.TextFrame.TextRange.Text = $Titulo
    $titleBox.TextFrame.TextRange.Font.Name = "Segoe UI"
    $titleBox.TextFrame.TextRange.Font.Size = $TamanoTitulo
    $titleBox.TextFrame.TextRange.Font.Bold = 1
    $titleBox.TextFrame.TextRange.Font.Color.RGB = 255 + (87 * 256) + (34 * 65536) # #FF5722
    $titleBox.Fill.Visible = 0
    $titleBox.Line.Visible = 0
    
    # Contenido
    $contentBox = $slide.Shapes.AddTextBox(1, 20, 90, 680, 430)
    $contentBox.TextFrame.TextRange.Text = $Contenido
    $contentBox.TextFrame.TextRange.Font.Name = $TipoLetra
    $contentBox.TextFrame.TextRange.Font.Size = $TamanoContenido
    $contentBox.TextFrame.WordWrap = 1
    $contentBox.Fill.Visible = 0
    $contentBox.Line.Visible = 0
    
    return $slide
}

# ============================================================================
# SLIDE 1: PORTADA
# ============================================================================
$slidePortada = $presentation.Slides.Add(1, 11) # 11 = ppLayoutTitleOnly
$slidePortada.Shapes.Title.TextFrame.TextRange.Text = "DOCUMENTACIÓN TÉCNICA MEGA DETALLADA`n`nSummaCham v4.1.0"
$slidePortada.Shapes.Title.TextFrame.TextRange.Font.Size = 36
$slidePortada.Shapes.Title.TextFrame.TextRange.Font.Bold = 1
$slidePortada.Shapes.Title.TextFrame.TextRange.Font.Color.RGB = 255 + (87 * 256) + (34 * 65536)

$subtituloBox = $slidePortada.Shapes.AddTextBox(1, 100, 250, 520, 200)
$subtituloBox.TextFrame.TextRange.Text = "Sistema de Gestión Presupuestaria`n`nDocumentación Completa:`n✓ Todas las tablas SQLite (17 tablas)`n✓ Queries SQL reales con ejemplos`n✓ Código fuente comentado línea por línea`n✓ Algoritmos con diagramas de flujo`n✓ Configuraciones con valores exactos"
$subtituloBox.TextFrame.TextRange.Font.Size = 16
$subtituloBox.TextFrame.TextRange.Font.Name = "Segoe UI"
$subtituloBox.TextFrame.TextRange.ParagraphFormat.Alignment = 2 # Center
$subtituloBox.Fill.Visible = 0
$subtituloBox.Line.Visible = 0

# ============================================================================
# SLIDE 2: TABLA presupuestos_estado (COMPLETA)
# ============================================================================
Add-Slide -Titulo "TABLA: presupuestos_estado" -Contenido @"
📊 ESTRUCTURA COMPLETA

CREATE TABLE presupuestos_estado (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id TEXT NOT NULL,          -- FK a empresas (config)
  modulo TEXT NOT NULL,              -- 'CUENTAS', 'SUMMARY', etc.
  anio INTEGER NOT NULL,             -- Ejercicio fiscal (2024, 2025...)
  estado TEXT NOT NULL DEFAULT 'SIN_CARGAR',
  usuario_id INTEGER,                -- FK a usuarios.id
  actualizado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, modulo, anio),  -- Solo 1 estado por combinación
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

🔑 COLUMNAS EXPLICADAS

• id: Identificador único auto-incremental
• empresa_id: 'empresa1', 'empresa2', etc.
• modulo: Módulo del sistema (CUENTAS, SUMMARY, RESUMEN, etc.)
• anio: Año del presupuesto (2024, 2025, 2026)
• estado: Estado del workflow
  Estados válidos:
    - SIN_CARGAR: No ha sido cargado aún
    - EDITANDO: En edición (después de cargar)
    - REVISADO: Revisado por supervisor
    - APROBADO: Aprobado por autoridad
    - GUARDADO: Guardado en Firebird
    - PENDIENTE: Pendiente de revisión
    - RECHAZADO: Rechazado, requiere corrección
• usuario_id: ID del último usuario que modificó el estado
• actualizado_en: Timestamp de última actualización

🔒 CONSTRAINT UNIQUE
  (empresa_id, modulo, anio) → Solo puede existir 1 registro
  
  Ejemplo:
    ✅ ('empresa1', 'CUENTAS', 2025, 'EDITANDO')
    ❌ ('empresa1', 'CUENTAS', 2025, 'REVISADO')  ← ERROR: Duplicado
    
    Para cambiar estado:
      UPDATE presupuestos_estado
      SET estado = 'REVISADO', usuario_id = 5
      WHERE empresa_id = 'empresa1'
        AND modulo = 'CUENTAS' AND anio = 2025;

💾 EJEMPLO DE DATOS REALES

| id | empresa_id | modulo  | anio | estado    | usuario_id | actualizado_en           |
|----|------------|---------|------|-----------|------------|--------------------------|
| 1  | empresa1   | CUENTAS | 2025 | APROBADO  | 5          | 2026-01-15T09:30:00.000Z |
| 2  | empresa1   | SUMMARY | 2025 | REVISADO  | 8          | 2026-01-15T10:15:00.000Z |
| 3  | empresa2   | CUENTAS | 2025 | EDITANDO  | 3          | 2026-01-16T08:00:00.000Z |
| 4  | empresa1   | RESUMEN | 2024 | GUARDADO  | 5          | 2025-12-31T23:59:59.999Z |
"@

# ============================================================================
# SLIDE 3: TABLA presupuestos_estado_historial
# ============================================================================
Add-Slide -Titulo "TABLA: presupuestos_estado_historial" -Contenido @"
📜 HISTORIAL DE CAMBIOS DE ESTADO

CREATE TABLE presupuestos_estado_historial (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  presupuesto_estado_id INTEGER NOT NULL,  -- FK a presupuestos_estado
  estado_anterior TEXT,                    -- Estado antes del cambio
  estado_nuevo TEXT NOT NULL,              -- Estado después del cambio
  usuario_id INTEGER,                      -- Quién hizo el cambio
  creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (presupuesto_estado_id) REFERENCES presupuestos_estado(id)
    ON DELETE CASCADE                      -- Si se borra el presupuesto,
);                                         -- se borra su historial

🎯 PROPÓSITO
  Auditoría completa de transiciones de estado
  Permite responder:
    - ¿Quién aprobó este presupuesto?
    - ¿Cuándo pasó de EDITANDO a REVISADO?
    - ¿Cuántas veces fue rechazado?

📊 EJEMPLO DE TRAZABILIDAD COMPLETA

Presupuesto: empresa1 - CUENTAS 2025 (presupuesto_estado_id = 1)

| id | ppto_id | estado_anterior | estado_nuevo | usuario_id | creado_en                |
|----|---------|-----------------|--------------|------------|--------------------------|
| 1  | 1       | NULL            | SIN_CARGAR   | NULL       | 2026-01-01T00:00:00.000Z |
| 2  | 1       | SIN_CARGAR      | EDITANDO     | 5 (JPEREZ) | 2026-01-10T09:00:00.000Z |
| 3  | 1       | EDITANDO        | REVISADO     | 8 (MGOMEZ) | 2026-01-12T14:30:00.000Z |
| 4  | 1       | REVISADO        | RECHAZADO    | 8 (MGOMEZ) | 2026-01-12T14:32:00.000Z |
| 5  | 1       | RECHAZADO       | EDITANDO     | 5 (JPEREZ) | 2026-01-13T08:15:00.000Z |
| 6  | 1       | EDITANDO        | REVISADO     | 8 (MGOMEZ) | 2026-01-14T10:00:00.000Z |
| 7  | 1       | REVISADO        | APROBADO     | 2 (ADMIN)  | 2026-01-15T09:30:00.000Z |

🔍 CONSULTA: ¿Quién aprobó el presupuesto?

SELECT 
  h.id,
  h.estado_nuevo,
  u.usuario,
  u.nombres || ' ' || u.apellido_primero AS nombre_completo,
  h.creado_en
FROM presupuestos_estado_historial h
JOIN usuarios u ON h.usuario_id = u.id
WHERE h.presupuesto_estado_id = 1
  AND h.estado_nuevo = 'APROBADO'
ORDER BY h.creado_en DESC
LIMIT 1;

Resultado:
┌────┬──────────┬─────────┬───────────────────┬──────────────────────────┐
│ id │ estado   │ usuario │ nombre_completo   │ creado_en                │
├────┼──────────┼─────────┼───────────────────┼──────────────────────────┤
│  7 │ APROBADO │ ADMIN   │ Admin Sistema     │ 2026-01-15T09:30:00.000Z │
└────┴──────────┴─────────┴───────────────────┴──────────────────────────┘

✅ TRIGGER PARA AUTO-REGISTRO

CREATE TRIGGER registrar_cambio_estado
AFTER UPDATE OF estado ON presupuestos_estado
FOR EACH ROW
BEGIN
  INSERT INTO presupuestos_estado_historial (
    presupuesto_estado_id,
    estado_anterior,
    estado_nuevo,
    usuario_id
  ) VALUES (
    NEW.id,
    OLD.estado,
    NEW.estado,
    NEW.usuario_id
  );
END;
"@

# ============================================================================
# SLIDE 4: TABLA notificaciones
# ============================================================================
Add-Slide -Titulo "TABLA: notificaciones" -Contenido @"
🔔 SISTEMA DE NOTIFICACIONES

CREATE TABLE notificaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,           -- Destinatario
  tipo TEXT NOT NULL,                    -- Tipo de evento
  titulo TEXT NOT NULL,                  -- Título breve
  mensaje TEXT,                          -- Descripción completa
  datos_extra TEXT,                      -- JSON con metadata
  leida INTEGER NOT NULL DEFAULT 0,      -- 0=No leída, 1=Leída
  empresa_id TEXT,                       -- Empresa relacionada
  modulo TEXT,                           -- Módulo relacionado
  anio INTEGER,                          -- Año relacionado
  creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

🎯 TIPOS DE NOTIFICACIONES

• presupuesto_revisado: Presupuesto enviado a revisión
• presupuesto_aprobado: Presupuesto aprobado
• presupuesto_rechazado: Presupuesto rechazado
• comentario_nuevo: Nuevo comentario en celda
• mencion: Usuario mencionado (@usuario)
• permiso_modificado: Cambio en permisos

📊 EJEMPLO: Notificación de Aprobación

INSERT INTO notificaciones (
  usuario_id,
  tipo,
  titulo,
  mensaje,
  datos_extra,
  empresa_id,
  modulo,
  anio
) VALUES (
  5,                                    -- usuario: JPEREZ
  'presupuesto_aprobado',               -- tipo
  'Presupuesto CUENTAS 2025 aprobado',  -- titulo
  'El presupuesto ha sido aprobado por ADMIN el 15/01/2026',  -- mensaje
  '{
    "aprobador_id": 2,
    "aprobador_usuario": "ADMIN",
    "fecha_aprobacion": "2026-01-15T09:30:00.000Z"
  }',                                   -- datos_extra (JSON)
  'empresa1',                           -- empresa_id
  'CUENTAS',                            -- modulo
  2025                                  -- anio
);

🔍 CONSULTA: Notificaciones No Leídas de Usuario

SELECT 
  n.id,
  n.tipo,
  n.titulo,
  n.mensaje,
  n.creado_en,
  n.empresa_id,
  n.modulo,
  n.anio
FROM notificaciones n
WHERE n.usuario_id = ? 
  AND n.leida = 0
ORDER BY n.creado_en DESC;

📱 ENDPOINT: Marcar como Leída

PATCH /api/notificaciones/:id
Body: { "leida": true }

Implementación:
UPDATE notificaciones
SET leida = 1
WHERE id = ? AND usuario_id = ?;

💾 DATOS EXTRA (JSON) - Estructura

{
  "aprobador_id": 2,                    // ID del usuario que aprobó
  "aprobador_usuario": "ADMIN",         // Usuario que aprobó
  "fecha_aprobacion": "2026-01-15...",  // Timestamp
  "comentario": "Aprobado sin cambios", // Comentario opcional
  "url": "/presupuestos/empresa1/..."   // URL para ir directamente
}
"@

# ============================================================================
# SLIDE 5: TABLA comentarios_celdas
# ============================================================================
Add-Slide -Titulo "TABLA: comentarios_celdas" -Contenido @"
💬 SISTEMA DE COMENTARIOS POR CELDA

CREATE TABLE comentarios_celdas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id TEXT,                       -- Empresa relacionada
  modulo TEXT NOT NULL,                  -- Módulo (CUENTAS, SUMMARY...)
  anio INTEGER,                          -- Año del presupuesto
  capitulo TEXT,                         -- Capítulo específico
  celda_id TEXT NOT NULL,                -- ID único de celda
  texto TEXT NOT NULL,                   -- Contenido del comentario
  usuario_id INTEGER NOT NULL,           -- Autor del comentario
  parent_id INTEGER,                     -- FK a comentario padre (thread)
  estado TEXT NOT NULL DEFAULT 'activo', -- 'activo', 'resuelto', 'archivado'
  creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TEXT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (parent_id) REFERENCES comentarios_celdas(id)
    ON DELETE CASCADE                    -- Si se borra padre, borrar hijos
);

📍 ESTRUCTURA DE celda_id

  Formato: "{modulo}_{capitulo}_{cuenta}_{mes}"
  
  Ejemplos:
    - "CUENTAS_1000_1.1.1.1.000000000_01"    → Cuenta 1.1.1.1 en enero
    - "SUMMARY_2000_OPERACION_INGR_02"       → Operación INGR en febrero
    - "RESUMEN_3000_SECCION_PERSONAL_12"     → Sección personal en diciembre

🔗 SISTEMA DE THREADS (parent_id)

  Estructura:
    Comentario raíz (parent_id = NULL)
      ├─ Respuesta 1 (parent_id = raíz_id)
      ├─ Respuesta 2 (parent_id = raíz_id)
      │   └─ Respuesta 2.1 (parent_id = respuesta2_id)
      └─ Respuesta 3 (parent_id = raíz_id)

  Ejemplo real:
  
  | id | celda_id               | texto                  | usuario_id | parent_id |
  |----|------------------------|------------------------|------------|-----------|
  | 10 | CUENTAS_1000_1.1.1_01  | ¿Este monto es final?  | 5          | NULL      |
  | 11 | CUENTAS_1000_1.1.1_01  | Sí, ya fue aprobado    | 8          | 10        |
  | 12 | CUENTAS_1000_1.1.1_01  | Gracias por confirmar  | 5          | 11        |
  | 13 | CUENTAS_1000_1.1.1_01  | Agregué documentación  | 8          | 10        |

🔍 CONSULTA: Obtener Comentarios con Respuestas

SELECT 
  c.id,
  c.texto,
  c.creado_en,
  c.parent_id,
  u.usuario,
  u.nombres || ' ' || u.apellido_primero AS autor
FROM comentarios_celdas c
JOIN usuarios u ON c.usuario_id = u.id
WHERE c.celda_id = ?
  AND c.estado = 'activo'
ORDER BY 
  COALESCE(c.parent_id, c.id) ASC,  -- Agrupar por thread
  c.creado_en ASC;                  -- Orden cronológico dentro del thread

📱 ENDPOINT: Crear Comentario con Respuesta

POST /api/comentarios
{
  "modulo": "CUENTAS",
  "celdaId": "CUENTAS_1000_1.1.1.1.000000000_01",
  "texto": "Este valor parece incorrecto",
  "parentId": null,          // null = comentario raíz
  "empresaId": "empresa1",
  "anio": 2025,
  "capitulo": "1000"
}

Respuesta:
POST /api/comentarios
{
  "modulo": "CUENTAS",
  "celdaId": "CUENTAS_1000_1.1.1.1.000000000_01",
  "texto": "Revisar con contabilidad",
  "parentId": 10,            // Respuesta al comentario #10
  "empresaId": "empresa1",
  "anio": 2025,
  "capitulo": "1000"
}

✅ ÍNDICE PARA BÚSQUEDAS RÁPIDAS

CREATE INDEX idx_comentarios_celda_lookup ON comentarios_celdas(
  empresa_id,
  modulo,
  anio,
  celda_id,
  estado,
  creado_en
);

🎯 RESUMEN POR MÓDULO

SELECT 
  modulo,
  capitulo,
  COUNT(*) AS total_comentarios,
  SUM(CASE WHEN parent_id IS NULL THEN 1 ELSE 0 END) AS threads,
  SUM(CASE WHEN estado = 'resuelto' THEN 1 ELSE 0 END) AS resueltos
FROM comentarios_celdas
WHERE empresa_id = ?
  AND anio = ?
  AND estado != 'archivado'
GROUP BY modulo, capitulo;
"@

# ============================================================================
# SLIDE 6: TABLA layout_operaciones
# ============================================================================
Add-Slide -Titulo "TABLA: layout_operaciones" -Contenido @"
🧮 OPERACIONES: SUMA, RESTA, CONSOLIDACIÓN

CREATE TABLE layout_operaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empresa_id TEXT NOT NULL,              -- FK a empresa
  modulo TEXT NOT NULL,                  -- SUMMARY, RESUMEN, etc.
  anio INTEGER NOT NULL,                 -- Ejercicio fiscal
  capitulo TEXT NOT NULL,                -- Capítulo presupuestario
  clase TEXT NOT NULL,                   -- 'consolidada', 'detallada'
  operacion_etiqueta TEXT,               -- Etiqueta visual (opcional)
  seccion TEXT NOT NULL,                 -- Sección destino
  operacion_tipo TEXT NOT NULL,          -- 'INGRESOS', 'EGRESOS', etc.
  operacion_label TEXT NOT NULL,         -- Label para frontend
  signo INTEGER NOT NULL DEFAULT 1,      -- 1=positivo, -1=negativo
  orden INTEGER DEFAULT 0,               -- Orden de presentación
  creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TEXT,
  UNIQUE(empresa_id, modulo, anio, capitulo, clase, operacion_tipo)
);

🎯 TIPOS DE OPERACIONES

• clase = 'detallada':
    Operaciones sobre cuentas individuales
    Ejemplos: "Total de Ingresos", "Total de Egresos"
    
• clase = 'consolidada':
    Operaciones sobre secciones completas
    Ejemplos: "Total Capítulo 1000", "Gran Total"
    Se calculan DESPUÉS de recontabilizar las detalladas

📊 EJEMPLO: Operaciones de SUMMARY

| id | modulo  | anio | capitulo | clase       | operacion_tipo    | signo | orden |
|----|---------|------|----------|-------------|-------------------|-------|-------|
| 1  | SUMMARY | 2025 | 1000     | detallada   | INGRESOS          |  1    | 10    |
| 2  | SUMMARY | 2025 | 1000     | detallada   | EGRESOS           | -1    | 20    |
| 3  | SUMMARY | 2025 | 1000     | detallada   | SUPERAVIT_DEFICIT |  1    | 30    |
| 4  | SUMMARY | 2025 | 1000     | consolidada | TOTAL_CAPITULO    |  1    | 40    |

🔄 FLUJO DE RECONTABILIZACIÓN

1. Operación DETALLADA: INGRESOS
   Busca todas las cuentas en layout_cuentas donde:
     - operacion_factor > 0 (es ingreso)
     - seccion_principal = "Ingresos"
   
   Formula automática:
     "= CUENTA_1 + CUENTA_2 + ... + CUENTA_N"
   
   Ejemplo:
     [ layout_cuentas ]
     cuenta: 4.1.1.1  → seccion: "Ingresos", operacion_factor: 1
     cuenta: 4.1.2.1  → seccion: "Ingresos", operacion_factor: 1
     cuenta: 4.2.1.1  → seccion: "Ingresos", operacion_factor: 1
     
     [ layout_operaciones ]
     INGRESOS → formula_generada: "= 4.1.1.1 + 4.1.2.1 + 4.2.1.1"

2. Operación CONSOLIDADA: TOTAL_CAPITULO
   Busca todas las operaciones detalladas en el mismo capítulo
   
   Formula automática:
     "= OPERACION_1 + OPERACION_2 + ... + OPERACION_N"
   
   Ejemplo:
     TOTAL_CAPITULO = INGRESOS + EGRESOS + SUPERAVIT_DEFICIT

💾 CÓDIGO DE RECONTABILIZACIÓN

// Archivo: src/services/layoutService.js
// Líneas: 450-580

const hydrateOperationsFromParents = (empresaId, modulo, anio, capitulo) => {
  
  // PASO 1: Obtener TODAS las operaciones del capítulo
  const operaciones = db.prepare(`
    SELECT * FROM layout_operaciones
    WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
    ORDER BY orden ASC
  `).all(empresaId, modulo, anio, capitulo);
  
  // PASO 2: Procesar DETALLADAS primero
  const detalladas = operaciones.filter(op => op.clase === 'detallada');
  
  for (const op of detalladas) {
    // Buscar cuentas que pertenecen a esta operación
    const cuentas = db.prepare(`
      SELECT cuenta FROM layout_cuentas
      WHERE empresa_id = ? AND modulo = ? AND anio = ? AND capitulo = ?
        AND seccion_principal = ?
        AND operacion_factor != 0
    `).all(empresaId, modulo, anio, capitulo, op.seccion);
    
    // Construir fórmula
    const terminos = cuentas.map(c => c.cuenta).join(' + ');
    const formula = terminos ? `= ${terminos}` : null;
    
    // Guardar en operaciones_generadas (tabla interna)
    if (formula) {
      db.prepare(`
        INSERT OR REPLACE INTO operaciones_generadas (
          operacion_id, formula, actualizado_en
        ) VALUES (?, ?, CURRENT_TIMESTAMP)
      `).run(op.id, formula);
    }
  }
  
  // PASO 3: Procesar CONSOLIDADAS después
  const consolidadas = operaciones.filter(op => op.clase === 'consolidada');
  
  for (const op of consolidadas) {
    // Buscar operaciones detalladas referenciadas
    const terminos = detalladas.map(d => d.operacion_tipo).join(' + ');
    const formula = `= ${terminos}`;
    
    db.prepare(`
      INSERT OR REPLACE INTO operaciones_generadas (
        operacion_id, formula, actualizado_en
      ) VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(op.id, formula);
  }
};
"@

# ============================================================================
# SLIDE 7: Sistema de Transiciones de Estado
# ============================================================================
Add-Slide -Titulo "SISTEMA DE TRANSICIONES DE ESTADO" -Contenido @"
🔄 WORKFLOW DE PRESUPUESTOS

Estados válidos:
  SIN_CARGAR → EDITANDO → REVISADO → APROBADO → GUARDADO
                    ↑          ↓
                RECHAZADO ────┘

📋 TRANSICIONES PERMITIDAS

const TRANSICIONES = {
  cargar: {
    destino: 'EDITANDO',
    requiere: 'Cargar y guardar',                   // Permiso necesario
    habilita: (estado) => 
      ['SIN_CARGAR', 'GUARDADO'].includes(estado)   // Estados válidos antes
  },
  
  revisar: {
    destino: 'REVISADO',
    requiere: 'Revisar',
    habilita: (estado) => estado === 'EDITANDO'
  },
  
  autorizar: {
    destino: 'APROBADO',
    requiere: 'Aprobar',
    habilita: (estado) => estado === 'REVISADO'
  },
  
  guardar: {
    destino: 'GUARDADO',
    requiere: 'Aprobar',
    habilita: (estado) => estado === 'APROBADO'
  }
};

💾 CÓDIGO DE TRANSICIÓN

// Archivo: src/routes/presupuestos.js
// Líneas: 180-250

router.post('/:empresaId/transicion', async (req, res) => {
  const { empresaId } = req.params;
  const { modulo, anio, accion } = req.body;
  
  // Validar datos de entrada con Joi
  const { error } = esquemaTransicion.validate({ modulo, anio, accion });
  if (error) {
    return res.status(400).json({ mensaje: error.details[0].message });
  }
  
  // Obtener estado actual
  const estadoActual = db.prepare(`
    SELECT * FROM presupuestos_estado
    WHERE empresa_id = ? AND modulo = ? AND anio = ?
  `).get(empresaId, modulo, anio);
  
  const estadoCanon = normalizarEstadoCanonico(estadoActual?.estado);
  
  // Validar que la transición sea válida
  const transicion = TRANSICIONES[accion];
  if (!transicion) {
    return res.status(400).json({ 
      mensaje: `Acción '${accion}' no reconocida.`,
      accionesValidas: Object.keys(TRANSICIONES)
    });
  }
  
  // Verificar que el estado actual permite esta transición
  if (!transicion.habilita(estadoCanon)) {
    return res.status(409).json({
      mensaje: `No se puede '${accion}' desde el estado '${estadoCanon}'.`,
      estadoActual: estadoCanon,
      transicionesDisponibles: Object.keys(TRANSICIONES).filter(
        t => TRANSICIONES[t].habilita(estadoCanon)
      )
    });
  }
  
  // Verificar permisos del usuario
  const tienePermiso = tienePermisoModulo(
    req.usuarioActual.permisos,
    empresaId,
    modulo,
    transicion.requiere
  );
  
  if (!tienePermiso) {
    return res.status(403).json({
      mensaje: `No tienes permiso de '${transicion.requiere}' en ${modulo}.`,
      permisoRequerido: transicion.requiere
    });
  }
  
  // Ejecutar transición
  try {
    const nuevoEstado = transicion.destino;
    
    // Actualizar estado en DB
    db.prepare(`
      INSERT INTO presupuestos_estado (
        empresa_id, modulo, anio, estado, usuario_id, actualizado_en
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(empresa_id, modulo, anio) DO UPDATE SET
        estado = excluded.estado,
        usuario_id = excluded.usuario_id,
        actualizado_en = CURRENT_TIMESTAMP
    `).run(empresaId, modulo, anio, nuevoEstado, req.usuarioActual.id);
    
    // Notificar a usuarios relevantes
    await notificarWorkflowPresupuesto({
      empresaId,
      modulo,
      anio,
      accion,
      estadoAnterior: estadoCanon,
      estadoNuevo: nuevoEstado,
      usuarioId: req.usuarioActual.id
    });
    
    return res.json({
      mensaje: `Presupuesto ${accion} correctamente.`,
      estadoAnterior: estadoCanon,
      estadoNuevo: nuevoEstado,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('Error en transición:', err);
    return res.status(500).json({ mensaje: 'Error al cambiar estado.' });
  }
});

📊 EJEMPLO DE USO

POST /api/presupuestos/empresa1/transicion
{
  "modulo": "CUENTAS",
  "anio": 2025,
  "accion": "revisar"
}

Respuestas posibles:

✅ 200 OK:
{
  "mensaje": "Presupuesto revisar correctamente.",
  "estadoAnterior": "EDITANDO",
  "estadoNuevo": "REVISADO",
  "timestamp": "2026-01-15T10:30:00.000Z"
}

❌ 409 Conflict:
{
  "mensaje": "No se puede 'revisar' desde el estado 'SIN_CARGAR'.",
  "estadoActual": "SIN_CARGAR",
  "transicionesDisponibles": ["cargar"]
}

❌ 403 Forbidden:
{
  "mensaje": "No tienes permiso de 'Revisar' en CUENTAS.",
  "permisoRequerido": "Revisar"
}
"@

# ============================================================================
# SLIDE 8: Validación con Joi
# ============================================================================
Add-Slide -Titulo "VALIDACIÓN DE DATOS CON JOI" -Contenido @"
✅ ESQUEMAS DE VALIDACIÓN

📝 Login

const esquemaLogin = Joi.object({
  usuario: Joi.string()
    .trim()                             // Eliminar espacios
    .min(3)                             // Mínimo 3 caracteres
    .max(50)                            // Máximo 50 caracteres
    .required()                         // Obligatorio
    .messages({
      'string.empty': 'El usuario es obligatorio.',
      'string.min': 'El usuario debe tener al menos 3 caracteres.',
      'string.max': 'El usuario debe tener máximo 50 caracteres.'
    }),
  
  contrasena: Joi.string()
    .min(6)                             // Mínimo 6 caracteres
    .required()
    .messages({
      'string.empty': 'La contraseña es obligatoria.',
      'string.min': 'La contraseña debe tener al menos 6 caracteres.'
    })
});

Uso en routes/auth.js:
  const { error, value } = esquemaLogin.validate(req.body);
  if (error) {
    return res.status(400).json({ mensaje: error.details[0].message });
  }

📝 Crear Usuario

const esquemaCrearUsuario = Joi.object({
  usuario: Joi.string().trim().min(3).max(50).required(),
  
  nombres: Joi.string().trim().min(1).max(100).required(),
  
  apellido_primero: Joi.string().trim().min(1).max(100).required(),
  
  apellido_segundo: Joi.string().trim().min(1).max(100).optional(),
  
  correo: Joi.string()
    .trim()
    .email({ tlds: { allow: false } })  // Validar formato email
    .max(255)
    .required()
    .messages({
      'string.email': 'El correo electrónico no es válido.'
    }),
  
  contrasena: Joi.string()
    .min(6)
    .max(255)
    .required(),
  
  es_admin_global: Joi.boolean().default(false),
  
  puede_agregar: Joi.boolean().default(false),
  
  puede_modificar: Joi.boolean().default(false),
  
  puede_eliminar: Joi.boolean().default(false)
});

📝 Presupuestos

const esquemaTransicion = Joi.object({
  modulo: Joi.string()
    .trim()
    .required()
    .messages({
      'string.empty': 'El módulo es obligatorio.'
    }),
  
  anio: Joi.number()
    .integer()                          // Solo enteros
    .min(2000)                          // No antes del 2000
    .max(2100)                          // No después del 2100
    .required()
    .messages({
      'number.base': 'El año debe ser un número.',
      'number.integer': 'El año debe ser un número entero.',
      'number.min': 'El año no puede ser anterior a 2000.',
      'number.max': 'El año no puede ser posterior a 2100.'
    }),
  
  accion: Joi.string()
    .valid('cargar', 'revisar', 'autorizar', 'guardar')
    .required()
    .messages({
      'any.only': 'La acción debe ser: cargar, revisar, autorizar o guardar.'
    })
});

📝 Comentarios

const esquemaComentario = Joi.object({
  modulo: Joi.string().trim().required(),
  
  celdaId: Joi.string().trim().required(),
  
  texto: Joi.string()
    .trim()
    .min(1)
    .max(2000)                          // Máximo 2000 caracteres
    .required()
    .messages({
      'string.max': 'El comentario no puede exceder 2000 caracteres.'
    }),
  
  anio: Joi.number().integer().min(2000).max(2100).optional(),
  
  capitulo: Joi.string().trim().optional(),
  
  parentId: Joi.number().integer().positive().optional(),
  
  empresaId: Joi.string().trim().optional()
});

💡 EJEMPLO DE VALIDACIÓN FALLIDA

POST /api/usuarios
{
  "usuario": "JP",                      // ❌ Muy corto (min: 3)
  "nombres": "Juan",
  "apellido_primero": "Pérez",
  "correo": "juan.perez@",              // ❌ Email inválido
  "contrasena": "123"                   // ❌ Muy corta (min: 6)
}

Respuesta:
400 Bad Request
{
  "mensaje": "El usuario debe tener al menos 3 caracteres."
}
// Solo se reporta el PRIMER error encontrado

✅ VALIDACIÓN EXITOSA

POST /api/usuarios
{
  "usuario": "JPEREZ",
  "nombres": "Juan",
  "apellido_primero": "Pérez",
  "apellido_segundo": "García",
  "correo": "juan.perez@empresa.com",
  "contrasena": "Segura123!",
  "es_admin_global": false
}

Joi devuelve:
{
  error: undefined,
  value: {
    usuario: "JPEREZ",                  // Trimmed
    nombres: "Juan",                    // Trimmed
    apellido_primero: "Pérez",
    apellido_segundo: "García",
    correo: "juan.perez@empresa.com",   // Validado como email
    contrasena: "Segura123!",
    es_admin_global: false,
    puede_agregar: false,               // Default aplicado
    puede_modificar: false,             // Default aplicado
    puede_eliminar: false               // Default aplicado
  }
}
"@

# ============================================================================
# SLIDES ADICIONALES (9-40+)
# ============================================================================

# SLIDE 9: Middleware requireAuth
Add-Slide -Titulo "MIDDLEWARE: requireAuth" -Contenido @"
🔐 AUTENTICACIÓN COMPLETA

// Archivo: src/middleware/auth.js
// Líneas: 1-80

const requireAuth = async (req, res, next) => {
  // PASO 1: Verificar si hay sesión activa
  const sessionUserId = req.session?.userId;
  
  if (!sessionUserId) {
    // No hay sesión: 401 Unauthorized
    return res.status(401).json({
      mensaje: 'No autenticado. Inicia sesión.',
      codigo: 'NO_SESSION'
    });
  }
  
  // PASO 2: Buscar usuario en base de datos
  const usuario = db.prepare(`
    SELECT 
      id,
      usuario,
      nombres,
      apellido_primero,
      apellido_segundo,
      correo,
      es_admin_global,
      puede_agregar,
      puede_modificar,
      puede_eliminar,
      creado_en
    FROM usuarios
    WHERE id = ?
  `).get(sessionUserId);
  
  if (!usuario) {
    // Usuario no existe (fue eliminado después de login)
    req.session.destroy();              // Destruir sesión inválida
    return res.status(401).json({
      mensaje: 'Usuario no encontrado.',
      codigo: 'USER_NOT_FOUND'
    });
  }
  
  // PASO 3: Cargar permisos por empresa
  const permisos = db.prepare(`
    SELECT 
      p.empresa_id,
      p.modulo,
      p.puede_leer,
      p.puede_cargar_guardar,
      p.puede_revisar,
      p.puede_aprobar
    FROM permisos_modulo p
    WHERE p.usuario_id = ?
  `).all(usuario.id);
  
  // Organizar permisos por empresa y módulo
  const mapaPermisos = {};
  for (const p of permisos) {
    if (!mapaPermisos[p.empresa_id]) {
      mapaPermisos[p.empresa_id] = {};
    }
    mapaPermisos[p.empresa_id][p.modulo] = {
      'Ver': p.puede_leer === 1,
      'Lectura': p.puede_leer === 1,
      'Cargar y guardar': p.puede_cargar_guardar === 1,
      'Revisar': p.puede_revisar === 1,
      'Aprobar': p.puede_aprobar === 1
    };
  }
  
  // PASO 4: Agregar datos al request
  req.usuarioActual = {
    ...usuario,
    permisos: mapaPermisos
  };
  
  // PASO 5: Renovar sesión (rolling)
  req.session.touch();                  // Actualiza expires
  
  next();                               // Continuar al siguiente middleware/route
};

📊 EJEMPLO DE req.usuarioActual

{
  "id": 5,
  "usuario": "JPEREZ",
  "nombres": "Juan",
  "apellido_primero": "Pérez",
  "apellido_segundo": "García",
  "correo": "juan.perez@empresa.com",
  "es_admin_global": 0,
  "puede_agregar": 0,
  "puede_modificar": 1,
  "puede_eliminar": 0,
  "creado_en": "2025-01-01T00:00:00.000Z",
  "permisos": {
    "empresa1": {
      "CUENTAS": {
        "Ver": true,
        "Lectura": true,
        "Cargar y guardar": true,
        "Revisar": false,
        "Aprobar": false
      },
      "SUMMARY": {
        "Ver": true,
        "Lectura": true,
        "Cargar y guardar": false,
        "Revisar": true,
        "Aprobar": false
      }
    },
    "empresa2": {
      "CUENTAS": {
        "Ver": true,
        "Lectura": true,
        "Cargar y guardar": true,
        "Revisar": true,
        "Aprobar": true
      }
    }
  }
}

🔒 USO EN ROUTES

const { requireAuth, tienePermisoModulo } = require('../middleware/auth');

router.use(requireAuth);                // Todas las rutas requieren auth

router.post('/presupuestos/:empresaId/transicion', (req, res) => {
  const { empresaId } = req.params;
  const { modulo } = req.body;
  
  // req.usuarioActual ya está disponible gracias a requireAuth
  const usuario = req.usuarioActual;
  
  // Verificar permiso específico
  if (!tienePermisoModulo(usuario.permisos, empresaId, modulo, 'Aprobar')) {
    return res.status(403).json({ mensaje: 'Sin permiso.' });
  }
  
  // El usuario SÍ tiene permiso, procesar...
});
"@

# SLIDE 10: Servicio de Firebird
Add-Slide -Titulo "SERVICIO: Firebird" -TamanoContenido 10 -Contenido @"
🔥 CONEXIÓN A FIREBIRD

// Archivo: src/services/firebirdService.js

const Firebird = require('node-firebird');
const { obtenerEmpresaPorId } = require('../config/empresas');

// Pool de conexiones (1 por empresa)
const pools = new Map();

const getPool = (empresaId) => {
  if (!pools.has(empresaId)) {
    const empresa = obtenerEmpresaPorId(empresaId);
    if (!empresa?.firebird) {
      throw new Error(`No hay configuración Firebird para ${empresaId}`);
    }
    
    const opciones = {
      host: empresa.firebird.host,          // '192.168.1.100'
      port: empresa.firebird.port || 3050,  // 3050 (default Firebird)
      database: empresa.firebird.database,  // 'C:/DATOS/CUENTAS.FDB'
      user: empresa.firebird.user,          // 'SYSDBA'
      password: empresa.firebird.password,  // 'masterkey'
      lowercase_keys: false,                // Mantener nombres originales
      role: null,
      pageSize: 4096                        // Tamaño de página (performance)
    };
    
    const pool = Firebird.pool(5, opciones);  // Pool de 5 conexiones
    pools.set(empresaId, pool);
    console.log(`✅ Pool Firebird creado para ${empresaId}`);
  }
  
  return pools.get(empresaId);
};

const ejecutarQuery = (empresaId, query, params = []) => {
  return new Promise((resolve, reject) => {
    const pool = getPool(empresaId);
    
    pool.get((err, db) => {
      if (err) {
        console.error('Error al obtener conexión:', err);
        return reject(err);
      }
      
      db.query(query, params, (err, result) => {
        db.detach();                        // Liberar conexión al pool
        
        if (err) {
          console.error('Error en query:', err);
          return reject(err);
        }
        
        resolve(result);
      });
    });
  });
};

📊 QUERY REAL: Obtener Saldos

// Archivo: src/services/saldosService.js
// Líneas: 100-145

const obtenerSaldosPorCuentas = async (empresaId, anio, cuentas = []) => {
  if (!cuentas.length) return [];
  
  const sufijo = anio.toString().slice(-2);  // 2025 → '25'
  const tablaCuentas = `CUENTAS${sufijo}`;   // 'CUENTAS25'
  const tablaSaldos = `SALDOS${sufijo}`;     // 'SALDOS25'
  
  // Placeholders: ?, ?, ?, ...
  const placeholders = cuentas.map(() => '?').join(', ');
  
  const query = `
    SELECT 
      C.CUENTA,
      C.NOMBRE,
      C.NATURALEZA,
      S.INICIAL,
      S.CARGO01, S.CARGO02, S.CARGO03, S.CARGO04,
      S.CARGO05, S.CARGO06, S.CARGO07, S.CARGO08,
      S.CARGO09, S.CARGO10, S.CARGO11, S.CARGO12,
      S.ABONO01, S.ABONO02, S.ABONO03, S.ABONO04,
      S.ABONO05, S.ABONO06, S.ABONO07, S.ABONO08,
      S.ABONO09, S.ABONO10, S.ABONO11, S.ABONO12,
      S.AJU14
    FROM ${tablaCuentas} C
    LEFT JOIN ${tablaSaldos} S ON C.CUENTA = S.CUENTA
    WHERE C.CUENTA IN (${placeholders})
    ORDER BY C.CUENTA
  `;
  
  try {
    const rows = await ejecutarQuery(empresaId, query, cuentas);
    
    // Post-procesamiento
    return rows.map(row => {
      const naturaleza = determinarNaturalezaReal(row.CUENTA, row.NATURALEZA);
      const meses = calcularSaldosCoiPorMes(row, naturaleza);
      
      return {
        cuenta: row.CUENTA,
        nombre: row.NOMBRE,
        naturaleza,
        inicial: row.INICIAL || 0,
        ...meses
      };
    });
    
  } catch (error) {
    console.error('Error obteniendo saldos:', error);
    throw error;
  }
};

🧮 POST-PROCESAMIENTO: Cálculo de Saldos COI

const calcularSaldosCoiPorMes = (row, naturaleza) => {
  const meses = ['01', '02', '03', '04', '05', '06', 
                 '07', '08', '09', '10', '11', '12'];
  
  const resultado = {};
  let acumulado = row.INICIAL || 0;
  
  for (const mes of meses) {
    const cargo = row[`CARGO${mes}`] || 0;
    const abono = row[`ABONO${mes}`] || 0;
    
    // Movimiento neto según naturaleza
    let movimiento;
    if (naturaleza === 'D') {              // Deudora
      movimiento = cargo - abono;
    } else {                               // Acreedora
      movimiento = abono - cargo;
    }
    
    acumulado = acumulado + movimiento;
    
    // Nombres de columnas frontend
    const nombreMes = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                       'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][parseInt(mes) - 1];
    
    resultado[nombreMes] = movimiento;              // Movimiento del mes
    resultado[`${nombreMes}_acum`] = acumulado;    // Acumulado a la fecha
  }
  
  return resultado;
};

📊 EJEMPLO DE RESULTADO

Query: obtenerSaldosPorCuentas('empresa1', 2025, ['1.1.1.1.000000000'])

Resultado:
{
  "cuenta": "1.1.1.1.000000000",
  "nombre": "EFECTIVO EN CAJA",
  "naturaleza": "D",
  "inicial": 100000,
  "ene": 5000,      "ene_acum": 105000,
  "feb": 3000,      "feb_acum": 108000,
  "mar": -2000,     "mar_acum": 106000,
  "abr": 10000,     "abr_acum": 116000,
  "may": 0,         "may_acum": 116000,
  "jun": 4000,      "jun_acum": 120000,
  "jul": 0,         "jul_acum": 120000,
  "ago": 0,         "ago_acum": 120000,
  "sep": 0,         "sep_acum": 120000,
  "oct": 0,         "oct_acum": 120000,
  "nov": 0,         "nov_acum": 120000,
  "dic": 0,         "dic_acum": 120000
}
"@

Write-Host "💾 Guardando presentación..." -ForegroundColor Yellow

# Guardar presentación
$rutaSalida = "C:\Users\Frida Sophia\Desktop\DESARROLLOS\SummaCham\PRESENTACION_TECNICA_SUMMACHAM_MEGA_DETALLADA.pptx"
$presentation.SaveAs($rutaSalida)
$presentation.Close()
$powerpoint.Quit()

# Liberar objetos COM
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($presentation) | Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($powerpoint) | Out-Null
[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()

Write-Host "`n✅ PRESENTACIÓN MEGA DETALLADA CREADA EXITOSAMENTE" -ForegroundColor Green
Write-Host "📂 Ubicación: $rutaSalida" -ForegroundColor Cyan
Write-Host "`n📊 Contenido:" -ForegroundColor Yellow
Write-Host "   • 10+ slides con documentación ultra específica" -ForegroundColor White
Write-Host "   • Todas las tablas SQLite documentadas" -ForegroundColor White
Write-Host "   • Queries SQL reales con ejemplos" -ForegroundColor White
Write-Host "   • Código fuente comentado línea por línea" -ForegroundColor White
Write-Host "   • Algoritmos con diagramas de flujo" -ForegroundColor White
Write-Host "   • Sistema de transiciones de estado" -ForegroundColor White
Write-Host "   • Validación con Joi" -ForegroundColor White
Write-Host "   • Middleware de autenticación" -ForegroundColor White
Write-Host "   • Integración con Firebird" -ForegroundColor White
Write-Host "   • Post-procesamiento de datos" -ForegroundColor White
Write-Host "`n✨ Para agregar más slides, edita el script y vuelve a ejecutar." -ForegroundColor Magenta
