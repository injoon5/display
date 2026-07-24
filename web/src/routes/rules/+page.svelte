<script lang="ts">
  import StatusBadge from "$lib/components/status-badge.svelte";
  import * as Alert from "$lib/components/ui/alert/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { cards, rules, saveRule, scenes } from "$lib/convex";

  let selectedRuleId = $state<string | null>(null);
  let draftName = $state("");
  let draftCondition = $state("");
  let draftPriority = $state(50);
  let draftEnabled = $state(true);
  let actionKind = $state("pin");
  let actionCardId = $state("");
  let actionSceneId = $state("");
  let actionDurationMs = $state(60_000);
  let lastLoaded = $state<string | null>(null);
  let message = $state<string | null>(null);

  $effect(() => {
    if (!selectedRuleId && $rules[0]) {
      selectedRuleId = $rules[0]._id;
    }
    const selected = $rules.find((rule) => rule._id === selectedRuleId) ?? null;
    if (!selected || selected._id === lastLoaded) {
      return;
    }
    draftName = selected.name;
    draftCondition = selected.condition;
    draftPriority = selected.priority;
    draftEnabled = selected.enabled;
    actionKind = selected.action.kind;
    actionCardId = selected.action.cardId ?? "";
    actionSceneId = selected.action.sceneId ?? "";
    actionDurationMs = selected.action.durationMs ?? 60_000;
    lastLoaded = selected._id;
  });

  let selectedRule = $derived($rules.find((rule) => rule._id === selectedRuleId) ?? null);

  async function handleSave(): Promise<void> {
    if (!selectedRule) {
      return;
    }
    await saveRule({
      action: {
        cardId: actionCardId || undefined,
        durationMs: actionDurationMs,
        kind: actionKind,
        sceneId: actionSceneId || undefined
      },
      condition: draftCondition,
      enabled: draftEnabled,
      name: draftName,
      priority: draftPriority,
      ruleId: selectedRule._id
    });
    message = `Saved rule ${draftName}`;
  }
</script>

<div class="grid gap-4 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
  <section class="overflow-hidden rounded-xl border bg-card/40">
    <div class="border-b px-4 py-3">
      <h2 class="text-sm font-semibold tracking-[0.18em] uppercase">Rules</h2>
      <p class="mt-1 text-sm text-muted-foreground">Alarm logic, scene switching, and interrupt pins.</p>
    </div>
    {#if $rules.length === 0}
      <Empty.Root class="border-none py-6">
        <Empty.Header>
          <Empty.Title>No rules</Empty.Title>
          <Empty.Description>Seed demo data to create rules.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {:else}
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Name</Table.Head>
            <Table.Head>Action</Table.Head>
            <Table.Head class="text-right">Priority</Table.Head>
            <Table.Head>Enabled</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each $rules as rule (rule._id)}
            <Table.Row
              class="cursor-pointer"
              data-state={selectedRuleId === rule._id ? "selected" : undefined}
              onclick={() => (selectedRuleId = rule._id)}
              onkeydown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectedRuleId = rule._id;
                }
              }}
              role="button"
              tabindex={0}
            >
              <Table.Cell class="font-medium">{rule.name}</Table.Cell>
              <Table.Cell class="font-mono text-xs text-muted-foreground">{rule.action.kind}</Table.Cell>
              <Table.Cell class="text-right tabular-nums">{rule.priority}</Table.Cell>
              <Table.Cell>
                <StatusBadge tone={rule.enabled ? "success" : "destructive"}>
                  {rule.enabled ? "on" : "off"}
                </StatusBadge>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    {/if}
  </section>

  <Card.Root>
    {#if selectedRule}
      <Card.Header class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div class="flex flex-col gap-1.5">
          <Card.Title class="text-xl">Rule editor</Card.Title>
          <Card.Description>Conditions use the same source paths the cards bind to.</Card.Description>
        </div>
        <Button
          class="active:scale-[0.96] transition-transform duration-150 ease-[var(--ease-out)]"
          onclick={handleSave}
        >
          Save rule
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
            <Label for="rule-name">name</Label>
            <Input id="rule-name" bind:value={draftName} />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="rule-priority">priority</Label>
            <Input id="rule-priority" class="font-mono tabular-nums" type="number" bind:value={draftPriority} />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="rule-action">action</Label>
            <select
              id="rule-action"
              class="border-input dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              bind:value={actionKind}
            >
              <option value="pin">pin</option>
              <option value="interrupt">interrupt</option>
              <option value="scene">scene</option>
              <option value="sleep">sleep</option>
            </select>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="rule-condition">condition</Label>
          <Input id="rule-condition" class="font-mono" bind:value={draftCondition} />
        </div>

        <div class="grid gap-4 lg:grid-cols-3">
          <div class="flex flex-col gap-1.5">
            <Label for="rule-card">target card</Label>
            <select
              id="rule-card"
              class="border-input dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              bind:value={actionCardId}
            >
              <option value="">none</option>
              {#each $cards as card (card._id)}
                <option value={card._id}>{card.name}</option>
              {/each}
            </select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="rule-scene">target scene</Label>
            <select
              id="rule-scene"
              class="border-input dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              bind:value={actionSceneId}
            >
              <option value="">none</option>
              {#each $scenes as scene (scene._id)}
                <option value={scene._id}>{scene.name}</option>
              {/each}
            </select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="rule-duration">duration ms</Label>
            <Input
              id="rule-duration"
              class="font-mono tabular-nums"
              type="number"
              bind:value={actionDurationMs}
            />
          </div>
        </div>

        <Label class="inline-flex w-fit items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 ring-1 ring-foreground/10">
          <input bind:checked={draftEnabled} class="accent-primary" type="checkbox" />
          enabled
        </Label>
      </Card.Content>
    {:else}
      <Empty.Root class="border-none py-12">
        <Empty.Header>
          <Empty.Title>Select a rule</Empty.Title>
          <Empty.Description>Pick a rule from the list to edit conditions and actions.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </Card.Root>
</div>
