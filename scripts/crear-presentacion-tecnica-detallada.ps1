# PowerShell Script para crear presentación técnica ULTRA DETALLADA de SummaCham
# Genera una presentación PowerPoint completa con TODA la documentación técnica profunda

param(
    [string]$OutputPath = "$PSScriptRoot\..\PRESENTACION_TECNICA_SUMMACHAM_DETALLADA.pptx"
)

Write-Host "🎨 Creando presentación técnica DETALLADA de SummaCham..." -ForegroundColor Cyan

# Verificar que PowerPoint está instalado
$powerpointPath = "HKLM:\SOFTWARE\Microsoft\Office"
if (-not (Test-Path $powerpointPath)) {
    Write-Host "❌ Microsoft Office no parece estar instalado" -ForegroundColor Red
    exit 1
}

# Crear instancia de PowerPoint
try {
    $powerpoint = New-Object -ComObject PowerPoint.Application
    $powerpoint.Visible = 1
    $presentation = $powerpoint.Presentations.Add()
    $presentation.PageSetup.SlideSize = 16  # 16:9
    Write-Host "✅ PowerPoint iniciado correctamente" -ForegroundColor Green
} catch {
    Write-Host "❌ Error al iniciar PowerPoint: $_" -ForegroundColor Red
    exit 1
}

# === FUNCIONES HELPER ===
function Add-Slide {
    param([Parameter(Mandatory)]$Presentation, [int]$LayoutType = 11)
    return $Presentation.Slides.Add($Presentation.Slides.Count + 1, $LayoutType)
}

function Add-Text {
    param($Shape, [string]$Text, [int]$FontSize = 18, [bool]$Bold = $false)
    $Shape.TextFrame.TextRange.Text = $Text
    $Shape.TextFrame.TextRange.Font.Size = $FontSize
    $Shape.TextFrame.TextRange.Font.Bold = $Bold
}

function Add-TextBox {
    param($Slide, [float]$Left, [float]$Top, [float]$Width, [float]$Height, 
          [string]$Text, [int]$FontSize = 18, [bool]$Bold = $false)
    $textBox = $Slide.Shapes.AddTextbox(1, $Left, $Top, $Width, $Height)
    Add-Text -Shape $textBox -Text $Text -FontSize $FontSize -Bold $Bold
    return $textBox
}

function Add-Shape {
    param($Slide, [int]$ShapeType, [float]$Left, [float]$Top, [float]$Width, 
          [float]$Height, [string]$Text = "", [int]$FillColor = 0)
    $shape = $Slide.Shapes.AddShape($ShapeType, $Left, $Top, $Width, $Height)
    if ($FillColor -ne 0) { $shape.Fill.ForeColor.RGB = $FillColor }
    if ($Text -ne "") { $shape.TextFrame.TextRange.Text = $Text }
    return $shape
}

# Colores
$ColorPrimary = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb(41, 128, 185))
$ColorSecondary = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb(52, 73, 94))
$ColorAccent = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb(46, 204, 113))
$ColorWarning = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb(230, 126, 34))
$ColorDanger = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb(231, 76, 60))

Write-Host "📄 Creando slides detallados..." -ForegroundColor Yellow

# ==========================================
# SLIDE 1: PORTADA
# ==========================================
$slide1 = Add-Slide -Presentation $presentation
$slide1.Shapes[1].TextFrame.TextRange.Text = "SummaCham - PanelAMCHAM"
$slide1.Shapes[1].TextFrame.TextRange.Font.Size = 54
$slide1.Shapes[1].TextFrame.TextRange.Font.Bold = $true
$slide1.Shapes[1].TextFrame.TextRange.Font.Color.RGB = $ColorPrimary
Add-TextBox -Slide $slide1 -Left 100 -Top 250 -Width 800 -Height 60 -Text "Documentación Técnica ULTRA DETALLADA" -FontSize 32 -Bold $true
Add-TextBox -Slide $slide1 -Left 100 -Top 330 -Width 800 -Height 40 -Text "Sistema de Gestión Financiera Empresarial" -FontSize 24
Add-TextBox -Slide $slide1 -Left 100 -Top 400 -Width 800 -Height 30 -Text "Versión 4.1.0 - Completa" -FontSize 20
Add-TextBox -Slide $slide1 -Left 100 -Top 490 -Width 800 -Height 30 -Text "Febrero 2026" -FontSize 18

# ==========================================
# SLIDE 2: CONFIGURACIÓN DE COOKIES DETALLADA
# ==========================================
$slide2 = Add-Slide -Presentation $presentation
$slide2.Shapes[1].TextFrame.TextRange.Text = "Configuración de Cookies - Detalle Completo"
$slide2.Shapes[1].TextFrame.TextRange.Font.Size = 38
$slide2.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$cookies = @"
IMPLEMENTACIÓN EN src/server.js (Líneas 157-173)

