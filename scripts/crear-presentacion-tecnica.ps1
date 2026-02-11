# PowerShell Script para crear presentación técnica de SummaCham
# Genera una presentación PowerPoint completa con toda la documentación técnica

param(
    [string]$OutputPath = "$PSScriptRoot\..\PRESENTACION_TECNICA_SUMMACHAM.pptx"
)

Write-Host "🎨 Creando presentación técnica de SummaCham..." -ForegroundColor Cyan

# Verificar que PowerPoint está instalado
$powerpointPath = "HKLM:\SOFTWARE\Microsoft\Office"
if (-not (Test-Path $powerpointPath)) {
    Write-Host "❌ Microsoft Office no parece estar instalado" -ForegroundColor Red
    Write-Host "   Creando documento de texto con el contenido como alternativa..." -ForegroundColor Yellow
    
    # Crear documento de texto como alternativa
    $txtPath = "$PSScriptRoot\..\DOCUMENTACION_TECNICA_SUMMACHAM.txt"
    @"
SUMMACHAM - PANELामCHAM
DOCUMENTACIÓN TÉCNICA COMPLETA
Versión 4.1.0 - Febrero 2026
"@ | Out-File -FilePath $txtPath -Encoding UTF8
    
    Write-Host "✅ Documentación creada en: $txtPath" -ForegroundColor Green
    exit 0
}

# Crear instancia de PowerPoint
try {
    $powerpoint = New-Object -ComObject PowerPoint.Application
    $powerpoint.Visible = 1  # Usar valor numérico en lugar de enum
    
    # Crear nueva presentación
    $presentation = $powerpoint.Presentations.Add()
    $presentation.PageSetup.SlideSize = 16  # ppSlideSizeOnScreen16x9 = 16
    
    Write-Host "✅ PowerPoint iniciado correctamente" -ForegroundColor Green
} catch {
    Write-Host "❌ Error al iniciar PowerPoint: $_" -ForegroundColor Red
    Write-Host "   Asegúrate de que Microsoft PowerPoint esté instalado" -ForegroundColor Yellow
    exit 1
}

# Función helper para agregar slide
function Add-Slide {
    param(
        [Parameter(Mandatory)]$Presentation,
        [int]$LayoutType = 11  # ppLayoutTitleOnly
    )
    
    $slide = $Presentation.Slides.Add($Presentation.Slides.Count + 1, $LayoutType)
    return $slide
}

# Función para agregar texto a un shape
function Add-Text {
    param(
        [Parameter(Mandatory)]$Shape,
        [Parameter(Mandatory)][string]$Text,
        [int]$FontSize = 18,
        [string]$FontName = "Calibri",
        [bool]$Bold = $false
    )
    
    $Shape.TextFrame.TextRange.Text = $Text
    $Shape.TextFrame.TextRange.Font.Size = $FontSize
    $Shape.TextFrame.TextRange.Font.Name = $FontName
    $Shape.TextFrame.TextRange.Font.Bold = $Bold
}

# Función para agregar cuadro de texto
function Add-TextBox {
    param(
        [Parameter(Mandatory)]$Slide,
        [float]$Left,
        [float]$Top,
        [float]$Width,
        [float]$Height,
        [string]$Text,
        [int]$FontSize = 18,
        [bool]$Bold = $false
    )
    
    $textBox = $Slide.Shapes.AddTextbox(
        1,  # msoTextOrientationHorizontal = 1
        $Left, $Top, $Width, $Height
    )
    Add-Text -Shape $textBox -Text $Text -FontSize $FontSize -Bold $Bold
    return $textBox
}

# Función para agregar forma
function Add-Shape {
    param(
        [Parameter(Mandatory)]$Slide,
        [int]$ShapeType,
        [float]$Left,
        [float]$Top,
        [float]$Width,
        [float]$Height,
        [string]$Text = "",
        [int]$FillColor = 0,
        [int]$LineColor = 0
    )
    
    $shape = $Slide.Shapes.AddShape($ShapeType, $Left, $Top, $Width, $Height)
    
    if ($FillColor -ne 0) {
        $shape.Fill.ForeColor.RGB = $FillColor
    }
    
    if ($LineColor -ne 0) {
        $shape.Line.ForeColor.RGB = $LineColor
    }
    
    if ($Text -ne "") {
        $shape.TextFrame.TextRange.Text = $Text
    }
    
    return $shape
}

# Colores corporativos
$ColorPrimary = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb(41, 128, 185))  # Azul
$ColorSecondary = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb(52, 73, 94))  # Gris oscuro
$ColorAccent = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb(46, 204, 113))   # Verde
$ColorWarning = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb(230, 126, 34))  # Naranja
$ColorDanger = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb(231, 76, 60))    # Rojo
$ColorLight = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::FromArgb(236, 240, 241))   # Gris claro

Write-Host "📄 Creando slides..." -ForegroundColor Yellow

# ==========================================
# SLIDE 1: PORTADA
# ==========================================
$slide1 = Add-Slide -Presentation $presentation -LayoutType 11
$slide1.Shapes[1].TextFrame.TextRange.Text = "SummaCham - PanelAMCHAM"
$slide1.Shapes[1].TextFrame.TextRange.Font.Size = 54
$slide1.Shapes[1].TextFrame.TextRange.Font.Bold = $true
$slide1.Shapes[1].TextFrame.TextRange.Font.Color.RGB = $ColorPrimary

Add-TextBox -Slide $slide1 -Left 100 -Top 250 -Width 800 -Height 60 -Text "Documentación Técnica Completa" -FontSize 32 -Bold $true
Add-TextBox -Slide $slide1 -Left 100 -Top 330 -Width 800 -Height 40 -Text "Sistema de Gestión Financiera Empresarial"  -FontSize 24
Add-TextBox -Slide $slide1 -Left 100 -Top 400 -Width 800 -Height 30 -Text "Versión 4.1.0" -FontSize 20
Add-TextBox -Slide $slide1 -Left 100 -Top 490 -Width 800 -Height 30 -Text "Febrero 2026" -FontSize 18

# ==========================================
# SLIDE 2: TABLA DE CONTENIDO
# ==========================================
$slide2 = Add-Slide -Presentation $presentation -LayoutType 11
$slide2.Shapes[1].TextFrame.TextRange.Text = "Tabla de Contenido"
$slide2.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide2.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$contenido = @"
1. Stack Tecnológico
2. Arquitectura del Sistema
3. Sistema de Autenticación
4. Sistema de Permisos Granular
5. Middleware y Seguridad
6. Base de Datos SQLite
7. Integración con Firebird
8. Algoritmos de Operaciones
9. Sistema de Layouts
10. Interfaces de Usuario
11. Flujos de Autorización
12. Sistema de Backups
13. Actualización Automática
"@

Add-TextBox -Slide $slide2 -Left 80 -Top 120 -Width 850 -Height 400 -Text $contenido -FontSize 22

# ==========================================
# SLIDE 3: STACK TECNOLÓGICO - FRONTEND
# ==========================================
$slide3 = Add-Slide -Presentation $presentation -LayoutType 11
$slide3.Shapes[1].TextFrame.TextRange.Text = "Stack Tecnológico - Frontend"
$slide3.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide3.Shapes[1].TextFrame.TextRange.Font.Bold = $true

# Electron
Add-Shape -Slide $slide3 -ShapeType 1 -Left 80 -Top 140 -Width 250 -Height 60 -Text "Electron 39.2.7" -FillColor $ColorPrimary
Add-TextBox -Slide $slide3 -Left 80 -Top 210 -Width 250 -Height 80 -Text "Framework de escritorio multiplataforma para aplicaciones web" -FontSize 14

# HTML/CSS/JS
Add-Shape -Slide $slide3 -ShapeType 1 -Left 370 -Top 140 -Width 250 -Height 60 -Text "HTML5 + CSS3 + JS" -FillColor $ColorSecondary
Add-TextBox -Slide $slide3 -Left 370 -Top 210 -Width 250 -Height 80 -Text "Interfaz moderna, responsiva con Chart.js para visualización" -FontSize 14

