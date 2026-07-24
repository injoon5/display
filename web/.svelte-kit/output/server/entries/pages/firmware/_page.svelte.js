import { C as escape_html, S as attr, a as ensure_array_like, c as store_get, l as unsubscribe_stores, t as attr_class } from "../../../chunks/server.js";
import { i as firmware } from "../../../chunks/convex.js";
//#region src/routes/firmware/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		var $$store_subs;
		let version = "1.5.1-dev";
		let channel = "dev";
		let r2Url = "https://example.invalid/fw/matrix-1.5.1-dev.bin";
		let sha256 = "abc123demo";
		let signature = "ed25519:demo";
		$$renderer.push(`<div class="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]"><section class="panel rounded-3xl p-5"><div><h2 class="text-xl font-semibold text-zinc-50">Firmware publish</h2> <p class="mt-1 text-sm text-[color:var(--muted)]">Channel metadata only; OTA assets remain external.</p></div> <div class="mt-4 space-y-3"><label class="block rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">version</span> <input${attr("value", version)} class="mt-2 w-full bg-transparent font-mono outline-none"/></label> <label class="block rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">channel</span> `);
		$$renderer.select({
			value: channel,
			class: "mt-2 w-full bg-transparent outline-none"
		}, ($$renderer) => {
			$$renderer.option({ value: "dev" }, ($$renderer) => {
				$$renderer.push(`dev`);
			});
			$$renderer.option({ value: "stable" }, ($$renderer) => {
				$$renderer.push(`stable`);
			});
		});
		$$renderer.push(`</label> <label class="block rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">r2 url</span> <input${attr("value", r2Url)} class="mt-2 w-full bg-transparent font-mono outline-none"/></label> <label class="block rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">sha256</span> <input${attr("value", sha256)} class="mt-2 w-full bg-transparent font-mono outline-none"/></label> <label class="block rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">signature</span> <input${attr("value", signature)} class="mt-2 w-full bg-transparent font-mono outline-none"/></label></div> <button class="mt-4 rounded-xl border border-lime-500/20 bg-lime-500/10 px-4 py-2 text-sm text-lime-100">Publish metadata</button> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></section> <section class="panel rounded-3xl p-5"><div class="mb-3"><h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Release history</h2> <p class="mt-1 text-xs text-[color:var(--muted)]">Newest first, grouped by release channel.</p></div> <div class="space-y-3"><!--[-->`);
		const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$firmware", firmware));
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let release = each_array[$$index];
			$$renderer.push(`<div class="rounded-2xl border border-white/5 bg-black/20 p-4"><div class="flex items-start justify-between gap-3"><div><div class="text-lg font-semibold text-zinc-50">${escape_html(release.version)}</div> <div class="mt-1 font-mono text-[11px] text-[color:var(--muted)]">${escape_html(release.r2Url)}</div></div> <span${attr_class(`badge ${release.channel === "stable" ? "badge-green" : "badge-amber"}`)}>${escape_html(release.channel)}</span></div> <div class="mt-3 grid gap-3 md:grid-cols-2"><div class="rounded-xl border border-white/5 bg-black/20 px-3 py-2"><div class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">sha256</div> <div class="mt-1 font-mono text-xs text-zinc-100">${escape_html(release.sha256)}</div></div> <div class="rounded-xl border border-white/5 bg-black/20 px-3 py-2"><div class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">released</div> <div class="mt-1 font-mono text-xs text-zinc-100">${escape_html(new Date(release.releasedAt).toLocaleString())}</div></div></div></div>`);
		}
		$$renderer.push(`<!--]--></div></section></div>`);
		if ($$store_subs) unsubscribe_stores($$store_subs);
	});
}
//#endregion
export { _page as default };
