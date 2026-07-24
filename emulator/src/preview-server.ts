import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export type PreviewState = {
  amps: number;
  dataEtag: string;
  dataVersion: number;
  frameCount: number;
  lastError: string | null;
  lastHeartbeatAt: number | null;
  lastRenderAt: number | null;
  online: boolean;
  programEtag: string;
  programVersion: number;
  siteUrl: string;
  startedAt: number;
};

export type PreviewAssets = {
  bmp: Buffer | null;
  ppm: Buffer | null;
};

export function startPreviewServer(
  port: number,
  getState: () => PreviewState,
  getAssets: () => PreviewAssets,
): { close: () => Promise<void>; url: string } {
  const server = createServer((req, res) => {
    void handle(req, res, getState, getAssets);
  });

  server.listen(port, "127.0.0.1");
  const url = `http://127.0.0.1:${port}`;

  return {
    url,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  getState: () => PreviewState,
  getAssets: () => PreviewAssets,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const assets = getAssets();
  const state = getState();

  try {
    switch (url.pathname) {
      case "/":
      case "/index.html":
        sendHtml(res, state);
        return;
      case "/status.json":
        sendJson(res, state);
        return;
      case "/frame.bmp":
        if (!assets.bmp) {
          sendText(res, 404, "no frame yet");
          return;
        }
        res.writeHead(200, {
          "Content-Type": "image/bmp",
          "Cache-Control": "no-store",
          "Content-Length": assets.bmp.length,
        });
        res.end(assets.bmp);
        return;
      case "/frame.ppm":
        if (!assets.ppm) {
          sendText(res, 404, "no frame yet");
          return;
        }
        res.writeHead(200, {
          "Content-Type": "image/x-portable-pixmap",
          "Cache-Control": "no-store",
          "Content-Length": assets.ppm.length,
        });
        res.end(assets.ppm);
        return;
      case "/healthz":
        sendJson(res, { ok: true, online: state.online });
        return;
      default:
        sendText(res, 404, "not found");
    }
  } catch (error) {
    sendText(res, 500, error instanceof Error ? error.message : "error");
  }
}

function sendJson(res: ServerResponse, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function sendText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

function sendHtml(res: ServerResponse, state: PreviewState): void {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Matrix Panel Emulator</title>
  <style>
    :root {
      --bg: #0c100e;
      --fg: #d7e0d5;
      --muted: #7f8f7c;
      --panel: #141b17;
      --accent: #49c16d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(ellipse at top, #1a2420 0%, transparent 55%),
        linear-gradient(160deg, #0c100e, #121814 60%, #0a0e0c);
      color: var(--fg);
      font: 14px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    main {
      width: min(920px, 100%);
      display: grid;
      gap: 20px;
    }
    h1 {
      margin: 0;
      font-size: 18px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--accent);
    }
    .stage {
      background: #000;
      border: 1px solid #243028;
      padding: 18px;
      display: grid;
      place-items: center;
      image-rendering: pixelated;
    }
    .stage img {
      width: min(100%, 640px);
      height: auto;
      image-rendering: pixelated;
      background: #000;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px 16px;
      background: var(--panel);
      border: 1px solid #243028;
      padding: 14px 16px;
    }
    .meta div span {
      display: block;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .err { color: #f07178; }
  </style>
</head>
<body>
  <main>
    <h1>Wall Matrix Panel · local emulator</h1>
    <section class="stage">
      <img id="frame" alt="64×32 panel frame" src="/frame.bmp?ts=${Date.now()}" width="640" height="320" />
    </section>
    <section class="meta" id="meta"></section>
  </main>
  <script>
    const meta = document.getElementById("meta");
    const frame = document.getElementById("frame");
    async function tick() {
      try {
        const res = await fetch("/status.json", { cache: "no-store" });
        const s = await res.json();
        meta.innerHTML = [
          ["online", s.online],
          ["program", s.programVersion + " / " + (s.programEtag || "—")],
          ["data", s.dataVersion + " / " + (s.dataEtag || "—")],
          ["amps", (s.amps ?? 0).toFixed(3) + " A"],
          ["frames", s.frameCount],
          ["heartbeat", s.lastHeartbeatAt ? new Date(s.lastHeartbeatAt).toLocaleTimeString() : "—"],
          ["site", s.siteUrl],
          ["error", s.lastError || "none"],
        ].map(([k,v]) => "<div><span>"+k+"</span>"+(k==="error" && s.lastError ? "<span class=err>" : "<b>")+String(v)+(k==="error" && s.lastError ? "</span>" : "</b>")+"</div>").join("");
        if (s.lastRenderAt) {
          frame.src = "/frame.bmp?ts=" + s.lastRenderAt;
        }
      } catch (e) {
        meta.innerHTML = "<div class=err>" + e + "</div>";
      }
    }
    tick();
    setInterval(tick, 1000);
  </script>
</body>
</html>`;
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(html);
  void state;
}
