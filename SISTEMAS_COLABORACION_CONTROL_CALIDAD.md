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
