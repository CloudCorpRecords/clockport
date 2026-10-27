/**
 * clockport MCP server. Tools: get_current_time, convert_time.
 *
 * Why the low-level Server instead of McpServer: the high-level helper
 * converts zod schemas to JSON Schema and injects two keys that are not
 * in this tool's public spec ("$schema" and "additionalProperties"),
 * which breaks exact tool-list/schema parity with the spec. This file
 * therefore serves tools/list with the spec's exact input schemas,
 * while zod still validates every tools/call argument set. Tool names,
 * parameters, and parameter descriptions are taken from the public spec.
 *
 * Conversion uses today's date as the reference date (see README).
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { convertTime, getCurrentTime, VERSION } from "./clock.js";

const GetCurrentTimeArgs = z.object({
  timezone: z.string().describe("IANA timezone name"),
});

const ConvertTimeArgs = z.object({
  source_timezone: z.string(),
  time: z.string().describe("Time in HH:MM format"),
  target_timezone: z.string(),
});

const TOOLS = [
  {
    name: "get_current_time",
    description: "Get current time in a specific time zone.",
    inputSchema: {
      type: "object" as const,
      properties: {
        timezone: { type: "string", description: "IANA timezone name" },
      },
      required: ["timezone"],
    },
  },
  {
    name: "convert_time",
    description: "Convert time between time zones.",
    inputSchema: {
      type: "object" as const,
      properties: {
        source_timezone: { type: "string" },
        time: { type: "string", description: "Time in HH:MM format" },
        target_timezone: { type: "string" },
      },
      required: ["source_timezone", "time", "target_timezone"],
    },
  },
];

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "clockport", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    if (name === "get_current_time") {
      const parsed = GetCurrentTimeArgs.parse(args ?? {});
      return textResult(getCurrentTime(parsed.timezone));
    }
    if (name === "convert_time") {
      const parsed = ConvertTimeArgs.parse(args ?? {});
      return textResult(
        convertTime(parsed.source_timezone, parsed.time, parsed.target_timezone),
      );
    }
  } catch (err) {
    return errorResult(err);
  }
  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
