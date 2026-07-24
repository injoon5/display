import { FONT_METRICS, estimateDynamicTextLength, measureText } from "./fonts.js";
import { inferExpressionType, typeName } from "./typecheck.js";
function literalValue(attrs, name) {
    const value = attrs[name];
    if (!value) {
        return null;
    }
    return value.kind === "literal" ? value.value : null;
}
function exprValue(attrs, name) {
    const value = attrs[name];
    if (!value) {
        return null;
    }
    return value.kind === "expression" ? value.expr : null;
}
function parseInteger(attrs, name, span, diagnostics, fallback) {
    const value = attrs[name];
    if (!value) {
        return fallback ?? null;
    }
    if (value.kind !== "literal") {
        diagnostics.push({
            code: "layout.literal-required",
            message: `Attribute '${name}' must be a literal in Stage 1`,
            severity: "error",
            span: value.span
        });
        return null;
    }
    const parsed = Number.parseInt(value.value, 10);
    if (Number.isNaN(parsed)) {
        diagnostics.push({
            code: "layout.invalid-int",
            message: `Attribute '${name}' must be an integer`,
            severity: "error",
            span
        });
        return null;
    }
    return parsed;
}
export function parseDuration(value) {
    const match = value.trim().match(/^(\d+)(ms|s|m|h)$/);
    if (!match) {
        return null;
    }
    const amount = Number.parseInt(match[1], 10);
    switch (match[2]) {
        case "ms":
            return amount;
        case "s":
            return amount * 1000;
        case "m":
            return amount * 60_000;
        case "h":
            return amount * 3_600_000;
        default:
            return null;
    }
}
function colorValue(attrs, name, fallback) {
    const literal = literalValue(attrs, name);
    if (literal) {
        return { value: literal };
    }
    const expr = exprValue(attrs, name);
    return expr ? { expr } : { value: fallback };
}
function numberValue(attrs, name, fallback) {
    const literal = literalValue(attrs, name);
    if (literal !== null) {
        return { value: Number(literal) };
    }
    const expr = exprValue(attrs, name);
    return expr ? { expr } : { value: fallback };
}
function estimatedTemplateText(parts, font, typeContext) {
    let width = 0;
    const height = FONT_METRICS[font]?.glyphHeight ?? 7;
    for (const part of parts) {
        if (part.kind === "literal") {
            width += measureText(font, part.value).width;
            continue;
        }
        const type = inferExpressionType(part.expr, typeContext);
        width += estimateDynamicTextLength(typeName(type)) * (FONT_METRICS[font]?.advance ?? 6);
    }
    return { h: height, w: width };
}
function layoutNode(node, diagnostics, typeContext) {
    if (node.tagName === "source" || node.tagName === "show" || node.tagName === "stale") {
        return [];
    }
    if (node.tagName === "row" || node.tagName === "col" || node.tagName === "box" || node.tagName === "spacer") {
        diagnostics.push({
            code: "layout.unsupported-container",
            message: `Stage 1 only supports absolute layout; <${node.tagName}> is not implemented`,
            severity: "error",
            span: node.span
        });
        return [];
    }
    if (node.tagName === "when") {
        return [
            {
                children: node.children.flatMap((child) => layoutNode(child, diagnostics, typeContext)),
                kind: "group",
                span: node.span,
                test: exprValue(node.attrs, "test") ?? undefined
            }
        ];
    }
    if (node.tagName === "blink") {
        const rateRaw = literalValue(node.attrs, "rate") ?? "600ms";
        const blinkRateMs = parseDuration(rateRaw);
        if (blinkRateMs === null) {
            diagnostics.push({
                code: "layout.invalid-duration",
                message: `Invalid blink rate '${rateRaw}'`,
                severity: "error",
                span: node.span
            });
        }
        return [
            {
                blinkRateMs: blinkRateMs ?? 600,
                children: node.children.flatMap((child) => layoutNode(child, diagnostics, typeContext)),
                kind: "group",
                span: node.span
            }
        ];
    }
    if (node.tagName === "text") {
        const x = parseInteger(node.attrs, "x", node.span, diagnostics);
        const y = parseInteger(node.attrs, "y", node.span, diagnostics);
        if (x === null || y === null) {
            return [];
        }
        return [
            {
                color: colorValue(node.attrs, "color", "#ffffff"),
                font: literalValue(node.attrs, "font") ?? "5x7",
                kind: "text",
                span: node.span,
                template: node.template,
                x,
                y
            }
        ];
    }
    if (node.tagName === "badge") {
        const x = parseInteger(node.attrs, "x", node.span, diagnostics);
        const y = parseInteger(node.attrs, "y", node.span, diagnostics);
        if (x === null || y === null) {
            return [];
        }
        const font = literalValue(node.attrs, "font") ?? "3x5";
        const pad = parseInteger(node.attrs, "pad", node.span, diagnostics, 1) ?? 1;
        const size = estimatedTemplateText(node.template ?? [], font, typeContext);
        return [
            {
                color: colorValue(node.attrs, "bg", "#000000"),
                h: size.h + pad * 2,
                kind: "frect",
                span: node.span,
                w: size.w + pad * 2,
                x,
                y
            },
            {
                color: colorValue(node.attrs, "fg", "#ffffff"),
                font,
                kind: "text",
                span: node.span,
                template: node.template ?? [],
                x: x + pad,
                y: y + pad
            }
        ];
    }
    if (node.tagName === "bar") {
        const x = parseInteger(node.attrs, "x", node.span, diagnostics);
        const y = parseInteger(node.attrs, "y", node.span, diagnostics);
        const w = parseInteger(node.attrs, "w", node.span, diagnostics);
        const h = parseInteger(node.attrs, "h", node.span, diagnostics);
        if (x === null || y === null || w === null || h === null) {
            return [];
        }
        return [
            {
                bg: colorValue(node.attrs, "bg", "#202020"),
                color: colorValue(node.attrs, "color", "#33cc66"),
                h,
                kind: "bar",
                max: numberValue(node.attrs, "max", 1),
                span: node.span,
                value: numberValue(node.attrs, "value", 0),
                w,
                x,
                y
            }
        ];
    }
    if (node.tagName === "icon") {
        const x = parseInteger(node.attrs, "x", node.span, diagnostics);
        const y = parseInteger(node.attrs, "y", node.span, diagnostics);
        if (x === null || y === null) {
            return [];
        }
        return [
            {
                asset: literalValue(node.attrs, "src") ?? "icon:missing",
                color: exprValue(node.attrs, "color") || literalValue(node.attrs, "color") ? colorValue(node.attrs, "color", "#ffffff") : undefined,
                kind: "icon",
                span: node.span,
                x,
                y
            }
        ];
    }
    const x = parseInteger(node.attrs, "x", node.span, diagnostics, node.tagName === "stroke" ? 0 : undefined);
    const y = parseInteger(node.attrs, "y", node.span, diagnostics, node.tagName === "stroke" ? 0 : undefined);
    if (x === null || y === null) {
        return [];
    }
    switch (node.tagName) {
        case "rect":
        case "frect":
        case "stroke": {
            const w = parseInteger(node.attrs, "w", node.span, diagnostics, node.tagName === "stroke" ? 64 : undefined);
            const h = parseInteger(node.attrs, "h", node.span, diagnostics, node.tagName === "stroke" ? 32 : undefined);
            if (w === null || h === null) {
                return [];
            }
            return [{ color: colorValue(node.attrs, "color", "#ffffff"), h, kind: node.tagName, span: node.span, w, x, y }];
        }
        case "line": {
            const x2 = parseInteger(node.attrs, "x2", node.span, diagnostics);
            const y2 = parseInteger(node.attrs, "y2", node.span, diagnostics);
            if (x2 === null || y2 === null) {
                return [];
            }
            return [{ color: colorValue(node.attrs, "color", "#ffffff"), h: 0, kind: "line", span: node.span, w: 0, x, x2, y, y2 }];
        }
        case "pixel":
            return [{ color: colorValue(node.attrs, "color", "#ffffff"), h: 1, kind: "pixel", span: node.span, w: 1, x, y }];
        default:
            return [];
    }
}
export function layoutCard(card, typeContext) {
    const diagnostics = [];
    const nodes = card.children.flatMap((child) => layoutNode(child, diagnostics, typeContext));
    const show = exprValue(card.children.find((child) => child.tagName === "show")?.attrs ?? {}, "when") ?? undefined;
    const staleNode = card.children.find((child) => child.tagName === "stale");
    let stale;
    if (staleNode) {
        const after = literalValue(staleNode.attrs, "after");
        const afterMs = after ? parseDuration(after) : null;
        if (afterMs === null) {
            diagnostics.push({
                code: "layout.invalid-stale",
                message: "Invalid <stale after> duration",
                severity: "error",
                span: staleNode.span
            });
        }
        else {
            stale = { afterMs, style: literalValue(staleNode.attrs, "style") ?? "dim" };
        }
    }
    return { diagnostics, nodes, show, stale };
}
//# sourceMappingURL=layout.js.map