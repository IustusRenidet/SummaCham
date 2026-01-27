# Documentación Completa: Sistemas de Colaboración y Control de Calidad

## 📋 Resumen Ejecutivo

Esta documentación detalla los cinco sistemas críticos que hacen funcionar la colaboración y el control de calidad en SummaCham:

1. **🎯 Modo Edición**: Sistema de edición inline de celdas y gestión de borradores
2. **💬 Comentarios**: Sistema de comentarios por celda con respuestas anidadas
3. **🔔 Notificaciones**: Sistema híbrido de notificaciones (local + email)
4. **🔐 Permisos**: Sistema granular de permisos por usuario, empresa y módulo
5. **🔄 Flujo de Autorización**: Workflow completo de aprobación de presupuestos

---

## 📋 Índice de Contenidos con Hipervínculos

### [1. 🎯 Introducción y Alcance](#1--introducción-y-alcance)
- [1.1 Propósito del Documento](#11-propósito-del-documento)
- [1.2 Alcance de los Sistemas](#12-alcance-de-los-sistemas)
- [1.3 Metodología de Documentación](#13-metodología-de-documentación)

### [2. 📚 Librerías y Tecnologías](#2--librerías-y-tecnologías)
- [2.1 Stack Tecnológico Principal](#21-stack-tecnológico-principal)
- [2.2 Dependencias de Producción](#22-dependencias-de-producción)
- [2.3 Dependencias de Desarrollo](#23-dependencias-de-desarrollo)
- [2.4 Librerías por Sistema](#24-librerías-por-sistema)
- [2.5 Versiones y Compatibilidad](#25-versiones-y-compatibilidad)

### [3. 🌐 APIs y Endpoints Completos](#3--apis-y-endpoints-completos)
- [3.1 Arquitectura de la API](#31-arquitectura-de-la-api)
- [3.2 Endpoints de Autenticación](#32-endpoints-de-autenticación)
- [3.3 Endpoints de Usuarios](#33-endpoints-de-usuarios)
- [3.4 Endpoints de Empresas](#34-endpoints-de-empresas)
- [3.5 Endpoints de Módulos](#35-endpoints-de-módulos)
- [3.6 Endpoints de Presupuestos](#36-endpoints-de-presupuestos)
- [3.7 Endpoints de Comentarios](#37-endpoints-de-comentarios)
- [3.8 Endpoints de Notificaciones](#38-endpoints-de-notificaciones)
- [3.9 Endpoints de Backups](#39-endpoints-de-backups)
- [3.10 WebSockets y Tiempo Real](#310-websockets-y-tiempo-real)

### [4. ⚙️ Funcionamiento Paso a Paso](#4--funcionamiento-paso-a-paso)
- [4.1 Inicio de la Aplicación](#41-inicio-de-la-aplicación)
- [4.2 Proceso de Autenticación](#42-proceso-de-autenticación)
- [4.3 Carga de Módulos](#43-carga-de-módulos)
- [4.4 Edición de Datos](#44-edición-de-datos)
- [4.5 Sistema de Comentarios](#45-sistema-de-comentarios)
- [4.6 Flujo de Autorización](#46-flujo-de-autorización)
- [4.7 Generación de Reportes](#47-generación-de-reportes)
- [4.8 Backup Automático](#48-backup-automático)

### [5. 🏗️ Arquitectura General del Sistema](#5--arquitectura-general-del-sistema)
- [5.1 Visión General Arquitectónica](#51-visión-general-arquitectónica)
- [5.2 Tecnologías Utilizadas](#52-tecnologías-utilizadas)
- [5.3 Patrón de Diseño MVC](#53-patrón-de-diseño-mvc)
- [5.4 Arquitectura de Microservicios](#54-arquitectura-de-microservicios)

### [6. 👥 Sistema de Edición Colaborativa](#6--sistema-de-edición-colaborativa)
- [6.1 Descripción General](#61-descripción-general)
- [6.2 Estados del Sistema](#62-estados-del-sistema)
- [6.3 Flujo de Operaciones](#63-flujo-de-operaciones)
- [6.4 Casos de Uso Avanzados](#64-casos-de-uso-avanzados)
- [6.5 Diagramas de Secuencia](#65-diagramas-de-secuencia)

### [7. 💬 Sistema de Comentarios](#7--sistema-de-comentarios)
- [7.1 Arquitectura de Comentarios](#71-arquitectura-de-comentarios)
- [7.2 Tipos de Comentarios](#72-tipos-de-comentarios)
- [7.3 Gestión de Comentarios](#73-gestión-de-comentarios)
- [7.4 Casos de Uso Empresariales](#74-casos-de-uso-empresariales)
- [7.5 Diagramas de Flujo](#75-diagramas-de-flujo)

### [8. 🔔 Sistema de Notificaciones Push](#8--sistema-de-notificaciones-push)
- [8.1 Arquitectura de Notificaciones](#81-arquitectura-de-notificaciones)
- [8.2 Tipos de Notificaciones](#82-tipos-de-notificaciones)
- [8.3 Gestión de Suscripciones](#83-gestión-de-suscripciones)
- [8.4 Casos de Uso en Negocio](#84-casos-de-uso-en-negocio)
- [8.5 Diagramas de Secuencia](#85-diagramas-de-secuencia)

### [9. 🔐 Control de Permisos](#9--control-de-permisos)
- [9.1 Modelo de Permisos](#91-modelo-de-permisos)
- [9.2 Niveles de Acceso](#92-niveles-de-acceso)
- [9.3 Gestión de Roles](#93-gestión-de-roles)
- [9.4 Casos de Uso Empresariales](#94-casos-de-uso-empresariales)
- [9.5 Diagramas de Autorización](#95-diagramas-de-autorización)

### [10. ✅ Flujo de Autorización Completo](#10--flujo-de-autorización-completo)
- [10.1 Estados de Autorización](#101-estados-de-autorización)
- [10.2 Proceso de Aprobación](#102-proceso-de-aprobación)
- [10.3 Validaciones y Reglas](#103-validaciones-y-reglas)
- [10.4 Casos de Uso Avanzados](#104-casos-de-uso-avanzados)
- [10.5 Diagramas de Estado](#105-diagramas-de-estado)

### [11. 📊 Casos de Uso Empresariales Avanzados](#11--casos-de-uso-empresariales-avanzados)
- [11.1 Escenarios de Colaboración](#111-escenarios-de-colaboración)
- [11.2 Casos de Uso por Industria](#112-casos-de-uso-por-industria)
- [11.3 Métricas de Éxito](#113-métricas-de-éxito)
- [11.4 ROI y Beneficios](#114-roi-y-beneficios)

### [12. 🔧 Implementación Técnica Detallada](#12--implementación-técnica-detallada)
- [12.1 Configuración del Entorno](#121-configuración-del-entorno)
- [12.2 Base de Datos y Esquemas](#122-base-de-datos-y-esquemas)
- [12.3 APIs y Endpoints](#123-apis-y-endpoints)
- [12.4 Seguridad y Autenticación](#124-seguridad-y-autenticación)
- [12.5 Optimización de Rendimiento](#125-optimización-de-rendimiento)

### [13. 📈 Monitoreo y Métricas](#13--monitoreo-y-métricas)
- [13.1 KPIs del Sistema](#131-kpis-del-sistema)
- [13.2 Métricas de Rendimiento](#132-métricas-de-rendimiento)
- [13.3 Monitoreo de Calidad](#133-monitoreo-de-calidad)
- [13.4 Alertas y Notificaciones](#134-alertas-y-notificaciones)

### [14. 📁 Documentación de Archivos del Sistema](#14--documentación-de-archivos-del-sistema)
- [14.1 Estructura de Archivos Detallada](#141-estructura-de-archivos-detallada)
- [14.2 Estadísticas del Proyecto](#142-estadísticas-del-proyecto)
- [14.3 Configuración y Dependencias](#143-configuración-y-dependencias)
- [14.4 Guía de Inicio Rápido](#144-guía-de-inicio-rápido)
- [14.5 Métricas de Calidad](#145-métricas-de-calidad)

### [15. 📚 Glosario Técnico](#15--glosario-técnico)
- [15.1 Términos de Negocio](#151-términos-de-negocio)
- [15.2 Términos Técnicos](#152-términos-técnicos)
- [15.3 Arquitectura](#153-arquitectura)

### [16. 🔍 Índice de Referencias](#16--índice-de-referencias)
- [16.1 Referencias Internas](#161-referencias-internas)
- [16.2 Referencias Externas](#162-referencias-externas)

### [17. 📋 Checklist de Implementación](#17--checklist-de-implementación)
- [17.1 Funcionalidades Core Implementadas](#171-funcionalidades-core-implementadas)
- [17.2 Funcionalidades en Desarrollo](#172-funcionalidades-en-desarrollo)
- [17.3 Funcionalidades Planificadas](#173-funcionalidades-planificadas)

### [18. 🎯 Conclusiones y Recomendaciones](#18--conclusiones-y-recomendaciones)
- [18.1 Logros Alcanzados](#181-logros-alcanzados)
- [18.2 Recomendaciones para Futuro Desarrollo](#182-recomendaciones-para-futuro-desarrollo)
- [18.3 Impacto en el Negocio](#183-impacto-en-el-negocio)

### [19. ⚙️ Configuración de Entorno](#19--configuración-de-entorno)
- [19.1 Variables de Entorno (.env)](#191-variables-de-entorno-env)
- [19.2 Configuración por Ambiente](#192-configuración-por-ambiente)
- [19.3 Gestión de Secretos](#193-gestión-de-secretos)

### [20. 🔨 Scripts de Automatización](#20--scripts-de-automatización)
- [20.1 Scripts de Build y Deployment](#201-scripts-de-build-y-deployment)
- [20.2 Scripts de Base de Datos](#202-scripts-de-base-de-datos)
- [20.3 Scripts de Utilidades](#203-scripts-de-utilidades)

### [21. 🧪 Testing y Calidad](#21--testing-y-calidad)
- [21.1 Estrategia de Testing](#211-estrategia-de-testing)
- [21.2 Tests Unitarios](#212-tests-unitarios)
- [21.3 Tests de Integración](#213-tests-de-integración)
- [21.4 QA y Validación](#214-qa-y-validación)

### [22. 🚀 Proceso de Build y Distribución](#22--proceso-de-build-y-distribución)
- [22.1 Build de Desarrollo](#221-build-de-desarrollo)
- [22.2 Build de Producción](#222-build-de-producción)
- [22.3 Distribución y Releases](#223-distribución-y-releases)

### [23. 🔒 Seguridad y Autenticación](#23--seguridad-y-autenticación)
- [23.1 Modelo de Seguridad](#231-modelo-de-seguridad)
- [23.2 Gestión de Sesiones](#232-gestión-de-sesiones)
- [23.3 Encriptación de Datos](#233-encriptación-de-datos)

### [24. 🗄️ Esquemas de Base de Datos](#24--esquemas-de-base-de-datos)
- [24.1 SQLite - Estructura Local](#241-sqlite---estructura-local)
- [24.2 Firebird - Estructura COI](#242-firebird---estructura-coi)
- [24.3 Migraciones y Versionado](#243-migraciones-y-versionado)

### [25. 🔧 Troubleshooting y Solución de Problemas](#25--troubleshooting-y-solución-de-problemas)
- [25.1 Problemas Comunes](#251-problemas-comunes)
- [25.2 Logs y Debugging](#252-logs-y-debugging)
- [25.3 Recuperación de Datos](#253-recuperación-de-datos)

### [26. 📈 Métricas Avanzadas y KPIs](#26--métricas-avanzadas-y-kpis)
- [26.1 KPIs de Rendimiento](#261-kpis-de-rendimiento)
- [26.2 KPIs de Usuario](#262-kpis-de-usuario)
- [26.3 KPIs de Negocio](#263-kpis-de-negocio)

### [27. 🔄 Migraciones y Actualizaciones](#27--migraciones-y-actualizaciones)
- [27.1 Estrategia de Migración](#271-estrategia-de-migración)
- [27.2 Versionado Semántico](#272-versionado-semántico)
- [27.3 Rollbacks y Recuperación](#273-rollbacks-y-recuperación)

### [28. 🌐 APIs y Integraciones](#28--apis-y-integraciones)
- [28.1 Endpoints REST](#281-endpoints-rest)
- [28.2 WebSockets](#282-websockets)
- [28.3 Integraciones Externas](#283-integraciones-externas)

### [29. 💾 Sistema de Backups y WAL](#29--sistema-de-backups-y-wal)
- [29.1 Arquitectura del Sistema de Backups](#291-arquitectura-del-sistema-de-backups)
- [29.2 API de Backups](#292-api-de-backups)
- [29.3 Configuración de Backups](#293-configuración-de-backups)
- [29.4 Sistema WAL (Write-Ahead Logging)](#294-sistema-wal-write-ahead-logging)
- [29.5 Características del Sistema](#295-características-del-sistema)
- [29.6 Monitoreo y Logs](#296-monitoreo-y-logs)

### [30. 🔄 Sistema de Auto-Update](#30--sistema-de-auto-update)
- [30.1 Arquitectura del Sistema](#301-arquitectura-del-sistema)
- [30.2 Flujo de Actualización](#302-flujo-de-actualización)
- [30.3 Configuración Técnica](#303-configuración-técnica)
- [30.4 Eventos y Estados](#304-eventos-y-estados)
- [30.5 Interfaz de Usuario](#305-interfaz-de-usuario)
- [30.6 Manejo de Errores](#306-manejo-de-errores)
- [30.7 Monitoreo y Logs](#307-monitoreo-y-logs)
- [30.8 Casos de Uso Empresariales](#308-casos-de-uso-empresariales)
- [30.9 Próximos Pasos Recomendados](#309-próximos-pasos-recomendados)

### [31. 📦 Proceso de Releases](#31--proceso-de-releases)
- [31.1 Estrategia de Versionado](#311-estrategia-de-versionado)
- [31.2 Proceso de Build](#312-proceso-de-build)
- [31.3 Publicación en GitHub](#313-publicación-en-github)
- [31.4 Scripts de Automatización](#314-scripts-de-automatización)
- [31.5 Checklist de Release](#315-checklist-de-release)
- [31.6 Validación de Releases](#316-validación-de-releases)
- [31.7 Rollback y Recuperación](#317-rollback-y-recuperación)
- [31.8 Casos de Uso Empresariales](#318-casos-de-uso-empresariales)

### [32. 🔧 Scripts de Automatización](#32--scripts-de-automatización)
- [32.1 Scripts de Build y Deployment](#321-scripts-de-build-y-deployment)
- [32.2 Scripts de Gestión de Módulos Nativos](#322-scripts-de-gestión-de-módulos-nativos)
- [32.3 Scripts de Base de Datos](#323-scripts-de-base-de-datos)
- [32.4 Scripts de Utilidades](#324-scripts-de-utilidades)
- [32.5 Scripts de Testing](#325-scripts-de-testing)
- [32.6 Scripts de Publicación](#326-scripts-de-publicación)
- [32.7 Casos de Uso Empresariales](#327-casos-de-uso-empresariales)

## 1. 🎯 Introducción y Alcance

### 1.1 Propósito del Documento

Esta documentación completa describe los **cinco sistemas críticos** que conforman la base de la colaboración y el control de calidad en SummaCham:

1. **Sistema de Modo Edición** - Edición inline de celdas con control de permisos
2. **Sistema de Comentarios** - Comentarios anidados por celda con notificaciones
3. **Sistema de Notificaciones** - Notificaciones híbridas (local + email)
4. **Sistema de Permisos** - Control granular de acceso por usuario/empresa/módulo
5. **Flujo de Autorización** - Workflow completo de aprobación de presupuestos

### 1.2 Alcance de los Sistemas

Los sistemas documentados abarcan:
- **Frontend**: Interfaz de usuario en Electron + JavaScript vanilla
- **Backend**: APIs REST en Node.js/Express con SQLite/Firebird
- **Base de Datos**: Estructuras locales y COI (Contabilidad Operativa Integrada)
- **Seguridad**: JWT, bcryptjs, permisos granulares
- **Comunicación**: WebSockets para tiempo real
- **Integraciones**: SMTP, LDAP, COI, webhooks

### 1.3 Metodología de Documentación

Esta documentación sigue un enfoque estructurado:
- **Arquitectura primero**: Diagramas y flujos de alto nivel
- **Implementación técnica**: Código y configuraciones detalladas
- **Casos de uso**: Ejemplos prácticos de negocio
- **Troubleshooting**: Solución de problemas comunes
- **Optimización**: Mejores prácticas de rendimiento

---

## 2. 📚 Librerías y Tecnologías

### 2.1 Stack Tecnológico Principal

SummaCham utiliza un stack moderno de tecnologías web y de escritorio:

#### **Frontend (Electron + Web Technologies)**
- **Electron**: Framework para aplicaciones de escritorio multiplataforma
- **HTML5/CSS3**: Interfaz de usuario moderna y responsiva
- **Vanilla JavaScript**: Lógica del lado del cliente sin frameworks pesados
- **Bootstrap/Material Design**: Componentes UI consistentes

#### **Backend (Node.js + Express)**
- **Node.js**: Runtime de JavaScript del lado del servidor
- **Express.js**: Framework web minimalista y flexible
- **RESTful APIs**: Arquitectura de servicios web
- **WebSockets**: Comunicación en tiempo real

#### **Base de Datos**
- **SQLite**: Base de datos local con WAL para concurrencia
- **Firebird**: Base de datos COI (Contabilidad Operativa Integrada)
- **Better SQLite3**: Driver nativo de alto rendimiento

#### **Seguridad y Autenticación**
- **JWT (JSON Web Tokens)**: Autenticación stateless
- **bcryptjs**: Hashing seguro de contraseñas
- **Helmet**: Headers de seguridad HTTP
- **express-session**: Gestión de sesiones del lado del servidor

### 2.2 Dependencias de Producción

#### **Base de Datos y Conectividad**
`json
{
  "better-sqlite3": "^12.5.0",
  "better-sqlite3-session-store": "^0.1.0",
  "node-firebird": "^1.1.9"
}
`

#### **Servidor Web y APIs**
`json
{
  "express": "^5.1.0",
  "helmet": "^8.1.0",
  "cookie-parser": "^1.4.7",
  "express-session": "^1.18.2"
}
`

#### **Seguridad**
`json
{
  "bcryptjs": "^3.0.3",
  "jsonwebtoken": "^9.0.3"
}
`

#### **Utilidades y Herramientas**
`json
{
  "xlsx": "^0.18.5",
  "csv-parse": "^6.1.0",
  "nodemailer": "^7.0.10",
  "auto-launch": "^5.0.6",
  "electron-updater": "^6.6.2"
}
`

### 2.3 Dependencias de Desarrollo

#### **Build y Empaquetado**
`json
{
  "electron": "^39.2.7",
  "electron-builder": "^25.1.8",
  "electron-rebuild": "^3.2.9",
  "esbuild": "^0.27.1"
}
`

#### **Herramientas de Desarrollo**
`json
{
  "cross-env": "^7.0.3"
}
`

### 2.4 Librerías por Sistema

#### **Sistema de Comentarios**
`javascript
// Librerías utilizadas:
- express (servidor web)
- better-sqlite3 (base de datos)
- jsonwebtoken (autenticación)
- nodemailer (notificaciones email)
`

#### **Sistema de Notificaciones**
`javascript
// Librerías utilizadas:
- nodemailer (envío de emails)
- express (APIs REST)
- better-sqlite3 (almacenamiento local)
- jsonwebtoken (autenticación usuarios)
`

#### **Sistema de Permisos**
`javascript
// Librerías utilizadas:
- express (middleware de rutas)
- better-sqlite3 (consultas de permisos)
- jsonwebtoken (verificación de tokens)
- joi (validación de datos)
`

#### **Flujo de Autorización**
`javascript
// Librerías utilizadas:
- express (APIs de estado)
- better-sqlite3 (persistencia de estados)
- nodemailer (notificaciones de cambios)
- jsonwebtoken (autorización de acciones)
`

#### **Sistema de Backups**
`javascript
// Librerías utilizadas:
- fs (sistema de archivos)
- path (manejo de rutas)
- better-sqlite3 (base de datos)
- crypto (checksums de archivos)
`

### 2.5 Versiones y Compatibilidad

#### **Matriz de Versiones**
| Librería | Versión | Node.js | Electron | Estado |
|----------|---------|---------|----------|--------|
| better-sqlite3 | 12.5.0 | 14+ | 39.2.7 | ✅ Estable |
| node-firebird | 1.1.9 | 14+ | 39.2.7 | ✅ Estable |
| express | 5.1.0 | 14+ | N/A | ✅ Estable |
| electron | 39.2.7 | 18.17+ | N/A | ✅ LTS |

#### **Compatibilidad de Sistemas Operativos**
- **Windows**: 10, 11 (x64, ia32)
- **macOS**: 10.13+ (x64, arm64)
- **Linux**: Ubuntu 18.04+, CentOS 7+ (x64)

---

## 3. 🌐 APIs y Endpoints Completos

### 3.1 Arquitectura de la API

SummaCham utiliza una arquitectura RESTful con los siguientes principios:

#### **Estructura General**
`
API Base: /api
Versión: v1 (implícita)
Formato: JSON
Autenticación: JWT + Session Cookies
`

#### **Códigos de Estado HTTP**
- **200 OK**: Operación exitosa
- **201 Created**: Recurso creado
- **400 Bad Request**: Datos inválidos
- **401 Unauthorized**: No autenticado
- **403 Forbidden**: Permisos insuficientes
- **404 Not Found**: Recurso no encontrado
- **500 Internal Server Error**: Error del servidor

#### **Formato de Respuesta Estándar**
`json
{
  "success": true,
  "data": { /* datos de respuesta */ },
  "message": "Operación exitosa",
  "timestamp": "2024-01-15T10:30:00Z"
}
`

### 3.2 Endpoints de Autenticación

#### **POST /api/auth/login**
Inicio de sesión de usuarios.

**Request:**
`json
{
  "usuario": "jgarcia",
  "password": "contraseña_segura"
}
`

**Response:**
`json
{
  "success": true,
  "data": {
    "usuario": {
      "id": 1,
      "usuario": "jgarcia",
      "nombres": "Juan García",
      "rol": "contador"
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "sessionId": "abc123..."
  }
}
`

### 3.3 Endpoints de Usuarios

#### **GET /api/usuarios**
Lista de usuarios con paginación.

**Parámetros Query:**
- page: Número de página (default: 1)
- limit: Registros por página (default: 20)
- mpresa: Filtrar por empresa

### 3.4 Endpoints de Empresas

#### **GET /api/empresas**
Lista de empresas disponibles.

### 3.5 Endpoints de Módulos

#### **GET /api/modulos/:codigo/layout**
Layout de un módulo específico.

### 3.6 Endpoints de Presupuestos

#### **GET /api/presupuestos**
Lista de presupuestos por empresa y módulo.

#### **POST /api/presupuestos/:id/estado**
Cambiar estado del flujo de autorización.

### 3.7 Endpoints de Comentarios

#### **GET /api/comentarios**
Obtener comentarios con filtros.

#### **POST /api/comentarios**
Crear nuevo comentario.

### 3.8 Endpoints de Notificaciones

#### **GET /api/notificaciones**
Obtener notificaciones del usuario actual.

### 3.9 Endpoints de Backups

#### **GET /api/backups**
Lista de backups disponibles.

### 3.10 WebSockets y Tiempo Real

#### **Conexión WebSocket**
`javascript
// Cliente se conecta al servidor WebSocket
const ws = new WebSocket('ws://localhost:3005');

// Autenticación inicial
ws.send(JSON.stringify({
  tipo: 'autenticar',
  token: localStorage.getItem('jwt_token'),
  usuarioId: sessionStorage.getItem('usuario_id')
}));
`

---

## 4. ⚙️ Funcionamiento Paso a Paso

### 4.1 Inicio de la Aplicación

#### **Paso 1: Lanzamiento de Electron**
`javascript
// main.js - Punto de entrada
const { app, BrowserWindow } = require('electron');

// Verificación de instancia única
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

// Creación de ventana principal
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Cargar aplicación web
  mainWindow.loadURL('http://localhost:3005');
}
`

### 4.2 Proceso de Autenticación

#### **Paso 1: Pantalla de Login**
`html
<!-- vistas/login.html -->
<form id="loginForm">
  <input type="text" id="usuario" placeholder="Usuario">
  <input type="password" id="password" placeholder="Contraseña">
  <button type="submit">Iniciar Sesión</button>
</form>
`

### 4.3 Carga de Módulos

#### **Paso 1: Selección de Empresa y Módulo**
`javascript
// Usuario selecciona empresa y módulo
async function cargarModulo(empresaId, modulo, anio) {
  try {
    // 1. Verificar permisos
    const permisos = await verificarPermisos(empresaId, modulo);
    
    if (!permisos.puede_leer) {
      throw new Error('Sin permisos para acceder al módulo');
    }
    
    // 2. Cargar layout del módulo
    const layout = await fetch(/api/modulos//layout?anio=&empresa=)
      .then(r => r.json());
    
    // 3. Cargar datos del presupuesto
    const datos = await fetch(/api/presupuestos?empresa=&modulo=&anio=)
      .then(r => r.json());
    
    // 4. Renderizar interfaz
    renderizarTabla(layout.data.layout, datos.data);
    
    // 5. Inicializar funcionalidades
    inicializarModoEdicion(permisos);
    inicializarComentarios();
    inicializarNotificaciones();
    
  } catch (error) {
    mostrarError(Error al cargar módulo: );
  }
}
`

### 4.4 Edición de Datos

#### **Paso 1: Activación del Modo Edición**
`javascript
// flujo-autorizacion.js
class FlujoAutorizacion {
  constructor() {
    this.estadoActual = 'SIN_CARGAR';
    this.modoEdicion = false;
  }
  
  async cargarPresupuesto(params) {
    // 1. Verificar permisos
    const permisos = await this.verificarPermisosUsuario(params.empresaId, params.modulo);
    
    if (!permisos.puede_cargar_guardar) {
      throw new Error('Sin permisos para editar');
    }
    
    // 2. Cargar datos del presupuesto
    const presupuesto = await this.cargarDatosPresupuesto(params);
    
    // 3. Determinar estado inicial
    this.estadoActual = presupuesto.estado || 'EDITANDO';
    
    // 4. Activar modo edición si corresponde
    if (this.estadoActual === 'EDITANDO') {
      this._activarModoEdicion();
    }
    
    return presupuesto;
  }
  
  _activarModoEdicion() {
    if (this.modoEdicion) return;
    
    this.modoEdicion = true;
    
    // Aplicar clase CSS para modo edición
    const tabla = document.getElementById('tablaPresupuesto');
    if (tabla) {
      tabla.classList.add('modo-edicion');
    }
    
    // Notificar a otros componentes
    window.dispatchEvent(new CustomEvent('modo-edicion-activado'));
    
    console.log('🟢 Modo edición activado');
  }
}
`

### 4.5 Sistema de Comentarios

#### **Paso 1: Carga de Comentarios**
`javascript
// comentarios-celdas.js
async function cargarComentarios(celdaId) {
  try {
    const params = new URLSearchParams({
      empresaId: sessionStorage.getItem('empresa_actual'),
      modulo: sessionStorage.getItem('modulo_actual'),
      celdaId: celdaId,
      anio: sessionStorage.getItem('anio_actual')
    });
    
    const response = await fetch(/api/comentarios?, {
      headers: {
        'Authorization': Bearer 
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      return organizarComentariosAnidados(result.data.comentarios);
    } else {
      throw new Error(result.message);
    }
    
  } catch (error) {
    console.error('Error cargando comentarios:', error);
    return [];
  }
}
`

### 4.6 Flujo de Autorización

#### **Paso 1: Cambio de Estado**
`javascript
// flujo-autorizacion.js
async function cambiarEstado(nuevoEstado, comentario = '') {
  try {
    // 1. Validar transición
    if (!this.puedeCambiarEstado(this.estadoActual, nuevoEstado)) {
      throw new Error('Transición de estado no permitida');
    }
    
    // 2. Verificar permisos
    const permisosRequeridos = this.getPermisosParaEstado(nuevoEstado);
    if (!this.usuarioTienePermisos(permisosRequeridos)) {
      throw new Error('Permisos insuficientes para esta acción');
    }
    
    // 3. Preparar datos
    const datosCambio = {
      empresaId: this.empresaActual,
      modulo: this.moduloActual,
      anio: this.anioActual,
      nuevoEstado: nuevoEstado,
      comentario: comentario.trim(),
      usuarioId: this.usuarioActual.id
    };
    
    // 4. Enviar al servidor
    const response = await fetch('/api/presupuestos/estado', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': Bearer 
      },
      body: JSON.stringify(datosCambio)
    });
    
    const result = await response.json();
    
    if (result.success) {
      // 5. Actualizar estado local
      const estadoAnterior = this.estadoActual;
      this.estadoActual = nuevoEstado;
      
      // 6. Actualizar UI
      this.actualizarInterfazEstado();
      
      // 7. Registrar en historial
      this.registrarCambioHistorial(estadoAnterior, nuevoEstado, comentario);
      
      // 8. Generar notificaciones
      await this.generarNotificacionesCambioEstado(estadoAnterior, nuevoEstado, comentario);
      
      // 9. Broadcast vía WebSocket
      this.notificarCambioEstadoWebSocket(datosCambio);
      
      return true;
    } else {
      throw new Error(result.message);
    }
    
  } catch (error) {
    console.error('Error cambiando estado:', error);
    mostrarError(Error al cambiar estado: );
    return false;
  }
}
`

---

## 📋 Resumen Ejecutivo

| Sistema | Tecnología | Almacenamiento | Notificaciones | Estados |
|---------|------------|----------------|----------------|---------|
| **Modo Edición** | JavaScript + DOM | Session/LocalStorage | ❌ | Activo/Inactivo |
| **Comentarios** | SQLite + JavaScript | comentarios_celdas | ✅ Automáticas | activo/descartado/rechazado |
| **Notificaciones** | SQLite + Nodemailer | 
otificaciones | ✅ Email + UI | leída/no leída |
| **Permisos** | SQLite + Middleware | permisos_modulo | ❌ | CRUD por módulo |
| **Flujo Autorización** | JavaScript + API | presupuestos_estados | ✅ Automáticas | 7 estados |

---

## 🔧 Detalles Técnicos Avanzados

### Modo Edición - Implementación Técnica

#### **Inicialización del Sistema**
`javascript
// En flujo-autorizacion.js
_activarModoEdicion() {
  if (this.modoEdicion) return;
  this.modoEdicion = true;
  this.cambiosEdicion = {};
  
  // Activar clase CSS
  if (this.tableElement) {
    this.tableElement.classList.add('modo-edicion');
  }
  
  // Notificar a otros componentes
  this._actualizarBotones();
  window.dispatchEvent(new CustomEvent('modo-edicion-activado'));
}
`

### Comentarios - Arquitectura Técnica

#### **Estructura de Datos Anidados**
`javascript
// Ejemplo de estructura de comentarios
{
  id: 1,
  texto: "Este valor parece incorrecto",
  estado: "activo",
  creadoEn: "2024-01-15T10:30:00Z",
  autor: { id: 5, usuario: "jgarcia", nombres: "Juan García" },
  respuestas: [
    {
      id: 2,
      texto: "Tienes razón, voy a corregirlo",
      parentId: 1,
      estado: "activo",
      creadoEn: "2024-01-15T11:00:00Z",
      autor: { id: 3, usuario: "mlopez", nombres: "María López" }
    }
  ]
}
`

### Notificaciones - Sistema Híbrido

#### **Configuración SMTP**
`javascript
// En .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=notificaciones@amcham.org
SMTP_PASS=password_app
SMTP_FROM=notificaciones@amcham.org
`

### Permisos - Lógica de Verificación Avanzada

#### **Middleware de Autenticación**
`javascript
// src/middleware/auth.js
const verificarPermisos = (req, res, next) => {
  const { empresaId, modulo } = req.body;
  const usuarioId = req.session.usuario?.id;
  
  if (!usuarioId) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  
  // Verificar permisos
  const permisos = obtenerPermisosUsuario(usuarioId);
  const tieneAcceso = tienePermisoModulo(permisos, empresaId, modulo, 'Lectura');
  
  if (!tieneAcceso) {
    return res.status(403).json({ error: 'Permisos insuficientes' });
  }
  
  next();
};
`

### Flujo de Autorización - Estados y Transiciones

#### **Máquina de Estados**
`javascript
const TRANSICIONES_VALIDAS = {
  EDITANDO: ['PENDIENTE', 'RECHAZADO'],
  PENDIENTE: ['REVISADO', 'RECHAZADO'],
  REVISADO: ['APROBADO', 'RECHAZADO'],
  APROBADO: ['GUARDADO', 'RECHAZADO'],
  RECHAZADO: ['EDITANDO'],
  GUARDADO: [], // Estado final
  SIN_CARGAR: ['EDITANDO']
};

function puedeCambiarEstado(estadoActual, estadoNuevo, permisosUsuario) {
  // Verificar transición válida
  if (!TRANSICIONES_VALIDAS[estadoActual]?.includes(estadoNuevo)) {
    return false;
  }
  
  // Verificar permisos específicos
  switch(estadoNuevo) {
    case 'PENDIENTE':
      return permisosUsuario.puede_cargar_guardar;
    case 'REVISADO':
      return permisosUsuario.puede_revisar;
    case 'APROBADO':
    case 'GUARDADO':
      return permisosUsuario.puede_aprobar;
    default:
      return true;
  }
}
`

---

## 💡 Ejemplos Prácticos de Uso

### Ejemplo 1: Crear un Borrador con Comentarios

`javascript
// 1. Usuario carga presupuesto
flujoAutorizacion.cargarPresupuesto({
  empresaId: 1,
  modulo: 'FINANZAS',
  anio: 2024
});

// 2. Sistema activa modo edición
// 3. Usuario edita celdas y agrega comentarios
comentariosService.crearComentario({
  empresaId: 1,
  modulo: 'FINANZAS',
  celdaId: 'mesActual_401000',
  anio: 2024,
  texto: 'Este valor parece alto, verificar con contabilidad'
});

// 4. Usuario guarda borrador
flujoAutorizacion.guardarBorrador({
  comentario: 'Primer borrador con ajustes en gastos operativos'
});

// 5. Sistema envía notificaciones automáticamente
notificacionesService.registrarNotificacionesMasivas(
  usuariosConPermisoRevisar,
  {
    titulo: 'Nuevo borrador para revisión',
    mensaje: 'Juan García ha enviado un borrador de FINANZAS 2024 para revisión',
    tipo: 'info',
    enlace: '/finanzas?anio=2024&estado=PENDIENTE'
  }
);
`

### Ejemplo 2: Flujo Completo de Aprobación

`javascript
// Estado inicial: SIN_CARGAR
// Usuario con permisos de edición carga presupuesto
await flujoAutorizacion.cargarPresupuesto(params);
// Estado: EDITANDO

// Usuario edita valores y guarda
await flujoAutorizacion.guardarBorrador({ comentario: 'Ajustes iniciales' });

// Usuario envía a revisión
await flujoAutorizacion.enviarARevision({ comentario: 'Listo para revisión' });
// Estado: PENDIENTE
// Notificación automática a revisores

// Revisor marca como revisado
await flujoAutorizacion.marcarComoRevisado({ comentario: 'Revisado y aprobado' });
// Estado: REVISADO
// Notificación automática a aprobadores

// Aprobador autoriza
await flujoAutorizacion.autorizar({ comentario: 'Autorizado para guardar en COI' });
// Estado: APROBADO

// Aprobador guarda en COI
await flujoAutorizacion.guardarEnCOI();
// Estado: GUARDADO
// Notificación automática a todos los involucrados
`

### Ejemplo 3: Sistema de Comentarios con Respuestas

`javascript
// Comentario inicial
const comentarioInicial = await comentariosService.crearComentario({
  empresaId: 1,
  modulo: 'RESUMEN',
  celdaId: 'acumuladoActual_100000',
  anio: 2024,
  texto: '¿Por qué este valor es negativo?'
});

// Respuesta al comentario
const respuesta = await comentariosService.crearComentario({
  empresaId: 1,
  modulo: 'RESUMEN',
  celdaId: 'acumuladoActual_100000',
  anio: 2024,
  texto: 'Es una corrección de período anterior',
  parentId: comentarioInicial.id
});

// Marcar comentario como resuelto
await comentariosService.cambiarEstadoComentario(comentarioInicial.id, 'descartado');

// Sistema envía notificaciones
await notificacionesService.registrarNotificacion({
  usuarioId: comentarioInicial.autor.id,
  titulo: 'Comentario respondido',
  mensaje: 'Tu comentario en RESUMEN ha sido respondido',
  tipo: 'success',
  enlace: /resumen?anio=2024&celda=
});
`

---

## 🔍 Debugging y Monitoreo

### Logs Importantes

#### **Modo Edición**
`javascript
console.log('🟢 ModoEdicionPresupuesto: listeners inicializados (NO activo)');
console.log('🟢 ModoEdicionPresupuesto: ACTIVADO (celdas numéricas editables)');
console.log('🔴 Error al activar modo edición:', error);
`

#### **Comentarios**
`javascript
console.log('💬 Comentario creado:', comentarioId);
console.log('📧 Notificaciones enviadas:', destinatarios.length);
console.warn('⚠️ Error al crear comentario:', error);
`

#### **Notificaciones**
`javascript
console.log('🔔 Notificación registrada:', notificacionId);
console.info('📧 Email enviado correctamente');
console.warn('⚠️ SMTP no configurado, notificación solo local');
`

#### **Permisos**
`javascript
console.log('🔐 Verificando permisos:', { usuarioId, empresaId, modulo, accion });
console.log('✅ Permiso concedido');
console.warn('❌ Permiso denegado:', razon);
`

#### **Flujo de Autorización**
`javascript
console.log('🔄 Transición de estado:', { anterior: estadoActual, nuevo: estadoNuevo });
console.log('✅ Estado actualizado correctamente');
console.error('❌ Error en transición:', error);
`

### Herramientas de Debugging

#### **Verificar Estado del Sistema**
`javascript
// En consola del navegador
console.table({
  'Modo Edición': document.querySelector('#tablaComparacion')?.classList.contains('modo-edicion'),
  'Estado Flujo': window.flujoAutorizacion?.estadoActual,
  'Permisos Usuario': window.sesion?.usuario?.permisosGenerales,
  'Comentarios Cargados': window.comentariosCargados || false
});
`

#### **Inspeccionar Notificaciones**
`javascript
// Ver notificaciones pendientes
fetch('/api/notificaciones?limite=10')
  .then(r => r.json())
  .then(data => console.table(data.notificaciones));
`

#### **Verificar Permisos en Tiempo Real**
`javascript
// Verificar permisos actuales
const permisos = window.sesion?.usuario?.permisosPorEmpresa || {};
console.log('Permisos por empresa:', permisos);
`

---

## 🚀 Mejoras Futuras y Roadmap

### Fase 1 (Próximos 3 meses)
- [ ] **Colaboración simultánea** con WebSockets
- [ ] **Historial de versiones** de borradores
- [ ] **Validaciones automáticas** de fórmulas
- [ ] **Comentarios con @menciones**

### Fase 2 (Próximos 6 meses)
- [ ] **Integración con Microsoft Teams/Slack**
- [ ] **Aprobaciones móviles** (PWA)
- [ ] **Análisis de tendencias** en comentarios
- [ ] **Flujos de aprobación condicionales**

### Fase 3 (Próximos 12 meses)
- [ ] **IA para detección de anomalías**
- [ ] **Automatización de flujos** con machine learning
- [ ] **Integración completa con ERP**
- [ ] **Dashboards ejecutivos** en tiempo real

---

## 📞 Soporte y Contacto

### Canales de Comunicación
- **Issues en GitHub**: Para bugs y feature requests
- **Documentación Interna**: Este archivo y archivos relacionados
- **Equipo de Desarrollo**: Para consultas técnicas específicas

### Checklist de Implementación
- [ ] Revisar permisos del usuario
- [ ] Verificar configuración SMTP para notificaciones
- [ ] Confirmar carga de scripts de comentarios
- [ ] Validar estados del flujo de autorización
- [ ] Probar modo edición en diferentes módulos

---

*Documentación actualizada: 2026-01-26 18:26:15*
*Versión: 2.0*
*Autor: SummaCham Development Team*

---

## 33. 📁 **Rutas de Bases de Datos en SummaCham**

### **33.1 Base de Datos SQLite Local (`panel.sqlite`)**

#### **📍 Ubicaciones por Prioridad:**
```javascript
// Código en src/db/sqlite.js - función obtenerRutaBaseDatos()
1. PANELAMCHAM_DATA_DIR (variable de entorno)
2. ./datos/ (carpeta local del proyecto)
3. userData/datos/ (directorio de datos de Electron)
4. ./datos/ (fallback al directorio actual)
```

#### **🎯 Propósitos de SQLite:**
- **Layouts de módulos**: Almacena configuraciones de vistas personalizadas
- **Sesiones de usuario**: Persistencia de sesiones con `better-sqlite3-session-store`
- **Comentarios por celda**: Sistema de comentarios anidados
- **Notificaciones locales**: Historial de notificaciones no enviadas por email
- **Permisos de usuario**: Control granular de acceso por empresa/módulo
- **Estados del flujo de autorización**: Tracking de estados de presupuestos
- **Backups automáticos**: Metadatos de copias de seguridad
- **Configuraciones de usuario**: Preferencias personales

#### **📊 Estructura de Tablas SQLite:**
```sql
-- Sesiones activas
sessions (sid, sess, expire)

-- Layouts de módulos
layout_cuentas, layout_modulos, layout_config

-- Sistema de comentarios
comentarios_celdas (id, texto, estado, autor, respuestas)

-- Notificaciones
notificaciones (id, usuario_id, titulo, mensaje, tipo, leida)

-- Permisos
permisos_modulo (usuario_id, empresa_id, modulo, permisos)

-- Estados de autorización
presupuestos_estados (empresa_id, modulo, anio, estado, usuario_id)
```

### **33.2 Base de Datos Firebird (COI - Contabilidad Operativa Integrada)**

#### **📍 Configuración de Conexión:**
```javascript
// Variables de entorno (.env)
FIREBIRD_HOST=127.0.0.1          // Desarrollo: localhost
FIREBIRD_PORT=3050               // Desarrollo: directo
FIREBIRD_PORT=15350              // Producción: túnel TCP
FIREBIRD_USER=sysdba
FIREBIRD_PASSWORD=masterkey
```

#### **🎯 Propósitos de Firebird:**
- **Datos maestros**: Catálogos de cuentas, empresas, módulos
- **Presupuestos reales**: Datos financieros oficiales (PRESUPYY, CUENTASYY)
- **Saldos contables**: Información financiera histórica
- **Guardado final**: Almacenamiento definitivo de presupuestos autorizados

#### **🔗 Tablas Principales en Firebird:**
```sql
-- Empresas y módulos
EMPRESAS, MODULOS

-- Datos presupuestarios
PRESUPYY (anio, empresa, cuenta, mes1..mes12)
CUENTASYY (anio, empresa, cuenta, descripcion)

-- Saldos reales
SALDOSYY (anio, empresa, cuenta, saldo_real)
```

---

## 34. 📦 **Instalador NSIS (Nullsoft Scriptable Install System)**

### **34.1 Configuración en `package.json`:**

```json
"nsis": {
  "oneClick": false,                    // Instalar silenciosamente
  "perMachine": false,                  // Instalar por usuario (no admin)
  "allowElevation": true,               // Permitir elevación si es necesario
  "allowToChangeInstallationDirectory": true,  // Usuario elige carpeta
  "installerIcon": "icono/icono.ico",   // Ícono del instalador
  "uninstallerIcon": "icono/icono.ico", // Ícono del desinstalador
  "createDesktopShortcut": true,        // Acceso directo en escritorio
  "createStartMenuShortcut": true,      // Acceso directo en menú inicio
  "shortcutName": "Panel AMCHAM",       // Nombre del acceso directo
  "displayLanguageSelector": false,     // Sin selector de idioma
  "deleteAppDataOnUninstall": false     // NO borrar datos al desinstalar
}
```

### **34.2 Funcionalidades del Instalador NSIS:**

#### **📁 Archivos Incluidos:**
```javascript
// En package.json -> "files": [...]
"main.js", "src/**/*", "vistas/**/*", "icono/**/*",
"image/**/*", "mds/**/*", "scripts/**/*", 
"native_modules/**/*", ".env.production",
"node_modules/**/*", "package.json", "README.md"
```

#### **📦 Recursos Extra:**
```javascript
// En package.json -> "extraResources"
{
  "from": "datos", "to": "datos",        // Base de datos SQLite
  "from": "excels", "to": "excels",      // Plantillas Excel
  "from": "info IMPORTANTE", "to": "info_importante",  // Documentación
  "from": "IMPLEMENTACIONES", "to": "IMPLEMENTACIONES" // Scripts
}
```

#### **🚀 Proceso de Instalación:**
1. **Verificación de requisitos**: Comprueba .NET Framework, Visual C++
2. **Selección de directorio**: Usuario elige carpeta de instalación
3. **Copia de archivos**: Extrae aplicación y recursos
4. **Registro del desinstalador**: En Windows Add/Remove Programs
5. **Creación de accesos directos**: Escritorio y menú inicio
6. **Configuración inicial**: Variables de entorno, asociaciones de archivos

#### **🔧 Comandos de Build:**
```bash
# Build con NSIS
npm run dist              # electron-builder --win nsis
npm run build:all         # electron-builder --win nsis,portable
```

---

## 35. 🍪 **Sistema de Cookies, Local Storage y Session Storage**

### **35.1 🍪 Cookies HTTP (Backend - Express Sessions)**

#### **📍 Configuración en `src/server.js`:**
```javascript
app.use(session({
  store: new SqliteStore({ client: getDb() }),  // Almacenamiento en SQLite
  secret: process.env.SESSION_SECRET,
  name: 'panelamcham.sid',                       // Nombre de la cookie
  resave: false,
  saveUninitialized: false,
  rolling: true,                                 // Renovar en cada request
  cookie: {
    secure: process.env.NODE_ENV === 'production' ? 'auto' : false,
    httpOnly: true,                              // No accesible desde JavaScript
    maxAge: 30 * 60 * 1000,                      // 30 minutos
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    domain: process.env.COOKIE_DOMAIN             // Para dominios personalizados
  }
}));
```

#### **🎯 Usos de las Cookies:**
- **Autenticación de sesión**: Mantener usuario logueado
- **Persistencia de sesión**: Sobrevivir reinicios del navegador
- **Seguridad**: `httpOnly` previene ataques XSS
- **Dominios**: Soporte para túneles HTTPS y subdominios

### **35.2 💾 Local Storage (Frontend - Persistencia Local)**

#### **📍 Implementación en `vistas/js/sesion.js`:**
```javascript
const STORAGE_KEY = 'sesionUsuario';              // Clave principal
const CONTEXTO_KEY = 'planeacionContexto';        // Contexto de navegación

// Guardar sesión completa
localStorage.setItem(STORAGE_KEY, JSON.stringify(datos));

// Cargar sesión al iniciar
const datos = localStorage.getItem(STORAGE_KEY);
```

#### **🎯 Usos del Local Storage:**
- **Sesión de usuario**: Datos del usuario logueado (id, nombre, permisos)
- **Contexto de navegación**: Empresa activa, módulo, año seleccionado
- **Preferencias de UI**: Estados de colapso, configuraciones visuales
- **Layouts guardados**: Configuraciones de vistas personalizadas
- **Estados de formularios**: Borradores no guardados

#### **🔄 Funciones de Gestión:**
```javascript
// vistas/js/sesion.js
obtenerSesion()     // Cargar datos de usuario
guardarSesion()     // Persistir cambios
limpiarSesion()     // Logout completo

// vistas/js/seccion-collapse.js
guardarEstado()     // Estados de UI colapsados
cargarEstado()      // Restaurar estados al cargar
```

### **35.3 🔄 Session Storage (Frontend - Sesión Temporal)**

#### **📍 Uso Principal:**
```javascript
// En formularios y navegación temporal
sessionStorage.setItem('formulario-activo', 'presupuesto-editar');
sessionStorage.setItem('pagina-anterior', window.location.href);

// Recuperar al volver
const formulario = sessionStorage.getItem('formulario-activo');
```

#### **🎯 Usos del Session Storage:**
- **Navegación temporal**: Páginas visitadas, breadcrumbs
- **Estados de formularios**: Datos no guardados durante la sesión
- **Filtros activos**: Configuraciones de búsqueda temporales
- **Modo edición**: Estado temporal durante edición

### **35.4 🔐 Seguridad y Gestión de Datos**

#### **🛡️ Medidas de Seguridad:**
```javascript
// Cookies: httpOnly, secure, sameSite
// Local Storage: Validación de integridad
// Session Storage: Limpieza automática al cerrar navegador

// En sesion.js - Validación de datos
try {
  const datos = JSON.parse(localStorage.getItem(STORAGE_KEY));
  // Validar estructura y tipos
  if (datos && typeof datos === 'object') {
    return datos;
  }
} catch (error) {
  // Limpiar datos corruptos
  localStorage.removeItem(STORAGE_KEY);
}
```

#### **📊 Comparación de Almacenamientos:**

| Característica | Cookies | Local Storage | Session Storage |
|----------------|---------|---------------|-----------------|
| **Capacidad** | 4KB | 5-10MB | 5-10MB |
| **Persistencia** | Configurable | Permanente | Sesión del tab |
| **Acceso JS** | ❌ httpOnly | ✅ | ✅ |
| **Envío HTTP** | ✅ Automático | ❌ Manual | ❌ Manual |
| **Seguridad** | Alta (httpOnly) | Media | Media |
| **Uso típico** | Sesiones | Configuración | Estados temporales |

### **35.5 🔄 Sincronización y Eventos**

#### **📡 Eventos de Cambio:**
```javascript
// En sesion.js - Eventos personalizados
window.dispatchEvent(new CustomEvent('sesion:cambiada', { 
  detail: { usuario: nuevoUsuario } 
}));

window.dispatchEvent(new CustomEvent('sesion:empresa-cambiada', { 
  detail: { empresa: nuevaEmpresa } 
}));
```

#### **🔄 Sincronización entre Pestañas:**
```javascript
// Detectar cambios en otras pestañas
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) {
    // Recargar sesión desde localStorage
    location.reload();
  }
});
```

---

## 🎯 **Resumen Ejecutivo - Infraestructura Técnica**

### **📁 Bases de Datos:**
- **SQLite**: Local, layouts, sesiones, comentarios, permisos, notificaciones
- **Firebird**: COI, datos maestros, presupuestos oficiales, saldos contables
- **Rutas**: Variables de entorno → carpeta local → userData → fallback

### **📦 NSIS:**
- **Instalador**: Completo con accesos directos, desinstalador
- **Archivos**: App empaquetada + recursos (datos, excels, docs)
- **Configuración**: Por usuario, sin elevación, con shortcuts

### **🍪 Almacenamiento Web:**
- **Cookies**: Sesiones seguras, httpOnly, SQLite backend
- **Local Storage**: Configuración persistente, layouts, preferencias
- **Session Storage**: Estados temporales, navegación, formularios

Este sistema garantiza **persistencia robusta**, **seguridad** y **experiencia de usuario fluida** tanto en instalación como en uso diario.

---

*Documentación actualizada: 2026-01-26 18:26:15*
*Versión: 2.1 - Infraestructura Técnica Completa*
*Autor: SummaCham Development Team*

---

## 36. ⚙️ **Variables de Entorno y Secretos en SummaCham**

### **36.1 Arquitectura de Variables de Entorno**

SummaCham utiliza un sistema sofisticado de variables de entorno que se adapta automáticamente según el modo de ejecución (desarrollo/producción) y genera secretos seguros automáticamente.

#### **📁 Sistema de Archivos de Configuración:**
```
.env.example           # Plantilla con todas las variables posibles
.env.development       # Variables específicas de desarrollo
.env.production        # Variables específicas de producción
.env.production.example # Ejemplo de producción con túnel TCP
.env.secrets           # Secretos generados automáticamente (NO versionar)
```

#### **🔄 Prioridad de Carga:**
1. **Variables del sistema** (más alta prioridad)
2. **Archivo `.env.{NODE_ENV}`** (desarrollo/producción)
3. **Valores por defecto** (más baja prioridad)

---

### **36.2 Variables de Entorno Principales**

#### **🎯 Variables de Modo y Puerto:**
```bash
# Modo de ejecución
NODE_ENV=development|production

# Puerto del servidor backend
PORT=3005
SERVER_PORT=3005
```

#### **🔥 Variables de Base de Datos Firebird:**
```bash
# Conexión Firebird
FIREBIRD_HOST=127.0.0.1          # Host del servidor
FIREBIRD_PORT=3050               # Puerto (3050 directo, 15350 túnel)
FIREBIRD_USER=sysdba             # Usuario de Firebird
FIREBIRD_PASSWORD=masterkey      # Contraseña de Firebird
```

#### **🔐 Variables de Secretos y Seguridad:**
```bash
# Secretos JWT (generados automáticamente)
PANELAMCHAM_JWT_SECRET=...       # Secreto para tokens JWT
PANELAMCHAM_REFRESH_SECRET=...   # Secreto para refresh tokens

# Secreto de sesiones
SESSION_SECRET=...               # Secreto para express-session

# Contraseñas de usuarios
PANELAMCHAM_ADMIN_PASSWORD=...   # Contraseña del usuario ICONET
ICONET_PASSWORD=...              # Alias alternativo
```

#### **📧 Variables de Correo Electrónico (SMTP):**
```bash
# Configuración SMTP para notificaciones
SMTP_HOST=smtp.gmail.com         # Servidor SMTP
SMTP_PORT=587                    # Puerto SMTP
SMTP_SECURE=false                # true para SSL, false para TLS
SMTP_USER=notificaciones@amcham.org  # Usuario SMTP
SMTP_PASS=password_app           # Contraseña SMTP
SMTP_FROM=notificaciones@amcham.org # Remitente por defecto
```

#### **💾 Variables de Backups:**
```bash
# Configuración del sistema de backups
BACKUP_ENABLED=true              # Habilitar/deshabilitar backups
BACKUP_INTERVAL_MINUTES=60       # Intervalo en minutos
BACKUP_MAX_BACKUPS=24            # Máximo número de backups
BACKUP_PATH=/ruta/backups        # Ruta personalizada (opcional)
```

#### **🌐 Variables de CORS y Cookies:**
```bash
# Orígenes permitidos para CORS (separados por comas)
PANELAMCHAM_ALLOW_ORIGINS=http://localhost:3005,https://panelamcham.iconetcloud.com.mx

# Dominio para cookies cross-site
COOKIE_DOMAIN=.iconetcloud.com.mx
```

#### **📂 Variables de Rutas Personalizadas:**
```bash
# Directorio personalizado para datos
PANELAMCHAM_DATA_DIR=/ruta/personalizada/datos

# Base de datos semilla para inicialización
PANELAMCHAM_SEED_DB=/ruta/base/semilla.sqlite
```

#### **🐛 Variables de Debug:**
```bash
# Debug de fórmulas en reportes
DEBUG_NET_FORMULAS=1
```

---

### **36.3 Sistema de Secretos Automáticos**

#### **📍 Ubicación de los Secretos:**
```bash
# En desarrollo: ./datos/.env.secrets
# En producción: %APPDATA%/panelamcham/datos/.env.secrets (Windows)
#               ~/Library/Application Support/panelamcham/datos/.env.secrets (macOS)
#               ~/.config/panelamcham/datos/.env.secrets (Linux)
```

#### **🔄 Generación Automática:**
```javascript
// src/utils/secretsManager.js
const generarSecretoSeguro = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Genera 3 secretos de 32 bytes cada uno (256 bits)
PANELAMCHAM_JWT_SECRET: generarSecretoSeguro(32),
SESSION_SECRET: generarSecretoSeguro(32),
PANELAMCHAM_REFRESH_SECRET: generarSecretoSeguro(32)
```

#### **🛡️ Características de Seguridad:**
- **Longitud**: 256 bits (32 bytes) cada secreto
- **Algoritmo**: crypto.randomBytes() (criptográficamente seguro)
- **Formato**: Hexadecimal
- **Permisos**: 0o600 (solo lectura para propietario)
- **Persistencia**: Se guardan automáticamente en archivo seguro

---

### **36.4 Configuración por Ambiente**

#### **🛠️ Desarrollo Local (.env.development):**
```bash
NODE_ENV=development
FIREBIRD_HOST=127.0.0.1
FIREBIRD_PORT=3050
FIREBIRD_USER=sysdba
FIREBIRD_PASSWORD=masterkey
SERVER_PORT=3005
```

#### **🏭 Producción con Túnel (.env.production):**
```bash
NODE_ENV=production
FIREBIRD_HOST=127.0.0.1
FIREBIRD_PORT=15350
FIREBIRD_USER=sysdba
FIREBIRD_PASSWORD=masterkey
SERVER_PORT=3005
PANELAMCHAM_ALLOW_ORIGINS=https://panelamcham.iconetcloud.com.mx
COOKIE_DOMAIN=.iconetcloud.com.mx
```

#### **📋 Plantilla Completa (.env.example):**
```bash
# ============================================
# CONFIGURACIÓN DE ENTORNO - SummaCham
# ============================================

# --- MODO DE EJECUCIÓN ---
NODE_ENV=development

# --- PUERTO DEL SERVIDOR ---
PORT=3005

# --- SECRETO PARA SESIONES ---
SESSION_SECRET=CAMBIAR_POR_UN_SECRETO_SEGURO_ALEATORIO

# --- CONTRASEÑA DEL ADMINISTRADOR ---
PANELAMCHAM_ADMIN_PASSWORD=CAMBIAR_POR_CONTRASEÑA_SEGURA

# --- CONFIGURACIÓN FIREBIRD ---
FIREBIRD_HOST=127.0.0.1
FIREBIRD_PORT=3050
FIREBIRD_USER=sysdba
FIREBIRD_PASSWORD=masterkey

# --- CONFIGURACIÓN SERVIDOR HTTP ---
SERVER_PORT=3005

# --- CONFIGURACIÓN SMTP (OPCIONAL) ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario@email.com
SMTP_PASS=contraseña_app
SMTP_FROM=notificaciones@email.com

# --- CONFIGURACIÓN BACKUPS (OPCIONAL) ---
BACKUP_ENABLED=true
BACKUP_INTERVAL_MINUTES=60
BACKUP_MAX_BACKUPS=24
BACKUP_PATH=/ruta/backups

# --- CONFIGURACIÓN CORS (OPCIONAL) ---
PANELAMCHAM_ALLOW_ORIGINS=http://localhost:3005,https://midominio.com
COOKIE_DOMAIN=.midominio.com

# --- RUTAS PERSONALIZADAS (OPCIONAL) ---
PANELAMCHAM_DATA_DIR=/ruta/datos
PANELAMCHAM_SEED_DB=/ruta/semilla.sqlite
```

---

### **36.5 Gestión de Secretos en Producción**

#### **🔒 Archivo .env.secrets (Generado Automáticamente):**
```bash
PANELAMCHAM_JWT_SECRET=a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890
SESSION_SECRET=b2c3d4e5f6789012345678901234567890123456789012345678901234567890123
PANELAMCHAM_REFRESH_SECRET=c3d4e5f67890123456789012345678901234567890123456789012345678901234
```

#### **🚀 Inicialización en Electron:**
```javascript
// main.js - Se ejecuta al iniciar la aplicación
const { inicializarSecretos } = require("./src/utils/secretsManager");
const userDataPath = app.getPath('userData');

// Genera/verifica secretos antes de configurar entorno
inicializarSecretos(path.join(userDataPath, 'datos'));
```

#### **🔍 Verificación de Secretos:**
```javascript
// src/server.js - Verifica que existan secretos válidos
const asegurarSecretos = () => {
  const jwtSecret = process.env.PANELAMCHAM_JWT_SECRET || "";
  const sessionSecret = process.env.SESSION_SECRET || "";
  
  if (!jwtSecret || !sessionSecret) {
    throw new Error("Secretos no configurados");
  }
};
```

---

### **36.6 Variables de Entorno por Categoría**

#### **📊 Resumen Completo:**

| Variable | Tipo | Requerida | Desarrollo | Producción | Descripción |
|----------|------|-----------|------------|------------|-------------|
| `NODE_ENV` | string | ✅ | `development` | `production` | Modo de ejecución |
| `PORT` | number | ✅ | `3005` | `3005` | Puerto del servidor |
| `SERVER_PORT` | number | ✅ | `3005` | `3005` | Puerto backend |
| `FIREBIRD_HOST` | string | ✅ | `127.0.0.1` | `127.0.0.1` | Host Firebird |
| `FIREBIRD_PORT` | number | ✅ | `3050` | `15350` | Puerto Firebird |
| `FIREBIRD_USER` | string | ✅ | `sysdba` | `sysdba` | Usuario Firebird |
| `FIREBIRD_PASSWORD` | string | ✅ | `masterkey` | `masterkey` | Contraseña Firebird |
| `PANELAMCHAM_JWT_SECRET` | string | ✅ | Auto | Auto | Secreto JWT |
| `SESSION_SECRET` | string | ✅ | Auto | Auto | Secreto sesiones |
| `PANELAMCHAM_REFRESH_SECRET` | string | ✅ | Auto | Auto | Secreto refresh |
| `PANELAMCHAM_ADMIN_PASSWORD` | string | ❌ | Auto | Auto | Contraseña admin |
| `SMTP_HOST` | string | ❌ | - | `smtp.gmail.com` | Servidor SMTP |
| `SMTP_PORT` | number | ❌ | - | `587` | Puerto SMTP |
| `SMTP_SECURE` | boolean | ❌ | - | `false` | SSL/TLS |
| `SMTP_USER` | string | ❌ | - | `usuario@email` | Usuario SMTP |
| `SMTP_PASS` | string | ❌ | - | `password` | Contraseña SMTP |
| `SMTP_FROM` | string | ❌ | - | `notif@email` | Remitente |
| `BACKUP_ENABLED` | boolean | ❌ | `true` | `true` | Habilitar backups |
| `BACKUP_INTERVAL_MINUTES` | number | ❌ | `60` | `60` | Intervalo backups |
| `BACKUP_MAX_BACKUPS` | number | ❌ | `24` | `24` | Máx backups |
| `BACKUP_PATH` | string | ❌ | - | `/ruta` | Ruta backups |
| `PANELAMCHAM_ALLOW_ORIGINS` | string | ❌ | - | `urls` | CORS origins |
| `COOKIE_DOMAIN` | string | ❌ | - | `.dominio` | Dominio cookies |
| `PANELAMCHAM_DATA_DIR` | string | ❌ | - | `/ruta` | Directorio datos |
| `PANELAMCHAM_SEED_DB` | string | ❌ | - | `/ruta` | DB semilla |
| `DEBUG_NET_FORMULAS` | string | ❌ | `1` | - | Debug fórmulas |

---

### **36.7 Ubicaciones de Archivos de Configuración**

#### **📂 Estructura de Archivos:**
```
SummaCham/
├── .env.example                    # Plantilla completa
├── .env.development               # Config desarrollo
├── .env.production               # Config producción
├── .env.production.example       # Ejemplo producción
└── datos/
    └── .env.secrets              # Secretos generados (NO versionar)
```

#### **🔒 Archivo .env.secrets (NO versionar):**
- **Ubicación**: `datos/.env.secrets`
- **Permisos**: `0o600` (solo propietario)
- **Contenido**: 3 secretos de 256 bits cada uno
- **Generación**: Automática al primer inicio
- **Persistencia**: Se mantiene entre reinicios

#### **📋 Archivos .env (versionar plantillas):**
- **`.env.example`**: Plantilla completa con ejemplos
- **`.env.development`**: Configuración específica de desarrollo
- **`.env.production`**: Configuración específica de producción
- **`.env.production.example`**: Ejemplo de configuración de producción

---

### **36.8 Comandos para Gestionar Variables**

#### **🔍 Ver Variables Actuales:**
```bash
# En desarrollo
npm run start

# En producción
npm run dist
```

#### **🔄 Regenerar Secretos:**
```javascript
// Eliminar .env.secrets y reiniciar aplicación
rm datos/.env.secrets
npm start
```

#### **📊 Ver Configuración Activa:**
```javascript
// En consola del navegador (desarrollo)
console.log('Variables de entorno:', process.env);
```

---

## 🎯 **Resumen Ejecutivo - Variables de Entorno**

### **⚙️ Arquitectura:**
- **Sistema híbrido**: Archivos `.env` + secretos automáticos
- **Adaptativo**: Configuración diferente por ambiente
- **Seguro**: Secretos generados criptográficamente
- **Persistente**: Configuración se mantiene entre reinicios

### **🔐 Secretos:**
- **3 secretos principales**: JWT, Session, Refresh
- **Generación automática**: 256 bits cada uno
- **Almacenamiento seguro**: Archivo con permisos restrictivos
- **No versionados**: Nunca en control de versiones

### **🌍 Variables por Ambiente:**
- **Desarrollo**: Configuración local, puerto directo Firebird
- **Producción**: Túnel TCP, dominios personalizados, CORS restringido

Este sistema garantiza **seguridad robusta**, **configuración flexible** y **facilidad de despliegue** en cualquier ambiente.

---

*Documentación actualizada: 2026-01-26 18:26:15*
*Versión: 2.2 - Variables de Entorno y Secretos*
*Autor: SummaCham Development Team*

---

## 37. 📜 **Scripts PowerShell (.ps1) en SummaCham**

### **37.1 Arquitectura de Scripts PowerShell**

SummaCham utiliza **scripts PowerShell** para automatizar tareas comunes de desarrollo, despliegue y mantenimiento. Estos scripts están diseñados para **Windows** y proporcionan una interfaz de línea de comandos para operaciones complejas.

#### **📂 Ubicación de Scripts:**
```
SummaCham/
├── cambiar-modo.ps1              # 🔄 Cambio entre entornos
├── limpiar-cache-icono.ps1       # 🧹 Limpieza de caché Windows
└── scripts/
    ├── publish-update.ps1        # 🚀 Publicación de releases
    ├── audit-security.ps1        # 🔒 Auditoría de seguridad
    ├── agregar-toggle-redondeo.ps1 # ⚙️ Configuración UI
    ├── export-resumen-charts.ps1 # 📊 Exportación de gráficos
    ├── export-operativo-charts.ps1 # 📈 Gráficos operativos
    └── export-operativo-charts-ui.ps1 # 🎨 UI de gráficos
```

#### **🎯 Propósitos Principales:**
- **Gestión de entornos**: Cambio rápido entre desarrollo/producción
- **Automatización de builds**: Compilación y empaquetado
- **Mantenimiento**: Limpieza de cachés, auditorías de seguridad
- **Despliegue**: Publicación de releases en GitHub
- **Configuración**: Modificaciones masivas en archivos

---

### **37.2 Script Principal: cambiar-modo.ps1**

#### **🎯 Propósito:**
Cambia rápidamente entre configuraciones de **desarrollo** y **producción** copiando el archivo `.env` correspondiente.

#### **📝 Sintaxis:**
```powershell
# Cambiar a desarrollo
.\cambiar-modo.ps1 dev
.\cambiar-modo.ps1 development

# Cambiar a producción
.\cambiar-modo.ps1 prod
.\cambiar-modo.ps1 production
```

#### **⚙️ Funcionamiento Interno:**
```powershell
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('dev', 'prod', 'development', 'production')]
    [string]$Modo
)

# Normalizar modo
$ModoFinal = switch ($Modo) {
    'dev' { 'development' }
    'prod' { 'production' }
    default { $Modo }
}

# Copiar archivo de configuración
Copy-Item ".env.$ModoFinal" ".env" -Force
```

#### **🔄 Diferencias entre Entornos:**

**Desarrollo (.env.development):**
```bash
NODE_ENV=development
FIREBIRD_PORT=3050          # Acceso directo a Firebird
# Configuración local, CORS permisivo
```

**Producción (.env.production):**
```bash
NODE_ENV=production
FIREBIRD_PORT=15350         # Túnel TCP a Firebird remoto
PANELAMCHAM_ALLOW_ORIGINS=https://panelamcham.iconetcloud.com.mx
COOKIE_DOMAIN=.iconetcloud.com.mx
```

#### **📊 Salida del Script:**
```powershell
✅ Modo cambiado a: development

📋 Configuración activa (.env):
   NODE_ENV=development
   FIREBIRD_HOST=127.0.0.1
   FIREBIRD_PORT=3050
   ...

🚀 Ahora puedes ejecutar:
   npm start
```

#### **🎯 Casos de Uso:**
- **Desarrollo diario**: `.\cambiar-modo.ps1 dev`
- **Testing de producción**: `.\cambiar-modo.ps1 prod`
- **Despliegue**: Cambiar a prod antes de build

---

### **37.3 Script de Mantenimiento: limpiar-cache-icono.ps1**

#### **🎯 Propósito:**
Limpia el **caché de iconos de Windows** que puede causar problemas con los iconos de la aplicación después de actualizaciones.

#### **📝 Sintaxis:**
```powershell
.\limpiar-cache-icono.ps1
```

#### **⚙️ Funcionamiento Interno:**
```powershell
# 1. Eliminar IconCache.db
$iconCachePath = "$env:LOCALAPPDATA\IconCache.db"
Remove-Item -Path $iconCachePath -Force

# 2. Eliminar archivos de thumbnail cache
Get-ChildItem -Path $thumbCachePath -Filter "thumbcache_*.db" |
    ForEach-Object { Remove-Item $_.FullName -Force }

# 3. Reiniciar Explorer (opcional)
taskkill /f /im explorer.exe
Start-Process explorer.exe
```

#### **🔧 Archivos que Limpia:**
- **`IconCache.db`**: Base de datos principal de iconos
- **`thumbcache_*.db`**: Archivos de caché de miniaturas
- **Reinicio de Explorer**: Para aplicar cambios

#### **📊 Salida del Script:**
```powershell
🧹 Limpiando caché de iconos de Windows...
✅ IconCache.db eliminado
✅ thumbcache_1024.db eliminado
✅ thumbcache_256.db eliminado

📝 Pasos adicionales:
  1. Reiniciar el Explorador de Windows
  2. Ejecutar: taskkill /f /im explorer.exe && start explorer.exe
  3. O reiniciar el PC

¿Deseas reiniciar el Explorador de Windows ahora? (S/N)
```

#### **🎯 Casos de Uso:**
- **Después de actualizar iconos**: Limpiar caché para ver cambios
- **Iconos distorsionados**: Recuperar apariencia correcta
- **Problemas de visualización**: Mantenimiento preventivo

---

### **37.4 Script de Publicación: scripts/publish-update.ps1**

#### **🎯 Propósito:**
Automatiza el **proceso completo de publicación** de una nueva versión de SummaCham, desde la compilación hasta la preparación para GitHub Release.

#### **📝 Sintaxis:**
```powershell
.\scripts\publish-update.ps1 -Version "1.2.3" -ReleaseNotes "Descripción de cambios"
```

#### **⚙️ Funcionamiento Interno - Pasos:**

**Paso 1: Actualizar package.json**
```powershell
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$oldVersion = $packageJson.version
$packageJson.version = $Version
$packageJson | ConvertTo-Json -Depth 100 | Set-Content "package.json"
```

**Paso 2: Compilar aplicación**
```powershell
npm run build  # electron-builder genera instaladores
```

**Paso 3: Verificar archivos generados**
```powershell
# Verifica que existan:
# - SummaCham Setup 1.2.3.exe (64-bit installer)
# - SummaCham Setup 1.2.3-ia32.exe (32-bit installer)  
# - SummaCham 1.2.3.exe (64-bit portable)
# - SummaCham 1.2.3-ia32.exe (32-bit portable)
# - latest.yml (auto-updater manifest)
```

**Paso 4: Crear commit y tag**
```powershell
git add package.json
git commit -m "Bump version to 1.2.3"
git tag -a "v1.2.3" -m "Release v1.2.3: Descripción de cambios"
```

**Paso 5: Instrucciones para GitHub**
```powershell
# Comandos para ejecutar después:
git push origin main
git push origin v1.2.3

# Crear release en GitHub con los archivos generados
```

#### **📦 Archivos Generados:**
- **Instaladores**: `.exe` para instalación tradicional
- **Portables**: `.exe` para ejecución sin instalación
- **Manifest**: `latest.yml` para auto-actualizaciones

#### **🎯 Casos de Uso:**
- **Release oficial**: Publicar nueva versión completa
- **Hotfix**: Actualización rápida de bug
- **Feature release**: Nueva funcionalidad importante

---

### **37.5 Script de Seguridad: scripts/audit-security.ps1**

#### **🎯 Propósito:**
Realiza una **auditoría completa de seguridad** antes de hacer push al repositorio, verificando que no se incluya información sensible.

#### **📝 Sintaxis:**
```powershell
.\scripts\audit-security.ps1
```

#### **🔍 Verificaciones que Realiza:**

**1. Archivos sensibles no versionados:**
```powershell
# Verificar .env
if (Test-Path ".env") {
    $gitIgnored = git check-ignore .env
    if (!$gitIgnored) {
        "❌ CRÍTICO: .env existe y NO está en .gitignore"
    }
}

# Verificar datos/
if (Test-Path "datos") {
    $gitIgnored = git check-ignore datos
    if (!$gitIgnored) {
        "❌ CRÍTICO: datos/ NO está en .gitignore"
    }
}
```

**2. Contraseñas hardcodeadas:**
```powershell
git grep -i "password.*=.*['\`"].*['\`"]" -- "*.js" "*.json"
```

**3. Variables de entorno expuestas:**
```powershell
# Buscar uso de process.env en archivos versionados
git grep "process\.env\." -- "*.js" "*.html"
```

**4. Archivos temporales:**
```powershell
# Verificar archivos que deberían estar ignorados
Get-ChildItem -Path "." -Filter "*.tmp" -Recurse
```

#### **📊 Salida del Script:**
```powershell
🔍 Auditando información sensible en el repositorio...

1. Verificando archivos .env...
   ✓ .env está ignorado correctamente

2. Verificando carpeta datos/...
   ✓ datos/ está ignorado correctamente

3. Verificando seed_users.json...
   ✓ seed_users.json está ignorado correctamente

4. Buscando contraseñas hardcodeadas...
   ✓ No se encontraron contraseñas hardcodeadas

✅ Auditoría completada exitosamente
```

#### **🎯 Casos de Uso:**
- **Antes de commit**: Verificar seguridad del código
- **Antes de push**: Asegurar no se suba información sensible
- **Auditoría periódica**: Mantenimiento de seguridad

---

### **37.6 Scripts de Configuración: scripts/agregar-toggle-redondeo.ps1**

#### **🎯 Propósito:**
Agrega automáticamente la **funcionalidad de toggle de redondeo** a todos los módulos HTML de SummaCham.

#### **📝 Sintaxis:**
```powershell
.\scripts\agregar-toggle-redondeo.ps1
```

#### **⚙️ Funcionamiento Interno:**
```powershell
$modulos = @(
    @{Archivo='Finanzas.html'; Modulo='finanzas'},
    @{Archivo='Comités.html'; Modulo='comites'},
    # ... más módulos
)

foreach ($mod in $modulos) {
    # 1. Agregar script toggle-redondeo.js
    # 2. Agregar clase controls-container
    # 3. Agregar inicialización del toggle
}
```

#### **🔧 Modificaciones que Realiza:**

**1. Agregar script:**
```html
<script src="js/toggle-redondeo.js"></script>
```

**2. Modificar contenedor:**
```html
<!-- Antes -->
<div class="workflow-toolbar">

<!-- Después -->
<div class="workflow-toolbar controls-container">
```

**3. Agregar inicialización:**
```javascript
// Inicializar toggle de redondeo
if (window.ToggleRedondeo) {
  ToggleRedondeo.inicializar({
    containerSelector: '.controls-container',
    storageKey: 'finanzas_redondear'
  });
}
```

#### **🎯 Casos de Uso:**
- **Nueva funcionalidad**: Agregar feature a todos los módulos
- **Mantenimiento**: Actualización masiva de configuración
- **Consistencia**: Asegurar mismo comportamiento en todos los módulos

---

### **37.7 Scripts de Exportación: export-*.ps1**

#### **🎯 Propósito:**
Automatizan la **exportación de gráficos y reportes** para diferentes módulos de SummaCham.

#### **📝 Sintaxis:**
```powershell
.\scripts\export-resumen-charts.ps1
.\scripts\export-operativo-charts.ps1
.\scripts\export-operativo-charts-ui.ps1
```

#### **⚙️ Funcionamiento:**
- **Conectan a Firebird**: Obtienen datos reales
- **Generan gráficos**: Usan librerías de charting
- **Exportan imágenes**: PNG/SVG para documentación
- **Actualizan UI**: Modifican interfaces según necesidad

#### **🎯 Casos de Uso:**
- **Documentación**: Generar gráficos para manuales
- **Testing**: Verificar visualización de datos
- **Mantenimiento**: Actualizar assets gráficos

---

### **37.8 Gestión de Entornos con Scripts PowerShell**

#### **🔄 Cambio entre Desarrollo y Producción:**

**Flujo de Trabajo Típico:**
```powershell
# 1. Desarrollo diario
.\cambiar-modo.ps1 dev
npm start

# 2. Testing de producción
.\cambiar-modo.ps1 prod
npm run dist

# 3. Publicar release
.\scripts\publish-update.ps1 -Version "1.2.3" -ReleaseNotes "Nueva funcionalidad"
```

#### **🌍 Variables que Cambian por Entorno:**

| Variable | Desarrollo | Producción | Efecto |
|----------|------------|------------|---------|
| `NODE_ENV` | `development` | `production` | Modo de ejecución |
| `FIREBIRD_PORT` | `3050` | `15350` | Conexión DB |
| `PANELAMCHAM_ALLOW_ORIGINS` | Permisivo | Restringido | CORS |
| `COOKIE_DOMAIN` | - | `.dominio.com` | Cookies |

#### **🔒 Seguridad por Entorno:**
- **Desarrollo**: Secretos de ejemplo, CORS abierto
- **Producción**: Secretos reales, CORS restringido, HTTPS

---

### **37.9 Mejores Prácticas con Scripts PowerShell**

#### **🛡️ Seguridad:**
```powershell
# Verificar permisos antes de ejecutar
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "⚠️ Se requieren permisos de administrador" -ForegroundColor Yellow
}
```

#### **📊 Logging:**
```powershell
# Logging consistente
Write-Host "✅ Operación exitosa" -ForegroundColor Green
Write-Host "❌ Error encontrado" -ForegroundColor Red
Write-Host "⚠️ Advertencia" -ForegroundColor Yellow
Write-Host "ℹ️ Información" -ForegroundColor Cyan
```

#### **🔄 Validación:**
```powershell
# Verificar prerrequisitos
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Ejecutar desde raíz del proyecto" -ForegroundColor Red
    exit 1
}
```

#### **🎯 Casos de Uso Empresariales:**
- **Desarrollo Ágil**: Cambio rápido entre entornos
- **CI/CD**: Automatización de builds y releases
- **Mantenimiento**: Tareas de limpieza y actualización
- **Seguridad**: Auditorías antes de despliegue

---

## 🎯 **Resumen Ejecutivo - Scripts PowerShell**

### **📜 Arquitectura:**
- **Scripts modulares**: Cada uno tiene responsabilidad específica
- **Interfaz consistente**: Parámetros validados, logging claro
- **Automatización**: Eliminan tareas manuales repetitivas
- **Multi-entorno**: Soporte nativo para dev/prod

### **🔄 Gestión de Entornos:**
- **`cambiar-modo.ps1`**: Cambio rápido entre configuraciones
- **Variables dinámicas**: Adaptación automática por entorno
- **Validación**: Verificación de archivos y configuración

### **🚀 Funcionalidades:**
- **Desarrollo**: Cambio de modo, limpieza de caché
- **Build**: Compilación, empaquetado, publicación
- **Seguridad**: Auditorías, verificación de información sensible
- **Mantenimiento**: Configuración masiva, exportación de datos

Este sistema de scripts proporciona una **experiencia de desarrollo fluida** y **despliegue automatizado**, permitiendo cambiar entre entornos de manera segura y eficiente.

---

*Documentación actualizada: 2026-01-26 18:26:15*
*Versión: 2.3 - Scripts PowerShell y Gestión de Entornos*
*Autor: SummaCham Development Team*

---

## 38. 📚 **Librerías Principales y Dependencias**

### **38.1 Arquitectura de Dependencias**

SummaCham utiliza un **ecosistema completo de librerías** organizadas por capas funcionales. Cada librería tiene un propósito específico en la arquitectura de la aplicación.

#### **📂 Estructura por Capas:**
```
SummaCham/
├── Backend (Node.js/Express)
│   ├── Seguridad: helmet, bcryptjs, jsonwebtoken
│   ├── Base de Datos: better-sqlite3, node-firebird
│   ├── APIs: express, joi, express-session
│   └── Utilidades: xlsx, csv-parse, nodemailer
├── Frontend (HTML/CSS/JS)
│   ├── Gráficos: Chart.js
│   ├── UI: Bootstrap, jQuery
│   └── Utilidades: Moment.js, Lodash
└── Desktop (Electron)
    ├── Actualizaciones: electron-updater
    ├── Sistema: auto-launch
    └── Empaquetado: electron-builder
```

---

### **38.2 Librerías de Seguridad**

#### **🔒 Helmet - Headers de Seguridad HTTP**

**📦 Versión:** `^8.1.0`  
**🎯 Finalidad:** Configura automáticamente headers HTTP seguros para proteger contra vulnerabilidades web comunes.

**Funciones principales:**
- **Content Security Policy (CSP)**: Previene ataques XSS
- **X-Frame-Options**: Evita clickjacking
- **X-Content-Type-Options**: Previene MIME sniffing
- **Strict-Transport-Security**: Fuerza HTTPS
- **Referrer-Policy**: Controla información de referrer

**Uso en SummaCham:**
```javascript
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://panelamcham.iconetcloud.com.mx"]
    }
  }
}));
```

**Impacto:** Protege todas las rutas API y páginas web contra ataques comunes.

#### **🔐 bcryptjs - Hashing de Contraseñas**

**📦 Versión:** `^3.0.3`  
**🎯 Finalidad:** Genera y verifica hashes seguros de contraseñas usando el algoritmo bcrypt.

**Funciones principales:**
- **Hashing unidireccional**: Convierte contraseñas en hashes irreversibles
- **Salt automático**: Agrega entropía para prevenir ataques rainbow table
- **Configurable cost**: Ajusta la complejidad del hashing

**Uso en SummaCham:**
```javascript
const bcrypt = require('bcryptjs');

// Hashing de contraseña nueva
const hashedPassword = await bcrypt.hash(password, 12);

// Verificación de contraseña
const isValid = await bcrypt.compare(password, hashedPassword);
```

**Impacto:** Protege las contraseñas de usuarios en la base de datos SQLite.

#### **🎫 jsonwebtoken - Autenticación JWT**

**📦 Versión:** `^9.0.3`  
**🎯 Finalidad:** Implementa autenticación stateless usando JSON Web Tokens.

**Funciones principales:**
- **Generación de tokens**: Crea tokens firmados con datos de usuario
- **Verificación de tokens**: Valida tokens en requests
- **Refresh tokens**: Maneja renovación de sesiones

**Uso en SummaCham:**
```javascript
const jwt = require('jsonwebtoken');

// Generar token de acceso
const token = jwt.sign(
  { userId: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '8h' }
);

// Verificar token en middleware
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

**Impacto:** Maneja autenticación de usuarios en APIs REST y sesiones web.

---

### **38.3 Librerías de Base de Datos**

#### **🗄️ better-sqlite3 - Base de Datos Local**

**📦 Versión:** `^12.5.0`  
**🎯 Finalidad:** Driver nativo de alto rendimiento para SQLite con bindings C++.

**Funciones principales:**
- **Consultas preparadas**: Previene SQL injection
- **Transacciones**: Soporte completo para ACID
- **Performance**: Más rápido que sqlite3 tradicional
- **Sincronía**: API síncrona más simple

**Uso en SummaCham:**
```javascript
const Database = require('better-sqlite3');
const db = new Database('panel.sqlite');

// Consulta preparada
const stmt = db.prepare('SELECT * FROM usuarios WHERE id = ?');
const user = stmt.get(userId);

// Transacción
const transaction = db.transaction((data) => {
  // Operaciones atómicas
});
```

**Impacto:** Gestiona datos locales de usuarios, layouts, configuraciones y caché.

#### **🔥 node-firebird - Conexión Firebird**

**📦 Versión:** `^1.1.9`  
**🎯 Finalidad:** Driver nativo para conectar con bases de datos Firebird/InterBase.

**Funciones principales:**
- **Conexiones remotas**: Soporte para TCP/IP y túneles
- **Consultas complejas**: Manejo de stored procedures y triggers
- **Transacciones**: Soporte completo para Firebird transactions
- **Tipos de datos**: Mapeo correcto de tipos Firebird a JavaScript

**Uso en SummaCham:**
```javascript
const Firebird = require('node-firebird');

// Configuración de conexión
const options = {
  host: process.env.FIREBIRD_HOST,
  port: process.env.FIREBIRD_PORT,
  database: process.env.FIREBIRD_DATABASE,
  user: process.env.FIREBIRD_USER,
  password: process.env.FIREBIRD_PASSWORD
};

// Ejecutar consulta
Firebird.attach(options, (err, database) => {
  database.query('SELECT * FROM PRESUPUESTO', (err, result) => {
    // Procesar datos financieros
  });
});
```

**Impacto:** Conecta con sistemas legacy de AMCHAM para datos presupuestarios.

#### **💾 better-sqlite3-session-store - Sesiones en SQLite**

**📦 Versión:** `^0.1.0`  
**🎯 Finalidad:** Almacena sesiones de Express.js en base de datos SQLite.

**Funciones principales:**
- **Persistencia**: Sesiones sobreviven reinicios de servidor
- **Performance**: Consultas optimizadas para sesiones
- **Limpieza automática**: Elimina sesiones expiradas

**Uso en SummaCham:**
```javascript
const SqliteStore = require('better-sqlite3-session-store')(session);

app.use(session({
  store: new SqliteStore({
    client: db, // Instancia de better-sqlite3
    expired: {
      clear: true,    // Limpiar sesiones expiradas
      intervalMs: 900000 // Cada 15 minutos
    }
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
```

**Impacto:** Gestiona sesiones de usuario de forma persistente y segura.

---

### **38.4 Librerías de APIs y Validación**

#### **🌐 Express.js - Framework Web**

**📦 Versión:** `^5.1.0`  
**🎯 Finalidad:** Framework minimalista para crear APIs REST y aplicaciones web.

**Funciones principales:**
- **Routing**: Definición de rutas y endpoints
- **Middleware**: Procesamiento de requests/responses
- **Static files**: Servir archivos estáticos
- **Error handling**: Gestión centralizada de errores

**Uso en SummaCham:**
```javascript
const express = require('express');
const app = express();

// Middleware
app.use(express.json());
app.use(express.static('vistas'));

// Rutas API
app.get('/api/usuarios', authMiddleware, (req, res) => {
  // Lógica de negocio
});

app.post('/api/login', async (req, res) => {
  // Autenticación
});
```

**Impacto:** Base de toda la arquitectura backend de SummaCham.

#### **✅ Joi - Validación de Datos**

**📦 Versión:** `^18.0.1`  
**🎯 Finalidad:** Librería de validación de esquemas para datos de entrada.

**Funciones principales:**
- **Esquemas declarativos**: Define estructura de datos esperada
- **Validación automática**: Verifica tipos, formatos y restricciones
- **Sanitización**: Limpia y transforma datos
- **Mensajes de error**: Descripciones claras de validaciones fallidas

**Uso en SummaCham:**
```javascript
const Joi = require('joi');

// Esquema de validación para login
const loginSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(8).required(),
  remember: Joi.boolean().default(false)
});

// Validar datos de entrada
const { error, value } = loginSchema.validate(req.body);
if (error) {
  return res.status(400).json({ error: error.details[0].message });
}
```

**Impacto:** Valida todas las entradas de usuario en APIs y formularios.

#### **🍪 cookie-parser - Parseo de Cookies**

**📦 Versión:** `^1.4.7`  
**🎯 Finalidad:** Parsea cookies HTTP en objetos JavaScript accesibles.

**Funciones principales:**
- **Parseo automático**: Convierte cookies en req.cookies
- **Signed cookies**: Soporte para cookies firmadas
- **JSON cookies**: Cookies con objetos complejos

**Uso en SummaCham:**
```javascript
const cookieParser = require('cookie-parser');
app.use(cookieParser(process.env.COOKIE_SECRET));

// Acceder a cookies
app.get('/profile', (req, res) => {
  const theme = req.cookies.theme || 'light';
  const sessionId = req.signedCookies.sessionId;
});
```

**Impacto:** Gestiona preferencias de usuario y sesiones.

#### **📋 express-session - Gestión de Sesiones**

**📦 Versión:** `^1.18.2`  
**🎯 Finalidad:** Maneja sesiones del lado del servidor con soporte para múltiples stores.

**Funciones principales:**
- **Sesiones seguras**: ID de sesión único por usuario
- **Persistencia**: Almacenamiento en base de datos
- **Configuración**: Tiempo de vida, regeneración automática

**Uso en SummaCham:**
```javascript
app.use(session({
  name: 'summa.sid',
  secret: process.env.SESSION_SECRET,
  store: sqliteStore,
  cookie: {
    maxAge: 8 * 60 * 60 * 1000, // 8 horas
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));
```

**Impacto:** Mantiene estado de autenticación entre requests.

---

### **38.5 Librerías de Utilidades**

#### **📊 xlsx - Manejo de Excel**

**📦 Versión:** `^0.18.5`  
**🎯 Finalidad:** Lee y escribe archivos Excel (.xlsx, .xls) en Node.js.

**Funciones principales:**
- **Lectura**: Parsea archivos Excel a objetos JSON
- **Escritura**: Genera archivos Excel desde datos
- **Formatos**: Soporte para múltiples formatos de celda
- **Hojas múltiples**: Manejo de workbooks complejos

**Uso en SummaCham:**
```javascript
const XLSX = require('xlsx');

// Leer archivo Excel
const workbook = XLSX.readFile('presupuesto.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet);

// Escribir archivo Excel
const newWorkbook = XLSX.utils.book_new();
const newWorksheet = XLSX.utils.json_to_sheet(data);
XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Datos');
XLSX.writeFile(newWorkbook, 'export.xlsx');
```

**Impacto:** Importa/exporta datos presupuestarios en formato Excel.

#### **📄 csv-parse - Parseo CSV**

**📦 Versión:** `^6.1.0`  
**🎯 Finalidad:** Parsea archivos CSV con soporte para configuraciones complejas.

**Funciones principales:**
- **Delimitadores**: Soporte para diferentes separadores
- **Headers**: Detección automática o manual de encabezados
- **Encoding**: Múltiples codificaciones de caracteres
- **Streaming**: Procesamiento de archivos grandes

**Uso en SummaCham:**
```javascript
const parse = require('csv-parse');

// Parsear CSV
fs.createReadStream('datos.csv')
  .pipe(parse({
    delimiter: ';',
    columns: true,
    skip_empty_lines: true
  }))
  .on('data', (row) => {
    // Procesar cada fila
  });
```

**Impacto:** Importa datos desde archivos CSV de sistemas externos.

#### **📧 nodemailer - Envío de Emails**

**📦 Versión:** `^7.0.10`  
**🎯 Finalidad:** Envía emails usando SMTP y otros transportes.

**Funciones principales:**
- **SMTP**: Conexión directa a servidores SMTP
- **Templates**: Soporte para HTML y texto plano
- **Attachments**: Adjuntos de archivos
- **Transports**: Múltiples proveedores (Gmail, Outlook, etc.)

**Uso en SummaCham:**
```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransporter({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Enviar email
await transporter.sendMail({
  from: 'summa@panelamcham.com',
  to: user.email,
  subject: 'Notificación de cambios',
  html: '<h1>Cambios realizados</h1>'
});
```

**Impacto:** Envía notificaciones y reportes por email.

---

### **38.6 Librerías de Electron**

#### **⚡ electron-updater - Actualizaciones Automáticas**

**📦 Versión:** `^6.6.2`  
**🎯 Finalidad:** Gestiona actualizaciones automáticas de aplicaciones Electron.

**Funciones principales:**
- **Auto-updater**: Descarga e instala actualizaciones automáticamente
- **GitHub Releases**: Integra con releases de GitHub
- **Progress tracking**: Muestra progreso de descarga
- **Silent updates**: Actualizaciones en background

**Uso en SummaCham:**
```javascript
const { autoUpdater } = require('electron-updater');

autoUpdater.checkForUpdatesAndNotify();

// Eventos de actualización
autoUpdater.on('update-available', () => {
  // Mostrar notificación
});

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall();
});
```

**Impacto:** Mantiene la aplicación actualizada automáticamente.

#### **🚀 auto-launch - Inicio Automático**

**📦 Versión:** `^5.0.6`  
**🎯 Finalidad:** Configura la aplicación para iniciarse automáticamente con Windows.

**Funciones principales:**
- **Registro**: Agrega al inicio automático de Windows
- **Configuración**: Opciones de argumentos y directorio
- **Estado**: Verificar si está habilitado
- **Cross-platform**: Soporte para Windows, macOS, Linux

**Uso en SummaCham:**
```javascript
const AutoLaunch = require('auto-launch');

const autoLauncher = new AutoLaunch({
  name: 'PanelAMCHAM',
  path: process.execPath,
  isHidden: false
});

// Habilitar inicio automático
autoLauncher.enable();

// Verificar estado
const isEnabled = await autoLauncher.isEnabled();
```

**Impacto:** La aplicación se inicia automáticamente al encender la PC.

---

### **38.7 Librerías Frontend**

#### **📈 Chart.js - Gráficos Interactivos**

**📦 Versión:** `4.4.1` (CDN)  
**🎯 Finalidad:** Librería de gráficos HTML5 para visualización de datos.

**Funciones principales:**
- **Múltiples tipos**: Líneas, barras, pie, doughnut, radar
- **Responsive**: Se adapta automáticamente al tamaño
- **Animaciones**: Transiciones suaves
- **Interactividad**: Tooltips, leyendas, zoom

**Uso en SummaCham:**
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
```

```javascript
// Crear gráfico de presupuesto
const ctx = document.getElementById('chartPresupuesto').getContext('2d');
const chart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Enero', 'Febrero', 'Marzo'],
    datasets: [{
      label: 'Presupuesto',
      data: [12000, 15000, 18000],
      backgroundColor: 'rgba(54, 162, 235, 0.5)'
    }]
  },
  options: {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      tooltip: { enabled: true }
    }
  }
});
```

**Impacto:** Visualiza datos financieros en dashboards interactivos.

#### **🎨 Bootstrap - Framework CSS**

**📦 Versión:** `5.3.3` (CDN)  
**🎯 Finalidad:** Framework CSS para diseño responsive y componentes UI.

**Funciones principales:**
- **Grid system**: Layout responsive
- **Components**: Botones, modales, navegación
- **Utilities**: Clases de utilidad
- **Themes**: Personalización visual

**Uso en SummaCham:**
```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
```

**Impacto:** Proporciona la interfaz de usuario consistente y responsive.

#### **⚡ jQuery - Manipulación DOM**

**📦 Versión:** `3.7.1` (CDN)  
**🎯 Finalidad:** Librería para manipulación simplificada del DOM y AJAX.

**Funciones principales:**
- **Selectores**: Búsqueda de elementos DOM
- **Eventos**: Manejo simplificado de eventos
- **AJAX**: Requests asíncronos
- **Animaciones**: Efectos visuales

**Uso en SummaCham:**
```javascript
// Cargar datos dinámicamente
$('#btnCargar').click(function() {
  $.ajax({
    url: '/api/datos',
    method: 'GET',
    success: function(data) {
      $('#contenedor').html(data);
    }
  });
});
```

**Impacto:** Maneja interacciones dinámicas en la interfaz.

---

### **38.8 Dependencias de Desarrollo**

#### **🔧 electron-builder - Empaquetado**

**📦 Versión:** `^25.1.8`  
**🎯 Finalidad:** Construye instaladores nativos para aplicaciones Electron.

**Funciones principales:**
- **Multiplataforma**: Windows, macOS, Linux
- **NSIS**: Instaladores avanzados para Windows
- **Portable**: Versiones sin instalación
- **Auto-updater**: Preparación para actualizaciones

**Configuración en SummaCham:**
```json
{
  "build": {
    "appId": "com.summa.cham.panelamcham",
    "productName": "PanelAMCHAM",
    "win": {
      "target": ["nsis", "portable"],
      "icon": "icono/icon.ico"
    }
  }
}
```

**Impacto:** Genera instaladores profesionales para distribución.

#### **🔄 cross-env - Variables de Entorno**

**📦 Versión:** `^7.0.3`  
**🎯 Finalidad:** Establece variables de entorno de forma cross-platform.

**Uso en SummaCham:**
```json
{
  "scripts": {
    "start": "cross-env NODE_ENV=development electron .",
    "dist": "cross-env NODE_ENV=production electron-builder"
  }
}
```

**Impacto:** Garantiza compatibilidad entre Windows, macOS y Linux.

#### **⚡ esbuild - Bundling**

**📦 Versión:** `^0.27.1`  
**🎯 Finalidad:** Empaquetador de JavaScript extremadamente rápido.

**Funciones principales:**
- **Velocidad**: 10-100x más rápido que Webpack
- **Tree shaking**: Elimina código no usado
- **Minificación**: Reduce tamaño de bundles
- **TypeScript**: Soporte nativo

**Uso en SummaCham:**
```javascript
const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  outfile: 'dist/main.js',
  minify: true,
  platform: 'node'
});
```

**Impacto:** Optimiza el rendimiento de la aplicación.

---

### **38.9 Resumen Ejecutivo - Librerías**

#### **🏗️ Arquitectura por Capas:**

| Capa | Librerías Principales | Finalidad |
|------|----------------------|-----------|
| **Seguridad** | Helmet, bcryptjs, JWT | Protección y autenticación |
| **Base de Datos** | better-sqlite3, node-firebird | Almacenamiento y consultas |
| **APIs** | Express, Joi, cookie-parser | Servicios web y validación |
| **Utilidades** | xlsx, csv-parse, nodemailer | Import/export y comunicaciones |
| **Desktop** | Electron, auto-launch, updater | Aplicación nativa |
| **Frontend** | Chart.js, Bootstrap, jQuery | Interfaz de usuario |

#### **📊 Métricas de Dependencias:**
- **Total de dependencias:** 15 librerías principales
- **Seguridad:** 3 librerías dedicadas
- **Base de datos:** 3 librerías especializadas
- **Performance:** Drivers nativos (C++, Rust)
- **Mantenimiento:** Versiones actualizadas y activas

#### **🎯 Impacto en SummaCham:**
- **Fiabilidad:** Drivers nativos para máxima performance
- **Seguridad:** Múltiples capas de protección
- **Escalabilidad:** Arquitectura modular y extensible
- **Mantenibilidad:** Librerías maduras y bien documentadas

Este ecosistema de librerías proporciona una **base sólida y segura** para la aplicación SummaCham, combinando performance, seguridad y facilidad de desarrollo.

---

*Documentación actualizada: 2026-01-26 18:26:15*
*Versión: 2.4 - Librerías Principales y Dependencias*
*Autor: SummaCham Development Team*
