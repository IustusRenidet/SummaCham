# PowerShell Script - Presentacion Tecnica Unificada de SummaCham
# Combina las 3 presentaciones anteriores en una sola, clara y facil de entender
# Febrero 2026

param(
    [string]$OutputPath = "$PSScriptRoot\..\PRESENTACION_TECNICA_SUMMACHAM_UNIFICADA.pptx"
)

Write-Host "Creando presentacion tecnica UNIFICADA de SummaCham..." -ForegroundColor Cyan

# Verificar PowerPoint
try {
    $powerpoint = New-Object -ComObject PowerPoint.Application
    $powerpoint.Visible = 1
    $presentation = $powerpoint.Presentations.Add()
    $presentation.PageSetup.SlideSize = 16  # 16:9
    Write-Host "PowerPoint iniciado correctamente" -ForegroundColor Green
} catch {
    Write-Host "Error al iniciar PowerPoint: $_" -ForegroundColor Red
    exit 1
}

# === FUNCIONES HELPER ===
function Add-Slide {
    param([Parameter(Mandatory)]$Presentation, [int]$LayoutType = 11)
    return $Presentation.Slides.Add($Presentation.Slides.Count + 1, $LayoutType)
}

function Add-TextBox {
    param($Slide, [float]$Left, [float]$Top, [float]$Width, [float]$Height,
          [string]$Text, [int]$FontSize = 18, [bool]$Bold = $false,
          [string]$FontName = "Calibri", $Color = $null)
    $tb = $Slide.Shapes.AddTextbox(1, $Left, $Top, $Width, $Height)
    $tb.TextFrame.TextRange.Text = $Text
    $tb.TextFrame.TextRange.Font.Size = $FontSize
    $tb.TextFrame.TextRange.Font.Bold = $Bold
    $tb.TextFrame.TextRange.Font.Name = $FontName
    $tb.TextFrame.WordWrap = -1
    if ($Color) { $tb.TextFrame.TextRange.Font.Color.RGB = $Color }
    return $tb
}

function Add-Shape {
    param($Slide, [int]$ShapeType, [float]$Left, [float]$Top, [float]$Width,
          [float]$Height, [string]$Text = "", [int]$FillColor = 0, [int]$FontSize = 16,
          [bool]$Bold = $false, $FontColor = $null)
    $shape = $Slide.Shapes.AddShape($ShapeType, $Left, $Top, $Width, $Height)
    if ($FillColor -ne 0) { $shape.Fill.ForeColor.RGB = $FillColor }
    if ($Text -ne "") {
        $shape.TextFrame.TextRange.Text = $Text
        $shape.TextFrame.TextRange.Font.Size = $FontSize
        $shape.TextFrame.TextRange.Font.Bold = $Bold
        $shape.TextFrame.TextRange.Font.Name = "Calibri"
        if ($FontColor) { $shape.TextFrame.TextRange.Font.Color.RGB = $FontColor }
    }
    return $shape
}

function Add-SectionTitle {
    param($Slide, [string]$Title, [string]$Subtitle = "")
    $slide = $Slide
    $slide.Shapes[1].TextFrame.TextRange.Text = $Title
    $slide.Shapes[1].TextFrame.TextRange.Font.Size = 38
    $slide.Shapes[1].TextFrame.TextRange.Font.Bold = $true
    $slide.Shapes[1].TextFrame.TextRange.Font.Color.RGB = $ColorPrimary
    if ($Subtitle) {
        Add-TextBox -Slide $slide -Left 80 -Top 100 -Width 860 -Height 40 -Text $Subtitle -FontSize 20 -Color $ColorSecondary
    }
}

# Colores
$ColorPrimary = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb(41, 128, 185))
$ColorSecondary = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb(52, 73, 94))
$ColorAccent = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb(46, 204, 113))
$ColorWarning = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb(230, 126, 34))
$ColorDanger = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb(231, 76, 60))
$ColorLight = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb(236, 240, 241))
$ColorWhite = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb(255, 255, 255))

Write-Host "Creando slides..." -ForegroundColor Yellow

# =====================================================================
# SLIDE 1: PORTADA
# =====================================================================
$s = Add-Slide -Presentation $presentation
$s.Shapes[1].TextFrame.TextRange.Text = "SummaCham - PanelAMCHAM"
$s.Shapes[1].TextFrame.TextRange.Font.Size = 54
$s.Shapes[1].TextFrame.TextRange.Font.Bold = $true
$s.Shapes[1].TextFrame.TextRange.Font.Color.RGB = $ColorPrimary
Add-TextBox -Slide $s -Left 100 -Top 250 -Width 800 -Height 60 -Text "Documentacion Tecnica Completa y Unificada" -FontSize 32 -Bold $true
Add-TextBox -Slide $s -Left 100 -Top 330 -Width 800 -Height 40 -Text "Sistema de Gestion Financiera Empresarial" -FontSize 24
Add-TextBox -Slide $s -Left 100 -Top 390 -Width 800 -Height 30 -Text "Version 4.1.0 | Febrero 2026" -FontSize 20
Add-TextBox -Slide $s -Left 100 -Top 450 -Width 800 -Height 30 -Text "Desarrollado por: Iustus Renidet & J02V4N" -FontSize 16

Write-Host "  [1/30] Portada" -ForegroundColor Gray

# =====================================================================
# SLIDE 2: QUE ES SUMMACHAM?
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Que es SummaCham?"

$text = @"
SummaCham es una aplicacion de escritorio que ayuda a gestionar
los presupuestos financieros de una organizacion (AMCHAM).

EN PALABRAS SIMPLES:
  Es como un Excel inteligente que:
  - Se conecta al sistema contable (Aspel COI) para leer saldos reales
  - Permite a multiples usuarios trabajar al mismo tiempo
  - Tiene un sistema de aprobacion (cargar -> revisar -> aprobar)
  - Genera reportes consolidados automaticamente
  - Tiene graficas interactivas

USUARIOS TIPICOS:
  - Analistas: Cargan datos de presupuesto por modulo (RH, Finanzas, etc.)
  - Supervisores: Revisan que los datos esten correctos
  - Directores: Aprueban los presupuestos finales
  - Administradores: Configuran usuarios, permisos y conexiones

ACCESO:
  - Local: http://localhost:3005 (en la misma computadora)
  - Remoto: via tunel HTTPS (desde cualquier lugar)
"@

Add-TextBox -Slide $s -Left 60 -Top 130 -Width 900 -Height 410 -Text $text -FontSize 16

Write-Host "  [2/30] Que es SummaCham" -ForegroundColor Gray

# =====================================================================
# SLIDE 3: TABLA DE CONTENIDO
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Contenido de esta Presentacion"

$text = @"
PARTE 1 - ARQUITECTURA
   1. Tecnologias utilizadas (Frontend y Backend)
   2. Como esta organizado el proyecto (carpetas y archivos)
   3. Arquitectura general (como se comunican las partes)

PARTE 2 - SEGURIDAD
   4. Como funciona el Login (autenticacion)
   5. Cookies y Sesiones (como se mantiene la sesion activa)
   6. Rate Limiting (proteccion contra ataques)
   7. Sistema de Permisos (quien puede hacer que)

PARTE 3 - DATOS
   8. Base de Datos SQLite (donde se guarda todo localmente)
   9. Conexion con Firebird/Aspel COI (datos contables)
   10. Sistema de Layouts (plantillas de estructura contable)

PARTE 4 - LOGICA DE NEGOCIO
   11. Algoritmos de calculo (operaciones consolidadas)
   12. Modulos del sistema (RH, Finanzas, RESUMEN, etc.)
   13. Flujo de aprobacion de presupuestos