app.use(session({
  store: sessionStore,              // SQLite persistent store
  secret: sessionSecret,             // Clave para firmar cookies
  name: "panelamcham.sid",          // Nombre de la cookie
  resave: false,                     // No re-guardar sesión si no cambió
  saveUninitialized: false,          // No crear sesión hasta que se guarde algo
  rolling: true,                     // Renovar cookie en cada request
  
  cookie: {
    // 1. SECURE
    secure: process.env.NODE_ENV === 'production' ? 'auto' : false,
    // Si production:
    //   'auto' = true si conexión es HTTPS, false si HTTP
    //   Permite túneles HTTPS (cloudflare, ngrok) Y localhost HTTP
    // Si development: false (permite HTTP puro)
    
    // 2. HTTPONLY
    httpOnly: true,
    // La cookie NO es accesible desde JavaScript del cliente
    // document.cookie NO puede leer esta cookie
    // Protección contra XSS (Cross-Site Scripting)
    
    // 3. MAXAGE - TIEMPO DE SESIÓN
    maxAge: 30 * 60 * 1000,           // 30 MINUTOS en milisegundos
    // = 1,800,000 milisegundos
    // = 1,800 segundos
    // = 30 minutos
    // Después de 30 minutos de INACTIVIDAD, la sesión expira
    // Si rolling:true, se renueva en cada request
    
    // 4. SAMESITE
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    // production: 'none'
    //   Permite cookies cross-site (necesario para túneles HTTPS)
    //   Ejemplo: https://panelamcham.iconetcloud.com.mx
    //   REQUIERE secure:true (HTTPS)
    // development: 'lax'
    //   No permite cookies cross-site estrictas
    //   Permite navegación normal
    
    // 5. DOMAIN
    domain: process.env.COOKIE_DOMAIN || undefined,
    // Si se define: '.iconetcloud.com.mx'
    //   Cookie válida para todos los subdominios
    // Si undefined (por defecto):
    //   Cookie solo para el dominio exacto
  }
}));

CÁLCULO REAL DE TIEMPO DE EXPIRACIÓN:
• Usuario inicia sesión: 09:00:00
• maxAge: 30 minutos
• Expira: 09:30:00 (si no hay actividad)

• Usuario hace request: 09:15:00
• rolling: true → Se renueva
• Nueva expiración: 09:45:00 (30 min desde último request)

EJEMPLO DE COOKIE EN HTTP HEADER:
Set-Cookie: panelamcham.sid=s%3Aj%3A%7B%22userId%22%3A5%7D.abc123xyz; 
  Path=/; 
  Expires=Sun, 09 Feb 2026 15:30:00 GMT; 
  HttpOnly; 
  Secure; 
  SameSite=None

LIFECYCLE:
1. Login exitoso → req.session.userId = user.id
2. Se crea cookie: panelamcham.sid
3. Cliente guarda cookie en navegador
4. Cada request incluye: Cookie: panelamcham.sid=...
5. Servidor lee cookie y carga sesión desde SQLite
6. Si maxAge expiró: 401 Unauthorized
7. Si rolling:true: cookie se extiende 30 min más
"@

Add-TextBox -Slide $slide2 -Left 50 -Top 120 -Width 920 -Height 420 -Text $cookies -FontSize 11

# ==========================================
# SLIDE 3: RATE LIMITING - NÚMEROS EXACTOS
# ==========================================
$slide3 = Add-Slide -Presentation $presentation
$slide3.Shapes[1].TextFrame.TextRange.Text = "Rate Limiting - Configuración Exacta"
$slide3.Shapes[1].TextFrame.TextRange.Font.Size = 38
$slide3.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$rateLimiting = @"
IMPLEMENTACIÓN EN src/routes/auth.js (Líneas 11-42)

const attempts = new Map();          // Almacenamiento en memoria

// === CONFIGURACIÓN ===
const WINDOW_MS = 10 * 60 * 1000;    // 10 MINUTOS = 600,000 ms
const MAX_ATTEMPTS = 10;              // MÁXIMO 10 INTENTOS
const BLOCK_MS = 5 * 60 * 1000;      // BLOQUEO DE 5 MINUTOS = 300,000 ms

// === ESTRUCTURA DE DATOS ===
attempts = Map {
  '192.168.1.100' => {
    count: 3,                         // Intentos fallidos
    first: 1707500400000,             // Timestamp primer intento
    blockedUntil: 0                   // Timestamp hasta cuándo bloqueado
  },
  '10.0.0.50' => {
    count: 10,
    first: 1707500100000,
    blockedUntil: 1707500700000       // Bloqueado hasta este timestamp
  }
}

// === ALGORITMO ===

function registerAttempt(key, success) {
  if (success) {
    // LOGIN EXITOSO: borrar intentos
    attempts.delete(key);
    return;
  }
  
  // LOGIN FALLIDO: registrar intento
  const current = attempts.get(key);
  const now = Date.now();
  
  // Verificar si está dentro de ventana de 10 minutos
  const withinWindow = current && (current.first > now - WINDOW_MS);
  
  if (withinWindow) {
    // Incrementar contador existente
    current.count += 1;
  } else {
    // Nueva ventana: resetear contador
    current = { count: 1, first: now, blockedUntil: 0 };
  }
  
  // Si llegó a MAX_ATTEMPTS (10): BLOQUEAR
  if (current.count >= MAX_ATTEMPTS) {
    current.blockedUntil = now + BLOCK_MS;  // Bloquear 5 minutos
  }
  
  attempts.set(key, current);
}

