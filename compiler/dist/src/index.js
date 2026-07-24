import { emitProgram } from "./emit.js";
import { parseExpression } from "./expr.js";
import { layoutCard } from "./layout.js";
import { optimiseLayout } from "./optimise.js";
import { parseMxml } from "./parse.js";
import { estimateAmps } from "./power.js";
import { resolveCard } from "./resolve.js";
import { typecheckCard } from "./typecheck.js";
import { validateLayout } from "./validate.js";
export { rgb565 } from "./colors.js";
export { collectPathReferences, evaluateExpression, exprToString, isConstantExpression, parseExpression } from "./expr.js";
function startPosition() {
    return { column: 1, line: 1, offset: 0 };
}
function span() {
    const start = startPosition();
    return { end: { ...start }, start };
}
function diagnostic(message, code, severity = "error") {
    return { code, message, severity };
}
function dedupeDiagnostics(input) {
    const seen = new Set();
    const output = [];
    for (const entry of input) {
        const key = `${entry.code}:${entry.message}:${entry.span?.start.offset ?? -1}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        output.push(entry);
    }
    return output;
}
function emptyResolve() {
    return {
        diagnostics: [],
        sourceKinds: new Map(),
        sources: []
    };
}
function fallbackResult(diagnostics, sources = []) {
    const context = {
        diagnostics: [],
        resolve: emptyResolve()
    };
    const result = emitProgram({ diagnostics: [], nodes: [] }, context, 0.12, dedupeDiagnostics(diagnostics));
    return { ...result, diagnostics: dedupeDiagnostics(diagnostics), sources };
}
function parseJsonCard(source) {
    const value = typeof source === "string" ? JSON.parse(source) : source;
    if (typeof value !== "object" || value === null) {
        throw new Error("Stage 0 input must be an object");
    }
    const record = value;
    if (typeof record.id !== "string" || !Array.isArray(record.elements)) {
        throw new Error("Stage 0 card must have string id and elements[]");
    }
    return record;
}
function pathTemplate(path) {
    return [{ expr: parseExpression(path, startPosition()), kind: "expression", span: span() }];
}
function stage0Node(element) {
    const op = String(element.op);
    switch (op) {
        case "text":
            return [
                {
                    color: { value: String(element.color ?? "#ffffff") },
                    font: String(element.font ?? "5x7"),
                    kind: "text",
                    span: span(),
                    template: typeof element.value === "string"
                        ? [{ kind: "literal", span: span(), value: String(element.value) }]
                        : pathTemplate(String(element.bind)),
                    x: Number(element.x ?? 0),
                    y: Number(element.y ?? 0)
                }
            ];
        case "rect":
        case "frect":
        case "stroke":
            return [
                {
                    color: { value: String(element.color ?? "#ffffff") },
                    h: Number(element.h ?? (op === "stroke" ? 32 : 0)),
                    kind: op,
                    span: span(),
                    w: Number(element.w ?? (op === "stroke" ? 64 : 0)),
                    x: Number(element.x ?? 0),
                    y: Number(element.y ?? 0)
                }
            ];
        case "line":
            return [
                {
                    color: { value: String(element.color ?? "#ffffff") },
                    h: 0,
                    kind: "line",
                    span: span(),
                    w: 0,
                    x: Number(element.x1 ?? 0),
                    x2: Number(element.x2 ?? 0),
                    y: Number(element.y1 ?? 0),
                    y2: Number(element.y2 ?? 0)
                }
            ];
        case "pixel":
            return [
                {
                    color: { value: String(element.color ?? "#ffffff") },
                    h: 1,
                    kind: "pixel",
                    span: span(),
                    w: 1,
                    x: Number(element.x ?? 0),
                    y: Number(element.y ?? 0)
                }
            ];
        case "icon":
            return [
                {
                    asset: String(element.src ?? "icon:missing"),
                    color: element.color ? { value: String(element.color) } : undefined,
                    kind: "icon",
                    span: span(),
                    x: Number(element.x ?? 0),
                    y: Number(element.y ?? 0)
                }
            ];
        case "bar":
            return [
                {
                    bg: { value: String(element.bg ?? "#202020") },
                    color: { value: String(element.color ?? "#33cc66") },
                    h: Number(element.h ?? 0),
                    kind: "bar",
                    max: typeof element.max === "number" ? { value: element.max } : { expr: parseExpression(String(element.max ?? 1), startPosition()) },
                    span: span(),
                    value: typeof element.value === "number"
                        ? { value: element.value }
                        : element.bind
                            ? { expr: parseExpression(String(element.bind), startPosition()) }
                            : { value: 0 },
                    w: Number(element.w ?? 0),
                    x: Number(element.x ?? 0),
                    y: Number(element.y ?? 0)
                }
            ];
        case "badge":
            return [
                {
                    color: { value: String(element.bg ?? "#000000") },
                    h: 7,
                    kind: "frect",
                    span: span(),
                    w: 16,
                    x: Number(element.x ?? 0),
                    y: Number(element.y ?? 0)
                },
                {
                    color: { value: String(element.fg ?? "#ffffff") },
                    font: String(element.font ?? "3x5"),
                    kind: "text",
                    span: span(),
                    template: typeof element.value === "string"
                        ? [{ kind: "literal", span: span(), value: String(element.value) }]
                        : pathTemplate(String(element.bind)),
                    x: Number(element.x ?? 0) + 1,
                    y: Number(element.y ?? 0) + 1
                }
            ];
        default:
            throw new Error(`Unsupported Stage 0 op '${op}'`);
    }
}
function stage0Resolve(nodes) {
    const sources = new Map();
    const visit = (node) => {
        if (node.kind === "group") {
            for (const child of node.children) {
                visit(child);
            }
            return;
        }
        if (node.kind === "text") {
            for (const part of node.template) {
                if (part.kind !== "expression") {
                    continue;
                }
                for (const path of [part.expr.kind === "path" ? part.expr.segments.join(".") : null]) {
                    if (!path) {
                        continue;
                    }
                    const root = path.split(".")[0];
                    sources.set(root, { attrs: {}, id: root, kind: `stage0.${root}`, span: part.span });
                }
            }
            return;
        }
        if (node.kind === "bar" && node.value.expr && node.value.expr.kind === "path") {
            const root = node.value.expr.segments[0];
            sources.set(root, { attrs: {}, id: root, kind: `stage0.${root}`, span: node.span });
        }
    };
    nodes.forEach(visit);
    return {
        diagnostics: [],
        sourceKinds: new Map([...sources.keys()].map((id) => [id, `stage0.${id}`])),
        sources: [...sources.values()]
    };
}
function finalise(layout, context, diagnostics) {
    const optimised = optimiseLayout(layout);
    const amps = estimateAmps(optimised.layout);
    const validation = validateLayout(optimised.layout, 0);
    const allDiagnostics = dedupeDiagnostics([...diagnostics, ...optimised.diagnostics, ...validation]);
    const emitted = emitProgram(optimised.layout, context, amps, allDiagnostics);
    const slotDiagnostics = emitted.slotMap.length > 255
        ? [
            {
                code: "slot.overflow",
                message: `slot count ${emitted.slotMap.length} exceeds 255`,
                severity: "error"
            }
        ]
        : [];
    return {
        ...emitted,
        diagnostics: dedupeDiagnostics([...emitted.diagnostics, ...slotDiagnostics])
    };
}
export function compileJson(source, _options) {
    try {
        const card = parseJsonCard(source);
        const nodes = card.elements.flatMap((element) => stage0Node(element));
        const resolve = stage0Resolve(nodes);
        const context = {
            diagnostics: [],
            resolve
        };
        const layout = { diagnostics: [], nodes };
        return finalise(layout, context, []);
    }
    catch (error) {
        return fallbackResult([diagnostic(error instanceof Error ? error.message : String(error), "stage0.parse")]);
    }
}
export function compileMxml(source, _options) {
    try {
        const card = parseMxml(source);
        const resolve = resolveCard(card);
        const typedDiagnostics = typecheckCard(card, resolve);
        const typeContext = {
            diagnostics: [],
            resolve
        };
        const layout = layoutCard(card, typeContext);
        return finalise(layout, typeContext, typedDiagnostics);
    }
    catch (error) {
        if (error instanceof Error && "span" in error) {
            return fallbackResult([
                {
                    code: "stage1.parse",
                    message: error.message,
                    severity: "error",
                    span: error.span
                }
            ]);
        }
        return fallbackResult([diagnostic(error instanceof Error ? error.message : String(error), "stage1.parse")]);
    }
}
export function compile(source, options) {
    if (typeof source === "object") {
        return compileJson(source, options);
    }
    const trimmed = source.trim();
    if (trimmed.startsWith("<")) {
        return compileMxml(source, options);
    }
    return compileJson(source, options);
}
//# sourceMappingURL=index.js.map