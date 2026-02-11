# Script PowerShell para crear presentación simplificada y unificada
# SummaCham - Explicación técnica para público no técnico
# Con ejemplos reales de APIs y rutas completas

Write-Host "🎯 Creando presentación simplificada y unificada..." -ForegroundColor Cyan

try {
    $powerpoint = New-Object -ComObject PowerPoint.Application
    Write-Host "✅ PowerPoint iniciado" -ForegroundColor Green
} catch {
    Write-Host "❌ PowerPoint no disponible" -ForegroundColor Red
    exit 1
}

$presentation = $powerpoint.Presentations.Add()
$presentation.PageSetup.SlideWidth = 720
$presentation.PageSetup.SlideHeight = 540

# ============================================================================
# FUNCIÓN: Agregar slide simple
# ============================================================================
function Add-SimpleSlide {
    param(
        [string]$Titulo,
        [string]$Contenido,
        [int]$TamanoContenido = 16
    )
    
    $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 12)
    
    # Título
    $titleBox = $slide.Shapes.AddTextBox(1, 30, 20, 660, 50)
    $titleBox.TextFrame.TextRange.Text = $Titulo
    $titleBox.TextFrame.TextRange.Font.Name = "Segoe UI"
    $titleBox.TextFrame.TextRange.Font.Size = 32
    $titleBox.TextFrame.TextRange.Font.Bold = 1
    $titleBox.TextFrame.TextRange.Font.Color.RGB = 255 + (87 * 256) + (34 * 65536)
    $titleBox.Fill.Visible = 0
    $titleBox.Line.Visible = 0
    
    # Contenido
    $contentBox = $slide.Shapes.AddTextBox(1, 40, 90, 640, 430)
    $contentBox.TextFrame.TextRange.Text = $Contenido
    $contentBox.TextFrame.TextRange.Font.Name = "Segoe UI"
    $contentBox.TextFrame.TextRange.Font.Size = $TamanoContenido
    $contentBox.TextFrame.WordWrap = 1
    $contentBox.Fill.Visible = 0
    $contentBox.Line.Visible = 0
    
    return $slide
}

# ============================================================================
# PORTADA
# ============================================================================
$slidePortada = $presentation.Slides.Add(1, 11)
$slidePortada.Shapes.Title.TextFrame.TextRange.Text = "SummaCham`nGuía Técnica Simplificada"
$slidePortada.Shapes.Title.TextFrame.TextRange.Font.Size = 44
$slidePortada.Shapes.Title.TextFrame.TextRange.Font.Bold = 1
$slidePortada.Shapes.Title.TextFrame.TextRange.Font.Color.RGB = 255 + (87 * 256) + (34 * 65536)

$subtituloBox = $slidePortada.Shapes.AddTextBox(1, 100, 280, 520, 180)
$subtituloBox.TextFrame.TextRange.Text = "Sistema de Gestión Presupuestaria`n`nExplicación técnica clara para todos`n`nCon ejemplos reales del sistema"
$subtituloBox.TextFrame.TextRange.Font.Size = 20
$subtituloBox.TextFrame.TextRange.Font.Name = "Segoe UI"
$subtituloBox.TextFrame.TextRange.ParagraphFormat.Alignment = 2
$subtituloBox.Fill.Visible = 0
$subtituloBox.Line.Visible = 0

# ============================================================================
# SLIDE 1: ¿QUÉ ES SUMMACHAM?
# ============================================================================
Add-SimpleSlide -Titulo "¿Qué es SummaCham?" -Contenido @"
SummaCham es como un **Excel inteligente** que ayuda a:

🏢  Gestionar presupuestos de varias empresas
📊  Ver información financiera en tiempo real
👥  Controlar quién puede ver o modificar datos
📈  Generar reportes automáticos
💾  Guardar cambios de forma segura


**Analogía:**
Imagina una oficina donde cada empresa tiene su archivero.
SummaCham es el sistema que organiza todos esos archiveros,
controla quién puede abrir cada cajón, y mantiene todo ordenado.
"@

