const ASSETS = __PAGE_BREAKER_ASSETS__;

function asset(body, type) {
  return new Response(body, { headers: { "content-type": `${type}; charset=utf-8`, "cache-control": "no-cache", "x-content-type-options": "nosniff" } });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

async function leaderboard(env) {
  if (!env.DB) throw new Error("Leaderboard storage is unavailable.");
  const result = await env.DB.prepare(`
    SELECT id, player_name AS playerName, website_host AS website,
      destroyed_count AS destroyed, total_bricks AS total,
      duration_ms AS durationMs, score, created_at AS createdAt
    FROM leaderboard_scores
    ORDER BY destroyed_count DESC, duration_ms ASC, score DESC
    LIMIT 10
  `).all();
  return result.results || [];
}

async function saveLeaderboardScore(request, env) {
  if (!env.DB) throw new Error("Leaderboard storage is unavailable.");
  const body = await request.json();
  const playerName = String(body.playerName || "").trim().replace(/[^\p{L}\p{N}_ -]/gu, "").slice(0, 18);
  const rawWebsite = String(body.website || "").trim().slice(0, 255);
  let websiteHost;
  try { websiteHost = new URL(/^https?:\/\//i.test(rawWebsite) ? rawWebsite : `https://${rawWebsite}`).hostname.slice(0, 120); } catch { throw new Error("Invalid website."); }
  const destroyed = Number(body.destroyed), total = Number(body.total), durationMs = Number(body.durationMs), score = Number(body.score);
  if (!playerName) throw new Error("Enter a player name.");
  if (![destroyed, total, durationMs, score].every(Number.isInteger) || total < 1 || total > 100000 || destroyed < 0 || destroyed > total || durationMs < 1000 || durationMs > 86400000 || score < 0 || score > 1000000000) throw new Error("Invalid game result.");
  await env.DB.prepare(`
    INSERT INTO leaderboard_scores
      (player_name, website_host, destroyed_count, total_bricks, duration_ms, score)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(playerName, websiteHost, destroyed, total, durationMs, score).run();
  return leaderboard(env);
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
    if (buffer.byteLength > 10_000_000) throw new Error("This page is too large to turn into a level.");
    return { html: new TextDecoder().decode(buffer), finalUrl: target.href };
  }
  throw new Error("The website redirected too many times.");
}

export default {
  async fetch(request, env) {
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
    if (url.pathname === "/api/leaderboard" && request.method === "GET") {
      try { return json({ entries: await leaderboard(env) }); }
      catch (error) { console.error("leaderboard_read_failed", error); return json({ error: "The global leaderboard is temporarily unavailable." }, 503); }
    }
    if (url.pathname === "/api/leaderboard" && request.method === "POST") {
      try { return json({ entries: await saveLeaderboardScore(request, env) }, 201); }
      catch (error) {
        console.error("leaderboard_write_failed", error);
        const message = error instanceof SyntaxError ? "Invalid score submission." : error.message || "The score could not be saved.";
        return json({ error: message }, message.startsWith("Leaderboard") ? 503 : 400);
      }
    }
    if (url.pathname === "/favicon.ico") return new Response(null, { status: 204 });
    return new Response("Not found", { status: 404 });
  },
};