# Bootstrap
Add-Shape -Slide $slide3 -ShapeType 1 -Left 660 -Top 140 -Width 250 -Height 60 -Text "Bootstrap 5" -FillColor $ColorAccent
Add-TextBox -Slide $slide3 -Left 660 -Top 210 -Width 250 -Height 80 -Text "Framework CSS para diseño responsivo y componentes" -FontSize 14

# ==========================================
# SLIDE 4: STACK TECNOLÓGICO - BACKEND
# ==========================================
$slide4 = Add-Slide -Presentation $presentation -LayoutType 11
$slide4.Shapes[1].TextFrame.TextRange.Text = "Stack Tecnológico - Backend"
$slide4.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide4.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$techStack = @"
Node.js + Express.js
• Servidor web robusto en el puerto 3005
• Middleware: helmet, cors, cookie-parser, express-session
• Arquitectura RESTful API

Better-SQLite3
• Base de datos SQLite embebida
• Alta performance (síncrono)
• Almacenamiento: usuarios, permisos, layouts, borradores

node-firebird
• Conectividad con Firebird 2.5+
• Queries a bases de datos contables externas
• Soporte para transacciones

JWT (jsonwebtoken) + bcryptjs
• Autenticación con tokens JWT
• Encriptación segura de contraseñas (bcrypt)
• Refresh tokens para sesiones extendidas

Joi
• Validación de esquemas de datos
• Sanitización de inputs
• Prevención de inyecciones
"@

Add-TextBox -Slide $slide4 -Left 80 -Top 120 -Width 850 -Height 400 -Text $techStack -FontSize 18

# ==========================================
# SLIDE 5: ARQUITECTURA GENERAL
# ==========================================
$slide5 = Add-Slide -Presentation $presentation -LayoutType 11
$slide5.Shapes[1].TextFrame.TextRange.Text = "Arquitectura del Sistema"
$slide5.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide5.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$arquitectura = @"
┌─────────────────────────────────────────────────┐
│           ELECTRON (Contenedor Desktop)          │
│  • Ventana principal integrada                   │
│  • System tray icon                              │
│  • Auto-launch con Windows                       │
│  • Auto-updater (GitHub Releases)                │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│     EXPRESS SERVER (Puerto 3005)                 │
│  • 0.0.0.0:3005 (accesible local/remoto)        │
│  • Trust proxy enabled (túneles HTTPS)          │
│  • Sesiones con SQLite store                    │
└─────────────────┬───────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼──────┐  ┌──▼────────┐  ┌▼──────────┐
│ SQLite   │  │ Firebird  │  │  Vistas   │
│ (Local)  │  │ (Externa) │  │  HTML     │
└──────────┘  └───────────┘  └───────────┘

Acceso Multi-Usuario:
• Local: http://localhost:3005
• Remoto: https://panelamcham.iconetcloud.com.mx
• Sesiones independientes por usuario
• Cookies persistentes (7 días)
"@

Add-TextBox -Slide $slide5 -Left 70 -Top 120 -Width 880 -Height 420 -Text $arquitectura -FontSize 16

# ==========================================
# SLIDE 6: ARQUITECTURA - CAPAS
# ==========================================
$slide6 = Add-Slide -Presentation $presentation -LayoutType 11
$slide6.Shapes[1].TextFrame.TextRange.Text = "Arquitectura en Capas"
$slide6.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide6.Shapes[1].TextFrame.TextRange.Font.Bold = $true

# Capa de Presentación
Add-Shape -Slide $slide6 -ShapeType 1 -Left 150 -Top 130 -Width 700 -Height 50 -Text "Capa de Presentación (Vistas HTML + JS)" -FillColor $ColorPrimary
Add-TextBox -Slide $slide6 -Left 150 -Top 185 -Width 700 -Height 35 -Text "login.html, usuarios.html, presupuestos.html, RESUMEN.html, graficas.html" -FontSize 14

# Capa de Controladores
Add-Shape -Slide $slide6 -ShapeType 1 -Left 150 -Top 235 -Width 700 -Height 50 -Text "Capa de Controladores (Routes)" -FillColor $ColorSecondary
Add-TextBox -Slide $slide6 -Left 150 -Top 290 -Width 700 -Height 35 -Text "auth.js, usuarios.js, empresas.js, presupuestos.js, reportes.js, insercion.js" -FontSize 14

# Middleware
Add-Shape -Slide $slide6 -ShapeType 1 -Left 150 -Top 340 -Width 700 -Height 50 -Text "Capa de Middleware (Seguridad)" -FillColor $ColorWarning
Add-TextBox -Slide $slide6 -Left 150 -Top 395 -Width 700 -Height 35 -Text "requireAuth, permisos, rate limiting, CORS, helmet, validaciones Joi" -FontSize 14

# Servicios
Add-Shape -Slide $slide6 -ShapeType 1 -Left 150 -Top 445 -Width 340 -Height 50 -Text "Servicios" -FillColor $ColorAccent
Add-TextBox -Slide $slide6 -Left 150 -Top 500 -Width 340 -Height 35 -Text "permisosService, firebirdService, layoutService" -FontSize 13

# Base de Datos
Add-Shape -Slide $slide6 -ShapeType 1 -Left 510 -Top 445 -Width 340 -Height 50 -Text "Persistencia" -FillColor $ColorDanger
Add-TextBox -Slide $slide6 -Left 510 -Top 500 -Width 340 -Height 35 -Text "SQLite (local), Firebird (externa)" -FontSize 13

# ==========================================
# SLIDE 7: SISTEMA DE AUTENTICACIÓN
# ==========================================
$slide7 = Add-Slide -Presentation $presentation -LayoutType 11
$slide7.Shapes[1].TextFrame.TextRange.Text = "Sistema de Autenticación"
$slide7.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide7.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$autenticacion = @"
Mecanismos Implementados:

1. AUTENTICACIÓN DUAL
   • Sesiones con express-session + SQLite store
   • JWT (JSON Web Tokens) con refresh tokens
   • Cookie-based authentication

2. FLUJO DE LOGIN
   ┌─────────────┐
   │ Usuario     │ POST /api/auth/login
   │ + Password  │ {usuario, contrasena}
   └──────┬──────┘
          │
          ▼
   ┌──────────────────────────────────┐
   │ Validación Joi                    │
   │ • Min 2 caracteres usuario        │
   │ • Min 6 caracteres password       │
   └──────┬───────────────────────────┘
          │
          ▼
   ┌──────────────────────────────────┐
   │ Rate Limiting                     │
   │ • Max 10 intentos / 10 minutos    │
   │ • Bloqueo 5 minutos si excede     │
   └──────┬───────────────────────────┘
          │
          ▼
   ┌──────────────────────────────────┐
   │ Verificar Usuario en SQLite       │
   │ SELECT * FROM usuarios            │
   │ WHERE usuario = ?                 │
   └──────┬───────────────────────────┘
          │
          ▼
   ┌──────────────────────────────────┐
   │ Comparar Hash (bcrypt.compare)    │
   │ contrasena vs hash almacenado     │
   └──────┬───────────────────────────┘
          │
          ▼
   ┌──────────────────────────────────┐
   │ Emitir Tokens JWT                 │
   │ • Access Token (1 hora)           │
   │ • Refresh Token (7 días)          │
   └──────┬───────────────────────────┘
          │
          ▼
   ┌──────────────────────────────────┐
   │ Crear Sesión                      │
   │ req.session.userId = user.id      │
   │ Cookie: panelamcham.sid           │
   └──────────────────────────────────┘

3. PROTECCIÓN DE CONTRASEÑAS
   • bcrypt con saltRounds = 10
   • Nunca se almacenan en texto plano
   • Hash verificable pero no reversible
"@

Add-TextBox -Slide $slide7 -Left 50 -Top 120 -Width 920 -Height 420 -Text $autenticacion -FontSize 14

# ==========================================
# SLIDE 8: MIDDLEWARE DE AUTENTICACIÓN
# ==========================================
$slide8 = Add-Slide -Presentation $presentation -LayoutType 11
$slide8.Shapes[1].TextFrame.TextRange.Text = "Middleware: requireAuth"
$slide8.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide8.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$middleware = @"
Protección de Rutas (src/middleware/auth.js)

