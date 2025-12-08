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
const MODULOS_MAP = {
  Membresía: "Membresía",
  Eventos: "Eventos",
  Comunicación: "Comunicación",
  Dirección: "Dirección",
  "Serv Membresía": "Serv_Membresía",
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

    const usersMap = {}; // username -> { username, nombres, apellidos, correo, permissions: [] }

    // PASS 1: Read Directory (Cols 9, 10, 11 -> Indexes 9, 10, 11)
    // Row 1 is header. Start from Row 2.
    data.forEach((row, idx) => {
      if (idx < 2) return; // Skip headers
      const nombreCompleto = (row[9] || "").toString().trim();
      const siglas = (row[10] || "").toString().trim().toUpperCase();
      const correo = (row[11] || "").toString().trim();

      if (siglas && siglas.length <= 5) {
        if (!usersMap[siglas]) {
          // Dividir nombre
          const partesNombre = nombreCompleto.split(" ");
          const nombres = partesNombre[0] || "";
          const apellidos = partesNombre.slice(1).join(" ") || "";

          usersMap[siglas] = {
            username: siglas,
            nombres,
            apellidoPrimero: apellidos, // Simplificacion
            correo,
            permissions: [],
          };
        }
      }
    });

    // PASS 2: Read Permissions
    // Col 1 (Idx 1): CARGA Y GUARDA (Editor)
    // Col 2 (Idx 2): CARGA Y GUARDA (Editor)
    // Col 3 (Idx 3): REVISA (Reviewer)
    // Col 4 (Idx 4): APRUEBA 1 (Approver)
    // Col 5 (Idx 5): APRUEBA 2 (Approver)
    // Col 6 (Idx 6): APRUEBA 3 (Approver)

    data.forEach((row, rowIndex) => {
      if (!row || row.length < 2) return;
      const contextStr = row[0];
      if (!contextStr || typeof contextStr !== "string") return;

      const parts = contextStr.split(" ");
      const prefix = parts[0];
      if (!EMPRESAS_MAP[prefix]) return;

      const empresaId = EMPRESAS_MAP[prefix];
      const moduleNameRaw = parts.slice(1, parts.length - 1).join(" "); // Todo en medio menos año

      let moduloKey = Object.keys(MODULOS_MAP).find(
        (k) => k.toLowerCase() === moduleNameRaw.toLowerCase()
      );
      if (!moduloKey) moduloKey = moduleNameRaw; // Fallback
      const moduloFinal = MODULOS_MAP[moduloKey] || moduloKey;

      const addPerm = (initials, role) => {
        if (!initials) return;
        const u = initials.toString().trim().toUpperCase();
        if (!u || u === "FINANZAS") return; // Ignore Generic

        if (!usersMap[u]) {
          // Si no estaba en directorio, crearlo basico
          usersMap[u] = {
            username: u,
            nombres: u,
            apellidoPrimero: u,
            correo: "",
            permissions: [],
          };
        }

        const existing = usersMap[u].permissions.find(
          (p) => p.empresaId === empresaId && p.modulo === moduloFinal
        );

        if (!existing) {
          usersMap[u].permissions.push({
            empresaId,
            modulo: moduloFinal,
            puede_leer: 1,
            puede_cargar_guardar: role === "EDITOR" ? 1 : 0,
            puede_revisar: role === "REVIEWER" ? 1 : 0,
            puede_aprobar: role === "APPROVER" ? 1 : 0,
          });
        } else {
          // Merge roles
          if (role === "EDITOR") existing.puede_cargar_guardar = 1;
          if (role === "REVIEWER") {
            existing.puede_revisar = 1;
            // Reviewer does NOT imply Editor rights
          }
          if (role === "APPROVER") {
            existing.puede_aprobar = 1;
            // Approver does NOT imply Editor rights
          }
        }
      };

      addPerm(row[1], "EDITOR");
      addPerm(row[2], "EDITOR");
      addPerm(row[3], "REVIEWER");
      addPerm(row[4], "APPROVER");
      addPerm(row[5], "APPROVER");
      addPerm(row[6], "APPROVER");
    });

    const result = Object.values(usersMap);
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`Seed file generated at: ${outputPath}`);
    console.log(`Total users found: ${result.length}`);
  } catch (error) {
    console.error("Error generating seed:", error);
  }
}

processExcel();
