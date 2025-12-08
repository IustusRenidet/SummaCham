const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const filePath =
  "C:\\Users\\Frida Sophia\\Desktop\\DESARROLLOS\\SummaCham\\info IMPORTANTE\\Configuración ICONET.xlsx";
const outputPath =
  "C:\\Users\\Frida Sophia\\Desktop\\DESARROLLOS\\SummaCham\\src\\config\\seed_users.json";

const EMPRESAS_MAP = {
  Mex: "empresa1", // Ciudad de México
  Gdl: "empresa2", // Guadalajara
  Mty: "empresa3", // Noreste (Monterrey)
  NO: "empresa4", // Noroeste
  No: "empresa4",
};

// Mapa aproximado de módulos a slugs/nombres usados en el sistema
// Se normalizará a Mayusculas o Title Case según coincida
const MODULOS_MAP = {
  Membresía: "Membresía",
  Eventos: "Eventos",
  Comunicación: "Comunicación",
  Dirección: "Dirección",
  "Serv Membresía": "Serv_Membresía", // Ajuste por nombre archivo
  Comités: "Comités",
  "T&IC": "T&IC",
  RH: "RH",
  VPE: "VPE",
  Finanzas: "Finanzas",
  "Gtos Corporativos": "Gtos_Corporativos",
  SUMMARY: "SUMMARY",
  Presupuestos: "Presupuestos",
  RESUMEN: "RESUMEN",
};

function processExcel() {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const users = {}; // map: username -> { roles: set, permissions: [] }

    // Roles:
    // Col 1 (Idx 1): Reviewer (Cargar, Revisar)
    // Col 3 (Idx 3): Editor (Cargar)
    // Col 4 (Idx 4): Editor (Cargar)
    // Col 5 (Idx 5): Approver (Cargar, Aprobar)
    // Col 6 (Idx 6): Approver (Cargar, Aprobar)

    // Iterar filas
    data.forEach((row, rowIndex) => {
      // Ignorar encabezados o filas vacías
      if (!row || row.length < 2) return;
      const contextStr = row[0];
      if (!contextStr || typeof contextStr !== "string") return;

      // Parsear Contexto: "Mex Membresía 2026"
      // Split por espacio
      const parts = contextStr.split(" ");
      const prefix = parts[0];
      const year = parts[parts.length - 1]; // 2026

      // El nombre del módulo puede tener espacios (Serv Membresía), así que tomamos todo lo de en medio
      const moduleNameRaw = parts.slice(1, parts.length - 1).join(" ");

      const empresaId = EMPRESAS_MAP[prefix];
      if (!empresaId) {
        // console.warn(`Prefijo desconocido: ${prefix} en fila ${rowIndex}`);
        return;
      }

      // Normalizar módulo
      // Intentar machear keys de MODULOS_MAP
      let moduloKey = Object.keys(MODULOS_MAP).find(
        (k) => k.toLowerCase() === moduleNameRaw.toLowerCase()
      );
      if (!moduloKey) {
        // Fallback simple
        moduloKey = moduleNameRaw;
      }
      const moduloFinal = MODULOS_MAP[moduloKey] || moduloKey;

      const addPermission = (initials, permissionType) => {
        if (!initials || typeof initials !== "string" || initials.length > 5)
          return;
        const user = initials.trim().toUpperCase();
        if (!users[user]) {
          users[user] = {
            username: user,
            password: "123", // Default temporal
            permissions: [],
          };
        }

        // Base permissions
        const perms = {
          empresaId,
          modulo: moduloFinal,
          puede_leer: 1,
          puede_cargar_guardar: 0,
          puede_revisar: 0,
          puede_aprobar: 0,
        };

        if (permissionType === "REVIEWER") {
          perms.puede_cargar_guardar = 1;
          perms.puede_revisar = 1;
        } else if (permissionType === "EDITOR") {
          perms.puede_cargar_guardar = 1;
        } else if (permissionType === "APPROVER") {
          perms.puede_cargar_guardar = 1; // Asumimos que los aprobadores también pueden editar si es necesario, o al menos ver
          perms.puede_aprobar = 1;
        }

        // Agregar a la lista si no existe ya para ese modulo/empresa
        // (Podría haber duplicados si aparece en varias filas, aquí solo acumulamos)
        // Mejor lógica: buscar si ya tiene permiso para este modulo/empresa y hacer MERGE
        const existing = users[user].permissions.find(
          (p) => p.empresaId === empresaId && p.modulo === moduloFinal
        );
        if (existing) {
          existing.puede_cargar_guardar =
            existing.puede_cargar_guardar || perms.puede_cargar_guardar;
          existing.puede_revisar =
            existing.puede_revisar || perms.puede_revisar;
          existing.puede_aprobar =
            existing.puede_aprobar || perms.puede_aprobar;
        } else {
          users[user].permissions.push(perms);
        }
      };

      // Col 1: Reviewer
      addPermission(row[1], "REVIEWER");
      // Col 3: Editor
      addPermission(row[3], "EDITOR");
      // Col 4: Editor
      addPermission(row[4], "EDITOR");
      // Col 5: Approver
      addPermission(row[5], "APPROVER");
      // Col 6: Approver
      addPermission(row[6], "APPROVER");
    });

    const result = Object.values(users);
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`Seed file generated at: ${outputPath}`);
    console.log(`Total users found: ${result.length}`);
  } catch (error) {
    console.error("Error generating seed:", error);
  }
}

processExcel();
