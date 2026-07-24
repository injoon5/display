import "../../chunks/index-server.js";
import { C as escape_html, S as attr, a as ensure_array_like, c as store_get, i as derived, l as unsubscribe_stores, n as attr_style, t as attr_class } from "../../chunks/server.js";
import { a as getActiveScene, l as sources, n as cards, o as primaryDevice, r as dashboardStatus, s as rules, t as buildSlotSnapshot, u as telemetry } from "../../chunks/convex.js";
import { t as Mirror } from "../../chunks/Mirror.js";
//#region src/lib/device/Health.svelte
function Health($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { device, statusLabel, telemetry } = $$props;
		function minutesAgo(value) {
			const delta = Math.max(0, Date.now() - value);
			if (delta < 6e4) return `${Math.round(delta / 1e3)}s ago`;
			return `${Math.round(delta / 6e4)}m ago`;
		}
		$$renderer.push(`<section class="panel rounded-2xl p-4"><div class="mb-4 flex items-center justify-between"><div><h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Device health</h2> <p class="mt-1 text-xs text-[color:var(--muted)]">Link state, firmware, sensors, and runtime headroom.</p></div> <span${attr_class(`badge ${device?.online ? "badge-green" : "badge-red"}`)}>${escape_html(device?.online ? "online" : "offline")}</span></div> <dl class="grid grid-cols-2 gap-3 text-sm"><div class="rounded-xl border border-white/5 bg-black/20 p-3"><dt class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Convex mode</dt> <dd class="mt-1 font-mono text-zinc-100">${escape_html(statusLabel)}</dd></div> <div class="rounded-xl border border-white/5 bg-black/20 p-3"><dt class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Firmware</dt> <dd class="mt-1 font-mono text-zinc-100">${escape_html(device?.fwVersion ?? "n/a")}</dd></div> <div class="rounded-xl border border-white/5 bg-black/20 p-3"><dt class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">RSSI</dt> <dd class="mt-1 font-mono text-zinc-100">${escape_html(telemetry.rssi)} dBm</dd></div> <div class="rounded-xl border border-white/5 bg-black/20 p-3"><dt class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Heap free</dt> <dd class="mt-1 font-mono text-zinc-100">${escape_html(telemetry.heapFree.toLocaleString())} B</dd></div> <div class="rounded-xl border border-white/5 bg-black/20 p-3"><dt class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Ambient lux</dt> <dd class="mt-1 font-mono text-zinc-100">${escape_html(telemetry.lux)}</dd></div> <div class="rounded-xl border border-white/5 bg-black/20 p-3"><dt class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Last heartbeat</dt> <dd class="mt-1 font-mono text-zinc-100">${escape_html(device ? minutesAgo(device.lastSeen) : "n/a")}</dd></div></dl></section>`);
	});
}
//#endregion
//#region src/lib/device/PowerMeter.svelte
function PowerMeter($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { amps, budget = 4, label = "draw" } = $$props;
		let percent = derived(() => Math.min(100, Math.max(0, amps / budget * 100)));
		let state = derived(() => percent() > 85 ? "red" : percent() > 60 ? "amber" : "green");
		$$renderer.push(`<section class="panel rounded-2xl p-4"><div class="mb-3 flex items-center justify-between"><div><h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Power meter</h2> <p class="mt-1 text-xs text-[color:var(--muted)]">Estimated panel current versus supply headroom.</p></div> <span${attr_class(`badge ${state() === "red" ? "badge-red" : state() === "amber" ? "badge-amber" : "badge-green"}`)}>${escape_html(amps.toFixed(2))} A</span></div> <div class="rounded-xl border border-white/5 bg-black/20 p-3"><div class="mb-2 flex items-end justify-between text-xs text-[color:var(--muted)]"><span>${escape_html(label)}</span> <span>${escape_html(budget.toFixed(1))} A budget</span></div> <div class="h-4 rounded-full bg-white/5 p-1"><div${attr_class(`h-full rounded-full ${state() === "red" ? "bg-red-400" : state() === "amber" ? "bg-amber-400" : "bg-lime-400"}`)}${attr_style(`width:${percent()}%`)}></div></div></div></section>`);
	});
}
//#endregion
//#region src/routes/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let nowMs = Date.now();
		let device = derived(() => store_get($$store_subs ??= {}, "$primaryDevice", primaryDevice));
		let scene = derived(() => device() ? getActiveScene(device()) : null);
		let activeCard = derived(() => {
			if (!device()) return store_get($$store_subs ??= {}, "$cards", cards)[0] ?? null;
			if (device().pinnedCardId) return store_get($$store_subs ??= {}, "$cards", cards).find((card) => card._id === device().pinnedCardId) ?? null;
			const firstCardId = scene()?.cardIds[0];
			return store_get($$store_subs ??= {}, "$cards", cards).find((card) => card._id === firstCardId) ?? store_get($$store_subs ??= {}, "$cards", cards)[0] ?? null;
		});
		let snapshot = derived(() => activeCard() ? buildSlotSnapshot(activeCard().slotMap, {
			device: device(),
			nowMs,
			sources: store_get($$store_subs ??= {}, "$sources", sources),
			telemetry: store_get($$store_subs ??= {}, "$telemetry", telemetry)
		}) : {
			byIndex: {},
			byPath: {}
		});
		let statusLabel = derived(() => store_get($$store_subs ??= {}, "$dashboardStatus", dashboardStatus).mode + (store_get($$store_subs ??= {}, "$dashboardStatus", dashboardStatus).lastError ? " / fallback" : ""));
		$$renderer.push(`<div class="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_420px]"><div class="space-y-4"><section class="panel rounded-3xl p-5"><div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div class="flex items-center gap-2"><span${attr_class(`badge ${device()?.online ? "badge-green" : "badge-red"}`)}>${escape_html(device()?.online ? "online" : "offline")}</span> <span class="badge badge-amber">${escape_html(scene()?.name ?? "no-scene")}</span></div> <h2 class="mt-3 text-xl font-semibold text-zinc-50">${escape_html(device()?.name ?? "Wall Matrix Panel")}</h2> <p class="mt-1 text-sm text-[color:var(--muted)]">Active scene queue, live mirror, and device runtime telemetry.</p></div> <div class="grid gap-3 sm:grid-cols-3"><div class="rounded-2xl border border-white/5 bg-black/20 px-4 py-3"><p class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">scene cards</p> <p class="mt-1 font-mono text-lg text-zinc-100">${escape_html(scene()?.cardIds.length ?? 0)}</p></div> <div class="rounded-2xl border border-white/5 bg-black/20 px-4 py-3"><p class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">rules armed</p> <p class="mt-1 font-mono text-lg text-zinc-100">${escape_html(store_get($$store_subs ??= {}, "$rules", rules).filter((rule) => rule.enabled).length)}</p></div> <div class="rounded-2xl border border-white/5 bg-black/20 px-4 py-3"><p class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">sources hot</p> <p class="mt-1 font-mono text-lg text-zinc-100">${escape_html(store_get($$store_subs ??= {}, "$sources", sources).length)}</p></div></div></div></section> <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">`);
		Mirror($$renderer, {
			card: activeCard(),
			nowMs,
			snapshot: snapshot()
		});
		$$renderer.push(`<!----> <div class="space-y-4">`);
		Health($$renderer, {
			device: device(),
			statusLabel: statusLabel(),
			telemetry: store_get($$store_subs ??= {}, "$telemetry", telemetry)
		});
		$$renderer.push(`<!----> `);
		PowerMeter($$renderer, {
			amps: store_get($$store_subs ??= {}, "$telemetry", telemetry).estAmps,
			budget: 4,
			label: "telemetry draw"
		});
		$$renderer.push(`<!----></div></div></div> <div class="space-y-4"><section class="panel rounded-3xl p-4"><div class="mb-3 flex items-center justify-between"><div><h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Scene queue</h2> <p class="mt-1 text-xs text-[color:var(--muted)]">Cards in the currently active scene.</p></div> <span class="badge badge-green">${escape_html(scene()?.name ?? "idle")}</span></div> <div class="space-y-2">`);
		if (scene()) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<!--[-->`);
			const each_array = ensure_array_like(scene().cardIds);
			for (let index = 0, $$length = each_array.length; index < $$length; index++) {
				let cardId = each_array[index];
				const card = store_get($$store_subs ??= {}, "$cards", cards).find((entry) => entry._id === cardId);
				$$renderer.push(`<a class="block rounded-2xl border border-white/5 bg-black/20 px-3 py-3 transition hover:border-lime-400/20 hover:bg-lime-400/8"${attr("href", card ? `/cards/${card.slug}` : "/cards")}><div class="flex items-center justify-between gap-3"><div><div class="font-medium text-zinc-100">${escape_html(card?.name ?? cardId)}</div> <div class="mt-1 font-mono text-[11px] text-[color:var(--muted)]">${escape_html(card?.slug ?? "unknown")}</div></div> <span class="badge badge-amber">#${escape_html(index + 1)}</span></div></a>`);
			}
			$$renderer.push(`<!--]-->`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="rounded-2xl border border-white/5 bg-black/20 px-3 py-4 text-sm text-[color:var(--muted)]">No active scene selected.</div>`);
		}
		$$renderer.push(`<!--]--></div></section> <section class="panel rounded-3xl p-4"><div class="mb-3"><h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Source freshness</h2> <p class="mt-1 text-xs text-[color:var(--muted)]">Oldest data tends to show up here first.</p></div> <div class="space-y-2"><!--[-->`);
		const each_array_1 = ensure_array_like([...store_get($$store_subs ??= {}, "$sources", sources)].sort((left, right) => left.fetchedAt - right.fetchedAt).slice(0, 6));
		for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
			let source = each_array_1[$$index_1];
			$$renderer.push(`<div class="rounded-2xl border border-white/5 bg-black/20 px-3 py-3"><div class="flex items-center justify-between gap-3"><div><div class="font-medium text-zinc-100">${escape_html(source.sourceId)}</div> <div class="mt-1 font-mono text-[11px] text-[color:var(--muted)]">${escape_html(source.kind)}</div></div> <span class="badge badge-amber">${escape_html(Math.max(0, Math.round((nowMs - source.fetchedAt) / 1e3)))}s</span></div></div>`);
		}
		$$renderer.push(`<!--]--></div></section></div></div>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
export { _page as default };
