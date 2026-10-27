# clockport — Build Report

Wave 1, MCP Rebuild 100. Clean-room rebuild of the "time" MCP server
(mcp-server-time), built from the public tool spec in
`harness/fixtures/time-tools-original.json` only. Local build only —
nothing pushed or published.

Identity: repo `clockport`, npm `@reneturcios/clockport`,
MCP name `io.github.CloudCorpRecords/clockport`, version `0.1.0`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json` — bin `clockport: dist/cli.js`, `mcpName` set,
  scripts build=`tsc` / dev=`tsx src/cli.ts` / test=`tsx --test test/*.test.ts`
- `server.json` — description "Current time and timezone conversion for
  any IANA zone." = **55 chars** (≤100 ✓); npm entry carries
  `version: 0.1.0`; OCI entry `ghcr.io/cloudcorprecords/clockport:0.1.0`
  carries **no** `version` field (verified programmatically)
- `Dockerfile` — node:20-alpine two-stage, ENTRYPOINT `node /app/dist/cli.js`,
  CMD `mcp`, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/clockport"`
- `tsconfig.json` (byte-identical to shipcheck's, 318 bytes), `.gitignore`,
  `LICENSE` (MIT, Copyright (c) 2026 Rene Turcios), `README.md` (fresh
  text), `CHANGELOG.md` (single 0.1.0 entry, 2026-10-26)
- `src/index.ts`, `src/cli.ts` (`mcp`, `now <tz>`, `convert <src> <HH:MM> <dst>`,
  `--version`; exit 2 usage / 1 lookup error), `src/mcp.ts`, `src/types.ts`,
  `src/clock.ts` (core logic, `VERSION = "0.1.0"`)
- `test/clock.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (adapted from shipcheck; image name and smoke-test server name changed)

## Implementation notes

- Core uses `Intl.DateTimeFormat` / Node stdlib only (plus SDK + zod).
  Zone offsets are derived from Intl's rendering of an instant, so DST
  rules come from the platform IANA database.
- `convert_time` uses today's date (in the source zone) as the reference
  date, per spec; the reference date is returned with every result and
  documented in the README. Core functions accept an injectable
  reference instant for deterministic tests.
- **Deviation from the TEMPLATE §2.12 pattern, with reason:** `src/mcp.ts`
  uses the SDK's low-level `Server` (still `@modelcontextprotocol/sdk`,
  zod still validates every `tools/call`) instead of `McpServer`.
  `McpServer`'s zod-to-JSON-Schema conversion injects `$schema` and
  `additionalProperties: false` into every inputSchema — keys absent
  from the public spec — which scored parity at 50.0 PARTIAL (first run
  preserved in `parity-out-mcpserver-v1/`). The low-level server serves
  `tools/list` with the spec's exact input schemas (names, properties,
  required sets, and parameter descriptions identical).

## Verification (exact outputs)

### 1. Build
```
$ ./node_modules/.bin/tsc ; echo exit=$?
tsc exit=0
```
`dist/` produced (cli.js with `#!/usr/bin/env node` shebang, clock.js,
mcp.js, index.js, types.js, plus .d.ts/.js.map).

### 2. Tests
```
$ ./node_modules/.bin/tsx --test test/*.test.ts
ℹ tests 16
ℹ pass 16
ℹ fail 0
```
Covers: fixed-reference conversion 12:00 America/New_York -> 17:00
Europe/London (winter and summer), midnight date rollover, westward
-5h, half-hour offsets (+5.5h Kolkata), DST reporting, invalid
timezone errors, invalid time-format errors.

### 3. MCP smoke
initialize -> `serverInfo: {"name":"clockport","version":"0.1.0"}`;
tools/list -> exactly the two spec tools with spec-identical schemas;
tools/call `get_current_time` America/New_York returned
`2026-10-26 11:41:31 ... -04:00` (live). CLI checks:
`now America/New_York`, `convert America/New_York 12:00 Europe/London`
-> `... -> 2026-10-26 16:00 Europe/London (+4h)` (correct for
2026-10-26: US still on EDT, UK back on GMT), `--version` -> `0.1.0`,
unknown command exits 2 with Usage, bad zone exits 1.

### 4. Parity (harness, from ~/workspace/mcp-rebuild-100/harness/)
With fixtures (original is tools-file mode, so harness records
`fixture_results: SKIPPED-TOOLS-FILE-MODE` — expected semantics, not an
error):
```
$ python3 parity.py --original fixtures/time-tools-original.json \
    --rebuild "stdio:node /home/hatch/workspace/mcp-rebuild-100/builds/clockport/dist/cli.js mcp" \
    --fixtures test/time-fixtures.json \
    --out /home/hatch/workspace/mcp-rebuild-100/builds/clockport/parity-out
verdict=PASS parity_pct=100.0 original_tools=2 rebuild_tools=2 missing=[] extra=[] schema_diffs=[]
(exit 0)
```
Without `--fixtures` (out: `parity-out-nofixtures/`): identical result —
`verdict=PASS parity_pct=100.0`, exit 0.

First (superseded) McpServer-based run, for the record:
`verdict=PARTIAL parity_pct=50.0 ... schema_diffs=['convert_time', 'get_current_time']`
with the only diffs being the converter-injected `$schema` /
`additionalProperties` keys; preserved in `parity-out-mcpserver-v1/`.

## Lockfile status

`package-lock.json` was copied from shipcheck's and edited with
`muse.edit`: top-level `name`, root package `name`, and root package
`bin` key changed shipcheck -> clockport (dependencies are identical
ranges, so the tree is unchanged). Per the fleet lesson in TEMPLATE.md
§2 item 6, a lockfile must be generated clean (no `node_modules`
present) before first publish — **clean regeneration is deferred to
the publish wave**; do not publish from this lockfile as-is.
`node_modules` in this build dir is a `cp -a` copy of shipcheck's
(local build only, gitignored).

## Blockers

None for the local build. Notes for the publish wave:
- Regenerate `package-lock.json` clean before first publish (above).
- Container build not exercised locally (no Docker run in this wave);
  the publish-container workflow smoke-tests the image at publish time.
