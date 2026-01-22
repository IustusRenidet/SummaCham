const fs = require("fs");
const content = fs.readFileSync(
  "c:\\Users\\Frida Sophia\\Desktop\\DESARROLLOS\\SummaCham\\vistas\\js\\plantillas.js",
  "utf8",
);
const lines = content.split("\n");
let balance = 0;
let stack = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === "{") {
      balance++;
      stack.push(i + 1);
    } else if (line[j] === "}") {
      balance--;
      stack.pop();
    }
  }
}
console.log("Final Stack:", stack);
console.log("Line 7 content:", lines[6]);
console.log("Line 8911 content:", lines[8910]);
