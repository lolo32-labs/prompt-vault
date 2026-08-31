import { readFileSync } from "node:fs";
import Ajv from "ajv";

const schema = JSON.parse(readFileSync("schemas/registry.schema.json", "utf8"));
const registry = JSON.parse(readFileSync("src/data/community-registry.json", "utf8"));

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

if (!validate(registry)) {
  console.error("✖ community registry failed schema validation:");
  for (const err of validate.errors ?? []) {
    console.error(`  - ${err.instancePath} ${err.message}`);
  }
  process.exit(1);
}

const repos = registry.repos.map((r) => r.repo);
const dupes = repos.filter((r, i) => repos.indexOf(r) !== i);
if (dupes.length > 0) {
  console.error("✖ duplicate repo entries:", [...new Set(dupes)].join(", "));
  process.exit(1);
}

console.log(`✓ community registry is valid (${registry.repos.length} repos)`);
