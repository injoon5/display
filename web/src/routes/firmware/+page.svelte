<script lang="ts">
  import StatusBadge from "$lib/components/status-badge.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { firmware, publishFirmware } from "$lib/convex";
  import CpuIcon from "@lucide/svelte/icons/cpu";
  import { toast } from "svelte-sonner";

  const CHANNELS = [
    { value: "dev", label: "Dev" },
    { value: "stable", label: "Stable" },
  ] as const;

  let version = $state("1.5.1-dev");
  let channel = $state("dev");
  let r2Url = $state("https://example.invalid/fw/matrix-1.5.1-dev.bin");
  let sha256 = $state("abc123demo");
  let signature = $state("ed25519:demo");
  let busy = $state(false);

  let channelLabel = $derived(CHANNELS.find((entry) => entry.value === channel)?.label ?? "Dev");

  async function handlePublish(): Promise<void> {
    if (busy) {
      return;
    }
    busy = true;
    try {
      await publishFirmware({ channel, r2Url, sha256, signature, version });
      toast.success(`Published ${version}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t publish firmware.");
    } finally {
      busy = false;
    }
  }
</script>

<div class="grid items-start gap-5 xl:grid-cols-[minmax(320px,26rem)_minmax(0,1fr)]">
  <Card.Root>
    <Card.Header>
      <Card.Title class="text-base" level={2}>New release</Card.Title>
      <Card.Description>Version, channel, and download details.</Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <Label for="fw-version">Version</Label>
        <Input id="fw-version" class="font-mono" bind:value={version} />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="fw-channel">Channel</Label>
        <Select.Root type="single" bind:value={channel}>
          <Select.Trigger id="fw-channel" class="w-full">{channelLabel}</Select.Trigger>
          <Select.Content>
            {#each CHANNELS as entry (entry.value)}
              <Select.Item value={entry.value} label={entry.label} />
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="fw-r2">Download URL</Label>
        <Input id="fw-r2" class="font-mono" inputmode="url" bind:value={r2Url} />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="fw-sha">Checksum</Label>
        <Input id="fw-sha" class="font-mono" bind:value={sha256} />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label for="fw-sig">Signature</Label>
        <Input id="fw-sig" class="font-mono" bind:value={signature} />
      </div>
    </Card.Content>
    <Card.Footer class="justify-end">
      <Button disabled={busy} onclick={handlePublish}>
        {#if busy}
          <Spinner aria-label="" />
        {/if}
        {busy ? "Publishing…" : "Publish release"}
      </Button>
    </Card.Footer>
  </Card.Root>

  <section class="surface overflow-hidden" aria-labelledby="release-history">
    <div class="px-4 py-3">
      <h2 id="release-history" class="text-sm font-semibold tracking-tight">Release history</h2>
      <p class="mt-0.5 text-xs text-muted-foreground">Newest releases first.</p>
    </div>
    {#if $firmware.length === 0}
      <Empty.Root class="border-none py-10">
        <Empty.Header>
          <Empty.Media variant="icon">
            <CpuIcon />
          </Empty.Media>
          <Empty.Title>No releases yet</Empty.Title>
          <Empty.Description>Publish a firmware release to see it here.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {:else}
      <Table.Root>
        <Table.Header>
          <Table.Row class="hover:bg-transparent">
            <Table.Head class="pl-4">Version</Table.Head>
            <Table.Head>Channel</Table.Head>
            <Table.Head>Checksum</Table.Head>
            <Table.Head class="pr-4 text-right">Released</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each $firmware as release (release._id)}
            <Table.Row class="last:border-b-0">
              <Table.Cell class="py-2.5 pl-4">
                <div class="font-medium tabular-nums">{release.version}</div>
                <div
                  class="mt-0.5 max-w-[18rem] truncate font-mono text-[11px] text-muted-foreground"
                  title={release.r2Url}
                >
                  {release.r2Url}
                </div>
              </Table.Cell>
              <Table.Cell>
                <StatusBadge tone={release.channel === "stable" ? "success" : "neutral"}>
                  {release.channel === "stable" ? "Stable" : "Dev"}
                </StatusBadge>
              </Table.Cell>
              <Table.Cell class="font-mono text-xs text-muted-foreground">
                {release.sha256}
              </Table.Cell>
              <Table.Cell class="pr-4 text-right text-muted-foreground tabular-nums">
                <time datetime={new Date(release.releasedAt).toISOString()}>
                  {new Date(release.releasedAt).toLocaleString()}
                </time>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    {/if}
  </section>
</div>
