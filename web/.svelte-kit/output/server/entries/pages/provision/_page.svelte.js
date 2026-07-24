import { C as escape_html, S as attr, a as ensure_array_like, i as derived, t as attr_class } from "../../../chunks/server.js";
//#region src/routes/provision/+page.svelte
function _page($$renderer) {
	let logs = ["BLE provisioning is safe to mock when Web Bluetooth is unavailable.", "Expected flow: scan -> select panel -> send Wi-Fi creds -> claim token -> verify heartbeat."];
	let wifiSsid = "MyBedroomWiFi";
	let deviceName = "Wall Matrix Panel";
	let bluetoothAvailable = derived(() => false);
	$$renderer.push(`<div class="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]"><section class="panel rounded-3xl p-5"><div class="flex items-center gap-2"><span${attr_class(`badge ${bluetoothAvailable() ? "badge-green" : "badge-amber"}`)}>${escape_html(bluetoothAvailable() ? "web-bluetooth" : "mocked")}</span></div> <h2 class="mt-3 text-xl font-semibold text-zinc-50">Provision a panel</h2> <p class="mt-1 text-sm text-[color:var(--muted)]">Cloud UI for BLE onboarding, token claim, and first heartbeat checks.</p> <div class="mt-4 space-y-3"><label class="block rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">panel name</span> <input${attr("value", deviceName)} class="mt-2 w-full bg-transparent outline-none"/></label> <label class="block rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm"><span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Wi-Fi SSID</span> <input${attr("value", wifiSsid)} class="mt-2 w-full bg-transparent outline-none"/></label></div> <div class="mt-4 flex flex-wrap gap-2"><button class="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">Scan over BLE</button> <button class="rounded-xl border border-lime-500/20 bg-lime-500/10 px-4 py-2 text-sm text-lime-100">Mock provision</button></div></section> <section class="panel rounded-3xl p-5"><div class="mb-3"><h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Provision log</h2> <p class="mt-1 text-xs text-[color:var(--muted)]">All steps stay visible so pairing and token flow are debuggable.</p></div> <div class="space-y-2"><!--[-->`);
	const each_array = ensure_array_like(logs);
	for (let index = 0, $$length = each_array.length; index < $$length; index++) {
		let line = each_array[index];
		$$renderer.push(`<div class="rounded-2xl border border-white/5 bg-black/20 px-3 py-3 font-mono text-sm text-zinc-100">${escape_html(line)}</div>`);
	}
	$$renderer.push(`<!--]--></div></section></div>`);
}
//#endregion
export { _page as default };
