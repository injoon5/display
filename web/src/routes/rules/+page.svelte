<script lang="ts">
  import RecordPicker from "$lib/components/record-picker.svelte";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import * as Empty from "$lib/components/ui/empty/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { cards, rules, saveRule, scenes, type DashboardRule } from "$lib/convex";
  import WorkflowIcon from "@lucide/svelte/icons/workflow";
  import { toast } from "svelte-sonner";

  const ACTION_KINDS = [
    { value: "pin", label: "Pin a card" },
    { value: "interrupt", label: "Interrupt with a card" },
    { value: "scene", label: "Activate a scene" },
    { value: "sleep", label: "Sleep the panel" },
  ] as const;

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
  let busy = $state(false);

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
  let actionKindLabel = $derived(
    ACTION_KINDS.find((entry) => entry.value === actionKind)?.label ?? "Select an action",
  );
  let cardLabel = $derived($cards.find((card) => card._id === actionCardId)?.name ?? "None");
  let sceneLabel = $derived($scenes.find((scene) => scene._id === actionSceneId)?.name ?? "None");

  function actionSummary(rule: DashboardRule): string {
    return ACTION_KINDS.find((entry) => entry.value === rule.action.kind)?.label ?? rule.action.kind;
  }

  async function handleSave(): Promise<void> {
    if (!selectedRule || busy) {
      return;
    }
    busy = true;
    try {
      await saveRule({
        action: {
          cardId: actionCardId || undefined,
          durationMs: actionDurationMs,
          kind: actionKind,
          sceneId: actionSceneId || undefined,
        },
        condition: draftCondition,
        enabled: draftEnabled,
        name: draftName,
        priority: draftPriority,
        ruleId: selectedRule._id,
      });
      toast.success(`Saved ${draftName}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t save rule.");
    } finally {
      busy = false;
    }
  }
</script>

<div class="grid items-start gap-5 xl:grid-cols-[minmax(260px,20rem)_minmax(0,1fr)]">
  <RecordPicker
    items={$rules}
    selectedId={selectedRuleId}
    getId={(rule: DashboardRule) => rule._id}
    onselect={(id) => (selectedRuleId = id)}
    title="All rules"
    description="Select a rule to edit."
    emptyTitle="No rules"
    emptyDescription="Load sample data to create your first rules."
    icon={WorkflowIcon}
  >
    {#snippet row(rule: DashboardRule)}
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-medium">{rule.name}</span>
        <span class="block truncate text-[11px] text-muted-foreground">
          {actionSummary(rule)}
        </span>
      </span>
      <span class="shrink-0 text-xs tabular-nums text-muted-foreground">P{rule.priority}</span>
      {#if !rule.enabled}
        <StatusBadge tone="neutral">Off</StatusBadge>
      {/if}
    {/snippet}
  </RecordPicker>

  <Card.Root>
    {#if selectedRule}
      <Card.Header>
        <Card.Title class="text-base" level={2}>Edit rule</Card.Title>
        <Card.Description>When the condition is true, run the action.</Card.Description>
        <Card.Action>
          <Button disabled={busy} onclick={handleSave}>
            {#if busy}
              <Spinner aria-label="" />
            {/if}
            {busy ? "Saving…" : "Save rule"}
          </Button>
        </Card.Action>
      </Card.Header>

      <Card.Content class="@container flex flex-col gap-5">
        <div class="grid gap-4 @lg:grid-cols-2 @2xl:grid-cols-3">
          <div class="flex flex-col gap-1.5">
            <Label for="rule-name">Name</Label>
            <Input id="rule-name" bind:value={draftName} />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="rule-priority">Priority</Label>
            <Input
              id="rule-priority"
              class="font-mono tabular-nums"
              type="number"
              bind:value={draftPriority}
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="rule-action">Action</Label>
            <Select.Root type="single" bind:value={actionKind}>
              <Select.Trigger id="rule-action" class="w-full">{actionKindLabel}</Select.Trigger>
              <Select.Content>
                {#each ACTION_KINDS as entry (entry.value)}
                  <Select.Item value={entry.value} label={entry.label} />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="rule-condition">Condition</Label>
          <Input
            id="rule-condition"
            class="font-mono"
            placeholder="bus.urgent == true"
            bind:value={draftCondition}
          />
          <p class="text-xs text-muted-foreground">
            An expression over source data, for example <code class="font-mono"
              >air.pm25 &gt; 75</code
            >.
          </p>
        </div>

        <div class="grid gap-4 @lg:grid-cols-2 @2xl:grid-cols-3">
          <div class="flex flex-col gap-1.5">
            <Label for="rule-card">Card</Label>
            <Select.Root type="single" bind:value={actionCardId}>
              <Select.Trigger id="rule-card" class="w-full">{cardLabel}</Select.Trigger>
              <Select.Content>
                <Select.Item value="" label="None" />
                {#each $cards as card (card._id)}
                  <Select.Item value={card._id} label={card.name} />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="rule-scene">Scene</Label>
            <Select.Root type="single" bind:value={actionSceneId}>
              <Select.Trigger id="rule-scene" class="w-full">{sceneLabel}</Select.Trigger>
              <Select.Content>
                <Select.Item value="" label="None" />
                {#each $scenes as scene (scene._id)}
                  <Select.Item value={scene._id} label={scene.name} />
                {/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="rule-duration">Duration (ms)</Label>
            <Input
              id="rule-duration"
              class="font-mono tabular-nums"
              min="0"
              step="1000"
              type="number"
              bind:value={actionDurationMs}
            />
          </div>
        </div>

        <Label class="flex w-fit items-center gap-2.5">
          <Checkbox id="rule-enabled" bind:checked={draftEnabled} />
          Rule is enabled
        </Label>
      </Card.Content>
    {:else}
      <Empty.Root class="border-none py-16">
        <Empty.Header>
          <Empty.Media variant="icon">
            <WorkflowIcon />
          </Empty.Media>
          <Empty.Title>No rule selected</Empty.Title>
          <Empty.Description>Pick a rule from the list to edit it.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {/if}
  </Card.Root>
</div>
