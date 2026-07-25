<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		level,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		/**
		 * Render the title as a real heading so the page keeps a usable outline.
		 * Leave unset for decorative titles that would break the heading order.
		 */
		level?: 2 | 3 | 4;
	} = $props();
</script>

<svelte:element
	this={level ? `h${level}` : "div"}
	bind:this={ref}
	data-slot="card-title"
	class={cn("text-base leading-snug font-medium group-data-[size=sm]/card:text-sm", className)}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
