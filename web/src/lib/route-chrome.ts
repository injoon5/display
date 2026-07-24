import { page } from "$app/state";

const titles: Array<{ match: (pathname: string) => boolean; title: string; subtitle: string }> = [
  {
    match: (pathname) => pathname === "/",
    title: "Panel",
    subtitle: "Live view and controls",
  },
  {
    match: (pathname) => pathname === "/cards" || pathname.startsWith("/cards/"),
    title: "Cards",
    subtitle: "Layouts for your panel",
  },
  {
    match: (pathname) => pathname === "/scenes",
    title: "Scenes",
    subtitle: "Scheduled playlists",
  },
  {
    match: (pathname) => pathname === "/rules",
    title: "Rules",
    subtitle: "Conditions and actions",
  },
  {
    match: (pathname) => pathname === "/sources",
    title: "Sources",
    subtitle: "Live data feeds",
  },
  {
    match: (pathname) => pathname === "/firmware",
    title: "Firmware",
    subtitle: "Releases and updates",
  },
  {
    match: (pathname) => pathname === "/provision",
    title: "Set Up",
    subtitle: "Connect a new panel",
  },
];

export function routeChrome(pathname = page.url.pathname): { title: string; subtitle: string } {
  return (
    titles.find((entry) => entry.match(pathname)) ?? {
      title: "Wall Matrix",
      subtitle: "Panel control",
    }
  );
}
