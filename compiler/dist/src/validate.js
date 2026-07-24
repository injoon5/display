import { measureText } from "./fonts.js";
import { CANVAS_HEIGHT, CANVAS_WIDTH, MAX_SLOT_COUNT } from "./types.js";
function overflowDiagnostics(message, span) {
    return {
        code: "layout.overflow",
        message,
        severity: "error",
        span
    };
}
function estimateTextBounds(node) {
    const text = node.template.map((part) => (part.kind === "literal" ? part.value : "000000")).join("");
    const measured = measureText(node.font, text);
    return { h: measured.height, w: measured.width };
}
function validateNode(node, diagnostics) {
    if (node.kind === "group") {
        for (const child of node.children) {
            validateNode(child, diagnostics);
        }
        return;
    }
    switch (node.kind) {
        case "text": {
            const { w, h } = estimateTextBounds(node);
            if (node.x < 0 || node.y < 0 || node.x + w > CANVAS_WIDTH || node.y + h > CANVAS_HEIGHT) {
                diagnostics.push(overflowDiagnostics(`text overflows ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`, node.span));
            }
            return;
        }
        case "icon":
            if (node.x < 0 || node.y < 0 || node.x + 8 > CANVAS_WIDTH || node.y + 8 > CANVAS_HEIGHT) {
                diagnostics.push(overflowDiagnostics(`icon overflows ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`, node.span));
            }
            return;
        case "line":
            if (node.x < 0 ||
                node.y < 0 ||
                (node.x2 ?? 0) < 0 ||
                (node.y2 ?? 0) < 0 ||
                node.x >= CANVAS_WIDTH ||
                node.y >= CANVAS_HEIGHT ||
                (node.x2 ?? 0) >= CANVAS_WIDTH ||
                (node.y2 ?? 0) >= CANVAS_HEIGHT) {
                diagnostics.push(overflowDiagnostics(`line overflows ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`, node.span));
            }
            return;
        default:
            if (node.x < 0 || node.y < 0 || node.x + node.w > CANVAS_WIDTH || node.y + node.h > CANVAS_HEIGHT) {
                diagnostics.push(overflowDiagnostics(`${node.kind} overflows ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`, node.span));
            }
    }
}
export function validateLayout(layout, slotCount) {
    const diagnostics = [...layout.diagnostics];
    for (const node of layout.nodes) {
        validateNode(node, diagnostics);
    }
    if (slotCount > MAX_SLOT_COUNT) {
        diagnostics.push({
            code: "slot.overflow",
            message: `slot count ${slotCount} exceeds ${MAX_SLOT_COUNT}`,
            severity: "error"
        });
    }
    return diagnostics;
}
//# sourceMappingURL=validate.js.map