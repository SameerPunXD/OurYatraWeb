export interface Env {
  APP_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

const page = (title: string, message: string, ok = true) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { margin:0; min-height:100vh; display:grid; place-items:center; background:#ffffff; color:#111827; font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
      .card { width:min(92vw,560px); border:1px solid #e5e7eb; border-radius:16px; padding:28px; text-align:center; box-shadow:0 8px 30px rgba(0,0,0,.05); }
      .ok { color:#166534; } .err { color:#991b1b; }
      p { color:#4b5563; margin-top:8px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2 class="${ok ? "ok" : "err"}">${title}</h2>
      <p>${message}</p>
    </div>
  </body>
</html>`;

async function verifyTokenHash(url: URL, env: Env) {
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") || "signup";
  if (!token_hash) return { tried: false, ok: false, text: "Missing token hash." };

  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ token_hash, type }),
  });

  if (!res.ok) {
    const t = await res.text();
    return { tried: true, ok: false, text: t.slice(0, 220) };
  }
  return { tried: true, ok: true, text: "Authentication complete." };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") return new Response("ok");

    if (["/", "/confirm", "/auth", "/recovery"].includes(url.pathname)) {
      // If Supabase already returned access_token in hash, worker cannot read hash server-side.
      // Show success page for user-facing completion.
      if (!url.search) {
        return new Response(page("Authentication complete", "Your request was processed successfully."), {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      }

      try {
        const result = await verifyTokenHash(url, env);
        if (result.tried && result.ok) {
          return new Response(page("Authentication complete", "Your email has been verified successfully."), {
            headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
          });
        }
        if (result.tried) {
          return new Response(page("Authentication failed", "Link is invalid or expired. Please request a new email.", false), {
            headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
          });
        }
      } catch {
        return new Response(page("Authentication failed", "Something went wrong while verifying. Try again.", false), {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      }

      return new Response(page("Authentication complete", "Done."), {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
