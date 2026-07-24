<script lang="ts">
  import StatusBadge from "$lib/components/status-badge.svelte";
  import * as Alert from "$lib/components/ui/alert/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
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

  <section class="overflow-hidden rounded-xl border bg-card/40">
    <div class="border-b px-4 py-3">
      <h2 class="text-sm font-semibold tracking-[0.18em] uppercase">Release history</h2>
      <p class="mt-1 text-sm text-muted-foreground">Newest first, grouped by release channel.</p>
    </div>
    {#if $firmware.length === 0}
      <Empty.Root class="border-none py-6">
        <Empty.Header>
          <Empty.Title>No releases</Empty.Title>
          <Empty.Description>Publish firmware metadata to start the history.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {:else}
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Version</Table.Head>
            <Table.Head>Channel</Table.Head>
            <Table.Head>sha256</Table.Head>
            <Table.Head>Released</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each $firmware as release (release._id)}
            <Table.Row>
              <Table.Cell>
                <div class="font-medium">{release.version}</div>
                <div class="mt-0.5 max-w-[18rem] truncate font-mono text-[11px] text-muted-foreground">
                  {release.r2Url}
                </div>
              </Table.Cell>
              <Table.Cell>
                <StatusBadge tone={release.channel === "stable" ? "success" : "warning"}>
                  {release.channel}
                </StatusBadge>
              </Table.Cell>
              <Table.Cell class="font-mono text-xs">{release.sha256}</Table.Cell>
              <Table.Cell class="text-muted-foreground">
                {new Date(release.releasedAt).toLocaleString()}
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    {/if}
  </section>
</div>