const requireAuth = (req, res, next) => {
  // 1. Extraer token de múltiples fuentes
  const token = extraerToken(req);
  //    • req.session.userId (sesión)
  //    • req.cookies.tokenAcceso (cookie)
  //    • Authorization: Bearer <token> (header)
  
  if (!token) {
    return res.status(401).json({
      mensaje: 'Sesión no válida o expirada.'
    });
  }
  
  // 2. Verificar token
  if (token === 'SESSION_AUTH') {
    // Autenticado por sesión
    registro = cargarUsuario(req.session.userId);
  } else {
    // Verificar JWT
    payload = jwt.verify(token, JWT_SECRET);
    registro = cargarUsuario(payload.sub);
  }
  
  // 3. Construir contexto de usuario
  const contexto = construirContexto(registro);
  req.usuarioActual = { ...registro info ... };
  req.esAdmin = contexto.esAdmin;
  req.mapaPermisos = contexto.mapaPermisos;
  
  next(); // Continuar a la ruta protegida
};

Uso en Rutas:
router.get('/api/usuarios', requireAuth, (req, res) => {
  // Ruta protegida, req.usuarioActual disponible
});
"@

Add-TextBox -Slide $slide8 -Left 50 -Top 120 -Width 920 -Height 420 -Text $middleware -FontSize 15

# ==========================================
# SLIDE 9: SISTEMA DE PERMISOS - ESTRUCTURA
# ==========================================
$slide9 = Add-Slide -Presentation $presentation -LayoutType 11
$slide9.Shapes[1].TextFrame.TextRange.Text = "Sistema de Permisos Granular"
$slide9.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide9.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$permisos = @"
Estructura Multi-Nivel

┌──────────────────────────────────────────────────┐
│              USUARIO                              │
│  • es_admin_global (boolean)                      │
│  • puede_agregar, puede_modificar, puede_eliminar │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────┐
│          EMPRESA (empresa1, empresa2...)          │
│  Permisos por empresa asignada al usuario         │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────┐
│     MÓDULO (RESUMEN, Finanzas, RH, VPE...)       │
│  Permisos específicos por módulo                  │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────┐
│    ACCIONES (4 niveles de acceso granular)        │
│                                                    │
│  ✓ Lectura (puede_leer)                           │
│    Ver datos, consultar reportes                  │
│                                                    │
│  ✓ Cargar y Guardar (puede_cargar_guardar)        │
│    Ingresar datos, guardar cambios                │
│                                                    │
│  ✓ Revisar (puede_revisar)                        │
│    Marcar como revisado, agregar comentarios      │
│                                                    │
│  ✓ Aprobar (puede_aprobar)                        │
│    Autorización final, aprobación de presupuestos │
└───────────────────────────────────────────────────┘

Tabla: permisos_modulo
┌──────────┬──────────┬────────┬──────────┬───────────┬──────────┬─────────┐
│ usuario  │ empresa  │ modulo │ lectura  │ cargar_   │ revisar  │ aprobar │
│   _id    │   _id    │        │          │  guardar  │          │         │
├──────────┼──────────┼────────┼──────────┼───────────┼──────────┼─────────┤
│    5     │ empresa1 │ RH     │    1     │     1     │    0     │    0    │
│    5     │ empresa1 │Finanzas│    1     │     0     │    1     │    0    │
│    7     │ empresa2 │RESUMEN │    1     │     1     │    1     │    1    │
└──────────┴──────────┴────────┴──────────┴───────────┴──────────┴─────────┘
"@

Add-TextBox -Slide $slide9 -Left 50 -Top 120 -Width 920 -Height 420 -Text $permisos -FontSize 13

# ==========================================
# SLIDE 10: SISTEMA DE PERMISOS - VALIDACIÓN
# ==========================================
$slide10 = Add-Slide -Presentation $presentation -LayoutType 11
$slide10.Shapes[1].TextFrame.TextRange.Text = "Validación de Permisos"
$slide10.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide10.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$validacion = @"
Funciones de Verificación (src/services/permisosService.js)

1. construirMapaPermisos(registros)
   Construye estructura jerárquica de permisos:
   
   {
     empresa1: {
       'RH': {
         Ver: true,
         Lectura: true,
         'Cargar y guardar': true,
         Revisar: false,
         Aprobar: false
       },
       'Finanzas': { ... },
       ...
     },
     empresa2: { ... }
   }

2. tienePermisoEmpresa(mapaPermisos, empresaId)
   Verifica si usuario tiene algún permiso en la empresa

3. tienePermisoModulo(mapaPermisos, empresaId, modulo, accion)
   Verifica permiso específico:
   
   if (tienePermisoModulo(mapa, 'empresa1', 'RH', 'Cargar y guardar')) {
     // Usuario puede guardar datos en RH
   }

4. Módulos Universales (Acceso Especial)
   • SUMMARY, RESUMEN, PRESUPUESTOS
   • Todos los usuarios autenticados pueden leer
   • Otras acciones requieren permisos explícitos

5. Usuario Admin Global
   • es_admin_global = 1
   • ICONET (cuenta especial)
   • Bypass automático de todos los permisos
   • Acceso completo a todas las empresas y módulos

Ejemplo de Uso en Backend:
router.post('/api/presupuestos/guardar', requireAuth, (req, res) => {
  const empresaId = req.headers['x-empresa-activa'];
  const modulo = req.body.modulo;
  
  if (!req.esAdmin) {
    const tienePermiso = tienePermisoModulo(
      req.mapaPermisos,
      empresaId,
      modulo,
      'Cargar y guardar'
    );
    
    if (!tienePermiso) {
      return res.status(403).json({
        mensaje: 'No tienes permiso para guardar en este módulo'
      });
    }
  }
  
  // Continuar con la lógica de guardado...
});
"@

Add-TextBox -Slide $slide10 -Left 50 -Top 120 -Width 920 -Height 420 -Text $validacion -FontSize 13

# ==========================================
# SLIDE 11: BASE DE DATOS SQLite - TABLAS PRINCIPALES
# ==========================================
$slide11 = Add-Slide -Presentation $presentation -LayoutType 11
$slide11.Shapes[1].TextFrame.TextRange.Text = "Base de Datos SQLite - Tablas Principales"
$slide11.Shapes[1].TextFrame.TextRange.Font.Size = 38
$slide11.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$tablas = @"
📊 panel.sqlite (Ubicación: ./datos/panel.sqlite)

1. USUARIOS
   • id, usuario (UNIQUE), nombres, apellidos, correo
   • contrasena (hash bcrypt)
   • es_admin_global, puede_agregar, puede_modificar, puede_eliminar

2. PERMISOS_MODULO
   • usuario_id, empresa_id, modulo
   • puede_leer, puede_cargar_guardar, puede_revisar, puede_aprobar
   • UNIQUE(usuario_id, empresa_id, modulo)

3. PRESUPUESTOS_ESTADO
   • empresa_id, modulo, anio, capitulo
   • estado (sin-cargar, cargado, revisado, aprobado)
   • actualizado_por (FK usuarios.id), actualizado_en

4. PRESUPUESTOS_ESTADO_HISTORIAL
   • Auditoría de cambios de estado
   • empresa_id, modulo, anio, capitulo, estado
   • cambiado_por, cambiado_en

5. NOTIFICACIONES
   • usuario_id, tipo, mensaje, leido
   • metadata (JSON), creado_en

6. COMENTARIOS_CELDAS
   • empresa_id, modulo, anio, capitulo
   • cuenta_full, comentario
   • creado_por, creado_en

7. PLAN_BORRADORES
   • Guardado automático de presupuestos
   • usuario_id, empresa_id, modulo, anio, capitulo
   • contenido (JSON), actualizado_en

8. LAYOUT_CUENTAS
   • Estructura contable por año y empresa
   • anio, empresa_id, cuenta_full, descripcion
   • seccion, tipo_cuenta, orden

9. LAYOUT_OPERACIONES
   • Fórmulas y operaciones consolidadas
   • anio, empresa_id, Clase, SECCION
   • seccion_1, seccion_2, ..., seccion_20
   • formula_json (términos de fórmula)

10. GRAFICAS_CONFIG
    • Configuración de gráficas
    • nombre, tipo, datos_config (JSON)
    • creado_por, actualizado_en
"@

