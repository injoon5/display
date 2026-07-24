<script lang="ts">
  import StatusBadge from "$lib/components/status-badge.svelte";
  import * as Alert from "$lib/components/ui/alert/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { compile } from "$lib/compiler";
  import {
    buildSlotSnapshot,
    cards,
    deployCard,
    primaryDevice,
    saveCard,
    sources,
    telemetry
  } from "$lib/convex";
  import IconLibrary from "$lib/design/IconLibrary.svelte";
  import CardEditor from "$lib/editor/CardEditor.svelte";
  import Diagnostics from "$lib/editor/Diagnostics.svelte";
  import Preview from "$lib/editor/Preview.svelte";
  import SimulatePanel from "$lib/editor/SimulatePanel.svelte";
  import SlotInspector from "$lib/editor/SlotInspector.svelte";
  import type { RenderHotspot } from "$lib/mxr";

  type Props = {
    params: { slug: string };
  };

  let { params }: Props = $props();

  let card = $derived($cards.find((entry) => entry.slug === params.slug) ?? null);
  let source = $state("");
  let name = $state("");
  let slug = $state("");
  let priority = $state(50);
  let dwellMs = $state(10_000);
  let enabled = $state(true);
  let nowMs = $state(Date.now());
  let overrides = $state<Record<string, unknown>>({});
  let hovered = $state<RenderHotspot | null>(null);
  let lastLoadedCardId = $state<string | null>(null);
  let actionMessage = $state<string | null>(null);

  $effect(() => {
    if (!card || card._id === lastLoadedCardId) {
      return;
    }
    source = card.source;
    name = card.name;
    slug = card.slug;
    priority = card.priority;
    dwellMs = card.dwellMs;
    enabled = card.enabled;
    overrides = {};
    lastLoadedCardId = card._id;
  });

  let compiled = $derived.by(() => {
    try {
      return compile(source);
    } catch {
      return null;
    }
  });

  let snapshot = $derived(
    buildSlotSnapshot(compiled?.slotMap ?? [], {
      device: $primaryDevice,
      nowMs,
      overrides,
      sources: $sources,
      telemetry: $telemetry
    })
  );

  async function handleSave(): Promise<void> {
    actionMessage = null;
    if (compiled?.diagnostics.some((d) => d.severity === "error")) {
      actionMessage = "Fix any errors before saving.";
      return;
    }
    const saved = await saveCard({
      cardId: card?._id,
      diagnostics: (compiled?.diagnostics ?? []).map((d) => ({
        col: d.span?.start.column ?? 1,
        line: d.span?.start.line ?? 1,
        message: d.message,
        severity: d.severity
      })),
      dwellMs,
      enabled,
      estimatedAmps: compiled?.estimatedAmps ?? card?.estimatedAmps ?? 0.8,
      name,
      priority,
      slug,
      slotMap: compiled?.slotMap,
      source,
      sourceRefs: compiled?.sources
    });
    actionMessage = `Saved ${saved.slug}.`;
  }

  async function handleDeploy(): Promise<void> {
    actionMessage = null;
    if (!card || !$primaryDevice) {
      actionMessage = "Choose a card and connect a panel first.";
      return;
    }
    if (!compiled || compiled.diagnostics.some((d) => d.severity === "error")) {
      actionMessage = "Fix any errors before publishing.";
      return;
    }
    const deployed = await deployCard([card._id], $primaryDevice._id, compiled.bytecode);
    actionMessage = `Published ${card.slug} (${deployed.size} B).`;
  }
</script>

{#if !card}
  <Empty.Root>
    <Empty.Header>
      <Empty.Title>Card not found</Empty.Title>
      <Empty.Description>Choose a card from Cards to open the editor.</Empty.Description>
    </Empty.Header>
    <Empty.Content>
      <Button
        class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
        href="/cards"
        variant="outline"
      >
        Back to Cards
      </Button>
    </Empty.Content>
  </Empty.Root>
{:else}
  <Card.Root class="shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_12px_40px_rgba(0,0,0,0.28)]">
    <Card.Header class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <StatusBadge tone="success">Editing</StatusBadge>
          <StatusBadge tone="warning">{card.slug}</StatusBadge>
        </div>
        <Card.Title class="text-xl">{card.name}</Card.Title>
        <Card.Description>
          Edit the card and preview it live.
        </Card.Description>
      </div>

      <div class="grid w-full gap-3 sm:grid-cols-2 xl:max-w-3xl xl:grid-cols-4">
        <div class="flex flex-col gap-1.5">
          <Label for="card-name">Name</Label>
          <Input id="card-name" bind:value={name} />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="card-slug">Slug</Label>
          <Input id="card-slug" class="font-mono" bind:value={slug} />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="card-priority">Priority</Label>
          <Input id="card-priority" class="font-mono tabular-nums" type="number" bind:value={priority} />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="card-dwell">Dwell</Label>
          <Input id="card-dwell" class="font-mono tabular-nums" type="number" bind:value={dwellMs} />
        </div>
      </div>
    </Card.Header>

    <Card.Content class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <Label class="inline-flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 ring-1 ring-foreground/10">
          <input bind:checked={enabled} class="accent-primary" type="checkbox" />
          Enabled
        </Label>
        <Button
          class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
          onclick={handleSave}
        >
          Save Card
        </Button>
        <Button
          class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
          onclick={handleDeploy}
          variant="secondary"
        >
          Publish
        </Button>
      </div>
      {#if actionMessage}
        <Alert.Root>
          <Alert.Description>{actionMessage}</Alert.Description>
        </Alert.Root>
      {/if}
    </Card.Content>
  </Card.Root>

  <div class="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1.4fr)_520px]">
    <div class="flex flex-col gap-4">
      <CardEditor bind:value={source} filename={`${slug}.card`} label="Card editor" />
      <Diagnostics compiled={compiled} />
    </div>

    <div class="flex flex-col gap-4">
      <div class="grid gap-4 xl:grid-cols-2 2xl:grid-cols-1">
        <Preview bind:hovered {compiled} {nowMs} {source} snapshot={snapshot} />
      </div>
      <SlotInspector hovered={hovered} slotMap={compiled?.slotMap ?? []} snapshot={snapshot} />
      <SimulatePanel bind:nowMs bind:overrides slotMap={compiled?.slotMap ?? []} snapshot={snapshot} />
      <IconLibrary />
    </div>
  </div>
{/if}
