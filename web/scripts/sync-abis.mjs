// Copies the ABIs Foundry produced into a typed TS module the web app can import.
// Run after any contract change:  npm run sync:abis
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const artifacts = resolve(here, "../../contracts/out");
const contracts = ["InstitutionRegistry", "CityPassport", "ExperiencePass"];

const parts = [
  "// GENERATED FILE - do not edit by hand.",
  "// Source: contracts/out/*.sol/*.json  (regenerate with `npm run sync:abis`)",
  "",
];

for (const name of contracts) {
  const file = resolve(artifacts, `${name}.sol/${name}.json`);
  if (!existsSync(file)) {
    console.error(`Missing artifact for ${name}. Run \`forge build\` in ../contracts first.`);
    process.exit(1);
  }
  const { abi } = JSON.parse(readFileSync(file, "utf8"));
  const varName = name.charAt(0).toLowerCase() + name.slice(1) + "Abi";
  parts.push(`export const ${varName} = ${JSON.stringify(abi, null, 2)} as const;`, "");
}

const out = resolve(here, "../src/lib/chain/abis.ts");
writeFileSync(out, parts.join("\n"));
console.log(`Wrote ${out} (${contracts.join(", ")})`);
