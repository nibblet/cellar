import type { McpToolResult } from "./tools";

export function formatMcpToolResult<T>(result: McpToolResult<T>) {
  if (!result.ok) {
    return {
      isError: true as const,
      content: [{ type: "text" as const, text: result.error }],
    };
  }

  const text = JSON.stringify(result.data, null, 2);
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: result.data,
  };
}
