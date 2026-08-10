/**
 * Validates every schemas/*.yaml against the canonical JSON Schema and asserts
 * the SSOT invariants: filename === meta.slug, unique slugs, unique meta.order,
 * parseable YAML, every meta.docsUrl resolves to a real docs page (a
 * docs/**\/*.mdx whose frontmatter `path:` matches the URL — no dead
 * "Documentation" links), and no docs page hand-declares `order:` (display
 * order lives only in meta.order and is injected into the docs at sync time).
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
// `path:` — a docsUrl is only valid if it points at one of these. Display order
// must NOT be hand-declared in the MDX: it lives in meta.order and is injected
// into the docs frontmatter at sync time, so a stray `order:` here would drift.
const docsPagePaths = new Set<string>();
let failures = 0;
if (existsSync(DOCS_DIR)) {
  for (const rel of readdirSync(DOCS_DIR, { recursive: true })) {
    if (typeof rel !== "string" || !rel.endsWith(".mdx")) continue;
    const frontmatter = readFileSync(join(DOCS_DIR, rel), "utf8").match(/^---\n([\s\S]*?)\n---/);
    const fm = frontmatter ? (yamlLoad(frontmatter[1]) as { path?: string; order?: number }) : undefined;
    if (fm?.path) docsPagePaths.add(fm.path);
    if (fm?.order !== undefined) {
      console.error(`✗ docs/${rel}: frontmatter must not declare order: (it is injected from the schema's meta.order at sync time)`);
      failures++;
    }
  }
}

const files = readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith(".yaml"));
// starter.yaml lives at the repo root, OUTSIDE schemas/, and feeds Studio's
// "Start from scratch" seed via codegen. It shipped the quoted-numeric
// balance defect precisely because this gate did not scan it (found by a
// post-ship audit, 2026-08-10) — so it is linted with the same rules.
const ROOT_STARTER = join(HERE, "..", "starter.yaml");
const slugs = new Set<string>();
const orders = new Map<number, string>();

const worklist: Array<[string, string]> = files.map((f) => [f, join(SCHEMAS_DIR, f)]);
if (existsSync(ROOT_STARTER)) worklist.push(["starter.yaml", ROOT_STARTER]);
for (const [file, filePath] of worklist) {
  const slug = file.replace(/\.yaml$/, "");
  const raw = readFileSync(filePath, "utf8");
  let data: unknown;
  try {
    data = yamlLoad(raw);
  } catch (err) {
    console.error(`✗ ${file}: YAML parse error — ${(err as Error).message}`);
    failures++;
    continue;
  }

  const doc = data as { meta?: { slug?: string; order?: number; docsUrl?: string } };
  // starter.yaml is Studio's "Start from scratch" seed, not a gallery
  // template: it has no meta block, no docs page, and no display order, so
  // the template-meta invariants do not apply. Every CONTENT rule below
  // (identifier casing, pragmas, filter bodies) still runs on it — that is
  // the whole reason it is in the worklist.
  const isStarter = file === "starter.yaml";
  if (!isStarter && doc?.meta?.slug !== slug) {
    console.error(`✗ ${file}: meta.slug (${doc?.meta?.slug}) !== filename (${slug})`);
    failures++;
  }
  if (!isStarter && slugs.has(slug)) {
    console.error(`✗ ${file}: duplicate slug`);
    failures++;
  }
  slugs.add(slug);

  const order = doc?.meta?.order;
  if (typeof order === "number") {
    const owner = orders.get(order);
    if (owner) {
      console.error(`✗ ${file}: duplicate meta.order ${order} (also used by ${owner})`);
      failures++;
    } else {
      orders.set(order, file);
    }
  }

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

  // Numscript identifier casing. Verified against the playground parser
  // (2026-08-07): `$sellerId` fails with "extraneous input 'I'" and
  // `$SELLER_ID` with "token recognition error at '$S'", because the lexer
  // splits identifiers on capitals — so a non-snake_case variable can never
  // execute, however valid the YAML looks. Account PATH segments are literals,
  // not identifiers, and are deliberately left alone (`@platform:revenue:fxSpread`
  // parses fine).
  const SNAKE = /^[a-z][a-z0-9_]*$/;
  const identifiers = new Set<string>();
  for (const m of raw.matchAll(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g)) {
    identifiers.add(m[1]!);
  }
  for (const query of Object.values(
    (data as { queries?: Record<string, { vars?: Record<string, unknown> }> })
      .queries ?? {}
  )) {
    for (const varName of Object.keys(query?.vars ?? {})) identifiers.add(varName);
  }
  for (const name of identifiers) {
    if (!SNAKE.test(name)) {
      console.error(
        `✗ ${file}: identifier "$${name}" is not snake_case; the Numscript lexer splits identifiers on capitals, so this cannot execute`
      );
      failures++;
    }
  }

  // Filter bodies: map-typed fields need a LITERAL key. Measured against a live
  // v3.2 ledger (2026-08-10) by inserting three schema variants:
  //
  //   {"$match": {"balance": 0}}              -> 400 VALIDATION, "invalid value
  //     `0` for type `map[string]int`: type cannot be constructed, you may need
  //     to specify a key with `[my_key]`"
  //   {"$match": {"balance[USD/2]": 0}}       -> accepted
  //   {"$match": {"balance[${asset}]": 0}}    -> 400 VALIDATION, "invalid field
  //     name" (so an asset-agnostic query CANNOT defer the asset to a var)
  //
  // This escaped to a production deployment because the manifest JSON Schema
  // does not model filter-body types: the schema pushed fine and failed at
  // v2InsertSchema mid-deploy. Hence a dedicated gate.
  const MAP_FIELDS = new Set(["balance", "metadata"]);
  // Only balance is INT-valued; metadata is map[string]string where a numeric
  // string like "0" is legal (measured). volumes is not a filter field at all
  // (rejected as `unknown field` bare AND keyed), so it left the set.
  const INT_MAP_FIELDS = new Set(["balance"]);
  // $like and $in measured (2026-08-10): rejected on bare map fields exactly
// like $match, keyed forms accepted. $exists deliberately EXCLUDED: the bare
// map field is the key-existence idiom and is accepted by the ledger.
const COMPARISONS = new Set([
  "$match",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$like",
  "$in",
]);
  const walkFilter = (node: unknown, queryName: string): void => {
    if (Array.isArray(node)) {
      for (const item of node) walkFilter(item, queryName);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (COMPARISONS.has(key) && typeof value === "object" && value !== null) {
        for (const field of Object.keys(value as Record<string, unknown>)) {
          const base = field.split("[")[0]!;
          if (!MAP_FIELDS.has(base)) continue;
          // Value polarity, measured live 2026-08-10 on the same ledger:
          //   "balance[EUR/2]": "0"   -> 400 `expected a "${variable}" string
          //                              or a plain value, got `0``
          //   "balance[EUR/2]": 0     -> accepted
          //   "balance[EUR/2]": "${v}" -> accepted
          // So an int-typed field takes a NUMBER or a ${var} reference; a
          // quoted numeric string is neither. Opposite polarity to the missing
          // key below, and it shipped in the gallery too.
          const fieldValue = (value as Record<string, unknown>)[field];
          if (
            INT_MAP_FIELDS.has(base) &&
            typeof fieldValue === "string" &&
            /^-?\d+$/.test(fieldValue.trim())
          ) {
            console.error(
              `✗ ${file}: query "${queryName}" compares "${field}" with the quoted string "${fieldValue}"; an int-typed field needs a number (${fieldValue}) or a "\${var}" reference`
            );
            failures++;
          }
          if (!field.includes("[")) {
            console.error(
              `✗ ${file}: query "${queryName}" compares "${field}" with no key; it is a map type, so the ledger refuses this. Use a literal key, e.g. ${base}[USD/2]`
            );
            failures++;
          } else if (!new RegExp(`^${base}\\[[^\\]]+\\]$`).test(field)) {
            console.error(
              `✗ ${file}: query "${queryName}" uses the malformed map access "${field}"; the shape is ${base}[key] with a non-empty key and nothing after the bracket`
            );
            failures++;
          } else if (/\$\{|\$[A-Za-z_]/.test(field)) {
            console.error(
              `✗ ${file}: query "${queryName}" uses a variable in the field name "${field}"; the ledger rejects that as an invalid field name. The key must be a literal`
            );
            failures++;
          }
        }
      }
      walkFilter(value, queryName);
    }
  };
  for (const [queryName, query] of Object.entries(
    (data as { queries?: Record<string, { body?: unknown }> }).queries ?? {}
  )) {
    walkFilter(query?.body, queryName);
  }

  // Numscript feature pragmas, verified against the playground parser
  // (2026-08-07). Three ways this goes wrong silently:
  //
  //   - two stacked `#![feature(...)]` lines are a PARSE error ("mismatched
  //     input '#!'"); multiple features must be comma-separated inside one
  //     pragma;
  //   - a script that interpolates a variable into an account path without
  //     `experimental-account-interpolation` parses but refuses to run;
  //   - same for `overdraft()` without `experimental-overdraft-function`.
  //
  // `interpreter:` is NOT a field the ledger reads (V2TransactionTemplate
  // declares description / runtime / script only, with no
  // additionalProperties:false), so it validated cleanly while declaring
  // nothing at all. It is banned outright.
  const FEATURE_TRIGGERS: Array<[string, RegExp]> = [
    ["experimental-account-interpolation", /@[A-Za-z0-9_:*-]*\$[A-Za-z_]/],
    ["experimental-overdraft-function", /\boverdraft\s*\(/],
    ["experimental-get-asset-function", /\bget_asset\s*\(/],
    ["experimental-get-amount-function", /\bget_amount\s*\(/],
  ];
  const transactions = (data as {
    transactions?: Record<string, { script?: string; interpreter?: unknown }>;
  }).transactions ?? {};
  for (const [txName, tx] of Object.entries(transactions)) {
    if (tx?.interpreter !== undefined) {
      console.error(
        `✗ ${file}: transactions.${txName} sets \`interpreter\`, which the ledger ignores; declare features with a #![feature(...)] pragma instead`
      );
      failures++;
    }
    const script = tx?.script ?? "";
    const pragmaLines = script
      .split("\n")
      .filter((l) => l.trim().startsWith("#!["));
    if (pragmaLines.length > 1) {
      console.error(
        `✗ ${file}: transactions.${txName} has ${pragmaLines.length} pragma lines; Numscript accepts one, with features comma-separated inside it`
      );
      failures++;
    }
    const declared = pragmaLines.join(" ");
    for (const [feature, trigger] of FEATURE_TRIGGERS) {
      if (trigger.test(script) && !declared.includes(feature)) {
        console.error(
          `✗ ${file}: transactions.${txName} needs the "${feature}" feature but does not declare it, so it cannot execute`
        );
        failures++;
      }
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