PARTE 5 - OPERACION
   14. Backups automaticos, Actualizaciones y Deployment
"@

Add-TextBox -Slide $s -Left 60 -Top 120 -Width 900 -Height 420 -Text $text -FontSize 15

Write-Host "  [3/30] Tabla de Contenido" -ForegroundColor Gray

# =====================================================================
# SLIDE 4: STACK TECNOLOGICO - FRONTEND
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Tecnologias: Frontend (lo que ve el usuario)"

# Cajas de tecnologias
Add-Shape -Slide $s -ShapeType 5 -Left 60 -Top 140 -Width 260 -Height 55 -Text "Electron 39.2.7" -FillColor $ColorPrimary -FontSize 18 -Bold $true -FontColor $ColorWhite
Add-TextBox -Slide $s -Left 60 -Top 200 -Width 260 -Height 70 -Text "Convierte la app web en una app de escritorio para Windows. Es como un navegador Chrome integrado." -FontSize 13

Add-Shape -Slide $s -ShapeType 5 -Left 370 -Top 140 -Width 260 -Height 55 -Text "Bootstrap 5" -FillColor $ColorAccent -FontSize 18 -Bold $true -FontColor $ColorWhite
Add-TextBox -Slide $s -Left 370 -Top 200 -Width 260 -Height 70 -Text "Framework CSS que hace que la interfaz se vea profesional y funcione bien en diferentes pantallas." -FontSize 13

Add-Shape -Slide $s -ShapeType 5 -Left 680 -Top 140 -Width 260 -Height 55 -Text "Chart.js 4.3" -FillColor $ColorWarning -FontSize 18 -Bold $true -FontColor $ColorWhite
Add-TextBox -Slide $s -Left 680 -Top 200 -Width 260 -Height 70 -Text "Libreria para crear graficas interactivas: barras, lineas, pie, dona, radar, etc." -FontSize 13

$text = @"
OTRAS LIBRERIAS FRONTEND:
  - HTML5 + CSS3 + JavaScript puro (sin frameworks como React/Angular)
  - Font Awesome 6.4 para iconos
  - DataTables 1.13 para tablas interactivas con busqueda y filtros
  - SweetAlert2 para notificaciones y dialogos bonitos
  - Moment.js para manejo de fechas
  - ExcelJS / XLSX para exportar a Excel desde el navegador
  - jsPDF para exportar a PDF
"@

Add-TextBox -Slide $s -Left 60 -Top 280 -Width 880 -Height 250 -Text $text -FontSize 15

Write-Host "  [4/30] Stack Frontend" -ForegroundColor Gray

# =====================================================================
# SLIDE 5: STACK TECNOLOGICO - BACKEND
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Tecnologias: Backend (lo que no ve el usuario)"

