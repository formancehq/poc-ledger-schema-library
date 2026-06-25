/**
 * Renders human-readable markdown from the canonical YAML templates:
 *   - docs/<slug>.md   — one page per template (meta, chart tree, transactions
 *                        with Numscript fences, queries)
 *   - README.md        — catalog index linking every template
 *
 * Generated, never hand-edited. YAML stays the single source of truth.
 * Re-run after any template change; CI asserts the output is in sync.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { load as yamlLoad } from "js-yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SCHEMAS_DIR = join(ROOT, "schemas");
const DOCS_DIR = join(ROOT, "docs");

type TMeta = { slug: string; name: string; description?: string; tags?: string[] };
type TTransaction = { description?: string; script?: string; interpreter?: string; featureFlags?: string[]; input?: string };
type TQuery = { name?: string; description?: string; resource?: string; vars?: Record<string, unknown>; params?: unknown; body?: unknown };
type TTemplate = { meta: TMeta; chart?: Record<string, unknown>; transactions?: Record<string, TTransaction>; queries?: Record<string, TQuery> };

/** Render the chart tree as an indented bullet list. Leaves marked, `$vars` and `.props` shown. */
function renderChart(node: unknown, depth = 0): string[] {
  if (!node || typeof node !== "object" || Array.isArray(node)) return [];
  const out: string[] = [];
  const pad = "  ".repeat(depth);
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === ".self") {
      out.push(`${pad}- \`.self\` _(bookable account)_`);
      continue;
    }
    if (key.startsWith(".")) {
      out.push(`${pad}- \`${key}\``);
      continue;
    }
    const isLeaf = value === null || (typeof value === "object" && Object.keys(value as object).length === 0);
    out.push(`${pad}- \`${key}\``);
    if (!isLeaf) out.push(...renderChart(value, depth + 1));
  }
  return out;
}

function countLeaves(node: unknown): number {
  if (!node || typeof node !== "object" || Array.isArray(node)) return 0;
  const entries = Object.entries(node as Record<string, unknown>).filter(([k]) => !k.startsWith("."));
  if (entries.length === 0) return 1;
  return entries.reduce((acc, [, v]) => acc + countLeaves(v), 0);
}

function renderTemplate(t: TTemplate): string {
  const { meta } = t;
  const lines: string[] = [];
  lines.push(`<!-- Generated from schemas/${meta.slug}.yaml by tools/render-md.ts. Do not edit. -->`);
  lines.push(`# ${meta.name}`, "");
  if (meta.description) lines.push(`> ${meta.description}`, "");
  if (meta.tags?.length) lines.push(meta.tags.map((tag) => `\`${tag}\``).join(" · "), "");

  const txCount = Object.keys(t.transactions ?? {}).length;
  const qCount = Object.keys(t.queries ?? {}).length;
  lines.push(`**${countLeaves(t.chart)} accounts · ${txCount} transactions · ${qCount} queries**`, "");

  if (t.chart) {
    lines.push("## Chart of accounts", "");
    lines.push(...renderChart(t.chart));
    lines.push("");
  }

  if (t.transactions && txCount > 0) {
    lines.push("## Transactions", "");
    for (const [name, tx] of Object.entries(t.transactions)) {
      lines.push(`### \`${name}\``, "");
      if (tx.description) lines.push(tx.description.trim(), "");
      const badges: string[] = [];
      if (tx.interpreter) badges.push(`interpreter: \`${tx.interpreter}\``);
      if (tx.featureFlags?.length) badges.push(`flags: ${tx.featureFlags.map((f) => `\`${f}\``).join(", ")}`);
      if (tx.input) badges.push(`fixture: \`${tx.input}\``);
      if (badges.length) lines.push(badges.join(" · "), "");
      if (tx.script) lines.push("```numscript", tx.script.replace(/\n+$/, ""), "```", "");
    }
  }

  if (t.queries && qCount > 0) {
    lines.push("## Queries", "");
    for (const [name, q] of Object.entries(t.queries)) {
      lines.push(`### \`${name}\``, "");
      if (q.name) lines.push(`**${q.name}**`, "");
      if (q.description) lines.push(q.description.trim(), "");
      const meta2: string[] = [];
      if (q.resource) meta2.push(`resource: \`${q.resource}\``);
      if (q.vars && Object.keys(q.vars).length) meta2.push(`vars: ${Object.keys(q.vars).map((v) => `\`${v}\``).join(", ")}`);
      if (meta2.length) lines.push(meta2.join(" · "), "");
      if (q.body !== undefined) {
        lines.push("```json", JSON.stringify(q.body, null, 2), "```", "");
      }
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

const files = readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith(".yaml")).sort();
const catalog: TMeta[] = [];

for (const file of files) {
  const t = yamlLoad(readFileSync(join(SCHEMAS_DIR, file), "utf8")) as TTemplate;
  writeFileSync(join(DOCS_DIR, `${t.meta.slug}.md`), renderTemplate(t));
  catalog.push(t.meta);
  console.log(`rendered docs/${t.meta.slug}.md`);
}

// catalog README
const readme: string[] = [];
readme.push("<!-- Generated by tools/render-md.ts. Do not edit. -->");
readme.push("# Formance ledger-schema library", "");
readme.push(
  "Single source of truth for Formance ledger-schema templates — chart of accounts,",
  "Numscript transaction templates, and reusable queries. Consumed at build time by",
  "the platform-ui **studio** gallery and the **docs** site (`<LedgerSchema schema=\"…\"/>`).",
  ""
);
readme.push("Each template is a self-contained YAML file under [`schemas/`](./schemas) validated against", "[`schemas/ledger-schema.schema.json`](./schemas/ledger-schema.schema.json). The filename equals", "`meta.slug` and is the public lookup key — do not rename without updating consumers.", "");
readme.push("## Templates", "");
readme.push("| Template | Description | Tags |", "| --- | --- | --- |");
for (const m of catalog) {
  readme.push(`| [${m.name}](./docs/${m.slug}.md) | ${m.description ?? ""} | ${(m.tags ?? []).map((t) => `\`${t}\``).join(" ")} |`);
}
readme.push("");
readme.push("## Tooling", "");
readme.push("- `pnpm validate` — validate every template against the canonical schema (CI gate).");
readme.push("- `pnpm render` — regenerate `docs/*.md` + this `README.md` (CI asserts no drift).");
readme.push("");
writeFileSync(join(ROOT, "README.md"), readme.join("\n") + "\n");
console.log("rendered README.md");
