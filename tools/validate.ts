/**
 * Validates every schemas/*.yaml against the canonical JSON Schema and asserts
 * the SSOT invariants: filename === meta.slug, unique slugs, parseable YAML, and
 * every meta.docsUrl resolves to a real docs page (a docs/**\/*.mdx whose
 * frontmatter `path:` matches the URL — no dead "Documentation" links).
 * Exits non-zero on any failure. Run in CI.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { load as yamlLoad } from "js-yaml";
import Ajv from "ajv/dist/2020.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = join(HERE, "..", "schemas");
const DOCS_DIR = join(HERE, "..", "docs");
const SITE_URL = "https://docs.formance.com";

const schema = JSON.parse(readFileSync(join(SCHEMAS_DIR, "ledger-schema.schema.json"), "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

// Paths declared by the library's own docs pages, keyed off MDX frontmatter
// `path:` — a docsUrl is only valid if it points at one of these.
const docsPagePaths = new Set<string>();
if (existsSync(DOCS_DIR)) {
  for (const rel of readdirSync(DOCS_DIR, { recursive: true })) {
    if (typeof rel !== "string" || !rel.endsWith(".mdx")) continue;
    const frontmatter = readFileSync(join(DOCS_DIR, rel), "utf8").match(/^---\n([\s\S]*?)\n---/);
    const path = frontmatter ? (yamlLoad(frontmatter[1]) as { path?: string })?.path : undefined;
    if (path) docsPagePaths.add(path);
  }
}

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

  const doc = data as { meta?: { slug?: string; docsUrl?: string } };
  if (doc?.meta?.slug !== slug) {
    console.error(`✗ ${file}: meta.slug (${doc?.meta?.slug}) !== filename (${slug})`);
    failures++;
  }
  if (slugs.has(slug)) {
    console.error(`✗ ${file}: duplicate slug`);
    failures++;
  }
  slugs.add(slug);

  const docsUrl = doc?.meta?.docsUrl;
  if (docsUrl !== undefined) {
    if (!docsUrl.startsWith(`${SITE_URL}/`)) {
      console.error(`✗ ${file}: meta.docsUrl must start with ${SITE_URL}/ (got ${docsUrl})`);
      failures++;
    } else if (!docsPagePaths.has(docsUrl.slice(SITE_URL.length))) {
      console.error(`✗ ${file}: meta.docsUrl → ${docsUrl} has no matching docs page (no docs/**/*.mdx declares path: ${docsUrl.slice(SITE_URL.length)})`);
      failures++;
    }
  }

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
