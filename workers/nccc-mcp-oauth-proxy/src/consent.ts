const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function esc(value: string | null | undefined): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

export function consentPage(params: URLSearchParams, error = ""): string {
  const clientId = esc(params.get("client_id"));
  const redirectUri = esc(params.get("redirect_uri"));
  const state = esc(params.get("state"));
  const codeChallenge = esc(params.get("code_challenge"));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Connect NCCC Pairing</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; max-width: 480px; margin: 48px auto; padding: 0 20px; color: #222; line-height: 1.5; background: #faf8f5; }
    h1 { font-size: 22px; margin-bottom: 4px; font-family: Georgia, serif; }
    p.lead { color: #666; font-size: 14px; margin-top: 0; }
    label { display: block; margin: 16px 0 6px; font-size: 13px; font-weight: 600; }
    input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 14px; font-family: inherit; background: #fff; }
    input:focus { outline: 2px solid #b8956a; outline-offset: -1px; border-color: transparent; }
    .hint { font-size: 12px; color: #777; margin-top: 4px; }
    button { margin-top: 24px; width: 100%; padding: 12px; background: #3d3429; color: #f5f0e8; border: 0; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
    button:hover { background: #2a231c; }
    .error { background: #fee2e2; color: #7f1d1d; padding: 10px 12px; border-radius: 8px; margin: 16px 0; font-size: 13px; }
  </style>
</head>
<body>
  <h1>Norton Commons Cigar Club</h1>
  <p class="lead">Connect Claude to the club pairing catalog. Enter the club connect password Paul shared with members.</p>
  ${error ? `<div class="error">${esc(error)}</div>` : ""}
  <form method="POST" action="/authorize">
    <input type="hidden" name="client_id" value="${clientId}" />
    <input type="hidden" name="redirect_uri" value="${redirectUri}" />
    <input type="hidden" name="state" value="${state}" />
    <input type="hidden" name="code_challenge" value="${codeChallenge}" />
    <label for="admin_secret">Club connect password</label>
    <input id="admin_secret" name="admin_secret" type="password" autocomplete="current-password" required />
    <p class="hint">Not your NCCC login — the separate password for this Claude connector.</p>
    <button type="submit">Connect</button>
  </form>
</body>
</html>`;
}