Add-TextBox -Slide $slide11 -Left 50 -Top 120 -Width 920 -Height 420 -Text $tablas -FontSize 15

# ==========================================
# SLIDE 12: INTEGRACIÓN FIREBIRD
# ==========================================
$slide12 = Add-Slide -Presentation $presentation -LayoutType 11
$slide12.Shapes[1].TextFrame.TextRange.Text = "Integración con Firebird"
$slide12.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide12.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$firebird = @"
Conexión a Bases de Datos Contables Externas

┌────────────────────────────────────────────────┐
│         FIREBIRD SERVICE                        │
│   (src/services/firebirdService.js)             │
└────────────────────┬───────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────┐
│     Configuración Base (Firebird)               │
│  • host: 127.0.0.1 (o remoto)                   │
│  • port: 3050                                   │
│  • user: sysdba                                 │
│  • password: masterkey                          │
│  • database: ruta por empresa                   │
└────────────────────┬───────────────────────────┘
                     │
      ┌──────────────┼──────────────┐
      │              │              │
┌─────▼─────┐  ┌────▼────┐  ┌──────▼──────┐
│ empresa1   │  │empresa2 │  │  empresa3   │
│ ./BASE.FDB │  │ ./E2.FDB│  │  ./E3.FDB   │
└────────────┘  └─────────┘  └─────────────┘

OPERACIONES PRINCIPALES:

1. ejecutarConsulta(empresaId, sql, params)
   • Ejecuta query SELECT
   • Connection pooling automático
   • Timeout configurado (local: 3s, remoto: 120s)
   • Detach automático de conexión

2. ejecutarLote(empresaId, operaciones, options)
   • Transacciones
   • Múltiples queries en una transacción
   • Rollback automático en error
   • Isolation level configurable

3. probarConexion(empresaId)
   • Health check de la base de datos
   • Verifica disponibilidad antes de operar
   • Usado en login para mostrar status

CONFIGURACIÓN DE CONEXIÓN:
• Local: 3s timeout, sin reintentos
• Remota: 120s timeout, 3 reintentos
• Detección automática basada en host:port

QUERIES TÍPICAS:
• Obtener saldos de cuentas contables
• Leer catálogo de cuentas
• Validar estructura contable
• Exportar datos para reportes

SEGURIDAD:
• Credenciales en firebird-connections.json
• Validación de permisos antes de query
• Sanitización de SQL (parametrización)
• Logging de queries lentas (>2s)
"@

Add-TextBox -Slide $slide12 -Left 50 -Top 120 -Width 920 -Height 420 -Text $firebird -FontSize 14

# ==========================================
# SLIDE 13: ALGORITMOS - OPERACIONES CONSOLIDADAS
# ==========================================
$slide13 = Add-Slide -Presentation $presentation -LayoutType 11
$slide13.Shapes[1].TextFrame.TextRange.Text = "Algoritmos: Operaciones Consolidadas"
$slide13.Shapes[1].TextFrame.TextRange.Font.Size = 38
$slide13.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$algoritmos = @"
Auto-Construcción de Fórmulas Financieras

PROBLEMA:
  Al agregar un nuevo capítulo (ej: Income (Querétaro)), las operaciones
  consolidadas no se actualizan automáticamente.

SOLUCIÓN:
  Sistema de auto-construcción que detecta y suma todas las secciones
  relevantes en tiempo real.

ALGORITMO hydrateOperationsFromParents():

  1. Detectar Operaciones Consolidadas
     keywords = ['CONSOLIDATED', 'CONSOLIDADO', 'TOTAL']
     types = ['INCOME', 'EXPENSE', 'INGRESO', 'GASTO']
     
     if (operacion.nombre includes keyword) AND (includes type) {
       isConsolidated = true
     }

  2. Buscar Todas las Secciones del Tipo
     if (tipo === 'INCOME') {
       secciones = buscarSecciones(keywords: ['Income', 'Ingreso'])
     }
     
     Ejemplo resultado:
     [
       'Income (CDMX)',
       'Income (Guadalajara)',
       'Income (Monterrey)',
       'Income (Querétaro)'  ← Detectado automáticamente
     ]

  3. Construir Términos de Fórmula
     formula_terms = secciones.map(seccion => ({
       operator: '+',
       type: 'section',
       value: seccion
     }))
     
     Resultado:
     [
       { operator: '+', type: 'section', value: 'Income (CDMX)' },
       { operator: '+', type: 'section', value: 'Income (Guadalajara)' },
       { operator: '+', type: 'section', value: 'Income (Monterrey)' },
       { operator: '+', type: 'section', value: 'Income (Querétaro)' }
     ]

  4. Marcar como Auto-Construido
     operacion._autoBuilt = true

VENTAJAS:
  ✓ Siempre actualizado sin intervención manual
  ✓ Nueva sección → automáticamente incluida en consolidado
  ✓ Eliminar sección → automáticamente removida
  ✓ Cero mantenimiento de fórmulas consolidadas

CASO DE USO:
  Módulo RESUMEN:
    • CONSOLIDATED INCOME = suma de todos los Income
    • CONSOLIDATED EXPENSE = suma de todos los Expense
    • NET INCOME = CONSOLIDATED INCOME - CONSOLIDATED EXPENSE
"@

Add-TextBox -Slide $slide13 -Left 50 -Top 120 -Width 920 -Height 420 -Text $algoritmos -FontSize 13

# ==========================================
# SLIDE 14: ALGORITMOS - CÁLCULO DE SUMAS
# ==========================================
$slide14 = Add-Slide -Presentation $presentation -LayoutType 11
$slide14.Shapes[1].TextFrame.TextRange.Text = "Algoritmos: Cálculo de Sumas por Operación"
$slide14.Shapes[1].TextFrame.TextRange.Font.Size = 38
$slide14.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$sumas = @"
Motor de Cálculo Recursivo

FLUJO DE EJECUCIÓN:

1. Cargar Layout de Cuentas
   layoutCuentas = SELECT * FROM layout_cuentas
   WHERE anio = 2025 AND empresa_id = 'empresa1'
   
   Estructura jerárquica:
   {
     'Income (CDMX)': [
       { cuenta: '4100', descripcion: 'Membership Renewals', valor: 150000 },
       { cuenta: '4200', descripcion: 'New Members', valor: 80000 },
       ...
     ],
     'Expense (CDMX)': [
       { cuenta: '5100', descripcion: 'Salaries', valor: -120000 },
       ...
     ]
   }

2. Cargar Operaciones
   operaciones = SELECT * FROM layout_operaciones
   WHERE anio = 2025 AND empresa_id = 'empresa1'
   
   Ejemplo:
   {
     Clase: 'Total Membership Income',
     formula_terms: [
       { operator: '+', type: 'cuenta', value: '4100' },
       { operator: '+', type: 'cuenta', value: '4200' }
     ]
   }

3. Calcular Valor de Operación (recursivo)
   function calcularOperacion(operacion, layoutCuentas) {
     let resultado = 0
     
     for (term of operacion.formula_terms) {
       if (term.type === 'cuenta') {
         // Buscar valor de cuenta
         valor = layoutCuentas.find(c => c.cuenta === term.value).valor
       }
       else if (term.type === 'section') {
         // Sumar todas las cuentas de la sección
         valor = sumarCuentasSeccion(term.value, layoutCuentas)
       }
       else if (term.type === 'operation') {
         // RECURSIÓN: calcular otra operación
         otraOp = operaciones.find(o => o.Clase === term.value)
         valor = calcularOperacion(otraOp, layoutCuentas)
       }
       
       // Aplicar operador
       if (term.operator === '+') resultado += valor
       else if (term.operator === '-') resultado -= valor
     }
     
     return resultado
   }

4. Ejemplo CompleFijo:
   NET INCOME = CONSOLIDATED INCOME - CONSOLIDATED EXPENSE
   
   donde:
     CONSOLIDATED INCOME = Income(CDMX) + Income(GDL) + Income(MTY)
     CONSOLIDATED EXPENSE = Expense(CDMX) + Expense(GDL) + Expense(MTY)
   
   Cálculo:
     1. Calcular CONSOLIDATED INCOME (suma secciones)
     2. Calcular CONSOLIDATED EXPENSE (suma secciones)
     3. Restar: INCOME - EXPENSE = NET INCOME

