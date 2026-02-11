# Presentacion: APIs, Queries, Gestor de Plantillas y Graficas de SummaCham
# Con diseno profesional y contenido ajustado al tamano de diapositiva

param(
    [string]$OutputPath = "$PSScriptRoot\..\PRESENTACION_APIS_QUERIES_SUMMACHAM.pptx"
)

Write-Host "Creando presentacion de APIs, Queries y Sistemas..." -ForegroundColor Cyan

try {
    $ppt = New-Object -ComObject PowerPoint.Application
    $ppt.Visible = 1
    $pres = $ppt.Presentations.Add()
    $pres.PageSetup.SlideSize = 16
    Write-Host "PowerPoint OK" -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

# --- Medidas de slide 16:9 ---
$SW = [double]$pres.PageSetup.SlideWidth   # ~914
$SH = [double]$pres.PageSetup.SlideHeight  # ~514
$M = 40  # margen

# --- Colores OLE ---
Add-Type -AssemblyName System.Drawing
function C($r,$g,$b) { [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb($r,$g,$b)) }

$cBlue    = C 13 71 161      # titulos
$cDark    = C 17 24 39       # texto cuerpo
$cWhite   = C 255 255 255
$cLightBg = C 243 244 246    # fondo codigo
$cBorder  = C 229 231 235
$cAccent  = C 46 204 113     # verde
$cOrange  = C 230 126 34
$cRed     = C 231 76 60
$cGray    = C 107 114 128
$cLBlue   = C 96 165 250     # azul claro
$cNavy    = C 41 128 185
$cSlate   = C 52 73 94

# --- Funciones helper con diseno ---
function New-Slide { return $pres.Slides.Add($pres.Slides.Count + 1, 12) } # blank

function Add-Title($slide, $text) {
    # barra azul superior
    $bar = $slide.Shapes.AddShape(1, 0, 0, $SW, 60)
    $bar.Fill.ForeColor.RGB = $cBlue
    $bar.Line.Visible = 0
    $bar.TextFrame.TextRange.Text = "  $text"
    $bar.TextFrame.TextRange.Font.Size = 26
    $bar.TextFrame.TextRange.Font.Bold = -1
    $bar.TextFrame.TextRange.Font.Color.RGB = $cWhite
    $bar.TextFrame.TextRange.Font.Name = "Segoe UI"
    $bar.TextFrame.MarginLeft = 20
    $bar.TextFrame.MarginTop = 10
}

function Add-Body($slide, $text, [int]$fs=14, [float]$top=72, [float]$left=$M, [float]$w=0, [float]$h=0) {
    if ($w -eq 0) { $w = $SW - 2*$M }
    if ($h -eq 0) { $h = $SH - $top - 20 }
    $tb = $slide.Shapes.AddTextbox(1, $left, $top, $w, $h)
    $tb.TextFrame.WordWrap = -1
    $tb.TextFrame.TextRange.Text = $text
    $tb.TextFrame.TextRange.Font.Size = $fs
    $tb.TextFrame.TextRange.Font.Name = "Segoe UI"
    $tb.TextFrame.TextRange.Font.Color.RGB = $cDark
    return $tb
}

function Add-Code($slide, $text, [float]$top=72, [float]$left=$M, [float]$w=0, [float]$h=0) {
    if ($w -eq 0) { $w = $SW - 2*$M }
    if ($h -eq 0) { $h = $SH - $top - 20 }
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
    $s = $slide.Shapes.AddShape(5, $l, $t, $w, $h)  # rounded rect
    $s.Fill.ForeColor.RGB = $fill
    $s.Line.Visible = 0
    $s.TextFrame.TextRange.Text = $text
    $s.TextFrame.TextRange.Font.Size = $fs
    $s.TextFrame.TextRange.Font.Bold = -1
    $s.TextFrame.TextRange.Font.Color.RGB = $cWhite
    $s.TextFrame.TextRange.Font.Name = "Segoe UI"
    try { $s.TextFrame.TextRange.ParagraphFormat.Alignment = 2 } catch {} # center
    return $s
}

function Add-Label($slide, $text, [float]$l, [float]$t, [float]$w, [float]$h=25, [int]$fs=11) {
    $tb = $slide.Shapes.AddTextbox(1, $l, $t, $w, $h)
    $tb.TextFrame.TextRange.Text = $text
    $tb.TextFrame.TextRange.Font.Size = $fs
    $tb.TextFrame.TextRange.Font.Name = "Segoe UI"
    $tb.TextFrame.TextRange.Font.Color.RGB = $cGray
}

function Add-Arrow($slide, [float]$l, [float]$t, [float]$w=40, [float]$h=20) {
    $a = $slide.Shapes.AddShape(13, $l, $t, $w, $h) # right arrow
    $a.Fill.ForeColor.RGB = $cBlue
    $a.Line.Visible = 0
}

$n = 0
function Log($msg) { $script:n++; Write-Host "  [$script:n] $msg" -ForegroundColor Gray }

# =====================================================================
# SLIDE 1: PORTADA
# =====================================================================
$s = New-Slide
$bar = $s.Shapes.AddShape(1, 0, 0, $SW, $SH)
$bar.Fill.ForeColor.RGB = $cBlue
$bar.Line.Visible = 0
$tb = $s.Shapes.AddTextbox(1, 80, 120, $SW-160, 80)
$tb.TextFrame.TextRange.Text = "SummaCham - PanelAMCHAM"
$tb.TextFrame.TextRange.Font.Size = 44
$tb.TextFrame.TextRange.Font.Bold = -1
$tb.TextFrame.TextRange.Font.Color.RGB = $cWhite
$tb.TextFrame.TextRange.Font.Name = "Segoe UI"

$tb2 = $s.Shapes.AddTextbox(1, 80, 210, $SW-160, 50)
$tb2.TextFrame.TextRange.Text = "APIs, Queries, Gestor de Plantillas y Graficas"
$tb2.TextFrame.TextRange.Font.Size = 26
$tb2.TextFrame.TextRange.Font.Color.RGB = $cWhite
$tb2.TextFrame.TextRange.Font.Name = "Segoe UI"

$tb3 = $s.Shapes.AddTextbox(1, 80, 280, $SW-160, 40)
$tb3.TextFrame.TextRange.Text = "Explicacion tecnica paso a paso | Version 4.1.0 | Febrero 2026"
$tb3.TextFrame.TextRange.Font.Size = 16
$tb3.TextFrame.TextRange.Font.Color.RGB = (C 200 220 255)
$tb3.TextFrame.TextRange.Font.Name = "Segoe UI"

# linea decorativa
$line = $s.Shapes.AddShape(1, 80, 270, 300, 3)
$line.Fill.ForeColor.RGB = $cAccent
$line.Line.Visible = 0

Log "Portada"

# =====================================================================
# SLIDE 2: QUE ES UNA API
# =====================================================================
$s = New-Slide
Add-Title $s "Que es una API y como funciona en SummaCham"

Add-Body $s @"
Una API (Application Programming Interface) es el PUENTE entre
lo que el usuario ve (frontend) y donde estan los datos (backend).

Piensa en un restaurante:
"@ -fs 15 -top 72 -h 70

# Diagrama restaurante
Add-Box $s "USUARIO`n(Cliente)" 60 155 160 55 $cNavy 13
Add-Arrow $s 228 170 40 20
Add-Box $s "API`n(Mesero)" 276 155 160 55 $cOrange 13
Add-Arrow $s 444 170 40 20
Add-Box $s "SERVIDOR`n(Cocina)" 492 155 160 55 $cAccent 13
Add-Arrow $s 660 170 40 20
Add-Box $s "DATOS`n(Despensa)" 708 155 160 55 $cSlate 13

Add-Body $s @"
EN SUMMACHAM:

1. El usuario hace click en "Ver Resumen" en el navegador
2. El frontend (HTML/JS) envia un pedido HTTP al servidor:
      GET http://localhost:3005/api/reportes/resumen
3. El servidor Express recibe el pedido en la ruta /api/reportes
4. El backend consulta SQLite (layout) y Firebird (saldos)
5. El servidor responde con datos JSON al frontend
6. El frontend muestra los datos en tablas y graficas

PROTOCOLO: HTTP (peticiones y respuestas en formato JSON)
PUERTO: 3005 (configurable)
AUTENTICACION: Cookie de sesion + JWT Token en cada peticion
"@ -fs 13 -top 225

Log "Que es una API"

# =====================================================================
# SLIDE 3: COMO SE COMUNICAN
# =====================================================================
$s = New-Slide
Add-Title $s "Como se comunica el Frontend con el Backend"

Add-Body $s "Cada vez que el frontend necesita datos, hace una peticion fetch():" -fs 14 -top 72 -h 25

Add-Code $s @"
// Archivo: vistas/js/sesion.js
// El frontend prepara los HEADERS (cabeceras) de autenticacion:

const headers = {
  'Authorization': 'Bearer eyJhbGci...',   // Token JWT del usuario
  'X-Empresa-Activa': 'empresa1',          // Empresa seleccionada
  'Content-Type': 'application/json'       // Formato de datos
};

// Ejemplo: Pedir el reporte RESUMEN
const respuesta = await fetch('http://localhost:3005/api/reportes/resumen', {
  method: 'GET',          // Tipo de peticion (GET = leer, POST = enviar)
  headers: headers,       // Cabeceras con autenticacion
  credentials: 'include'  // Incluir cookies de sesion
});

// El servidor responde con JSON:
const datos = await respuesta.json();
// datos = { layout: [...], cuentas: [...], operaciones: [...] }
"@ -top 100 -h 220

Add-Body $s @"
ARCHIVOS CLAVE:
  vistas/js/sesion.js       Maneja la sesion, tokens y headers
  src/middleware/auth.js     Verifica que el token sea valido
  src/server.js              Registra todas las rutas /api/*
"@ -fs 12 -top 335

Log "Comunicacion Frontend-Backend"

# =====================================================================
# SLIDE 4: MAPA DE APIS
# =====================================================================
$s = New-Slide
Add-Title $s "Mapa completo de APIs (/api/*)"

$col1x = 45; $col2x = 330; $col3x = 615
$bw = 270; $bh = 32; $gap = 36

# Columna 1
Add-Box $s "/api/auth" $col1x 72 $bw $bh $cNavy 11
Add-Label $s "Login, logout, refresh token" $col1x ([float](72+$bh+2)) $bw 20 10

Add-Box $s "/api/usuarios" $col1x 128 $bw $bh $cNavy 11
Add-Label $s "CRUD usuarios + permisos" $col1x ([float](128+$bh+2)) $bw 20 10

Add-Box $s "/api/empresas" $col1x 184 $bw $bh $cNavy 11
Add-Label $s "Lista empresas, test conexion" $col1x ([float](184+$bh+2)) $bw 20 10

Add-Box $s "/api/reportes" $col1x 240 $bw $bh $cOrange 11
Add-Label $s "Genera reportes Summary/Resumen" $col1x ([float](240+$bh+2)) $bw 20 10

Add-Box $s "/api/presupuestos" $col1x 296 $bw $bh $cOrange 11
Add-Label $s "Datos de presupuesto por modulo" $col1x ([float](296+$bh+2)) $bw 20 10

# Columna 2
Add-Box $s "/api/layouts-config" $col2x 72 $bw $bh $cAccent 11
Add-Label $s "Gestor de Plantillas (CRUD)" $col2x ([float](72+$bh+2)) $bw 20 10

Add-Box $s "/api/borradores" $col2x 128 $bw $bh $cAccent 11
Add-Label $s "Guardado automatico, envio, aprobar" $col2x ([float](128+$bh+2)) $bw 20 10

Add-Box $s "/api/saldos" $col2x 184 $bw $bh $cAccent 11
Add-Label $s "Consulta saldos Firebird" $col2x ([float](184+$bh+2)) $bw 20 10

Add-Box $s "/api/insercion" $col2x 240 $bw $bh $cAccent 11
Add-Label $s "Agregar cuentas/secciones/ops" $col2x ([float](240+$bh+2)) $bw 20 10

Add-Box $s "/api/planeacion" $col2x 296 $bw $bh $cAccent 11
Add-Label $s "Datos por cuenta para planear" $col2x ([float](296+$bh+2)) $bw 20 10

# Columna 3
Add-Box $s "/api/graficas-config" $col3x 72 $bw $bh $cSlate 11
Add-Label $s "Config de graficas (Chart.js)" $col3x ([float](72+$bh+2)) $bw 20 10

Add-Box $s "/api/backups" $col3x 128 $bw $bh $cSlate 11
Add-Label $s "Crear/listar/restaurar backups" $col3x ([float](128+$bh+2)) $bw 20 10

Add-Box $s "/api/perfil" $col3x 184 $bw $bh $cSlate 11
Add-Label $s "Info usuario, cambiar password" $col3x ([float](184+$bh+2)) $bw 20 10

Add-Box $s "/api/notificaciones" $col3x 240 $bw $bh $cSlate 11
Add-Label $s "Alertas para usuarios" $col3x ([float](240+$bh+2)) $bw 20 10

Add-Box $s "/api/firebird-config" $col3x 296 $bw $bh $cSlate 11
Add-Label $s "Configurar conexion Firebird" $col3x ([float](296+$bh+2)) $bw 20 10

# Leyenda
Add-Body $s "Todos los endpoints estan en src/routes/*.js y se registran en src/server.js" -fs 11 -top 360

# Archivos footer
Add-Body $s @"
ARCHIVOS:  src/routes/auth.js | usuarios.js | reportes.js | layoutRoutes.js | borradores.js
           graficas-config.js | backups.js | perfil.js | insercion.js | saldos.js
"@ -fs 10 -top 385

Log "Mapa de APIs"

# =====================================================================
# SLIDE 5: EJEMPLO COMPLETO DE UNA PETICION
# =====================================================================
$s = New-Slide
Add-Title $s "Ejemplo: Que pasa cuando abres RESUMEN"

# Paso a paso con cajas
$y = 75
Add-Box $s "1" 45 $y 30 30 $cBlue 14
Add-Body $s "Usuario abre RESUMEN.html en el navegador" -fs 13 -top $y -left 85 -w 780 -h 25
$y += 38

Add-Box $s "2" 45 $y 30 30 $cBlue 14
Add-Body $s "resumen-view.js llama:  fetch('/api/reportes/resumen?empresaId=empresa1&anio=2025&mes=6')" -fs 12 -top $y -left 85 -w 780 -h 25
$y += 38

Add-Box $s "3" 45 $y 30 30 $cBlue 14
Add-Body $s "src/server.js dirige la peticion a src/routes/reportes.js" -fs 13 -top $y -left 85 -w 780 -h 25
$y += 38

Add-Box $s "4" 45 $y 30 30 $cOrange 14
Add-Body $s "middleware/auth.js verifica cookie/token -> carga permisos del usuario" -fs 13 -top $y -left 85 -w 780 -h 25
$y += 38

Add-Box $s "5" 45 $y 30 30 $cAccent 14
Add-Body $s "reportes.js llama a planeacionReportesEngine.construirReporteResumen()" -fs 13 -top $y -left 85 -w 780 -h 25
$y += 38

Add-Box $s "6" 45 $y 30 30 $cAccent 14
Add-Body $s "Engine carga layout de SQLite (cuentas + operaciones) para empresa1/RESUMEN/2025" -fs 12 -top $y -left 85 -w 780 -h 25
$y += 38

Add-Box $s "7" 45 $y 30 30 $cAccent 14
Add-Body $s "Engine consulta Firebird: SELECT saldos, presupuestos de SALDOS25, PRESUP25" -fs 12 -top $y -left 85 -w 780 -h 25
$y += 38

Add-Box $s "8" 45 $y 30 30 $cAccent 14
Add-Body $s "Engine calcula totales por seccion, operaciones consolidadas, acumulados" -fs 12 -top $y -left 85 -w 780 -h 25
$y += 38

Add-Box $s "9" 45 $y 30 30 $cSlate 14
Add-Body $s "Servidor responde JSON con la tabla completa: cuentas + valores + totales" -fs 13 -top $y -left 85 -w 780 -h 25
$y += 38

Add-Box $s "10" 42 $y 35 30 $cSlate 12
Add-Body $s "resumen-view.js renderiza la tabla HTML con los datos recibidos" -fs 13 -top $y -left 85 -w 780 -h 25

Log "Ejemplo peticion completa"

# =====================================================================
# SLIDE 6: DE DONDE SALE EL REAL
# =====================================================================
$s = New-Slide
Add-Title $s "Como se calcula el REAL (saldo contable actual)"

Add-Body $s "El REAL viene de la base de datos Firebird (Aspel COI):" -fs 14 -top 72 -h 22

Add-Code $s @"
-- Archivo: src/services/planeacionCuentasService.js
-- Tablas de Firebird por anio: CUENTAS25, SALDOS25 (para 2025)

SELECT c.NUM_CTA, c.NOMBRE,
       COALESCE(s.CARGO06, 0) AS cargo_mes,    -- Cargos de Junio
       COALESCE(s.ABONO06, 0) AS abono_mes     -- Abonos de Junio
FROM CUENTAS25 c
LEFT JOIN SALDOS25 s ON s.NUM_CTA = c.NUM_CTA
WHERE c.STATUS = 'A'
  AND c.NUM_CTA IN ('4100', '4200', '5100')    -- Cuentas del layout

-- REGLA DE CALCULO (depende del tipo de cuenta):
-- Cuenta ACREEDORA (ingresos 2xxx-4xxx): Real = Abonos - Cargos
-- Cuenta DEUDORA   (gastos 5xxx-9xxx):   Real = Cargos - Abonos

-- Ejemplo cuenta 4100 (ingreso, acreedora):
--   cargo06 = 15,000   abono06 = 150,000
--   REAL MES = 150,000 - 15,000 = 135,000
"@ -top 100 -h 190

Add-Body $s @"
QUE SIGNIFICA CADA VALOR:
  CARGO = Dinero que ENTRA a la cuenta (debito)
  ABONO = Dinero que SALE de la cuenta (credito)
  REAL  = El movimiento NETO del mes (segun naturaleza de la cuenta)

ARCHIVO CLAVE: src/services/planeacionCuentasService.js (lineas 197-252)
"@ -fs 13 -top 310

Log "Calculo del Real"

# =====================================================================
# SLIDE 7: DE DONDE SALE EL PRESUPUESTO
# =====================================================================
$s = New-Slide
Add-Title $s "Como se calcula el PRESUPUESTO"

Add-Body $s "El Presupuesto viene de la tabla PRESUP en Firebird:" -fs 14 -top 72 -h 22

Add-Code $s @"
-- Archivo: src/services/planeacionCuentasService.js
-- Tabla: PRESUPyy (ej: PRESUP25 para 2025)

SELECT pr.NUM_CTA,
       COALESCE(pr.PRESUP06, 0) AS presup_mes  -- Presupuesto de Junio
FROM PRESUP25 pr
WHERE pr.NUM_CTA IN ('4100', '4200', '5100')

-- PRESUP tiene 12 columnas: PRESUP01, PRESUP02, ... PRESUP12
-- Cada columna es el presupuesto de ese mes

-- Ejemplo cuenta 4100 en Junio:
--   PRESUP06 = 140,000
--   Presupuesto del mes = 140,000 (se toma directo, sin calculo)
"@ -top 100 -h 160

Add-Body $s @"
DIFERENCIA CON EL REAL:
  El REAL se calcula (abonos - cargos o cargos - abonos)
  El PRESUPUESTO se lee directamente de la tabla PRESUP (sin calculo)

PARA QUE SIRVE:
  Se compara Real vs Presupuesto para ver si se esta cumpliendo el plan
  Variacion = (Real - Presupuesto) / Presupuesto * 100

ARCHIVO CLAVE: src/services/planeacionCuentasService.js (linea 173)
"@ -fs 13 -top 280

Log "Calculo del Presupuesto"

# =====================================================================
# SLIDE 8: ACUMULADOS
# =====================================================================
$s = New-Slide
Add-Title $s "Como se calculan los ACUMULADOS (YTD)"

Add-Body $s "El acumulado es la SUMA desde Enero hasta el mes seleccionado:" -fs 14 -top 72 -h 22

Add-Code $s @"
-- Si el usuario selecciona MES = 6 (Junio):

-- REAL ACUMULADO (actualYTD):
Real_Acum = (Ene + Feb + Mar + Abr + May + Jun)
          = CARGO01-ABONO01 + CARGO02-ABONO02 + ... + CARGO06-ABONO06
          -- (invertido si es cuenta acreedora)

-- PRESUPUESTO ACUMULADO (planYTD):
Presup_Acum = PRESUP01 + PRESUP02 + PRESUP03 + PRESUP04 + PRESUP05 + PRESUP06

-- REAL ACUMULADO ANO ANTERIOR (prevYTD):
-- Misma logica pero usando tablas SALDOS24 (anio anterior)
Real_Acum_AA = suma de SALDOS del ano anterior, meses 1 a 6
"@ -top 100 -h 160

# Tabla visual de ejemplo
Add-Body $s @"
EJEMPLO - Cuenta 4100 (Membership) - Mes seleccionado: Junio 2025

  Columna            | Valor        | Que significa
  -------------------|------------- |-----------------------------------
  Real Mes           |   135,000    | Movimiento neto de Junio 2025
  Presupuesto Mes    |   140,000    | Lo que se planeo para Junio 2025
  Real Acumulado     |   810,000    | Suma real de Ene a Jun 2025
  Ppto Acumulado     |   840,000    | Suma planeada de Ene a Jun 2025
  Real Acum AA       |   780,000    | Suma real de Ene a Jun 2024
  Var vs Plan        |    -3.6%     | (135K - 140K) / 140K = -3.6%

ARCHIVOS: planeacionCuentasService.js (query) -> planeacionReportesEngine.js (calculo)
"@ -fs 12 -top 275

Log "Acumulados"

# =====================================================================
# SLIDE 9: FLUJO COMPLETO DE DATOS
# =====================================================================
$s = New-Slide
Add-Title $s "Flujo completo: De Firebird a la pantalla"

# Diagrama de flujo vertical con cajas
$cx = ($SW - 300) / 2
Add-Box $s "FIREBIRD (Aspel COI)`nSALDOS + PRESUP + CUENTAS" $cx 75 300 45 $cSlate 12
Add-Label $s "Tablas por anio: SALDOS25, PRESUP25, CUENTAS25" 60 125 400 18 10

$a1 = $s.Shapes.AddShape(33, $cx+130, 125, 20, 25) # down arrow (type 33 is actually right, use a line)
$a1.Fill.ForeColor.RGB = $cBlue
$a1.Rotation = 90

Add-Box $s "planeacionCuentasService.js`nobtenerDatosPlaneacionResumen()" $cx 158 300 40 $cOrange 11
Add-Label $s "Ejecuta query SQL, calcula naturaleza, mapea a campos estandar" 60 202 500 18 10

$a2 = $s.Shapes.AddShape(33, $cx+130, 202, 20, 25)
$a2.Fill.ForeColor.RGB = $cBlue
$a2.Rotation = 90

Add-Box $s "planeacionReportesEngine.js`nconstruirReporteResumen()" $cx 235 300 40 $cOrange 11
Add-Label $s "Agrupa por secciones, calcula totales, aplica formulas de operaciones" 60 279 500 18 10

$a3 = $s.Shapes.AddShape(33, $cx+130, 279, 20, 25)
$a3.Fill.ForeColor.RGB = $cBlue
$a3.Rotation = 90

Add-Box $s "src/routes/reportes.js`nGET /api/reportes/resumen" $cx 312 300 40 $cAccent 11
Add-Label $s "Responde JSON con el reporte completo al frontend" 60 356 500 18 10

$a4 = $s.Shapes.AddShape(33, $cx+130, 356, 20, 25)
$a4.Fill.ForeColor.RGB = $cBlue
$a4.Rotation = 90

Add-Box $s "resumen-view.js`nRenderiza tabla HTML" $cx 389 300 40 $cNavy 11
Add-Label $s "Muestra: Real, Ppto, Var%, Real Acum, Ppto Acum, Real AA" 60 433 500 18 10

# Datos que viajan
Add-Body $s @"
CADA FILA LLEVA 6 VALORES:
  actualMonth (Real)
  planMonth (Ppto)
  prevMonth (Real AA)
  actualYTD (Real Acum)
  planYTD (Ppto Acum)
  prevYTD (Real Acum AA)
"@ -fs 11 -top 325 -left 610 -w 260

Log "Flujo de datos"

# =====================================================================
# SLIDE 10: GESTOR DE PLANTILLAS - QUE ES
# =====================================================================
$s = New-Slide
Add-Title $s "Gestor de Plantillas - Que es y para que sirve"

Add-Body $s @"
El Gestor de Plantillas es la herramienta para DEFINIR la estructura
de los reportes financieros. Sin plantilla, no hay reporte.
"@ -fs 14 -top 72 -h 38

# 3 componentes
Add-Box $s "CUENTAS" 55 120 260 40 $cNavy 14
Add-Body $s @"
Filas individuales del reporte
Ej: '4100' - Membership Renewals
Se agrupan por seccion
Tabla: layout_cuentas
"@ -fs 11 -top 165 -left 55 -w 260 -h 80

Add-Box $s "OPERACIONES" 335 120 260 40 $cOrange 14
Add-Body $s @"
Filas de CALCULO (totales)
Ej: Total Income = suma secciones
Pueden ser recursivas
Tabla: layout_operaciones
"@ -fs 11 -top 165 -left 335 -w 260 -h 80

Add-Box $s "SECCIONES" 615 120 260 40 $cAccent 14
Add-Body $s @"
Agrupaciones logicas
Ej: Income (CDMX), Expense (GDL)
Definen la jerarquia visual
Tabla: layout_secciones
"@ -fs 11 -top 165 -left 615 -w 260 -h 80

Add-Body $s @"
COMO SE USA:
  1. Abrir plantillas.html -> Seleccionar empresa + modulo + anio + capitulo
  2. El sistema carga el layout existente (o se crea uno nuevo)
  3. Se agregan/editan cuentas contables (numero + nombre + seccion)
  4. Se configuran operaciones (formulas de totales)
  5. Se ordena con drag-and-drop (orden_presentacion)
  6. Se guarda -> queda listo para generar reportes

APIS QUE USA:
  GET  /api/layouts-config/:modulo/:anio/:capitulo     Cargar layout
  POST /api/layouts-config/:modulo/:anio/:capitulo     Guardar layout
  POST /api/layouts-config/:modulo/copiar              Copiar de otro anio

ARCHIVOS CLAVE:
  Frontend: vistas/js/plantillas.js (~13,900 lineas)
  Backend:  src/routes/layoutRoutes.js + src/services/layoutService.js
"@ -fs 12 -top 260

Log "Gestor de Plantillas"

# =====================================================================
# SLIDE 11: GESTOR DE PLANTILLAS - APIS
# =====================================================================
$s = New-Slide
Add-Title $s "Gestor de Plantillas - APIs disponibles"

Add-Code $s @"
BASE: /api/layouts-config

-- CARGAR Y GUARDAR --
GET  /:modulo/:anio/:capitulo          Cargar layout completo (cuentas + ops)
POST /:modulo/:anio/:capitulo          Guardar layout completo
POST /:modulo/:anio/:capitulo/cuentas  Guardar solo cuentas
POST /:modulo/:anio/operaciones        Guardar solo operaciones

-- CONSULTAS --
GET  /:modulo/anios                    Anios disponibles para un modulo
GET  /:modulo/:anio/capitulos          Capitulos disponibles
GET  /:modulo/:anio/estadisticas       Cuantas cuentas/ops tiene
GET  /:modulo/:anio/existe             Verificar si existe
GET  /:modulo/:anio/completo           Layout completo (formato legacy)

-- EDICION INDIVIDUAL --
PUT    /:modulo/:anio/:capitulo/cuenta/:cuenta     Editar UNA cuenta
DELETE /:modulo/:anio/:capitulo/cuenta/:cuenta     Eliminar UNA cuenta
PUT    /:modulo/:anio/operacion/:clase             Editar UNA operacion
DELETE /:modulo/:anio/operacion/:clase             Eliminar UNA operacion

-- ADMINISTRACION --
POST   /:modulo/copiar               Copiar layout de un anio a otro
POST   /:modulo/:anio/demo           Crear plantilla de ejemplo
DELETE /:modulo/:anio                 Eliminar layout completo
POST   /:modulo/:anio/reseed         Recargar operaciones desde JSON
POST   /:modulo/:anio/:capitulo/reordenar  Cambiar orden de presentacion

-- PERMISOS Y AUDITORIA --
GET    /permisos/capitulos            Ver permisos por capitulo (admin)
POST   /permisos/capitulos            Asignar permisos por capitulo
GET    /:modulo/:anio/:capitulo/bitacora  Ver registro de cambios
"@ -top 72 -h ($SH - 90)

Log "Plantillas APIs"

# =====================================================================
# SLIDE 12: SISTEMA DE GRAFICAS
# =====================================================================
$s = New-Slide
Add-Title $s "Sistema de Graficas - Como funciona"

Add-Body $s @"
Las graficas toman los MISMOS datos del reporte RESUMEN y los
visualizan con Chart.js (libreria de graficas interactivas).
"@ -fs 14 -top 72 -h 35

# Tipos de graficas
Add-Box $s "BARRA" 55 118 130 35 $cNavy 13
Add-Box $s "LINEA" 195 118 130 35 $cOrange 13
Add-Box $s "PIE" 335 118 130 35 $cAccent 13
Add-Box $s "DONA" 475 118 130 35 $cSlate 13
Add-Box $s "RADAR" 615 118 130 35 $cRed 13

Add-Body $s @"
GRAFICAS DISPONIBLES:

  1. Resultado Operativo: Real Acum vs Ppto Acum vs Real AA por capitulo
  2. Resumen Neto: Ganancia/perdida neta por capitulo
  3. Consolidados: Ingreso total vs Gasto total
  4. Ingreso por Capitulo: Tendencia mensual por ciudad
  5. Ingreso Nacional: Por area (Membresia, Eventos, etc.)
  6. Graficas personalizadas: El usuario elige que datos graficar

CONFIGURACION (se guarda en SQLite - tabla graficas_config):
  - Que series mostrar (Real, Ppto, AA)
  - Colores de cada serie
  - Tipo de grafica (barra, linea, pie, dona)
  - Apilado o separado

ASISTENTE DE CREACION (Chart Wizard - 4 pasos):
  Paso 1: Seleccionar periodo (anio + mes)
  Paso 2: Seleccionar fuente de datos
  Paso 3: Elegir tipo de grafica
  Paso 4: Confirmar y generar

ARCHIVOS:
  Frontend: Graficas-Mejoradas.html + js/graficas-resumen.js
            js/graficas-config.js + js/chart-wizard.js
  Backend:  src/routes/graficas-config.js
  API:      GET/POST /api/graficas-config (solo admin puede modificar)
"@ -fs 12 -top 165

Log "Sistema de Graficas"

# =====================================================================
# SLIDE 13: GRAFICAS - DATOS
# =====================================================================
$s = New-Slide
Add-Title $s "Graficas - De donde salen los datos"

Add-Body $s @"
Las graficas leen datos del reporte RESUMEN ya calculado.
Los 3 valores principales que se grafican son:
"@ -fs 13 -top 72 -h 35

# 3 series con colores
Add-Box $s "Real Acumulado (actualYTD)" 55 115 270 35 $cNavy 12
Add-Label $s "Color: Azul oscuro #0d47a1" 55 153 270 18 10

Add-Box $s "Ppto Acumulado (planYTD)" 340 115 270 35 (C 96 165 250) 12
Add-Label $s "Color: Azul claro #60a5fa" 340 153 270 18 10

Add-Box $s "Real Acum AA (prevYTD)" 625 115 260 35 (C 148 163 184) 12
Add-Label $s "Color: Gris #94a3b8" 625 153 260 18 10

Add-Code $s @"
// Archivo: vistas/js/graficas-config.js

const CONFIG_DEFAULT = {
  series: [
    { key: "actualYTD", label: "Real acumulado",    color: "#0d47a1", enabled: true },
    { key: "planYTD",   label: "Ppto. acumulado",   color: "#60a5fa", enabled: true },
    { key: "prevYTD",   label: "Real acum AA",      color: "#94a3b8", enabled: true }
  ],
  chart: { type: "bar", stacked: false },
  legend: { show: true, position: "bottom" }
};

// graficas-resumen.js busca en el reporte las filas de operaciones:
// "CONSOLIDATED INCOME", "CONSOLIDATED EXPENSE", "NET INCOME", etc.
// y extrae actualYTD, planYTD, prevYTD para graficarlos como barras
"@ -top 180 -h 175

Add-Body $s @"
EXPORTACION: Las graficas se pueden exportar a Excel (ExcelJS), PDF (jsPDF) e imagen
"@ -fs 12 -top 370

Log "Graficas datos"

# =====================================================================
# SLIDE 14: RESUMEN VISUAL
# =====================================================================
$s = New-Slide
Add-Title $s "Resumen: Todo conectado"

# Gran diagrama
Add-Box $s "USUARIO" 55 80 120 40 $cNavy 13
Add-Arrow $s 180 90

Add-Box $s "plantillas.html`n(Define estructura)" 230 75 180 50 $cOrange 11
Add-Arrow $s 415 90

Add-Box $s "SQLite`nlayout_cuentas`nlayout_operaciones" 460 70 170 60 $cSlate 10
Add-Label $s "Define QUE cuentas y QUE formulas" 460 135 170 20 9

# Segunda fila
Add-Box $s "USUARIO" 55 175 120 40 $cNavy 13
Add-Arrow $s 180 185

Add-Box $s "RESUMEN.html`n(Ve reporte)" 230 170 180 50 $cAccent 11
Add-Arrow $s 415 185

Add-Box $s "reportes.js`nEngine" 460 170 170 50 $cOrange 11
Add-Arrow $s 635 185

Add-Box $s "Firebird`nSALDOS + PRESUP" 680 170 180 50 $cSlate 11
Add-Label $s "Datos REALES del sistema contable" 680 225 180 20 9

# Tercera fila
Add-Box $s "USUARIO" 55 270 120 40 $cNavy 13
Add-Arrow $s 180 280

Add-Box $s "Graficas.html`n(Ve graficas)" 230 265 180 50 (C 96 165 250) 11
Add-Arrow $s 415 280

Add-Box $s "Mismos datos`ndel reporte" 460 265 170 50 $cOrange 11

Add-Body $s @"
FLUJO SIMPLIFICADO:
  1. El admin define la ESTRUCTURA en el Gestor de Plantillas (que cuentas, que formulas)
  2. El usuario abre RESUMEN y el sistema COMBINA la estructura con los datos de Firebird
  3. Las Graficas toman los mismos datos calculados y los VISUALIZAN

ARCHIVOS PRINCIPALES:
  Plantillas:  plantillas.js + layoutRoutes.js + layoutService.js
  Reportes:    resumen-view.js + reportes.js + planeacionReportesEngine.js
  Graficas:    graficas-resumen.js + graficas-config.js + chart-wizard.js
  Datos:       planeacionCuentasService.js + firebirdService.js
  Seguridad:   sesion.js (frontend) + auth.js (backend)
"@ -fs 11 -top 330

Log "Resumen visual"

# =====================================================================
# GUARDAR
# =====================================================================
Write-Host "`nGuardando..." -ForegroundColor Yellow

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
    Write-Host "Presentacion creada: $n slides con diseno profesional" -ForegroundColor Green
} catch {
    Write-Host "Error al guardar: $_" -ForegroundColor Red
    exit 1
}
