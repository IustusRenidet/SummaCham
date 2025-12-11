# 🔒 Guía de Seguridad - SummaCham

## Antes de Hacer el Repositorio Público

### ✅ Checklist de Seguridad

- [ ] **Nunca commitear archivos `.env`** - Están en `.gitignore`
- [ ] **Revisar historial de Git** - Asegurarse de que no haya contraseñas en commits anteriores
- [ ] **Base de datos local protegida** - `datos/` está en `.gitignore`
- [ ] **Seed de usuarios es ejemplo** - `seed_users.json` real está ignorado
- [ ] **Sin rutas absolutas hardcodeadas** - Todo usa rutas relativas
- [ ] **GitHub Token configurado** - Para releases (no commitearlo)

---

## Configuración Inicial para Usuarios

### 1. Variables de Entorno

Copia `.env.example` a `.env` y configura:

```bash
cp .env.example .env
```

Genera un secreto seguro para sesiones:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Usuarios Iniciales

Copia `src/config/seed_users.example.json` a `src/config/seed_users.json` y agrega tus usuarios:

```bash
cp src/config/seed_users.example.json src/config/seed_users.json
```

**IMPORTANTE:** `seed_users.json` real NUNCA debe commitearse.

### 3. Base de Datos

La base de datos SQLite se crea automáticamente en:
- **Desarrollo:** `datos/panel.sqlite`
- **Producción:** `%APPDATA%/SummaCham/datos/panel.sqlite`

### 4. Contraseña de Administrador

El usuario `ICONET` (admin global) se crea automáticamente:

- **Con variable de entorno:** Usa `PANELAMCHAM_ADMIN_PASSWORD` en `.env`
- **Sin variable:** Genera una contraseña aleatoria que se muestra en la consola

⚠️ **Guarda la contraseña generada** - Solo se muestra una vez.

---

## Información NO Sensible (Segura para GitHub Público)

### ✅ Puedes commitear:
- Código fuente (JS, HTML, CSS)
- Archivos `.example` y `.md`
- `package.json` y `package-lock.json`
- Estructura de carpetas vacías
- Documentación
- Assets públicos (iconos, imágenes)

### ❌ NUNCA commitees:
- Archivos `.env` (con valores reales)
- `datos/` y archivos `.sqlite`
- `seed_users.json` (con usuarios reales)
- `node_modules/`
- Builds y ejecutables (`dist/`, `out/`, `*.exe`)
- Logs con información sensible

---

## Limpieza del Historial de Git

Si ya commiteaste información sensible, límpiarla:

### Opción 1: BFG Repo-Cleaner (Recomendado)
```bash
# Instalar BFG
# https://rtyley.github.io/bfg-repo-cleaner/

# Eliminar archivo específico del historial
bfg --delete-files seed_users.json
bfg --delete-files .env

# Limpiar referencias
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Opción 2: Git Filter-Branch
```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch src/config/seed_users.json" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (¡CUIDADO! Reescribe historial)
git push origin --force --all
```

---

## Publicación de Releases

### Generar Token de GitHub

1. Ve a: https://github.com/settings/tokens
2. Click en "Generate new token (classic)"
3. Permisos necesarios:
   - `repo` (acceso completo)
   - `write:packages` (opcional)
4. Guarda el token en un lugar seguro

### Configurar el Token

**NO lo agregues al código.** Úsalo como variable de entorno:

```bash
# PowerShell
$env:GITHUB_TOKEN="tu_token_aqui"

# O agrégalo a tu .env (que está ignorado)
GITHUB_TOKEN=tu_token_aqui
```

### Publicar Release

```bash
.\scripts\publish-update.ps1 -Version "1.0.1" -ReleaseNotes "Correcciones de bugs"
```

---

## Auditoría de Seguridad

### Revisar que no haya secretos en el código

```bash
# Buscar contraseñas hardcodeadas
git grep -i "password.*=" -- "*.js" "*.json"

# Buscar tokens
git grep -i "token.*=" -- "*.js" "*.json"

# Buscar API keys
git grep -i "api.*key" -- "*.js" "*.json"
```

### Revisar dependencias vulnerables

```bash
npm audit
npm audit fix
```

---

## Recomendaciones Adicionales

### 1. **GitHub Repository Settings**
- Activa "Dependency scanning"
- Activa "Secret scanning"
- Revisa las alertas de Dependabot

### 2. **Dos Repositorios (Opcional)**
- **Público:** Código sin datos sensibles
- **Privado:** Fork con configuración real para tu empresa

### 3. **CI/CD Secrets**
Si usas GitHub Actions, agrega secretos en:
`Settings > Secrets and variables > Actions`

### 4. **Documentación Clara**
Incluye en el README:
- Cómo configurar el proyecto
- Qué archivos deben crearse
- Dónde obtener credenciales

---

## Contacto de Seguridad

Si encuentras una vulnerabilidad, reporta en:
- GitHub Issues (para bugs no sensibles)
- Email directo (para vulnerabilidades críticas)

**NO publiques vulnerabilidades en issues públicas.**