OPTIMIZACIONES:
  • Caché de operaciones calculadas (evitar recálculo)
  • Detección de dependencias circulares
  • Validación de fórmulas antes de guardar
"@

Add-TextBox -Slide $slide14 -Left 50 -Top 120 -Width 920 -Height 420 -Text $sumas -FontSize 12

# ==========================================
# SLIDE 15: SISTEMA DE LAYOUTS
# ==========================================
$slide15 = Add-Slide -Presentation $presentation -LayoutType 11
$slide15.Shapes[1].TextFrame.TextRange.Text = "Sistema de Layouts"
$slide15.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide15.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$layouts = @"
Gestión de Estructuras Contables por Año

¿QUÉ ES UN LAYOUT?
  Plantilla de estructura contable que define:
    • Cuentas contables y su jerarquía
    • Secciones (Income, Expense, Assets, etc.)
    • Operaciones consolidadas
    • Orden de visualización

COMPONENTES PRINCIPALES:

1. LAYOUT_CUENTAS
   Catálogo de cuentas con metadata:
   • cuenta_full: '4100-001'
   • descripcion: 'Membership Renewals'
   • seccion: 'Income (CDMX)'
   • tipo_cuenta: 'Income' | 'Expense' | 'Asset' | 'Liability'
   • orden: número para ordenamiento
   • anio: 2025
   • empresa_id: 'empresa1'

2. LAYOUT_OPERACIONES
   Fórmulas de cálculo:
   • Clase: nombre de la operación
   • SECCION: sección padre
   • formula_terms: array de términos
   • formula_json: serialización de fórmula

3. LAYOUT_SECCIONES
   Agrupaciones visuales:
   • nombre: 'Income (CDMX)'
   • tipo: 'Income' | 'Expense'
   • orden: número
   • empresa_id, anio

FLUJO DE TRABAJO:

1. Importar Layout desde Excel/JSON
   POST /api/layouts/importar
   {
     anio: 2025,
     empresa_id: 'empresa1',
     cuentas: [...],
     operaciones: [...]
   }

2. Cargar Layout en Módulo
   GET /api/layouts/:anio/:empresa
   → Retorna estructura completa con jerarquía

3. Guardar Modificaciones
   PUT /api/layouts/:anio/:empresa/operaciones
   → Actualiza operaciones modificadas

4. Validar Layout
   POST /api/layouts/validar
   → Verifica integridad, dependencias circulares

GESTOR DE PLANTILLAS:
  • Vista: plantillas.html
  • CRUD completo de layouts
  • Importación masiva desde Excel
  • Exportación a JSON
  • Clonación de layouts entre años
  • Bitácora de cambios (layout_bitacora)
"@

Add-TextBox -Slide $slide15 -Left 50 -Top 120 -Width 920 -Height 420 -Text $layouts -FontSize 14

# ==========================================
# SLIDE 16: INTERFACES DE USUARIO
# ==========================================
$slide16 = Add-Slide -Presentation $presentation -LayoutType 11
$slide16.Shapes[1].TextFrame.TextRange.Text = "Interfaces de Usuario"
$slide16.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide16.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$interfaces = @"
Vistas HTML Principales (./vistas/)

🔐 LOGIN (login.html)
   • Autenticación de usuarios
   • Validación en tiempo real
   • Recuperación de contraseña
   • Rate limiting visual

👥 USUARIOS (usuarios.html)
   • CRUD de usuarios
   • Asignación de permisos por empresa/módulo
   • Tabla con búsqueda y filtros
   • Modal de edición inline

🏢 EMPRESAS (empresas.html)
   • Selector de empresa activa
   • Información de empresas disponibles
   • Status de conexión Firebird

📊 PRESUPUESTOS (Presupuestos.html)
   • Vista principal de módulos financieros
   • Carga/guardado de presupuestos
   • Estados: sin-cargar, cargado, revisado, aprobado
   • Historial de cambios

📈 RESUMEN (RESUMEN.html)
   • Dashboard consolidado
   • Visualización de operaciones calculadas
   • Tabla dinámica con sumas automáticas
   • Exportación a Excel

📉 GRÁFICAS (Graficas-Mejoradas.html)
   • Gráficas interactivas con Chart.js
   • Tipos: línea, barra, pie, doughnut, radar
   • Configuración guardada en BD
   • Exportación a imagen/PDF
   • Asistente de creación guiada

🔧 GESTOR DE PLANTILLAS (plantillas.html)
   • Administración de layouts
   • Importación desde Excel
   • Edición visual de operaciones
   • Validación de fórmulas
   • Diagnóstico de operaciones

⚙️ CONFIGURACIÓN (firebird-config.html, graficas-config.html)
   • Configuración de conexiones Firebird
   • Test de conectividad
   • Administración de gráficas

👤 PERFIL (perfil.html)
   • Información del usuario
   • Cambio de contraseña
   • Preferencias

CARACTERÍSTICAS COMUNES:
  ✓ Bootstrap 5 (diseño responsivo)
  ✓ Font Awesome (iconos)
  ✓ DataTables (tablas interactivas)
  ✓ Chart.js (visualizaciones)
  ✓ Sweet Alert 2 (notificaciones)
  ✓ Guardado automático (borradores)
  ✓ Validación en tiempo real
  ✓ Indicadores de carga
"@

Add-TextBox -Slide $slide16 -Left 50 -Top 120 -Width 920 -Height 420 -Text $interfaces -FontSize 14

# ==========================================
# SLIDE 17: FLUJOS DE AUTORIZACIÓN
# ==========================================
$slide17 = Add-Slide -Presentation $presentation -LayoutType 11
$slide17.Shapes[1].TextFrame.TextRange.Text = "Flujos de Autorización"
$slide17.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide17.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$flujos = @"
Workflow de Aprobación de Presupuestos

ESTADOS DE UN PRESUPUESTO:

┌──────────────┐
│ SIN CARGAR   │ Estado inicial, sin datos
└──────┬───────┘
       │ Usuario con permiso "Cargar y guardar"
       │ ingresa datos
       ▼
┌──────────────┐
│   CARGADO    │ Datos ingresados, pendiente revisión
└──────┬───────┘
       │ Usuario con permiso "Revisar"
       │ valida información
       ▼
┌──────────────┐
│   REVISADO   │ Información validada, pendiente aprobación
└──────┬───────┘
       │ Usuario con permiso "Aprobar"
       │ da visto bueno final
       ▼
┌──────────────┐
│   APROBADO   │ Presupuesto cerrado y oficial
└──────────────┘

EJEMPLO DE FLUJO REAL:

1. María (Analista Financiero)
   Permisos: Lectura + Cargar y guardar
   • Ingresa presupuesto de RH 2025
   • Guarda cambios
   • Estado: SIN CARGAR → CARGADO

2. Juan (Supervisor)
   Permisos: Lectura + Revisar
   • Revisa datos ingresados por María
   • Valida consistencia
   • Marca como "Revisado"
   • Estado: CARGADO → REVISADO

3. Directora (Karla)
   Permisos: Lectura + Aprobar
   • Revisa presupuesto revisado
   • Da aprobación final
   • Estado: REVISADO → APROBADO

NOTIFICACIONES AUTOMÁTICAS:
  • Cambio de estado → notificación a usuarios con permisos
  • Comentarios en celdas → notificación al responsable
  • Rechazos → notificación al creador

AUDITORÍA:
  • presupuestos_estado_historial
  • Registro de todos los cambios de estado
  • Usuario que realizó el cambio
  • Timestamp preciso

API ENDPOINTS:
  POST /api/presupuestos/estado
    { empresaId, modulo, anio, capitulo, estado }
  
  GET /api/presupuestos/estado/:empresaId/:modulo/:anio
    → Estado actual del presupuesto
  
  GET /api/presupuestos/historial/:empresaId/:modulo/:anio
    → Auditoría completa de cambios
"@

Add-TextBox -Slide $slide17 -Left 50 -Top 120 -Width 920 -Height 420 -Text $flujos -FontSize 13

