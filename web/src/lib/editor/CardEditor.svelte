<script lang="ts">
  import { html } from "@codemirror/lang-html";
  import { json } from "@codemirror/lang-json";
  import { Compartment, EditorSelection, EditorState, type Extension } from "@codemirror/state";
  import { oneDark } from "@codemirror/theme-one-dark";
  import { EditorView } from "@codemirror/view";
  import { basicSetup } from "codemirror";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import { onMount } from "svelte";

  type Props = {
    filename?: string;
    label?: string;
    value?: string;
  };

  let {
    filename = "card.card",
    label = "Editor",
    value = $bindable("")
  }: Props = $props();

  let host = $state<HTMLDivElement | null>(null);
  let view = $state<EditorView | null>(null);

  const language = new Compartment();
  const readOnly = new Compartment();

  const panelTheme = EditorView.theme({
    "&": {
      backgroundColor: "transparent",
      color: "#ecf4e7",
      fontFamily: "\"JetBrains Mono\", monospace",
      fontSize: "13px",
      height: "100%"
    },
    ".cm-content": {
      padding: "16px",
      minHeight: "26rem"
    },
    ".cm-gutters": {
      backgroundColor: "rgba(4, 6, 4, 0.72)",
      borderRight: "1px solid rgba(167, 243, 104, 0.08)",
      color: "#7f907d"
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(132, 204, 22, 0.08)"
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(132, 204, 22, 0.06)"
    },
    ".cm-selectionBackground": {
      backgroundColor: "rgba(245, 158, 11, 0.22) !important"
    }
  });

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
        Math.min(selection.anchor, nextValue.length)
      )
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
          oneDark,
          panelTheme,
          EditorView.lineWrapping,
          language.of(languageFor(value)),
          readOnly.of(EditorState.readOnly.of(false)),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) {
              return;
            }
            value = update.state.doc.toString();
            view?.dispatch({
              effects: language.reconfigure(languageFor(value))
            });
          })
        ]
      })
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

<Card.Root class="gap-0 overflow-hidden py-0" size="sm">
  <Card.Header class="flex-row items-start justify-between gap-3 border-b border-border/60 py-(--card-spacing)">
    <div>
      <Card.Title>{label}</Card.Title>
      <Card.Description class="mt-1 font-mono text-[11px]">{filename}</Card.Description>
    </div>
    <StatusBadge tone="success">{value.trim().startsWith("<") ? "Markup" : "JSON"}</StatusBadge>
  </Card.Header>
  <Card.Content class="px-0">
    <div
      bind:this={host}
      class="min-h-[28rem] bg-[linear-gradient(180deg,rgba(8,11,8,0.94),rgba(8,11,8,0.98))]"
    ></div>
  </Card.Content>
</Card.Root>
