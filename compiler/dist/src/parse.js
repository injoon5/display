import { lexMarkup } from "./lex.js";
import { ExprParseError, parseExpression } from "./expr.js";
export class MarkupParseError extends Error {
    span;
    constructor(message, span) {
        super(message);
        this.name = "MarkupParseError";
        this.span = span;
    }
}
function clonePosition(position) {
    return { column: position.column, line: position.line, offset: position.offset };
}
function advancePosition(position, value) {
    const next = clonePosition(position);
    for (const char of value) {
        next.offset += 1;
        if (char === "\n") {
            next.line += 1;
            next.column = 1;
        }
        else {
            next.column += 1;
        }
    }
    return next;
}
function makeSpan(start, end) {
    return { end: clonePosition(end), start: clonePosition(start) };
}
function parseAttributeValue(token) {
    const trimmed = token.value.trim();
    if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) {
        const inner = trimmed.slice(2, -2).trim();
        const prefixIndex = token.value.indexOf("{{");
        const base = advancePosition(token.span.start, token.value.slice(0, prefixIndex + 2));
        const expr = parseExpression(inner, base);
        return { expr, kind: "expression", span: token.span };
    }
    return { kind: "literal", span: token.span, value: token.value };
}
function parseTemplate(text, span) {
    const parts = [];
    let cursor = 0;
    let position = clonePosition(span.start);
    while (cursor < text.length) {
        const start = text.indexOf("{{", cursor);
        if (start < 0) {
            const chunk = text.slice(cursor);
            const startPos = clonePosition(position);
            position = advancePosition(position, chunk);
            if (chunk.length > 0) {
                parts.push({
                    kind: "literal",
                    span: makeSpan(startPos, position),
                    value: chunk
                });
            }
            break;
        }
        const literal = text.slice(cursor, start);
        if (literal.length > 0) {
            const startPos = clonePosition(position);
            position = advancePosition(position, literal);
            parts.push({
                kind: "literal",
                span: makeSpan(startPos, position),
                value: literal
            });
        }
        const end = text.indexOf("}}", start + 2);
        if (end < 0) {
            throw new MarkupParseError("Unterminated interpolation", span);
        }
        const raw = text.slice(start, end + 2);
        const startPos = clonePosition(position);
        const exprBase = advancePosition(position, "{{");
        const inner = text.slice(start + 2, end).trim();
        const leadingWhitespace = text.slice(start + 2, end).match(/^\s*/)?.[0] ?? "";
        const expr = parseExpression(inner, advancePosition(exprBase, leadingWhitespace));
        position = advancePosition(position, raw);
        parts.push({
            expr,
            kind: "expression",
            span: makeSpan(startPos, position)
        });
        cursor = end + 2;
    }
    return parts;
}
function trimTemplate(parts) {
    const next = [...parts];
    const first = next[0];
    if (first?.kind === "literal") {
        const value = first.value.replace(/^\s+/, "");
        if (value.length === 0) {
            next.shift();
        }
        else {
            next[0] = { ...first, value };
        }
    }
    const last = next.at(-1);
    if (last?.kind === "literal") {
        const value = last.value.replace(/\s+$/, "");
        if (value.length === 0) {
            next.pop();
        }
        else {
            next[next.length - 1] = { ...last, value };
        }
    }
    return next;
}
class Parser {
    tokens;
    index = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    parseDocument() {
        while (this.current().kind === "text" && this.current().value.trim() === "") {
            this.advance();
        }
        const node = this.parseElement();
        if (node.tagName !== "card") {
            throw new MarkupParseError("Root element must be <card>", node.span);
        }
        while (this.current().kind === "text" && this.current().value.trim() === "") {
            this.advance();
        }
        this.expect("eof");
        return node;
    }
    current() {
        return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1];
    }
    advance() {
        const token = this.current();
        this.index += 1;
        return token;
    }
    expect(kind) {
        const token = this.current();
        if (token.kind !== kind) {
            throw new MarkupParseError(`Expected ${kind}`, token.span);
        }
        return this.advance();
    }
    match(kind) {
        if (this.current().kind === kind) {
            return this.advance();
        }
        return null;
    }
    parseElement() {
        const open = this.expect("lt");
        const name = this.expect("identifier");
        const attrs = {};
        while (this.current().kind === "identifier") {
            const attrName = this.advance();
            this.expect("equals");
            const value = this.expect("string");
            attrs[attrName.value] = parseAttributeValue(value);
        }
        const selfClosing = this.match("slashGt");
        if (selfClosing) {
            return this.buildNode(name.value, attrs, [], open.span.start, selfClosing.span.end);
        }
        this.expect("gt");
        if (name.value === "text" || name.value === "badge") {
            const templateParts = [];
            while (!(this.current().kind === "ltSlash")) {
                if (this.current().kind === "lt") {
                    throw new MarkupParseError(`<${name.value}> cannot contain nested elements`, this.current().span);
                }
                const textToken = this.expect("text");
                const parsed = parseTemplate(textToken.value, textToken.span);
                templateParts.push(...parsed);
            }
            this.expect("ltSlash");
            const closeName = this.expect("identifier");
            if (closeName.value !== name.value) {
                throw new MarkupParseError(`Expected </${name.value}>`, closeName.span);
            }
            const end = this.expect("gt");
            return this.buildNode(name.value, attrs, [], open.span.start, end.span.end, trimTemplate(templateParts));
        }
        const children = [];
        while (!(this.current().kind === "ltSlash")) {
            if (this.current().kind === "text") {
                if (this.current().value.trim() !== "") {
                    throw new MarkupParseError("Unexpected text content", this.current().span);
                }
                this.advance();
                continue;
            }
            const child = this.parseElement();
            if (child.tagName === "card") {
                throw new MarkupParseError("Nested <card> elements are not allowed", child.span);
            }
            children.push(child);
        }
        this.expect("ltSlash");
        const closeName = this.expect("identifier");
        if (closeName.value !== name.value) {
            throw new MarkupParseError(`Expected </${name.value}>`, closeName.span);
        }
        const end = this.expect("gt");
        return this.buildNode(name.value, attrs, children, open.span.start, end.span.end);
    }
    buildNode(name, attrs, children, start, end, template) {
        const span = makeSpan(start, end);
        if (name === "source") {
            return { attrs, children: [], span, tagName: "source" };
        }
        if (name === "text") {
            return { attrs, children: [], span, tagName: "text", template: template ?? [] };
        }
        if (name === "card") {
            return { attrs, children, span, tagName: "card" };
        }
        const supported = new Set([
            "badge",
            "bar",
            "blink",
            "box",
            "col",
            "frect",
            "icon",
            "line",
            "pixel",
            "rect",
            "row",
            "show",
            "spacer",
            "stale",
            "stroke",
            "when"
        ]);
        if (!supported.has(name)) {
            throw new MarkupParseError(`Unsupported element <${name}>`, span);
        }
        return {
            attrs,
            children,
            span,
            tagName: name,
            template
        };
    }
}
export function parseMxml(source) {
    try {
        return new Parser(lexMarkup(source)).parseDocument();
    }
    catch (error) {
        if (error instanceof ExprParseError) {
            throw new MarkupParseError(error.message, error.span);
        }
        throw error;
    }
}
//# sourceMappingURL=parse.js.map