# Prometheus Alert Rule Companion (VS Code)

Lints Prometheus alert rule YAML — duplicate alert names, missing
`for:`, missing summary/description annotations, empty `expr:`. No
data leaves your editor.

**v0.1, new niche.** Not a port from the Gap Hunter Labs IntelliJ-
family catalog. Evidence: `pint` (Cloudflare) documents **37 real
checks** for Prometheus alert rules and is CLI-only — no editor
integration mentioned anywhere in its own docs. The one VS Code
extension with real PromQL language-server intelligence "isn't
published on the Extensions Marketplace yet" — the published
alternatives are syntax-highlighting only.

## What it checks

Live, on any `.yml`/`.yaml` file that contains Prometheus-shaped alert
rules (`groups: → rules: → - alert:`):

- **Duplicate alert names** — the same `alert:` name declared twice.
- **Missing `for:`** — an alert with no sustained-duration guard can
  fire on a single scrape blip instead of a real condition
  (`for: 0s`/`0m` is treated the same as missing — fires instantly).
- **Missing annotations** — no `summary` or `description` under
  `annotations:` — whoever gets paged has no context.
- **Empty `expr:`** — a rule with no expression can never fire.

**v0.1 scope, honestly noted:** a text-only structural subset of
`pint`'s 37 checks — not full PromQL parsing. `pint`'s semantic checks
(`promql/impossible`, `promql/fragile`, and the rest of its
`promql/*` family) need a real PromQL grammar and aren't attempted
here. Parsing is a hand-rolled, indentation-aware line scanner for the
known Prometheus rule-group shape, not a general YAML parser.

## Privacy

See [PRIVACY.md](PRIVACY.md) — zero network calls, everything runs
against files already open in your editor.

## Development

```bash
npm install
npm run compile   # or: npm run watch
npm test
```

To build an installable package without publishing:

```bash
npx @vscode/vsce package
```

## License

Apache License 2.0 — see [LICENSE](LICENSE).
