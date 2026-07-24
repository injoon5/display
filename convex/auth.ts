import { customAction, customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions";
import type { GenericActionCtx } from "convex/server";
import type { DataModel, Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";

const DEMO_DASHBOARD_SECRET = "dashboard-secret";

export const dashboardQuery = customQuery(
  query,
  customCtx(async () => ({
    dashboard: {
      kind: "demo" as const,
      secret: DEMO_DASHBOARD_SECRET,
    },
  })),
);

export const dashboardMutation = customMutation(
  mutation,
  customCtx(async () => ({
    dashboard: {
      kind: "demo" as const,
      secret: DEMO_DASHBOARD_SECRET,
    },
  })),
);

export const dashboardAction = customAction(
  action,
  customCtx(async () => ({
    dashboard: {
      kind: "demo" as const,
      secret: DEMO_DASHBOARD_SECRET,
    },
  })),
);

export async function hashToken(token: string): Promise<string> {
  const normalized = new TextEncoder().encode(token.trim());
  const digest = await crypto.subtle.digest("SHA-256", normalized);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function readBearerToken(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function authDevice(
  ctx: GenericActionCtx<DataModel>,
  req: Request,
): Promise<Doc<"devices"> | null> {
  const token = readBearerToken(req.headers.get("authorization"));
  if (!token) {
    return null;
  }
  const tokenHash = await hashToken(token);
  return await ctx.runQuery(internal.devices.getByTokenHash, { tokenHash });
}

export function hasDashboardSecret(req: Request): boolean {
  const headerSecret = req.headers.get("x-panel-secret") ?? req.headers.get("x-dashboard-secret");
  if (headerSecret === DEMO_DASHBOARD_SECRET) {
    return true;
  }
  return readBearerToken(req.headers.get("authorization")) === DEMO_DASHBOARD_SECRET;
}
