import { customAction, customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions";
import type { GenericActionCtx } from "convex/server";
import type { DataModel, Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";

/**
 * Demo-mode dashboard access. These wrappers intentionally do NOT authenticate.
 * They exist so the bedroom prototype can run without Convex Auth wired yet.
 * HTTP control routes still require `hasDashboardSecret`.
 * Rename/replace with real authed wrappers before exposing beyond LAN/demo.
 *
 * Override the shared secret with `DASHBOARD_SECRET` in the Convex deployment env.
 */
export const DEMO_DASHBOARD_SECRET = "dashboard-secret";

function dashboardSecret(): string {
  return process.env.DASHBOARD_SECRET?.trim() || DEMO_DASHBOARD_SECRET;
}

export const demoQuery = customQuery(
  query,
  customCtx(async () => ({
    dashboard: {
      kind: "demo" as const,
    },
  })),
);

export const demoMutation = customMutation(
  mutation,
  customCtx(async () => ({
    dashboard: {
      kind: "demo" as const,
    },
  })),
);

export const demoAction = customAction(
  action,
  customCtx(async () => ({
    dashboard: {
      kind: "demo" as const,
    },
  })),
);

/** @deprecated Use demoQuery — name kept during migration. */
export const dashboardQuery = demoQuery;
/** @deprecated Use demoMutation */
export const dashboardMutation = demoMutation;
/** @deprecated Use demoAction */
export const dashboardAction = demoAction;

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
  const expected = dashboardSecret();
  const headerSecret = req.headers.get("x-panel-secret") ?? req.headers.get("x-dashboard-secret");
  if (headerSecret === expected) {
    return true;
  }
  return readBearerToken(req.headers.get("authorization")) === expected;
}
