const fs = require("fs");
const content = fs.readFileSync(
  "c:\\Users\\Frida Sophia\\Desktop\\DESARROLLOS\\SummaCham\\vistas\\js\\plantillas.js",
  "utf8",
);
const lines = content.split("\n");
let stack = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === "{") {
      stack.push(i + 1);
    } else if (line[j] === "}") {
      stack.pop();
    }
  }
}

console.log("Unclosed braces at lines:", stack);
