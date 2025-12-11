# ✅ Checklist Pre-Publicación

Usa esta lista antes de hacer tu repositorio público.

## 🔒 Seguridad Crítica

- [ ] **Ejecutar auditoría de seguridad**
  ```bash
  .\scripts\audit-security.ps1
  ```
  
- [ ] **Verificar `.gitignore` actualizado**
  - `.env` está ignorado
  - `datos/` está ignorado
  - `seed_users.json` está ignorado
  - `*.sqlite` está ignorado

- [ ] **Archivos `.example` creados**
  - `.env.example` existe ✅
  - `seed_users.example.json` existe ✅

- [ ] **NO hay contraseñas hardcodeadas**
  ```bash
  git grep -i "password.*=" -- "*.js" | Select-String -NotMatch "example"
  ```

- [ ] **NO hay tokens hardcodeados**
  ```bash
  git grep -iE "(token|secret|api[_-]?key).*=" -- "*.js"
  ```

- [ ] **NO hay rutas absolutas personales**
  ```bash
  git grep -E "C:\\\\Users\\\\|D:\\\\" -- "*.js"
  ```

---

## 📄 Documentación

- [ ] **README.md actualizado**
  - Instrucciones claras de instalación
  - Scripts documentados
  - Links a documentación adicional

- [ ] **SETUP_INICIAL.md completo** ✅
  - Paso a paso para nuevos usuarios
  - Troubleshooting común

- [ ] **SEGURIDAD.md creado** ✅
  - Guía de protección de datos
  - Cómo manejar secretos

- [ ] **LICENSE agregada** (opcional pero recomendado)
  - MIT, Apache 2.0, GPL, etc.

---

## 🗂️ Limpieza del Repositorio

- [ ] **Eliminar archivos innecesarios**
  - Builds antiguos en `dist/`, `out/`, `release/`
  - Logs (`*.log`)
  - Bases de datos de prueba

- [ ] **Verificar historial de Git**
  ```bash
  git log --all --oneline | Select-String -Pattern "password|secret|token"
  ```

- [ ] **Si encuentras secretos en historial, limpiar:**
  ```bash
  # Opción 1: BFG Repo-Cleaner (recomendado)
  bfg --delete-files .env
  
  # Opción 2: Git filter-branch
  git filter-branch --force --index-filter \
    "git rm --cached --ignore-unmatch .env" \
    --prune-empty --tag-name-filter cat -- --all
  ```

---

## 🔧 Configuración de GitHub

- [ ] **Crear repositorio en GitHub**
  - Nombre: `SummaCham`
  - Público ✅
  - Sin archivos iniciales (ya tienes el repo local)

- [ ] **Agregar remote**
  ```bash
  git remote add origin https://github.com/IustusRenidet/SummaCham.git
  ```

- [ ] **Push inicial**
  ```bash
  git branch -M main
  git push -u origin main
  ```

- [ ] **Configurar GitHub Releases**
  - Habilitar Releases
  - Crear primer release manual (v1.0.0)

- [ ] **Habilitar protecciones** (Recomendado)
  - Settings > Code security and analysis
  - ✅ Dependency graph
  - ✅ Dependabot alerts
  - ✅ Secret scanning

- [ ] **GitHub Actions Secrets** (si usas CI/CD)
  - Settings > Secrets and variables > Actions
  - Agregar: `GITHUB_TOKEN`

---

## 🎯 Actualizaciones Automáticas

- [ ] **package.json configurado**
  - `repository.url` apunta a tu repo público
  - `publish.provider` es "github"

- [ ] **GitHub Personal Access Token**
  - Creado en: https://github.com/settings/tokens
  - Permisos: `repo` (full control)
  - **NO committear el token** - usar como variable de entorno

- [ ] **Script de publicación probado**
  ```bash
  $env:GITHUB_TOKEN="tu_token"
  .\scripts\publish-update.ps1 -Version "1.0.0" -ReleaseNotes "Primera versión pública"
  ```

---

## 📦 Build de Producción

- [ ] **Probar build local**
  ```bash
  npm run build
  ```

- [ ] **Verificar ejecutable generado**
  - Instalador en `release/`
  - Tamaño razonable
  - Instalación exitosa
  - Aplicación funciona correctamente

- [ ] **Probar actualización**
  - Instalar versión 1.0.0
  - Publicar versión 1.0.1
  - Verificar que la app detecta y descarga la actualización

---

## 🧪 Testing Final

- [ ] **Clonar repo en carpeta limpia**
  ```bash
  cd C:\temp
  git clone https://github.com/IustusRenidet/SummaCham.git test-clean
  cd test-clean
  ```

- [ ] **Seguir SETUP_INICIAL.md paso a paso**
  - npm install funciona
  - .env.example se copia correctamente
  - seed_users.example.json se copia correctamente
  - npm start funciona
  - Login con usuario ICONET funciona

- [ ] **Verificar que NO hay errores de archivos faltantes**

---

## 📢 Comunicación

- [ ] **Crear README atractivo**
  - Badges de versión, licencia, etc.
  - Screenshots (opcional)
  - GIF demo (opcional)

- [ ] **Agregar CONTRIBUTING.md** (opcional)
  - Cómo reportar bugs
  - Cómo hacer pull requests

- [ ] **Agregar CODE_OF_CONDUCT.md** (opcional)
  - Estándar de comunidad

- [ ] **Crear primer Issue de ejemplo**
  - Ayuda a otros a entender el formato

---

## ⚠️ ANTES DEL PUSH FINAL

### Verificación de 3 puntos críticos:

```powershell
# 1. Verificar .gitignore
cat .gitignore | Select-String "\.env$"
cat .gitignore | Select-String "datos/"
cat .gitignore | Select-String "seed_users\.json"

# 2. Verificar que archivos sensibles NO están tracked
git ls-files | Select-String "\.env$"
git ls-files | Select-String "seed_users\.json"

# 3. Ejecutar auditoría final
.\scripts\audit-security.ps1
```

Si TODO está verde (✓), estás listo para:

```bash
git add .
git commit -m "Initial public release"
git push origin main
```

---

## 🎉 Post-Publicación

- [ ] **Anunciar en equipo**
- [ ] **Crear Wiki en GitHub** (opcional)
- [ ] **Configurar GitHub Pages** (para docs) (opcional)
- [ ] **Monitorear issues y pull requests**
- [ ] **Configurar notificaciones de seguridad**

---

## 🆘 Si Algo Sale Mal

### Commiteaste un secreto por accidente:

1. **NO entres en pánico**
2. **Rota el secreto inmediatamente** (cambia contraseña, regenera token)
3. **Limpia el historial:**
   ```bash
   bfg --replace-text passwords.txt
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   git push origin --force --all
   ```
4. **Reporta en GitHub** que hubo un leak (si es necesario)

### El repo es muy grande:

```bash
# Ver archivos más grandes
git rev-list --objects --all | 
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' |
  Select-String "blob" | 
  Sort-Object {[int]($_ -split " ")[2]} -Descending |
  Select-Object -First 10
```

---

**¿Listo?** Ejecuta el audit y ¡adelante! 🚀