# ============================================================================
# SLIDE 2: CONCEPTOS BÁSICOS
# ============================================================================
Add-SimpleSlide -Titulo "Conceptos Básicos" -Contenido @"
**API (Interfaz de Programación)**
Como un menú de restaurante: lista de acciones disponibles

**Ruta (URL)**
La dirección para hacer algo específico
Ejemplo: /api/empresas/empresa1


**Base de Datos**
Un archivero digital organizado en tablas
Guarda usuarios, presupuestos, permisos, etc.


**Servidor**
La computadora que responde a las peticiones
Está siempre escuchando en el puerto 3005
"@

# ============================================================================
# SLIDE 3: ARQUITECTURA GENERAL
# ============================================================================
Add-SimpleSlide -Titulo "¿Cómo Funciona el Sistema?" -Contenido @"
El sistema tiene 3 partes principales:


**1. INTERFAZ (Lo que ve el usuario)**
   • Ventanas, botones, tablas
   • Se comunica con el servidor


**2. SERVIDOR (El cerebro)**
   • Puerto: http://localhost:3005
   • Recibe peticiones y responde
   • Ubicación: src/server.js


**3. BASE DE DATOS (El archivero)**
   • Archivo: datos/panel.sqlite
   • Guarda toda la información de forma permanente
"@

# ============================================================================
# SLIDE 4: FLUJO DE UNA PETICIÓN
# ============================================================================
Add-SimpleSlide -Titulo "Flujo: Cómo se procesa una petición" -Contenido @"
**Ejemplo:** Usuario quiere ver empresas disponibles


1️⃣  Usuario hace clic en "Ver Empresas"

2️⃣  Interfaz envía petición:
    GET http://localhost:3005/api/empresas

3️⃣  Servidor recibe petición:
    • Verifica que el usuario está autenticado
    • Revisa qué empresas puede ver el usuario

4️⃣  Servidor responde con datos:
    { "empresas": ["empresa1", "empresa2"] }

5️⃣  Interfaz muestra las empresas en pantalla
"@

# ============================================================================
# SLIDE 5: EMPRESAS - API REAL
# ============================================================================
Add-SimpleSlide -Titulo "API: Empresas" -Contenido @"
**Obtener todas las empresas**

📍 Ruta:  GET /api/empresas

📁 Archivo:  src/routes/empresas.js

📋 Ejemplo de respuesta:
{
  "empresas": [
    { "id": "empresa1", "nombre": "CDMX", "etiqueta": "Ciudad de México" },
    { "id": "empresa2", "nombre": "Morelos", "etiqueta": "Estado de Morelos" },
    { "id": "empresa3", "nombre": "Guadalajara", "etiqueta": "Jalisco" }
  ]
}

✅ Nota: Solo muestra empresas que el usuario tiene permiso de ver
"@

# ============================================================================
# SLIDE 6: EMPRESAS - DETALLES
# ============================================================================
Add-SimpleSlide -Titulo "API: Detalle de Empresa" -Contenido @"
**Obtener información de una empresa específica**

📍 Ruta:  GET /api/empresas/:id

🔧 Ejemplo real:  GET /api/empresas/empresa1

📁 Archivo:  src/routes/empresas.js (línea 21)


📋 Respuesta:
{
  "empresa": {
    "id": "empresa1",
    "nombre": "CDMX",
    "etiqueta": "Ciudad de México",
    "config": { ... configuración Firebird ... }
  }
}

🔒 Seguridad: Solo si el usuario tiene permiso para empresa1
"@

# ============================================================================
# SLIDE 7: PRESUPUESTOS - CONSULTAR
# ============================================================================
Add-SimpleSlide -Titulo "API: Consultar Presupuestos" -Contenido @"
**Obtener presupuestos de una empresa y año**

📍 Ruta:  GET /api/presupuestos

🔧 Parámetros:
   • empresaId = empresa1
   • anio = 2025

📝 Ejemplo completo:
   GET /api/presupuestos?empresaId=empresa1&anio=2025

📁 Archivo:  src/routes/presupuestos.js (línea 232)


📋 Respuesta incluye:
   • Lista de cuentas con presupuestos
   • Montos por periodo (enero-diciembre)
   • Estado actual (EDITANDO, APROBADO, etc.)