$text = @"
Node.js + Express.js (El servidor)
  Que hace: Recibe peticiones del navegador, procesa datos, responde
  Puerto: 3005 (http://localhost:3005)
  Es como: Un mesero que lleva pedidos entre el cliente y la cocina

Better-SQLite3 (Base de datos local)
  Que hace: Guarda usuarios, permisos, layouts, borradores, configuracion
  Archivo: datos/panel.sqlite
  Es como: Un archivero donde se guarda toda la info local

node-firebird (Conexion al sistema contable)
  Que hace: Lee saldos y cuentas del sistema Aspel COI (Firebird)
  Puerto: 3050
  Es como: Un traductor que habla con el sistema contable externo

bcryptjs + jsonwebtoken (Seguridad)
  Que hace: Encripta contrasenas y genera tokens de acceso
  bcrypt: Convierte "miPassword123" en un hash irreversible
  JWT: Genera un "pase" temporal que identifica al usuario

Joi (Validacion)
  Que hace: Verifica que los datos que manda el usuario sean correctos
  Ejemplo: "El usuario debe tener minimo 2 caracteres"

Helmet (Proteccion HTTP)
  Que hace: Agrega cabeceras de seguridad a todas las respuestas
"@

Add-TextBox -Slide $s -Left 60 -Top 120 -Width 900 -Height 420 -Text $text -FontSize 14

Write-Host "  [5/30] Stack Backend" -ForegroundColor Gray

# =====================================================================
# SLIDE 6: ESTRUCTURA DE DIRECTORIOS
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Organizacion del Proyecto"

$text = @"
SummaCham/
  main.js                  Punto de entrada de Electron (la app de escritorio)
  package.json             Configuracion y dependencias del proyecto
  .env                     Variables secretas (NO se sube a Git)

  src/                     CODIGO DEL BACKEND (servidor)
    server.js                Servidor Express (arranca todo)
    db/sqlite.js             Conexion y esquemas de SQLite
    middleware/auth.js       Verificacion de sesion en cada peticion
    routes/                  Endpoints de la API:
      auth.js                  Login, logout, refresh token
      usuarios.js              CRUD de usuarios
      presupuestos.js          Manejo de presupuestos
      reportes.js              Generacion de reportes
      layouts.js               Plantillas contables
    services/                Logica de negocio:
      firebirdService.js       Conexion con Aspel COI
      layoutService.js         Operaciones con layouts
      permisosService.js       Verificacion de permisos
      backupService.js         Backups automaticos

  vistas/                  FRONTEND (lo que ve el usuario)
    login.html, app.html, RESUMEN.html, plantillas.html, etc.
    js/                    JavaScript del frontend
    css/                   Estilos

  datos/                   DATOS PERSISTENTES
    panel.sqlite             Base de datos principal
    backups/                 Copias de seguridad
"@

Add-TextBox -Slide $s -Left 50 -Top 120 -Width 920 -Height 420 -Text $text -FontSize 12 -FontName "Consolas"

Write-Host "  [6/30] Estructura Directorios" -ForegroundColor Gray

# =====================================================================
# SLIDE 7: ARQUITECTURA GENERAL
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Arquitectura: Como se comunican las partes"

# Diagrama con shapes
Add-Shape -Slide $s -ShapeType 5 -Left 60 -Top 140 -Width 250 -Height 70 -Text "ELECTRON`nApp de Escritorio" -FillColor $ColorPrimary -FontSize 14 -Bold $true -FontColor $ColorWhite
Add-Shape -Slide $s -ShapeType 13 -Left 320 -Top 160 -Width 50 -Height 30 -FillColor $ColorSecondary  # flecha
Add-Shape -Slide $s -ShapeType 5 -Left 380 -Top 140 -Width 250 -Height 70 -Text "EXPRESS SERVER`nPuerto 3005" -FillColor $ColorSecondary -FontSize 14 -Bold $true -FontColor $ColorWhite
Add-Shape -Slide $s -ShapeType 13 -Left 640 -Top 145 -Width 40 -Height 25 -FillColor $ColorAccent
Add-Shape -Slide $s -ShapeType 5 -Left 690 -Top 130 -Width 250 -Height 35 -Text "SQLite (Local)" -FillColor $ColorAccent -FontSize 13 -Bold $true -FontColor $ColorWhite
Add-Shape -Slide $s -ShapeType 13 -Left 640 -Top 180 -Width 40 -Height 25 -FillColor $ColorWarning
Add-Shape -Slide $s -ShapeType 5 -Left 690 -Top 175 -Width 250 -Height 35 -Text "Firebird / Aspel COI" -FillColor $ColorWarning -FontSize 13 -Bold $true -FontColor $ColorWhite

$text = @"
COMO FUNCIONA (paso a paso):

1. Electron abre una ventana y carga http://localhost:3005
2. El servidor Express recibe las peticiones del navegador
3. Cada peticion pasa por middleware de seguridad:
   - Se verifica que el usuario tenga sesion activa
   - Se verifican sus permisos para esa accion
4. El servidor consulta los datos necesarios:
   - SQLite: usuarios, permisos, layouts, borradores
   - Firebird: saldos contables reales del sistema Aspel COI
5. El servidor responde con datos en formato JSON
6. El frontend muestra los datos en tablas, graficas, etc.

ACCESO MULTI-USUARIO:
  Varios usuarios pueden trabajar al mismo tiempo porque:
  - Cada uno tiene su propia sesion (cookie unica)
  - SQLite soporta acceso concurrente (modo WAL)
  - Los permisos se validan por cada peticion

ACCESO REMOTO:
  - Se puede acceder desde otras computadoras via tunel HTTPS
  - Ejemplo: https://panelamcham.iconetcloud.com.mx
  - Las cookies se configuran automaticamente segun el entorno
"@

Add-TextBox -Slide $s -Left 60 -Top 225 -Width 880 -Height 320 -Text $text -FontSize 14

Write-Host "  [7/30] Arquitectura General" -ForegroundColor Gray

# =====================================================================
# SLIDE 8: CAPAS DEL SISTEMA
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Arquitectura en Capas"

# Capas visuales
Add-Shape -Slide $s -ShapeType 5 -Left 120 -Top 130 -Width 760 -Height 50 -Text "CAPA 1: Presentacion (HTML + JS) - Lo que ve el usuario" -FillColor $ColorPrimary -FontSize 15 -Bold $true -FontColor $ColorWhite
Add-TextBox -Slide $s -Left 120 -Top 183 -Width 760 -Height 25 -Text "login.html, usuarios.html, RESUMEN.html, Graficas.html, plantillas.html..." -FontSize 12

Add-Shape -Slide $s -ShapeType 5 -Left 120 -Top 215 -Width 760 -Height 50 -Text "CAPA 2: Controladores (Routes) - Reciben peticiones" -FillColor $ColorSecondary -FontSize 15 -Bold $true -FontColor $ColorWhite
Add-TextBox -Slide $s -Left 120 -Top 268 -Width 760 -Height 25 -Text "auth.js, usuarios.js, presupuestos.js, reportes.js, layouts.js, insercion.js..." -FontSize 12

Add-Shape -Slide $s -ShapeType 5 -Left 120 -Top 300 -Width 760 -Height 50 -Text "CAPA 3: Middleware (Seguridad) - Filtro de acceso" -FillColor $ColorWarning -FontSize 15 -Bold $true -FontColor $ColorWhite
Add-TextBox -Slide $s -Left 120 -Top 353 -Width 760 -Height 25 -Text "requireAuth, permisos, rate limiting, CORS, helmet, validaciones Joi" -FontSize 12

Add-Shape -Slide $s -ShapeType 5 -Left 120 -Top 385 -Width 365 -Height 50 -Text "CAPA 4a: Servicios (Logica)" -FillColor $ColorAccent -FontSize 15 -Bold $true -FontColor $ColorWhite
Add-TextBox -Slide $s -Left 120 -Top 438 -Width 365 -Height 25 -Text "permisosService, layoutService, firebirdService" -FontSize 11

Add-Shape -Slide $s -ShapeType 5 -Left 515 -Top 385 -Width 365 -Height 50 -Text "CAPA 4b: Datos (Persistencia)" -FillColor $ColorDanger -FontSize 15 -Bold $true -FontColor $ColorWhite
Add-TextBox -Slide $s -Left 515 -Top 438 -Width 365 -Height 25 -Text "SQLite (local) + Firebird (externa)" -FontSize 11

$text = @"
Cada peticion baja por las capas: Presentacion -> Controlador -> Middleware -> Servicio -> Datos
Si la seguridad falla en cualquier capa, la peticion se rechaza inmediatamente (401 o 403)
"@

Add-TextBox -Slide $s -Left 60 -Top 475 -Width 900 -Height 50 -Text $text -FontSize 13 -Bold $true -Color $ColorSecondary

Write-Host "  [8/30] Capas del Sistema" -ForegroundColor Gray

# =====================================================================
# SLIDE 9: FLUJO DE LOGIN
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Como Funciona el Login (paso a paso)"

$text = @"
Cuando un usuario quiere entrar al sistema, pasa esto:

PASO 1: El usuario escribe su nombre y contrasena
  -> POST /api/auth/login con { usuario: "JPEREZ", contrasena: "miClave" }

PASO 2: Validacion basica (Joi)
  -> Se verifica que el usuario tenga minimo 2 caracteres
  -> Se verifica que la contrasena tenga minimo 6 caracteres
  -> Si no cumple: Error 400 "Datos invalidos"

PASO 3: Rate Limiting (proteccion contra ataques)
  -> Se revisa cuantos intentos fallidos tiene esa IP
  -> Si tiene 10+ intentos en 10 minutos: BLOQUEADO 5 minutos
  -> Error 429 "Demasiados intentos"

PASO 4: Buscar usuario en la base de datos
  -> SELECT * FROM usuarios WHERE usuario = 'JPEREZ'
  -> Si no existe: Error 401 "Credenciales incorrectas"

PASO 5: Verificar contrasena con bcrypt
  -> bcrypt.compare("miClave", "$2a$10$hashGuardado...")
  -> Compara el texto plano con el hash almacenado
  -> Si no coincide: Error 401 "Credenciales incorrectas"

PASO 6: Crear sesion y tokens
  -> Se genera un JWT (Access Token) valido por 1 hora
  -> Se genera un Refresh Token valido por 7 dias
  -> Se crea una sesion en el servidor (req.session.userId = 5)
  -> Se envia una cookie segura al navegador

PASO 7: Cargar permisos del usuario
  -> Se consultan sus permisos por empresa y modulo
  -> Se envian al frontend para mostrar solo lo que puede ver

RESULTADO EXITOSO: El usuario entra al sistema con sus permisos cargados
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 12

Write-Host "  [9/30] Flujo de Login" -ForegroundColor Gray

# =====================================================================
# SLIDE 10: COOKIES Y SESIONES
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Cookies y Sesiones - Como se mantiene la sesion"

$text = @"
QUE ES UNA COOKIE?
  Es un pequeno dato que el servidor envia al navegador. El navegador
  lo guarda y lo envia de vuelta en cada peticion siguiente.
  Es como una pulsera de acceso en un evento.

CONFIGURACION DE LA COOKIE EN SUMMACHAM:

  Nombre: "panelamcham.sid"
    Identifica esta cookie como perteneciente a SummaCham

  httpOnly: true
    La cookie NO puede leerse desde JavaScript del navegador
    Protege contra ataques XSS (Cross-Site Scripting)

  secure: depende del entorno
    En produccion: solo funciona con HTTPS (conexion encriptada)
    En desarrollo: funciona con HTTP normal

  maxAge: 30 minutos
    La sesion expira despues de 30 minutos SIN actividad
    Si el usuario sigue trabajando, se renueva automaticamente

  rolling: true (se renueva con cada peticion)
    Ejemplo: Login a las 09:00, expira 09:30
    Si hace algo a las 09:15, se extiende a 09:45
    Si no hace nada en 30 min, se cierra la sesion

  sameSite: depende del entorno
    Produccion: 'none' (permite acceso desde tuneles HTTPS)
    Desarrollo: 'lax' (solo mismo sitio)

DONDE SE GUARDA LA SESION?
  En SQLite (tabla de sesiones), NO en memoria del servidor
  Esto permite que la sesion sobreviva a reinicios del servidor
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 13

Write-Host "  [10/30] Cookies y Sesiones" -ForegroundColor Gray

# =====================================================================
# SLIDE 11: RATE LIMITING
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Rate Limiting - Proteccion contra ataques"

$text = @"
QUE ES?
  Un mecanismo que limita cuantos intentos de login puede hacer una IP.
  Previene ataques de "fuerza bruta" (probar miles de contrasenas).

COMO FUNCIONA?

  CONFIGURACION:
    Ventana de tiempo: 10 minutos
    Maximo de intentos: 10
    Tiempo de bloqueo: 5 minutos

  EJEMPLO REAL:

    09:00 - Intento 1 fallido    (count: 1)
    09:01 - Intento 2 fallido    (count: 2)
    09:02 - Intento 3 fallido    (count: 3)
    ...
    09:08 - Intento 9 fallido    (count: 9)
    09:09 - Intento 10 fallido   (count: 10)
             BLOQUEADO HASTA 09:14 (5 minutos)

    09:10 - Intento 11 -> RECHAZADO (429 Too Many Requests)
    09:12 - Intento 12 -> RECHAZADO (429 Too Many Requests)
    09:15 - Intento 13 -> PERMITIDO (bloqueo ya expiro)

  SI EL LOGIN ES EXITOSO:
    Se borran todos los intentos de esa IP
    El contador vuelve a cero

  LIMPIEZA AUTOMATICA:
    Cada peticion ejecuta pruneAttempts() que elimina
    registros de intentos mayores a 10 minutos

DONDE SE GUARDA?
  En memoria (Map de JavaScript), se reinicia si el servidor se reinicia.
  No necesita base de datos, es rapido y eficiente.
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 12

Write-Host "  [11/30] Rate Limiting" -ForegroundColor Gray

# =====================================================================
# SLIDE 12: SISTEMA DE PERMISOS - ESTRUCTURA
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Sistema de Permisos - Quien puede hacer que"

$text = @"
EL SISTEMA TIENE 3 NIVELES DE PERMISOS:

NIVEL 1: USUARIO
  Cada usuario tiene permisos generales:
  - es_admin_global: Si es 1, tiene acceso TOTAL a todo
  - puede_agregar: Puede crear registros nuevos
  - puede_modificar: Puede editar registros existentes
  - puede_eliminar: Puede borrar registros

NIVEL 2: EMPRESA
  Un usuario puede tener acceso a una o varias empresas:
  - empresa1 (Ciudad de Mexico)
  - empresa2 (Guadalajara)
  - empresa3 (Monterrey)
  - empresa4 (Queretaro)

NIVEL 3: MODULO + ACCION
  Dentro de cada empresa, el usuario tiene permisos por modulo:

  Ejemplo: Juan Perez en empresa1:

  | Modulo      | Ver | Cargar | Revisar | Aprobar |
  |-------------|-----|--------|---------|---------|
  | RH          |  SI |   SI   |   NO    |   NO    |
  | Finanzas    |  SI |   NO   |   SI    |   NO    |
  | RESUMEN     |  SI |   NO   |   NO    |   NO    |

  Esto significa:
  - En RH: puede ver datos Y cargar/guardar nuevos
  - En Finanzas: puede ver datos Y marcar como revisado
  - En RESUMEN: solo puede ver (lectura)

USUARIO ESPECIAL: ICONET
  Siempre es admin global, tiene acceso total a todo.
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 13

Write-Host "  [12/30] Permisos Estructura" -ForegroundColor Gray

# =====================================================================
# SLIDE 13: VALIDACION DE PERMISOS
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Como se Validan los Permisos"

$text = @"
CADA VEZ QUE EL USUARIO HACE UNA PETICION, PASA ESTO:

1. El middleware requireAuth verifica la sesion:
   -> Busca token en: sesion del servidor, cookie, o header Authorization
   -> Si no hay token valido: Error 401 "Sesion no valida"

2. Carga la informacion del usuario desde SQLite:
   -> Nombre, permisos generales, mapa de permisos por empresa

3. Construye el "mapa de permisos" en memoria:
   {
     empresa1: {
       'RH': { Ver: true, 'Cargar y guardar': true, Revisar: false, Aprobar: false },
       'Finanzas': { Ver: true, 'Cargar y guardar': false, Revisar: true, Aprobar: false }
     }
   }

4. Cada ruta protegida verifica el permiso especifico:
   Ejemplo: El usuario quiere GUARDAR datos en el modulo RH de empresa1

   -> Se verifica: tienePermisoModulo(mapa, 'empresa1', 'RH', 'Cargar y guardar')
   -> Si tiene permiso: la peticion continua
   -> Si NO tiene permiso: Error 403 "No tienes permiso"

MODULOS UNIVERSALES (acceso especial):
  SUMMARY, RESUMEN y PRESUPUESTOS permiten lectura a todos
  los usuarios autenticados. Las demas acciones SI requieren
  permisos explicitos.

ADMIN GLOBAL (es_admin_global = 1):
  Salta TODAS las verificaciones de permisos.
  Puede hacer todo en todas las empresas y modulos.
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 13

Write-Host "  [13/30] Validacion Permisos" -ForegroundColor Gray

# =====================================================================
# SLIDE 14: BASE DE DATOS SQLITE - TABLAS
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Base de Datos SQLite - Tablas Principales"

$text = @"
Archivo: datos/panel.sqlite
Es la base de datos LOCAL donde se guarda toda la configuracion.

TABLAS DE SEGURIDAD:
  1. usuarios - Datos de cada usuario (nombre, hash de contrasena, rol)
  2. permisos_modulo - Que puede hacer cada usuario en cada empresa/modulo
  3. permisos_edicion_capitulo - Permisos especificos por capitulo

TABLAS DE PRESUPUESTOS:
  4. presupuestos_estado - Estado actual (sin-cargar, cargado, revisado, aprobado)
  5. presupuestos_estado_historial - Registro de todos los cambios de estado
  6. presupuestos_guardados - Datos guardados oficialmente
  7. PLAN_BORRADORES - Guardado automatico mientras el usuario trabaja

TABLAS DE LAYOUTS (estructura contable):
  8. layout_cuentas - Catalogo de cuentas por ano/empresa
  9. layout_operaciones - Formulas de calculo (totales, consolidados)
  10. layout_secciones - Agrupaciones (Income, Expense, etc.)
  11. layout_bitacora - Registro de cambios en layouts

TABLAS DE COLABORACION:
  12. comentarios_celdas - Comentarios en celdas especificas
  13. notificaciones - Alertas para los usuarios

TABLAS DE CONFIGURACION:
  14. graficas_config - Configuracion de graficas guardadas
  15. sesiones - Sesiones activas de usuarios (express-session store)

MODO DE ACCESO:
  SQLite usa modo WAL (Write-Ahead Logging) que permite que
  multiples usuarios lean al mismo tiempo sin bloquearse.
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 12

Write-Host "  [14/30] SQLite Tablas" -ForegroundColor Gray

# =====================================================================
# SLIDE 15: TABLA USUARIOS - DETALLE
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Tabla: usuarios - Cada columna explicada"

$text = @"
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY      - Numero unico, se genera solo (1, 2, 3...)
  usuario TEXT UNIQUE          - Nombre de login, ejemplo: "JPEREZ" (no se repite)
  nombres TEXT                 - Nombre(s), ejemplo: "Juan Carlos"
  apellido_primero TEXT        - Apellido paterno, ejemplo: "Perez"
  apellido_segundo TEXT        - Apellido materno, ejemplo: "Lopez"
  correo TEXT                  - Email, ejemplo: "juan@empresa.com"
  contrasena TEXT              - Hash bcrypt (NUNCA texto plano)
                                 Ejemplo: "$2a$10$N9qo8uLOick..."
  es_admin_global INTEGER      - 0 = normal, 1 = administrador total
  puede_agregar INTEGER        - 0 = no, 1 = puede crear registros
  puede_modificar INTEGER      - 0 = no, 1 = puede editar registros
  puede_eliminar INTEGER       - 0 = no, 1 = puede borrar registros
  creado_en TEXT               - Fecha de creacion automatica
)

