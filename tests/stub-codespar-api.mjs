// A stand-in for api.codespar.dev + gw.codespar.dev, on one loopback port.
//
// The response bodies are transcribed from the PUBLIC API reference, not from
// what the examples happen to read:
//
//   https://docs.codespar.dev/docs/api/payment-links
//     "Payment link object": id, slug, title, description, pay_url, accepts,
//     environment, one_time, status, use_count, max_uses, expires_at,
//     redirect_url, active, created_at.  There is no gateway_url field, and
//     "Served at pay_url = https://gw.codespar.dev/pay/<slug>".
//     "slug is optional; a unique one is generated when omitted."
//     GET on an unknown link is "404 payment_link_not_found".
//
//   https://docs.codespar.dev/docs/api/paywalls and .../mcp-servers
//     A paywall and an MCP server DO carry gateway_url. That asymmetry is the
//     whole point: an example may read gateway_url off those two and must not
//     read it off a payment link.
//
// The gateway half of the stub only serves the slugs this stub actually issued,
// so a request for any other slug 404s the same way production does.

import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

export async function startStub({ payUrl = "real" } = {}) {
  const issuedLinkSlugs = new Set();
  const createdLinks = [];
  let n = 0;
  let base = null;
  const origin = () => base;

  const readBody = (req) =>
    new Promise((resolve, reject) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch (err) {
          reject(err);
        }
      });
      req.on("error", reject);
    });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const send = (code, body) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (req.method === "POST" && url.pathname === "/v1/paywalls") {
      const body = await readBody(req);
      const slug = body.slug ?? `paywall-${++n}`;
      return send(201, {
        id: `pw_${randomBytes(6).toString("hex")}`,
        slug,
        name: body.name ?? null,
        upstream_url: body.upstream_url ?? null,
        price: body.price ?? null,
        currency: body.currency ?? "USDC",
        gateway_url: `${origin()}/${slug}`,
        active: true,
        created_at: new Date().toISOString(),
      });
    }

    if (req.method === "POST" && url.pathname === "/v1/mcp-servers") {
      const body = await readBody(req);
      const slug = body.slug ?? `mcp-${++n}`;
      return send(201, {
        id: `mcps_${randomBytes(6).toString("hex")}`,
        slug,
        name: body.name ?? null,
        upstream_url: body.upstream_url ?? null,
        gateway_url: `${origin()}/mcp/${slug}`,
        tools: body.tools ?? [],
        active: true,
        created_at: new Date().toISOString(),
      });
    }

    if (req.method === "POST" && url.pathname === "/v1/payment-links") {
      const body = await readBody(req);
      // "slug is optional; a unique one is generated when omitted." None of the
      // examples send one, so the server picks it and the client cannot know it
      // in advance. The random tail is what makes a client-side guess wrong.
      const slug = body.slug ?? `pl-${++n}-${randomBytes(4).toString("hex")}`;
      issuedLinkSlugs.add(slug);
      const link = {
        id: `pl_${randomBytes(6).toString("hex")}`,
        slug,
        title: body.title ?? null,
        description: body.description ?? null,
        pay_url: `${origin()}/pay/${slug}`,
        accepts: body.accepts ?? [],
        environment: "test",
        one_time: body.one_time ?? false,
        status: "active",
        use_count: 0,
        max_uses: body.max_uses ?? null,
        expires_at: body.expires_at ?? null,
        redirect_url: body.redirect_url ?? null,
        active: true,
        created_at: new Date().toISOString(),
      };
      createdLinks.push(link);
      if (payUrl === "missing") delete link.pay_url;
      return send(201, link);
    }

    // Gateway half. Only the slugs this stub issued are payable.
    if (req.method === "GET" && url.pathname.startsWith("/pay/")) {
      const slug = decodeURIComponent(url.pathname.slice("/pay/".length));
      if (issuedLinkSlugs.has(slug)) {
        return send(200, { slug, status: "active" });
      }
      return send(404, {
        error: { code: "payment_link_not_found", message: "no active payment link for that slug" },
      });
    }

    return send(404, { error: { code: "not_found", message: url.pathname } });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  return {
    origin: base,
    issuedLinkSlugs,
    createdLinks,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
