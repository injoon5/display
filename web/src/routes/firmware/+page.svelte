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
    message = `Published ${version}.`;
  }
</script>

<header class="mb-4 flex flex-col gap-1">
  <h1 class="text-xl font-semibold tracking-tight">Publish Firmware</h1>
  <p class="text-sm text-muted-foreground">Publish a release for your panels to download.</p>
</header>

<div class="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
  <Card.Root>
    <Card.Header>
      <Card.Title>New release</Card.Title>
      <Card.Description>Version, channel, and download details.</Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-3">
      <div class="flex flex-col gap-1.5">
        <Label for="fw-version">Version</Label>
        <Input id="fw-version" class="font-mono" bind:value={version} />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="fw-channel">Channel</Label>
        <select
          id="fw-channel"
          class="border-input dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          bind:value={channel}
        >
          <option value="dev">Dev</option>
          <option value="stable">Stable</option>
        </select>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="fw-r2">Download URL</Label>
        <Input id="fw-r2" class="font-mono" bind:value={r2Url} />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="fw-sha">Checksum</Label>
        <Input id="fw-sha" class="font-mono" bind:value={sha256} />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="fw-sig">Signature</Label>
        <Input id="fw-sig" class="font-mono" bind:value={signature} />
      </div>

      <Button
        class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
        onclick={handlePublish}
      >
        Publish
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
      <h2 class="text-sm font-semibold">Release History</h2>
      <p class="mt-1 text-sm text-muted-foreground">Newest releases first.</p>
    </div>
    {#if $firmware.length === 0}
      <Empty.Root class="border-none py-6">
        <Empty.Header>
          <Empty.Title>No releases yet</Empty.Title>
          <Empty.Description>Publish a firmware release to see it here.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {:else}
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Version</Table.Head>
            <Table.Head>Channel</Table.Head>
            <Table.Head>Checksum</Table.Head>
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
                  {release.channel === "stable" ? "Stable" : "Dev"}
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
