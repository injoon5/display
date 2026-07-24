<script lang="ts">
  import StatusBadge from "$lib/components/status-badge.svelte";
  import StatTile from "$lib/components/stat-tile.svelte";
  import * as Alert from "$lib/components/ui/alert/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
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
  <Card.Root>
    <Card.Header>
      <Card.Title class="text-xl">Firmware publish</Card.Title>
      <Card.Description>Channel metadata only; OTA assets remain external.</Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-3">
      <div class="flex flex-col gap-1.5">
        <Label for="fw-version">version</Label>
        <Input id="fw-version" class="font-mono" bind:value={version} />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="fw-channel">channel</Label>
        <select
          id="fw-channel"
          class="border-input dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          bind:value={channel}
        >
          <option value="dev">dev</option>
          <option value="stable">stable</option>
        </select>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="fw-r2">r2 url</Label>
        <Input id="fw-r2" class="font-mono" bind:value={r2Url} />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="fw-sha">sha256</Label>
        <Input id="fw-sha" class="font-mono" bind:value={sha256} />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="fw-sig">signature</Label>
        <Input id="fw-sig" class="font-mono" bind:value={signature} />
      </div>

      <Button
        class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
        onclick={handlePublish}
      >
        Publish metadata
      </Button>

      {#if message}
        <Alert.Root>
          <Alert.Description>{message}</Alert.Description>
        </Alert.Root>
      {/if}
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title class="text-sm tracking-[0.18em] uppercase">Release history</Card.Title>
      <Card.Description>Newest first, grouped by release channel.</Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-3">
      {#each $firmware as release (release._id)}
        <div class="rounded-lg bg-muted/30 p-4 ring-1 ring-foreground/10">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-lg font-semibold">{release.version}</div>
              <div class="mt-1 truncate font-mono text-[11px] text-muted-foreground">{release.r2Url}</div>
            </div>
            <StatusBadge tone={release.channel === "stable" ? "success" : "warning"}>
              {release.channel}
            </StatusBadge>
          </div>
          <div class="mt-3 grid gap-3 md:grid-cols-2">
            <StatTile label="sha256" value={release.sha256} />
            <StatTile label="released" value={new Date(release.releasedAt).toLocaleString()} />
          </div>
        </div>
      {:else}
        <Empty.Root class="border-none py-6">
          <Empty.Header>
            <Empty.Title>No releases</Empty.Title>
            <Empty.Description>Publish firmware metadata to start the history.</Empty.Description>
          </Empty.Header>
        </Empty.Root>
      {/each}
    </Card.Content>
  </Card.Root>
</div>