"@

# ============================================================================
# SLIDE 8: PRESUPUESTOS - ESTADOS
# ============================================================================
Add-SimpleSlide -Titulo "Estados de Presupuestos" -Contenido @"
Un presupuesto puede estar en diferentes estados:


**SIN_CARGAR**  →  No se ha cargado aún
**EDITANDO**    →  Se está modificando
**REVISADO**    →  Ya fue revisado por supervisor
**APROBADO**    →  Autorizado y guardado


**API para ver estado:**
📍 GET /api/presupuestos/estado
   ?empresaId=empresa1&modulo=CUENTAS&anio=2025

📁 Archivo: src/routes/presupuestos.js (línea 313)


**API para cambiar estado:**
📍 POST /api/presupuestos/estado
📁 Archivo: src/routes/presupuestos.js (línea 337)
"@

# ============================================================================
# SLIDE 9: SALDOS - API
# ============================================================================
Add-SimpleSlide -Titulo "API: Saldos (Datos Reales)" -Contenido @"
**Obtener saldos reales desde Firebird**

📍 Ruta:  GET /api/saldos

🔧 Parámetros requeridos:
   • empresaId = empresa1
   • anio = 2024
   • cuentas = 1101010000000000000001 (21 dígitos)

📝 Ejemplo:
   GET /api/saldos?empresaId=empresa1&anio=2024
       &cuentas=1101010000000000000001,1102010000000000000001

📁 Archivo:  src/routes/saldos.js (línea 25)


📋 Respuesta:
   • Saldos mensuales (enero-diciembre)
   • Totales anuales por cuenta
"@

# ============================================================================
# SLIDE 10: LAYOUTS (PLANTILLAS)
# ============================================================================
Add-SimpleSlide -Titulo "API: Layouts (Plantillas)" -Contenido @"
**Los layouts son plantillas de configuración**
Define qué cuentas aparecen, fórmulas, orden, etc.


**Obtener layout:**
📍 GET /api/layouts
   ?empresaId=empresa1&modulo=SUMMARY&anio=2025

📁 Archivo: src/routes/layouts.js (línea 16)


**Guardar layout:**
📍 POST /api/layouts
📁 Archivo: src/routes/layouts.js (línea 29)

Body: {
  "empresaId": "empresa1",
  "modulo": "SUMMARY",
  "anio": 2025,
  "datos": { ... configuración completa ... }
}
"@

# ============================================================================
# SLIDE 11: LAYOUTS POR AÑO
# ============================================================================
Add-SimpleSlide -Titulo "API: Layouts Avanzados" -Contenido @"
**Sistema de layouts por año y capítulo**

📍 Ruta base:  /api/layoutsporanio


**Ejemplos reales:**

1️⃣  Obtener años disponibles:
    GET /api/layoutsporanio/SUMMARY/anios?empresaId=empresa1

2️⃣  Obtener capítulos de un año:
    GET /api/layoutsporanio/SUMMARY/2025/capitulos?empresaId=empresa1

3️⃣  Obtener datos de un capítulo:
    GET /api/layoutsporanio/SUMMARY/2025/1000?empresaId=empresa1

📁 Archivo: src/routes/layoutRoutes.js
"@

# ============================================================================
# SLIDE 12: USUARIOS Y AUTENTICACIÓN
# ============================================================================
Add-SimpleSlide -Titulo "API: Usuarios" -Contenido @"
**Sistema de usuarios y permisos**


**Login (Iniciar sesión):**
📍 POST /api/auth/login
📁 Archivo: src/routes/auth.js

Body: {
  "username": "Iconet",
  "password": "tu-contraseña"
}


**Logout (Cerrar sesión):**
📍 POST /api/auth/logout


**Ver mi perfil:**
📍 GET /api/perfil
📁 Archivo: src/routes/perfil.js
"@

# ============================================================================
# SLIDE 13: GESTIÓN DE USUARIOS
# ============================================================================
Add-SimpleSlide -Titulo "API: Gestión de Usuarios" -Contenido @"
**Operaciones CRUD de usuarios**
(Crear, Leer, Actualizar, Eliminar)


