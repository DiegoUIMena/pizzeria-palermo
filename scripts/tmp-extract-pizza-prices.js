const fs = require('fs');

const content = fs.readFileSync('app/components/PromoSection.tsx', 'utf8');
const re = /name:\s*"([^"]+)"[\s\S]*?price:\s*(\d+)[\s\S]*?mediumPrice:\s*(null|\d+)/g;

let match;
const rows = [];
while ((match = re.exec(content)) !== null) {
  rows.push({
    name: match[1],
    familiar: Number(match[2]),
    mediana: match[3] === 'null' ? null : Number(match[3]),
  });
}

rows.sort((a, b) => a.name.localeCompare(b.name, 'es'));
for (const row of rows) {
  console.log(`${row.name}|${row.familiar}|${row.mediana === null ? 'N/D' : row.mediana}`);
}
console.log(`TOTAL|${rows.length}`);
