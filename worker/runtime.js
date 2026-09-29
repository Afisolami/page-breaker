const ASSETS = __PAGE_BREAKER_ASSETS__;

function asset(body, type) {
  return new Response(body, { headers: { "content-type": `${type}; charset=utf-8`, "cache-control": "no-cache", "x-content-type-options": "nosniff" } });
}

function blockedHost(hostname) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "0.0.0.0" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local") || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

async function fetchPage(input) {
  let target;
  try { target = new URL(input); } catch { throw new Error("Enter a valid website address."); }
  if (!["http:", "https:"].includes(target.protocol) || blockedHost(target.hostname)) throw new Error("That address cannot be loaded.");
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const result = await fetch(target, { redirect: "manual", headers: { "user-agent": "Mozilla/5.0 (compatible; PageBreaker/1.0)", accept: "text/html,application/xhtml+xml" } });
    if (result.status >= 300 && result.status < 400 && result.headers.get("location")) {
      target = new URL(result.headers.get("location"), target);
      if (!["http:", "https:"].includes(target.protocol) || blockedHost(target.hostname)) throw new Error("The site redirected to a blocked address.");
      continue;
    }
    if (!result.ok) throw new Error(`The website returned ${result.status}.`);
    const type = result.headers.get("content-type") || "";
    if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) throw new Error("That address is not an HTML website.");
    const buffer = await result.arrayBuffer();
    if (buffer.byteLength > 3_000_000) throw new Error("This page is too large to turn into a level.");
    return { html: new TextDecoder().decode(buffer), finalUrl: target.href };
  }
  throw new Error("The website redirected too many times.");
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/") return asset(ASSETS.html, "text/html");
    if (url.pathname === "/styles.css") return asset(ASSETS.css, "text/css");
    if (url.pathname === "/app.js") return asset(ASSETS.js, "text/javascript");
    if (url.pathname === "/proxy") {
      try {
        const page = await fetchPage(url.searchParams.get("url") || "");
        return new Response(page.html, { headers: { "content-type": "text/plain; charset=utf-8", "x-page-url": page.finalUrl, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { "content-type": "application/json", "cache-control": "no-store" } });
      }
    }
    if (url.pathname === "/favicon.ico") return new Response(null, { status: 204 });
    return new Response("Not found", { status: 404 });
  },
};
