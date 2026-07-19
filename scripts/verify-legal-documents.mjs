import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const documents = {
  "src/routes/terms.tsx": "a14c2893374c23d3cd5c499b87ae4912a12e39b68226b2e3fbd7736e434c78b5",
  "src/routes/privacy.tsx": "53a3ac090518be7ccd38161cb818c51619b73855e9264f83759272cb482eff99",
  "src/routes/rules.tsx": "656ae4c692dc01b2855919727574878afdb4248c7748c218b9a1908874958c1d",
  "src/routes/purchase-policy.tsx":
    "b42d9dd837ec8da72a0f1e3b9f7b4f85660517191a44be8bdd2662b8201c5e20",
};

let failed = false;
for (const [path, expected] of Object.entries(documents)) {
  const content = await readFile(new URL(`../${path}`, import.meta.url));
  const actual = createHash("sha256").update(content).digest("hex");
  if (actual !== expected) {
    failed = true;
    console.error(`${path} changed without a new legal-document version.`);
  }
}
if (failed) {
  console.error(
    "Publish new document versions, update the database migration, and record new hashes before building.",
  );
  process.exit(1);
}
console.log("Legal document versions and source hashes are unchanged.");
