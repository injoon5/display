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
export function lexMarkup(source) {
    const tokens = [];
    let index = 0;
    let position = { column: 1, line: 1, offset: 0 };
    let inTag = false;
    const push = (kind, value) => {
        const start = clonePosition(position);
        position = advancePosition(position, value);
        tokens.push({ kind, span: makeSpan(start, position), value });
    };
    while (index < source.length) {
        if (!inTag) {
            if (source.startsWith("<!--", index)) {
                const endIndex = source.indexOf("-->", index + 4);
                const chunk = endIndex >= 0 ? source.slice(index, endIndex + 3) : source.slice(index);
                position = advancePosition(position, chunk);
                index += chunk.length;
                continue;
            }
            if (source.startsWith("</", index)) {
                push("ltSlash", "</");
                index += 2;
                inTag = true;
                continue;
            }
            if (source[index] === "<") {
                push("lt", "<");
                index += 1;
                inTag = true;
                continue;
            }
            const nextTag = source.indexOf("<", index);
            const text = nextTag >= 0 ? source.slice(index, nextTag) : source.slice(index);
            push("text", text);
            index += text.length;
            continue;
        }
        const char = source[index];
        if (/\s/.test(char)) {
            position = advancePosition(position, char);
            index += 1;
            continue;
        }
        if (source.startsWith("/>", index)) {
            push("slashGt", "/>");
            index += 2;
            inTag = false;
            continue;
        }
        if (char === ">") {
            push("gt", char);
            index += 1;
            inTag = false;
            continue;
        }
        if (char === "=") {
            push("equals", char);
            index += 1;
            continue;
        }
        if (char === "'" || char === "\"") {
            const quote = char;
            const start = clonePosition(position);
            let raw = quote;
            index += 1;
            position = advancePosition(position, quote);
            let closed = false;
            while (index < source.length) {
                const next = source[index];
                raw += next;
                index += 1;
                position = advancePosition(position, next);
                if (next === quote) {
                    closed = true;
                    break;
                }
            }
            if (!closed) {
                throw new Error(`Unterminated attribute string at ${start.line}:${start.column}`);
            }
            tokens.push({
                kind: "string",
                span: makeSpan(start, position),
                value: raw.slice(1, -1)
            });
            continue;
        }
        if (/[A-Za-z_]/.test(char)) {
            const start = clonePosition(position);
            let value = char;
            index += 1;
            position = advancePosition(position, char);
            while (index < source.length && /[A-Za-z0-9_.:-]/.test(source[index])) {
                value += source[index];
                position = advancePosition(position, source[index]);
                index += 1;
            }
            tokens.push({
                kind: "identifier",
                span: makeSpan(start, position),
                value
            });
            continue;
        }
        throw new Error(`Unexpected character '${char}' at ${position.line}:${position.column}`);
    }
    tokens.push({
        kind: "eof",
        span: makeSpan(position, position),
        value: ""
    });
    return tokens;
}
//# sourceMappingURL=lex.js.map