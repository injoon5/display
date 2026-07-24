import { C as escape_html, S as attr, a as ensure_array_like, c as store_get, i as derived, l as unsubscribe_stores, t as attr_class } from "../../../chunks/server.js";
import { c as scenes, n as cards } from "../../../chunks/convex.js";
//#region src/routes/scenes/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let selectedSceneId = null;
		let draftName = "";
		let draftSchedule = "";
		let draftBrightness = 100;
		let draftEnabled = true;
		let draftCards = [];
		let selectedScene = derived(() => store_get($$store_subs ??= {}, "$scenes", scenes).find((scene) => scene._id === selectedSceneId) ?? null);
		$$renderer.push(`<div class="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]"><section class="panel rounded-3xl p-4"><div class="mb-3"><h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Scenes</h2> <p class="mt-1 text-xs text-[color:var(--muted)]">Playlist builder for scheduled card queues.</p></div> <div class="space-y-2"><!--[-->`);
		const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$scenes", scenes));
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let scene = each_array[$$index];
			$$renderer.push(`<button${attr_class(`w-full rounded-2xl border px-3 py-3 text-left ${selectedSceneId === scene._id ? "border-lime-400/20 bg-lime-400/8" : "border-white/5 bg-black/20"}`)}><div class="flex items-center justify-between gap-3"><div><div class="font-medium text-zinc-100">${escape_html(scene.name)}</div> <div class="mt-1 font-mono text-[11px] text-[color:var(--muted)]">${escape_html(scene.schedule ?? "manual")}</div></div> <span class="badge badge-amber">${escape_html(scene.cardIds.length)}</span></div></button>`);
		}
		$$renderer.push(`<!--]--></div></section> <section class="panel rounded-3xl p-5">`);
		if (selectedScene()) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><h2 class="text-xl font-semibold text-zinc-50">Scene builder</h2> <p class="mt-1 text-sm text-[color:var(--muted)]">Reorder cards and tune the schedule window.</p></div> <button class="rounded-xl border border-lime-500/20 bg-lime-500/10 px-4 py-2 text-sm text-lime-100">Save scene</button></div> `);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <div class="mt-4 grid gap-4 lg:grid-cols-3"><label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">name</span> <input${attr("value", draftName)} class="mt-2 w-full bg-transparent outline-none"/></label> <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">schedule</span> <input${attr("value", draftSchedule)} class="mt-2 w-full bg-transparent font-mono outline-none" placeholder="weekday 06:30-09:30"/></label> <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">brightness</span> <input${attr("value", draftBrightness)} class="mt-2 w-full bg-transparent font-mono outline-none" max="100" min="1" type="number"/></label></div> <label class="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100"><input${attr("checked", draftEnabled, true)} class="accent-lime-400" type="checkbox"/> enabled</label> <div class="mt-5 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]"><div class="space-y-2"><h3 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Queue</h3> <!--[-->`);
			const each_array_1 = ensure_array_like(draftCards);
			for (let index = 0, $$length = each_array_1.length; index < $$length; index++) {
				let cardId = each_array_1[index];
				const card = store_get($$store_subs ??= {}, "$cards", cards).find((entry) => entry._id === cardId);
				$$renderer.push(`<div class="rounded-2xl border border-white/5 bg-black/20 px-3 py-3"><div class="flex items-center justify-between gap-3"><div><div class="font-medium text-zinc-100">${escape_html(card?.name ?? cardId)}</div> <div class="mt-1 font-mono text-[11px] text-[color:var(--muted)]">${escape_html(card?.slug ?? "unknown")}</div></div> <div class="flex gap-2"><button class="rounded-lg border border-white/10 px-2 py-1 text-xs">up</button> <button class="rounded-lg border border-white/10 px-2 py-1 text-xs">down</button> <button class="rounded-lg border border-red-400/20 px-2 py-1 text-xs text-red-200">remove</button></div></div></div>`);
			}
			$$renderer.push(`<!--]--></div> <div class="space-y-2"><h3 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Available cards</h3> <!--[-->`);
			const each_array_2 = ensure_array_like(store_get($$store_subs ??= {}, "$cards", cards));
			for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
				let card = each_array_2[$$index_2];
				$$renderer.push(`<div class="rounded-2xl border border-white/5 bg-black/20 px-3 py-3"><div class="flex items-center justify-between gap-3"><div><div class="font-medium text-zinc-100">${escape_html(card.name)}</div> <div class="mt-1 font-mono text-[11px] text-[color:var(--muted)]">${escape_html(card.slug)}</div></div> <button class="rounded-lg border border-lime-400/20 px-2 py-1 text-xs text-lime-100">add</button></div></div>`);
			}
			$$renderer.push(`<!--]--></div></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></section></div>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
export { _page as default };
