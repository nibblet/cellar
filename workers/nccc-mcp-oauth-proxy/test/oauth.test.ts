import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { Association } from "../src/oauth";
import { sha256base64url } from "../src/util";

async function clearKV(): Promise<void> {
  const list = await env.KV.list();
  for (const key of list.keys) await env.KV.delete(key.name);
}

describe("OAuth discovery", () => {
  it("returns protected resource metadata", async () => {
    const r = await SELF.fetch("http://proxy.example/.well-known/oauth-protected-resource");
    expect(r.status).toBe(200);
    const data = (await r.json()) as { resource: string; authorization_servers: string[] };
    expect(data.resource).toBe("http://proxy.example/mcp");
  });
});

describe("/authorize (GET)", () => {
  it("renders the NCCC consent form", async () => {
    const q = new URLSearchParams({
      client_id: "c1",
      redirect_uri: "https://client.example/cb",
      response_type: "code",
      code_challenge: "abc",
      code_challenge_method: "S256",
    });
    const r = await SELF.fetch(`http://proxy.example/authorize?${q.toString()}`);
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).toContain("Norton Commons Cigar Club");
    expect(body).not.toContain("upstream_url");
  });
});

describe("/authorize (POST)", () => {
  beforeEach(clearKV);

  it("rejects wrong club password", async () => {
    const form = new FormData();
    form.set("admin_secret", "wrong");
    form.set("redirect_uri", "https://client.example/cb");
    form.set("code_challenge", "abc");
    const r = await SELF.fetch("http://proxy.example/authorize", { method: "POST", body: form });
    expect(r.status).toBe(401);
  });
});

describe("/mcp proxy auth", () => {
  beforeEach(clearKV);

  it("returns 401 without token", async () => {
    const r = await SELF.fetch("http://proxy.example/mcp", { method: "POST" });
    expect(r.status).toBe(401);
  });

  it("returns 401 for unknown token", async () => {
    const r = await SELF.fetch("http://proxy.example/mcp", {
      method: "POST",
      headers: { Authorization: "Bearer unknown" },
    });
    expect(r.status).toBe(401);
  });
});

describe("/token PKCE exchange", () => {
  beforeEach(clearKV);

  it("issues access token for valid code + verifier", async () => {
    const verifier = "test-verifier-string";
    const challenge = await sha256base64url(verifier);
    await env.KV.put(
      "code:good-code",
      JSON.stringify({
        code_challenge: challenge,
        client_id: "c1",
        redirect_uri: "https://client.example/cb",
        upstream_url: "https://nccc.example/api/mcp",
        header_name: "Authorization",
        header_value: "Bearer test-upstream-token",
      } satisfies Association & {
        code_challenge: string;
        client_id: string;
        redirect_uri: string;
      }),
    );

    const form = new FormData();
    form.set("grant_type", "authorization_code");
    form.set("code", "good-code");
    form.set("code_verifier", verifier);

    const r = await SELF.fetch("http://proxy.example/token", { method: "POST", body: form });
    expect(r.status).toBe(200);
    const data = (await r.json()) as { access_token: string; refresh_token: string };
    expect(data.access_token.length).toBeGreaterThan(10);
    expect(data.refresh_token.length).toBeGreaterThan(10);
  });
});
