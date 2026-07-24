import { C as escape_html, S as attr, a as ensure_array_like, c as store_get, i as derived, l as unsubscribe_stores, t as attr_class } from "../../../chunks/server.js";
import { n as cards, r as dashboardStatus } from "../../../chunks/convex.js";
//#region src/routes/cards/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let status = derived(() => store_get($$store_subs ??= {}, "$dashboardStatus", dashboardStatus));
		$$renderer.push(`<section class="panel rounded-3xl p-5"><div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div class="flex items-center gap-2"><span class="badge badge-green">cards</span> <span${attr_class(`badge ${status().mode === "live" ? "badge-green" : "badge-amber"}`)}>${escape_html(status().mode)}</span></div> <h2 class="mt-3 text-xl font-semibold text-zinc-50">Card catalogue</h2> <p class="mt-1 text-sm text-[color:var(--muted)]">Seed set: bus-402, weather, air, clock, clock-dim, indoor, calendar-next, self-status.</p></div> <div class="flex flex-wrap gap-2"><button class="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">Seed demo</button> <button class="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200">Reset mock</button></div></div> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></section> <div class="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3"><!--[-->`);
		const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$cards", cards));
		for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
			let card = each_array[$$index_1];
			$$renderer.push(`<a class="panel rounded-3xl p-4 transition hover:border-lime-400/20 hover:bg-lime-400/6"${attr("href", `/cards/${card.slug}`)}><div class="flex items-start justify-between gap-3"><div><h3 class="text-lg font-semibold text-zinc-50">${escape_html(card.name)}</h3> <p class="mt-1 font-mono text-xs text-[color:var(--muted)]">${escape_html(card.slug)}</p></div> <span${attr_class(`badge ${card.enabled ? "badge-green" : "badge-red"}`)}>${escape_html(card.enabled ? "enabled" : "disabled")}</span></div> <dl class="mt-4 grid grid-cols-3 gap-3 text-sm"><div class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2"><dt class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">slots</dt> <dd class="mt-1 font-mono text-zinc-100">${escape_html(card.slotMap.length)}</dd></div> <div class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2"><dt class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">amps</dt> <dd class="mt-1 font-mono text-zinc-100">${escape_html(card.estimatedAmps.toFixed(2))}</dd></div> <div class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2"><dt class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">priority</dt> <dd class="mt-1 font-mono text-zinc-100">${escape_html(card.priority)}</dd></div></dl> <div class="mt-4 flex flex-wrap gap-2"><!--[-->`);
			const each_array_1 = ensure_array_like(card.sourceRefs);
			for (let $$index = 0, $$length = each_array_1.length; $$index < $$length; $$index++) {
				let sourceId = each_array_1[$$index];
				$$renderer.push(`<span class="badge badge-amber">${escape_html(sourceId)}</span>`);
			}
			$$renderer.push(`<!--]--></div></a>`);
		}
		$$renderer.push(`<!--]--></div>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
export { _page as default };
