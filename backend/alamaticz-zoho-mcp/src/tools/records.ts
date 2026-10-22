import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createZohoClient, handleApiError } from "../services/zoho-client.js";
import { CHARACTER_LIMIT } from "../constants.js";
import type {
  ZohoListResponse,
  ZohoActionResponse,
} from "../types.js";

export function registerRecordTools(server: McpServer): void {
  // ── GET RECORDS ────────────────────────────────────────────────────────────
  server.registerTool(
    "zohocrm_get_records",
    {
      title: "Get Records",
      description: `Retrieve a list of records from any Zoho CRM module.`,
      inputSchema: z.object({
        module: z.string().min(1),
        fields: z.string().optional(),
        page: z.number().int().min(1).default(1),
        per_page: z.number().int().min(1).max(200).default(200),
        page_token: z.string().optional(),
        sort_by: z.enum(["id", "Created_Time", "Modified_Time"]).optional(),
        sort_order: z.enum(["asc", "desc"]).default("desc"),
        ids: z.string().optional(),
      }).strict(),
    },
    async ({ module, fields, page, per_page, page_token, sort_by, sort_order, ids }) => {
      try {
        const client = await createZohoClient();
        const params: Record<string, unknown> = { page, per_page, sort_order };
        if (fields) params.fields = fields;
        if (page_token) params.page_token = page_token;
        if (sort_by) params.sort_by = sort_by;
        if (ids) params.ids = ids;

        const { data } = await client.get<ZohoListResponse>(`/${module}`, { params });
        const text = JSON.stringify(data, null, 2);
        return {
          content: [{ type: "text", text: text.length > CHARACTER_LIMIT ? text.slice(0, CHARACTER_LIMIT) + "\n... [truncated]" : text }]
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── GET SINGLE RECORD ──────────────────────────────────────────────────────
  server.registerTool(
    "zohocrm_get_record",
    {
      title: "Get Record",
      description: `Retrieve a single record by its ID from any Zoho CRM module.`,
      inputSchema: z.object({
        module: z.string().min(1),
        record_id: z.string().min(1),
        fields: z.string().optional(),
      }).strict(),
    },
    async ({ module, record_id, fields }) => {
      try {
        const client = await createZohoClient();
        const params: Record<string, unknown> = {};
        if (fields) params.fields = fields;
        const { data } = await client.get<ZohoListResponse>(`/${module}/${record_id}`, { params });
        const text = JSON.stringify(data, null, 2);
        return {
          content: [{ type: "text", text: text }]
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── CREATE RECORDS ─────────────────────────────────────────────────────────
  server.registerTool(
    "zohocrm_create_records",
    {
      title: "Create Records",
      description: `Create one or more records in a Zoho CRM module.`,
      inputSchema: z.object({
        module: z.string().min(1),
        data: z.array(z.record(z.unknown())).min(1).max(100),
        trigger: z.array(z.enum(["workflow", "approval", "blueprint"])).optional(),
      }).strict(),
    },
    async ({ module, data, trigger }) => {
      try {
        const client = await createZohoClient();
        const body: Record<string, unknown> = { data };
        if (trigger) body.trigger = trigger;
        const response = await client.post<ZohoActionResponse>(`/${module}`, body);
        return {
          content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }]
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );

  // ── SEARCH RECORDS ─────────────────────────────────────────────────────────
  server.registerTool(
    "zohocrm_search_records",
    {
      title: "Search Records",
      description: `Search for records in a Zoho CRM module.`,
      inputSchema: z.object({
        module: z.string().min(1),
        criteria: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        word: z.string().optional(),
        fields: z.string().optional(),
        page: z.number().int().min(1).default(1),
        per_page: z.number().int().min(1).max(200).default(200),
      }).strict(),
    },
    async ({ module, criteria, email, phone, word, fields, page, per_page }) => {
      try {
        const client = await createZohoClient();
        const params: Record<string, unknown> = { page, per_page };
        if (criteria) params.criteria = criteria;
        if (email) params.email = email;
        if (phone) params.phone = phone;
        if (word) params.word = word;
        if (fields) params.fields = fields;

        const { data } = await client.get<ZohoListResponse>(`/${module}/search`, { params });
        const text = JSON.stringify(data, null, 2);
        return {
          content: [{ type: "text", text: text.length > CHARACTER_LIMIT ? text.slice(0, CHARACTER_LIMIT) + "\n... [truncated]" : text }]
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleApiError(error) }] };
      }
    }
  );
}
