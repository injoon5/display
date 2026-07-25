import { page } from "$app/state";

export type RouteChrome = { title: string; subtitle: string };

/**
 * The app header owns the page title, so no page repeats it in its own body.
 * Titles are specific ("Card editor", not "Editor") so the header always answers
 * "where am I?".
 */
const routes: Array<{ match: (pathname: string) => boolean } & RouteChrome> = [
  {
    match: (pathname) => pathname === "/",
    title: "Panel",
    subtitle: "Live view and controls",
  },
  {
    match: (pathname) => pathname === "/cards",
    title: "Cards",
    subtitle: "Layouts that can appear on your panel",
  },
  {
    match: (pathname) => pathname.startsWith("/cards/"),
    title: "Card editor",
    subtitle: "Edit, preview, and publish a card",
  },
  {
    match: (pathname) => pathname === "/scenes",
    title: "Scenes",
    subtitle: "Build and schedule card playlists",
  },
  {
    match: (pathname) => pathname === "/rules",
    title: "Rules",
    subtitle: "Run an action when a condition is true",
  },
  {
    match: (pathname) => pathname === "/sources",
    title: "Sources",
    subtitle: "View and update the data each card reads",
  },
  {
    match: (pathname) => pathname === "/firmware",
    title: "Firmware",
    subtitle: "Publish a release for your panels to download",
  },
  {
    match: (pathname) => pathname === "/provision",
    title: "Set up panel",
    subtitle: "Name a panel and claim it with a device token",
  },
];

export function routeChrome(pathname = page.url.pathname): RouteChrome {
  return (
    routes.find((entry) => entry.match(pathname)) ?? {
      title: "Wall Matrix",
      subtitle: "Panel control",
    }
  );
}
