import http from "node:http";
import worker from "../dist/server/index.js";

const port = Number(process.env.PORT || 4173);
const server = http.createServer(async (request, response) => {
  try {
    const result = await worker.fetch(new Request(`http://127.0.0.1:${port}${request.url}`, { method: request.method, headers: request.headers }), {}, {});
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(Buffer.from(await result.arrayBuffer()));
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain" });
    response.end(error.stack);
  }
});
server.listen(port, "127.0.0.1", () => console.log(`Page Breaker at http://127.0.0.1:${port}`));