# ==========================================
# SLIDE 18: SISTEMA DE BACKUPS
# ==========================================
$slide18 = Add-Slide -Presentation $presentation -LayoutType 11
$slide18.Shapes[1].TextFrame.TextRange.Text = "Sistema de Backups Automático"
$slide18.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide18.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$backups = @"
Protección de Datos (src/services/backupService.js)

CARACTERÍSTICAS:

1. BACKUP AUTOMÁTICO
   • Intervalo configurable (por defecto: 60 minutos)
   • Se ejecuta en background
   • No interrumpe operaciones

2. RETENCIÓN
   • Máximo de backups configurables (por defecto: 24)
   • Auto-eliminación de backups antiguos
   • FIFO (First In, First Out)

3. FORMATO
   Nombre: panel.sqlite.bak_YYYYMMDD_HHMMSS
   Ejemplo: panel.sqlite.bak_20260209_143022
   
   Ubicación:
   • Por defecto: ./datos/backups/
   • Configurable via BACKUP_PATH

4. TRIGGERS
   • Inicio de aplicación
   • Cada intervalo configurado
   • Antes de operaciones críticas (opcional)
   • Manual vía API

CONFIGURACIÓN (.env):

BACKUP_ENABLED=true
BACKUP_INTERVAL_MINUTES=60
BACKUP_MAX_BACKUPS=24
BACKUP_PATH=./datos/backups

CÓDIGO PRINCIPAL:

class BackupService {
  initialize(config) {
    this.enabled = config.enabled
    this.intervalMs = config.intervalMinutes * 60 * 1000
    this.maxBackups = config.maxBackups
  }
  
  start() {
    if (!this.enabled) return
    
    // Backup inicial
    this.crearBackup()
    
    // Programar backups periódicos
    this.intervalId = setInterval(() => {
      this.crearBackup()
    }, this.intervalMs)
  }
  
  crearBackup() {
    const timestamp = formatDate(new Date(), 'yyyyMMdd_HHmmss')
    const backupFile = `panel.sqlite.bak_${timestamp}`
    
    fs.copyFileSync(
      './datos/panel.sqlite',
      `./datos/backups/${backupFile}`
    )
    
    this.limpiarBackupsAntiguos()
  }
  
  limpiarBackupsAntiguos() {
    const backups = fs.readdirSync('./datos/backups/')
      .filter(f => f.startsWith('panel.sqlite.bak_'))
      .sort()
    
    while (backups.length > this.maxBackups) {
      const oldest = backups.shift()
      fs.unlinkSync(`./datos/backups/${oldest}`)
    }
  }
}

API ENDPOINTS:
  POST /api/backups/crear
    → Crear backup manual
  
  GET /api/backups/lista
    → Listar backups disponibles
  
  POST /api/backups/restaurar/:filename
    → Restaurar desde backup específico
"@

Add-TextBox -Slide $slide18 -Left 50 -Top 120 -Width 920 -Height 420 -Text $backups -FontSize 12

# ==========================================
# SLIDE 19: SISTEMA DE ACTUALIZACIÓN AUTOMÁTICA
# ==========================================
$slide19 = Add-Slide -Presentation $presentation -LayoutType 11
$slide19.Shapes[1].TextFrame.TextRange.Text = "Sistema de Actualización Automática"
$slide19.Shapes[1].TextFrame.TextRange.Font.Size = 38
$slide19.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$actualizacion = @"
Auto-Updater con Electron (main.js)

FLUJO DE ACTUALIZACIÓN:

Usuario abre app
    │
    ▼ (5 segundos después)
┌────────────────────────────────┐
│ autoUpdater.checkForUpdates()  │
│ Verifica GitHub Releases       │
└────────┬───────────────────────┘
         │
    ¿Nueva versión?
         │
    ┌────┴────┐
   NO         SÍ
    │          │
    │          ▼
    │    ┌──────────────────────────┐
    │    │ Diálogo: "Nueva versión  │
    │    │ X.Y.Z disponible"        │
    │    │ [Descargar] [Más tarde]  │
    │    └──────┬───────────────────┘
    │           │
    │      Usuario acepta
    │           │
    │           ▼
    │    autoUpdater.downloadUpdate()
    │    Descarga en background
    │           │
    │           ▼
    │    ┌──────────────────────────┐
    │    │ Progreso en título       │
    │    │ "Descargando: 45%"       │
    │    └──────┬───────────────────┘
    │           │
    │      Descarga completa
    │           │
    │           ▼
    │    ┌──────────────────────────┐
    │    │ Diálogo: "¿Reiniciar     │
    │    │ para instalar?"          │
    │    │ [Reiniciar] [Más tarde]  │
    │    └──────┬───────────────────┘
    │           │
    │      Usuario acepta
    │           │
    │           ▼
    │    autoUpdater.quitAndInstall()
    │    Cierra → Instala → Reinicia
    │           │
    └───────────▼
         App continúa

CONFIGURACIÓN:

autoUpdater.autoDownload = false
  • No descargar automáticamente
  • Pedir permiso al usuario

autoUpdater.autoInstallOnAppQuit = true
  • Instalar al cerrar si hay update pendiente

EVENTOS:

'checking-for-update'
  → Log: "Verificando actualizaciones..."

'update-available' (info)
  → Diálogo pregunta si descargar

'update-not-available' (info)
  → Log: "App actualizada"

'download-progress' (progressObj)
  → Actualizar título: "Descargando: X%"

'update-downloaded' (info)
  → Diálogo pregunta si instalar

'error' (err)
  → Mostrar error al usuario

REQUISITOS:
  ✓ GitHub Release con archivos:
    - SummaCham Setup X.Y.Z.exe (instalador)
    - SummaCham X.Y.Z.exe (portable)
    - latest.yml (metadata, OBLIGATORIO)
  
  ✓ Release público o token configurado
  
  ✓ Solo funciona en app empaquetada
    (no en npm start)

VENTAJAS:
  • Actualizaciones sin reinstalar
  • Datos del usuario preservados
  • Sin downtime significativo
  • Control total del usuario
"@

Add-TextBox -Slide $slide19 -Left 50 -Top 120 -Width 920 -Height 420 -Text $actualizacion -FontSize 11

# ==========================================
# SLIDE 20: SEGURIDAD - MEDIDAS IMPLEMENTADAS
# ==========================================
$slide20 = Add-Slide -Presentation $presentation -LayoutType 11
$slide20.Shapes[1].TextFrame.TextRange.Text = "Seguridad: Medidas Implementadas"
$slide20.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide20.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$seguridad = @"
Protecciones de Seguridad Multicapa

1. GESTIÓN DE SECRETOS
   ✓ Variables de entorno para secrets
   ✓ Generación automática de JWT_SECRET y SESSION_SECRET
   ✓ .env excluido de Git (.gitignore)
   ✓ Validación en startup

2. AUTENTICACIÓN
   ✓ Bcrypt para hashing de contraseñas (saltRounds=10)
   ✓ JWT con expiración (1h access, 7d refresh)
   ✓ Rate limiting (10 intentos/10min, bloqueo 5min)
   ✓ Sesiones con SQLite store persistente

3. AUTORIZACIÓN
   ✓ Middleware requireAuth en todas las rutas protegidas
   ✓ Permisos granulares (empresa + módulo + acción)
   ✓ Validación en backend (nunca confiar en frontend)
   ✓ Admin global con bypass controlado

4. HELMET (Seguridad HTTP)
   ✓ X-Content-Type-Options: nosniff
   ✓ X-Frame-Options: DENY
   ✓ Strict-Transport-Security (HSTS)
   ✓ Content-Security-Policy (CSP)
   ✓ X-XSS-Protection

5. CORS (Cross-Origin Resource Sharing)
   ✓ Lista blanca de orígenes permitidos
   ✓ Credentials habilitados solo para orígenes confiables
   ✓ Validación de headers Origin

6. VALIDACIÓN DE INPUTS
   ✓ Joi para validación de esquemas
   ✓ Sanitización de datos
   ✓ Prevención de inyecciones SQL (queries parametrizadas)
   ✓ Validación de tipos de datos

7. FIREBIRD SEGURO
   ✓ Credenciales en archivo separado
   ✓ Validación de permisos antes de query
   ✓ Connection timeout
   ✓ Queries parametrizadas (no string concatenation)

