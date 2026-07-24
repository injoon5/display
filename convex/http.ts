import { httpRouter } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { api, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { authDevice, hasDashboardSecret } from "./auth";
import { encodeSlotFrame } from "./lib/cbor";
import { stripEtag } from "./lib/etag";

const http = httpRouter();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return null;
}

async function readJsonRecord(request: Request): Promise<Record<string, unknown>> {
  const parsed = (await request.json()) as unknown;
  return asRecord(parsed) ?? {};
}

http.route({
  path: "/device/wait",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const device = await authDevice(ctx, req);
    if (!device) {
      return new Response("Unauthorized", { status: 401 });
    }

    const url = new URL(req.url);
    const expectedProgramEtag = stripEtag(url.searchParams.get("program"));
    const expectedDataEtag = stripEtag(url.searchParams.get("data"));

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const current = await ctx.runQuery(api.devices.get, { id: device._id });
      if (!current) {
        return new Response("Device not found", { status: 404 });
      }

      if (
        stripEtag(current.programEtag) !== expectedProgramEtag ||
        stripEtag(current.dataEtag) !== expectedDataEtag
      ) {
        return Response.json(
          {
            program: stripEtag(current.programEtag) !== expectedProgramEtag,
            data: stripEtag(current.dataEtag) !== expectedDataEtag,
          },
          {
            headers: {
              "Cache-Control": "no-cache",
              "X-Long-Poll-Note": "Convex httpActions are time-bounded; this route holds for ~10s per request.",
            },
          },
        );
      }

      await sleep(500);
    }

    return new Response(null, {
      status: 204,
      headers: {
        "X-Long-Poll-Note": "Convex httpActions are time-bounded; reconnect after short-poll timeout.",
      },
    });
  }),
});

http.route({
  path: "/device/sync",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const device = await authDevice(ctx, req);
    if (!device) {
      return new Response("Unauthorized", { status: 401 });
    }

    const manifest = await ctx.runQuery(internal.programs.manifest, {
      deviceId: device._id,
    });
    if (stripEtag(req.headers.get("if-none-match")) === stripEtag(manifest.etag)) {
      return new Response(null, { status: 304 });
    }

    return Response.json(manifest, {
      headers: {
        ETag: manifest.etag,
        "Cache-Control": "no-cache",
      },
    });
  }),
});

http.route({
  path: "/device/data",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const device = await authDevice(ctx, req);
    if (!device) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (stripEtag(req.headers.get("if-none-match")) === stripEtag(device.dataEtag)) {
      return new Response(null, { status: 304 });
    }

    const frame = await ctx.runQuery(internal.programs.dataFrame, {
      deviceId: device._id,
      nowMs: Date.now(),
    });
    const accept = req.headers.get("accept") ?? "application/json";

    // Device firmware requests JSON. CBOR remains available via Accept header
    // for future bandwidth-sensitive clients.
    if (!accept.includes("application/cbor")) {
      return Response.json(frame, {
        headers: {
          ETag: device.dataEtag,
          "Cache-Control": "no-cache",
          "Content-Type": "application/json",
        },
      });
    }

    const encoded = encodeSlotFrame(frame as Record<string, unknown>);
    return new Response(new Blob([Uint8Array.from(encoded.body)], { type: encoded.contentType }), {
      status: 200,
      headers: {
        ETag: device.dataEtag,
        "Cache-Control": "no-cache",
        "Content-Type": encoded.contentType,
      },
    });
  }),
});

http.route({
  path: "/device/heartbeat",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const device = await authDevice(ctx, req);
    if (!device) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await readJsonRecord(req);
    await ctx.runMutation(internal.telemetry.record, {
      deviceId: device._id,
      fw: typeof body.fw === "string" ? body.fw : device.fwVersion,
      programVersion: typeof body.programVersion === "number" ? body.programVersion : undefined,
      uptime: typeof body.uptime === "number" ? body.uptime : undefined,
      rssi: typeof body.rssi === "number" ? body.rssi : -100,
      heapFree: typeof body.heapFree === "number" ? body.heapFree : 0,
      psramFree: typeof body.psramFree === "number" ? body.psramFree : undefined,
      brightness: typeof body.brightness === "number" ? body.brightness : 0,
      lux: typeof body.lux === "number" ? body.lux : 0,
      tempC: typeof body.tempC === "number" ? body.tempC : 0,
      humidity: typeof body.humidity === "number" ? body.humidity : 0,
      presenceRoom: body.presenceRoom === true,
      presenceBed: body.presenceBed === true,
      estAmps: typeof body.estAmps === "number" ? body.estAmps : 0,
      governorActive: body.governorActive === true,
      lastError: typeof body.lastError === "string" ? body.lastError : undefined,
    });
    return new Response(null, { status: 204 });
  }),
});

