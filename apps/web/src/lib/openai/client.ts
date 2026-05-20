import OpenAI from "openai";

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

/**
 * Lazy-instantiated OpenAI client. Created once per server process.
 */
let cached: OpenAI | null = null;

export function openai(): OpenAI {
  if (!cached) {
    cached = new OpenAI({ apiKey: required("OPENAI_API_KEY", process.env.OPENAI_API_KEY) });
  }
  return cached;
}

export const MODELS = {
  vision: "gpt-5-mini",
  mapper: "gpt-5-nano",
  prose: "gpt-5-mini",
} as const;
