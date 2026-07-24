export type WaitResult =
  | { kind: "changed"; program: boolean; data: boolean }
  | { kind: "timeout" }
  | { kind: "unauthorized" }
  | { kind: "error"; status: number; body: string };

export type SyncManifest = {
  programVersion: number;
  etag: string;
  bytecodeUrl: string;
  bytecodeSha256: string;
  assetBundleSha256: string;
  brightnessCeiling?: number | null;
  playlistCardId?: string | null;
  scenes: unknown[];
  rules: unknown[];
};

export type DataFrame = {
  v: number;
  t: number;
  s: Record<string, unknown>;
  a: Record<string, unknown>;
  meta: Record<string, unknown>;
};

function stripEtag(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value.replaceAll('"', "").trim();
}

const DEFAULT_TIMEOUT_MS = 15_000;
const WAIT_TIMEOUT_MS = 20_000;

export class DeviceClient {
  constructor(
    private readonly siteUrl: string,
    private readonly token: string,
  ) {}

  private headers(extra?: Record<string, string>): Headers {
    const headers = new Headers(extra);
    headers.set("Authorization", `Bearer ${this.token}`);
    return headers;
  }

  private async fetch(
    input: string | URL,
    init: RequestInit = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<Response> {
    return await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  }

  async wait(programEtag: string, dataEtag: string): Promise<WaitResult> {
    const url = new URL("/device/wait", this.siteUrl);
    url.searchParams.set("program", stripEtag(programEtag) || "boot");
    url.searchParams.set("data", stripEtag(dataEtag) || "boot");

    try {
      const res = await this.fetch(url, { headers: this.headers() }, WAIT_TIMEOUT_MS);
      if (res.status === 401) {
        return { kind: "unauthorized" };
      }
      if (res.status === 204) {
        return { kind: "timeout" };
      }
      if (!res.ok) {
        return { kind: "error", status: res.status, body: await res.text() };
      }

      const body = (await res.json()) as { program?: boolean; data?: boolean };
      return {
        kind: "changed",
        program: body.program === true,
        data: body.data === true,
      };
    } catch (error) {
      return {
        kind: "error",
        status: 0,
        body: error instanceof Error ? error.message : "wait failed",
      };
    }
  }

  async sync(ifNoneMatch?: string): Promise<
    | { kind: "ok"; manifest: SyncManifest; etag: string }
    | { kind: "notModified"; etag: string }
    | { kind: "error"; status: number; body: string }
  > {
    const headers = this.headers({ Accept: "application/json" });
    if (ifNoneMatch) {
      headers.set("If-None-Match", ifNoneMatch);
    }

    try {
      const res = await this.fetch(new URL("/device/sync", this.siteUrl), { headers });
      if (res.status === 304) {
        return { kind: "notModified", etag: stripEtag(res.headers.get("etag")) };
      }
      if (!res.ok) {
        return { kind: "error", status: res.status, body: await res.text() };
      }

      const manifest = (await res.json()) as SyncManifest;
      return {
        kind: "ok",
        manifest,
        etag: stripEtag(res.headers.get("etag") || manifest.etag),
      };
    } catch (error) {
      return {
        kind: "error",
        status: 0,
        body: error instanceof Error ? error.message : "sync failed",
      };
    }
  }

  async data(ifNoneMatch?: string): Promise<
    | { kind: "ok"; frame: DataFrame; etag: string }
    | { kind: "notModified"; etag: string }
    | { kind: "error"; status: number; body: string }
  > {
    const headers = this.headers({ Accept: "application/json" });
    if (ifNoneMatch) {
      headers.set("If-None-Match", ifNoneMatch);
    }

    try {
      const res = await this.fetch(new URL("/device/data", this.siteUrl), { headers });
      if (res.status === 304) {
        return { kind: "notModified", etag: stripEtag(res.headers.get("etag")) };
      }
      if (!res.ok) {
        return { kind: "error", status: res.status, body: await res.text() };
      }

      const frame = (await res.json()) as DataFrame;
      return {
        kind: "ok",
        frame,
        etag: stripEtag(res.headers.get("etag")),
      };
    } catch (error) {
      return {
        kind: "error",
        status: 0,
        body: error instanceof Error ? error.message : "data failed",
      };
    }
  }

  async heartbeat(body: Record<string, unknown>): Promise<void> {
    const res = await this.fetch(new URL("/device/heartbeat", this.siteUrl), {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    if (!res.ok && res.status !== 204) {
      throw new Error(`heartbeat failed: ${res.status} ${await res.text()}`);
    }
  }

  async fetchBytecode(url: string): Promise<Uint8Array> {
    const absolute = url.startsWith("http") ? url : new URL(url, this.siteUrl).toString();
    const res = await this.fetch(absolute);
    if (!res.ok) {
      throw new Error(`bytecode fetch failed: ${res.status} ${await res.text()}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  }
}

export { stripEtag };
