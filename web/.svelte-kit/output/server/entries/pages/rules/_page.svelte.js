import { C as escape_html, S as attr, a as ensure_array_like, c as store_get, i as derived, l as unsubscribe_stores, t as attr_class } from "../../../chunks/server.js";
import { c as scenes, n as cards, s as rules } from "../../../chunks/convex.js";
//#region src/routes/rules/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let selectedRuleId = null;
		let draftName = "";
		let draftCondition = "";
		let draftPriority = 50;
		let draftEnabled = true;
		let actionKind = "pin";
		let actionCardId = "";
		let actionSceneId = "";
		let actionDurationMs = 6e4;
		let selectedRule = derived(() => store_get($$store_subs ??= {}, "$rules", rules).find((rule) => rule._id === selectedRuleId) ?? null);
		$$renderer.push(`<div class="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]"><section class="panel rounded-3xl p-4"><div class="mb-3"><h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Rules</h2> <p class="mt-1 text-xs text-[color:var(--muted)]">Alarm logic, scene switching, and interrupt pins.</p></div> <div class="space-y-2"><!--[-->`);
		const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$rules", rules));
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let rule = each_array[$$index];
			$$renderer.push(`<button${attr_class(`w-full rounded-2xl border px-3 py-3 text-left ${selectedRuleId === rule._id ? "border-lime-400/20 bg-lime-400/8" : "border-white/5 bg-black/20"}`)}><div class="flex items-center justify-between gap-3"><div><div class="font-medium text-zinc-100">${escape_html(rule.name)}</div> <div class="mt-1 font-mono text-[11px] text-[color:var(--muted)]">${escape_html(rule.action.kind)}</div></div> <span class="badge badge-amber">${escape_html(rule.priority)}</span></div></button>`);
		}
		$$renderer.push(`<!--]--></div></section> <section class="panel rounded-3xl p-5">`);
		if (selectedRule()) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><h2 class="text-xl font-semibold text-zinc-50">Rule editor</h2> <p class="mt-1 text-sm text-[color:var(--muted)]">Conditions use the same source paths the cards bind to.</p></div> <button class="rounded-xl border border-lime-500/20 bg-lime-500/10 px-4 py-2 text-sm text-lime-100">Save rule</button></div> `);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <div class="mt-4 grid gap-4 lg:grid-cols-3"><label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">name</span> <input${attr("value", draftName)} class="mt-2 w-full bg-transparent outline-none"/></label> <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">priority</span> <input${attr("value", draftPriority)} class="mt-2 w-full bg-transparent font-mono outline-none" type="number"/></label> <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">action</span> `);
			$$renderer.select({
				value: actionKind,
				class: "mt-2 w-full bg-transparent outline-none"
			}, ($$renderer) => {
				$$renderer.option({ value: "pin" }, ($$renderer) => {
					$$renderer.push(`pin`);
				});
				$$renderer.option({ value: "interrupt" }, ($$renderer) => {
					$$renderer.push(`interrupt`);
				});
				$$renderer.option({ value: "scene" }, ($$renderer) => {
					$$renderer.push(`scene`);
				});
				$$renderer.option({ value: "sleep" }, ($$renderer) => {
					$$renderer.push(`sleep`);
				});
			});
			$$renderer.push(`</label></div> <label class="mt-4 block rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">condition</span> <input${attr("value", draftCondition)} class="mt-2 w-full bg-transparent font-mono outline-none"/></label> <div class="mt-4 grid gap-4 lg:grid-cols-3"><label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">target card</span> `);
			$$renderer.select({
				value: actionCardId,
				class: "mt-2 w-full bg-transparent outline-none"
			}, ($$renderer) => {
				$$renderer.option({ value: "" }, ($$renderer) => {
					$$renderer.push(`none`);
				});
				$$renderer.push(`<!--[-->`);
				const each_array_1 = ensure_array_like(store_get($$store_subs ??= {}, "$cards", cards));
				for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
					let card = each_array_1[$$index_1];
					$$renderer.option({ value: card._id }, ($$renderer) => {
						$$renderer.push(`${escape_html(card.name)}`);
					});
				}
				$$renderer.push(`<!--]-->`);
			});
			$$renderer.push(`</label> <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">target scene</span> `);
			$$renderer.select({
				value: actionSceneId,
				class: "mt-2 w-full bg-transparent outline-none"
			}, ($$renderer) => {
				$$renderer.option({ value: "" }, ($$renderer) => {
					$$renderer.push(`none`);
				});
				$$renderer.push(`<!--[-->`);
				const each_array_2 = ensure_array_like(store_get($$store_subs ??= {}, "$scenes", scenes));
				for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
					let scene = each_array_2[$$index_2];
					$$renderer.option({ value: scene._id }, ($$renderer) => {
						$$renderer.push(`${escape_html(scene.name)}`);
					});
				}
				$$renderer.push(`<!--]-->`);
			});
			$$renderer.push(`</label> <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">duration ms</span> <input${attr("value", actionDurationMs)} class="mt-2 w-full bg-transparent font-mono outline-none" type="number"/></label></div> <label class="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100"><input${attr("checked", draftEnabled, true)} class="accent-lime-400" type="checkbox"/> enabled</label>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></section></div>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
export { _page as default };
