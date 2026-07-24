import { applyFilter } from "./filters.js";
export class ExprParseError extends Error {
    span;
    constructor(message, span) {
        super(message);
        this.name = "ExprParseError";
        this.span = span;
    }
}
function clonePosition(position) {
    return { column: position.column, line: position.line, offset: position.offset };
}
function makeSpan(start, end) {
    return { end: clonePosition(end), start: clonePosition(start) };
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
function tokenizeExpression(source, base) {
    const tokens = [];
    let position = base ? clonePosition(base) : { column: 1, line: 1, offset: 0 };
    let index = 0;
    const push = (kind, value) => {
        const start = clonePosition(position);
        position = advancePosition(position, value);
        tokens.push({ kind, span: makeSpan(start, position), value });
    };
    while (index < source.length) {
        const char = source[index];
        if (/\s/.test(char)) {
            push("operator", char);
            tokens.pop();
            index += 1;
            continue;
        }
        const two = source.slice(index, index + 2);
        if (["==", "!=", "<=", ">="].includes(two)) {
            push("operator", two);
            index += 2;
            continue;
        }
        if (["<", ">", "+", "-", "*", "/", "%"].includes(char)) {
            push("operator", char);
            index += 1;
            continue;
        }
        if (char === "(") {
            push("lparen", char);
            index += 1;
            continue;
        }
        if (char === ")") {
            push("rparen", char);
            index += 1;
            continue;
        }
        if (char === "?") {
            push("question", char);
            index += 1;
            continue;
        }
        if (char === ":") {
            push("colon", char);
            index += 1;
            continue;
        }
        if (char === ",") {
            push("comma", char);
            index += 1;
            continue;
        }
        if (char === "|") {
            push("pipe", char);
            index += 1;
            continue;
        }
        if (char === ".") {
            push("dot", char);
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
                throw new ExprParseError("Unterminated string literal", makeSpan(start, position));
            }
            tokens.push({
                kind: "string",
                span: makeSpan(start, position),
                value: raw.slice(1, -1)
            });
            continue;
        }
        if (/\d/.test(char)) {
            const start = clonePosition(position);
            let value = char;
            index += 1;
            position = advancePosition(position, char);
            while (index < source.length && /[\d.]/.test(source[index])) {
                value += source[index];
                position = advancePosition(position, source[index]);
                index += 1;
            }
            tokens.push({
                kind: "number",
                span: makeSpan(start, position),
                value
            });
            continue;
        }
        if (/[A-Za-z_]/.test(char)) {
            const start = clonePosition(position);
            let value = char;
            index += 1;
            position = advancePosition(position, char);
            while (index < source.length && /[A-Za-z0-9_]/.test(source[index])) {
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
        throw new ExprParseError(`Unexpected token '${char}'`, makeSpan(position, advancePosition(position, char)));
    }
    tokens.push({
        kind: "eof",
        span: makeSpan(position, position),
        value: ""
    });
    return tokens;
}
class Parser {
    tokens;
    index = 0;
    constructor(tokens) {
        this.tokens = tokens;
    }
    parse() {
        const expr = this.parseTernary();
        this.expect("eof");
        return expr;
    }
    current() {
        return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1];
    }
    advance() {
        const token = this.current();
        this.index += 1;
        return token;
    }
    expect(kind, value) {
        const token = this.current();
        if (token.kind !== kind || (value !== undefined && token.value !== value)) {
            throw new ExprParseError(`Expected ${value ?? kind}`, token.span);
        }
        return this.advance();
    }
    match(kind, value) {
        const token = this.current();
        if (token.kind === kind && (value === undefined || token.value === value)) {
            return this.advance();
        }
        return null;
    }
    parseTernary() {
        const test = this.parseOr();
        if (!this.match("question")) {
            return test;
        }
        const consequent = this.parseTernary();
        this.expect("colon");
        const alternate = this.parseTernary();
        return {
            alternate,
            consequent,
            kind: "ternary",
            span: makeSpan(test.span.start, alternate.span.end),
            test
        };
    }
    parseOr() {
        let left = this.parseAnd();
        while (this.current().kind === "identifier" && this.current().value === "or") {
            this.advance();
            const right = this.parseAnd();
            left = {
                kind: "binary",
                left,
                op: "or",
                right,
                span: makeSpan(left.span.start, right.span.end)
            };
        }
        return left;
    }
    parseAnd() {
        let left = this.parseNot();
        while (this.current().kind === "identifier" && this.current().value === "and") {
            this.advance();
            const right = this.parseNot();
            left = {
                kind: "binary",
                left,
                op: "and",
                right,
                span: makeSpan(left.span.start, right.span.end)
            };
        }
        return left;
    }
    parseNot() {
        if (this.current().kind === "identifier" && this.current().value === "not") {
            const start = this.advance();
            const argument = this.parseNot();
            return {
                argument,
                kind: "unary",
                op: "not",
                span: makeSpan(start.span.start, argument.span.end)
            };
        }
        return this.parseCompare();
    }
    parseCompare() {
        let left = this.parseAdd();
        const token = this.current();
        if (token.kind === "operator" && ["==", "!=", "<", "<=", ">", ">="].includes(token.value)) {
            this.advance();
            const right = this.parseAdd();
            left = {
                kind: "binary",
                left,
                op: token.value,
                right,
                span: makeSpan(left.span.start, right.span.end)
            };
        }
        return left;
    }
    parseAdd() {
        let left = this.parseMul();
        while (this.current().kind === "operator" && ["+", "-"].includes(this.current().value)) {
            const token = this.advance();
            const right = this.parseMul();
            left = {
                kind: "binary",
                left,
                op: token.value,
                right,
                span: makeSpan(left.span.start, right.span.end)
            };
        }
        return left;
    }
    parseMul() {
        let left = this.parseUnary();
        while (this.current().kind === "operator" && ["*", "/", "%"].includes(this.current().value)) {
            const token = this.advance();
            const right = this.parseUnary();
            left = {
                kind: "binary",
                left,
                op: token.value,
                right,
                span: makeSpan(left.span.start, right.span.end)
            };
        }
        return left;
    }
    parseUnary() {
        if (this.current().kind === "operator" && this.current().value === "-") {
            const start = this.advance();
            const argument = this.parseUnary();
            return {
                argument,
                kind: "unary",
                op: "-",
                span: makeSpan(start.span.start, argument.span.end)
            };
        }
        return this.parsePostfix();
    }
    parsePostfix() {
        let input = this.parsePrimary();
        while (this.match("pipe")) {
            const name = this.expect("identifier");
            const args = [];
            if (this.match("lparen")) {
                if (!this.match("rparen")) {
                    do {
                        args.push(this.parseTernary());
                    } while (this.match("comma"));
                    this.expect("rparen");
                }
            }
            input = {
                args,
                input,
                kind: "filter",
                name: name.value,
                span: makeSpan(input.span.start, (args.at(-1) ?? name).span.end)
            };
        }
        return input;
    }
    parsePrimary() {
        const token = this.current();
        if (token.kind === "number") {
            this.advance();
            return {
                kind: "literal",
                span: token.span,
                value: token.value.includes(".") ? Number.parseFloat(token.value) : Number.parseInt(token.value, 10)
            };
        }
        if (token.kind === "string") {
            this.advance();
            return { kind: "literal", span: token.span, value: token.value };
        }
        if (token.kind === "identifier") {
            if (token.value === "true" || token.value === "false") {
                this.advance();
                return { kind: "literal", span: token.span, value: token.value === "true" };
            }
            if (token.value === "null") {
                this.advance();
                return { kind: "literal", span: token.span, value: null };
            }
            this.advance();
            const segments = [token.value];
            let end = token.span.end;
            while (this.match("dot")) {
                const next = this.expect("identifier");
                segments.push(next.value);
                end = next.span.end;
            }
            return {
                kind: "path",
                segments,
                span: makeSpan(token.span.start, end)
            };
        }
        if (this.match("lparen")) {
            const expr = this.parseTernary();
            this.expect("rparen");
            return expr;
        }
        throw new ExprParseError(`Unexpected ${token.kind}`, token.span);
    }
}
export function parseExpression(source, base) {
    const tokens = tokenizeExpression(source, base);
    return new Parser(tokens).parse();
}
function resolvePath(scope, path) {
    let current = scope;
    for (const segment of path) {
        if (typeof current !== "object" || current === null || !(segment in current)) {
            return undefined;
        }
        current = current[segment];
    }
    return current;
}
export function evaluateExpression(expr, scope) {
    switch (expr.kind) {
        case "literal":
            return expr.value;
        case "path":
            return resolvePath(scope, expr.segments);
        case "unary": {
            const value = evaluateExpression(expr.argument, scope);
            return expr.op === "-" ? -Number(value) : !Boolean(value);
        }
        case "binary": {
            const left = evaluateExpression(expr.left, scope);
            const right = evaluateExpression(expr.right, scope);
            switch (expr.op) {
                case "+":
                    return Number(left) + Number(right);
                case "-":
                    return Number(left) - Number(right);
                case "*":
                    return Number(left) * Number(right);
                case "/":
                    return Number(left) / Number(right);
                case "%":
                    return Number(left) % Number(right);
                case "==":
                    return left === right;
                case "!=":
                    return left !== right;
                case "<":
                    return Number(left) < Number(right);
                case "<=":
                    return Number(left) <= Number(right);
                case ">":
                    return Number(left) > Number(right);
                case ">=":
                    return Number(left) >= Number(right);
                case "and":
                    return Boolean(left) && Boolean(right);
                case "or":
                    return Boolean(left) || Boolean(right);
            }
        }
        case "filter": {
            const input = evaluateExpression(expr.input, scope);
            const args = expr.args.map((arg) => evaluateExpression(arg, scope));
            return applyFilter(expr.name, input, args);
        }
        case "ternary":
            return Boolean(evaluateExpression(expr.test, scope))
                ? evaluateExpression(expr.consequent, scope)
                : evaluateExpression(expr.alternate, scope);
        default: {
            const exhaustive = expr;
            return exhaustive;
        }
    }
}
export function collectPathReferences(expr) {
    const values = new Set();
    const visit = (node) => {
        switch (node.kind) {
            case "literal":
                return;
            case "path":
                values.add(node.segments.join("."));
                return;
            case "unary":
                visit(node.argument);
                return;
            case "binary":
                visit(node.left);
                visit(node.right);
                return;
            case "ternary":
                visit(node.test);
                visit(node.consequent);
                visit(node.alternate);
                return;
            case "filter":
                visit(node.input);
                for (const arg of node.args) {
                    visit(arg);
                }
                return;
            default: {
                const exhaustive = node;
                return exhaustive;
            }
        }
    };
    visit(expr);
    return [...values];
}
export function isConstantExpression(expr) {
    switch (expr.kind) {
        case "literal":
            return true;
        case "path":
            return false;
        case "unary":
            return isConstantExpression(expr.argument);
        case "binary":
            return isConstantExpression(expr.left) && isConstantExpression(expr.right);
        case "ternary":
            return isConstantExpression(expr.test) && isConstantExpression(expr.consequent) && isConstantExpression(expr.alternate);
        case "filter":
            return isConstantExpression(expr.input) && expr.args.every(isConstantExpression);
        default: {
            const exhaustive = expr;
            return exhaustive;
        }
    }
}
export function exprToString(expr) {
    switch (expr.kind) {
        case "literal":
            return expr.value === null ? "null" : JSON.stringify(expr.value);
        case "path":
            return expr.segments.join(".");
        case "unary":
            return `${expr.op} ${exprToString(expr.argument)}`;
        case "binary":
            return `${exprToString(expr.left)} ${expr.op} ${exprToString(expr.right)}`;
        case "ternary":
            return `${exprToString(expr.test)} ? ${exprToString(expr.consequent)} : ${exprToString(expr.alternate)}`;
        case "filter":
            return `${exprToString(expr.input)} | ${expr.name}${expr.args.length > 0 ? `(${expr.args.map(exprToString).join(", ")})` : ""}`;
        default: {
            const exhaustive = expr;
            return exhaustive;
        }
    }
}
//# sourceMappingURL=expr.js.map