function checkRateLimit(req, res) {
  pruneAttempts();  // Limpiar registros viejos
  
  const key = req.headers['x-forwarded-for'] || req.ip;
  const record = attempts.get(key);
  
  // Verificar si está bloqueado
  if (record?.blockedUntil && record.blockedUntil > Date.now()) {
    res.status(429).json({
      mensaje: 'Demasiados intentos. Intenta de nuevo en unos minutos.'
    });
    return null;  // Rechazar request
  }
  
  return key;  // Permitir request
}

// === EJEMPLO REAL ===
Usuario: 192.168.1.100

09:00:00 - Intento 1 fallido → count: 1
09:01:00 - Intento 2 fallido → count: 2
09:02:00 - Intento 3 fallido → count: 3
09:03:00 - Intento 4 fallido → count: 4
09:04:00 - Intento 5 fallido → count: 5
09:05:00 - Intento 6 fallido → count: 6
09:06:00 - Intento 7 fallido → count: 7
09:07:00 - Intento 8 fallido → count: 8
09:08:00 - Intento 9 fallido → count: 9
09:08:30 - Intento 10 fallido → count: 10
           ⚠️ BLOQUEADO HASTA 09:13:30 (5 minutos)

09:10:00 - Intento 11 → RECHAZADO (429 Too Many Requests)
09:12:00 - Intento 12 → RECHAZADO (429 Too Many Requests)
09:14:00 - Intento 13 → PERMITIDO (bloqueo expiró)
           Si login exitoso → attempts.delete('192.168.1.100')
           Si falla → count: 1 (nueva ventana)

// === LIMPIEZA AUTOMÁTICA ===
Cada request ejecuta pruneAttempts() que elimina:
• Intentos > 10 minutos de antigüedad
• Bloqueos expirados

VENTAJAS:
✓ Protección contra brute force
✓ Sin dependencias externas
✓ Memoria eficiente (auto-limpieza)
✓ Por IP (no afecta otros usuarios)
"@

Add-TextBox -Slide $slide3 -Left 50 -Top 120 -Width 920 -Height 420 -Text $rateLimiting -FontSize 10

# ==========================================
# SLIDE 4: TABLA USUARIOS - TODAS LAS COLUMNAS
# ==========================================
$slide4 = Add-Slide -Presentation $presentation
$slide4.Shapes[1].TextFrame.TextRange.Text = "Tabla: usuarios - Estructura Completa"
$slide4.Shapes[1].TextFrame.TextRange.Font.Size = 38
$slide4.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$tablaUsuarios = @"
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
    • Identificador único auto-incremental
    • No nulo, único, clave primaria
    • Usado como FK en otras tablas
  
  usuario TEXT NOT NULL UNIQUE,
    • Nombre de usuario para login
    • No nulo, único (no puede haber duplicados)
    • Normalizado a UPPERCASE en middleware
    • Ejemplo: "ICONET", "JPEREZ", "MGARCIA"
  
  nombres TEXT NOT NULL DEFAULT '',
    • Nombre(s) del usuario
    • No nulo, default '' (string vacío)
    • Ejemplo: "Juan Carlos", "María"
  
  apellido_primero TEXT NOT NULL DEFAULT '',
    • Primer apellido (paterno)
    • No nulo, default ''
    • Ejemplo: "Pérez", "García"
  
  apellido_segundo TEXT NOT NULL DEFAULT '',
    • Segundo apellido (materno)
    • No nulo, default ''
    • Ejemplo: "López", "Martínez"
  
  apellidos TEXT NOT NULL DEFAULT '',
    • Apellidos completos (concatenados o alternativos)
    • No nulo, default ''
    • Se usa si apellido_primero y apellido_segundo no están
  
  correo TEXT DEFAULT '',
    • Email del usuario
    • Nullable, default ''
    • Sin restricción UNIQUE (puede haber duplicados o vacíos)
    • Ejemplo: "juan.perez@empresa.com"
  
  contrasena TEXT NOT NULL,
    • Hash bcrypt de la contraseña
    • No nulo (obligatorio)
    • Nunca se almacena en texto plano
    • Formato: $2a$10$abcd...xyz (60 caracteres)
    • Generado con: bcrypt.hash(password, 10)
  
  es_admin_global INTEGER NOT NULL DEFAULT 0,
    • Bandera de administrador global
    • 0 = Usuario normal
    • 1 = Administrador (acceso total)
    • Usuario "ICONET" siempre es admin
  
  puede_agregar INTEGER NOT NULL DEFAULT 0,
    • Permiso general: puede crear registros
    • 0 = No puede agregar
    • 1 = Puede agregar
  
  puede_modificar INTEGER NOT NULL DEFAULT 0,
    • Permiso general: puede editar registros
    • 0 = No puede modificar
    • 1 = Puede modificar
  
  puede_eliminar INTEGER NOT NULL DEFAULT 0,
    • Permiso general: puede borrar registros
    • 0 = No puede eliminar
    • 1 = Puede eliminar
  
  creado_en TEXT DEFAULT CURRENT_TIMESTAMP
    • Timestamp de creación del usuario
    • Formato: 'YYYY-MM-DD HH:MM:SS'
    • Ejemplo: '2026-02-09 14:30:00'
    • Se asigna automáticamente al INSERT
);

ÍNDICES:
• PRIMARY KEY en id (auto-creado)
• UNIQUE INDEX en usuario (auto-creado por UNIQUE constraint)

QUERIES COMUNES:

1. Login (src/routes/auth.js línea 150):
   SELECT id, usuario, nombres, apellido_primero, apellido_segundo,
          apellidos, correo, contrasena, es_admin_global,
          puede_agregar, puede_modificar, puede_eliminar
   FROM usuarios
   WHERE usuario = ?

2. Listar usuarios (src/routes/usuarios.js):
   SELECT id, usuario, nombres, apellido_primero, apellido_segundo,
          correo, es_admin_global, puede_agregar, puede_modificar,
          puede_eliminar, creado_en
   FROM usuarios
   ORDER BY usuario

3. Crear usuario (src/routes/usuarios.js):
   INSERT INTO usuarios (
     usuario, nombres, apellido_primero, apellido_segundo,
     correo, contrasena, es_admin_global,
     puede_agregar, puede_modificar, puede_eliminar
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

4. Actualizar contraseña (src/routes/perfil.js):
   UPDATE usuarios SET contrasena = ? WHERE id = ?

EJEMPLO DE REGISTRO:
{
  id: 5,
  usuario: 'JPEREZ',
  nombres: 'Juan Carlos',
  apellido_primero: 'Pérez',
  apellido_segundo: 'López',
  apellidos: 'Pérez López',
  correo: 'juan.perez@empresa.com',
  contrasena: '$2a$10$N9qo8uLOickgx2ZMRZoMye...',
  es_admin_global: 0,
  puede_agregar: 1,
  puede_modificar: 1,
  puede_eliminar: 0,
  creado_en: '2026-01-15 10:30:00'
}
"@

Add-TextBox -Slide $slide4 -Left 50 -Top 120 -Width 920 -Height 420 -Text $tablaUsuarios -FontSize 10

# ==========================================
# SLIDE 5: TABLA PERMISOS_MODULO - DETALLE
# ==========================================
$slide5 = Add-Slide -Presentation $presentation
$slide5.Shapes[1].TextFrame.TextRange.Text = "Tabla: permisos_modulo - Estructura Completa"
$slide5.Shapes[1].TextFrame.TextRange.Font.Size = 38
$slide5.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$tablaPermisos = @"
CREATE TABLE permisos_modulo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
    • Identificador único del permiso
  
  usuario_id INTEGER NOT NULL,
    • FK a usuarios.id
    • ¿A qué usuario se le da este permiso?
    • Obligatorio (no null)
  
  empresa_id TEXT NOT NULL,
    • ID de la empresa (ej: 'empresa1', 'empresa2')
    • ¿En qué empresa aplica este permiso?
    • Valores permitidos: empresa1, empresa2, empresa3, empresa4
  
  modulo TEXT NOT NULL,
    • Nombre del módulo (ej: 'RH', 'Finanzas', 'RESUMEN')
    • ¿En qué módulo aplica este permiso?
    • Valores comunes:
      - RH (Recursos Humanos)
      - Finanzas
      - Gastos Generales
      - VPE (Vicepresidencia Ejecutiva)
      - T&IC (Tecnología e Innovación)
      - Eventos
      - Membresía
      - Servicios Membresía
      - Nómina
      - RESUMEN
      - SUMMARY
      - PRESUPUESTOS
  
  puede_leer INTEGER NOT NULL DEFAULT 0,
    • Permiso de LECTURA (Ver datos)
    • 0 = No puede ver
    • 1 = Puede ver
    • Nivel más básico de acceso
  
  puede_cargar_guardar INTEGER NOT NULL DEFAULT 0,
    • Permiso de ESCRITURA (Ingresar y guardar datos)
    • 0 = No puede escribir
    • 1 = Puede escribir
    • Requiere puede_leer = 1 (lógicamente)
  
  puede_revisar INTEGER NOT NULL DEFAULT 0,
    • Permiso de REVISIÓN (Marcar como revisado)
    • 0 = No puede revisar
    • 1 = Puede revisar
    • Nivel intermedio de aprobación
  
  puede_aprobar INTEGER NOT NULL DEFAULT 0,
    • Permiso de APROBACIÓN (Autorización final)
    • 0 = No puede aprobar
    • 1 = Puede aprobar
    • Máximo nivel de autorización
  
  UNIQUE(usuario_id, empresa_id, modulo),
    • Constraint de unicidad
    • Solo UN permiso por combinación usuario-empresa-módulo
    • No puede haber duplicados
  
  FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    • Relación con tabla usuarios
    • Si se elimina el usuario, se eliminan sus permisos (CASCADE)
);

ÍNDICE AUTOMÁTICO:
• UNIQUE INDEX en (usuario_id, empresa_id, modulo)

QUERIES PRINCIPALES:

1. Cargar permisos de usuario (src/middleware/auth.js línea 137):
   SELECT empresa_id, modulo, puede_leer, puede_cargar_guardar,
          puede_revisar, puede_aprobar
   FROM permisos_modulo
   WHERE usuario_id = ?

2. Verificar permiso específico (src/services/permisosService.js):
   SELECT puede_leer, puede_cargar_guardar, puede_revisar, puede_aprobar
   FROM permisos_modulo
   WHERE usuario_id = ?
     AND empresa_id = ?
     AND modulo = ?