**Ver todos los usuarios:**
📍 GET /api/usuarios
📁 Archivo: src/routes/usuarios.js (línea 278)


**Ver un usuario específico:**
📍 GET /api/usuarios/5
(donde 5 es el ID del usuario)


**Crear usuario:**
📍 POST /api/usuarios
📁 Archivo: src/routes/usuarios.js (línea 349)


**Actualizar usuario:**
📍 PUT /api/usuarios/5
"@

# ============================================================================
# SLIDE 14: PERMISOS
# ============================================================================
Add-SimpleSlide -Titulo "Sistema de Permisos" -Contenido @"
**Cada usuario tiene permisos específicos**


**Estructura de permisos:**
empresa1 → CUENTAS → "Cargar y guardar"
empresa1 → SUMMARY → "Lectura"
empresa2 → RESUMEN → "Aprobar"


**Niveles de permiso:**
• **Lectura:**  Solo ver datos
• **Cargar y guardar:**  Modificar presupuestos
• **Revisar:**  Revisar presupuestos
• **Aprobar:**  Autorizar presupuestos


**Administradores:**  
Tienen todos los permisos en todas las empresas
"@

# ============================================================================
# SLIDE 15: REPORTES
# ============================================================================
Add-SimpleSlide -Titulo "API: Reportes" -Contenido @"
**Generar reportes automáticos**


**Reporte Summary:**
📍 GET /api/reportes/summary
   ?empresaId=empresa1&anio=2025
📁 Archivo: src/routes/reportes.js (línea 74)


**Reporte Resumen:**
📍 GET /api/reportes/resumen
   ?empresaId=empresa1&anio=2025
📁 Archivo: src/routes/reportes.js (línea 103)


**Diagnóstico Firebird:**
📍 GET /api/reportes/diagnostico-firebird
   ?empresaId=empresa1
📁 Archivo: src/routes/reportes.js (línea 138)
"@

# ============================================================================
# SLIDE 16: BASE DE DATOS - TABLAS PRINCIPALES
# ============================================================================
Add-SimpleSlide -Titulo "Base de Datos: Tablas Principales" -Contenido @"
**Archivo:**  datos/panel.sqlite


**Tablas más importantes:**

📊 **usuarios**
   Guarda información de cada usuario del sistema

🔒 **permisos**
   Define qué puede hacer cada usuario en cada empresa

📋 **presupuestos_estado**
   Estado actual de cada presupuesto (EDITANDO, APROBADO, etc.)

📝 **presupuestos_guardados**
   Historial de presupuestos guardados

🔔 **notificaciones**
   Alertas y mensajes para usuarios

📦 **layouts_guardados**
   Configuraciones de plantillas
"@

# ============================================================================
# SLIDE 17: TABLA USUARIOS
# ============================================================================
Add-SimpleSlide -Titulo "Tabla: usuarios" -Contenido @"
**Estructura:**

• id:  Número único de usuario
• username:  Nombre de usuario (ejemplo: "Iconet")
• password_hash:  Contraseña encriptada (no se guarda en texto plano)
• nombre_completo:  Nombre real del usuario
• es_admin:  1 si es administrador, 0 si no
• activo:  1 si puede entrar, 0 si está deshabilitado
• creado_en:  Fecha de creación
• actualizado_en:  Última modificación


**Ejemplo de registro:**
{
  "id": 1,
  "username": "Iconet",
  "nombre_completo": "Administrador Principal",
  "es_admin": 1,
  "activo": 1
}
"@

# ============================================================================
# SLIDE 18: TABLA PERMISOS
# ============================================================================
Add-SimpleSlide -Titulo "Tabla: permisos" -Contenido @"
**Relaciona usuarios con empresas y módulos**


**Estructura:**
• id:  Identificador único
• usuario_id:  ¿Quién? (FK a usuarios.id)
• empresa_id:  ¿Dónde? (empresa1, empresa2, etc.)
• modulo:  ¿Qué módulo? (CUENTAS, SUMMARY, RESUMEN, etc.)
• permiso:  ¿Qué puede hacer?


