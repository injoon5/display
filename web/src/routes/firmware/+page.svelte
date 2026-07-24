<script lang="ts">
  import { firmware, publishFirmware } from "$lib/convex";

  let version = $state("1.5.1-dev");
  let channel = $state("dev");
  let r2Url = $state("https://example.invalid/fw/matrix-1.5.1-dev.bin");
  let sha256 = $state("abc123demo");
  let signature = $state("ed25519:demo");
  let message = $state<string | null>(null);

  async function handlePublish(): Promise<void> {
    await publishFirmware({ channel, r2Url, sha256, signature, version });
    message = `Published ${version}`;
  }
</script>

<div class="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
  <section class="panel rounded-3xl p-5">
    <div>
      <h2 class="text-xl font-semibold text-zinc-50">Firmware publish</h2>
      <p class="mt-1 text-sm text-[color:var(--muted)]">Channel metadata only; OTA assets remain external.</p>
    </div>

    <div class="mt-4 space-y-3">
      <label class="block rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
        <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">version</span>
        <input bind:value={version} class="mt-2 w-full bg-transparent font-mono outline-none" />
      </label>
      <label class="block rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
        <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">channel</span>
        <select bind:value={channel} class="mt-2 w-full bg-transparent outline-none">
          <option value="dev">dev</option>
          <option value="stable">stable</option>
        </select>
      </label>
      <label class="block rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
        <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">r2 url</span>
        <input bind:value={r2Url} class="mt-2 w-full bg-transparent font-mono outline-none" />
      </label>
      <label class="block rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
        <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">sha256</span>
        <input bind:value={sha256} class="mt-2 w-full bg-transparent font-mono outline-none" />
      </label>
      <label class="block rounded-2xl border border-white/5 bg-black/20 px-3 py-2 text-sm">
        <span class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">signature</span>
        <input bind:value={signature} class="mt-2 w-full bg-transparent font-mono outline-none" />
      </label>
    </div>

    <button class="mt-4 rounded-xl border border-lime-500/20 bg-lime-500/10 px-4 py-2 text-sm text-lime-100" onclick={handlePublish}>
      Publish metadata
    </button>

    {#if message}
      <div class="mt-4 rounded-2xl border border-white/5 bg-black/20 px-4 py-3 text-sm text-zinc-200">{message}</div>
    {/if}
  </section>

  <section class="panel rounded-3xl p-5">
    <div class="mb-3">
      <h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Release history</h2>
      <p class="mt-1 text-xs text-[color:var(--muted)]">Newest first, grouped by release channel.</p>
    </div>
    <div class="space-y-3">
      {#each $firmware as release (release._id)}
        <div class="rounded-2xl border border-white/5 bg-black/20 p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-lg font-semibold text-zinc-50">{release.version}</div>
              <div class="mt-1 font-mono text-[11px] text-[color:var(--muted)]">{release.r2Url}</div>
            </div>
            <span class={`badge ${release.channel === "stable" ? "badge-green" : "badge-amber"}`}>{release.channel}</span>
          </div>
          <div class="mt-3 grid gap-3 md:grid-cols-2">
            <div class="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
              <div class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">sha256</div>
              <div class="mt-1 font-mono text-xs text-zinc-100">{release.sha256}</div>
            </div>
            <div class="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
              <div class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted)]">released</div>
              <div class="mt-1 font-mono text-xs text-zinc-100">{new Date(release.releasedAt).toLocaleString()}</div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </section>
</div>
