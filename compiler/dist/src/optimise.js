import { normaliseColorLiteral, rgb565 } from "./colors.js";
import { evaluateExpression, isConstantExpression } from "./expr.js";
function foldValue(value) {
    if (!value.expr || !isConstantExpression(value.expr)) {
        return value;
    }
    const result = evaluateExpression(value.expr, {});
    return { value: result };
}
function foldNode(node) {
    if (node.kind === "group") {
        return {
            ...node,
            children: node.children.map(foldNode)
        };
    }
    switch (node.kind) {
        case "text":
            return {
                ...node,
                color: foldValue(node.color)
            };
        case "icon":
            return {
                ...node,
                color: node.color ? foldValue(node.color) : undefined
            };
        case "bar":
            return {
                ...node,
                bg: foldValue(node.bg),
                color: foldValue(node.color),
                max: foldValue(node.max),
                value: foldValue(node.value)
            };
        default:
            return {
                ...node,
                color: foldValue(node.color)
            };
    }
}
function collectLiteralColors(node, output) {
    if (node.kind === "group") {
        for (const child of node.children) {
            collectLiteralColors(child, output);
        }
        return;
    }
    const push = (value) => {
        if (value?.value) {
            output.push({ color: value.value, kind: node.kind });
        }
    };
    switch (node.kind) {
        case "bar":
            push(node.color);
            push(node.bg);
            break;
        case "icon":
            push(node.color);
            break;
        default:
            push(node.color);
            break;
    }
}
export function optimiseLayout(layout) {
    const diagnostics = [];
    const nodes = layout.nodes.map(foldNode);
    const colors = [];
    for (const node of nodes) {
        collectLiteralColors(node, colors);
    }
    const seen = new Map();
    for (const entry of colors) {
        try {
            const normalized = normaliseColorLiteral(entry.color);
            const reduced = rgb565(normalized);
            const previous = seen.get(reduced);
            if (previous && previous !== normalized) {
                diagnostics.push({
                    code: "color.rgb565-collapse",
                    message: `Colours ${previous} and ${normalized} collapse to the same RGB565 value`,
                    severity: "warning"
                });
            }
            else {
                seen.set(reduced, normalized);
            }
        }
        catch {
            diagnostics.push({
                code: "color.invalid",
                message: `Invalid colour literal '${entry.color}'`,
                severity: "error"
            });
        }
    }
    return {
        diagnostics,
        layout: {
            ...layout,
            nodes
        }
    };
}
//# sourceMappingURL=optimise.js.map