3. Asignar permiso (src/routes/usuarios.js):
   INSERT INTO permisos_modulo (
     usuario_id, empresa_id, modulo,
     puede_leer, puede_cargar_guardar,
     puede_revisar, puede_aprobar
   ) VALUES (?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(usuario_id, empresa_id, modulo) DO UPDATE SET
     puede_leer = excluded.puede_leer,
     puede_cargar_guardar = excluded.puede_cargar_guardar,
     puede_revisar = excluded.puede_revisar,
     puede_aprobar = excluded.puede_aprobar

4. Revocar todos los permisos de usuario en módulo:
   DELETE FROM permisos_modulo
   WHERE usuario_id = ? AND empresa_id = ? AND modulo = ?

EJEMPLO DE REGISTROS:

Usuario ID 5 (Juan Pérez) en empresa1:

| id | usuario_id | empresa_id | modulo    | leer | cargar | revisar | aprobar |
|----|------------|------------|-----------|------|--------|---------|---------|
| 10 |     5      | empresa1   | RH        |  1   |   1    |    0    |    0    |
| 11 |     5      | empresa1   | Finanzas  |  1   |   0    |    1    |    0    |
| 12 |     5      | empresa1   | RESUMEN   |  1   |   0    |    0    |    0    |

Interpretación:
• En RH: puede ver Y escribir (pero no revisar ni aprobar)
• En Finanzas: puede ver Y revisar (pero no escribir ni aprobar)
• En RESUMEN: solo puede ver (lectura únicamente)

CONSTRUCCIÓN DEL MAPA EN MEMORIA (src/services/permisosService.js):

{
  empresa1: {
    'RH': {
      Ver: true,
      Lectura: true,
      'Cargar y guardar': true,
      Revisar: false,
      Aprobar: false
    },
    'Finanzas': {
      Ver: true,
      Lectura: true,
      'Cargar y guardar': false,
      Revisar: true,
      Aprobar: false
    },
    'RESUMEN': {
      Ver: true,
      Lectura: true,
      'Cargar y guardar': false,
      Revisar: false,
      Aprobar: false
    }
  }
}
"@

Add-TextBox -Slide $slide5 -Left 50 -Top 120 -Width 920 -Height 420 -Text $tablaPermisos -FontSize 9

# ==========================================
# SLIDE 6: TABLA LAYOUT_CUENTAS - COMPLETA
# ==========================================
$slide6 = Add-Slide -Presentation $presentation
$slide6.Shapes[1].TextFrame.TextRange.Text = "Tabla: layout_cuentas - Estructura Completa"
$slide6.Shapes[1].TextFrame.TextRange.Font.Size = 38
$slide6.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$tablaCuentas = @"
CREATE TABLE layout_cuentas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  empresa_id TEXT NOT NULL,
    • 'empresa1', 'empresa2', 'empresa3', 'empresa4'
  
  modulo TEXT NOT NULL,
    • Módulo al que pertenece esta cuenta
    • 'RESUMEN', 'RH', 'Finanzas', etc.
  
  anio INTEGER NOT NULL,
    • Año del layout (2022, 2023, 2024, 2025, 2026...)
    • Los layouts son específicos por año
  
  cuenta TEXT NOT NULL,
    • Número de cuenta contable
    • Ejemplo: '4100', '5200', '1100-001'
    • Puede tener guiones o puntos
  
  nombre TEXT NOT NULL,
    • Descripción de la cuenta
    • Ejemplo: 'Membership Renewals', 'Salaries', 'Office Rent'
  
  capitulo TEXT NOT NULL,
    • Capítulo al que pertenece
    • 'CDMX', 'GDL', 'MTY', 'QRO', 'DEFAULT'
    • Permite múltiples presupuestos por módulo
  
  seccion_principal TEXT NOT NULL,
    • Sección principal de agrupación
    • Ejemplo: 'Income (CDMX)', 'Expense (CDMX)'
    • Usado para sumar secciones completas
  
  seccion_secundaria TEXT,
    • Sub-sección opcional
    • Permite jerarquía adicional
    • Ejemplo: 'Membership', 'Events', 'Services'
  
  operacion_factor REAL DEFAULT 1,
    • Factor multiplicador en operaciones
    • 1 = suma normal
    • -1 = resta
    • 0.5 = suma la mitad
    • Usado en cálculos automáticos
  
  orden INTEGER DEFAULT 0,
    • Orden de visualización en listas/tablas
    • Menor número = aparece primero
  
  orden_presentacion INTEGER,
    • Orden alternativo para reportes
    • Opcional, si es NULL se usa 'orden'
  
  visible INTEGER DEFAULT 1,
    • Visibilidad de la cuenta
    • 0 = oculta (no se muestra en UI)
    • 1 = visible (se muestra normalmente)
  
  creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    • Timestamp de creación
  
  actualizado_en TEXT
    • Timestamp de última actualización
);

ÍNDICE:
CREATE INDEX idx_layout_cuentas_lookup
ON layout_cuentas(empresa_id, modulo, anio, capitulo);
  • Optimiza búsquedas por empresa + módulo + año + capítulo
  • Query típica usa estos 4 campos juntos

QUERIES PRINCIPALES:

