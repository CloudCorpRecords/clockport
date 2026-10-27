# clockport

clockport tells you what time it is somewhere else, and what a given
clock time in one place corresponds to in another. It answers two
questions — "what time is it in Tokyo right now?" and "my call is at
12:00 New York time, what is that in London?" — from the command line
or as an MCP server for agents.

All zone handling uses the IANA timezone database behind Node's `Intl`
support, so daylight-saving changes are handled by the platform rather
than by a fixed offset table.

## Install

```bash
npx @reneturcios/clockport now Europe/London
```

Or run the container image:

```bash
docker run -i ghcr.io/cloudcorprecords/clockport
```

The container defaults to the MCP server (see below). Pass CLI
arguments to use it as a CLI instead.

## CLI

```bash
# Current time in a zone
clockport now America/New_York
# 2026-01-15 07:00:00 (America/New_York, 2026-01-15T07:00:00-05:00)

# Convert a time between zones
clockport convert America/New_York 12:00 Europe/London
# 2026-10-26 12:00 America/New_York -> 2026-10-26 17:00 Europe/London (+5h)

# Machine-readable output
clockport now Asia/Tokyo --json
clockport convert UTC 09:30 Asia/Kolkata --json

clockport --version
```

Exit codes: `0` on success, `1` when a zone or time cannot be handled
(the error names the problem), `2` for usage errors.

## MCP server

One bin serves both faces. The `mcp` subcommand starts a stdio MCP
server:

```bash
npx -y @reneturcios/clockport mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "clockport": {
      "command": "npx",
      "args": ["-y", "@reneturcios/clockport", "mcp"]
    }
  }
}
```

### Tools

| Tool | Input | What it returns |
| --- | --- | --- |
| `get_current_time` | `timezone` (string, required) — IANA timezone name | The current time in that zone: wall-clock rendering, ISO 8601 form with offset, weekday, UTC offset in minutes, and whether DST is in effect. |
| `convert_time` | `source_timezone` (string, required), `time` (string, required, `HH:MM` 24-hour), `target_timezone` (string, required) | The requested time rendered in the target zone, with the target date (which may differ from the source date), an ISO 8601 form, and the signed offset difference. |

Unknown timezone names and times that are not valid `HH:MM` values are
reported as tool errors rather than guessed at.

### Reference date for conversions

`convert_time` takes a time of day but no date. Conversions therefore
use **today's date** — the current calendar date in the source zone —
as the reference date. This matters around daylight-saving transitions,
where the offset difference between two zones can change from one week
to the next; the result always reflects the difference in force today.
The reference date used is included in every conversion result.

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # node test runner over test/*.test.ts, no network
npm run dev     # run the CLI from source via tsx
```

## License

MIT — see `LICENSE`.