EJEMPLO DE UN REGISTRO REAL:
  id: 5
  usuario: 'JPEREZ'
  nombres: 'Juan Carlos'
  apellido_primero: 'Perez'
  apellido_segundo: 'Lopez'
  correo: 'juan.perez@empresa.com'
  contrasena: '$2a$10$N9qo8uLOickgx2ZMRZoMye...' (60 caracteres)
  es_admin_global: 0 (usuario normal)
  puede_agregar: 1 (si puede)
  puede_modificar: 1 (si puede)
  puede_eliminar: 0 (no puede)
  creado_en: '2026-01-15 10:30:00'

IMPORTANTE: La contrasena se encripta con bcrypt (saltRounds=10).
Nadie puede ver la contrasena original, ni siquiera el administrador.
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 11

Write-Host "  [15/30] Tabla Usuarios" -ForegroundColor Gray

# =====================================================================
# SLIDE 16: TABLA PERMISOS_MODULO
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Tabla: permisos_modulo - Permisos detallados"

$text = @"
Esta tabla define QUE puede hacer cada usuario en cada empresa y modulo.

CREATE TABLE permisos_modulo (
  id INTEGER PRIMARY KEY
  usuario_id INTEGER         - A que usuario (FK a usuarios.id)
  empresa_id TEXT            - En que empresa ('empresa1', 'empresa2'...)
  modulo TEXT                - En que modulo ('RH', 'Finanzas', 'RESUMEN'...)
  puede_leer INTEGER         - 0/1: Puede ver datos?
  puede_cargar_guardar INTEGER - 0/1: Puede ingresar y guardar datos?
  puede_revisar INTEGER      - 0/1: Puede marcar como revisado?
  puede_aprobar INTEGER      - 0/1: Puede dar aprobacion final?

  UNIQUE(usuario_id, empresa_id, modulo)
    Solo puede haber UN registro por combinacion usuario-empresa-modulo

  FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    Si se elimina el usuario, se eliminan sus permisos automaticamente
)

