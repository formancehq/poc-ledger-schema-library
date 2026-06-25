# Formance ledger-schema library

Single source of truth for Formance ledger-schema templates — chart of accounts,
Numscript transaction templates, and reusable queries — plus the prose
documentation that goes with them. Consumed at build time by the platform-ui
**studio** gallery and the **docs** site.

## Layout

```
schemas/
  <slug>.yaml                  one self-contained template per file (the data SSOT)
  ledger-schema.schema.json    canonical JSON Schema (draft 2020-12) for the templates
  numscript-fixtures.schema.json
docs/
  examples/**/<slug>.mdx       per-template documentation pages (the prose SSOT)
numscript-fixtures.yaml        named fixtures for Numscript validation
starter.yaml                   blank starter template
tools/
  validate.ts                  Ajv validation + SSOT invariants (CI gate)
```

Each template's filename equals its `meta.slug` and is the public lookup key —
the docs `<LedgerSchema schema="…"/>` reference and the studio gallery slug. Do
not rename without updating consumers.

## Templates vs. docs

- `schemas/<slug>.yaml` is the **data** — validated against the canonical schema
  and consumed by both the studio and the docs site.
- `docs/<slug>.mdx` is the **prose** — hand-written (each template is documented
  differently, so it can't be generated). Only some templates have a page; the
  optional `meta.docsUrl` field on a template points at its published page.

The docs site syncs both `schemas/` and `docs/` into its content tree at build
time (see its `generate-ledger-schemas` recipe) and renders the MDX with its own
component set. The MDX is therefore docs-framework-flavored (frontmatter +
`<LedgerSchema>`, `<DocCallout>`, …); the library stores it but does not compile
it.

## Tooling

- `pnpm validate` — validate every template against the canonical schema and the
  SSOT invariants (filename === `meta.slug`, unique slugs, parseable YAML). CI gate.
