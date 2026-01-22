const fs = require("fs");
const content = fs.readFileSync(
  "c:\\Users\\Frida Sophia\\Desktop\\DESARROLLOS\\SummaCham\\vistas\\js\\plantillas.js",
  "utf8",
);
const lines = content.split("\n");
let pStack = [];
let inString = null;
let inComment = false;
let inBlockComment = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  inComment = false;
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    const nextChar = line[j + 1];

    if (inBlockComment) {
      if (char === "*" && nextChar === "/") {
        inBlockComment = false;
        j++;
      }
      continue;
    }
    if (inComment) break;
    if (inString) {
      if (char === inString && line[j - 1] !== "\\") inString = null;
      continue;
    }
    if (char === "/" && nextChar === "/") {
      inComment = true;
      continue;
    }
    if (char === "/" && nextChar === "*") {
      inBlockComment = true;
      j++;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      inString = char;
      continue;
    }

    if (char === "(") {
      pStack.push(i + 1);
    } else if (char === ")") {
      if (pStack.length === 0) {
        console.log(`Extra closing parenthesis at line ${i + 1}`);
      } else {
        pStack.pop();
      }
    }
  }
}

console.log("Unclosed parenthesis started at lines:", pStack);