**Tipos de permiso:**
• "Lectura"
• "Cargar y guardar"
• "Revisar"
• "Aprobar"


**Ejemplo:**
Usuario 5 tiene permiso "Cargar y guardar" en empresa1, módulo CUENTAS
"@

# ============================================================================
# SLIDE 19: TABLA PRESUPUESTOS_ESTADO
# ============================================================================
Add-SimpleSlide -Titulo "Tabla: presupuestos_estado" -Contenido @"
**Controla el estado de cada presupuesto**


**Columnas importantes:**
• empresa_id:  empresa1, empresa2, empresa3
• modulo:  CUENTAS, SUMMARY, RESUMEN, etc.
• anio:  2024, 2025, 2026...
• estado:  SIN_CARGAR, EDITANDO, REVISADO, APROBADO
• usuario_id:  Quién hizo el último cambio
• actualizado_en:  Cuándo fue el último cambio


**Ejemplo real:**
empresa1 + CUENTAS + 2025 → estado: APROBADO


**Restricción:**
Solo puede haber UN estado por combinación empresa+modulo+anio
"@

# ============================================================================
# SLIDE 20: SEGURIDAD
# ============================================================================
Add-SimpleSlide -Titulo "Seguridad del Sistema" -Contenido @"
**Medidas de protección implementadas:**


🔐 **Autenticación obligatoria**
   Todas las APIs requieren estar logueado

🔒 **Contraseñas encriptadas**
   Nunca se guardan contraseñas en texto plano

🛡️ **Validación de permisos**
   Se verifica en cada petición si el usuario puede hacer la acción

🚫 **Prevención de SQL Injection**
   Uso de consultas preparadas

⏱️ **Sesiones con expiración**
   Las sesiones se invalidan después de inactividad

📝 **Registro de acciones**
   Se guarda quién hizo qué y cuándo
"@

# ============================================================================
# SLIDE 21: FLUJO COMPLETO - EJEMPLO REAL
# ============================================================================
Add-SimpleSlide -Titulo "Ejemplo Completo: Modificar Presupuesto" -Contenido @"
**Historia: Usuario Iconet quiere modificar presupuesto de CDMX 2025**


1️⃣  Iconet hace login
    POST /api/auth/login

2️⃣  Selecciona empresa CDMX (empresa1)
    GET /api/empresas/empresa1

3️⃣  Sistema verifica permisos
    ¿Iconet puede modificar CUENTAS en empresa1? → SÍ

4️⃣  Carga presupuesto actual
    GET /api/presupuestos?empresaId=empresa1&anio=2025

5️⃣  Iconet modifica valores
    [Edición en interfaz]

6️⃣  Guarda cambios
    POST /api/presupuestos/guardar

7️⃣  Sistema actualiza estado
    estado: EDITANDO → Tabla presupuestos_estado
"@

# ============================================================================
# SLIDE 22: CONEXIÓN FIREBIRD
# ============================================================================
Add-SimpleSlide -Titulo "Conexión con Firebird" -Contenido @"
**SummaCham obtiene datos reales desde Firebird**


**¿Qué es Firebird?**
Base de datos externa que tiene la información contable real
(saldos, movimientos, catálogo de cuentas)


**Flujo:**
1️⃣  Usuario pide saldos de empresa1
2️⃣  SummaCham lee configuración de conexión
3️⃣  Se conecta a Firebird de empresa1
4️⃣  Ejecuta query SQL
5️⃣  Procesa y formatea datos
6️⃣  Devuelve respuesta a usuario


**Archivo configuración:**
datos/firebird-connections.json
"@

# ============================================================================
# SLIDE 23: ESTRUCTURA DE ARCHIVOS
# ============================================================================
Add-SimpleSlide -Titulo "Estructura de Archivos" -Contenido @"
**Organización del código:**


