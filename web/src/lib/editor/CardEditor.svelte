<script lang="ts">
  import { html } from "@codemirror/lang-html";
  import { json } from "@codemirror/lang-json";
  import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
  import { Compartment, EditorSelection, EditorState, type Extension } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  import { tags } from "@lezer/highlight";
  import { basicSetup } from "codemirror";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import { onMount } from "svelte";

  type Props = {
    filename?: string;
    label?: string;
    value?: string;
  };

  let { filename = "card.card", label = "Editor", value = $bindable("") }: Props = $props();

  let host = $state<HTMLDivElement | null>(null);
  let view = $state<EditorView | null>(null);

  const language = new Compartment();
  const readOnly = new Compartment();

  // Everything below resolves through the theme tokens, so the editor follows
  // the light/dark appearance instead of being a dark box in a light app.
  const panelTheme = EditorView.theme({
    "&": {
      backgroundColor: "transparent",
      color: "var(--foreground)",
      fontFamily: "var(--font-mono)",
      fontSize: "13px",
      height: "100%",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-mono)",
      lineHeight: "1.6",
    },
    ".cm-content": {
      padding: "12px 0",
      minHeight: "24rem",
      caretColor: "var(--foreground)",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      borderRight: "1px solid var(--border)",
      color: "var(--muted-foreground)",
      paddingRight: "4px",
    },
    ".cm-activeLine": {
      backgroundColor: "var(--code-active-line)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--code-active-line)",
      color: "var(--foreground)",
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
      backgroundColor: "var(--code-selection)",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--foreground)",
    },
    ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
      backgroundColor: "var(--code-selection)",
      outline: "none",
    },
  });

  const highlight = HighlightStyle.define([
    { tag: [tags.keyword, tags.tagName], color: "var(--code-keyword)" },
    { tag: [tags.string, tags.special(tags.string)], color: "var(--code-string)" },
    { tag: [tags.number, tags.bool, tags.null], color: "var(--code-number)" },
    { tag: [tags.attributeName, tags.propertyName], color: "var(--code-attribute)" },
    { tag: [tags.comment, tags.meta], color: "var(--code-comment)", fontStyle: "italic" },
    { tag: [tags.punctuation, tags.bracket, tags.angleBracket], color: "var(--code-punctuation)" },
    { tag: tags.invalid, color: "var(--destructive)" },
  ]);

  function languageFor(source: string): Extension {
    return source.trim().startsWith("<") ? html() : json();
  }

  function updateDocument(nextValue: string): void {
    if (!view || nextValue === view.state.doc.toString()) {
      return;
    }
    const selection = view.state.selection.main;
    view.dispatch({
      changes: { from: 0, insert: nextValue, to: view.state.doc.length },
      effects: language.reconfigure(languageFor(nextValue)),
      selection: EditorSelection.single(
        Math.min(selection.head, nextValue.length),
        Math.min(selection.anchor, nextValue.length),
      ),
    });
  }

  onMount(() => {
    if (!host) {
      return;
    }

    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          panelTheme,
          syntaxHighlighting(highlight),
          EditorView.lineWrapping,
          language.of(languageFor(value)),
          readOnly.of(EditorState.readOnly.of(false)),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) {
              return;
            }
            value = update.state.doc.toString();
            view?.dispatch({
              effects: language.reconfigure(languageFor(value)),
            });
          }),
        ],
      }),
    });

    return () => {
      view?.destroy();
      view = null;
    };
  });

  $effect(() => {
    updateDocument(value);
  });
</script>

<Card.Root class="gap-0 py-0" size="sm">
  <Card.Header class="border-b py-3">
    <Card.Title level={2}>{label}</Card.Title>
    <Card.Description class="mt-0.5 font-mono text-[11px]">{filename}</Card.Description>
    <Card.Action>
      <StatusBadge tone="mono">{value.trim().startsWith("<") ? "MXML" : "JSON"}</StatusBadge>
    </Card.Action>
  </Card.Header>
  <Card.Content class="px-0">
    <div
      bind:this={host}
      class="min-h-[24rem] px-1 focus-within:ring-3 focus-within:ring-ring/50 focus-within:ring-inset"
    ></div>
  </Card.Content>
</Card.Root>
