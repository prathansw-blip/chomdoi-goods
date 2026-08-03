import * as fs from "fs";

const raw = fs.readFileSync("./chomdoi_main_backup.json", "utf-8");
const data = JSON.parse(raw);

console.log("=== Products Image Size ===");
data.products.forEach(p => {
  const imgLength = p.image ? p.image.length : 0;
  console.log(`Product: ${p.name}`);
  console.log(`- Image length: ${imgLength} chars (~${(imgLength / 1024).toFixed(2)} KB)`);
});

console.log("\n=== Settings Company Logo Size ===");
const logoLength = data.settings?.companyLogo ? data.settings.companyLogo.length : 0;
console.log(`Company Logo: ${(logoLength / 1024).toFixed(2)} KB (${logoLength} chars)`);
