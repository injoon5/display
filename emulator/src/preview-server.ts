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

  server.on("error", (error) => {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE") {
      console.error(`[emulator] port ${port} is already in use`);
    } else {
      console.error("[emulator] preview server error", error);
    }
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
      case "/healthz": {
        const ready = Boolean(state.lastRenderAt) && !state.lastError;
        sendJson(res, {
          ok: ready,
          online: state.online,
          ready,
          lastError: state.lastError,
          lastRenderAt: state.lastRenderAt,
        }, ready ? 200 : 503);
        return;
      }
      case "/readyz": {
        const ready = Boolean(state.lastRenderAt) && !state.lastError;
        sendJson(
          res,
          {
            ready,
            lastError: state.lastError,
            lastRenderAt: state.lastRenderAt,
            online: state.online,
          },
          ready ? 200 : 503,
        );
        return;
      }
      default:
        sendText(res, 404, "not found");
    }
  } catch (error) {
    sendText(res, 500, error instanceof Error ? error.message : "error");
  }
}

function sendJson(res: ServerResponse, body: unknown, status = 200): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
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
  <title>Panel Emulator · Wall Matrix</title>
  <style>
    :root {
      --bg: oklch(0.13 0.012 260);
      --fg: oklch(0.97 0.004 260);
      --muted: oklch(0.72 0.01 260);
      --glass: oklch(0.2 0.012 260 / 0.55);
      --border: oklch(1 0 0 / 0.1);
      --ok: oklch(0.78 0.12 155);
      --bad: oklch(0.72 0.16 25);
      --ease: cubic-bezier(0.23, 1, 0.32, 1);
    }
    * { box-sizing: border-box; }
    html { -webkit-font-smoothing: antialiased; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--fg);
      font: 15px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      background:
        radial-gradient(1200px 700px at 78% -8%, oklch(0.28 0.03 260 / 0.35), transparent 60%),
        var(--bg);
      display: grid;
      place-items: center;
      padding: 28px;
    }
    main {
      width: min(880px, 100%);
      display: grid;
      gap: 18px;
    }
    header h1 {
      margin: 0;
      font-size: 1.35rem;
      letter-spacing: -0.02em;
      font-weight: 600;
      text-wrap: balance;
    }
    header p {
      margin: 0.35rem 0 0;
      color: var(--muted);
      font-size: 0.875rem;
      text-wrap: pretty;
    }
    .stage {
      background: oklch(0 0 0 / 0.55);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 18px;
      display: grid;
      place-items: center;
      box-shadow:
        0 1px 0 oklch(1 0 0 / 0.06) inset,
        0 18px 40px oklch(0 0 0 / 0.28);
      backdrop-filter: blur(18px) saturate(160%);
    }
    .stage img {
      width: min(100%, 640px);
      height: auto;
      image-rendering: pixelated;
      background: #000;
      border-radius: 8px;
      outline: 1px solid oklch(1 0 0 / 0.1);
    }
    .waiting {
      color: var(--muted);
      font-size: 0.875rem;
      padding: 48px 16px;
      text-align: center;
    }
    .meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 10px 14px;
      background: var(--glass);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 14px 16px;
      backdrop-filter: blur(18px) saturate(160%);
    }
    .meta div span {
      display: block;
      color: var(--muted);
      font-size: 0.7rem;
      letter-spacing: 0.02em;
      margin-bottom: 0.2rem;
    }
    .meta b, .meta .val {
      font-variant-numeric: tabular-nums;
      font-weight: 550;
      font-size: 0.9rem;
    }
    .err { color: var(--bad); }
    .ok { color: var(--ok); }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Panel Emulator</h1>
      <p>Local preview of the 64×32 matrix while the device syncs.</p>
    </header>
    <section class="stage">
      <img id="frame" alt="64×32 panel frame" src="/frame.bmp?ts=${Date.now()}" width="640" height="320" hidden />
      <div id="waiting" class="waiting">Waiting for the first frame…</div>
    </section>
    <section class="meta" id="meta" aria-live="polite"></section>
  </main>
  <script>
    const meta = document.getElementById("meta");
    const frame = document.getElementById("frame");
    const waiting = document.getElementById("waiting");
    function cell(label, value, bad = false) {
      return "<div><span>"+label+"</span><span class=\\"val"+(bad ? " err" : "")+"\\">"+value+"</span></div>";
    }
    async function tick() {
      try {
        const res = await fetch("/status.json", { cache: "no-store" });
        const s = await res.json();
        meta.innerHTML = [
          cell("Status", s.online ? "Online" : "Offline", !s.online),
          cell("Program", s.programVersion + " · " + (s.programEtag || "—")),
          cell("Data", s.dataVersion + " · " + (s.dataEtag || "—")),
          cell("Current", (s.amps ?? 0).toFixed(3) + " A"),
          cell("Frames", s.frameCount),
          cell("Heartbeat", s.lastHeartbeatAt ? new Date(s.lastHeartbeatAt).toLocaleTimeString() : "—"),
          cell("Site", s.siteUrl),
          cell("Error", s.lastError || "None", Boolean(s.lastError)),
        ].join("");
        if (s.lastRenderAt) {
          frame.hidden = false;
          waiting.hidden = true;
          frame.src = "/frame.bmp?ts=" + s.lastRenderAt;
        }
      } catch (e) {
        meta.innerHTML = cell("Error", String(e), true);
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
