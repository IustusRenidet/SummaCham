# Documentación Completa de Archivos - SummaCham

## Introducción

SummaCham es una aplicación de escritorio para gestión financiera empresarial desarrollada con Electron, Node.js y bases de datos Firebird/SQLite. Esta documentación detalla cada archivo del proyecto, su propósito, funcionalidad y relaciones con otros componentes.

**Nota**: Esta documentación excluye archivos de `node_modules/` ya que son dependencias de terceros. Se enfoca en el código fuente y archivos de configuración del proyecto.

## Archivos de Raíz

### main.js
**Ubicación**: `main.js`  
**Tipo**: JavaScript (Electron Main Process)  
**Propósito**: Punto de entrada principal de la aplicación Electron. Maneja la creación de ventanas, actualizaciones automáticas, bandeja del sistema y gestión del ciclo de vida de la aplicación.  
**Funcionalidades principales**:
- Creación y configuración de BrowserWindow
- Sistema de actualizaciones con electron-updater
- Auto-lanzamiento al iniciar Windows
- Gestión de instancia única
- Comunicación IPC entre procesos
**Dependencias**: Electron APIs, electron-updater, auto-launch

### package.json
**Ubicación**: `package.json`  
**Tipo**: JSON (Configuración npm)  
**Propósito**: Define metadatos del proyecto, dependencias, scripts y configuración de empaquetado.  
**Estructura clave**:
- `scripts`: Comandos para desarrollo, construcción y distribución
- `dependencies`: Librerías runtime (electron, express, sqlite3, etc.)
- `devDependencies`: Herramientas de desarrollo
- `build`: Configuración de electron-builder para distribución
**Scripts importantes**:
- `start`: Desarrollo con hot-reload
- `dist`: Construir instalador
- `publish`: Publicar release en GitHub

### README.md
**Ubicación**: `README.md`  
**Tipo**: Markdown (Documentación)  
**Propósito**: Documentación principal del proyecto con instrucciones de instalación, uso y características.  
**Secciones**:
- Descripción del proyecto
- Requisitos del sistema
- Guía de instalación paso a paso
- Comandos disponibles
- Características principales
- Información de contribución

### .env.development / .env.production
**Ubicación**: `.env.*`  
**Tipo**: Variables de entorno  
**Propósito**: Configuración de ambiente específica para desarrollo y producción.  
**Variables comunes**:
- `NODE_ENV`: Ambiente de ejecución
- `PORT`: Puerto del servidor
- `DB_PATH`: Ruta a base de datos SQLite
- `FIREBIRD_*`: Configuración de conexión Firebird
- `JWT_SECRET`: Clave para tokens JWT

## Directorio src/ (Backend)

### server.js
**Ubicación**: `src/server.js`  
**Tipo**: JavaScript (Node.js/Express)  
**Propósito**: Servidor principal que maneja todas las rutas API, middlewares y configuración del backend.  
**Funcionalidades**:
- Configuración de Express con CORS
- Rutas para autenticación, usuarios, presupuestos, etc.
- Middleware de autenticación JWT
- Servir archivos estáticos del frontend
- Gestión de sesiones y permisos
**Rutas principales**:
- `/api/auth`: Autenticación
- `/api/usuarios`: Gestión de usuarios
- `/api/presupuestos`: Datos presupuestarios

### config/empresas.js
**Ubicación**: `src/config/empresas.js`  
**Tipo**: JavaScript (Configuración)  
**Propósito**: Define la configuración de empresas, módulos disponibles y permisos por rol.  
**Estructura**:
```javascript
{
  empresa1: {
    nombre: 'Empresa 1',
    modulos: ['RESUMEN', 'RH', 'NOMINA'],
    permisos: {
      admin: ['*'],
      user: ['read', 'write']
    }
  }
}
```

### config/modulos.js
**Ubicación**: `src/config/modulos.js`  
**Tipo**: JavaScript (Configuración)  
**Propósito**: Define la estructura jerárquica de módulos y sus propiedades.  
**Contenido**: Configuración de módulos como SUMMARY, RESUMEN, RH, Nómina, etc.

### config/seed_users.json
**Ubicación**: `src/config/seed_users.json`  
**Tipo**: JSON (Datos iniciales)  
**Propósito**: Usuarios por defecto para inicializar el sistema.  
**Estructura**:
```json
[
  {
    "username": "admin",
    "password": "hashed_password",
    "role": "admin",
    "empresa": "empresa1"
  }
]
```

### db/sqlite.js
**Ubicación**: `src/db/sqlite.js`  
**Tipo**: JavaScript (Base de datos)  
**Propósito**: Wrapper para operaciones con SQLite usando better-sqlite3.  
**Funcionalidades**:
- Conexión a BD
- Operaciones CRUD síncronas
- Gestión de transacciones
- Inicialización de tablas

### db/nedb.js
**Ubicación**: `src/db/nedb.js`  
**Tipo**: JavaScript (Base de datos alternativa)  
**Propósito**: Implementación alternativa usando NeDB (MongoDB embebido).  
**Uso**: Para entornos que requieren NoSQL embebido.

### middleware/auth.js
**Ubicación**: `src/middleware/auth.js`  
**Tipo**: JavaScript (Middleware)  
**Propósito**: Middleware de autenticación JWT para proteger rutas.  
**Funcionalidades**:
- Verificación de tokens
- Extracción de usuario de token
- Manejo de errores de autenticación

