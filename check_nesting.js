const fs = require("fs");
const content = fs.readFileSync(
  "c:\\Users\\Frida Sophia\\Desktop\\DESARROLLOS\\SummaCham\\vistas\\js\\plantillas.js",
  "utf8",
);
const lines = content.split("\n");
let balance = 0;
let maxBalance = 0;
let maxLine = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === "{") balance++;
    else if (line[j] === "}") balance--;
  }
  if (balance > maxBalance) {
    maxBalance = balance;
    maxLine = i + 1;
  }
}
console.log(`Max balance: ${maxBalance} at line ${maxLine}`);
