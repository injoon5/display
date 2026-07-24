import "../../../../chunks/index-server.js";
import { C as escape_html, S as attr, a as ensure_array_like, c as store_get, i as derived, l as unsubscribe_stores, r as bind_props, t as attr_class } from "../../../../chunks/server.js";
import { l as sources, n as cards, o as primaryDevice, t as buildSlotSnapshot, u as telemetry } from "../../../../chunks/convex.js";
import { a as compile, i as render, n as PixelCanvas, r as MXR_DIMENSIONS, t as Mirror } from "../../../../chunks/Mirror.js";
import { Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
//#region src/lib/design/IconLibrary.svelte
function IconLibrary($$renderer) {
	const icons = [
		{
			name: "cloud",
			tint: "text-sky-300"
		},
		{
			name: "bus",
			tint: "text-amber-300"
		},
		{
			name: "calendar",
			tint: "text-lime-300"
		},
		{
			name: "air",
			tint: "text-emerald-300"
		},
		{
			name: "clock",
			tint: "text-zinc-200"
		},
		{
			name: "alert",
			tint: "text-red-300"
		}
	];
	$$renderer.push(`<section class="panel rounded-2xl p-4"><div class="mb-3"><h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Icon library</h2> <p class="mt-1 text-xs text-[color:var(--muted)]">Stub palette until libmxr asset bundles are wired into wasm.</p></div> <div class="grid grid-cols-2 gap-3 sm:grid-cols-3"><!--[-->`);
	const each_array = ensure_array_like(icons);
	for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
		let icon = each_array[$$index];
		$$renderer.push(`<div class="rounded-xl border border-white/5 bg-black/20 p-3"><div${attr_class(`mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/25 font-mono text-xs uppercase ${icon.tint}`)}>${escape_html(icon.name.slice(0, 2))}</div> <div class="font-mono text-xs text-zinc-100">${escape_html(icon.name)}</div></div>`);
	}
	$$renderer.push(`<!--]--></div></section>`);
}
//#endregion
//#region src/lib/editor/CardEditor.svelte
function CardEditor($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { filename = "card.card", label = "Card source", value = "" } = $$props;
		new Compartment();
		new Compartment();
		EditorView.theme({
			"&": {
				backgroundColor: "transparent",
				color: "#ecf4e7",
				fontFamily: "\"JetBrains Mono\", monospace",
				fontSize: "13px",
				height: "100%"
			},
			".cm-content": {
				padding: "16px",
				minHeight: "26rem"
			},
			".cm-gutters": {
				backgroundColor: "rgba(4, 6, 4, 0.72)",
				borderRight: "1px solid rgba(167, 243, 104, 0.08)",
				color: "#7f907d"
			},
			".cm-activeLine": { backgroundColor: "rgba(132, 204, 22, 0.08)" },
			".cm-activeLineGutter": { backgroundColor: "rgba(132, 204, 22, 0.06)" },
			".cm-selectionBackground": { backgroundColor: "rgba(245, 158, 11, 0.22) !important" }
		});
		$$renderer.push(`<section class="panel rounded-2xl overflow-hidden"><div class="flex items-center justify-between border-b border-white/5 bg-black/20 px-4 py-3"><div><h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">${escape_html(label)}</h2> <p class="mt-1 font-mono text-[11px] text-[color:var(--muted)]">${escape_html(filename)}</p></div> <span class="badge badge-green">${escape_html(value.trim().startsWith("<") ? "mxml" : "stage0-json")}</span></div> <div class="min-h-[28rem] bg-[linear-gradient(180deg,rgba(8,11,8,0.94),rgba(8,11,8,0.98))]"></div></section>`);
		bind_props($$props, { value });
	});
}
//#endregion
//#region src/lib/editor/Diagnostics.svelte
function Diagnostics($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { compiled } = $$props;
		let diagnostics = derived(() => compiled?.diagnostics ?? []);
		$$renderer.push(`<section class="panel rounded-2xl p-4"><div class="mb-3 flex items-center justify-between"><div><h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Diagnostics</h2> <p class="mt-1 text-xs text-[color:var(--muted)]">Compiler output, layout validation, and slot pressure.</p></div> <span${attr_class(`badge ${diagnostics().some((entry) => entry.severity === "error") ? "badge-red" : "badge-green"}`)}>${escape_html(diagnostics().length)} entries</span></div> `);
		if (diagnostics().length === 0) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="rounded-xl border border-emerald-500/15 bg-emerald-500/8 px-3 py-2 text-sm text-emerald-200">No diagnostics. This card compiles cleanly.</div>`);
		} else {
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<div class="space-y-2"><!--[-->`);
			const each_array = ensure_array_like(diagnostics());
			for (let index = 0, $$length = each_array.length; index < $$length; index++) {
				let entry = each_array[index];
				$$renderer.push(`<div class="rounded-xl border border-white/5 bg-black/20 px-3 py-2"><div class="flex items-center justify-between gap-3"><div class="flex items-center gap-2"><span${attr_class(`badge ${entry.severity === "error" ? "badge-red" : "badge-amber"}`)}>${escape_html(entry.severity)}</span> <code class="font-mono text-xs text-zinc-300">${escape_html(entry.code)}</code></div> `);
				if (entry.span) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<span class="font-mono text-[11px] text-[color:var(--muted)]">L${escape_html(entry.span.start.line)}:C${escape_html(entry.span.start.column)}</span>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></div> <p class="mt-2 text-sm text-zinc-100">${escape_html(entry.message)}</p> `);
				if (entry.hint) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<p class="mt-1 text-xs text-[color:var(--muted)]">${escape_html(entry.hint)}</p>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></div>`);
			}
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]--></section>`);
	});
}
//#endregion
//#region src/lib/editor/Preview.svelte
function Preview($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { compiled, hovered = null, nowMs, source, snapshot } = $$props;
		let frame = derived(() => {
			if (!compiled) return {
				framebuffer: new Uint16Array(MXR_DIMENSIONS.width * MXR_DIMENSIONS.height),
				height: MXR_DIMENSIONS.height,
				hotspots: [],
				mode: "bytecode",
				warnings: ["No compiled program"],
				width: MXR_DIMENSIONS.width
			};
			return render({
				bytecode: compiled.bytecode,
				nowMs,
				slotMap: compiled.slotMap,
				slots: snapshot.byIndex,
				source,
				sourceSlots: snapshot.byPath
			});
		});
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			$$renderer.push(`<section class="panel rounded-2xl p-4"><div class="mb-3 flex items-center justify-between gap-3"><div><h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Live preview</h2> <p class="mt-1 text-xs text-[color:var(--muted)]">64×32 framebuffer with 8× nearest-neighbour upscale.</p></div> <div class="flex items-center gap-2"><span class="badge badge-green">${escape_html(frame().mode)}</span> <span class="badge badge-amber">${escape_html(compiled?.slotMap.length ?? 0)} slots</span></div></div> `);
			PixelCanvas($$renderer, {
				framebuffer: frame().framebuffer,
				hotspots: frame().hotspots,
				scale: 8,
				title: "Live card preview",
				get hovered() {
					return hovered;
				},
				set hovered($$value) {
					hovered = $$value;
					$$settled = false;
				}
			});
			$$renderer.push(`<!----> `);
			if (frame().warnings.length > 0) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="mt-3 space-y-2"><!--[-->`);
				const each_array = ensure_array_like(frame().warnings);
				for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
					let warning = each_array[$$index];
					$$renderer.push(`<div class="rounded-xl border border-amber-500/15 bg-amber-500/7 px-3 py-2 text-xs text-amber-100">${escape_html(warning)}</div>`);
				}
				$$renderer.push(`<!--]--></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></section>`);
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
		bind_props($$props, { hovered });
	});
}
//#endregion
//#region src/lib/editor/SimulatePanel.svelte
function SimulatePanel($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { nowMs = Date.now(), overrides = {}, slotMap, snapshot } = $$props;
		const baseNow = Date.now();
		let manualPath = "";
		let manualValue = "\"demo\"";
		let scrubMinutes = Math.round((nowMs - baseNow) / 6e4);
		function asText(value) {
			if (typeof value === "string") return value;
			if (value === null || value === void 0) return "";
			return JSON.stringify(value);
		}
		let kstLabel = derived(() => new Intl.DateTimeFormat("en-US", {
			dateStyle: "medium",
			timeStyle: "medium",
			timeZone: "Asia/Seoul"
		}).format(nowMs));
		$$renderer.push(`<section class="panel rounded-2xl p-4"><div class="mb-4 flex items-center justify-between gap-3"><div><h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Simulate panel</h2> <p class="mt-1 text-xs text-[color:var(--muted)]">Override source paths, scrub time, and force card re-renders.</p></div> <span class="badge badge-green">${escape_html(Object.keys(overrides).length)} overrides</span></div> <div class="mb-4 rounded-xl border border-white/5 bg-black/20 p-3"><div class="mb-2 flex items-center justify-between gap-3"><div><p class="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Time scrubber</p> <p class="mt-1 font-mono text-sm text-zinc-100">${escape_html(kstLabel())}</p></div> <button class="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200">Reset</button></div> <input${attr("value", scrubMinutes)} class="w-full accent-lime-400" max="720" min="-720" step="15" type="range"/> <div class="mt-2 flex justify-between text-[11px] text-[color:var(--muted)]"><span>-12h</span> <span>${escape_html(scrubMinutes > 0 ? "+" : "")}${escape_html(scrubMinutes)}m</span> <span>+12h</span></div></div> <div class="mb-4 grid gap-2 md:grid-cols-[1.1fr_1fr_auto]"><input${attr("value", manualPath)} class="rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-mono text-sm outline-none" placeholder="path, e.g. air.pm25"/> <input${attr("value", manualValue)} class="rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-mono text-sm outline-none" placeholder="JSON value"/> <button class="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">Override</button></div> <div class="max-h-[28rem] space-y-2 overflow-auto pr-1"><!--[-->`);
		const each_array = ensure_array_like(slotMap);
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let entry = each_array[$$index];
			const slot = snapshot.byPath[entry.path];
			const overridden = entry.path in overrides;
			$$renderer.push(`<div${attr_class(`rounded-xl border p-3 ${overridden ? "border-amber-500/25 bg-amber-500/8" : "border-white/5 bg-black/15"}`)}><div class="flex items-center justify-between gap-3"><code class="font-mono text-xs text-zinc-200">${escape_html(entry.path)}</code> <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">${escape_html(entry.type)}</span></div> <div class="mt-3 flex flex-wrap items-center gap-2">`);
			if (entry.type === "boolean") {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<label class="inline-flex items-center gap-2 text-sm text-zinc-100"><input${attr("checked", Boolean(overridden ? overrides[entry.path] : slot?.value), true)} class="accent-lime-400" type="checkbox"/> active</label>`);
			} else if (entry.type === "number") {
				$$renderer.push("<!--[1-->");
				$$renderer.push(`<input class="min-w-[8rem] rounded-lg border border-white/10 bg-black/25 px-3 py-1.5 font-mono text-sm outline-none" type="number"${attr("value", String(overridden ? overrides[entry.path] : slot?.value ?? 0))}/>`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<input class="min-w-[14rem] rounded-lg border border-white/10 bg-black/25 px-3 py-1.5 font-mono text-sm outline-none" type="text"${attr("value", asText(overridden ? overrides[entry.path] : slot?.value))}/>`);
			}
			$$renderer.push(`<!--]--> <button class="rounded-lg border border-white/10 px-2 py-1 text-xs text-zinc-300">Clear</button></div></div>`);
		}
		$$renderer.push(`<!--]--></div></section>`);
		bind_props($$props, {
			nowMs,
			overrides
		});
	});
}
//#endregion
//#region src/lib/editor/SlotInspector.svelte
function SlotInspector($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { hovered, slotMap, snapshot } = $$props;
		function formatValue(value) {
			if (typeof value === "string") return value;
			if (typeof value === "number" || typeof value === "boolean") return String(value);
			if (value === null || value === void 0) return "null";
			return JSON.stringify(value);
		}
		$$renderer.push(`<section class="panel rounded-2xl p-4"><div class="mb-3 flex items-center justify-between"><div><h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Slot inspector</h2> <p class="mt-1 text-xs text-[color:var(--muted)]">Hover the preview to inspect bound values and freshness.</p></div> <span class="badge badge-amber">${escape_html(slotMap.length)} slots</span></div> `);
		if (hovered) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/8 p-3"><div class="flex items-center justify-between gap-3"><code class="font-mono text-sm text-amber-100">${escape_html(hovered.path)}</code> <span class="font-mono text-[11px] text-amber-200/70">${escape_html(hovered.sourceId)}</span></div> <p class="mt-2 text-sm text-zinc-100">${escape_html(formatValue(hovered.value))}</p></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <div class="max-h-[26rem] space-y-2 overflow-auto pr-1"><!--[-->`);
		const each_array = ensure_array_like(slotMap);
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let entry = each_array[$$index];
			const slot = snapshot.byIndex[entry.index];
			$$renderer.push(`<div${attr_class(`rounded-xl border px-3 py-2 ${hovered?.path === entry.path ? "border-amber-500/35 bg-amber-500/8" : "border-white/5 bg-black/15"}`)}><div class="flex items-center justify-between gap-3"><code class="font-mono text-xs text-zinc-200">${escape_html(entry.path)}</code> <span class="font-mono text-[11px] text-[color:var(--muted)]">#${escape_html(entry.index)}</span></div> <div class="mt-1 flex items-center justify-between gap-3"><span class="text-sm text-zinc-100">${escape_html(formatValue(slot?.value))}</span> <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">${escape_html(entry.type)}</span></div></div>`);
		}
		$$renderer.push(`<!--]--></div></section>`);
	});
}
//#endregion
//#region src/routes/cards/[slug]/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let { params } = $$props;
		let card = derived(() => store_get($$store_subs ??= {}, "$cards", cards).find((entry) => entry.slug === params.slug) ?? null);
		let source = "";
		let name = "";
		let slug = "";
		let priority = 50;
		let dwellMs = 1e4;
		let enabled = true;
		let nowMs = Date.now();
		let overrides = {};
		let hovered = null;
		let compiled = derived(() => {
			try {
				return compile(source);
			} catch {
				return null;
			}
		});
		let snapshot = derived(() => buildSlotSnapshot(compiled()?.slotMap ?? [], {
			device: store_get($$store_subs ??= {}, "$primaryDevice", primaryDevice),
			nowMs,
			overrides,
			sources: store_get($$store_subs ??= {}, "$sources", sources),
			telemetry: store_get($$store_subs ??= {}, "$telemetry", telemetry)
		}));
		let $$settled = true;
		let $$inner_renderer;
		function $$render_inner($$renderer) {
			if (!card()) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<section class="panel rounded-3xl p-6"><h2 class="text-xl font-semibold text-zinc-50">Card not found</h2> <p class="mt-2 text-sm text-[color:var(--muted)]">Choose a card from the catalogue to open the live editor.</p> <a class="mt-4 inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-100" href="/cards">Back to cards</a></section>`);
			} else {
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<section class="panel rounded-3xl p-5"><div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><div class="flex items-center gap-2"><span class="badge badge-green">editor</span> <span class="badge badge-amber">${escape_html(card().slug)}</span></div> <h2 class="mt-3 text-xl font-semibold text-zinc-50">${escape_html(card().name)}</h2> <p class="mt-1 text-sm text-[color:var(--muted)]">Svelte 5 live preview loop: state → compile → render → framebuffer.</p></div> <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">name</span> <input${attr("value", name)} class="mt-2 w-full bg-transparent outline-none"/></label> <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">slug</span> <input${attr("value", slug)} class="mt-2 w-full bg-transparent font-mono outline-none"/></label> <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">priority</span> <input${attr("value", priority)} class="mt-2 w-full bg-transparent font-mono outline-none" type="number"/></label> <label class="rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">dwell ms</span> <input${attr("value", dwellMs)} class="mt-2 w-full bg-transparent font-mono outline-none" type="number"/></label></div></div> <div class="mt-4 flex flex-wrap items-center gap-3"><label class="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100"><input${attr("checked", enabled, true)} class="accent-lime-400" type="checkbox"/> enabled</label> <button class="rounded-xl border border-lime-500/20 bg-lime-500/10 px-4 py-2 text-sm text-lime-100">Save card</button> <button class="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">Deploy to device</button> `);
				$$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></div></section> <div class="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1.4fr)_520px]"><div class="space-y-4">`);
				CardEditor($$renderer, {
					filename: `${slug}.card`,
					label: "Card editor",
					get value() {
						return source;
					},
					set value($$value) {
						source = $$value;
						$$settled = false;
					}
				});
				$$renderer.push(`<!----> `);
				Diagnostics($$renderer, { compiled: compiled() });
				$$renderer.push(`<!----></div> <div class="space-y-4"><div class="grid gap-4 xl:grid-cols-2 2xl:grid-cols-1">`);
				Preview($$renderer, {
					compiled: compiled(),
					nowMs,
					source,
					snapshot: snapshot(),
					get hovered() {
						return hovered;
					},
					set hovered($$value) {
						hovered = $$value;
						$$settled = false;
					}
				});
				$$renderer.push(`<!----> `);
				Mirror($$renderer, {
					card: card(),
					nowMs,
					snapshot: snapshot()
				});
				$$renderer.push(`<!----></div> `);
				SlotInspector($$renderer, {
					hovered,
					slotMap: compiled()?.slotMap ?? [],
					snapshot: snapshot()
				});
				$$renderer.push(`<!----> `);
				SimulatePanel($$renderer, {
					slotMap: compiled()?.slotMap ?? [],
					snapshot: snapshot(),
					get nowMs() {
						return nowMs;
					},
					set nowMs($$value) {
						nowMs = $$value;
						$$settled = false;
					},
					get overrides() {
						return overrides;
					},
					set overrides($$value) {
						overrides = $$value;
						$$settled = false;
					}
				});
				$$renderer.push(`<!----> `);
				IconLibrary($$renderer, {});
				$$renderer.push(`<!----></div></div>`);
			}
			$$renderer.push(`<!--]-->`);
		}
		do {
			$$settled = true;
			$$inner_renderer = $$renderer.copy();
			$$render_inner($$inner_renderer);
		} while (!$$settled);
		$$renderer.subsume($$inner_renderer);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
export { _page as default };
