import * as fs from "fs";

const raw = fs.readFileSync("./chomdoi_main_backup.json", "utf-8");
const data = JSON.parse(raw);

console.log("=== Products Detail Inspection ===");
data.products.forEach((p, idx) => {
  const size = Buffer.byteLength(JSON.stringify(p));
  console.log(`Index ${idx}: Product Name: "${p.name}", Size: ${(size / 1024).toFixed(2)} KB (${size} bytes)`);
  console.log("Keys:", Object.keys(p));
  // If size is exceptionally large, inspect values
  if (size > 1000) {
    Object.entries(p).forEach(([key, val]) => {
      const valSize = Buffer.byteLength(JSON.stringify(val));
      console.log(`  - Key "${key}": ${(valSize / 1024).toFixed(2)} KB (${valSize} bytes)`);
      if (valSize > 5000) {
        console.log(`    Value snippet: ${String(JSON.stringify(val)).slice(0, 100)}...`);
      }
    });
  }
});
