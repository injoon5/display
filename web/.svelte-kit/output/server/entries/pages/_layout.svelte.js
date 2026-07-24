import { C as escape_html, S as attr, a as ensure_array_like, c as store_get, i as derived, l as unsubscribe_stores, o as head, t as attr_class } from "../../chunks/server.js";
import { o as primaryDevice, r as dashboardStatus } from "../../chunks/convex.js";
//#region src/routes/+layout.svelte
function _layout($$renderer, $$props) {
	var $$store_subs;
	let { children } = $$props;
	const nav = [
		{
			href: "/",
			label: "device"
		},
		{
			href: "/cards",
			label: "cards"
		},
		{
			href: "/scenes",
			label: "scenes"
		},
		{
			href: "/rules",
			label: "rules"
		},
		{
			href: "/sources",
			label: "sources"
		},
		{
			href: "/firmware",
			label: "firmware"
		},
		{
			href: "/provision",
			label: "provision"
		}
	];
	let status = derived(() => store_get($$store_subs ??= {}, "$dashboardStatus", dashboardStatus));
	let device = derived(() => store_get($$store_subs ??= {}, "$primaryDevice", primaryDevice));
	head("12qhfyh", $$renderer, ($$renderer) => {
		$$renderer.title(($$renderer) => {
			$$renderer.push(`<title>Wall Matrix Panel Dashboard</title>`);
		});
	});
	$$renderer.push(`<div class="min-h-screen bg-[color:var(--bg)]"><div class="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8"><header class="panel panel-grid mb-4 rounded-3xl px-5 py-4"><div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div class="flex items-center gap-3"><span class="badge badge-amber">wall matrix panel</span> <span${attr_class(`badge ${status().mode === "live" ? "badge-green" : status().mode === "degraded" ? "badge-amber" : "badge-red"}`)}>${escape_html(status().mode)}</span></div> <h1 class="mt-3 text-2xl font-semibold tracking-tight text-zinc-50">Industrial LED matrix control surface</h1> <p class="mt-1 text-sm text-[color:var(--muted)]">Dense dashboard for cards, scenes, rules, sources, firmware, and provisioning.</p></div> <div class="grid gap-2 text-sm sm:grid-cols-3"><div class="rounded-2xl border border-white/5 bg-black/20 px-4 py-3"><p class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">panel</p> <p class="mt-1 font-mono text-zinc-100">${escape_html(device()?.name ?? "mock panel")}</p></div> <div class="rounded-2xl border border-white/5 bg-black/20 px-4 py-3"><p class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">firmware</p> <p class="mt-1 font-mono text-zinc-100">${escape_html(device()?.fwVersion ?? "n/a")}</p></div> <div class="rounded-2xl border border-white/5 bg-black/20 px-4 py-3"><p class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">program</p> <p class="mt-1 font-mono text-zinc-100">v${escape_html(device()?.programVersion ?? 0)}</p></div></div></div></header> <div class="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]"><aside class="panel rounded-3xl p-3"><nav class="space-y-1"><!--[-->`);
	const each_array = ensure_array_like(nav);
	for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
		let item = each_array[$$index];
		$$renderer.push(`<a class="block rounded-2xl border border-transparent px-4 py-3 text-sm text-zinc-200 transition hover:border-lime-400/15 hover:bg-lime-400/8 hover:text-white"${attr("href", item.href)}><span class="font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">/${escape_html(item.label)}</span> <div class="mt-1 text-sm font-medium text-current">${escape_html(item.label)}</div></a>`);
	}
	$$renderer.push(`<!--]--></nav></aside> <main class="min-w-0">`);
	children?.($$renderer);
	$$renderer.push(`<!----></main></div></div></div>`);
	if ($$store_subs) unsubscribe_stores($$store_subs);
}
//#endregion
export { _layout as default };
