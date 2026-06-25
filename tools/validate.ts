/**
 * Validates every schemas/*.yaml against the canonical JSON Schema and asserts
 * the SSOT invariants: filename === meta.slug, unique slugs, parseable YAML.
 * Exits non-zero on any failure. Run in CI.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { load as yamlLoad } from "js-yaml";
import Ajv from "ajv/dist/2020.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = join(HERE, "..", "schemas");

const schema = JSON.parse(readFileSync(join(SCHEMAS_DIR, "ledger-schema.schema.json"), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const files = readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith(".yaml"));
const slugs = new Set<string>();
let failures = 0;

for (const file of files) {
  const slug = file.replace(/\.yaml$/, "");
  const raw = readFileSync(join(SCHEMAS_DIR, file), "utf8");
  let data: unknown;
  try {
    data = yamlLoad(raw);
  } catch (err) {
    console.error(`✗ ${file}: YAML parse error — ${(err as Error).message}`);
    failures++;
    continue;
  }

  const doc = data as { meta?: { slug?: string } };
  if (doc?.meta?.slug !== slug) {
    console.error(`✗ ${file}: meta.slug (${doc?.meta?.slug}) !== filename (${slug})`);
    failures++;
  }
  if (slugs.has(slug)) {
    console.error(`✗ ${file}: duplicate slug`);
    failures++;
  }
  slugs.add(slug);

  if (!validate(data)) {
    console.error(`✗ ${file}: schema validation failed`);
    for (const e of validate.errors ?? []) console.error(`    ${e.instancePath || "/"} ${e.message}`);
    failures++;
  } else {
    console.log(`✓ ${file}`);
  }
}

console.log(`\n${files.length} templates, ${failures} failure(s).`);
if (failures > 0) process.exit(1);
