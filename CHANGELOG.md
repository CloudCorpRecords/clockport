# Changelog

## 0.1.0 (2026-10-26)

- Initial release.
- CLI: `clockport now <timezone>` prints the current time in an IANA
  timezone; `clockport convert <source_timezone> <HH:MM> <target_timezone>`
  converts a time of day between zones. Both accept `--json`.
- MCP server (`clockport mcp`, stdio) with two tools:
  `get_current_time` and `convert_time`.
- Conversions use today's date in the source zone as the reference
  date, so daylight-saving differences in force today are applied;
  the reference date is reported with every result.
- Zone arithmetic is built on `Intl.DateTimeFormat` only — no bundled
  timezone tables and no runtime dependencies beyond the MCP SDK.
