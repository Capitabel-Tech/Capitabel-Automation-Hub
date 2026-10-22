#!/usr/bin/env node
/**
 * Zoho CRM MCP Server
 *
 * This app's own code only ever calls two tools - zohocrm_create_records
 * (new Leads, new Meetings-as-Events) and zohocrm_search_records
 * (duplicate-lead check, meeting contact match). Every tool with real write
 * power beyond plain create (update, upsert, delete, convert_lead, add_tags,
 * attach_link, upload_file) has been removed from this server entirely, not
 * just left unused, so nothing can call them even by accident. The harmless,
 * read-only metadata tools (get_records, get_record, and everything in
 * settings.ts/users.ts) are kept available for ad-hoc diagnostics, since
 * they can't change or delete anything in Zoho.
 *
 * Authentication: OAuth 2.0 with refresh token
 * Required environment variables:
 *   ZOHO_CLIENT_ID      - OAuth client ID
 *   ZOHO_CLIENT_SECRET  - OAuth client secret
 *   ZOHO_REFRESH_TOKEN  - Long-lived refresh token
 *   ZOHO_API_DOMAIN     - Optional, default: https://www.zohoapis.com
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerRecordTools } from "./tools/records.js";
import { registerSettingsTools } from "./tools/settings.js";
import { registerUserTools } from "./tools/users.js";

const server = new McpServer({
  name: "zohocrm-mcp-server",
  version: "1.0.0",
});

registerRecordTools(server);
registerSettingsTools(server);
registerUserTools(server);

async function main(): Promise<void> {
  const required = ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN"];
  const missing = required.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error(`ERROR: Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Zoho CRM MCP server running via stdio");
}

main().catch((error: unknown) => {
  console.error("Server error:", error);
  process.exit(1);
});