EJEMPLO - Permisos de Juan Perez (id=5) en empresa1:

  | modulo     | leer | cargar | revisar | aprobar |
  |------------|------|--------|---------|---------|
  | RH         |  1   |   1    |    0    |    0    |
  | Finanzas   |  1   |   0    |    1    |    0    |
  | RESUMEN    |  1   |   0    |    0    |    0    |

  En RH: Puede ver Y escribir datos
  En Finanzas: Puede ver Y revisar (pero no escribir)
  En RESUMEN: Solo puede ver (lectura)

MODULOS DISPONIBLES:
  RH, Finanzas, Gastos Generales, VPE, T&IC, Eventos,
  Membresia, Servicios Membresia, Nomina, RESUMEN, SUMMARY, PRESUPUESTOS
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 11

Write-Host "  [16/30] Tabla Permisos" -ForegroundColor Gray

# =====================================================================
# SLIDE 17: TABLA LAYOUT_CUENTAS
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Tabla: layout_cuentas - Estructura contable"

$text = @"
Esta tabla define las CUENTAS CONTABLES que se usan en cada modulo/ano.
Es como el "catalogo" de cuentas para construir los reportes.

COLUMNAS PRINCIPALES:
  empresa_id          - 'empresa1', 'empresa2', etc.
  modulo              - 'RESUMEN', 'RH', 'Finanzas', etc.
  anio                - 2024, 2025, 2026... (layouts son por ano)
  cuenta              - Numero de cuenta: '4100', '5200', '1100-001'
  nombre              - Descripcion: 'Membership Renewals', 'Salaries'
  capitulo            - Region/division: 'CDMX', 'GDL', 'MTY', 'QRO'
  seccion_principal   - Agrupacion: 'Income (CDMX)', 'Expense (CDMX)'
  seccion_secundaria  - Sub-agrupacion opcional: 'Membership', 'Events'
  operacion_factor    - Multiplicador: 1 = suma, -1 = resta, 0.5 = mitad
  orden               - Orden de visualizacion (legacy)
  orden_presentacion  - Orden PRINCIPAL de visualizacion (el que se usa)
  visible             - 0 = oculta, 1 = visible en la interfaz

EJEMPLO DE REGISTRO:
  empresa_id: 'empresa1', modulo: 'RESUMEN', anio: 2025
  cuenta: '4100', nombre: 'Membership Renewals'
  capitulo: 'CDMX', seccion_principal: 'Income (CDMX)'
  seccion_secundaria: 'Membership'
  operacion_factor: 1, orden_presentacion: 10, visible: 1

COMO SE USA:
  1. Se cargan las cuentas del layout para un modulo/ano/empresa
  2. Se agrupan por seccion_principal (Income, Expense...)
  3. Se consultan los saldos de cada cuenta en Firebird
  4. Se calculan los totales por seccion usando operacion_factor
  5. Se muestran en orden de orden_presentacion
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 12

Write-Host "  [17/30] Tabla Layout Cuentas" -ForegroundColor Gray

# =====================================================================
# SLIDE 18: INTEGRACION FIREBIRD
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Integracion con Firebird (Aspel COI)"

$text = @"
QUE ES FIREBIRD / ASPEL COI?
  Aspel COI es un sistema contable mexicano que guarda sus datos en
  una base de datos Firebird. SummaCham LEE esos datos para mostrar
  los saldos reales de las cuentas contables.

COMO SE CONECTA?
  Archivo de config: datos/firebird-connections.json
  - host: direccion del servidor (127.0.0.1 o remoto)
  - port: 3050 (puerto de Firebird)
  - user: sysdba
  - password: (configurada)
  - database: ruta al archivo .FDB por empresa

TABLAS DE FIREBIRD QUE SE CONSULTAN:
  Por cada ano (ej: 2025) existen tablas separadas:
  - CUENTAS25: Catalogo de cuentas contables del ano 2025
  - SALDOS25: Movimientos mensuales (cargos y abonos) del ano 2025

COMO SE OBTIENEN LOS SALDOS:
  1. Se buscan las cuentas del layout en la tabla CUENTASyy
  2. Se hace LEFT JOIN con SALDOSyy para obtener los movimientos
  3. Cada cuenta tiene 12 columnas de cargo y 12 de abono (una por mes)
  4. Se calcula: Para cuentas Acreedoras -> saldo = abono - cargo
                 Para cuentas Deudoras   -> saldo = cargo - abono

TIMEOUTS:
  - Conexion local: 3 segundos (rapido)
  - Conexion remota: 120 segundos (da mas tiempo por la red)
  - Si es remota: 3 reintentos automaticos

SEGURIDAD:
  - Credenciales en archivo separado (no en codigo)
  - Queries parametrizadas (prevencion de SQL injection)
  - Log de queries lentas (mayores a 2 segundos)
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 13

Write-Host "  [18/30] Integracion Firebird" -ForegroundColor Gray

# =====================================================================
# SLIDE 19: QUERY DE SALDOS
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Query SQL a Firebird - Obtencion de Saldos"

$text = @"
ESTA ES LA CONSULTA QUE OBTIENE LOS SALDOS DE FIREBIRD:

SELECT
  c.num_cta AS CUENTA,          -- Numero de cuenta: '4100'
  c.nombre  AS NOMBRE,          -- Nombre: 'Membership Renewals'
  c.naturaleza AS NATURALEZA,   -- 'A' = Acreedora, 'D' = Deudora
  s.cargo01, s.abono01,         -- Enero: cargos y abonos
  s.cargo02, s.abono02,         -- Febrero
  ...                           -- (12 meses)
  s.cargo12, s.abono12          -- Diciembre