8. LOGGING Y AUDITORÍA
   ✓ Registro de intentos de login
   ✓ Auditoría de cambios de estado
   ✓ Bitácora de modificaciones a layouts
   ✓ Logs de queries lentas

9. COOKIE SECURITY
   ✓ httpOnly (no accesible desde JS)
   ✓ secure (solo HTTPS en producción)
   ✓ sameSite: 'none' (para túneles HTTPS)
   ✓ Expiración configurada

10. PROTECCIÓN DE DATOS
    ✓ Backups automáticos
    ✓ Datos sensibles nunca en logs
    ✓ Encriptación de contraseñas en reposo
    ✓ Sesiones con expiración

HERRAMIENTAS:
• bcryptjs, jsonwebtoken, helmet, joi
• express-session con SQLite store
• better-sqlite3 (prepared statements)
• node-firebird (parametrización)
"@

Add-TextBox -Slide $slide20 -Left 50 -Top 120 -Width 920 -Height 420 -Text $seguridad -FontSize 12

# ==========================================
# SLIDE 21: MÓDULOS DEL SISTEMA
# ==========================================
$slide21 = Add-Slide -Presentation $presentation -LayoutType 11
$slide21.Shapes[1].TextFrame.TextRange.Text = "Módulos del Sistema"
$slide21.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide21.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$modulos = @"
Módulos Financieros Disponibles

MÓDULOS OPERATIVOS:

1. RH (Recursos Humanos)
   • Presupuesto de nómina
   • Salarios, bonos, prestaciones
   • Vista: RH.html

2. FINANZAS
   • Ingresos y gastos financieros
   • Inversiones, intereses
   • Vista: Finanzas.html

3. GASTOS GENERALES
   • Gastos administrativos
   • Servicios, suministros
   • Vista: GastosGenerales.html

4. NÓMINA
   • Detalle de nómina por empleado
   • Vista: Nomina.html

5. VPE (Vicepresidencia Ejecutiva)
   • Gastos de dirección
   • Vista: VPE.html

6. T&IC (Tecnología e Innovación)
   • Presupuesto de TI
   • Vista: T&IC.html

7. EVENTOS
   • Ingresos y gastos de eventos
   • Vista: Eventos.html

8. MEMBRESÍA
   • Ingresos por membresías
   • Vista: Membresía.html

9. SERVICIOS MEMBRESÍA
   • Servicios adicionales a miembros
   • Vista: Serv_Membresía.html

MÓDULOS CONSOLIDADOS:

10. RESUMEN
    • Consolidado de todos los módulos
    • Operaciones automáticas
    • Vista: RESUMEN.html

11. SUMMARY
    • Resumen ejecutivo en inglés
    • Reportes gerenciales
    • Vista: RESUMEN.html (mismo)

12. PRESUPUESTOS
    • Gestión centralizada de presupuestos
    • Estados y aprobaciones
    • Vista: Presupuestos.html

CARACTERÍSTICAS POR MÓDULO:
  ✓ Permisos independientes
  ✓ Estados de aprobación
  ✓ Historiales de cambios
  ✓ Comentarios en celdas
  ✓ Guardado automático (borradores)
  ✓ Exportación a Excel
  ✓ Validación de datos

ESTRUCTURA DE DATOS:
  Cada módulo tiene:
  • Cuentas contables (layout_cuentas)
  • Operaciones (layout_operaciones)
  • Estado (presupuestos_estado)
  • Borradores (PLAN_BORRADORES)
  • Comentarios (comentarios_celdas)
"@

Add-TextBox -Slide $slide21 -Left 50 -Top 120 -Width 920 -Height 420 -Text $modulos -FontSize 14

# ==========================================
# SLIDE 22: TECNOLOGÍAS DE DESARROLLO
# ==========================================
$slide22 = Add-Slide -Presentation $presentation -LayoutType 11
$slide22.Shapes[1].TextFrame.TextRange.Text = "Tecnologías de Desarrollo"
$slide22.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide22.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$tecnologias = @"
Herramientas y Librerías Utilizadas

DESARROLLO:
  • Node.js 18+ (Runtime)
  • npm (Gestor de paquetes)
  • cross-env (Variables de entorno multiplataforma)
  • electron-rebuild (Recompilación de módulos nativos)

FRONTEND FRAMEWORKS:
  • Bootstrap 5.3.0 (CSS Framework)
  • Font Awesome 6.4.0 (Iconos)
  • Chart.js 4.3.0 (Gráficas)
  • DataTables 1.13.4 (Tablas interactivas)
  • Sweet Alert 2 4.0.19 (Notificaciones)
  • Moment.js 2.29.4 (Fechas)

BACKEND FRAMEWORKS:
  • Express.js 4.18.2 (Servidor web)
  • Helmet 7.0.0 (Seguridad HTTP)
  • CORS 2.8.5 (Cross-Origin Resource Sharing)
  • Cookie Parser 1.4.6 (Manejo de cookies)
  • Express Session 1.17.3 (Sesiones)
  • Better-SQLite3 Session Store 0.1.0

AUTENTICACIÓN Y SEGURIDAD:
  • jsonwebtoken 9.0.2 (JWT)
  • bcryptjs 2.4.3 (Hashing)
  • Joi 17.9.2 (Validación)

BASES DE DATOS:
  • better-sqlite3 8.5.0 (SQLite)
  • node-firebird 1.1.8 (Firebird)

ELECTRON:
  • electron 39.2.7 (Framework desktop)
  • electron-builder 25.1.8 (Empaquetado)
  • electron-updater (Auto-updates)
  • auto-launch 5.0.5 (Inicio automático)

UTILIDADES:
  • esbuild 0.27.1 (Bundler opcional)
  • dotenv (Variables de entorno)

BUILD Y DEPLOYMENT:
  • electron-builder (Empaquetado)
  • GitHub Releases (Distribución)
  • NSIS (Instalador Windows)
  • Portable build (Sin instalación)

TESTING:
  • Node.js built-in test runner
  • Scripts de validación personalizados

CONTROL DE VERSIONES:
  • Git + GitHub
  • Semantic Versioning (X.Y.Z)
  • Changelog automatizado
"@

Add-TextBox -Slide $slide22 -Left 50 -Top 120 -Width 920 -Height 420 -Text $tecnologias -FontSize 14

# ==========================================
# SLIDE 23: ESTRUCTURA DE DIRECTORIOS
# ==========================================
$slide23 = Add-Slide -Presentation $presentation -LayoutType 11
$slide23.Shapes[1].TextFrame.TextRange.Text = "Estructura de Directorios"
$slide23.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide23.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$estructura = @"
Organización del Proyecto

SummaCham/
├── main.js                    # Punto de entrada Electron
├── package.json               # Configuración npm
├── .env                       # Variables de entorno (no en Git)
│
├── src/                       # Código fuente backend
│   ├── server.js              # Servidor Express
│   ├── db/                    # Capa de base de datos
│   │   ├── sqlite.js          # SQLite connection + schemas
│   │   └── nedb.js            # Legacy (no usado)
│   ├── middleware/            # Middleware de Express
│   │   └── auth.js            # Autenticación y autorización
│   ├── routes/                # Controladores (endpoints)
│   │   ├── auth.js            # Login, logout, refresh
│   │   ├── usuarios.js        # CRUD usuarios
│   │   ├── empresas.js        # Gestión empresas
│   │   ├── presupuestos.js    # Presupuestos
│   │   ├── layouts.js         # Layouts/plantillas
│   │   ├── reportes.js        # Generación reportes
│   │   ├── insercion.js       # Inserción de datos
│   │   ├── borradores.js      # Guardado automático
│   │   └── ...                # Otros módulos
│   ├── services/              # Lógica de negocio
│   │   ├── firebirdService.js # Integración Firebird
│   │   ├── permisosService.js # Gestión permisos
│   │   ├── layoutService.js   # Operaciones layouts
│   │   ├── backupService.js   # Backups automáticos
│   │   └── ...
│   ├── config/                # Configuración
│   │   ├── modulos.js         # Definición módulos
│   │   ├── empresas.js        # Definición empresas
│   │   └── seed_users.json    # Usuarios iniciales
│   └── utils/                 # Utilidades
│
├── vistas/                    # Frontend (HTML)
│   ├── login.html
│   ├── usuarios.html
│   ├── presupuestos.html
│   ├── RESUMEN.html
│   ├── Graficas-Mejoradas.html
│   └── ...
│
├── datos/                     # Datos persistentes
│   ├── panel.sqlite           # Base de datos principal
│   ├── firebird-connections.json # Config Firebird
│   └── backups/               # Backups automáticos
│
├── scripts/                   # Scripts de utilidad
│   ├── prepublish.js          # Pre-publicación
│   ├── manage-native.js       # Módulos nativos
│   └── ...
│
├── icono/                     # Iconos de la aplicación
├── image/                     # Imágenes y assets
├── docs/                      # Documentación consolidada
├── tests/                     # Tests automatizados
├── native_modules/            # Módulos nativos compilados
└── dist/                      # Build final (generado)
"@