📁 **src/**
   ├── server.js  →  Servidor principal
   ├── routes/  →  Rutas API (empresas, usuarios, presupuestos...)
   ├── services/  →  Lógica de negocio
   ├── db/  →  Conexión a SQLite
   └── middleware/  →  Verificación de permisos

📁 **datos/**
   ├── panel.sqlite  →  Base de datos
   └── firebird-connections.json  →  Configuración Firebird

📁 **vistas/**
   └── Archivos HTML de la interfaz

📁 **config/**
   └── Configuraciones del sistema
"@

# ============================================================================
# SLIDE 24: QUERIES SQL FRECUENTES
# ============================================================================
Add-SimpleSlide -Titulo "Queries SQL Más Usados" -Contenido @"
**1. Obtener permisos de un usuario:**

SELECT empresa_id, modulo, permiso
FROM permisos
WHERE usuario_id = 5 AND activo = 1


**2. Verificar estado de presupuesto:**

SELECT estado, usuario_id, actualizado_en
FROM presupuestos_estado
WHERE empresa_id = 'empresa1'
  AND modulo = 'CUENTAS'
  AND anio = 2025


**3. Obtener usuarios activos:**

SELECT id, username, nombre_completo
FROM usuarios
WHERE activo = 1
ORDER BY nombre_completo
"@

# ============================================================================
# SLIDE 25: LOGS Y MONITOREO
# ============================================================================
Add-SimpleSlide -Titulo "Logs y Monitoreo" -Contenido @"
**El sistema registra eventos importantes:**


✅ **Inicio/cierre de sesión**
   Quién entró y cuándo

📝 **Cambios en presupuestos**
   Quién modificó qué presupuesto

⚠️ **Errores**
   Problemas de conexión, fallos en queries

🔄 **Operaciones importantes**
   Aprobaciones, cambios de estado


**Dónde se ven:**
• Consola del servidor (tiempo real)
• Archivos de log (si están configurados)
• Tabla notificaciones (para usuarios)
"@

# ============================================================================
# SLIDE 26: BACKUPS
# ============================================================================
Add-SimpleSlide -Titulo "Sistema de Respaldos" -Contenido @"
**Backups automáticos de la base de datos**


⏰ **Frecuencia:**
   Cada 60 minutos automáticamente

📁 **Ubicación:**
   datos/backups/

📋 **Nombre:**
   panel.sqlite.backup-YYYYMMDD-HHMMSS.db


**API de backups:**
📍 GET /api/backups  →  Lista backups disponibles
📍 POST /api/backups/manual  →  Crear backup ahora
📍 POST /api/backups/restore  →  Restaurar backup


📁 Archivo: src/routes/backups.js
"@

# ============================================================================
# SLIDE 27: NOTIFICACIONES
# ============================================================================
Add-SimpleSlide -Titulo "Sistema de Notificaciones" -Contenido @"
**Alertas para usuarios**


**Tipos de notificaciones:**
• Presupuesto listo para revisar
• Presupuesto aprobado
• Cambio de permisos
• Alertas del sistema


**API:**
📍 GET /api/notificaciones  →  Ver mis notificaciones
📁 Archivo: src/routes/notificaciones.js (línea 13)


**Tabla:**
📊 notificaciones
   • usuario_id:  Para quién
   • tipo:  info, warning, success, error
   • mensaje:  Texto de la notificación
   • leido:  0 (no leído) o 1 (leído)
"@

# ============================================================================
# SLIDE 28: MÓDULOS DEL SISTEMA
# ============================================================================
Add-SimpleSlide -Titulo "Módulos del Sistema" -Contenido @"
**SummaCham tiene varios módulos:**


📊 **CUENTAS**
   Presupuesto por cuenta contable

📈 **SUMMARY**
   Resumen ejecutivo de presupuestos

📋 **RESUMEN**
   Consolidado general

💼 **OPERATIVO**
   Presupuesto operativo

🏢 **RH** (Recursos Humanos)
   Presupuesto de personal


**Cada módulo tiene:**
• Sus propias plantillas (layouts)
• Sus propios permisos
• Su propio estado por empresa y año
"@

# ============================================================================
# SLIDE 29: VARIABLES DE ENTORNO
# ============================================================================
Add-SimpleSlide -Titulo "Configuración: Variables de Entorno" -Contenido @"
**Variables importantes del sistema:**


🌐 **PORT**
   Puerto del servidor (default: 3005)

🔐 **PANELAMCHAM_JWT_SECRET**
   Clave secreta para tokens

🔑 **SESSION_SECRET**
   Clave secreta para sesiones

⚙️ **NODE_ENV**
   Entorno: development o production

💾 **BACKUP_ENABLED**
   Activar/desactivar backups automáticos

⏱️ **BACKUP_INTERVAL_MINUTES**
   Cada cuántos minutos hacer backup (default: 60)
"@

# ============================================================================
# SLIDE 30: TECNOLOGÍAS USADAS
# ============================================================================
Add-SimpleSlide -Titulo "Tecnologías del Sistema" -Contenido @"
**Stack tecnológico:**


⚙️ **Backend:**
   • Node.js:  Entorno de ejecución
   • Express:  Framework web
   • SQLite:  Base de datos local
   • node-firebird:  Conexión a Firebird


🔒 **Seguridad:**
   • bcrypt:  Encriptación de contraseñas
   • express-session:  Manejo de sesiones
   • helmet:  Protección de headers HTTP


📊 **Utilidades:**
   • Joi:  Validación de datos
   • date-fns:  Manejo de fechas
   • xlsx:  Generación de Excel
"@

# ============================================================================
# SLIDE 31: FLUJO DE AUTORIZACIÓN
# ============================================================================
Add-SimpleSlide -Titulo "Flujo de Autorización" -Contenido @"
**Cómo se autoriza un presupuesto**


1️⃣  **Usuario carga presupuesto**
    Estado: SIN_CARGAR → EDITANDO

2️⃣  **Usuario guarda cambios**
    POST /api/presupuestos/guardar
    Estado: EDITANDO

3️⃣  **Supervisor revisa**
    Usuario con permiso "Revisar"
    Estado: EDITANDO → REVISADO

4️⃣  **Director aprueba**
    Usuario con permiso "Aprobar"
    Estado: REVISADO → APROBADO

5️⃣  **Sistema guarda en Firebird**
    Datos pasan a base de datos de producción
"@

# ============================================================================
# SLIDE 32: MANEJO DE ERRORES
# ============================================================================
Add-SimpleSlide -Titulo "Manejo de Errores" -Contenido @"
**Tipos de errores comunes:**


❌ **400 - Bad Request**
   Parámetros incorrectos o faltantes

🔒 **401 - Unauthorized**
   No estás logueado

🚫 **403 - Forbidden**
   No tienes permisos para esta acción

❓ **404 - Not Found**
   Recurso no existe (empresa, usuario, etc.)

⚠️ **500 - Internal Server Error**
   Error del servidor (revisa logs)


**Ejemplo de respuesta de error:**
{
  "mensaje": "No cuentas con permisos para esta empresa.",
  "codigo": 403
}
"@

# ============================================================================
# SLIDE 33: TESTING Y VERIFICACIÓN
# ============================================================================
Add-SimpleSlide -Titulo "Pruebas y Verificación" -Contenido @"
**Scripts de verificación disponibles:**


🔍 **Verificar usuarios:**
   scripts/verify_seeding.js
   Revisa que usuarios existen en BD

🔍 **Verificar empresa específica:**
   scripts/verify_empresa3.js
   Prueba acceso a empresa

🔍 **Verificar layouts:**
   scripts/check-layout.js
   Revisa plantillas guardadas

🔍 **Verificar operaciones:**
   scripts/list-operations.js
   Lista operaciones en layouts


**Ejecutar:**
   node scripts/nombre-del-script.js
"@

# ============================================================================
# SLIDE 34: PREGUNTAS FRECUENTES
# ============================================================================
Add-SimpleSlide -Titulo "Preguntas Frecuentes" -Contenido @"
**¿Por qué no veo una empresa?**
→ No tienes permisos. Contacta al administrador.


**¿Cómo cambio mi contraseña?**
→ API: POST /api/perfil/cambiar-password


**¿Puedo tener permisos diferentes en cada empresa?**
→ Sí, los permisos son por empresa y módulo.


**¿Qué pasa si dos usuarios editan a la vez?**
→ El último en guardar sobreescribe.


**¿Los cambios son inmediatos?**
→ En SQLite SÍ, en Firebird NO (hasta aprobar).


**¿Puedo ver quién modificó un presupuesto?**
→ Sí, en presupuestos_estado está el usuario_id.
"@

# ============================================================================
# SLIDE 35: MEJORES PRÁCTICAS
# ============================================================================
Add-SimpleSlide -Titulo "Mejores Prácticas" -Contenido @"
**Para desarrolladores:**


✅ **Siempre valida permisos**
   Verifica que el usuario puede hacer la acción

✅ **Usa transacciones**
   Para operaciones que modifican varias tablas

✅ **Registra cambios importantes**
   Agrega logs de acciones críticas

✅ **Maneja errores apropiadamente**
   Devuelve códigos HTTP correctos

✅ **Documenta tus cambios**
   Comenta código complejo

✅ **Prueba con datos reales**
   Usa scripts de verificación
"@

# ============================================================================
# SLIDE 36: ROADMAP Y FUTURO
# ============================================================================
Add-SimpleSlide -Titulo "Próximas Mejoras" -Contenido @"
**Funcionalidades planeadas:**


🔮 **Dashboard mejorado**
   Gráficas interactivas con datos en tiempo real

📱 **API REST completa**
   Permitir integraciones con otros sistemas

🔔 **Notificaciones en tiempo real**
   WebSockets para alertas instantáneas

📊 **Reportes avanzados**
   Más tipos de reportes y exportaciones

👥 **Gestión de equipos**
   Roles y permisos más granulares

🔍 **Auditoría completa**
   Historial detallado de todos los cambios
"@

# ============================================================================
# SLIDE 37: CONTACTO Y SOPORTE
# ============================================================================
Add-SimpleSlide -Titulo "Contacto y Soporte" -Contenido @"
**¿Necesitas ayuda?**


📖 **Documentación:**
   Ver archivos DOCS_*.md en la raíz del proyecto


🔧 **Soporte técnico:**
   Contacta al equipo de desarrollo


📊 **Reportar bugs:**
   Describe el error con pasos para reproducirlo


💡 **Sugerencias:**
   Toda idea de mejora es bienvenida


📁 **Código fuente:**
   Repositorio: IustusRenidet/SummaCham
"@

# ============================================================================
# SLIDE 38: RESUMEN FINAL
# ============================================================================
Add-SimpleSlide -Titulo "Resumen" -Contenido @"
**Puntos clave:**


🎯 **SummaCham es un sistema web** que gestiona presupuestos


🔐 **Todo está protegido** con autenticación y permisos


📊 **Conecta múltiples fuentes:**
   • SQLite (datos locales)
   • Firebird (datos contables reales)


🚀 **APIs bien definidas** para cada operación


💾 **Backups automáticos** para seguridad de datos


👥 **Control granular** de quién puede hacer qué


📈 **Escalable** para agregar más empresas y módulos
"@

# ============================================================================
# GUARDAR PRESENTACIÓN
# ============================================================================
$rutaDestino = "$PSScriptRoot\..\PRESENTACION_SUMMACHAM_SIMPLIFICADA_UNIFICADA.pptx"
$presentation.SaveAs([ref]$rutaDestino)
$presentation.Close()
$powerpoint.Quit()

# Liberar objetos COM
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($presentation) | Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($powerpoint) | Out-Null
[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()

Write-Host ""
Write-Host "✅ ¡Presentación creada exitosamente!" -ForegroundColor Green
Write-Host "📁 Ubicación: $rutaDestino" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Total de slides: 38" -ForegroundColor Yellow
Write-Host ""
Write-Host "Características:" -ForegroundColor White
Write-Host "  ✓ Explicación simple y clara" -ForegroundColor Green
Write-Host "  ✓ Ejemplos reales con empresaId" -ForegroundColor Green
Write-Host "  ✓ Rutas API completas" -ForegroundColor Green
Write-Host "  ✓ Referencias a archivos fuente" -ForegroundColor Green
Write-Host "  ✓ Sin sobrecarga de información" -ForegroundColor Green
Write-Host "  ✓ Analogías fáciles de entender" -ForegroundColor Green
Write-Host ""