FROM CUENTAS25 c
LEFT JOIN SALDOS25 s ON s.num_cta = c.num_cta
WHERE c.status = 'A'            -- Solo cuentas activas
  AND c.num_cta IN ('4100', '4200', '5100')  -- Cuentas del layout

DESPUES DE OBTENER LOS DATOS, SE CALCULAN LOS SALDOS:

  Para cuenta ACREEDORA (ingresos: 2xxx, 3xxx, 4xxx):
    saldo del mes = abono - cargo
    Si en enero: abono01=150,000 y cargo01=15,000
    Saldo enero = 150,000 - 15,000 = 135,000

  Para cuenta DEUDORA (gastos: 5xxx-9xxx, activos: 1xxx):
    saldo del mes = cargo - abono
    Si en enero: cargo01=120,000 y abono01=5,000
    Saldo enero = 120,000 - 5,000 = 115,000

RESULTADO FINAL POR CUENTA:
  {
    cuenta: '4100',
    nombre: 'Membership Renewals',
    ene: 135,000,  feb: 108,000, ... dic: 162,000,
    anual: 1,800,000  (suma de todos los meses)
  }
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 12

Write-Host "  [19/30] Query de Saldos" -ForegroundColor Gray

# =====================================================================
# SLIDE 20: SISTEMA DE LAYOUTS
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Sistema de Layouts (Plantillas Contables)"

$text = @"
QUE ES UN LAYOUT?
  Es una PLANTILLA que define la estructura de un reporte financiero.
  Dice cuales cuentas se muestran, en que orden, y como se calculan los totales.

COMPONENTES DE UN LAYOUT:

  1. CUENTAS (layout_cuentas)
     Son las filas individuales del reporte.
     Ejemplo: cuenta '4100' - 'Membership Renewals'

  2. SECCIONES (layout_secciones)
     Agrupan las cuentas en bloques logicos.
     Ejemplo: 'Income (CDMX)' agrupa todas las cuentas de ingreso de CDMX

  3. OPERACIONES (layout_operaciones)
     Son filas de CALCULO que suman, restan o combinan cuentas/secciones.
     Ejemplo: 'Total Income' = suma de todas las cuentas en 'Income (CDMX)'

CADA LAYOUT ES ESPECIFICO POR:
  - Empresa (empresa1, empresa2...)
  - Modulo (RESUMEN, RH, Finanzas...)
  - Ano (2024, 2025, 2026...)
  - Capitulo (CDMX, GDL, MTY, QRO, DEFAULT)

GESTOR DE PLANTILLAS (plantillas.html):
  Interfaz visual para administrar los layouts:
  - Crear, editar y eliminar cuentas y operaciones
  - Importar estructura desde archivos Excel
  - Exportar a JSON
  - Clonar layouts de un ano a otro
  - Reordenar cuentas con drag-and-drop
  - Diagnosticar problemas en formulas
  - Registro de cambios (bitacora)
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 13

Write-Host "  [20/30] Sistema de Layouts" -ForegroundColor Gray

# =====================================================================
# SLIDE 21: OPERACIONES CONSOLIDADAS
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Algoritmo: Operaciones Consolidadas"

$text = @"
QUE SON LAS OPERACIONES CONSOLIDADAS?
  Son calculos que suman TODAS las secciones del mismo tipo.
  Ejemplo: "CONSOLIDATED INCOME" = suma de Income de todas las ciudades.

COMO FUNCIONA LA AUTO-CONSTRUCCION:

  PASO 1: Detectar operaciones consolidadas
    El sistema busca operaciones cuyo nombre contenga:
    - "CONSOLIDATED" o "CONSOLIDADO" o "TOTAL"
    - + "INCOME" o "EXPENSE" o "INGRESO" o "GASTO"

    Si encuentra "CONSOLIDATED INCOME" -> sabe que debe sumar todo el income

  PASO 2: Buscar secciones relevantes
    Recorre todas las cuentas del layout y encuentra las secciones:
    - Income (CDMX)
    - Income (Guadalajara)
    - Income (Monterrey)
    - Income (Queretaro)    <- Si se agrego una ciudad nueva, SE DETECTA SOLA

  PASO 3: Construir la formula automaticamente
    CONSOLIDATED INCOME =
      + Income (CDMX)
      + Income (Guadalajara)
      + Income (Monterrey)
      + Income (Queretaro)

  PASO 4: Guardar la formula en base de datos
    Se guarda como JSON en layout_operaciones.formula_json

VENTAJA PRINCIPAL:
  Si agregas una nueva seccion (ej: Income (Merida)), el sistema
  la detecta AUTOMATICAMENTE y la incluye en el consolidado.
  No necesitas editar manualmente ninguna formula.

CALCULO RECURSIVO:
  NET INCOME = CONSOLIDATED INCOME - CONSOLIDATED EXPENSE
  Primero calcula INCOME, luego EXPENSE, luego resta.
  Las operaciones pueden referirse a otras operaciones (recursion).
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 12

Write-Host "  [21/30] Operaciones Consolidadas" -ForegroundColor Gray

# =====================================================================
# SLIDE 22: MOTOR DE CALCULO
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Motor de Calculo - Como se calculan los totales"

$text = @"
Cada operacion tiene una "formula" compuesta por "terminos":

  formula_terms = [
    { operator: '+', type: 'section', value: 'Income (CDMX)' },
    { operator: '+', type: 'cuenta',  value: '4100' },
    { operator: '-', type: 'operation', value: 'CONSOLIDATED EXPENSE' }
  ]

TIPOS DE TERMINOS:

  1. type: 'section' -> Suma TODAS las cuentas de esa seccion
     Ejemplo: 'Income (CDMX)' suma cuentas 4100 + 4200 + 4300

  2. type: 'cuenta' -> Usa el valor de UNA cuenta especifica
     Ejemplo: '4100' toma solo el valor de esa cuenta

  3. type: 'operation' -> Usa el resultado de OTRA operacion (RECURSION)
     Ejemplo: 'CONSOLIDATED EXPENSE' calcula primero esa operacion

OPERADORES:
  '+' suma el valor al resultado
  '-' resta el valor del resultado

EJEMPLO COMPLETO:

  Operacion: NET INCOME (Resultado Neto)
  Formula: CONSOLIDATED INCOME - CONSOLIDATED EXPENSE

  Paso 1: Calcular CONSOLIDATED INCOME
    Income (CDMX) = 4100(150K) + 4200(80K) + 4300(60K) = 290K
    Income (GDL)  = 4100(100K) + 4200(50K)              = 150K
    TOTAL INCOME = 290K + 150K = 440K

  Paso 2: Calcular CONSOLIDATED EXPENSE
    Expense (CDMX) = 5100(120K) + 5200(80K) = 200K
    Expense (GDL)  = 5100(90K)  + 5200(60K) = 150K
    TOTAL EXPENSE = 200K + 150K = 350K

  Paso 3: Calcular NET INCOME
    NET INCOME = 440K - 350K = 90K

PROTECCIONES:
  - Cache de operaciones ya calculadas (no recalcular)
  - Deteccion de dependencias circulares (evitar loops infinitos)
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 12

Write-Host "  [22/30] Motor de Calculo" -ForegroundColor Gray

# =====================================================================
# SLIDE 23: MODULOS DEL SISTEMA
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Modulos del Sistema"

