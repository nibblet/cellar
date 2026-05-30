import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { NCCC_MCP_INSTRUCTIONS } from "@/lib/mcp/constants";
import { formatMcpToolResult } from "@/lib/mcp/format-result";
import {
  mcpGetProduct,
  mcpRecommend,
  mcpSearchProducts,
  mcpSuggestPairings,
  mcpSuggestSimilar,
  mcpTonightsPick,
} from "@/lib/mcp/tools";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const readOnly = { readOnlyHint: true, idempotentHint: true } as const;

const productTypeSchema = z.enum(["cigar", "bourbon", "all"]);

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_products",
      {
        title: "Search products",
        description:
          "Search the NCCC catalog by product name or brand. Returns ranked candidates with match scores. Always call this (or recommend) before suggest_* when you only have a name, not a UUID. Does NOT return pairings — use suggest_pairings for that.",
        inputSchema: {
          query: z
            .string()
            .min(2)
            .describe("Product name or brand fragment, e.g. 'Padron 1964' or 'Elijah Craig'."),
          type: productTypeSchema
            .optional()
            .describe("Filter to cigar, bourbon, or all. Defaults to all."),
          limit: z
            .number()
            .int()
            .min(1)
            .max(10)
            .optional()
            .describe("Max candidates to return. Defaults to 5."),
        },
        annotations: readOnly,
      },
      async ({ query, type, limit }) => {
        const supabase = createSupabaseAdminClient();
        return formatMcpToolResult(await mcpSearchProducts(supabase, { query, type, limit }));
      },
    );

    server.registerTool(
      "get_product",
      {
        title: "Get product",
        description:
          "Fetch one confirmed catalog product by UUID: specs, club recommend counts, and top flavor tags. Use when the user asks what the club thinks of a specific product. Does NOT suggest pairings — use suggest_pairings.",
        inputSchema: {
          product_id: z.string().uuid().describe("Catalog product UUID from search_products."),
        },
        annotations: readOnly,
      },
      async ({ product_id }) => {
        const supabase = createSupabaseAdminClient();
        return formatMcpToolResult(await mcpGetProduct(supabase, { product_id }));
      },
    );

    server.registerTool(
      "suggest_pairings",
      {
        title: "Suggest pairings",
        description:
          "Cross-category pairings for a catalog product (cigar↔bourbon) with scores, rule reasons, and club validation when available. Does NOT find similar cigars or bourbons — use suggest_similar for same-category picks.",
        inputSchema: {
          product_id: z.string().uuid().describe("Source product UUID."),
          limit: z
            .number()
            .int()
            .min(1)
            .max(10)
            .optional()
            .describe("Max pairings to return. Defaults to 3."),
          member_email: z
            .string()
            .email()
            .optional()
            .describe("Optional member email to prefer bottles/sticks on their Have shelf first."),
        },
        annotations: readOnly,
      },
      async ({ product_id, limit, member_email }) => {
        const supabase = createSupabaseAdminClient();
        return formatMcpToolResult(
          await mcpSuggestPairings(supabase, { product_id, limit, member_email }),
        );
      },
    );

    server.registerTool(
      "suggest_similar",
      {
        title: "Suggest similar",
        description:
          "Same-category alternatives by flavor profile (cigar→cigar, bourbon→bourbon), optionally filtered to similar tier and price band. Does NOT pair across categories — use suggest_pairings.",
        inputSchema: {
          product_id: z.string().uuid().describe("Source product UUID."),
          limit: z
            .number()
            .int()
            .min(1)
            .max(10)
            .optional()
            .describe("Max similar products. Defaults to 3."),
          match_tier: z
            .boolean()
            .optional()
            .describe("When true (default), prefer similar tier and price band."),
        },
        annotations: readOnly,
      },
      async ({ product_id, limit, match_tier }) => {
        const supabase = createSupabaseAdminClient();
        return formatMcpToolResult(
          await mcpSuggestSimilar(supabase, { product_id, limit, match_tier }),
        );
      },
    );

    server.registerTool(
      "tonights_pick",
      {
        title: "Tonight's pick",
        description:
          "Deterministic cigar+bourbon pairing for today (UTC), same rotation as the NCCC feed Daily Pour. Pass member_email to apply taste preferences and cellar shelf bias; omit for the club-wide pool. Returns null pick when the candidate pool is empty.",
        inputSchema: {
          member_email: z
            .string()
            .email()
            .optional()
            .describe(
              "Member email for a personalized daily pick (preferences + Have-shelf bias). Omit for club-wide suggestion.",
            ),
        },
        annotations: readOnly,
      },
      async ({ member_email }) => {
        const supabase = createSupabaseAdminClient();
        return formatMcpToolResult(await mcpTonightsPick(supabase, { member_email }));
      },
    );

    server.registerTool(
      "recommend",
      {
        title: "Recommend",
        description:
          "One-shot: resolve a product name then return pairings (intent=pair) or similar products (intent=similar). Best first call when the user names a product in chat. Returns disambiguation candidates when the name is ambiguous.",
        inputSchema: {
          query: z.string().min(2).describe("Product name as the user said it."),
          intent: z
            .enum(["pair", "similar"])
            .describe("pair = cross-category pairing; similar = same-category alternatives."),
          type: productTypeSchema
            .optional()
            .describe("Optional type hint when the name is ambiguous."),
          member_email: z
            .string()
            .email()
            .optional()
            .describe("Optional member email for shelf-biased pairings."),
        },
        annotations: readOnly,
      },
      async ({ query, intent, type, member_email }) => {
        const supabase = createSupabaseAdminClient();
        return formatMcpToolResult(
          await mcpRecommend(supabase, { query, intent, type, member_email }),
        );
      },
    );

    server.registerPrompt(
      "tonights-pick",
      {
        title: "Tonight's pick",
        description: "Ask for today's cigar+bourbon pairing suggestion from NCCC.",
        argsSchema: {
          email: z
            .string()
            .email()
            .optional()
            .describe("Optional member email for a personalized pick."),
        },
      },
      ({ email }) => ({
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: email
                ? `What's tonight's pick for me (${email})? Use tonights_pick with my email.`
                : "What's tonight's pick for the club? Use tonights_pick.",
            },
          },
        ],
      }),
    );

    server.registerPrompt(
      "what-pairs",
      {
        title: "What pairs?",
        description: "Ask what bourbon or cigar pairs with a named product.",
        argsSchema: {
          product: z.string().describe("Product name, e.g. 'Perdomo Champagne'."),
        },
      },
      ({ product }) => ({
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `What bourbon or cigar pairs with ${product}? Use the NCCC MCP tools — start with recommend (intent=pair) or search_products then suggest_pairings.`,
            },
          },
        ],
      }),
    );

    server.registerPrompt(
      "what-similar",
      {
        title: "What similar?",
        description: "Ask for same-category alternatives at a similar tier.",
        argsSchema: {
          product: z.string().describe("Product name the member likes."),
        },
      },
      ({ product }) => ({
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `What similar products should I try if I like ${product}? Same tier if possible. Use recommend (intent=similar) or search_products then suggest_similar.`,
            },
          },
        ],
      }),
    );
  },
  {
    instructions: NCCC_MCP_INSTRUCTIONS,
    serverInfo: {
      name: "nccc-pairing",
      version: "1.1.0",
    },
  },
  {
    basePath: "/api",
    maxDuration: 60,
    disableSse: true,
  },
);

async function verifyToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  const expected = process.env.NCCC_MCP_TOKEN;
  if (!expected || !bearerToken || bearerToken !== expected) return undefined;
  return {
    token: bearerToken,
    scopes: ["nccc:read"],
    clientId: "nccc-club",
  };
}

const authHandler = withMcpAuth(handler, verifyToken, { required: true });

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
