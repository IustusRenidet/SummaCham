# Deploy automatico en servidor Windows (self-hosted runner)

Este repositorio ya incluye deploy automatico en:

- [`.github/workflows/release.yml`](.github/workflows/release.yml)
- [`scripts/deploy-self-hosted.ps1`](scripts/deploy-self-hosted.ps1)

El flujo se dispara al hacer push de un tag `v*` (ejemplo: `v5.4.0`).

## Que hace el pipeline

1. Build y release en GitHub (`windows-latest`).
2. Publica assets en GitHub Release (`.exe`, `.yml`, `.blockmap`).
3. Corre deploy en tu runner `self-hosted` de Windows.

## Variables de repositorio (Settings > Secrets and variables > Actions > Variables)

Variables principales:

- `DEPLOY_ENABLED`: `true` (o `false` para desactivar deploy)
- `DEPLOY_MODE`: `source` o `installer`

Si usas `DEPLOY_MODE=source`:

- `DEPLOY_APP_DIR`: ruta destino en servidor, por ejemplo `C:\apps\SummaCham`
- `DEPLOY_MIGRATION_COMMAND` (opcional): comando de migracion
- `DEPLOY_HEALTHCHECK_URL` (opcional): por ejemplo `http://127.0.0.1:3005/health`
- `DEPLOY_HEALTHCHECK_RETRIES` (opcional): por ejemplo `20`
- `DEPLOY_HEALTHCHECK_DELAY_SECONDS` (opcional): por ejemplo `3`

Si usas `DEPLOY_MODE=installer`:

- `DEPLOY_INSTALLER_ARGS` (opcional): por defecto `/S`

Opciones de reinicio (elige una):

- `DEPLOY_WINDOWS_SERVICE_NAME`: nombre del servicio Windows
- `DEPLOY_PROCESS_NAME`: nombre de proceso a cerrar (opcional)
- `DEPLOY_APP_EXE_PATH`: ruta del `.exe` a arrancar

## Secrets de repositorio (Actions > Secrets)

Opcionales:

- `DEPLOY_PRE_COMMAND`: comando antes del deploy
- `DEPLOY_RESTART_COMMAND`: comando personalizado de reinicio
- `DEPLOY_POST_COMMAND`: comando despues del deploy

Nota: `DEPLOY_RESTART_COMMAND` tiene prioridad sobre `DEPLOY_PROCESS_NAME`/`DEPLOY_APP_EXE_PATH`.

## Ejemplo recomendado para tu caso (source + reinicio por comando)

Variables:

- `DEPLOY_ENABLED=true`
- `DEPLOY_MODE=source`
- `DEPLOY_APP_DIR=C:\apps\SummaCham`
- `DEPLOY_HEALTHCHECK_URL=http://127.0.0.1:3005/health`

Secret:

- `DEPLOY_RESTART_COMMAND=Stop-Process -Name PanelAMCHAM -Force -ErrorAction SilentlyContinue; Start-Process "C:\Users\Frida Sophia\AppData\Local\Programs\PanelAMCHAM\PanelAMCHAM.exe"`

## Notas de seguridad operativa

- En modo `source`, el script no sobrescribe archivos `.env*` ni `*.sqlite`.
- El usuario del runner debe tener permisos sobre `DEPLOY_APP_DIR`.
- Si usas `DEPLOY_WINDOWS_SERVICE_NAME`, el runner debe tener permisos para reiniciar servicios.