$text = @"
MODULOS OPERATIVOS (cada uno maneja presupuesto de un area):

  1. RH (Recursos Humanos)        - Nomina, salarios, prestaciones
  2. Finanzas                     - Ingresos y gastos financieros
  3. Gastos Generales             - Gastos administrativos, servicios
  4. Nomina                       - Detalle de nomina por empleado
  5. VPE (Vicepresidencia)        - Gastos de direccion
  6. T&IC (Tecnologia)            - Presupuesto de TI
  7. Eventos                      - Ingresos y gastos de eventos
  8. Membresia                    - Ingresos por membresias
  9. Servicios Membresia          - Servicios adicionales a miembros

MODULOS CONSOLIDADOS (agrupan datos de todos los modulos):

  10. RESUMEN   - Consolidado de todos los modulos (espanol)
  11. SUMMARY   - Resumen ejecutivo (ingles)
  12. PRESUPUESTOS - Gestion centralizada y aprobaciones

CADA MODULO TIENE:
  - Sus propias cuentas contables (layout_cuentas)
  - Sus propias operaciones de calculo (layout_operaciones)
  - Su propio estado de aprobacion (sin-cargar -> cargado -> revisado -> aprobado)
  - Borradores de guardado automatico
  - Comentarios en celdas especificas
  - Permisos independientes por usuario
  - Exportacion a Excel

INTERFACES ADICIONALES:
  - Graficas: Visualizaciones interactivas con Chart.js
  - Gestor de Plantillas: Administracion de layouts
  - Configuracion Firebird: Conexiones a bases de datos
  - Perfil: Informacion del usuario y cambio de contrasena
  - Usuarios: CRUD de usuarios y asignacion de permisos
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 13

Write-Host "  [23/30] Modulos del Sistema" -ForegroundColor Gray

# =====================================================================
# SLIDE 24: FLUJO DE APROBACION
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Flujo de Aprobacion de Presupuestos"

$text = @"
Cada presupuesto pasa por 4 estados en orden:

  SIN CARGAR  -->  CARGADO  -->  REVISADO  -->  APROBADO

EJEMPLO DE FLUJO REAL:

  PASO 1: Maria (Analista Financiero)
    Permiso: Lectura + Cargar y guardar
    - Ingresa los datos del presupuesto de RH 2025
    - Guarda los cambios
    - Estado cambia: SIN CARGAR -> CARGADO

  PASO 2: Juan (Supervisor)
    Permiso: Lectura + Revisar
    - Revisa los datos que ingreso Maria
    - Valida que los numeros esten correctos
    - Marca como "Revisado"
    - Estado cambia: CARGADO -> REVISADO

  PASO 3: Karla (Directora)
    Permiso: Lectura + Aprobar
    - Revisa el presupuesto ya revisado
    - Da su aprobacion final
    - Estado cambia: REVISADO -> APROBADO

NOTIFICACIONES AUTOMATICAS:
  - Cuando cambia el estado, se notifica a los usuarios involucrados
  - Si hay comentarios en celdas, se notifica al responsable

AUDITORIA COMPLETA:
  Cada cambio de estado se registra en presupuestos_estado_historial:
  - Quien lo cambio
  - Cuando lo cambio
  - De que estado a que estado

API:
  POST /api/presupuestos/estado  -> Cambiar estado
  GET /api/presupuestos/estado/:empresa/:modulo/:anio  -> Ver estado actual
  GET /api/presupuestos/historial/:empresa/:modulo/:anio  -> Ver historial
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 13

Write-Host "  [24/30] Flujo de Aprobacion" -ForegroundColor Gray

# =====================================================================
# SLIDE 25: INTERFACES DE USUARIO
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Interfaces de Usuario (Vistas)"

$text = @"
VISTA              | ARCHIVO              | QUE HACE
--------------------|----------------------|------------------------------
Login               | login.html           | Autenticacion de usuarios
Panel Principal     | app.html             | Menu lateral, selector empresa
Usuarios            | usuarios.html        | CRUD de usuarios y permisos
Crear Usuario       | crear_usuario.html   | Formulario nuevo/editar usuario
Presupuestos        | Presupuestos.html    | Vista principal de modulos
Modulo (RH, etc.)   | RH.html, etc.        | Carga y edicion de datos
RESUMEN             | RESUMEN.html         | Dashboard consolidado
Graficas            | Graficas-Mejoradas   | Graficas interactivas
Gestor Plantillas   | plantillas.html      | Administracion de layouts
Config Firebird     | firebird-config      | Conexiones a BD contables
Perfil              | perfil.html          | Datos del usuario, password

CARACTERISTICAS COMUNES EN TODAS LAS VISTAS:
  - Bootstrap 5: Diseno responsivo y profesional
  - Font Awesome: Iconos en botones y menus
  - DataTables: Tablas con busqueda, filtros y paginacion
  - SweetAlert2: Notificaciones y dialogos elegantes
  - Guardado automatico: Los datos se guardan como borrador
  - Validacion en tiempo real: Se valida mientras el usuario escribe
  - Indicadores de carga: Spinners mientras se procesan datos
  - Exportacion: A Excel (XLSX) y PDF

COMUNICACION CON EL BACKEND:
  Todas las vistas usan fetch() con credenciales para comunicarse
  con el servidor Express en http://localhost:3005/api/*
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 12

Write-Host "  [25/30] Interfaces de Usuario" -ForegroundColor Gray

# =====================================================================
# SLIDE 26: SISTEMA DE BACKUPS
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Sistema de Backups Automaticos"

$text = @"
QUE HACE?
  Copia automaticamente la base de datos SQLite a intervalos regulares
  para proteger los datos contra perdida accidental.

COMO FUNCIONA:

  1. Al iniciar la aplicacion, se hace el primer backup
  2. Cada 60 minutos (configurable), se crea otro backup
  3. El backup es una copia exacta de panel.sqlite
  4. Se nombra con fecha y hora: panel.sqlite.bak_20260209_143022
  5. Se guarda en: datos/backups/
  6. Se conservan los ultimos 24 backups (configurable)
  7. Los backups mas antiguos se eliminan automaticamente

CONFIGURACION (variables de entorno):
  BACKUP_ENABLED = true            Activar/desactivar
  BACKUP_INTERVAL_MINUTES = 60     Cada cuantos minutos
  BACKUP_MAX_BACKUPS = 24          Cuantos backups guardar
  BACKUP_PATH = ./datos/backups    Donde guardarlos

VERIFICACION DE INTEGRIDAD:
  Cada backup incluye un checksum SHA256 para verificar
  que la copia no se corrompio.

RESTAURACION:
  Si algo sale mal, se puede restaurar desde un backup:
  POST /api/backups/restaurar/:filename
  - Se crea un .bak de seguridad del archivo actual
  - Se reemplaza panel.sqlite con el backup seleccionado

API:
  POST /api/backups/crear    -> Crear backup manual
  GET  /api/backups/lista    -> Listar backups disponibles
  POST /api/backups/restaurar/:filename -> Restaurar
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 13

Write-Host "  [26/30] Backups" -ForegroundColor Gray

# =====================================================================
# SLIDE 27: ACTUALIZACION AUTOMATICA
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Sistema de Actualizacion Automatica"

$text = @"
COMO SE ACTUALIZA LA APLICACION SIN REINSTALAR?

  1. El usuario abre la app normalmente

  2. Despues de 5 segundos, el sistema verifica en GitHub Releases
     si hay una version mas nueva

  3. Si hay nueva version:
     - Le pregunta al usuario: "Nueva version X.Y.Z disponible. Descargar?"
     - El usuario decide si descargar ahora o mas tarde

  4. Si acepta descargar:
     - Se descarga en segundo plano (no interrumpe el trabajo)
     - Muestra progreso: "Descargando: 45%..."

  5. Cuando termina la descarga:
     - Pregunta: "Reiniciar para instalar?"
     - Si acepta: cierra la app, instala y reinicia
     - Si no acepta: se instala automaticamente cuando cierre la app

  6. Los DATOS DEL USUARIO se conservan (solo se actualiza el programa)

