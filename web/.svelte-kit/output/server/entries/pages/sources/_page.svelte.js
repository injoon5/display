import { C as escape_html, a as ensure_array_like, c as store_get, i as derived, l as unsubscribe_stores, t as attr_class } from "../../../chunks/server.js";
import { l as sources } from "../../../chunks/convex.js";
//#region src/routes/sources/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let selectedSourceId = null;
		let draftJson = "{}";
		let selected = derived(() => store_get($$store_subs ??= {}, "$sources", sources).find((source) => source.sourceId === selectedSourceId) ?? null);
		$$renderer.push(`<div class="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]"><section class="panel rounded-3xl p-4"><div class="mb-3"><h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Sources</h2> <p class="mt-1 text-xs text-[color:var(--muted)]">Probe providers, inspect raw payloads, and poke test values.</p></div> <div class="space-y-2"><!--[-->`);
		const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$sources", sources));
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let source = each_array[$$index];
			$$renderer.push(`<button${attr_class(`w-full rounded-2xl border px-3 py-3 text-left ${selectedSourceId === source.sourceId ? "border-lime-400/20 bg-lime-400/8" : "border-white/5 bg-black/20"}`)}><div class="flex items-center justify-between gap-3"><div><div class="font-medium text-zinc-100">${escape_html(source.sourceId)}</div> <div class="mt-1 font-mono text-[11px] text-[color:var(--muted)]">${escape_html(source.kind)}</div></div> <span class="badge badge-amber">${escape_html(source.intervalMs / 1e3)}s</span></div></button>`);
		}
		$$renderer.push(`<!--]--></div></section> <section class="panel rounded-3xl p-5">`);
		if (selected()) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><h2 class="text-xl font-semibold text-zinc-50">${escape_html(selected().sourceId)}</h2> <p class="mt-1 text-sm text-[color:var(--muted)]">Origin ${escape_html(selected().origin)} · interval ${escape_html(selected().intervalMs / 1e3)}s</p></div> <div class="flex gap-2"><button class="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">Test fetch</button> <button class="rounded-xl border border-lime-500/20 bg-lime-500/10 px-4 py-2 text-sm text-lime-100">Write source</button></div></div> `);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <div class="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"><label class="rounded-2xl border border-white/5 bg-black/20 p-3"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">raw payload</span> <textarea class="mt-3 min-h-[28rem] w-full bg-transparent font-mono text-sm outline-none">`);
			const $$body = escape_html(draftJson);
			if ($$body) $$renderer.push(`${$$body}`);
			$$renderer.push(`</textarea></label> <div class="space-y-3"><div class="rounded-2xl border border-white/5 bg-black/20 p-3"><div class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Config</div> <pre class="mt-3 overflow-auto font-mono text-xs text-zinc-100">${escape_html(JSON.stringify(selected().config, null, 2))}</pre></div> <div class="rounded-2xl border border-white/5 bg-black/20 p-3"><div class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Health</div> <dl class="mt-3 space-y-2 text-sm"><div class="flex justify-between gap-3"><dt class="text-[color:var(--muted)]">Failures</dt> <dd class="font-mono text-zinc-100">${escape_html(selected().consecutiveFailures)}</dd></div> <div class="flex justify-between gap-3"><dt class="text-[color:var(--muted)]">Fetched at</dt> <dd class="font-mono text-zinc-100">${escape_html(new Date(selected().fetchedAt).toLocaleTimeString())}</dd></div> <div class="flex justify-between gap-3"><dt class="text-[color:var(--muted)]">Circuit</dt> <dd class="font-mono text-zinc-100">${escape_html(selected().circuitOpenUntil ? "open" : "closed")}</dd></div></dl></div></div></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></section></div>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
export { _page as default };
