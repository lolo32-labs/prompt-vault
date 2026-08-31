import { readFileSync } from "node:fs";
import Ajv from "ajv";

const schema = JSON.parse(readFileSync("schemas/moltbot.schema.json", "utf8"));
const manifest = JSON.parse(readFileSync(".moltbot", "utf8"));

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

if (!validate(manifest)) {
  console.error("✖ .moltbot failed schema validation:");
  for (const err of validate.errors ?? []) {
    console.error(`  - ${err.instancePath} ${err.message}`);
  }
  process.exit(1);
}

console.log("✓ .moltbot is valid against schema v0.1");
