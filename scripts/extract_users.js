const XLSX = require("xlsx");
const path = require("path");

const filePath =
  "C:\\Users\\Frida Sophia\\Desktop\\DESARROLLOS\\SummaCham\\info IMPORTANTE\\Configuración ICONET.xlsx";

try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0]; // Read first sheet
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Array of arrays

  console.log("--- DATA START ---");
  console.log(JSON.stringify(data, null, 2));
  console.log("--- DATA END ---");
} catch (error) {
  console.error("Error reading excel:", error);
}
