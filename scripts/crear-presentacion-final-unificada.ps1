# =============================================================================
# PRESENTACION TECNICA DEFINITIVA - SummaCham PanelAMCHAM
# Unifica toda la documentacion tecnica en una sola presentacion
# Con diseno profesional y explicaciones sencillas
# Febrero 2026
# =============================================================================

param(
    [string]$OutputPath = "$PSScriptRoot\..\PRESENTACION_TECNICA_DEFINITIVA_SUMMACHAM.pptx"
)

Write-Host "Creando Presentacion Tecnica Definitiva de SummaCham..." -ForegroundColor Cyan

try {
    $ppt = New-Object -ComObject PowerPoint.Application
    $ppt.Visible = 1
    $pres = $ppt.Presentations.Add()
    $pres.PageSetup.SlideSize = 16  # 16:9
    Write-Host "PowerPoint OK" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

# --- Medidas ---
$SW = [double]$pres.PageSetup.SlideWidth
$SH = [double]$pres.PageSetup.SlideHeight
$M  = 40

# --- Colores ---
Add-Type -AssemblyName System.Drawing
function C($r,$g,$b) { [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb($r,$g,$b)) }

$cBlue    = C 13 71 161
$cDark    = C 17 24 39
$cWhite   = C 255 255 255
$cLightBg = C 243 244 246
$cBorder  = C 229 231 235
$cGreen   = C 46 204 113
$cOrange  = C 230 126 34
$cRed     = C 231 76 60
$cGray    = C 107 114 128
$cLBlue   = C 96 165 250
$cNavy    = C 41 128 185
$cSlate   = C 52 73 94
$cTeal    = C 0 150 136
$cPurple  = C 142 68 173

# --- Helpers con diseno ---
function New-Slide { return $pres.Slides.Add($pres.Slides.Count + 1, 12) }

function Add-Title($slide, $text) {
    $bar = $slide.Shapes.AddShape(1, 0, 0, $SW, 56)
    $bar.Fill.ForeColor.RGB = $cBlue
    $bar.Line.Visible = 0
    $bar.TextFrame.TextRange.Text = "  $text"
    $bar.TextFrame.TextRange.Font.Size = 24
    $bar.TextFrame.TextRange.Font.Bold = -1
    $bar.TextFrame.TextRange.Font.Color.RGB = $cWhite
    $bar.TextFrame.TextRange.Font.Name = "Segoe UI"
    $bar.TextFrame.MarginLeft = 20
    $bar.TextFrame.MarginTop = 8
}

function Add-Body($slide, $text, [int]$fs=14, [float]$top=68, [float]$left=$M, [float]$w=0, [float]$h=0) {
    if ($w -eq 0) { $w = $SW - 2*$M }
    if ($h -eq 0) { $h = $SH - $top - 15 }
    $tb = $slide.Shapes.AddTextbox(1, $left, $top, $w, $h)
    $tb.TextFrame.WordWrap = -1
    $tb.TextFrame.TextRange.Text = $text
    $tb.TextFrame.TextRange.Font.Size = $fs
    $tb.TextFrame.TextRange.Font.Name = "Segoe UI"
    $tb.TextFrame.TextRange.Font.Color.RGB = $cDark
    return $tb
}

function Add-Code($slide, $text, [float]$top=68, [float]$left=$M, [float]$w=0, [float]$h=0) {
    if ($w -eq 0) { $w = $SW - 2*$M }
    if ($h -eq 0) { $h = $SH - $top - 15 }
    $box = $slide.Shapes.AddShape(1, $left, $top, $w, $h)
    $box.Fill.ForeColor.RGB = $cLightBg
    $box.Line.ForeColor.RGB = $cBorder
    $box.TextFrame.WordWrap = -1
    $box.TextFrame.MarginLeft = 14
    $box.TextFrame.MarginRight = 14
    $box.TextFrame.MarginTop = 10
    $box.TextFrame.TextRange.Text = $text
    $box.TextFrame.TextRange.Font.Size = 11
    $box.TextFrame.TextRange.Font.Name = "Consolas"
    $box.TextFrame.TextRange.Font.Color.RGB = $cDark
    return $box
}

function Add-Box($slide, $text, [float]$l, [float]$t, [float]$w, [float]$h, $fill=$cNavy, [int]$fs=13) {
    $s = $slide.Shapes.AddShape(5, $l, $t, $w, $h)
    $s.Fill.ForeColor.RGB = $fill
    $s.Line.Visible = 0
    $s.TextFrame.TextRange.Text = $text
    $s.TextFrame.TextRange.Font.Size = $fs
    $s.TextFrame.TextRange.Font.Bold = -1
    $s.TextFrame.TextRange.Font.Color.RGB = $cWhite
    $s.TextFrame.TextRange.Font.Name = "Segoe UI"
    try { $s.TextFrame.TextRange.ParagraphFormat.Alignment = 2 } catch {}
    return $s
}

function Add-Label($slide, $text, [float]$l, [float]$t, [float]$w, [float]$h=22, [int]$fs=11) {
    $tb = $slide.Shapes.AddTextbox(1, $l, $t, $w, $h)
    $tb.TextFrame.TextRange.Text = $text
    $tb.TextFrame.TextRange.Font.Size = $fs
    $tb.TextFrame.TextRange.Font.Name = "Segoe UI"
    $tb.TextFrame.TextRange.Font.Color.RGB = $cGray
}

function Add-Arrow($slide, [float]$l, [float]$t, [float]$w=36, [float]$h=18) {
    $a = $slide.Shapes.AddShape(13, $l, $t, $w, $h)
    $a.Fill.ForeColor.RGB = $cBlue
    $a.Line.Visible = 0
}

function Add-DownArrow($slide, [float]$l, [float]$t, [float]$w=18, [float]$h=24) {
    $a = $slide.Shapes.AddShape(13, $l, $t, $w, $h)
    $a.Fill.ForeColor.RGB = $cBlue
    $a.Line.Visible = 0
    $a.Rotation = 90
}

function Add-Divider($slide, [float]$top) {
    $d = $slide.Shapes.AddShape(1, $M, $top, ($SW - 2*$M), 1.5)
    $d.Fill.ForeColor.RGB = $cBorder
    $d.Line.Visible = 0
}

$n = 0
function Log($msg) { $script:n++; Write-Host "  [$script:n] $msg" -ForegroundColor Gray }


# =====================================================================
# SLIDE 1: PORTADA
# =====================================================================
$s = New-Slide
$bg = $s.Shapes.AddShape(1, 0, 0, $SW, $SH)
$bg.Fill.ForeColor.RGB = $cBlue
$bg.Line.Visible = 0

$tb = $s.Shapes.AddTextbox(1, 80, 100, ($SW-160), 70)
$tb.TextFrame.TextRange.Text = "SummaCham - PanelAMCHAM"
$tb.TextFrame.TextRange.Font.Size = 42
$tb.TextFrame.TextRange.Font.Bold = -1
$tb.TextFrame.TextRange.Font.Color.RGB = $cWhite
$tb.TextFrame.TextRange.Font.Name = "Segoe UI"

$line = $s.Shapes.AddShape(1, 80, 175, 300, 3)
$line.Fill.ForeColor.RGB = $cGreen
$line.Line.Visible = 0

$tb2 = $s.Shapes.AddTextbox(1, 80, 190, ($SW-160), 50)
$tb2.TextFrame.TextRange.Text = "Documentacion Tecnica Completa"
$tb2.TextFrame.TextRange.Font.Size = 28
$tb2.TextFrame.TextRange.Font.Color.RGB = $cWhite
$tb2.TextFrame.TextRange.Font.Name = "Segoe UI"

$tb3 = $s.Shapes.AddTextbox(1, 80, 245, ($SW-160), 90)
$tb3.TextFrame.TextRange.Text = "Arquitectura, APIs, Queries, Plantillas y Graficas`nExplicado paso a paso para cualquier audiencia"
$tb3.TextFrame.TextRange.Font.Size = 16
$tb3.TextFrame.TextRange.Font.Color.RGB = (C 200 220 255)
$tb3.TextFrame.TextRange.Font.Name = "Segoe UI"

$tb4 = $s.Shapes.AddTextbox(1, 80, 360, ($SW-160), 30)
$tb4.TextFrame.TextRange.Text = "Version 4.1.0 | Febrero 2026 | Iustus Renidet & J02V4N"
$tb4.TextFrame.TextRange.Font.Size = 14
$tb4.TextFrame.TextRange.Font.Color.RGB = (C 180 200 230)
$tb4.TextFrame.TextRange.Font.Name = "Segoe UI"

Log "Portada"


# =====================================================================
# SLIDE 2: QUE ES SUMMACHAM
# =====================================================================
$s = New-Slide
Add-Title $s "Que es SummaCham?"

Add-Body $s @"
Es una aplicacion de escritorio para gestionar presupuestos financieros.

Imagina un Excel inteligente que:
"@ -fs 15 -top 68 -h 55

Add-Box $s "Se conecta al sistema`ncontable (Aspel COI)`npara leer saldos reales" 45 130 200 65 $cNavy 11
Add-Box $s "Permite que varios`nusuarios trabajen`nal mismo tiempo" 255 130 200 65 $cGreen 11
Add-Box $s "Tiene un flujo de`naprobacion:`ncargar > revisar > aprobar" 465 130 200 65 $cOrange 11
Add-Box $s "Genera reportes`ny graficas`nautomaticamente" 675 130 200 65 $cSlate 11

Add-Body $s @"
USUARIOS TIPICOS:
  Analistas: Cargan datos de presupuesto (RH, Finanzas, Eventos, etc.)
  Supervisores: Revisan que los datos esten correctos
  Directores: Aprueban los presupuestos finales
  Administradores: Configuran usuarios, permisos y conexiones

COMO SE ACCEDE:
  Local: http://localhost:3005  (en la misma computadora)
  Remoto: https://panelamcham.iconetcloud.com.mx  (desde cualquier lugar)
"@ -fs 13 -top 210

Log "Que es SummaCham"


# =====================================================================
# SLIDE 3: CONTENIDO
# =====================================================================
$s = New-Slide
Add-Title $s "Contenido de esta Presentacion"

$y = 72
Add-Box $s "PARTE 1" 45 $y 100 28 $cBlue 12
Add-Body $s "Arquitectura y Tecnologias" -fs 14 -top $y -left 155 -w 400 -h 25
$y += 35
Add-Box $s "PARTE 2" 45 $y 100 28 $cGreen 12
Add-Body $s "Seguridad (Login, Cookies, Permisos)" -fs 14 -top $y -left 155 -w 400 -h 25
$y += 35
Add-Box $s "PARTE 3" 45 $y 100 28 $cOrange 12
Add-Body $s "APIs - Que son, rutas reales con ejemplos" -fs 14 -top $y -left 155 -w 400 -h 25
$y += 35
Add-Box $s "PARTE 4" 45 $y 100 28 $cRed 12
Add-Body $s "APIs - Mapa completo de todas las rutas" -fs 14 -top $y -left 155 -w 400 -h 25
$y += 35
Add-Box $s "PARTE 5" 45 $y 100 28 $cTeal 12
Add-Body $s "Queries - Como se calcula el Real" -fs 14 -top $y -left 155 -w 400 -h 25
$y += 35
Add-Box $s "PARTE 6" 45 $y 100 28 $cPurple 12
Add-Body $s "Queries - Presupuesto y Acumulados" -fs 14 -top $y -left 155 -w 400 -h 25
$y += 35
Add-Box $s "PARTE 7" 45 $y 100 28 $cNavy 12
Add-Body $s "Gestor de Plantillas" -fs 14 -top $y -left 155 -w 400 -h 25
$y += 35
Add-Box $s "PARTE 8" 45 $y 100 28 $cSlate 12
Add-Body $s "Graficas" -fs 14 -top $y -left 155 -w 400 -h 25
$y += 35
Add-Box $s "PARTE 9" 45 $y 100 28 $cBlue 12
Add-Body $s "Base de Datos, Backups y Deployment" -fs 14 -top $y -left 155 -w 400 -h 25

Log "Contenido"


# =====================================================================
# PARTE 1: ARQUITECTURA
# =====================================================================

# SLIDE 4: ARQUITECTURA VISUAL
$s = New-Slide
Add-Title $s "PARTE 1: Como esta construido SummaCham"

Add-Body $s "El sistema tiene 3 grandes partes que se comunican entre si:" -fs 14 -top 68 -h 25

# Diagrama visual
Add-Box $s "FRONTEND`n(Lo que VE el usuario)" 45 100 250 50 $cNavy 13
Add-Label $s "HTML + JavaScript + CSS`nNavegador dentro de Electron" 45 155 250 35 10

Add-Arrow $s 305 115 40 20

Add-Box $s "BACKEND`n(El servidor que procesa)" 355 100 250 50 $cOrange 13
Add-Label $s "Node.js + Express`nPuerto 3005" 355 155 250 35 10

Add-Arrow $s 615 105 40 15

Add-Box $s "SQLite`n(Config local)" 665 95 200 30 $cGreen 11
Add-Arrow $s 615 135 40 15
Add-Box $s "Firebird`n(Datos contables)" 665 130 200 30 $cSlate 11

Add-Divider $s 200

Add-Body $s @"
COMO FUNCIONA PASO A PASO:

1. El usuario abre la app (Electron abre una ventana con un navegador integrado)
2. El navegador carga http://localhost:3005 (la pagina del sistema)
3. Cuando necesita datos, el frontend envia una PETICION al backend
     Ejemplo: "Dame el reporte RESUMEN de empresa1 para Junio 2025"
4. El backend recibe la peticion y busca los datos en 2 lugares:
     SQLite: Que cuentas mostrar, que formulas aplicar, que permisos tiene el usuario
     Firebird: Los saldos reales del sistema contable Aspel COI
5. El backend responde con los datos en formato JSON
6. El frontend muestra los datos en tablas y graficas
"@ -fs 12 -top 210

Log "Arquitectura"


# SLIDE 5: TECNOLOGIAS
$s = New-Slide
Add-Title $s "Tecnologias utilizadas"

# Frontend
Add-Box $s "FRONTEND" 45 68 ($SW/2-55) 28 $cNavy 13
$y = 100
Add-Body $s @"
  Electron 39.2.7  App de escritorio (navegador integrado)
  Bootstrap 5      Hace que se vea profesional
  Chart.js 4.3     Graficas interactivas (barras, lineas, pie)
  DataTables 1.13  Tablas con busqueda y filtros
  SweetAlert2      Dialogos y notificaciones bonitas
  ExcelJS / XLSX   Exportar datos a Excel
  jsPDF            Exportar a PDF
  Font Awesome 6.4 Iconos
"@ -fs 11 -top $y -left 50 -w ($SW/2-65) -h 200

# Backend
Add-Box $s "BACKEND" ($SW/2+10) 68 ($SW/2-55) 28 $cOrange 13
Add-Body $s @"
  Node.js          Motor de JavaScript en servidor
  Express.js       Framework web (maneja peticiones)
  Better-SQLite3   Base de datos local
  node-firebird    Conexion al sistema contable
  bcryptjs         Encriptar contrasenas
  jsonwebtoken     Tokens de acceso (JWT)
  Joi              Validar datos de entrada
  Helmet           Proteccion HTTP
  express-session  Sesiones de usuario
"@ -fs 11 -top $y -left ($SW/2+15) -w ($SW/2-65) -h 200

Add-Divider $s 310

Add-Body $s @"
EN RESUMEN: El frontend usa HTML/JavaScript puro (sin React ni Angular).
El backend usa Node.js con Express para recibir peticiones y responder con datos.
"@ -fs 13 -top 320

Log "Tecnologias"


# =====================================================================
# PARTE 2: SEGURIDAD
# =====================================================================

# SLIDE 6: LOGIN
$s = New-Slide
Add-Title $s "PARTE 2: Como funciona el Login"

Add-Body $s "Cuando escribes tu usuario y contrasena, pasa esto:" -fs 13 -top 68 -h 22

$y = 95
$steps = @(
    @{ num="1"; color=$cBlue;   text="El frontend envia:  POST /api/auth/login  con { usuario: 'JPEREZ', contrasena: '...' }" },
    @{ num="2"; color=$cOrange; text="El servidor valida con Joi: usuario minimo 2 caracteres, contrasena minimo 6" },
    @{ num="3"; color=$cOrange; text="Rate Limiting: Si hay 10+ intentos fallidos en 10 min, la IP se bloquea 5 minutos" },
    @{ num="4"; color=$cGreen;  text="Busca en SQLite: SELECT * FROM usuarios WHERE usuario = 'JPEREZ'" },
    @{ num="5"; color=$cGreen;  text="Compara contrasena con bcrypt (hash irreversible, nadie puede leerla)" },
    @{ num="6"; color=$cTeal;   text="Crea sesion + cookie 'panelamcham.sid' + JWT token (valido 1 hora)" },
    @{ num="7"; color=$cNavy;   text="Carga permisos del usuario (que empresas y modulos puede ver)" }
)

foreach ($step in $steps) {
    Add-Box $s $step.num 45 $y 26 24 $step.color 12
    Add-Body $s $step.text -fs 11 -top ($y+2) -left 80 -w ($SW-120) -h 22
    $y += 30
}

Add-Divider $s ($y + 5)

Add-Body $s @"
RESULTADO: El usuario entra al sistema con sus permisos cargados.
ARCHIVOS: src/routes/auth.js (login/logout)  |  src/middleware/auth.js (verificar sesion)
"@ -fs 11 -top ($y + 12)

Log "Login"


# SLIDE 7: COOKIES Y SESION
$s = New-Slide
Add-Title $s "Cookies y Sesiones"

Add-Body $s @"
Una cookie es un dato que el servidor manda al navegador.
Es como una PULSERA de acceso: la muestras cada vez que haces una peticion.
"@ -fs 13 -top 68 -h 40

Add-Code $s @"
Cookie de SummaCham:
  Nombre:   "panelamcham.sid"
  httpOnly:  true   (JavaScript del navegador NO puede leerla - protege contra ataques)
  secure:    true   (Solo funciona con HTTPS en produccion)
  maxAge:    30 min (Si no haces nada en 30 min, se cierra la sesion)
  rolling:   true   (Se renueva con cada click, asi no expira mientras trabajas)

Token JWT (va en el header de cada peticion):
  Duracion:  1 hora (access token)
  Refresh:   7 dias (permite renovar el access token sin re-login)
  Header:    Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
"@ -top 115 -h 150

Add-Body $s @"
COMO SE MANTIENE LA SESION:
  Login a las 09:00 -> expira 09:30
  Click a las 09:15 -> se extiende a 09:45 (rolling)
  Sin actividad 30 min -> sesion cerrada, debe re-loguearse

DONDE SE GUARDA: En SQLite (tabla de sesiones), NO en memoria del servidor
"@ -fs 12 -top 280

Log "Cookies y Sesion"


# SLIDE 8: PERMISOS
$s = New-Slide
Add-Title $s "Sistema de Permisos"

Add-Body $s "Cada usuario tiene permisos en 3 niveles:" -fs 13 -top 68 -h 22

# Nivel 1
Add-Box $s "NIVEL 1: USUARIO" 45 95 ($SW-90) 25 $cBlue 12
Add-Body $s "es_admin_global (acceso total) | puede_agregar | puede_modificar | puede_eliminar" -fs 11 -top 123 -left 55 -w ($SW-110) -h 20

# Nivel 2
Add-Box $s "NIVEL 2: EMPRESA" 45 150 ($SW-90) 25 $cGreen 12
Add-Body $s "Un usuario puede tener acceso a: empresa1 (CDMX), empresa2 (GDL), empresa3 (MTY), empresa4 (QRO)" -fs 11 -top 178 -left 55 -w ($SW-110) -h 20

# Nivel 3
Add-Box $s "NIVEL 3: MODULO + ACCION" 45 205 ($SW-90) 25 $cOrange 12

Add-Code $s @"
Ejemplo: Juan Perez en empresa1 (CDMX):

  Modulo       | Ver | Cargar | Revisar | Aprobar
  -------------|-----|--------|---------|--------
  RH           | SI  |   SI   |   NO    |   NO     (puede ver y cargar datos)
  Finanzas     | SI  |   NO   |   SI    |   NO     (puede ver y revisar)
  RESUMEN      | SI  |   NO   |   NO    |   NO     (solo lectura)

Tabla SQLite: permisos_modulo  (usuario_id + empresa_id + modulo + permisos)
"@ -top 235 -h 140

Add-Body $s @"
ADMIN GLOBAL: Salta todas las verificaciones, puede hacer todo en todo.
VERIFICACION: Cada peticion al servidor se valida con requireAuth + tienePermisoModulo()
"@ -fs 11 -top 385

Log "Permisos"


# =====================================================================
# PARTE 3: APIS - QUE SON Y COMO FUNCIONAN
# =====================================================================

# SLIDE 9: QUE ES UNA API
$s = New-Slide
Add-Title $s "PARTE 3: Que es una API?"

Add-Body $s @"
API = el MENSAJERO entre lo que ves en pantalla y donde estan los datos.
"@ -fs 14 -top 68 -h 22

Add-Box $s "TU`n(navegador)" 55 100 130 50 $cNavy 12
Add-Arrow $s 192 115
Add-Box $s "API`n(mensajero)" 235 100 130 50 $cOrange 12
Add-Arrow $s 372 115
Add-Box $s "SERVIDOR`n(procesa)" 415 100 130 50 $cGreen 12
Add-Arrow $s 552 115
Add-Box $s "BASE DE`nDATOS" 595 100 130 50 $cSlate 12

Add-Body $s @"
Como funciona en SummaCham:

1. Haces click en "RESUMEN" en la app
2. El frontend automaticamente envia esta peticion HTTP:

     GET http://localhost:3005/api/reportes/resumen?empresaId=empresa1&anio=2025&mes=6

3. La peticion viaja con tu cookie de sesion y token JWT
4. El servidor la recibe, verifica que tengas permiso, y busca los datos
5. Responde con un JSON (datos estructurados)
6. El frontend pinta la tabla con esos datos

CADA PETICION LLEVA:
  Cookie:      panelamcham.sid=abc123...  (identifica tu sesion)
  Header:      Authorization: Bearer eyJhbG...  (tu token JWT)
  Header:      X-Empresa-Activa: empresa1  (empresa seleccionada)
"@ -fs 12 -top 165

Log "Que es una API"


# SLIDE 10: EJEMPLO REAL DE PETICION
$s = New-Slide
Add-Title $s "Ejemplo real: Abrir el RESUMEN paso a paso"

$y = 68
$pasos = @(
    @{ n="1"; c=$cBlue;   t="Abres RESUMEN.html en la app" },
    @{ n="2"; c=$cBlue;   t="resumen-view.js prepara la peticion con empresa, anio y mes" },
    @{ n="3"; c=$cOrange;  t="Envia:  GET /api/reportes/resumen?empresaId=empresa1&anio=2025&mes=6" },
    @{ n="4"; c=$cOrange;  t="src/server.js dirige /api/reportes/* a src/routes/reportes.js" },
    @{ n="5"; c=$cRed;     t="middleware/auth.js verifica tu cookie y JWT -> carga tus permisos" },
    @{ n="6"; c=$cGreen;   t="reportes.js valida parametros y llama a planeacionReportesEngine" },
    @{ n="7"; c=$cGreen;   t="Engine carga layout de SQLite: que cuentas y operaciones tiene RESUMEN" },
    @{ n="8"; c=$cTeal;    t="Engine consulta Firebird: saldos reales de SALDOS25 y presupuestos de PRESUP25" },
    @{ n="9"; c=$cTeal;    t="Engine calcula: Real, Presupuesto, Acumulados, Variaciones, Totales" },
    @{ n="10"; c=$cSlate;  t="Servidor responde JSON -> resumen-view.js pinta la tabla" }
)

foreach ($paso in $pasos) {
    Add-Box $s $paso.n 42 $y 28 22 $paso.c 11
    Add-Body $s $paso.t -fs 11 -top ($y+1) -left 78 -w ($SW-120) -h 20
    $y += 27
}

Add-Divider $s ($y + 3)
Add-Body $s @"
ARCHIVOS INVOLUCRADOS:
  Frontend: vistas/js/resumen-view.js  ->  Backend: src/routes/reportes.js
  Motor: src/services/reportes/planeacionReportesEngine.js  ->  Firebird: planeacionCuentasService.js
"@ -fs 10 -top ($y + 8)

Log "Ejemplo paso a paso"


# SLIDE 11: APIS DE AUTENTICACION
$s = New-Slide
Add-Title $s "APIs reales: Autenticacion (/api/auth)"

Add-Body $s "Estas son las rutas que manejan login, logout y renovacion de sesion:" -fs 12 -top 68 -h 22

Add-Code $s @"
POST /api/auth/login
  Que hace: Iniciar sesion
  Envia:    { "usuario": "JPEREZ", "contrasena": "MiClave123" }
  Responde: { token: "eyJhbG...", refreshToken: "eyJhbG...",
              usuario: { id: 5, nombre: "Juan", esAdmin: false },
              permisos: { empresa1: { RH: {ver:true, cargar:true}, ... } } }
  Errores:  400 (datos invalidos) | 401 (credenciales incorrectas) | 429 (bloqueado)

POST /api/auth/refresh
  Que hace: Renovar el token sin re-login (cuando el access token expira)
  Envia:    { "refreshToken": "eyJhbG..." }
  Responde: { token: "nuevoToken...", refreshToken: "nuevoRefresh..." }

POST /api/auth/logout
  Que hace: Cerrar sesion (destruye cookie y sesion del servidor)
  Responde: { mensaje: "Sesion cerrada" }
"@ -top 95 -h 210

Add-Body $s @"
ARCHIVO: src/routes/auth.js
PROTECCION: Rate limiting (10 intentos / 10 min, bloqueo 5 min)
"@ -fs 11 -top 320

Log "APIs auth"


# SLIDE 12: APIS DE REPORTES
$s = New-Slide
Add-Title $s "APIs reales: Reportes (/api/reportes)"

Add-Body $s "Estas rutas generan los reportes financieros:" -fs 12 -top 68 -h 22

Add-Code $s @"
GET /api/reportes/summary?empresaId=empresa1&anio=2025&mes=6
  Que hace:  Genera el reporte SUMMARY (ingles) para empresa1, Jun 2025
  Responde:  { layout: [...], cuentas: [...], operaciones: [...], totales: {...} }
  Archivo:   src/routes/reportes.js -> summaryEngine -> planeacionReportesEngine

GET /api/reportes/resumen?empresaId=empresa1&anio=2025&mes=6
  Que hace:  Genera el reporte RESUMEN (espanol) para empresa1, Jun 2025
  Responde:  Misma estructura que summary pero con layout de RESUMEN
  Archivo:   src/routes/reportes.js -> planeacionReportesEngine.generarReporte()

GET /api/reportes/diagnostico-firebird?empresaId=empresa1
  Que hace:  Prueba si la conexion a Firebird funciona para esa empresa
  Responde:  { conectado: true/false, mensaje: "...", tiempoMs: 45 }

POST /api/reportes/operativo-excel-native
  Que hace:  Importa datos desde un archivo Excel al modulo operativo
  Envia:     Archivo Excel (.xlsx) como binario
"@ -top 95 -h 210

Add-Body $s @"
PARAMETROS COMUNES:
  empresaId = empresa1, empresa2, empresa3, empresa4 (cual empresa)
  anio = 2024, 2025, 2026 (que ano fiscal)
  mes = 1-12 (que mes quieres ver)
"@ -fs 12 -top 320

Log "APIs reportes"


# SLIDE 13: APIS DE PRESUPUESTOS
$s = New-Slide
Add-Title $s "APIs reales: Presupuestos (/api/presupuestos)"

Add-Code $s @"
GET /api/presupuestos?empresaId=empresa1&modulo=RH&anio=2025&capitulo=DEFAULT
  Que hace:  Trae los datos de presupuesto guardados para RH 2025
  Responde:  { datos: [...], estado: "cargado" }

GET /api/presupuestos/anios?empresaId=empresa1
  Que hace:  Lista los anios disponibles en Firebird para esa empresa
  Responde:  { anios: [2023, 2024, 2025, 2026] }

GET /api/presupuestos/estado?empresaId=empresa1&modulo=RH&anio=2025
  Que hace:  Ver estado actual del presupuesto
  Responde:  { estado: "revisado", usuario: "JPEREZ", fecha: "2025-06-15" }

POST /api/presupuestos/estado
  Que hace:  Cambiar estado (ej: de "cargado" a "revisado")
  Envia:     { empresaId: "empresa1", modulo: "RH", anio: 2025,
               nuevoEstado: "revisado" }

POST /api/presupuestos/guardar
  Que hace:  Guardar datos de presupuesto oficialmente
  Envia:     { empresaId: "empresa1", modulo: "RH", anio: 2025,
               datos: [ { cuenta: "4100", ene: 100000, feb: 110000, ... } ] }

GET /api/presupuestos/totales-capitulo?empresaId=empresa1&modulo=RH&anio=2025
  Que hace:  Totales resumidos por capitulo (CDMX, GDL, MTY, QRO)
"@ -top 68 -h 340

Add-Body $s "ARCHIVO: src/routes/presupuestos.js | Permisos: segun modulo y empresa" -fs 10 -top 420

Log "APIs presupuestos"


# SLIDE 14: APIS DE BORRADORES
$s = New-Slide
Add-Title $s "APIs reales: Borradores (/api/borradores)"

Add-Body $s "Los borradores guardan automaticamente el trabajo del usuario:" -fs 12 -top 68 -h 22

Add-Code $s @"
POST /api/borradores/guardar
  Que hace:  Guarda automaticamente mientras el usuario escribe (autoguardado)
  Envia:     { empresaId: "empresa1", modulo: "RH", anio: 2025,
               capitulo: "DEFAULT", datos: [...] }
  Nota:      Se ejecuta automaticamente cada pocos segundos

GET /api/borradores/listar?empresaId=empresa1&modulo=RH&anio=2025
  Que hace:  Lista todos los borradores guardados para ese modulo
  Responde:  [{ id: 12, fecha: "2025-06-15 10:30", estado: "borrador" }]

POST /api/borradores/enviar
  Que hace:  Marca el borrador como "enviado" (listo para revision)

POST /api/borradores/revisar
  Que hace:  Un supervisor marca como "revisado"

POST /api/borradores/autorizar
  Que hace:  Un director da su aprobacion final

POST /api/borradores/rechazar
  Que hace:  Regresa el borrador al estado anterior con comentarios

POST /api/borradores/recontabilizar
  Que hace:  Recalcula los saldos desde Firebird (refresca datos reales)
"@ -top 95 -h 300

Add-Body $s "ARCHIVO: src/routes/borradores.js | FLUJO: borrador > enviado > revisado > autorizado" -fs 10 -top 410

Log "APIs borradores"


# SLIDE 15: APIS DE USUARIOS
$s = New-Slide
Add-Title $s "APIs reales: Usuarios (/api/usuarios)"

Add-Code $s @"
GET /api/usuarios
  Que hace:  Lista todos los usuarios del sistema
  Responde:  [{ id: 1, usuario: "ICONET", nombre: "Admin", esAdmin: true },
              { id: 5, usuario: "JPEREZ", nombre: "Juan Perez", esAdmin: false }]

GET /api/usuarios/5
  Que hace:  Datos de un usuario especifico (por id)
  Responde:  { id: 5, usuario: "JPEREZ", nombres: "Juan Carlos", ... }

POST /api/usuarios
  Que hace:  Crear un usuario nuevo (requiere permiso puede_agregar)
  Envia:     { usuario: "MLOPEZ", nombres: "Maria", contrasena: "Segura123",
               correo: "maria@empresa.com", es_admin_global: 0 }

PUT /api/usuarios/5
  Que hace:  Editar un usuario existente (requiere permiso puede_modificar)
  Envia:     { nombres: "Juan Carlos", correo: "nuevo@empresa.com" }

DELETE /api/usuarios/5
  Que hace:  Eliminar un usuario (requiere permiso puede_eliminar)
  Nota:      Tambien elimina todos sus permisos (CASCADE)

POST /api/usuarios/5/permisos
  Que hace:  Asignar permisos a un usuario
  Envia:     { empresa_id: "empresa1", modulo: "RH",
               puede_leer: 1, puede_cargar_guardar: 1, puede_revisar: 0 }
"@ -top 68 -h 340

Add-Body $s "ARCHIVO: src/routes/usuarios.js | REQUIERE: ser admin o tener permisos generales" -fs 10 -top 420

Log "APIs usuarios"


# SLIDE 16: MAPA COMPLETO DE APIS
$s = New-Slide
Add-Title $s "PARTE 4: Mapa completo de TODAS las APIs"

$col1x = 40; $col2x = 315; $col3x = 590
$bw = 265; $bh = 24; $gap = 28

# Columna 1 - Autenticacion y Datos
Add-Label $s "AUTENTICACION Y USUARIOS" $col1x 65 $bw 18 10
Add-Box $s "POST  /api/auth/login" $col1x 82 $bw $bh $cBlue 10
Add-Box $s "POST  /api/auth/refresh" $col1x ([float](82+$gap)) $bw $bh $cBlue 10
Add-Box $s "POST  /api/auth/logout" $col1x ([float](82+2*$gap)) $bw $bh $cBlue 10
Add-Box $s "GET|POST|PUT|DEL /api/usuarios" $col1x ([float](82+3*$gap)) $bw $bh $cNavy 10
Add-Box $s "GET  /api/empresas" $col1x ([float](82+4*$gap)) $bw $bh $cNavy 10

Add-Label $s "REPORTES" $col1x ([float](82+5*$gap+8)) $bw 18 10
Add-Box $s "GET  /api/reportes/summary" $col1x ([float](82+5*$gap+24)) $bw $bh $cOrange 10
Add-Box $s "GET  /api/reportes/resumen" $col1x ([float](82+6*$gap+24)) $bw $bh $cOrange 10
Add-Box $s "GET  /api/saldos/:empresaId" $col1x ([float](82+7*$gap+24)) $bw $bh $cOrange 10

# Columna 2 - Presupuestos y Borradores
Add-Label $s "PRESUPUESTOS" $col2x 65 $bw 18 10
Add-Box $s "GET  /api/presupuestos" $col2x 82 $bw $bh $cGreen 10
Add-Box $s "POST /api/presupuestos/guardar" $col2x ([float](82+$gap)) $bw $bh $cGreen 10
Add-Box $s "GET|POST /api/presupuestos/estado" $col2x ([float](82+2*$gap)) $bw $bh $cGreen 10

Add-Label $s "BORRADORES" $col2x ([float](82+3*$gap+8)) $bw 18 10
Add-Box $s "POST /api/borradores/guardar" $col2x ([float](82+3*$gap+24)) $bw $bh $cTeal 10
Add-Box $s "POST /api/borradores/enviar" $col2x ([float](82+4*$gap+24)) $bw $bh $cTeal 10
Add-Box $s "POST /api/borradores/revisar" $col2x ([float](82+5*$gap+24)) $bw $bh $cTeal 10
Add-Box $s "POST /api/borradores/autorizar" $col2x ([float](82+6*$gap+24)) $bw $bh $cTeal 10
Add-Box $s "POST /api/borradores/recontabilizar" $col2x ([float](82+7*$gap+24)) $bw $bh $cTeal 10

# Columna 3 - Plantillas, Graficas, Config
Add-Label $s "PLANTILLAS (LAYOUTS)" $col3x 65 $bw 18 10
Add-Box $s "GET|POST /api/layouts-config/..." $col3x 82 $bw $bh $cPurple 10
Add-Box $s "PUT|DEL  /api/layouts-config/..." $col3x ([float](82+$gap)) $bw $bh $cPurple 10
Add-Box $s "POST /api/insercion/..." $col3x ([float](82+2*$gap)) $bw $bh $cPurple 10

Add-Label $s "GRAFICAS Y CONFIG" $col3x ([float](82+3*$gap+8)) $bw 18 10
Add-Box $s "GET|POST /api/graficas-config" $col3x ([float](82+3*$gap+24)) $bw $bh $cSlate 10
Add-Box $s "GET|PUT  /api/firebird-config" $col3x ([float](82+4*$gap+24)) $bw $bh $cSlate 10
Add-Box $s "GET|POST /api/backups/..." $col3x ([float](82+5*$gap+24)) $bw $bh $cSlate 10
Add-Box $s "GET|POST /api/notificaciones" $col3x ([float](82+6*$gap+24)) $bw $bh $cSlate 10
Add-Box $s "GET|PUT  /api/perfil" $col3x ([float](82+7*$gap+24)) $bw $bh $cSlate 10

Add-Body $s "Todas las rutas se registran en src/server.js y se definen en src/routes/*.js" -fs 10 -top ($SH - 30)

Log "Mapa APIs"


# =====================================================================
# PARTE 5: QUERIES - CALCULO DEL REAL
# =====================================================================

# SLIDE 17: DE DONDE SALEN LOS NUMEROS
$s = New-Slide
Add-Title $s "PARTE 5: De donde salen los numeros?"

Add-Body $s "Los numeros que ves en pantalla vienen de Firebird (Aspel COI):" -fs 13 -top 68 -h 22

Add-Box $s "Firebird" 45 100 150 40 $cSlate 13
Add-Label $s "Base de datos del sistema`ncontable (Aspel COI)" 45 143 150 30 9

Add-Arrow $s 205 110

Add-Box $s "CUENTAS25" 250 95 155 22 $cNavy 10
Add-Label $s "Catalogo de cuentas del ano 2025" 250 119 200 18 9
Add-Box $s "SALDOS25" 250 140 155 22 $cOrange 10
Add-Label $s "Movimientos mensuales (cargos/abonos)" 250 164 220 18 9
Add-Box $s "PRESUP25" 250 185 155 22 $cGreen 10
Add-Label $s "Presupuestos por mes" 250 209 200 18 9

Add-Arrow $s 415 130

Add-Box $s "SummaCham" 460 105 150 50 $cBlue 13
Add-Label $s "Lee, calcula y`nmuestra los datos" 460 158 150 30 9

Add-Divider $s 230

Add-Body $s @"
TABLAS POR ANO: Firebird tiene tablas separadas para cada ano fiscal:
  2024: CUENTAS24, SALDOS24, PRESUP24
  2025: CUENTAS25, SALDOS25, PRESUP25
  2026: CUENTAS26, SALDOS26, PRESUP26

CADA CUENTA EN SALDOS TIENE:
  12 columnas de CARGO (CARGO01...CARGO12) = dinero que ENTRA a la cuenta
  12 columnas de ABONO (ABONO01...ABONO12) = dinero que SALE de la cuenta

QUE HACE SUMMACHAM CON ESTOS DATOS:
  1. Lee las cuentas del layout (cuales mostrar)
  2. Busca sus saldos en Firebird
  3. Aplica la regla de NATURALEZA (siguiente slide)
  4. Calcula Real, Presupuesto, Acumulados y Variaciones
"@ -fs 12 -top 238

Log "De donde salen los numeros"


# SLIDE 18: CALCULO DEL REAL
$s = New-Slide
Add-Title $s "Como se calcula el REAL (dato contable actual)"

Add-Body $s "La NATURALEZA de la cuenta decide la formula:" -fs 13 -top 68 -h 22

# Dos cajas de formula
Add-Box $s "Cuenta ACREEDORA (ingresos)`nCuentas que empiezan con 2, 3, 4" 45 95 ($SW/2-55) 40 $cGreen 11
Add-Code $s @"
Real = ABONOS - CARGOS

Ejemplo cuenta 4100 "Membership" en Junio:
  ABONO06 = 150,000  (creditos)
  CARGO06 =  15,000  (debitos)
  REAL = 150,000 - 15,000 = 135,000
"@ -top 140 -left 45 -w ($SW/2-55) -h 105

Add-Box $s "Cuenta DEUDORA (gastos)`nCuentas que empiezan con 1, 5-9" ($SW/2) 95 ($SW/2-55) 40 $cOrange 11
Add-Code $s @"
Real = CARGOS - ABONOS

Ejemplo cuenta 5100 "Salaries" en Junio:
  CARGO06 = 120,000  (debitos)
  ABONO06 =   5,000  (creditos)
  REAL = 120,000 - 5,000 = 115,000
"@ -top 140 -left ($SW/2) -w ($SW/2-55) -h 105

Add-Divider $s 255

Add-Body $s @"
POR QUE ES DIFERENTE?
  Porque en contabilidad, un ingreso AUMENTA con abonos (creditos)
  y un gasto AUMENTA con cargos (debitos). La formula ajusta para que
  el numero siempre sea POSITIVO cuando la cuenta tiene saldo a favor.

ARCHIVO CLAVE: src/services/planeacionCuentasService.js
  Funcion: obtenerSaldosPorCuentas() y determinarNaturalezaReal()
"@ -fs 12 -top 265

Log "Calculo del Real"


# SLIDE 19: CALCULO DEL PRESUPUESTO
$s = New-Slide
Add-Title $s "PARTE 6: Como se calcula el PRESUPUESTO"

Add-Body $s "El presupuesto es MAS SIMPLE que el Real. Se lee directo:" -fs 13 -top 68 -h 22

Add-Code $s @"
-- Tabla Firebird: PRESUP25 (presupuestos del ano 2025)
-- Tiene 12 columnas: PRESUP01, PRESUP02, ... PRESUP12

SELECT pr.NUM_CTA,
       COALESCE(pr.PRESUP06, 0) AS presupuesto_junio
FROM PRESUP25 pr
WHERE pr.NUM_CTA IN ('4100', '5100')

-- Resultado:
-- 4100 (Membership):  PRESUP06 = 140,000  <- se usa TAL CUAL
-- 5100 (Salaries):    PRESUP06 = 110,000  <- se usa TAL CUAL
"@ -top 95 -h 145

Add-Body $s @"
DIFERENCIA CLAVE CON EL REAL:
  El REAL se CALCULA (abonos - cargos o cargos - abonos segun naturaleza)
  El PRESUPUESTO se LEE directamente de la tabla (sin calculo)

PARA QUE SIRVE LA COMPARACION:
  Si Real = 135,000 y Presupuesto = 140,000
  Variacion = (135K - 140K) / 140K x 100 = -3.6%
  Significa que estas 3.6% por debajo de lo planeado
"@ -fs 13 -top 255

Log "Presupuesto"


# SLIDE 20: ACUMULADOS
$s = New-Slide
Add-Title $s "Como se calculan los ACUMULADOS (YTD)"

Add-Body $s "YTD = Year-To-Date = Suma desde Enero hasta el mes que seleccionaste:" -fs 13 -top 68 -h 22

Add-Code $s @"
Si seleccionas MES = 6 (Junio):

  Real Acumulado = Real Ene + Real Feb + Real Mar + Real Abr + Real May + Real Jun
  Ppto Acumulado = PRESUP01 + PRESUP02 + PRESUP03 + PRESUP04 + PRESUP05 + PRESUP06
  Real Acum AA   = Misma suma pero del ano ANTERIOR (SALDOS24 en vez de SALDOS25)
"@ -top 95 -h 75

# Tabla ejemplo
Add-Body $s @"
EJEMPLO - Cuenta 4100 "Membership" - Seleccion: Junio 2025

  Valor                  Numero      Que significa
  ------------------     ----------  ------------------------------------------
  Real del Mes           135,000     Movimiento neto de Junio 2025
  Presupuesto del Mes    140,000     Lo que se planeo para Junio 2025
  Real Acumulado         810,000     Suma real de Enero a Junio 2025
  Ppto Acumulado         840,000     Suma planeada de Enero a Junio 2025
  Real Acumulado AA      780,000     Suma real de Enero a Junio 2024
  Variacion vs Plan      -3.6%       (Real - Ppto) / Ppto = debajo del plan
"@ -fs 11 -top 180 -h 130

Add-Divider $s 318

Add-Body $s @"
ESTOS 6 VALORES SON LOS QUE VES EN CADA FILA DEL REPORTE:
  actualMonth (Real)  |  planMonth (Ppto)  |  prevMonth (Real ano anterior)
  actualYTD (Real Acum)  |  planYTD (Ppto Acum)  |  prevYTD (Real Acum AA)

ARCHIVOS: planeacionCuentasService.js (query SQL) + planeacionReportesEngine.js (calculo)
"@ -fs 11 -top 325

Log "Acumulados"


# SLIDE 21: FLUJO DE DATOS COMPLETO
$s = New-Slide
Add-Title $s "Flujo completo: De Firebird a tu pantalla"

# Diagrama vertical
$cx = ($SW - 350)/2

Add-Box $s "FIREBIRD - Aspel COI`nSALDOS25 + PRESUP25 + CUENTAS25" $cx 72 350 40 $cSlate 12
Add-DownArrow $s ($cx+165) 115

Add-Box $s "planeacionCuentasService.js`nobtenerSaldosPorCuentas(empresaId, 2025, cuentas)" $cx 145 350 40 $cOrange 10
Add-Label $s "Ejecuta SQL, aplica naturaleza, calcula Real" ($cx+360) 155 250 20 9
Add-DownArrow $s ($cx+165) 188

Add-Box $s "planeacionReportesEngine.js`ngenerarReporte('RESUMEN', empresa1, 2025, 6)" $cx 218 350 40 $cOrange 10
Add-Label $s "Carga layout SQLite, calcula operaciones, ordena" ($cx+360) 228 250 20 9
Add-DownArrow $s ($cx+165) 261

Add-Box $s "src/routes/reportes.js`nGET /api/reportes/resumen" $cx 291 350 35 $cGreen 11
Add-Label $s "Valida permisos, responde JSON al frontend" ($cx+360) 298 250 20 9
Add-DownArrow $s ($cx+165) 329

Add-Box $s "resumen-view.js`nRenderiza tabla HTML con los datos" $cx 359 350 35 $cNavy 11
Add-Label $s "Pinta filas, columnas, totales, colores" ($cx+360) 366 250 20 9

Log "Flujo datos"


# =====================================================================
# PARTE 7: GESTOR DE PLANTILLAS
# =====================================================================

# SLIDE 22: QUE ES EL GESTOR
$s = New-Slide
Add-Title $s "PARTE 7: Gestor de Plantillas"

Add-Body $s @"
El Gestor de Plantillas define la ESTRUCTURA de los reportes.
Sin plantilla, no hay reporte. Es como el "molde" que dice que cuentas mostrar.
"@ -fs 13 -top 68 -h 38

Add-Box $s "CUENTAS" 45 115 250 35 $cNavy 13
Add-Body $s "Filas individuales. Ej: '4100' Membership`nSe guardan en layout_cuentas (SQLite)" -fs 10 -top 155 -left 45 -w 250 -h 35

Add-Box $s "OPERACIONES" 315 115 250 35 $cOrange 13
Add-Body $s "Filas de CALCULO. Ej: Total Income`nSe guardan en layout_operaciones (SQLite)" -fs 10 -top 155 -left 315 -w 250 -h 35

Add-Box $s "SECCIONES" 585 115 250 35 $cGreen 13
Add-Body $s "Agrupan cuentas. Ej: Income (CDMX)`nSe guardan en layout_secciones (SQLite)" -fs 10 -top 155 -left 585 -w 250 -h 35

Add-Divider $s 198

Add-Body $s @"
COMO SE USA (paso a paso):
  1. Abres plantillas.html
  2. Seleccionas: empresa + modulo + ano + capitulo
  3. El sistema carga el layout existente (o creas uno nuevo)
  4. Agregas cuentas contables (numero + nombre + seccion)
  5. Configuras operaciones (formulas que suman/restan secciones)
  6. Ordenas con drag-and-drop (el orden en que se muestran)
  7. Guardas -> listo para generar reportes

CADA LAYOUT ES UNICO POR:
  Empresa (empresa1, empresa2...)  +  Modulo (RESUMEN, RH, Finanzas...)
  Ano (2024, 2025, 2026...)  +  Capitulo (CDMX, GDL, MTY, QRO, DEFAULT)

ARCHIVO PRINCIPAL: vistas/js/plantillas.js (~13,900 lineas)
"@ -fs 12 -top 205

Log "Gestor Plantillas"


# SLIDE 23: APIS DE PLANTILLAS
$s = New-Slide
Add-Title $s "APIs reales: Plantillas (/api/layouts-config)"

Add-Code $s @"
BASE: /api/layouts-config    ARCHIVO: src/routes/layoutRoutes.js

CARGAR Y GUARDAR:
  GET  /.../RESUMEN/2025/DEFAULT            Cargar layout completo de RESUMEN 2025
  POST /.../RESUMEN/2025/DEFAULT            Guardar layout completo
  POST /.../RESUMEN/2025/DEFAULT/cuentas    Guardar solo las cuentas
  POST /.../RESUMEN/2025/operaciones        Guardar solo las operaciones

CONSULTAS:
  GET  /.../RESUMEN/anios                   Que anios existen
  GET  /.../RESUMEN/2025/capitulos          Que capitulos hay (CDMX, GDL, etc.)
  GET  /.../RESUMEN/2025/estadisticas       Cuantas cuentas y operaciones tiene
  GET  /.../RESUMEN/2025/existe             Verificar si ya existe este layout

EDICION INDIVIDUAL:
  PUT    /.../RESUMEN/2025/DEFAULT/cuenta/4100    Editar cuenta 4100
  DELETE /.../RESUMEN/2025/DEFAULT/cuenta/4100    Eliminar cuenta 4100
  PUT    /.../RESUMEN/2025/operacion/TOTAL_INCOME Editar una operacion
  DELETE /.../RESUMEN/2025/operacion/TOTAL_INCOME Eliminar una operacion

ADMINISTRACION:
  POST   /.../RESUMEN/copiar                     Copiar layout de otro ano
  POST   /.../RESUMEN/2025/DEFAULT/reordenar     Cambiar orden de filas
  DELETE /.../RESUMEN/2025                        Eliminar layout completo
  GET    /.../RESUMEN/2025/DEFAULT/bitacora       Ver registro de cambios
"@ -top 68 -h ($SH - 85)

Log "APIs Plantillas"


# SLIDE 24: OPERACIONES CONSOLIDADAS
$s = New-Slide
Add-Title $s "Como funcionan las Operaciones (formulas)"

Add-Body $s "Las operaciones son filas que CALCULAN totales sumando o restando cuentas:" -fs 12 -top 68 -h 22

Add-Code $s @"
Ejemplo de formula guardada en layout_operaciones:

  Operacion: "TOTAL INCOME"
  Formula: [
    { operator: "+", type: "section", value: "Income (CDMX)" },
    { operator: "+", type: "section", value: "Income (GDL)" },
    { operator: "+", type: "section", value: "Income (MTY)" }
  ]
  Resultado: TOTAL INCOME = Suma de TODOS los ingresos de todas las ciudades

  Operacion: "NET INCOME"
  Formula: [
    { operator: "+", type: "operation", value: "CONSOLIDATED INCOME" },
    { operator: "-", type: "operation", value: "CONSOLIDATED EXPENSE" }
  ]
  Resultado: NET INCOME = Ingresos totales - Gastos totales
"@ -top 95 -h 175

Add-Body $s @"
TIPOS DE TERMINOS:
  section:    Suma TODAS las cuentas de esa seccion
  operation:  Usa el resultado de OTRA operacion (recursivo)
  account:    Usa el valor de UNA cuenta especifica

VENTAJA: Si agregas una nueva seccion (ej: Income Merida),
el sistema la detecta AUTOMATICAMENTE en los consolidados.

ARCHIVO: src/services/reportes/planeacionReportesEngine.js (calcularTotalesOperacion)
"@ -fs 12 -top 280

Log "Operaciones"


# =====================================================================
# PARTE 8: GRAFICAS
# =====================================================================

# SLIDE 25: SISTEMA DE GRAFICAS
$s = New-Slide
Add-Title $s "PARTE 8: Sistema de Graficas"

Add-Body $s "Las graficas toman los MISMOS datos del reporte y los visualizan:" -fs 13 -top 68 -h 22

# Tipos
Add-Box $s "Barra" 50 100 115 30 $cNavy 12
Add-Box $s "Linea" 175 100 115 30 $cOrange 12
Add-Box $s "Pie" 300 100 115 30 $cGreen 12
Add-Box $s "Dona" 425 100 115 30 $cSlate 12
Add-Box $s "Radar" 550 100 115 30 $cRed 12
Add-Box $s "Area" 675 100 115 30 $cPurple 12

Add-Body $s @"
GRAFICAS PREDEFINIDAS:
  1. Resultado Operativo: Real Acum vs Ppto Acum vs Real AA por capitulo
  2. Resumen Neto: Ganancia o perdida neta por capitulo
  3. Consolidados: Ingreso total vs Gasto total
  4. Tendencia mensual por ciudad
  5. Graficas personalizadas con Chart Wizard (4 pasos)

LOS 3 VALORES QUE SE GRAFICAN:
  Real Acumulado (actualYTD)    Color azul oscuro #0d47a1
  Ppto Acumulado (planYTD)      Color azul claro #60a5fa
  Real Acum AA   (prevYTD)      Color gris #94a3b8

SE GUARDAN EN: graficas_config (tabla SQLite)
  Tipo de grafica, colores, series habilitadas, si es apilada o no
"@ -fs 12 -top 145

Add-Divider $s 330

Add-Body $s @"
APIs:
  GET  /api/graficas-config             Cargar configuracion guardada
  POST /api/graficas-config             Guardar configuracion (solo admin)

ARCHIVOS: vistas/js/graficas-resumen.js + graficas-config.js + chart-wizard.js
"@ -fs 11 -top 340

Log "Graficas"


# =====================================================================
# PARTE 9: BASE DE DATOS, BACKUPS, DEPLOYMENT
# =====================================================================

# SLIDE 26: BASE DE DATOS SQLITE
$s = New-Slide
Add-Title $s "PARTE 9: Base de Datos SQLite"

Add-Body $s "Archivo local: datos/panel.sqlite - Guarda toda la configuracion:" -fs 12 -top 68 -h 22

$y = 95
$tablas = @(
    @{ name="usuarios"; desc="Nombre, contrasena (hash), es_admin, permisos generales"; color=$cBlue },
    @{ name="permisos_modulo"; desc="Que puede hacer cada usuario en cada empresa/modulo"; color=$cBlue },
    @{ name="presupuestos_estado"; desc="Estado actual: sin-cargar, cargado, revisado, aprobado"; color=$cGreen },
    @{ name="presupuestos_guardados"; desc="Datos de presupuesto guardados oficialmente"; color=$cGreen },
    @{ name="PLAN_BORRADORES"; desc="Autoguardado: datos que el usuario esta editando"; color=$cGreen },
    @{ name="layout_cuentas"; desc="Catalogo de cuentas por empresa/modulo/ano"; color=$cOrange },
    @{ name="layout_operaciones"; desc="Formulas de calculo (totales, consolidados)"; color=$cOrange },
    @{ name="layout_secciones"; desc="Agrupaciones (Income, Expense, etc.)"; color=$cOrange },
    @{ name="graficas_config"; desc="Configuracion de graficas guardadas"; color=$cSlate },
    @{ name="comentarios_celdas"; desc="Comentarios en celdas especificas del presupuesto"; color=$cSlate },
    @{ name="notificaciones"; desc="Alertas para los usuarios"; color=$cSlate },
    @{ name="sesiones"; desc="Sesiones activas (express-session store)"; color=$cSlate }
)

foreach ($t in $tablas) {
    Add-Box $s $t.name 45 $y 180 20 $t.color 9
    Add-Body $s $t.desc -fs 9 -top ($y+1) -left 232 -w ($SW-275) -h 18
    $y += 24
}

Add-Body $s "MODO: WAL (Write-Ahead Logging) permite lectura concurrente por multiples usuarios" -fs 10 -top ($SH - 25)

Log "SQLite"


# SLIDE 27: BACKUPS
$s = New-Slide
Add-Title $s "Sistema de Backups Automaticos"

Add-Body $s @"
SummaCham copia automaticamente la base de datos para proteger contra perdida:

  1. Al iniciar la app, se hace el primer backup
  2. Cada 60 minutos, se crea otro backup automaticamente
  3. Se guardan los ultimos 24 backups (los antiguos se eliminan)
  4. Ubicacion: datos/backups/panel.sqlite.bak_20260209_143022
"@ -fs 13 -top 68 -h 95

Add-Code $s @"
APIs de Backups (/api/backups):

  GET  /api/backups/status                  Estado del servicio de backups
  GET  /api/backups/list                    Listar backups disponibles
  POST /api/backups/create                  Crear backup manual (solo admin)
  POST /api/backups/restore                 Restaurar desde un backup (solo admin)
  GET  /api/backups/download/:fileName      Descargar un archivo de backup
  PUT  /api/backups/config                  Cambiar configuracion (intervalo, etc.)

Archivo: src/routes/backups.js + src/services/backupService.js
"@ -top 172 -h 140

Add-Body $s @"
CONFIGURACION FIREBIRD (/api/firebird-config):
  GET  /api/firebird-config               Ver config actual (host, port, empresas)
  PUT  /api/firebird-config/base          Cambiar host, puerto, usuario, contrasena
  PUT  /api/firebird-config/empresa/:id   Cambiar ruta de BD de una empresa
  POST /api/firebird-config/probar/:id    Probar conexion a una empresa
  Solo administradores pueden modificar estas configuraciones.
"@ -fs 11 -top 325

Log "Backups"


# SLIDE 28: SEGURIDAD RESUMEN
$s = New-Slide
Add-Title $s "Resumen de Seguridad"

$y = 72
$items = @(
    @{ n="1"; title="Contrasenas";   desc="bcrypt con 10 rondas de sal. NADIE puede leerlas."; c=$cBlue },
    @{ n="2"; title="Tokens JWT";    desc="Access token 1hr + Refresh token 7 dias. Se renuevan automaticamente."; c=$cBlue },
    @{ n="3"; title="Sesiones";      desc="Cookie httpOnly (JS no puede leerla) + SQLite store."; c=$cGreen },
    @{ n="4"; title="Rate Limiting"; desc="Max 10 intentos/10 min. Bloqueo 5 min contra fuerza bruta."; c=$cGreen },
    @{ n="5"; title="Helmet";        desc="Cabeceras HTTP de seguridad automaticas (XSS, CSRF, etc.)"; c=$cOrange },
    @{ n="6"; title="CORS";          desc="Solo origenes autorizados pueden hacer peticiones."; c=$cOrange },
    @{ n="7"; title="Validacion";    desc="Joi valida TODOS los datos de entrada antes de procesarlos."; c=$cSlate },
    @{ n="8"; title="SQL seguro";    desc="Queries parametrizados (?) previenen SQL injection."; c=$cSlate },
    @{ n="9"; title="Backups";       desc="Copias automaticas cada 60 min con checksum."; c=$cRed },
    @{ n="10"; title="Auditoria";    desc="Se registra todo: logins, cambios, queries lentas."; c=$cRed }
)

foreach ($item in $items) {
    Add-Box $s $item.n 42 $y 22 22 $item.c 10
    Add-Body $s "$($item.title): $($item.desc)" -fs 11 -top ($y+2) -left 72 -w ($SW-115) -h 20
    $y += 27
}

Log "Seguridad"


# SLIDE 29: DEPLOYMENT
$s = New-Slide
Add-Title $s "Compilacion y Distribucion"

Add-Body $s @"
COMO SE COMPILA:
  npm install                    Instalar dependencias
  npm run dist                   Crear instalador Windows (NSIS)
  npm run build:portable         Crear version portable (un solo .exe)

ARCHIVOS GENERADOS en ./dist/:
  SummaCham Setup 4.1.0.exe      Instalador (requiere admin)
  SummaCham 4.1.0.exe            Portable (sin instalacion)
  latest.yml                     Metadatos para auto-update

ACTUALIZACION AUTOMATICA:
  1. La app verifica en GitHub Releases si hay version nueva
  2. Si hay: pregunta "Descargar nueva version?"
  3. Descarga en segundo plano (no interrumpe el trabajo)
  4. Al cerrar la app, instala automaticamente
  5. Los DATOS del usuario se conservan (solo actualiza el programa)
"@ -fs 13 -top 68

Log "Deployment"


# SLIDE 30: CIERRE
$s = New-Slide
$bg = $s.Shapes.AddShape(1, 0, 0, $SW, $SH)
$bg.Fill.ForeColor.RGB = $cBlue
$bg.Line.Visible = 0

$tb = $s.Shapes.AddTextbox(1, 80, 60, ($SW-160), 55)
$tb.TextFrame.TextRange.Text = "SummaCham - PanelAMCHAM"
$tb.TextFrame.TextRange.Font.Size = 38
$tb.TextFrame.TextRange.Font.Bold = -1
$tb.TextFrame.TextRange.Font.Color.RGB = $cWhite
$tb.TextFrame.TextRange.Font.Name = "Segoe UI"

$line = $s.Shapes.AddShape(1, 80, 118, 300, 3)
$line.Fill.ForeColor.RGB = $cGreen
$line.Line.Visible = 0

$items = @(
    "Arquitectura en capas: Frontend + Backend + 2 bases de datos",
    "APIs REST completas: 20+ grupos de endpoints documentados",
    "Queries a Firebird con regla de naturaleza (Acreedora/Deudora)",
    "6 valores por cuenta: Real, Ppto, AA, Real Acum, Ppto Acum, AA Acum",
    "Gestor de Plantillas: 13,900 lineas que definen la estructura de reportes",
    "Operaciones recursivas: formulas que se auto-construyen",
    "Graficas interactivas con Chart.js (barra, linea, pie, dona, radar)",
    "Seguridad multicapa: bcrypt, JWT, rate limiting, helmet, CORS",
    "Backups automaticos cada 60 minutos",
    "Actualizacion automatica via GitHub Releases"
)

$y = 135
foreach ($item in $items) {
    $tb = $s.Shapes.AddTextbox(1, 90, $y, ($SW-180), 22)
    $tb.TextFrame.TextRange.Text = $item
    $tb.TextFrame.TextRange.Font.Size = 13
    $tb.TextFrame.TextRange.Font.Color.RGB = $cWhite
    $tb.TextFrame.TextRange.Font.Name = "Segoe UI"
    $y += 25
}

$tb = $s.Shapes.AddTextbox(1, 80, ($SH-50), ($SW-160), 30)
$tb.TextFrame.TextRange.Text = "Version 4.1.0  |  Febrero 2026  |  Iustus Renidet & J02V4N"
$tb.TextFrame.TextRange.Font.Size = 14
$tb.TextFrame.TextRange.Font.Color.RGB = (C 180 200 230)
$tb.TextFrame.TextRange.Font.Name = "Segoe UI"

Log "Cierre"


# =====================================================================
# GUARDAR
# =====================================================================
Write-Host "`nGuardando presentacion..." -ForegroundColor Yellow

try {
    $fullPath = [System.IO.Path]::GetFullPath($OutputPath)
    $pres.SaveAs($fullPath)
    Write-Host "Guardado en: $fullPath" -ForegroundColor Green
    $pres.Close()
    $ppt.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($pres) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    Write-Host "`nPresentacion Tecnica Definitiva creada: $n slides" -ForegroundColor Green
    Write-Host "Diseno profesional, APIs reales, explicaciones sencillas" -ForegroundColor Yellow
} catch {
    Write-Host "Error al guardar: $_" -ForegroundColor Red
    exit 1
}