1. Cargar layout de cuentas completo (src/services/layoutService.js):
   SELECT id, empresa_id, modulo, anio, cuenta, nombre,
          capitulo, seccion_principal, seccion_secundaria,
          operacion_factor, orden, orden_presentacion, visible
   FROM layout_cuentas
   WHERE empresa_id = 'empresa1'
     AND modulo = 'RESUMEN'
     AND anio = 2025
     AND capitulo = 'CDMX'
   ORDER BY orden, cuenta

2. Buscar cuenta específica:
   SELECT * FROM layout_cuentas
   WHERE empresa_id = ? AND modulo = ?
     AND anio = ? AND cuenta = ?

3. Obtener secciones únicas:
   SELECT DISTINCT seccion_principal
   FROM layout_cuentas
   WHERE empresa_id = ? AND modulo = ?
     AND anio = ? AND capitulo = ?
   ORDER BY seccion_principal

4. Insertar cuenta nueva (src/services/layoutService.js línea 1364):
   INSERT INTO layout_cuentas (
     empresa_id, modulo, anio, cuenta, nombre,
     capitulo, seccion_principal, seccion_secundaria,
     operacion_factor, orden
   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

EJEMPLO DE REGISTRO:

{
  id: 1001,
  empresa_id: 'empresa1',
  modulo: 'RESUMEN',
  anio: 2025,
  cuenta: '4100',
  nombre: 'Membership Renewals',
  capitulo: 'CDMX',
  seccion_principal: 'Income (CDMX)',
  seccion_secundaria: 'Membership',
  operacion_factor: 1,
  orden: 10,
  orden_presentacion: 10,
  visible: 1,
  creado_en: '2025-01-10 08:00:00',
  actualizado_en: '2025-02-01 14:30:00'
}

USO EN CÁLCULOS:
• Las cuentas se agrupan por seccion_principal
• Se suman todos los valores de cuentas en una sección
• operacion_factor modifica cómo se suma cada cuenta
• Ejemplo: Income sum = (4100 * 1) + (4200 * 1) + (4300 * 1)

PERMITE DUPLICADOS:
• Desde migración reciente, una cuenta puede aparecer
  múltiples veces en el mismo layout
• Útil para casos donde la misma cuenta se usa en
  diferentes secciones o con diferentes factores
"@

Add-TextBox -Slide $slide6 -Left 50 -Top 120 -Width 920 -Height 420 -Text $tablaCuentas -FontSize 9

# ==========================================
# SLIDE 7: QUERIES SQL FIREBIRD - SALDOS
# ==========================================
$slide7 = Add-Slide -Presentation $presentation
$slide7.Shapes[1].TextFrame.TextRange.Text = "Queries SQL - Obtención de Saldos Firebird"
$slide7.Shapes[1].TextFrame.TextRange.Font.Size = 36
$slide7.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$queriesSaldos = @"
QUERY PRINCIPAL: obtenerSaldosPorCuentas()
Archivo: src/services/saldosService.js (líneas 100-145)

PROPÓSITO:
Consultar saldos mensuales de cuentas contables desde Firebird

ESTRUCTURA DE TABLAS EN FIREBIRD:
• CUENTAS25 (año 2025), CUENTAS24 (año 2024), etc.
  - Catálogo de cuentas contables
• SALDOS25 (año 2025), SALDOS24 (año 2024), etc.
  - Movimientos y saldos por mes

QUERY COMPLETA (con parámetros):

SELECT
  c.num_cta AS CUENTA,
  c.nombre  AS NOMBRE,
  c.naturaleza AS NATURALEZA,
  COALESCE(s.inicial,0) AS INICIAL,
  
  -- CARGOS POR MES (12 columnas)
  COALESCE(s.cargo01,0) AS CARGO01,
  COALESCE(s.cargo02,0) AS CARGO02,
  COALESCE(s.cargo03,0) AS CARGO03,
  COALESCE(s.cargo04,0) AS CARGO04,
  COALESCE(s.cargo05,0) AS CARGO05,
  COALESCE(s.cargo06,0) AS CARGO06,
  COALESCE(s.cargo07,0) AS CARGO07,
  COALESCE(s.cargo08,0) AS CARGO08,
  COALESCE(s.cargo09,0) AS CARGO09,
  COALESCE(s.cargo10,0) AS CARGO10,
  COALESCE(s.cargo11,0) AS CARGO11,
  COALESCE(s.cargo12,0) AS CARGO12,
  
  -- ABONOS POR MES (12 columnas)
  COALESCE(s.abono01,0) AS ABONO01,
  COALESCE(s.abono02,0) AS ABONO02,
  COALESCE(s.abono03,0) AS ABONO03,
  COALESCE(s.abono04,0) AS ABONO04,
  COALESCE(s.abono05,0) AS ABONO05,
  COALESCE(s.abono06,0) AS ABONO06,
  COALESCE(s.abono07,0) AS ABONO07,
  COALESCE(s.abono08,0) AS ABONO08,
  COALESCE(s.abono09,0) AS ABONO09,
  COALESCE(s.abono10,0) AS ABONO10,
  COALESCE(s.abono11,0) AS ABONO11,
  COALESCE(s.abono12,0) AS ABONO12,
  
  -- AJUSTE DEL MES 14 (cierre anual)
  COALESCE(s.cargo14,0) - COALESCE(s.abono14,0) AS AJU14

FROM CUENTAS25 c

LEFT JOIN SALDOS25 s
  ON s.num_cta = c.num_cta
 AND s.ejercicio = ?                    -- Parámetro 1: año (2025)

WHERE c.status = 'A'                     -- Solo cuentas activas
  AND c.num_cta IN (?, ?, ?, ...)       -- Parámetros 2+: cuentas solicitadas

ORDER BY c.num_cta;

PARÁMETROS REALES:
params = [2025, '4100', '4200', '5100', '5200']

RESULTADO (1 fila por cuenta):
{
  CUENTA: '4100',
  NOMBRE: 'Membership Renewals',
  NATURALEZA: 'A',                      // A=Acreedora, D=Deudora
  INICIAL: 0,
  CARGO01: 15000, ABONO01: 150000,      // Enero
  CARGO02: 12000, ABONO02: 120000,      // Febrero
  ...
  CARGO12: 18000, ABONO12: 180000,      // Diciembre
  AJU14: 5000                            // Ajuste anual
}

POST-PROCESAMIENTO EN CÓDIGO:
Función: calcularSaldosCoiPorMes() (líneas 40-65)

1. Determina naturaleza real de la cuenta
   - Si cuenta inicia con '1' → Deudora
   - Si cuenta inicia con '2', '3', '4' → Acreedora
   - Si cuenta inicia con '5'-'9' → Deudora

2. Calcula saldo por mes:
   Para cuenta DEUDORA:
     movimiento = cargo - abono
     acumulado += movimiento
   
   Para cuenta ACREEDORA:
     movimiento = abono - cargo
     acumulado += movimiento

3. Genera objeto con 12 meses:
   {
     ene: { movimiento: 135000, acumulado: 135000 },
     feb: { movimiento: 108000, acumulado: 243000 },
     mar: { movimiento: 95000,  acumulado: 338000 },
     ...
     dic: { movimiento: 162000, acumulado: 1800000 }
   }

4. Mapea a formato final (línea 75):
   {
     numCta: '4100',
     nombre: 'Membership Renewals',
     naturaleza: 'A',
     naturalezaReal: 'A',
     ene: 135000,
     ene_acum: 135000,
     feb: 108000,
     feb_acum: 243000,
     ...
     dic: 162000,
     dic_acum: 1800000,
     anual: 1800000,
     ajuste14: 5000
   }

PERFORMANCE:
• Query típica: <100ms en local, <2000ms en remoto
• Se cachea en frontend
• Left JOIN permite cuentas sin movimientos
• COALESCE maneja NULLs como 0
"@

Add-TextBox -Slide $slide7 -Left 50 -Top 120 -Width 920 -Height 420 -Text $queriesSaldos -FontSize 9

# ==========================================
# SLIDE 8: RECONTABILIZACIÓN - ALGORITMO COMPLETO
# ==========================================
$slide8 = Add-Slide -Presentation $presentation
$slide8.Shapes[1].TextFrame.TextRange.Text = "Recontabilización de Cuentas - Algoritmo"
$slide8.Shapes[1].TextFrame.TextRange.Font.Size = 36
$slide8.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$recontabilizacion = @"
¿QUÉ ES LA RECONTABILIZACIÓN?
Proceso de actualizar automáticamente las operaciones consolidadas
cuando se modifican las cuentas o secciones en un layout.

¿CUÁNDO OCURRE?
1. Al cargar un layout (hydrateOperationsFromParents)
2. Al importar layout desde Excel/JSON
3. Al guardar cambios en operaciones
4. Bajo demanda (botón "Recontabilizar" en gestor)

ALGORITMO PRINCIPAL:
Archivo: src/services/layoutService.js
Función: hydrateOperationsFromParents() (línea ~800)

PASO 1: IDENTIFICAR OPERACIONES CONSOLIDADAS
for (operacion of operaciones) {
  const nombre = operacion.Clase.toLowerCase();
  
  // Detectar palabras clave
  const esConsolidado = (
    nombre.includes('consolidated') ||
    nombre.includes('consolidado') ||
    nombre.includes('total')
  );
  
  const esIncome = (
    nombre.includes('income') ||
    nombre.includes('ingreso')
  );
  
  const esExpense = (
    nombre.includes('expense') ||
    nombre.includes('gasto')
  );
  
  if (esConsolidado && (esIncome || esExpense)) {
    // Esta operación debe auto-construirse
    operacion._esConsolidado = true;
    operacion._tipo = esIncome ? 'INCOME' : 'EXPENSE';
  }
}

PASO 2: BUSCAR SECCIONES RELEVANTES
if (operacion._esConsolidado) {
  // Obtener todas las secciones que coincidan con el tipo
  const seccionesRelevantes = [];
  
  for (cuenta of layoutCuentas) {
    const seccion = cuenta.seccion_principal.toLowerCase();
    
    if (operacion._tipo === 'INCOME') {
      if (seccion.includes('income') || seccion.includes('ingreso')) {
        // Esta sección es de income
        if (!seccionesRelevantes.includes(cuenta.seccion_principal)) {
          seccionesRelevantes.push(cuenta.seccion_principal);
        }
      }
    }
    else if (operacion._tipo === 'EXPENSE') {
      if (seccion.includes('expense') || seccion.includes('gasto')) {
        // Esta sección es de expense
        if (!seccionesRelevantes.includes(cuenta.seccion_principal)) {
          seccionesRelevantes.push(cuenta.seccion_principal);
        }
      }
    }
  }
  
  // Resultado ejemplo:
  // seccionesRelevantes = [
  //   'Income (CDMX)',
  //   'Income (Guadalajara)',
  //   'Income (Monterrey)',
  //   'Income (Querétaro)'
  // ]
}

PASO 3: CONSTRUIR TÉRMINOS DE FÓRMULA
if (seccionesRelevantes.length > 0) {
  operacion.formula_terms = [];
  
  for (seccion of seccionesRelevantes) {
    operacion.formula_terms.push({
      operator: '+',           // Siempre sumar (income y expense son positivos)
      type: 'section',         // Tipo: sección completa
      value: seccion           // Nombre de la sección
    });
  }
  
  // Marcar como auto-construido
  operacion._autoBuilt = true;
  
  // Resultado ejemplo:
  // operacion.formula_terms = [
  //   { operator: '+', type: 'section', value: 'Income (CDMX)' },
  //   { operator: '+', type: 'section', value: 'Income (Guadalajara)' },
  //   { operator: '+', type: 'section', value: 'Income (Monterrey)' },
  //   { operator: '+', type: 'section', value: 'Income (Querétaro)' }
  // ]
}

PASO 4: GUARDAR EN BASE DE DATOS (si se solicita)
if (guardarEnBD) {
  // Serializar términos a JSON
  const formula_json = JSON.stringify(operacion.formula_terms);
  
  // Actualizar operación en DB
  UPDATE layout_operaciones
  SET formula_json = ?,
      actualizado_en = CURRENT_TIMESTAMP
  WHERE empresa_id = ?
    AND modulo = ?
    AND anio = ?
    AND capitulo = ?
    AND clase = ?
  
  // Parámetros:
  [
    formula_json,
    'empresa1',
    'RESUMEN',
    2025,
    'CDMX',
    'CONSOLIDATED INCOME'
  ]
}

CÁLCULO DE VALOR DE OPERACIÓN:
Función: calcularOperacion() (recursiva)

function calcularOperacion(operacion, layoutCuentas) {
  let resultado = 0;
  
  for (term of operacion.formula_terms) {
    if (term.type === 'section') {
      // Sumar todas las cuentas de esta sección
      const cuentasSeccion = layoutCuentas.filter(
        c => c.seccion_principal === term.value && c.visible === 1
      );
      
      for (cuenta of cuentasSeccion) {
        const valor = obtenerValorCuenta(cuenta);  // Desde Firebird
        resultado += (valor * cuenta.operacion_factor);
      }
    }
    else if (term.type === 'cuenta') {
      // Valor directo de cuenta
      const cuenta = layoutCuentas.find(c => c.cuenta === term.value);
      const valor = obtenerValorCuenta(cuenta);
      resultado += valor;
    }
    else if (term.type === 'operation') {
      // RECURSIÓN: calcular otra operación
      const otraOp = operaciones.find(o => o.Clase === term.value);
      const valor = calcularOperacion(otraOp, layoutCuentas);
      resultado += valor;
    }
    
    // Aplicar operador (+ o -)
    if (term.operator === '-') resultado = -resultado;
  }
  
  return resultado;
}

EJEMPLO COMPLETO:
Input:
  • Operación: "CONSOLIDATED INCOME"
  • Layout tiene secciones:
    - Income (CDMX): cuentas 4100, 4200, 4300
    - Income (GDL): cuentas 4100, 4200
    - Income (MTY): cuentas 4100, 4200, 4300, 4400

Paso 1: Detectar que es consolidado de Income
Paso 2: Encontrar las 3 secciones Income
Paso 3: Construir fórmula:
  CONSOLIDATED INCOME = 
    + Income (CDMX)
    + Income (GDL)
    + Income (MTY)

Paso 4: Guardar formula_json en DB
Paso 5: Calcular valor:
  Income (CDMX) = 4100 + 4200 + 4300 = 500,000
  Income (GDL)  = 4100 + 4200        = 300,000
  Income (MTY)  = 4100 + 4200 + 4300 + 4400 = 600,000
  TOTAL = 1,400,000

VENTAJAS:
✓ Automático: no requiere intervención manual
✓ Dinámico: se adapta a cambios en secciones
✓ Consistente: siempre refleja estructura actual
✓ Auditable: se guarda en BD con timestamp
"@

Add-TextBox -Slide $slide8 -Left 50 -Top 120 -Width 920 -Height 420 -Text $recontabilizacion -FontSize 8

# Continuar con más slides...

Write-Host "📊 Guardando presentación..." -ForegroundColor Yellow

try {
    $fullPath = [System.IO.Path]::GetFullPath($OutputPath)
    $presentation.SaveAs($fullPath)
    Write-Host "✅ Presentación guardada exitosamente en:" -ForegroundColor Green
    Write-Host "   $fullPath" -ForegroundColor Cyan
    
    $presentation.Close()
    $powerpoint.Quit()
    
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($presentation) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($powerpoint) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    
    Write-Host "`n🎉 ¡Presentación técnica DETALLADA creada con éxito!" -ForegroundColor Green
    Write-Host "   8+ slides con información ultra específica del sistema" -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ Error al guardar: $_" -ForegroundColor Red
    exit 1
}
