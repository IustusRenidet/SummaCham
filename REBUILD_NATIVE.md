This short guide is for developers to rebuild native Node/Electron modules (like `better-sqlite3`) and to package the app.

Preconditions
- Windows development environment (PowerShell)
- Node.js compatible with the project's `package.json` devDependencies (v18+ recommended)
- Install `node-gyp` toolchain: Visual Studio Build Tools or Windows Build Tools

Steps
1. Clean node_modules and PKG lock (optional but recommended for deterministic builds):

```pwsh
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json -Force
```

2. Install production deps with `npm ci` (preferred for reproducibility):
```pwsh
npm ci
```

3. Install electron builder app dependencies (this downloads Electron headers and prepares build toolchains):
```pwsh
npm run postinstall
```

4. Generate the native binaries for **both** runtimes (Node CLI + Electron 30). This command:
   - Rebuilds `better-sqlite3` for your current Node version.
   - Runs `electron-rebuild` targeting Electron 30.
   - Stores each `.node` file inside `native_modules/<variant>` so both runtimes can swap automatically.
```pwsh
npm run rebuild-native
```

5. Start the server for local development (Node runtime):
```pwsh
npm run server
```

6. If you need to package the app for Windows (NSIS):
```pwsh
npm run dist
```

Common errors and solutions
- "The module was compiled against a different Node.js version" - Run `npm run rebuild-native` so the project regenerates both variants under `native_modules/` and auto-selects them when `better-sqlite3` is required.
- If `electron-rebuild` fails due to `node-gyp` errors, make sure you installed Build Tools and the Visual Studio SDK.
- Permission denied when running `electron-rebuild` — run PowerShell as administrator.

Notes
- This project requires SQLite native modules to be built for your OS / Electron runtime. The server will not run in production mode without these native modules.
- If you use CI or packaging, ensure `electron-builder install-app-deps` and `npm run rebuild-native` run during your build pipeline before packaging. The produced binaries live under `native_modules/` and the runtime loader copies the one that matches (`process.versions.electron` vs Node CLI) automatically.
