<script lang="ts" generics="T">
  import * as Empty from "$lib/components/ui/empty/index.js";
  import type { Component, Snippet } from "svelte";

  type Props = {
    items: T[];
    selectedId: string | null;
    getId: (item: T) => string;
    onselect: (id: string) => void;
    title: string;
    description: string;
    emptyTitle: string;
    emptyDescription: string;
    icon?: Component;
    row: Snippet<[T]>;
  };

  let {
    items,
    selectedId,
    getId,
    onselect,
    title,
    description,
    emptyTitle,
    emptyDescription,
    icon,
    row,
  }: Props = $props();

  let headingId = $derived(`picker-${title.replace(/\W+/g, "-").toLowerCase()}`);
</script>

<!--
  A real <button> per record instead of a clickable table row: it is focusable,
  activates on Enter and Space for free, and announces its selected state.
-->
<section class="surface flex flex-col overflow-hidden" aria-labelledby={headingId}>
  <div class="px-4 py-3">
    <h2 id={headingId} class="text-sm font-semibold tracking-tight">{title}</h2>
    <p class="mt-0.5 text-xs text-muted-foreground">{description}</p>
  </div>

  {#if items.length === 0}
    <Empty.Root class="border-none py-8">
      <Empty.Header>
        {#if icon}
          {@const Icon = icon}
          <Empty.Media variant="icon">
            <Icon />
          </Empty.Media>
        {/if}
        <Empty.Title>{emptyTitle}</Empty.Title>
        <Empty.Description>{emptyDescription}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <ul class="flex flex-col gap-0.5 p-2 pt-0">
      {#each items as item (getId(item))}
        {@const id = getId(item)}
        {@const selected = id === selectedId}
        <li>
          <button
            aria-current={selected ? "true" : undefined}
            class="press flex w-full min-h-11 items-center gap-3 rounded-md px-2.5 py-2 text-left outline-none transition-[background-color,box-shadow] duration-150 ease-[var(--ease-out)] focus-visible:ring-3 focus-visible:ring-ring/50 hover-device:hover:bg-foreground/[0.045] aria-[current]:bg-foreground/[0.07] aria-[current]:shadow-[inset_0_0_0_1px_var(--border)]"
            onclick={() => onselect(id)}
            type="button"
          >
            {@render row(item)}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>
