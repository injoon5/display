<script lang="ts">
  import StatusBadge from "$lib/components/status-badge.svelte";
  import * as Alert from "$lib/components/ui/alert/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { cards, saveScene, scenes } from "$lib/convex";

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
    message = `Saved ${draftName}.`;
  }
</script>

<header class="mb-4 flex flex-col gap-1">
  <h1 class="text-xl font-semibold tracking-tight">Scenes</h1>
  <p class="text-sm text-muted-foreground">Build and schedule card playlists.</p>
</header>

<div class="grid gap-4 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
  <section class="overflow-hidden rounded-xl border bg-card/40">
    <div class="border-b px-4 py-3">
      <h2 class="text-sm font-semibold">All scenes</h2>
      <p class="mt-1 text-sm text-muted-foreground">Select a scene to edit.</p>
    </div>
    {#if $scenes.length === 0}
      <Empty.Root class="border-none py-6">
        <Empty.Header>
          <Empty.Title>No scenes</Empty.Title>
          <Empty.Description>Load sample data to create your first scenes.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {:else}
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Name</Table.Head>
            <Table.Head>Schedule</Table.Head>
            <Table.Head class="text-right">Cards</Table.Head>
            <Table.Head>Enabled</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each $scenes as scene (scene._id)}
            <Table.Row
              class="cursor-pointer"
              data-state={selectedSceneId === scene._id ? "selected" : undefined}
              aria-selected={selectedSceneId === scene._id}
              onclick={() => (selectedSceneId = scene._id)}
              onkeydown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectedSceneId = scene._id;
                }
              }}
              tabindex={0}
            >
              <Table.Cell class="font-medium">{scene.name}</Table.Cell>
              <Table.Cell class="font-mono text-xs text-muted-foreground">
                {scene.schedule ?? "Manual"}
              </Table.Cell>
              <Table.Cell class="text-right tabular-nums">{scene.cardIds.length}</Table.Cell>
              <Table.Cell>
                <StatusBadge tone={scene.enabled ? "success" : "destructive"}>
                  {scene.enabled ? "Enabled" : "Disabled"}
                </StatusBadge>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    {/if}
  </section>

  <Card.Root>
    {#if selectedScene}
      <Card.Header class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div class="flex flex-col gap-1.5">
          <Card.Title class="text-xl">Edit Scene</Card.Title>
          <Card.Description>Reorder cards and set the schedule.</Card.Description>
        </div>
        <Button
          class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
          onclick={handleSave}
        >
          Save Scene
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
            <Label for="scene-brightness">Brightness</Label>
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
          Enabled
        </Label>

        <Separator />

        <div class="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div class="overflow-hidden rounded-xl border">
            <div class="border-b px-3 py-2">
              <h3 class="text-sm font-semibold">Queue</h3>
            </div>
            {#if draftCards.length === 0}
              <Empty.Root class="border-none py-4">
                <Empty.Header>
                  <Empty.Title>Empty queue</Empty.Title>
                  <Empty.Description>Add cards from the list on the right.</Empty.Description>
                </Empty.Header>
              </Empty.Root>
            {:else}
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>Card</Table.Head>
                    <Table.Head class="w-[1%] text-right">Actions</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {#each draftCards as cardId, index (cardId)}
                    {@const card = $cards.find((entry) => entry._id === cardId)}
                    <Table.Row>
                      <Table.Cell>
                        <div class="font-medium">{card?.name ?? cardId}</div>
                        <div class="font-mono text-[11px] text-muted-foreground">
                          {card?.slug ?? "unknown"}
                        </div>
                      </Table.Cell>
                      <Table.Cell class="text-right">
                        <div class="inline-flex gap-2">
                          <Button
                            class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
                            onclick={() => move(index, -1)}
                            size="xs"
                            variant="outline"
                          >
                            Up
                          </Button>
                          <Button
                            class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
                            onclick={() => move(index, 1)}
                            size="xs"
                            variant="outline"
                          >
                            Down
                          </Button>
                          <Button
                            class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
                            onclick={() => removeCard(cardId)}
                            size="xs"
                            variant="destructive"
                          >
                            Remove
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  {/each}
                </Table.Body>
              </Table.Root>
            {/if}
          </div>

          <div class="overflow-hidden rounded-xl border">
            <div class="border-b px-3 py-2">
              <h3 class="text-sm font-semibold">Available Cards</h3>
            </div>
            <Table.Root>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Card</Table.Head>
                  <Table.Head class="w-[1%] text-right"></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each $cards as card (card._id)}
                  <Table.Row>
                    <Table.Cell>
                      <div class="font-medium">{card.name}</div>
                      <div class="font-mono text-[11px] text-muted-foreground">{card.slug}</div>
                    </Table.Cell>
                    <Table.Cell class="text-right">
                      <Button
                        class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
                        onclick={() => addCard(card._id)}
                        size="xs"
                        variant="secondary"
                      >
                        Add
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </div>
        </div>
      </Card.Content>
    {:else}
      <Empty.Root class="border-none py-12">
        <Empty.Header>
          <Empty.Title>Select a scene to edit.</Empty.Title>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </Card.Root>
</div>
