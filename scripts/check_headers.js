const xlsx = require("xlsx");
const path = require("path");

const workbook = xlsx.readFile(
  path.join(__dirname, "../info IMPORTANTE/Configuración ICONET.xlsx")
);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });

console.log("--- HEADERS START ---");
console.log(JSON.stringify(data.slice(0, 5), null, 2));
console.log("--- HEADERS END ---");
