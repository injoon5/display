import { ZodBoolean, ZodNullable, ZodNumber, ZodObject, ZodOptional, ZodString } from "zod";
import { ambientScopeSchema, sourcePlugins } from "./sources/index.js";
function attributeLiteral(attrs, name) {
    const value = attrs[name];
    if (!value) {
        return null;
    }
    if (value.kind !== "literal") {
        return null;
    }
    return value.value;
}
function typeFromSchema(schema) {
    if (schema instanceof ZodOptional || schema instanceof ZodNullable) {
        const inner = typeFromSchema(schema.unwrap());
        return { ...inner, nullable: true };
    }
    if (schema instanceof ZodObject) {
        const fields = {};
        for (const [key, value] of Object.entries(schema.shape)) {
            fields[key] = typeFromSchema(value);
        }
        return { fields, kind: "object", nullable: false };
    }
    if (schema instanceof ZodNumber) {
        const checks = schema.safeParse(1.5).success;
        return { kind: checks ? "float" : "int", nullable: false };
    }
    if (schema instanceof ZodString) {
        return { kind: "string", nullable: false };
    }
    if (schema instanceof ZodBoolean) {
        return { kind: "bool", nullable: false };
    }
    return { kind: "unknown", nullable: false };
}
function rootAmbientType() {
    return typeFromSchema(ambientScopeSchema);
}
function rootSourceType(kind) {
    const plugin = sourcePlugins[kind];
    if (!plugin) {
        return null;
    }
    return typeFromSchema(plugin.schema);
}
function levenshtein(a, b) {
    const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i += 1) {
        matrix[i][0] = i;
    }
    for (let j = 0; j <= b.length; j += 1) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
        }
    }
    return matrix[a.length][b.length];
}
function nearest(value, candidates) {
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
        const score = levenshtein(value, candidate);
        if (score < bestScore) {
            best = candidate;
            bestScore = score;
        }
    }
    return bestScore <= 3 ? best : null;
}
export function resolveCard(card) {
    const diagnostics = [];
    const sources = [];
    const sourceKinds = new Map();
    for (const child of card.children) {
        if (child.tagName !== "source") {
            continue;
        }
        const id = attributeLiteral(child.attrs, "id");
        const kind = attributeLiteral(child.attrs, "kind");
        if (!id || !kind) {
            diagnostics.push({
                code: "source.invalid",
                message: "<source> requires literal id and kind attributes",
                severity: "error",
                span: child.span
            });
            continue;
        }
        if (!sourcePlugins[kind]) {
            diagnostics.push({
                code: "source.unknown-kind",
                hint: nearest(kind, Object.keys(sourcePlugins)) ?? undefined,
                message: `Unknown source kind '${kind}'`,
                severity: "error",
                span: child.span
            });
            continue;
        }
        sourceKinds.set(id, kind);
        const attrs = {};
        for (const [key, value] of Object.entries(child.attrs)) {
            if (value.kind === "literal") {
                attrs[key] = value.value;
            }
        }
        sources.push({ attrs, id, kind, span: child.span });
    }
    return { diagnostics, sourceKinds, sources };
}
export function resolvePathType(path, context, span) {
    const ambient = rootAmbientType();
    let type;
    let fields = [];
    if (context.sourceKinds.has(path[0])) {
        const sourceKind = context.sourceKinds.get(path[0]);
        const sourceType = sourceKind ? rootSourceType(sourceKind) : null;
        if (!sourceType) {
            return null;
        }
        type = sourceType;
        fields = Object.keys(type.fields ?? {});
        for (const segment of path.slice(1)) {
            if (!type.fields?.[segment]) {
                const hint = nearest(segment, fields);
                context.diagnostics.push({
                    code: "path.unknown-field",
                    hint: hint ? `Did you mean '${hint}'?` : undefined,
                    message: `Unknown field '${segment}' on source '${path[0]}'`,
                    severity: "error",
                    span
                });
                return null;
            }
            type = type.fields[segment];
            fields = Object.keys(type.fields ?? {});
        }
        return type;
    }
    type = ambient;
    fields = Object.keys(type.fields ?? {});
    for (const segment of path) {
        if (!type.fields?.[segment]) {
            const sourceHint = nearest(segment, [...context.sourceKinds.keys(), ...fields]);
            context.diagnostics.push({
                code: "path.unknown-root",
                hint: sourceHint ? `Did you mean '${sourceHint}'?` : undefined,
                message: `Unknown path '${path.join(".")}'`,
                severity: "error",
                span
            });
            return null;
        }
        type = type.fields[segment];
        fields = Object.keys(type.fields ?? {});
    }
    return type;
}
//# sourceMappingURL=resolve.js.map