Add-TextBox -Slide $slide23 -Left 50 -Top 120 -Width 920 -Height 420 -Text $estructura -FontSize 13

# ==========================================
# SLIDE 24: DEPLOYMENT Y DISTRIBUCIÓN
# ==========================================
$slide24 = Add-Slide -Presentation $presentation -LayoutType 11
$slide24.Shapes[1].TextFrame.TextRange.Text = "Deployment y Distribución"
$slide24.Shapes[1].TextFrame.TextRange.Font.Size = 40
$slide24.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$deployment = @"
Proceso de Compilación y Distribución

1. PREPARACIÓN

   npm install                    # Instalar dependencias
   npm run rebuild-native-electron # Recompilar módulos nativos

2. BUILD

   npm run dist                   # Crear instalador NSIS
   npm run build:portable         # Crear versión portable
   npm run build:all              # Ambos formatos

   Salida en ./dist/:
   • SummaCham Setup 4.1.0.exe         (Instalador)
   • SummaCham 4.1.0.exe               (Portable)
   • latest.yml                         (Metadata)

3. PUBLICACIÓN EN GITHUB

   git tag -a v4.1.0 -m "Release 4.1.0"
   git push origin v4.1.0
   
   Crear Release en GitHub:
   • Subir archivos de ./dist/
   • latest.yml (OBLIGATORIO)
   • Release notes

4. AUTO-UPDATE

   Los usuarios existentes recibirán notificación:
   "Nueva versión 4.1.0 disponible"
   → Descarga → Instalación automática

ELECTRON-BUILDER CONFIGURACIÓN:

build: {
  appId: "com.summa.cham.panelamcham",
  productName: "PanelAMCHAM",
  
  asar: true,                    # Empaquetar código
  asarUnpack: [                  # Excepciones
    "node_modules/better-sqlite3/**/*",
    "node_modules/node-firebird/**/*",
    "native_modules/**/*"
  ],
  
  compression: "maximum",        # Máxima compresión
  
  publish: [{
    provider: "github",
    owner: "IustusRenidet",
    repo: "SummaCham"
  }],
  
  win: {
    target: ["nsis", "portable"],
    icon: "icono/icono.ico"
  }
}

MODOS DE DISTRIBUCIÓN:

1. INSTALADOR (NSIS)
   • Requiere privilegios de administrador
   • Instalación en Program Files
   • Shortcuts en Desktop y Start Menu
   • Desinstalador incluido

2. PORTABLE
   • No requiere instalación
   • Ejecutable único
   • Datos en carpeta local
   • Ideal para USB

VENTAJAS:
  ✓ Actualizaciones automáticas
  ✓ Firma digital (opcional)
  ✓ Instalación silenciosa
  ✓ Multi-arquitectura (x64 + ia32)
"@

Add-TextBox -Slide $slide24 -Left 50 -Top 120 -Width 920 -Height 420 -Text $deployment -FontSize 12

# ==========================================
# SLIDE 25: CONCLUSIONES Y MEJORES PRÁCTICAS
# ==========================================
$slide25 = Add-Slide -Presentation $presentation -LayoutType 11
$slide25.Shapes[1].TextFrame.TextRange.Text = "Conclusiones y Mejores Prácticas"
$slide25.Shapes[1].TextFrame.TextRange.Font.Size = 38
$slide25.Shapes[1].TextFrame.TextRange.Font.Bold = $true

$conclusiones = @"
Resumen Técnico del Sistema

FORTALEZAS ARQUITECTÓNICAS:

✓ Arquitectura en capas bien definida
  Separación de responsabilidades (MVC + Services)

✓ Sistema de permisos granular robusto
  Multi-nivel: usuario → empresa → módulo → acción

✓ Seguridad multicapa
  Autenticación, autorización, validación, auditoría

✓ Integración dual de bases de datos
  SQLite (local) + Firebird (externa contable)

✓ Auto-actualización sin downtime
  Usuarios siempre en última versión

✓ Sistema de backups automático
  Protección de datos sin intervención

✓ Algoritmos de cálculo avanzados
  Operaciones consolidadas auto-construidas

✓ Multi-usuario real
  Sesiones independientes, trabajo colaborativo

MEJORES PRÁCTICAS IMPLEMENTADAS:

• Validación de inputs (Joi)
• Prepared statements (SQL injection prevention)
• Rate limiting (brute force protection)
• Bcrypt para contraseñas (nunca texto plano)
• JWT con expiración y refresh tokens
• Auditoría completa de acciones
• Logging estructurado
• Código modular y mantenible
• Separación de configuración (env vars)
• Versionado semántico

ESCALABILIDAD:

• Agregar nuevos módulos: crear ruta + vista
• Nuevas operaciones: sistema auto-construccion
• Nuevas empresas: configuración en empresas.js
• Nuevos usuarios: CRUD completo disponible

MANTENIBILIDAD:

• Documentación consolidada exhaustiva
• Código comentado en puntos críticos
• Estructura de directorios lógica
• Tests automatizables
• Scripts de utilidad

ÁREAS DE MEJORA FUTURAS:

• Migrar sesiones a Redis (producción distribuida)
• Implementar WebSockets (notificaciones real-time)
• Tests unitarios completos
• CI/CD pipeline (GitHub Actions)
• Logging centralizado (ELK stack)
• Métricas y monitoring (Prometheus/Grafana)
"@

Add-TextBox -Slide $slide25 -Left 50 -Top 120 -Width 920 -Height 420 -Text $conclusiones -FontSize 12

# ==========================================
# SLIDE 26: CIERRE
# ==========================================
$slide26 = Add-Slide -Presentation $presentation -LayoutType 11
$slide26.Shapes[1].TextFrame.TextRange.Text = "SummaCham - PanelAMCHAM"
$slide26.Shapes[1].TextFrame.TextRange.Font.Size = 48
$slide26.Shapes[1].TextFrame.TextRange.Font.Bold = $true
$slide26.Shapes[1].TextFrame.TextRange.Font.Color.RGB = $ColorPrimary

Add-TextBox -Slide $slide26 -Left 150 -Top 230 -Width 700 -Height 60 -Text "Gracias por su atención" -FontSize 36 -Bold $true
Add-TextBox -Slide $slide26 -Left 150 -Top 310 -Width 700 -Height 40 -Text "Sistema robusto, seguro y escalable" -FontSize 24
Add-TextBox -Slide $slide26 -Left 150 -Top 370 -Width 700 -Height 100 -Text "Versión 4.1.0 - Febrero 2026`nDesarrollado por: Iustus Renidet & J02V4N" -FontSize 18

# Guardar presentación
try {
    $fullPath = [System.IO.Path]::GetFullPath($OutputPath)
    $presentation.SaveAs($fullPath)
    Write-Host "✅ Presentación guardada exitosamente en:" -ForegroundColor Green
    Write-Host "   $fullPath" -ForegroundColor Cyan
    
    # Cerrar PowerPoint
    $presentation.Close()
    $powerpoint.Quit()
    
    # Liberar objetos COM
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($presentation) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($powerpoint) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    
    Write-Host "`n🎉 ¡Presentación técnica creada con éxito!" -ForegroundColor Green
    Write-Host "   26 slides con documentación completa del sistema" -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ Error al guardar: $_" -ForegroundColor Red
    exit 1
}
