#!/usr/bin/env node
/**
 * clockport CLI.
 *
 *   clockport now <timezone> [--json]
 *   clockport convert <source_timezone> <HH:MM> <target_timezone> [--json]
 *   clockport mcp
 *
 * Exit codes: 0 success, 1 conversion/lookup error, 2 usage error.
 * `convert` uses today's date as the reference date.
 */
import { convertTime, getCurrentTime, VERSION } from "./clock.js";

function usage(): never {
  console.error(`Usage:
  clockport now <timezone> [--json]
  clockport convert <source_timezone> <HH:MM> <target_timezone> [--json]
  clockport mcp
  clockport --version`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (!cmd) usage();
  const asJson = rest.includes("--json");
  const args = rest.filter((a) => a !== "--json");
  try {
    if (cmd === "now") {
      const [timezone] = args;
      if (!timezone) usage();
      const result = getCurrentTime(timezone);
      if (asJson) console.log(JSON.stringify(result, null, 2));
      else console.log(`${result.current_time} (${result.timezone}, ${result.iso8601})`);
    } else if (cmd === "convert") {
      const [source, time, target] = args;
      if (!source || !time || !target) usage();
      const result = convertTime(source, time, target);
      if (asJson) console.log(JSON.stringify(result, null, 2));
      else
        console.log(
          `${result.source_time} ${result.source_timezone} -> ${result.target_time} ${result.target_timezone} (${result.time_difference})`,
        );
    } else {
      usage();
    }
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