http.route({
  path: "/api/pin",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!hasDashboardSecret(req)) {
      return new Response("Forbidden", { status: 403 });
    }

    const body = await readJsonRecord(req);
    const devices = await ctx.runQuery(api.devices.list, {});
    const deviceId = (typeof body.deviceId === "string" ? body.deviceId : devices[0]?._id) as Id<"devices"> | undefined;
    if (!deviceId) {
      return new Response("Device not found", { status: 404 });
    }

    let cardId = typeof body.cardId === "string" ? (body.cardId as Id<"cards">) : undefined;
    if (!cardId && typeof body.slug === "string") {
      const card = await ctx.runQuery(api.cards.getBySlug, { slug: body.slug });
      cardId = card?._id;
    }

    if (!cardId) {
      return new Response("Card not found", { status: 404 });
    }

    const durationMs = typeof body.durationMs === "number" ? body.durationMs : 60_000;
    const result = await ctx.runMutation(internal.devices.pinCard, {
      deviceId,
      cardId,
      durationMs,
    });
    return Response.json({ ok: true, deviceId: result._id, pinnedCardId: result.pinnedCardId ?? null });
  }),
});

http.route({
  path: "/api/scene",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!hasDashboardSecret(req)) {
      return new Response("Forbidden", { status: 403 });
    }

    const body = await readJsonRecord(req);
    const devices = await ctx.runQuery(api.devices.list, {});
    const deviceId = (typeof body.deviceId === "string" ? body.deviceId : devices[0]?._id) as Id<"devices"> | undefined;
    if (!deviceId) {
      return new Response("Device not found", { status: 404 });
    }

    let sceneId = typeof body.sceneId === "string" ? (body.sceneId as Id<"scenes">) : undefined;
    if (!sceneId && typeof body.name === "string") {
      const scenes = await ctx.runQuery(api.scenes.list, {});
      sceneId = scenes.find((scene: { _id: Id<"scenes">; name: string }) => scene.name === body.name)?._id;
    }

    if (!sceneId) {
      return new Response("Scene not found", { status: 404 });
    }

    const result = await ctx.runMutation(internal.scenes.activateInternal, {
      deviceId,
      sceneId,
    });
    return Response.json({ ok: true, deviceId: result._id, activeSceneId: result.activeSceneId ?? null });
  }),
});

http.route({
  path: "/api/poke",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!hasDashboardSecret(req)) {
      return new Response("Forbidden", { status: 403 });
    }

    const body = await readJsonRecord(req);
    if (typeof body.message !== "string" || body.message.trim().length === 0) {
      return new Response("message is required", { status: 400 });
    }

    const devices = await ctx.runQuery(api.devices.list, {});
    const deviceId = (typeof body.deviceId === "string" ? body.deviceId : devices[0]?._id) as Id<"devices"> | undefined;
    if (!deviceId) {
      return new Response("Device not found", { status: 404 });
    }

    await ctx.runMutation(api.sources.write, {
      sourceId: "poke",
      kind: "local.poke",
      config: {},
      intervalMs: 60_000,
      origin: "convex",
      data: {
        message: body.message.trim(),
        updatedAt: new Date().toISOString(),
      },
      fetchedAt: Date.now(),
    });

    const selfStatusCard = await ctx.runQuery(api.cards.getBySlug, { slug: "self-status" });
    if (selfStatusCard) {
      await ctx.runMutation(internal.devices.pinCard, {
        deviceId,
        cardId: selfStatusCard._id,
        durationMs: typeof body.durationMs === "number" ? body.durationMs : 10_000,
      });
    }

    return Response.json({ ok: true, deviceId });
  }),
});

export default http;