### routes/auth.js
**Ubicación**: `src/routes/auth.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Endpoints para autenticación de usuarios.  
**Endpoints**:
- `POST /login`: Autenticación
- `POST /logout`: Cierre de sesión
- `POST /refresh`: Renovación de token

### routes/usuarios.js
**Ubicación**: `src/routes/usuarios.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Gestión CRUD de usuarios.  
**Endpoints**:
- `GET /`: Listar usuarios
- `POST /`: Crear usuario
- `PUT /:id`: Actualizar usuario
- `DELETE /:id`: Eliminar usuario

### routes/presupuestos.js
**Ubicación**: `src/routes/presupuestos.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Operaciones con datos presupuestarios.  
**Funcionalidades**:
- Obtener datos por módulo/empresa
- Guardar cambios
- Aplicar operaciones

### routes/layouts.js
**Ubicación**: `src/routes/layouts.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Gestión de layouts y plantillas.  
**Endpoints**:
- `GET /:empresa/:modulo`: Obtener layout
- `PUT /:empresa/:modulo`: Guardar layout

### routes/borradores.js
**Ubicación**: `src/routes/borradores.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Sistema de borradores para trabajo no guardado.  
**Funcionalidades**:
- Guardar borrador automáticamente
- Recuperar borrador
- Limpiar borradores antiguos

### routes/comentarios.js
**Ubicación**: `src/routes/comentarios.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Sistema de comentarios en celdas y documentos.  
**Funcionalidades**:
- Agregar comentarios
- Obtener comentarios por documento
- Marcar como leídos

### routes/notificaciones.js
**Ubicación**: `src/routes/notificaciones.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Sistema de notificaciones push.  
**Tipos de notificaciones**:
- Aprobaciones pendientes
- Comentarios nuevos
- Cambios en documentos

### routes/empresas.js
**Ubicación**: `src/routes/empresas.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Gestión de configuración por empresa.

### routes/cuentas.js
**Ubicación**: `src/routes/cuentas.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Operaciones con cuentas contables.

### routes/estructuraRoutes.js
**Ubicación**: `src/routes/estructuraRoutes.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Gestión de estructura jerárquica de datos.

### routes/firebird-config.js
**Ubicación**: `src/routes/firebird-config.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Configuración de conexiones Firebird.

### routes/graficas-config.js
**Ubicación**: `src/routes/graficas-config.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Configuración de gráficas y visualizaciones.

### routes/insercion.js
**Ubicación**: `src/routes/insercion.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Inserción de nuevos elementos con validación.

### routes/modulos.js
**Ubicación**: `src/routes/modulos.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Gestión de módulos disponibles.

### routes/perfil.js
**Ubicación**: `src/routes/perfil.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Gestión de perfiles de usuario.

### routes/planeacion.js
**Ubicación**: `src/routes/planeacion.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Funciones de planificación presupuestaria.

### routes/reportes.js
**Ubicación**: `src/routes/reportes.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Generación de reportes.

### routes/saldos.js
**Ubicación**: `src/routes/saldos.js`  
**Tipo**: JavaScript (Rutas API)  
**Propósito**: Gestión de saldos contables.

### services/backupService.js
**Ubicación**: `src/services/backupService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Sistema de backups automáticos de base de datos.  
**Funcionalidades**:
- Backups programados
- Verificación de integridad
- Limpieza automática de backups antiguos
- Compresión opcional

### services/borradoresService.js
**Ubicación**: `src/services/borradoresService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Gestión de borradores de trabajo.  
**Funcionalidades**:
- Auto-guardado
- Recuperación de borradores
- Sincronización entre sesiones

### services/comentariosService.js
**Ubicación**: `src/services/comentariosService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Lógica de negocio para comentarios.

### services/comitesService.js
**Ubicación**: `src/services/comitesService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Gestión de comités y aprobaciones.

### services/firebirdConfigService.js
**Ubicación**: `src/services/firebirdConfigService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Configuración de conexiones Firebird.

### services/firebirdService.js
**Ubicación**: `src/services/firebirdService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Conexión y operaciones con Firebird.  
**Funcionalidades**:
- Conexión a BD Firebird
- Ejecución de queries
- Mapeo de resultados

### services/layoutConfigStore.js
**Ubicación**: `src/services/layoutConfigStore.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Almacenamiento de configuraciones de layout.

### services/layoutSeeder.js
**Ubicación**: `src/services/layoutSeeder.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Inicialización de layouts por defecto.

### services/layoutService.js
**Ubicación**: `src/services/layoutService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Operaciones CRUD con layouts.

### services/layoutsService.js
**Ubicación**: `src/services/layoutsService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Servicio adicional para layouts.

### services/modulosService.js
**Ubicación**: `src/services/modulosService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Gestión de módulos del sistema.

### services/notificacionesService.js
**Ubicación**: `src/services/notificacionesService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Envío y gestión de notificaciones.

### services/permisosService.js
**Ubicación**: `src/services/permisosService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Control de permisos por usuario/rol.

### services/planeacionCuentasService.js
**Ubicación**: `src/services/planeacionCuentasService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Lógica de cuentas en planificación.

### services/presupuestosMetadataService.js
**Ubicación**: `src/services/presupuestosMetadataService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Metadatos de presupuestos.

