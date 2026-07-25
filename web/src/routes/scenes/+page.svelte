<script lang="ts">
  import RecordPicker from "$lib/components/record-picker.svelte";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { cards, saveScene, scenes, type DashboardScene } from "$lib/convex";
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import BoxIcon from "@lucide/svelte/icons/box";
  import ListPlusIcon from "@lucide/svelte/icons/list-plus";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import XIcon from "@lucide/svelte/icons/x";
  import { toast } from "svelte-sonner";

  let selectedSceneId = $state<string | null>(null);
  let draftName = $state("");
  let draftSchedule = $state("");
  let draftBrightness = $state(100);
  let draftEnabled = $state(true);
  let draftCards = $state<string[]>([]);
  let lastLoaded = $state<string | null>(null);
  let busy = $state(false);

  $effect(() => {
    if (!selectedSceneId && $scenes[0]) {
      selectedSceneId = $scenes[0]._id;
    }
    const selected = $scenes.find((scene) => scene._id === selectedSceneId) ?? null;
    if (!selected || selected._id === lastLoaded) {
      return;
    }
    draftName = selected.name;
    draftSchedule = selected.schedule ?? "";
    draftBrightness = selected.brightnessCeiling ?? 100;
    draftEnabled = selected.enabled;
    draftCards = [...selected.cardIds];
    lastLoaded = selected._id;
  });

  let selectedScene = $derived($scenes.find((scene) => scene._id === selectedSceneId) ?? null);
  let availableCards = $derived($cards.filter((card) => !draftCards.includes(card._id)));

  function move(index: number, delta: number): void {
    const next = [...draftCards];
    const target = index + delta;
    if (target < 0 || target >= next.length) {
      return;
    }
    const [item] = next.splice(index, 1);
    if (!item) {
      return;
    }
    next.splice(target, 0, item);
    draftCards = next;
  }

  function addCard(cardId: string): void {
    if (draftCards.includes(cardId)) {
      return;
    }
    draftCards = [...draftCards, cardId];
  }

  function removeCard(cardId: string): void {
    draftCards = draftCards.filter((id) => id !== cardId);
  }

  function cardName(cardId: string): string {
    return $cards.find((entry) => entry._id === cardId)?.name ?? cardId;
  }

  async function handleSave(): Promise<void> {
    if (!selectedScene || busy) {
      return;
    }
    busy = true;
    try {
      await saveScene({
        brightnessCeiling: draftBrightness,
        cardIds: draftCards,
        enabled: draftEnabled,
        homekitIdentifier: selectedScene.homekitIdentifier,
        name: draftName,
        sceneId: selectedScene._id,
        schedule: draftSchedule || undefined,
      });
      toast.success(`Saved ${draftName}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t save scene.");
    } finally {
      busy = false;
    }
  }
</script>

<div class="grid items-start gap-5 xl:grid-cols-[minmax(260px,20rem)_minmax(0,1fr)]">
  <RecordPicker
    items={$scenes}
    selectedId={selectedSceneId}
    getId={(scene: DashboardScene) => scene._id}
    onselect={(id) => (selectedSceneId = id)}
    title="All scenes"
    description="Select a scene to edit."
    emptyTitle="No scenes"
    emptyDescription="Load sample data to create your first scenes."
    icon={BoxIcon}
  >
    {#snippet row(scene: DashboardScene)}
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-medium">{scene.name}</span>
        <span class="block truncate font-mono text-[11px] text-muted-foreground">
          {scene.schedule ?? "manual"}
        </span>
      </span>
      <span class="shrink-0 text-xs tabular-nums text-muted-foreground">
        {scene.cardIds.length}
        {scene.cardIds.length === 1 ? "card" : "cards"}
      </span>
      {#if !scene.enabled}
        <StatusBadge tone="neutral">Off</StatusBadge>
      {/if}
    {/snippet}
  </RecordPicker>

  <Card.Root>
    {#if selectedScene}
      <Card.Header>
        <Card.Title class="text-base" level={2}>Edit scene</Card.Title>
        <Card.Description>Reorder the queue and set when the scene runs.</Card.Description>
        <Card.Action>
          <Button disabled={busy} onclick={handleSave}>
            {#if busy}
              <Spinner aria-label="" />
            {/if}
            {busy ? "Saving…" : "Save scene"}
          </Button>
        </Card.Action>
      </Card.Header>

      <Card.Content class="@container flex flex-col gap-5">
        <div class="grid gap-4 @lg:grid-cols-2 @2xl:grid-cols-3">
          <div class="flex flex-col gap-1.5">
            <Label for="scene-name">Name</Label>
            <Input id="scene-name" bind:value={draftName} />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="scene-schedule">Schedule</Label>
            <Input
              id="scene-schedule"
              class="font-mono"
              placeholder="weekday 06:30-09:30"
              bind:value={draftSchedule}
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="scene-brightness">Brightness ceiling</Label>
            <Input
              id="scene-brightness"
              class="font-mono tabular-nums"
              max="100"
              min="1"
              type="number"
              bind:value={draftBrightness}
            />
          </div>
        </div>

        <Label class="flex w-fit items-center gap-2.5">
          <Checkbox id="scene-enabled" bind:checked={draftEnabled} />
          Scene is enabled
        </Label>

        <!-- Container query: this grid tracks the panel width, not the viewport. -->
        <div class="grid gap-4 @2xl:grid-cols-2">
          <section class="panel-inset flex flex-col overflow-hidden" aria-labelledby="queue-heading">
            <div class="flex items-baseline justify-between gap-3 px-3 py-2.5">
              <h3 id="queue-heading" class="text-sm font-semibold tracking-tight">Queue</h3>
              <span class="text-xs tabular-nums text-muted-foreground">
                {draftCards.length}
                {draftCards.length === 1 ? "card" : "cards"}
              </span>
            </div>
            {#if draftCards.length === 0}
              <Empty.Root class="border-none py-8">
                <Empty.Header>
                  <Empty.Media variant="icon">
                    <ListPlusIcon />
                  </Empty.Media>
                  <Empty.Title>Empty queue</Empty.Title>
                  <Empty.Description>Add cards from the list beside this one.</Empty.Description>
                </Empty.Header>
              </Empty.Root>
            {:else}
              <ol class="flex flex-col gap-0.5 p-2 pt-0">
                {#each draftCards as cardId, index (cardId)}
                  {@const card = $cards.find((entry) => entry._id === cardId)}
                  <li
                    class="flex min-h-11 items-center gap-2 rounded-md bg-background/40 px-2.5 py-1.5"
                  >
                    <span
                      class="w-4 shrink-0 text-[11px] tabular-nums text-muted-foreground"
                      aria-hidden="true">{index + 1}</span
                    >
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-medium">
                        {card?.name ?? cardId}
                      </span>
                      <span class="block truncate font-mono text-[11px] text-muted-foreground">
                        {card?.slug ?? "unknown"}
                      </span>
                    </span>
                    <div class="flex shrink-0 items-center gap-0.5">
                      <Button
                        aria-label="Move {cardName(cardId)} up"
                        disabled={index === 0}
                        onclick={() => move(index, -1)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <ArrowUpIcon />
                      </Button>
                      <Button
                        aria-label="Move {cardName(cardId)} down"
                        disabled={index === draftCards.length - 1}
                        onclick={() => move(index, 1)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <ArrowDownIcon />
                      </Button>
                      <Button
                        aria-label="Remove {cardName(cardId)} from the queue"
                        class="text-muted-foreground hover-device:hover:text-destructive"
                        onclick={() => removeCard(cardId)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <XIcon />
                      </Button>
                    </div>
                  </li>
                {/each}
              </ol>
            {/if}
          </section>

          <section
            class="panel-inset flex flex-col overflow-hidden"
            aria-labelledby="available-heading"
          >
            <div class="flex items-baseline justify-between gap-3 px-3 py-2.5">
              <h3 id="available-heading" class="text-sm font-semibold tracking-tight">
                Available cards
              </h3>
              <span class="text-xs tabular-nums text-muted-foreground">
                {availableCards.length} left
              </span>
            </div>
            {#if availableCards.length === 0}
              <p class="px-3 pb-4 text-sm text-muted-foreground">
                Every card is already in this scene.
              </p>
            {:else}
              <ul class="flex flex-col gap-0.5 p-2 pt-0">
                {#each availableCards as card (card._id)}
                  <li
                    class="flex min-h-11 items-center gap-2 rounded-md bg-background/40 px-2.5 py-1.5"
                  >
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-medium">{card.name}</span>
                      <span class="block truncate font-mono text-[11px] text-muted-foreground">
                        {card.slug}
                      </span>
                    </span>
                    <Button
                      aria-label="Add {card.name} to the queue"
                      onclick={() => addCard(card._id)}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <PlusIcon />
                    </Button>
                  </li>
                {/each}
              </ul>
            {/if}
          </section>
        </div>
      </Card.Content>
    {:else}
      <Empty.Root class="border-none py-16">
        <Empty.Header>
          <Empty.Media variant="icon">
            <BoxIcon />
          </Empty.Media>
          <Empty.Title>No scene selected</Empty.Title>
          <Empty.Description>Pick a scene from the list to edit it.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </Card.Root>
</div>
