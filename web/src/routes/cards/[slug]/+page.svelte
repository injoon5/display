<script lang="ts">
  import StatusBadge from "$lib/components/status-badge.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { compile } from "$lib/compiler";
  import {
    buildSlotSnapshot,
    cards,
    deployCard,
    primaryDevice,
    saveCard,
    sources,
    telemetry,
  } from "$lib/convex";
  import IconLibrary from "$lib/design/IconLibrary.svelte";
  import CardEditor from "$lib/editor/CardEditor.svelte";
  import Diagnostics from "$lib/editor/Diagnostics.svelte";
  import Preview from "$lib/editor/Preview.svelte";
  import SimulatePanel from "$lib/editor/SimulatePanel.svelte";
  import SlotInspector from "$lib/editor/SlotInspector.svelte";
  import type { RenderHotspot } from "$lib/mxr";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import { toast } from "svelte-sonner";

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
  let saving = $state(false);
  let publishing = $state(false);

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

  let hasErrors = $derived(
    !compiled || compiled.diagnostics.some((entry) => entry.severity === "error"),
  );

  let snapshot = $derived(
    buildSlotSnapshot(compiled?.slotMap ?? [], {
      device: $primaryDevice,
      nowMs,
      overrides,
      sources: $sources,
      telemetry: $telemetry,
    }),
  );

  async function handleSave(): Promise<void> {
    if (saving) return;
    if (hasErrors) {
      toast.error("Fix the errors in Diagnostics before saving.");
      return;
    }
    saving = true;
    try {
      const saved = await saveCard({
        cardId: card?._id,
        diagnostics: (compiled?.diagnostics ?? []).map((entry) => ({
          col: entry.span?.start.column ?? 1,
          line: entry.span?.start.line ?? 1,
          message: entry.message,
          severity: entry.severity,
        })),
        dwellMs,
        enabled,
        estimatedAmps: compiled?.estimatedAmps ?? card?.estimatedAmps ?? 0.8,
        name,
        priority,
        slug,
        slotMap: compiled?.slotMap,
        source,
        sourceRefs: compiled?.sources,
      });
      toast.success(`Saved ${saved.slug}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t save card.");
    } finally {
      saving = false;
    }
  }

  async function handleDeploy(): Promise<void> {
    if (publishing) return;
    if (!card || !$primaryDevice) {
      toast.error("Connect a panel before publishing.");
      return;
    }
    if (hasErrors) {
      toast.error("Fix the errors in Diagnostics before publishing.");
      return;
    }
    publishing = true;
    try {
      const deployed = await deployCard([card._id], $primaryDevice._id);
      toast.success(`Published ${card.slug} (${deployed.size} bytes).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t publish card.");
    } finally {
      publishing = false;
    }
  }
</script>

{#if !card}
  <Empty.Root class="surface py-16">
    <Empty.Header>
      <Empty.Title>Card not found</Empty.Title>
      <Empty.Description>Choose a card from the Cards list to open the editor.</Empty.Description>
    </Empty.Header>
    <Empty.Content>
      <Button href="/cards" variant="outline">
        <ArrowLeftIcon />
        Back to cards
      </Button>
    </Empty.Content>
  </Empty.Root>
{:else}
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex flex-wrap items-center gap-2 text-base" level={2}>
        {card.name}
        <StatusBadge tone="mono">{card.slug}</StatusBadge>
      </Card.Title>
      <Card.Description>Edit the card, preview it live, then publish it.</Card.Description>
      <Card.Action class="flex flex-wrap gap-2">
        <Button href="/cards" variant="ghost">
          <ArrowLeftIcon />
          All cards
        </Button>
        <Button disabled={saving} onclick={handleSave}>
          {#if saving}
            <Spinner aria-label="" />
          {/if}
          {saving ? "Saving…" : "Save card"}
        </Button>
        <Button disabled={publishing} onclick={handleDeploy} variant="secondary">
          {#if publishing}
            <Spinner aria-label="" />
          {/if}
          {publishing ? "Publishing…" : "Publish"}
        </Button>
      </Card.Action>
    </Card.Header>

    <Card.Content class="@container flex flex-col gap-4">
      <div class="grid gap-4 @lg:grid-cols-2 @4xl:grid-cols-4">
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
          <Input
            id="card-priority"
            class="font-mono tabular-nums"
            type="number"
            bind:value={priority}
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="card-dwell">Dwell (ms)</Label>
          <Input
            id="card-dwell"
            class="font-mono tabular-nums"
            min="0"
            step="500"
            type="number"
            bind:value={dwellMs}
          />
        </div>
      </div>

      <Label class="flex w-fit items-center gap-2.5">
        <Checkbox id="card-enabled" bind:checked={enabled} />
        Card is enabled
      </Label>
    </Card.Content>
  </Card.Root>

  <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,32rem)]">
    <div class="flex min-w-0 flex-col gap-4">
      <CardEditor bind:value={source} filename={`${slug}.card`} label="Card editor" />
      <Diagnostics {compiled} />
    </div>

    <div class="flex min-w-0 flex-col gap-4">
      <Preview bind:hovered {compiled} {nowMs} {source} {snapshot} />
      <SlotInspector {hovered} slotMap={compiled?.slotMap ?? []} {snapshot} />
      <SimulatePanel bind:nowMs bind:overrides slotMap={compiled?.slotMap ?? []} {snapshot} />
      <IconLibrary />
    </div>
  </div>
{/if}