### services/presupuestosService.js
**Ubicación**: `src/services/presupuestosService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Operaciones con datos presupuestarios.

### services/saldosMetadataService.js
**Ubicación**: `src/services/saldosMetadataService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Metadatos de saldos.

### services/saldosResumenHelper.js
**Ubicación**: `src/services/saldosResumenHelper.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Helpers para resúmenes de saldos.

### services/saldosService.js
**Ubicación**: `src/services/saldosService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Gestión de saldos contables.

### services/summaryService.js
**Ubicación**: `src/services/summaryService.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Servicio para operaciones de resumen.

### services/usuariosPolicy.js
**Ubicación**: `src/services/usuariosPolicy.js`  
**Tipo**: JavaScript (Servicio)  
**Propósito**: Políticas de acceso para usuarios.

### services/engines/resumenEngine.js
**Ubicación**: `src/services/engines/resumenEngine.js`  
**Tipo**: JavaScript (Motor de cálculo)  
**Propósito**: Motor para cálculos de resúmenes.  
**Funcionalidades**:
- Aplicación de operaciones matemáticas
- Cálculo de totales
- Validación de fórmulas

### services/engines/summaryEngine.js
**Ubicación**: `src/services/engines/summaryEngine.js`  
**Tipo**: JavaScript (Motor de cálculo)  
**Propósito**: Motor para cálculos de summary.

### services/reportes/operativoExcelService.js
**Ubicación**: `src/services/reportes/operativoExcelService.js`  
**Tipo**: JavaScript (Servicio de reportes)  
**Propósito**: Generación de reportes Excel operativos.

### services/reportes/planeacionReportesEngine.js
**Ubicación**: `src/services/reportes/planeacionReportesEngine.js`  
**Tipo**: JavaScript (Motor de reportes)  
**Propósito**: Motor para reportes de planificación.

### services/reportes/resumenExcelService.js
**Ubicación**: `src/services/reportes/resumenExcelService.js`  
**Tipo**: JavaScript (Servicio de reportes)  
**Propósito**: Generación de reportes Excel de resúmenes.

### utils/betterSqlite3Manager.js
**Ubicación**: `src/utils/betterSqlite3Manager.js`  
**Tipo**: JavaScript (Utilidad)  
**Propósito**: Wrapper avanzado para better-sqlite3.

### utils/csvLoader.js
**Ubicación**: `src/utils/csvLoader.js`  
**Tipo**: JavaScript (Utilidad)  
**Propósito**: Carga y procesamiento de archivos CSV.

### utils/secretsManager.js
**Ubicación**: `src/utils/secretsManager.js`  
**Tipo**: JavaScript (Utilidad)  
**Propósito**: Gestión segura de secrets y contraseñas.

## Directorio vistas/ (Frontend)

### app.html
**Ubicación**: `vistas/app.html`  
**Tipo**: HTML (Página principal)  
**Propósito**: Página principal de la aplicación con navegación y layout base.  
**Estructura**:
- Header con navegación
- Sidebar con módulos
- Área principal de contenido
- Footer

### login.html
**Ubicación**: `vistas/login.html`  
**Tipo**: HTML (Autenticación)  
**Propósito**: Formulario de login.  
**Funcionalidades**:
- Validación de credenciales
- Recordar sesión
- Recuperación de contraseña

### usuarios.html
**Ubicación**: `vistas/usuarios.html`  
**Tipo**: HTML (Administración)  
**Propósito**: Gestión de usuarios del sistema.

### perfil.html
**Ubicación**: `vistas/perfil.html`  
**Tipo**: HTML (Usuario)  
**Propósito**: Perfil y configuración del usuario actual.

### plantillas.html
**Ubicación**: `vistas/plantillas.html`  
**Tipo**: HTML (Configuración)  
**Propósito**: Gestión de plantillas y layouts.

### firebird-config.html
**Ubicación**: `vistas/firebird-config.html`  
**Tipo**: HTML (Configuración)  
**Propósito**: Configuración de conexiones Firebird.

### graficas-config.html
**Ubicación**: `vistas/graficas-config.html`  
**Tipo**: HTML (Configuración)  
**Propósito**: Configuración de gráficas.

### crear_usuario.html
**Ubicación**: `vistas/crear_usuario.html`  
**Tipo**: HTML (Administración)  
**Propósito**: Formulario para crear nuevos usuarios.

### reseed-operaciones.html
**Ubicación**: `vistas/reseed-operaciones.html`  
**Tipo**: HTML (Mantenimiento)  
**Propósito**: Re-inicialización de operaciones.

### Módulos específicos (RESUMEN.html, RH.html, etc.)
**Ubicación**: `vistas/[MODULO].html`  
**Tipo**: HTML (Módulos)  
**Propósito**: Interfaces específicas para cada módulo presupuestario.  
**Módulos disponibles**:
- RESUMEN.html
- RH.html
- Nomina.html
- Comités.html
- Comunicación.html
- Dirección.html
- Eventos.html
- Finanzas.html
- GastosGenerales.html
- Gtos_Corporativos.html
- Membresía.html
- Serv_Membresía.html
- T&IC.html
- VPE.html

### componentes/flujo-autorizacion.html
**Ubicación**: `vistas/componentes/flujo-autorizacion.html`  
**Tipo**: HTML (Componente)  
**Propósito**: Componente reutilizable para flujo de autorizaciones.

### css/estilos.css
**Ubicación**: `vistas/css/estilos.css`  
**Tipo**: CSS (Estilos globales)  
**Propósito**: Estilos principales de la aplicación.

### css/estilos específicos
**Ubicación**: `vistas/css/*.css`  
**Tipo**: CSS (Estilos específicos)  
**Propósito**: Estilos para componentes específicos como wizard, gráficas, etc.

### js/sesion.js
**Ubicación**: `vistas/js/sesion.js`  
**Tipo**: JavaScript (Gestión de sesión)  
**Propósito**: Manejo de autenticación y sesiones en el frontend.

### js/verificar-sesion.js
**Ubicación**: `vistas/js/verificar-sesion.js`  
**Tipo**: JavaScript (Utilidad)  
**Propósito**: Verificación automática de sesión activa.

### js/operativo-sidebar.js
**Ubicación**: `vistas/js/operativo-sidebar.js`  
**Tipo**: JavaScript (UI)  
**Propósito**: Gestión de la barra lateral operativa.

### js/plantillas.js
**Ubicación**: `vistas/js/plantillas.js`  
**Tipo**: JavaScript (Gestión de plantillas)  
**Propósito**: Lógica para gestión de plantillas.

### js/plantillas-reordenar.js
**Ubicación**: `vistas/js/plantillas-reordenar.js`  
**Tipo**: JavaScript (UI)  
**Propósito**: Funcionalidad de reordenamiento de plantillas.

### js/plantillas-graficas.js
**Ubicación**: `vistas/js/plantillas-graficas.js`  
**Tipo**: JavaScript (Visualización)  
**Propósito**: Gráficas relacionadas con plantillas.

### js/graficas-resumen.js
**Ubicación**: `vistas/js/graficas-resumen.js`  
**Tipo**: JavaScript (Visualización)  
**Propósito**: Gráficas para módulos de resumen.

### js/graficas-config.js
**Ubicación**: `vistas/js/graficas-config.js`  
**Tipo**: JavaScript (Configuración)  
**Propósito**: Configuración de gráficas.

### js/gastos-generales-graficas.js
**Ubicación**: `vistas/js/gastos-generales-graficas.js`  
**Tipo**: JavaScript (Visualización)  
**Propósito**: Gráficas específicas para gastos generales.

### js/firebird-config.js
**Ubicación**: `vistas/js/firebird-config.js`  
**Tipo**: JavaScript (Configuración)  
**Propósito**: Interfaz para configuración Firebird.

### js/insertion-wizard.js
**Ubicación**: `vistas/js/insertion-wizard.js`  
**Tipo**: JavaScript (Wizard)  
**Propósito**: Asistente inteligente para inserción de datos con validación jerárquica.

### js/formula-builder.js
**Ubicación**: `vistas/js/formula-builder.js`  
**Tipo**: JavaScript (Constructor)  
**Propósito**: Constructor visual de fórmulas matemáticas.

### js/context-menu-manager.js
**Ubicación**: `vistas/js/context-menu-manager.js`  
**Tipo**: JavaScript (UI)  
**Propósito**: Gestión de menús contextuales.

### js/context-menu-wizard.js
**Ubicación**: `vistas/js/context-menu-wizard.js`  
**Tipo**: JavaScript (UI)  
**Propósito**: Menús contextuales para wizard.

### js/cuentas-data.js
**Ubicación**: `vistas/js/cuentas-data.js`  
**Tipo**: JavaScript (Datos)  
**Propósito**: Gestión de datos de cuentas.

### js/cuentas-modulo.js
**Ubicación**: `vistas/js/cuentas-modulo.js`  
**Tipo**: JavaScript (Módulo)  
**Propósito**: Lógica específica del módulo de cuentas.

### js/export-utils.js
**Ubicación**: `vistas/js/export-utils.js`  
**Tipo**: JavaScript (Utilidad)  
**Propósito**: Utilidades para exportación de datos.

### js/flujo-autorizacion.js
**Ubicación**: `vistas/js/flujo-autorizacion.js`  
**Tipo**: JavaScript (Workflow)  
**Propósito**: Gestión del flujo de autorizaciones.

### js/init-modulo-planeacion.js
**Ubicación**: `vistas/js/init-modulo-planeacion.js`  
**Tipo**: JavaScript (Inicialización)  
**Propósito**: Inicialización del módulo de planificación.

### js/insertion-validator.js
**Ubicación**: `vistas/js/insertion-validator.js`  
**Tipo**: JavaScript (Validación)  
**Propósito**: Validación de inserciones de datos.

### js/layout-controls.js
**Ubicación**: `vistas/js/layout-controls.js`  
**Tipo**: JavaScript (UI)  
**Propósito**: Controles para gestión de layouts.

### js/logica-resumen.js
**Ubicación**: `vistas/js/logica-resumen.js`  
**Tipo**: JavaScript (Lógica)  
**Propósito**: Lógica específica de resúmenes.

### js/modo-edicion-presupuesto.js
**Ubicación**: `vistas/js/modo-edicion-presupuesto.js`  
**Tipo**: JavaScript (Edición)  
**Propósito**: Gestión del modo edición para presupuestos.

### js/modulo-generico.js
**Ubicación**: `vistas/js/modulo-generico.js`  
**Tipo**: JavaScript (Genérico)  
**Propósito**: Funcionalidades comunes para módulos.

### js/operation-debugger.js
**Ubicación**: `vistas/js/operation-debugger.js`  
**Tipo**: JavaScript (Debug)  
**Propósito**: Depuración de operaciones.

### js/operation-sync.js
**Ubicación**: `vistas/js/operation-sync.js`  
**Tipo**: JavaScript (Sincronización)  
**Propósito**: Sincronización de operaciones.

### js/planeacion-modulo-vista.js
**Ubicación**: `vistas/js/planeacion-modulo-vista.js`  
**Tipo**: JavaScript (Vista)  
**Propósito**: Vista del módulo de planificación.

### js/presupuesto-vista.js
**Ubicación**: `vistas/js/presupuesto-vista.js`  
**Tipo**: JavaScript (Vista)  
**Propósito**: Vista genérica de presupuestos.

### js/react-app.js
**Ubicación**: `vistas/js/react-app.js`  
**Tipo**: JavaScript (React)  
**Propósito**: Aplicación React integrada.

### js/react-app.jsx
**Ubicación**: `vistas/js/react-app.jsx`  
**Tipo**: JSX (React)  
**Propósito**: Componentes React en JSX.

### js/resumen-data.js
**Ubicación**: `vistas/js/resumen-data.js`  
**Tipo**: JavaScript (Datos)  
**Propósito**: Gestión de datos de resumen.

### js/resumen-view.js
**Ubicación**: `vistas/js/resumen-view.js`  
**Tipo**: JavaScript (Vista)  
**Propósito**: Vista del módulo resumen.

### js/seccion-collapse.js
**Ubicación**: `vistas/js/seccion-collapse.js`  
**Tipo**: JavaScript (UI)  
**Propósito**: Funcionalidad de colapso de secciones.

### js/summary-aggregates.js
**Ubicación**: `vistas/js/summary-aggregates.js`  
**Tipo**: JavaScript (Cálculos)  
**Propósito**: Agregaciones para summary.

### js/summary-catalog.js
**Ubicación**: `vistas/js/summary-catalog.js`  
**Tipo**: JavaScript (Catálogo)  
**Propósito**: Catálogo de elementos summary.

### js/summary-engine-core.js
**Ubicación**: `vistas/js/summary-engine-core.js`  
**Tipo**: JavaScript (Motor)  
**Propósito**: Motor central de cálculos summary.

### js/summary-layout.js
**Ubicación**: `vistas/js/summary-layout.js`  
**Tipo**: JavaScript (Layout)  
**Propósito**: Gestión de layout para summary.

### js/summary-view.js
**Ubicación**: `vistas/js/summary-view.js`  
**Tipo**: JavaScript (Vista)  
**Propósito**: Vista del módulo summary.

### js/summary.js
**Ubicación**: `vistas/js/summary.js`  
**Tipo**: JavaScript (Principal)  
**Propósito**: Lógica principal del módulo summary.

### js/toggle-redondeo.js
**Ubicación**: `vistas/js/toggle-redondeo.js`  
**Tipo**: JavaScript (UI)  
**Propósito**: Toggle para redondeo de cifras.

### vendor/
**Ubicación**: `vistas/vendor/`  
**Tipo**: Librerías de terceros  
**Propósito**: Dependencias frontend embebidas (Bootstrap, React, etc.).

## Directorio scripts/

### Scripts de utilidad y mantenimiento

#### prepublish.js
**Ubicación**: `scripts/prepublish.js`  
**Tipo**: JavaScript (Build)  
**Propósito**: Preparación antes de publicar releases.

#### manage-native.js
**Ubicación**: `scripts/manage-native.js`  
**Tipo**: JavaScript (Utilidad)  
**Propósito**: Gestión de módulos nativos para diferentes entornos.

#### Scripts de importación
**Ubicación**: `scripts/import_*.js` y `scripts/import_*.py`  
**Tipo**: JavaScript/Python (Importación)  
**Propósito**: Importación de datos desde diversos formatos.

#### Scripts de verificación
**Ubicación**: `scripts/verify_*.js`  
**Tipo**: JavaScript (Verificación)  
**Propósito**: Verificación de integridad de datos.

#### Scripts de exportación
**Ubicación**: `scripts/export_*.ps1`  
**Tipo**: PowerShell (Exportación)  
**Propósito**: Exportación de datos y configuraciones.

## Directorio PLANTILLAS 2026+/

### Estructura de plantillas por empresa

Cada subdirectorio representa una empresa y contiene archivos JSON con layouts para diferentes módulos.

**Ejemplo**: `PLANTILLAS 2026+/CIUDAD DE MEXICO 2026/RESUMEN_layout.json`

**Propósito**: Definir la estructura visual y lógica de cada módulo por empresa.

**Estructura típica de layout**:
```json
{
  "modulo": "RESUMEN",
  "columns": [
    {"name": "cuenta", "type": "text", "width": 200},
    {"name": "presupuesto", "type": "currency", "width": 150}
  ],
  "rows": [...],
  "operations": [...]
}
```

## Directorio tests/

### test-flujo-autorizacion.js
**Ubicación**: `tests/test-flujo-autorizacion.js`  
**Tipo**: JavaScript (Prueba)  
**Propósito**: Pruebas del flujo de autorizaciones.

### summary-engine-core.test.js
**Ubicación**: `tests/summary-engine-core.test.js`  
**Tipo**: JavaScript (Prueba)  
**Propósito**: Pruebas del motor de cálculos summary.

## Otros archivos

### Iconos y recursos
**Ubicación**: `icono/`  
**Tipo**: Imágenes (Recursos)  
**Propósito**: Iconos para la aplicación y instalador.

### Imágenes
**Ubicación**: `image/`  
**Tipo**: Imágenes (Recursos)  
**Propósito**: Imágenes utilizadas en la interfaz.

### MDS (¿Documentación?)
**Ubicación**: `mds/`  
**Tipo**: Desconocido  
**Propósito**: Archivos de documentación o metadatos.

### Scripts de PowerShell
**Ubicación**: Raíz  
**Tipo**: PowerShell  
**Propósito**: Utilidades de Windows (limpieza de cache, cambio de modo, etc.).

### Archivos de documentación
**Ubicación**: Raíz (varios .md)  
**Tipo**: Markdown  
**Propósito**: Documentación específica de funcionalidades.

---

## 📊 OPERACIONES_POR_CELDA_TODOS_MODULOS.json

**Ubicación:** `OPERACIONES_POR_CELDA_TODOS_MODULOS.json`  
**Propósito:** Mapa completo y exhaustivo de operaciones por cada celda de cada módulo HTML  
**Versión:** 2.0.0 (2026-01-04)

### 📋 Descripción General
Este archivo JSON es el **mapa maestro** que define todas las operaciones que se ejecutan en cada celda de las tablas HTML de todos los módulos del sistema. Es la referencia definitiva para entender cómo funciona la lógica de cálculo de sumas, totales y operaciones financieras.

### 🏗️ Estructura Jerárquica
```
OPERACIONES_POR_CELDA_TODOS_MODULOS.json
├── estructura_columnas_comun (columnas 0-29)
├── modulos
│   ├── Membresia.html
│   │   ├── capitulos: ["CIUDAD DE MÉXICO", "GUADALAJARA", "NORESTE", "NOROESTE"]
│   │   └── CIUDAD DE MÉXICO
│   │       └── seccion_INGRESOS_MEMBRESIA
│   │           ├── tipo_seccion: "INGRESOS"
│   │           ├── factor_seccion: 1
│   │           ├── cuentas: [array de objetos cuenta]
│   │           ├── filas_cuenta: {operaciones por celda}
│   │           ├── fila_sum_row: {suma vertical}
│   │           └── fila_sumavarios: {resultado operativo}
```

### 📊 Tipos de Operaciones por Celda

#### 1. **Celdas Editables (INPUT)**
```json
"columna_2_budget_ene": {
  "tipo": "input",
  "editable": true,
  "valor_inicial": "API /planeacion/cuentas → presupuesto.ene",
  "al_editar": [
    "1. Usuario hace doble click",
    "2. Celda se vuelve contentEditable",
    "3. Usuario escribe valor",
    "4. Al presionar Enter:",
    "   a. parsearNumero(celda.textContent)",
    "   b. actualizar estadoModulo.valoresPorCuenta",
    "   c. llamar recalcularTotalesFilaPresupuesto()",
    "   d. llamar recalcularSumas()"
  ],
  "validacion": "Número válido, acepta negativos"
}
```

#### 2. **Celdas Calculadas (SUM_HORIZONTAL)**
```json
"columna_26_total_budget": {
  "tipo": "calculado",
  "operacion": "SUM_HORIZONTAL",
  "formula": "SUM(budget-ene hasta budget-[periodo_cerrado])",
  "dependencias": ["columnas 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24"],
  "trigger": "recalcularTotalesFilaPresupuesto()",
  "pseudocodigo": [
    "let total = 0;",
    "for (let i = 0; i <= periodoCerrado; i++) {",
    "  total += valores[`budget-${MESES[i]}`] || 0;",
    "}",
    "celda.textContent = formatearNumero(total);"
  ]
}
```

#### 3. **Celdas de Suma Vertical (SUM_VERTICAL)**
```json
"columna_2_budget_ene": {
  "tipo": "calculado",
  "operacion": "SUM_VERTICAL",
  "formula": "SUM(cuenta1.budget-ene * factor1, cuenta2.budget-ene * factor2, ...)",
  "dependencias": ["Todas las filas-cuenta de la sección"],
  "trigger": "recalcularSumas() → PASO 1",
  "proceso_detallado": [
    "1. Extraer valores de cada fila-cuenta:",
    "   - fila1: 50000 * 1 = 50000",
    "   - fila2: 5000 * 1 = 5000",
    "   - fila3: 3000 * 1 = 3000",
    "   - fila4: 2000 * 1 = 2000",
    "   - fila5: 1000 * 1 = 1000",
    "2. Sumar: 50000 + 5000 + 3000 + 2000 + 1000 = 61000",
    "3. Asignar a celda: formatearNumero(61000) → '61,000.00'"
  ],
  "linea_codigo": "3890-3920 en cuentas-modulo.js"
}
```

#### 4. **Celdas de Resultado Operativo (SUM_DE_SUM)**
```json
"columna_2_budget_ene": {
  "tipo": "calculado",
  "operacion": "SUM_DE_SUM",
  "formula": "SUM(seccion1.sumRow * factor1, seccion2.sumRow * factor2)",
  "ejemplo_calculo": [
    "seccion INGRESOS MEMBRESIA: sumRow.budget-ene = 61000, factor = 1",
    "seccion GASTOS MEMBRESIA: sumRow.budget-ene = 15000, factor = -1",
    "Resultado: (61000 * 1) + (15000 * -1) = 46000"
  ],
  "trigger": "recalcularSumas() → PASO 2",
  "linea_codigo": "3925-3990"
}
```

### 🎯 Funcionalidad Crítica
- **Referencia maestra** para el motor de cálculos `cuentas-modulo.js`
- Define operaciones para **30 columnas** por fila (cuentas + 12 meses × 2 + 4 totales)
- Soporta **múltiples módulos** con estructuras similares pero lógicas específicas
- Incluye **pseudocódigo** para cada operación para facilitar debugging
- **Versionado** para tracking de cambios en lógica de negocio

---

## 🔧 Scripts de Utilidad

### cambiar-modo.ps1
**Ubicación:** `cambiar-modo.ps1`  
**Propósito:** Cambiar rápidamente entre modos de desarrollo y producción

```powershell
# Uso: .\cambiar-modo.ps1 dev  (o prod)
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('dev', 'prod', 'development', 'production')]
    [string]$Modo
)

# Normaliza modo y copia archivo .env correspondiente
$ModoFinal = switch ($Modo) {
    'dev' { 'development' }
    'prod' { 'production' }
    default { $Modo }
}

Copy-Item ".env.$ModoFinal" ".env" -Force
```

**Funcionalidad:**
- ✅ Valida parámetros de entrada
- ✅ Copia archivo `.env` correspondiente
- ✅ Muestra configuración activa
- ✅ Instrucciones para ejecutar la aplicación

### limpiar-cache-icono.ps1
**Ubicación:** `limpiar-cache-icono.ps1`  
**Propósito:** Limpiar caché de iconos de Windows para resolver problemas de visualización

```powershell
# Ejecutar como administrador si es posible
Write-Host "🧹 Limpiando caché de iconos de Windows..." -ForegroundColor Cyan

# Elimina IconCache.db
Remove-Item "$env:LOCALAPPDATA\IconCache.db" -Force -ErrorAction SilentlyContinue

# Elimina archivos de thumbnail cache
Get-ChildItem "$env:LOCALAPPDATA\Microsoft\Windows\Explorer" -Filter "thumbcache_*.db" |
    Remove-Item -Force -ErrorAction SilentlyContinue
```

**Funcionalidad:**
- ✅ Elimina `IconCache.db`
- ✅ Limpia caché de thumbnails
- ✅ Opción para reiniciar Explorador de Windows
- ✅ Manejo de errores para archivos en uso

---

## 🗄️ Scripts SQL de Inicialización

### insertar-cuentas-ppto-cdmx.sql
**Ubicación:** `insertar-cuentas-ppto-cdmx.sql`  
**Propósito:** Insertar cuentas de presupuesto consolidadas para Ciudad de México

```sql
-- Inserta 6 cuentas consolidadas para presupuesto
-- GUADALAJARA INCOME
INSERT INTO CUENTAS26 (NUM_CTA, NOMBRE, NATURALEZA, STATUS, TIPO, NIVEL)
VALUES ('45000100000000000000001', 'PPTO GDL INCOME', 'A', 'A', 'A', '1');

-- GUADALAJARA EXPENSE
INSERT INTO CUENTAS26 (NUM_CTA, NOMBRE, NATURALEZA, STATUS, TIPO, NIVEL)
VALUES ('95000100000000000000001', 'PPTO GDL EXPENSE', 'A', 'A', 'A', '1');

-- NORESTE INCOME
INSERT INTO CUENTAS26 (NUM_CTA, NOMBRE, NATURALEZA, STATUS, TIPO, NIVEL)
VALUES ('45000200000000000000001', 'PPTO NE INCOME', 'A', 'A', 'A', '1');

-- NORESTE EXPENSE
INSERT INTO CUENTAS26 (NUM_CTA, NOMBRE, NATURALEZA, STATUS, TIPO, NIVEL)
VALUES ('95000200000000000000001', 'PPTO NE EXPENSE', 'A', 'A', 'A', '1');

-- NOROESTE INCOME
INSERT INTO CUENTAS26 (NUM_CTA, NOMBRE, NATURALEZA, STATUS, TIPO, NIVEL)
VALUES ('45000300000000000000001', 'PPTO NO INCOME', 'A', 'A', 'A', '1');

-- NOROESTE EXPENSE
INSERT INTO CUENTAS26 (NUM_CTA, NOMBRE, NATURALEZA, STATUS, TIPO, NIVEL)
VALUES ('95000300000000000000001', 'PPTO NO EXPENSE', 'A', 'A', 'A', '1');
```

### insertar-presup-cuentas-cdmx.sql
**Ubicación:** `insertar-presup-cuentas-cdmx.sql`  
**Propósito:** Inicializar presupuestos mensuales para las cuentas consolidadas

```sql
-- Inicializa presupuestos en cero para ejercicio 2026
INSERT INTO PRESUP26 (NUM_CTA, EJERCICIO, PRESUP01, PRESUP02, PRESUP03, PRESUP04, PRESUP05, PRESUP06, PRESUP07, PRESUP08, PRESUP09, PRESUP10, PRESUP11, PRESUP12)
VALUES ('45000100000000000000001', 2026, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

-- Repite para las otras 5 cuentas consolidadas...
```

**Funcionalidad:**
- ✅ Crea estructura de cuentas consolidadas
- ✅ Inicializa presupuestos en cero
- ✅ Preparación para importación de datos reales

---

## 📚 Documentación Principal

### README.md
**Ubicación:** `README.md`  
**Propósito:** Documentación principal del proyecto con instrucciones de instalación y uso

**Contenido clave:**
- 🚀 Características principales del sistema
- 📋 Requisitos previos (Node.js, Firebird, etc.)
- ⚡ Instalación rápida paso a paso
- 🛠️ Scripts NPM disponibles
- 📁 Estructura del proyecto
- 🔐 Configuración de seguridad para cuenta admin

**Scripts destacados:**
```bash
npm start          # Inicia app en Electron
npm run server     # Solo servidor Node.js
npm run build      # Crea ejecutable de producción
npm run dist       # Genera installer + portable
```

### CONFIGURACION_ENTORNO.md
**Ubicación:** `CONFIGURACION_ENTORNO.md`  
**Propósito:** Guía completa para configuración de variables de entorno

**Archivos de configuración:**
- `.env.example` - Plantilla de ejemplo
- `.env.development` - Desarrollo (puerto 3050)
- `.env.production` - Producción (puerto 15350)
- `.env` - Archivo activo actual

**Variables principales:**
```bash
NODE_ENV=development          # Modo de ejecución
FIREBIRD_HOST=127.0.0.1      # Host Firebird
FIREBIRD_PORT=3050           # Puerto (3050=local, 15350=túnel)
FIREBIRD_USER=sysdba         # Usuario BD
FIREBIRD_PASSWORD=masterkey  # Contraseña BD
SERVER_PORT=3005             # Puerto servidor Node.js
```

**Funcionalidad:**
- ✅ Cambio rápido entre modos dev/prod
- ✅ Configuración automática en builds
- ✅ Seguridad mejorada (credenciales en .env)
- ✅ Troubleshooting incluido

### INSTRUCCIONES_USO.md
**Ubicación:** `INSTRUCCIONES_USO.md`  
**Propósito:** Guía de uso de la nueva arquitectura servidor independiente

**Modos de uso:**
1. **Solo servidor** (navegador): `npm run server` → `http://localhost:3005`
2. **Aplicación Electron**: Servidor + `npm start`

**Arquitectura desacoplada:**
- ✅ Servidor Node.js independiente
- ✅ Acceso desde navegador sin Electron
- ✅ Múltiples clientes conectados
- ✅ Facilita desarrollo y debugging

**Configuración:**
- Puerto configurable: `PORT=8080 npm run server`
- Base de datos SQLite en `./datos/panel.sqlite`
- Troubleshooting incluido

---

## 📋 OPERACIONES_TABLA_HTML.json

**Ubicación:** `OPERACIONES_TABLA_HTML.json`  
**Propósito:** Mapa completo de operaciones en tablas HTML  
**Versión:** 1.0.0 (2026-01-04)

### 🏗️ Estructura de Tabla HTML
Define la estructura completa de tablas HTML con 30 columnas:
- **Columna 0:** Número de cuenta
- **Columnas 1-25:** Meses (presupuesto + real × 12)
- **Columna 26-27:** Totales acumulados
- **Columna 28-29:** Totales anuales

### 🎯 Tipos de Filas
1. **section-header-row:** Encabezado de sección
2. **account-row (fila-cuenta):** Fila de cuenta individual
3. **sum-row:** Suma vertical de sección
4. **sum-row-sumavarios:** Resultado operativo
5. **result-row:** Fila de resultado final

### 🔧 Operaciones por Tipo de Fila
Cada tipo de fila tiene operaciones específicas definidas con:
- Pseudocódigo de ejecución
- Dependencias entre celdas
- Triggers de recálculo
- Referencias a código fuente

**Ejemplo - Fila de Cuenta:**
```json
"account-row": {
  "operaciones": {
    "celda_presupuesto_mes": {
      "tipo": "editable",
      "calculo_dependiente": "totales_fila",
      "trigger": "recalcularTotalesFila()",
      "codigo_linea": "1540-1580"
    }
  }
}
```

---

## 🎯 Conclusión de Documentación Expandida

Esta documentación ampliada cubre ahora **todos los archivos principales** del proyecto SummaCham, incluyendo:

✅ **Archivos de configuración y entorno**  
✅ **Scripts de utilidad (PowerShell)**  
✅ **Scripts SQL de inicialización**  
✅ **Documentación principal (README, etc.)**  
✅ **Mapas de operaciones JSON**  
✅ **Arquitectura completa del sistema**  
✅ **Código fuente detallado**  
✅ **Instrucciones de uso y troubleshooting**

El sistema SummaCham es una aplicación financiera empresarial completa con arquitectura modular, seguridad robusta, y funcionalidades avanzadas de gestión de presupuestos y reportes.</content>
<parameter name="filePath">C:\Users\Frida Sophia\Desktop\DESARROLLOS\SummaCham\DOCUMENTACION_COMPLETA.md