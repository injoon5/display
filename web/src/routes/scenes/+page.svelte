<script lang="ts">
  import StatusBadge from "$lib/components/status-badge.svelte";
  import * as Alert from "$lib/components/ui/alert/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import { cards, saveScene, scenes } from "$lib/convex";
  import { cn } from "$lib/utils.js";

  let selectedSceneId = $state<string | null>(null);
  let draftName = $state("");
  let draftSchedule = $state("");
  let draftBrightness = $state(100);
  let draftEnabled = $state(true);
  let draftCards = $state<string[]>([]);
  let lastLoaded = $state<string | null>(null);
  let message = $state<string | null>(null);

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

  async function handleSave(): Promise<void> {
    if (!selectedScene) {
      return;
    }
    await saveScene({
      brightnessCeiling: draftBrightness,
      cardIds: draftCards,
      enabled: draftEnabled,
      homekitIdentifier: selectedScene.homekitIdentifier,
      name: draftName,
      sceneId: selectedScene._id,
      schedule: draftSchedule || undefined
    });
    message = `Saved scene ${draftName}`;
  }
</script>

<div class="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
  <Card.Root>
    <Card.Header>
      <Card.Title class="text-sm tracking-[0.18em] uppercase">Scenes</Card.Title>
      <Card.Description>Playlist builder for scheduled card queues.</Card.Description>
    </Card.Header>
    <Card.Content class="flex flex-col gap-2">
      {#each $scenes as scene (scene._id)}
        <button
          class={cn(
            "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left ring-1 ring-foreground/10 transition-[background-color,box-shadow] duration-150 ease-[var(--ease-out)] hover:bg-muted/50",
            selectedSceneId === scene._id ? "bg-muted/50 ring-foreground/20" : "bg-muted/30"
          )}
          onclick={() => (selectedSceneId = scene._id)}
          type="button"
        >
          <div class="min-w-0">
            <div class="truncate font-medium">{scene.name}</div>
            <div class="mt-1 font-mono text-[11px] text-muted-foreground">{scene.schedule ?? "manual"}</div>
          </div>
          <StatusBadge class="tabular-nums" tone="warning">{scene.cardIds.length}</StatusBadge>
        </button>
      {:else}
        <Empty.Root class="border-none py-6">
          <Empty.Header>
            <Empty.Title>No scenes</Empty.Title>
            <Empty.Description>Seed demo data to create scenes.</Empty.Description>
          </Empty.Header>
        </Empty.Root>
      {/each}
    </Card.Content>
  </Card.Root>

  <Card.Root>
    {#if selectedScene}
      <Card.Header class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div class="flex flex-col gap-1.5">
          <Card.Title class="text-xl">Scene builder</Card.Title>
          <Card.Description>Reorder cards and tune the schedule window.</Card.Description>
        </div>
        <Button
          class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
          onclick={handleSave}
        >
          Save scene
        </Button>
      </Card.Header>

      <Card.Content class="flex flex-col gap-4">
        {#if message}
          <Alert.Root>
            <Alert.Description>{message}</Alert.Description>
          </Alert.Root>
        {/if}

        <div class="grid gap-4 lg:grid-cols-3">
          <div class="flex flex-col gap-1.5">
            <Label for="scene-name">name</Label>
            <Input id="scene-name" bind:value={draftName} />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="scene-schedule">schedule</Label>
            <Input
              id="scene-schedule"
              class="font-mono"
              placeholder="weekday 06:30-09:30"
              bind:value={draftSchedule}
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="scene-brightness">brightness</Label>
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

        <Label class="inline-flex w-fit items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 ring-1 ring-foreground/10">
          <input bind:checked={draftEnabled} class="accent-primary" type="checkbox" />
          enabled
        </Label>

        <Separator />

        <div class="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold tracking-[0.18em] uppercase">Queue</h3>
            {#each draftCards as cardId, index (cardId)}
              {@const card = $cards.find((entry) => entry._id === cardId)}
              <div class="rounded-lg bg-muted/30 px-3 py-3 ring-1 ring-foreground/10">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <div class="truncate font-medium">{card?.name ?? cardId}</div>
                    <div class="mt-1 font-mono text-[11px] text-muted-foreground">{card?.slug ?? "unknown"}</div>
                  </div>
                  <div class="flex gap-2">
                    <Button
                      class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
                      onclick={() => move(index, -1)}
                      size="xs"
                      variant="outline"
                    >
                      up
                    </Button>
                    <Button
                      class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
                      onclick={() => move(index, 1)}
                      size="xs"
                      variant="outline"
                    >
                      down
                    </Button>
                    <Button
                      class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
                      onclick={() => removeCard(cardId)}
                      size="xs"
                      variant="destructive"
                    >
                      remove
                    </Button>
                  </div>
                </div>
              </div>
            {:else}
              <Empty.Root class="border-none py-4">
                <Empty.Header>
                  <Empty.Title>Empty queue</Empty.Title>
                  <Empty.Description>Add cards from the list on the right.</Empty.Description>
                </Empty.Header>
              </Empty.Root>
            {/each}
          </div>

          <div class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold tracking-[0.18em] uppercase">Available cards</h3>
            {#each $cards as card (card._id)}
              <div class="rounded-lg bg-muted/30 px-3 py-3 ring-1 ring-foreground/10">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <div class="truncate font-medium">{card.name}</div>
                    <div class="mt-1 font-mono text-[11px] text-muted-foreground">{card.slug}</div>
                  </div>
                  <Button
                    class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
                    onclick={() => addCard(card._id)}
                    size="xs"
                    variant="secondary"
                  >
                    add
                  </Button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </Card.Content>
    {:else}
      <Empty.Root class="border-none py-12">
        <Empty.Header>
          <Empty.Title>Select a scene</Empty.Title>
          <Empty.Description>Pick a scene from the list to edit its queue.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </Card.Root>
</div>