CONFIGURACION IMPORTANTE:
  autoDownload = false   (no descarga sin preguntar)
  autoInstallOnAppQuit = true  (instala al cerrar si hay update)

REQUISITOS PARA PUBLICAR UNA ACTUALIZACION:
  1. Crear un Release en GitHub con estos archivos:
     - SummaCham Setup X.Y.Z.exe (instalador)
     - SummaCham X.Y.Z.exe (portable)
     - latest.yml (archivo de metadatos OBLIGATORIO)
  2. El Release debe ser publico (o tener token configurado)

NOTA: Solo funciona en la app empaquetada (no en modo desarrollo).
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 13

Write-Host "  [27/30] Actualizacion Automatica" -ForegroundColor Gray

# =====================================================================
# SLIDE 28: SEGURIDAD
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Seguridad - Todas las protecciones"

$text = @"
1. CONTRASENAS: bcrypt con 10 rondas de sal
   Nunca se guardan en texto plano. Nadie puede recuperarlas.

2. TOKENS JWT: Access token (1 hora) + Refresh token (7 dias)
   El access token expira rapido para limitar el dano si se roba.

3. SESIONES: express-session con SQLite store
   Sesion del lado del servidor, cookies httpOnly (no accesibles desde JS).

4. RATE LIMITING: Max 10 intentos cada 10 min, bloqueo 5 min
   Previene ataques de fuerza bruta contra el login.

5. HELMET: Cabeceras HTTP de seguridad automaticas
   X-Content-Type-Options, X-Frame-Options, HSTS, X-XSS-Protection.

6. CORS: Lista blanca de origenes permitidos
   Solo origenes autorizados pueden hacer peticiones al servidor.

7. VALIDACION: Joi verifica todos los datos de entrada
   Previene inyecciones y datos malformados.

8. SQL PARAMETRIZADO: Queries con ? en lugar de concatenacion
   Previene SQL injection tanto en SQLite como en Firebird.

9. COOKIES SEGURAS:
   httpOnly (no accesible desde JS), secure (solo HTTPS en prod),
   sameSite (proteccion CSRF), maxAge (expiracion automatica).

10. AUDITORIA: Se registra TODO
    Intentos de login, cambios de estado, modificaciones a layouts,
    queries lentas. Todo queda en la bitacora.

11. BACKUPS: Copias automaticas cada 60 minutos
    Proteccion contra perdida de datos accidental.

12. SECRETOS: Variables de entorno, no hardcoded
    JWT_SECRET y SESSION_SECRET se generan automaticamente.
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 12

Write-Host "  [28/30] Seguridad" -ForegroundColor Gray

# =====================================================================
# SLIDE 29: DEPLOYMENT
# =====================================================================
$s = Add-Slide -Presentation $presentation
Add-SectionTitle -Slide $s -Title "Compilacion y Distribucion"

$text = @"
COMO SE COMPILA LA APLICACION:

  1. Instalar dependencias:
     npm install
     npm run rebuild-native-electron

  2. Crear archivos de distribucion:
     npm run dist           -> Crear instalador (NSIS)
     npm run build:portable -> Crear version portable
     npm run build:all      -> Ambos formatos

  3. Archivos generados en ./dist/:
     - SummaCham Setup 4.1.0.exe    (Instalador Windows)
     - SummaCham 4.1.0.exe          (Portable, no requiere instalacion)
     - latest.yml                   (Metadatos para auto-update)

COMO SE PUBLICA:
  1. Crear tag en Git: git tag -a v4.1.0 -m "Release 4.1.0"
  2. Subir tag: git push origin v4.1.0
  3. Crear Release en GitHub y subir los archivos de dist/
  4. Los usuarios existentes reciben notificacion de actualizacion

DOS MODOS DE DISTRIBUCION:

  INSTALADOR (NSIS):
  - Requiere permisos de administrador
  - Se instala en Program Files
  - Crea shortcuts en escritorio y menu
  - Incluye desinstalador

  PORTABLE:
  - No requiere instalacion
  - Ejecutable unico
  - Ideal para USB o pruebas

ELECTRON-BUILDER CONFIGURACION:
  appId: "com.summa.cham.panelamcham"
  Compresion maxima, asar empaquetado
  Publica en GitHub (owner: IustusRenidet, repo: SummaCham)
"@

Add-TextBox -Slide $s -Left 50 -Top 115 -Width 920 -Height 430 -Text $text -FontSize 13

Write-Host "  [29/30] Deployment" -ForegroundColor Gray

# =====================================================================
# SLIDE 30: CONCLUSION Y CIERRE
# =====================================================================
$s = Add-Slide -Presentation $presentation
$s.Shapes[1].TextFrame.TextRange.Text = "SummaCham - PanelAMCHAM"
$s.Shapes[1].TextFrame.TextRange.Font.Size = 48
$s.Shapes[1].TextFrame.TextRange.Font.Bold = $true
$s.Shapes[1].TextFrame.TextRange.Font.Color.RGB = $ColorPrimary

Add-TextBox -Slide $s -Left 100 -Top 150 -Width 800 -Height 50 -Text "Resumen de Fortalezas" -FontSize 28 -Bold $true

$text = @"
  Arquitectura en capas bien definida (Presentacion, Controladores, Middleware, Servicios, Datos)
  Sistema de permisos granular: usuario -> empresa -> modulo -> accion
  Seguridad multicapa: bcrypt, JWT, rate limiting, helmet, CORS, validacion
  Integracion dual: SQLite (config local) + Firebird (datos contables)
  Algoritmos inteligentes: operaciones consolidadas auto-construidas
  Multi-usuario real: sesiones independientes, trabajo colaborativo
  Auto-actualizacion sin downtime via GitHub Releases
  Backups automaticos con verificacion de integridad
  Flujo de aprobacion: cargar -> revisar -> aprobar con auditoria completa
  Graficas interactivas exportables a imagen, Excel y PDF
"@

Add-TextBox -Slide $s -Left 80 -Top 210 -Width 860 -Height 230 -Text $text -FontSize 15

Add-TextBox -Slide $s -Left 150 -Top 460 -Width 700 -Height 30 -Text "Version 4.1.0 | Febrero 2026" -FontSize 18 -Bold $true
Add-TextBox -Slide $s -Left 150 -Top 495 -Width 700 -Height 25 -Text "Desarrollado por: Iustus Renidet & J02V4N" -FontSize 16

Write-Host "  [30/30] Conclusion" -ForegroundColor Gray

# =====================================================================
# GUARDAR PRESENTACION
# =====================================================================
Write-Host "`nGuardando presentacion..." -ForegroundColor Yellow

try {
    $fullPath = [System.IO.Path]::GetFullPath($OutputPath)
    $presentation.SaveAs($fullPath)
    Write-Host "Presentacion guardada exitosamente en:" -ForegroundColor Green
    Write-Host "  $fullPath" -ForegroundColor Cyan

    $presentation.Close()
    $powerpoint.Quit()

    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($presentation) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($powerpoint) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()

    Write-Host "`nPresentacion Tecnica Unificada creada con exito!" -ForegroundColor Green
    Write-Host "  30 slides con toda la documentacion del sistema" -ForegroundColor Yellow
    Write-Host "  Explicado de forma sencilla y facil de entender" -ForegroundColor Yellow

} catch {
    Write-Host "Error al guardar: $_" -ForegroundColor Red
    exit 1
}
