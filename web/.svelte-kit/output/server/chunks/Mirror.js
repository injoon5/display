import "./index-server.js";
import { C as escape_html, S as attr, i as derived, n as attr_style, r as bind_props, t as attr_class } from "./server.js";
import { ZodBoolean, ZodNullable, ZodNumber, ZodObject, ZodOptional, ZodString, z } from "zod";
//#region ../compiler/dist/src/colors.js
var NAMED_COLORS = {
	aqua: "#00ffff",
	black: "#000000",
	blue: "#0000ff",
	cyan: "#00ffff",
	fuchsia: "#ff00ff",
	gray: "#808080",
	green: "#008000",
	lime: "#00ff00",
	magenta: "#ff00ff",
	maroon: "#800000",
	navy: "#000080",
	olive: "#808000",
	purple: "#800080",
	red: "#ff0000",
	silver: "#c0c0c0",
	teal: "#008080",
	white: "#ffffff",
	yellow: "#ffff00"
};
function rgb565(input) {
	const rgb = typeof input === "string" ? parseColor(input) : input;
	return rgb.r >> 3 << 11 | rgb.g >> 2 << 5 | rgb.b >> 3;
}
function parseColor(value) {
	const normalized = value.trim().toLowerCase();
	const hex = NAMED_COLORS[normalized] ?? normalized;
	if (!hex.startsWith("#")) throw new Error(`Unsupported colour literal: ${value}`);
	if (hex.length === 4) return {
		r: Number.parseInt(hex[1] + hex[1], 16),
		g: Number.parseInt(hex[2] + hex[2], 16),
		b: Number.parseInt(hex[3] + hex[3], 16)
	};
	if (hex.length === 7) return {
		r: Number.parseInt(hex.slice(1, 3), 16),
		g: Number.parseInt(hex.slice(3, 5), 16),
		b: Number.parseInt(hex.slice(5, 7), 16)
	};
	throw new Error(`Unsupported colour literal: ${value}`);
}
function normaliseColorLiteral(value) {
	const { r, g, b } = parseColor(value);
	return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
//#endregion
//#region ../compiler/dist/src/filters.js
function formatDate(value) {
	const date = /* @__PURE__ */ new Date(value * 1e3);
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
function formatTime(value, withSeconds) {
	const date = /* @__PURE__ */ new Date(value * 1e3);
	const hh = String(date.getUTCHours()).padStart(2, "0");
	const mm = String(date.getUTCMinutes()).padStart(2, "0");
	if (!withSeconds) return `${hh}:${mm}`;
	return `${hh}:${mm}:${String(date.getUTCSeconds()).padStart(2, "0")}`;
}
function interpolateChannel(a, b, t) {
	return Math.round(a + (b - a) * t);
}
function colorScale(value, a, b, c) {
	const clamped = Math.max(0, Math.min(1, value));
	const left = parseColor(a);
	const middle = parseColor(b);
	if (!c) return normaliseColorLiteral(`#${interpolateChannel(left.r, middle.r, clamped).toString(16).padStart(2, "0")}${interpolateChannel(left.g, middle.g, clamped).toString(16).padStart(2, "0")}${interpolateChannel(left.b, middle.b, clamped).toString(16).padStart(2, "0")}`);
	const right = parseColor(c);
	const segment = clamped < .5 ? clamped * 2 : (clamped - .5) * 2;
	const start = clamped < .5 ? left : middle;
	const end = clamped < .5 ? middle : right;
	return normaliseColorLiteral(`#${interpolateChannel(start.r, end.r, segment).toString(16).padStart(2, "0")}${interpolateChannel(start.g, end.g, segment).toString(16).padStart(2, "0")}${interpolateChannel(start.b, end.b, segment).toString(16).padStart(2, "0")}`);
}
function applyFilter(name, input, args) {
	switch (name) {
		case "round": return Math.round(Number(input));
		case "floor": return Math.floor(Number(input));
		case "ceil": return Math.ceil(Number(input));
		case "abs": return Math.abs(Number(input));
		case "pad": return String(Math.trunc(Number(input))).padStart(Number(args[0] ?? 2), "0");
		case "comma": return Number(input).toLocaleString("en-US");
		case "fixed": return Number(input).toFixed(Number(args[0] ?? 0));
		case "upper": return String(input ?? "").toUpperCase();
		case "lower": return String(input ?? "").toLowerCase();
		case "trunc": {
			const max = Number(args[0] ?? 8);
			const text = String(input ?? "");
			return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
		}
		case "default": return input ?? args[0] ?? "";
		case "relative": return `${Math.abs(Math.round(Number(input)))}s`;
		case "duration": {
			const total = Math.abs(Math.round(Number(input)));
			const hours = Math.floor(total / 3600);
			const minutes = Math.floor(total % 3600 / 60);
			const seconds = total % 60;
			if (hours > 0) return `${hours}h ${minutes}m`;
			if (minutes > 0) return `${minutes}m ${seconds}s`;
			return `${seconds}s`;
		}
		case "hhmm": return formatTime(Number(input), false);
		case "hhmmss": return formatTime(Number(input), true);
		case "date": return formatDate(Number(input));
		case "color_scale": return colorScale(Number(input), String(args[0] ?? "#000000"), String(args[1] ?? "#ffffff"), args[2] ? String(args[2]) : void 0);
		case "map": {
			const [a, b, c, d] = args.map(Number);
			return c + (Number(input) - a) / (b - a) * (d - c);
		}
		case "clamp": {
			const lo = Number(args[0] ?? 0);
			const hi = Number(args[1] ?? 1);
			return Math.max(lo, Math.min(hi, Number(input)));
		}
		case "icon_for": return `icon:${String(input ?? "unknown")}`;
		default: throw new Error(`Unknown filter: ${name}`);
	}
}
//#endregion
//#region ../compiler/dist/src/expr.js
var ExprParseError = class extends Error {
	span;
	constructor(message, span) {
		super(message);
		this.name = "ExprParseError";
		this.span = span;
	}
};
function clonePosition$2(position) {
	return {
		column: position.column,
		line: position.line,
		offset: position.offset
	};
}
function makeSpan$2(start, end) {
	return {
		end: clonePosition$2(end),
		start: clonePosition$2(start)
	};
}
function advancePosition$2(position, value) {
	const next = clonePosition$2(position);
	for (const char of value) {
		next.offset += 1;
		if (char === "\n") {
			next.line += 1;
			next.column = 1;
		} else next.column += 1;
	}
	return next;
}
function tokenizeExpression(source, base) {
	const tokens = [];
	let position = base ? clonePosition$2(base) : {
		column: 1,
		line: 1,
		offset: 0
	};
	let index = 0;
	const push = (kind, value) => {
		const start = clonePosition$2(position);
		position = advancePosition$2(position, value);
		tokens.push({
			kind,
			span: makeSpan$2(start, position),
			value
		});
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
		if ([
			"==",
			"!=",
			"<=",
			">="
		].includes(two)) {
			push("operator", two);
			index += 2;
			continue;
		}
		if ([
			"<",
			">",
			"+",
			"-",
			"*",
			"/",
			"%"
		].includes(char)) {
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
			const start = clonePosition$2(position);
			let raw = quote;
			index += 1;
			position = advancePosition$2(position, quote);
			let closed = false;
			while (index < source.length) {
				const next = source[index];
				raw += next;
				index += 1;
				position = advancePosition$2(position, next);
				if (next === quote) {
					closed = true;
					break;
				}
			}
			if (!closed) throw new ExprParseError("Unterminated string literal", makeSpan$2(start, position));
			tokens.push({
				kind: "string",
				span: makeSpan$2(start, position),
				value: raw.slice(1, -1)
			});
			continue;
		}
		if (/\d/.test(char)) {
			const start = clonePosition$2(position);
			let value = char;
			index += 1;
			position = advancePosition$2(position, char);
			while (index < source.length && /[\d.]/.test(source[index])) {
				value += source[index];
				position = advancePosition$2(position, source[index]);
				index += 1;
			}
			tokens.push({
				kind: "number",
				span: makeSpan$2(start, position),
				value
			});
			continue;
		}
		if (/[A-Za-z_]/.test(char)) {
			const start = clonePosition$2(position);
			let value = char;
			index += 1;
			position = advancePosition$2(position, char);
			while (index < source.length && /[A-Za-z0-9_]/.test(source[index])) {
				value += source[index];
				position = advancePosition$2(position, source[index]);
				index += 1;
			}
			tokens.push({
				kind: "identifier",
				span: makeSpan$2(start, position),
				value
			});
			continue;
		}
		throw new ExprParseError(`Unexpected token '${char}'`, makeSpan$2(position, advancePosition$2(position, char)));
	}
	tokens.push({
		kind: "eof",
		span: makeSpan$2(position, position),
		value: ""
	});
	return tokens;
}
var Parser$1 = class {
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
		if (token.kind !== kind || value !== void 0 && token.value !== value) throw new ExprParseError(`Expected ${value ?? kind}`, token.span);
		return this.advance();
	}
	match(kind, value) {
		const token = this.current();
		if (token.kind === kind && (value === void 0 || token.value === value)) return this.advance();
		return null;
	}
	parseTernary() {
		const test = this.parseOr();
		if (!this.match("question")) return test;
		const consequent = this.parseTernary();
		this.expect("colon");
		const alternate = this.parseTernary();
		return {
			alternate,
			consequent,
			kind: "ternary",
			span: makeSpan$2(test.span.start, alternate.span.end),
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
				span: makeSpan$2(left.span.start, right.span.end)
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
				span: makeSpan$2(left.span.start, right.span.end)
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
				span: makeSpan$2(start.span.start, argument.span.end)
			};
		}
		return this.parseCompare();
	}
	parseCompare() {
		let left = this.parseAdd();
		const token = this.current();
		if (token.kind === "operator" && [
			"==",
			"!=",
			"<",
			"<=",
			">",
			">="
		].includes(token.value)) {
			this.advance();
			const right = this.parseAdd();
			left = {
				kind: "binary",
				left,
				op: token.value,
				right,
				span: makeSpan$2(left.span.start, right.span.end)
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
				span: makeSpan$2(left.span.start, right.span.end)
			};
		}
		return left;
	}
	parseMul() {
		let left = this.parseUnary();
		while (this.current().kind === "operator" && [
			"*",
			"/",
			"%"
		].includes(this.current().value)) {
			const token = this.advance();
			const right = this.parseUnary();
			left = {
				kind: "binary",
				left,
				op: token.value,
				right,
				span: makeSpan$2(left.span.start, right.span.end)
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
				span: makeSpan$2(start.span.start, argument.span.end)
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
					do
						args.push(this.parseTernary());
					while (this.match("comma"));
					this.expect("rparen");
				}
			}
			input = {
				args,
				input,
				kind: "filter",
				name: name.value,
				span: makeSpan$2(input.span.start, (args.at(-1) ?? name).span.end)
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
			return {
				kind: "literal",
				span: token.span,
				value: token.value
			};
		}
		if (token.kind === "identifier") {
			if (token.value === "true" || token.value === "false") {
				this.advance();
				return {
					kind: "literal",
					span: token.span,
					value: token.value === "true"
				};
			}
			if (token.value === "null") {
				this.advance();
				return {
					kind: "literal",
					span: token.span,
					value: null
				};
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
				span: makeSpan$2(token.span.start, end)
			};
		}
		if (this.match("lparen")) {
			const expr = this.parseTernary();
			this.expect("rparen");
			return expr;
		}
		throw new ExprParseError(`Unexpected ${token.kind}`, token.span);
	}
};
function parseExpression(source, base) {
	return new Parser$1(tokenizeExpression(source, base)).parse();
}
function resolvePath(scope, path) {
	let current = scope;
	for (const segment of path) {
		if (typeof current !== "object" || current === null || !(segment in current)) return;
		current = current[segment];
	}
	return current;
}
function evaluateExpression(expr, scope) {
	switch (expr.kind) {
		case "literal": return expr.value;
		case "path": return resolvePath(scope, expr.segments);
		case "unary": {
			const value = evaluateExpression(expr.argument, scope);
			return expr.op === "-" ? -Number(value) : !Boolean(value);
		}
		case "binary": {
			const left = evaluateExpression(expr.left, scope);
			const right = evaluateExpression(expr.right, scope);
			switch (expr.op) {
				case "+": return Number(left) + Number(right);
				case "-": return Number(left) - Number(right);
				case "*": return Number(left) * Number(right);
				case "/": return Number(left) / Number(right);
				case "%": return Number(left) % Number(right);
				case "==": return left === right;
				case "!=": return left !== right;
				case "<": return Number(left) < Number(right);
				case "<=": return Number(left) <= Number(right);
				case ">": return Number(left) > Number(right);
				case ">=": return Number(left) >= Number(right);
				case "and": return Boolean(left) && Boolean(right);
				case "or": return Boolean(left) || Boolean(right);
			}
		}
		case "filter": {
			const input = evaluateExpression(expr.input, scope);
			const args = expr.args.map((arg) => evaluateExpression(arg, scope));
			return applyFilter(expr.name, input, args);
		}
		case "ternary": return Boolean(evaluateExpression(expr.test, scope)) ? evaluateExpression(expr.consequent, scope) : evaluateExpression(expr.alternate, scope);
		default: return expr;
	}
}
function collectPathReferences(expr) {
	const values = /* @__PURE__ */ new Set();
	const visit = (node) => {
		switch (node.kind) {
			case "literal": return;
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
				for (const arg of node.args) visit(arg);
				return;
			default: return node;
		}
	};
	visit(expr);
	return [...values];
}
function isConstantExpression(expr) {
	switch (expr.kind) {
		case "literal": return true;
		case "path": return false;
		case "unary": return isConstantExpression(expr.argument);
		case "binary": return isConstantExpression(expr.left) && isConstantExpression(expr.right);
		case "ternary": return isConstantExpression(expr.test) && isConstantExpression(expr.consequent) && isConstantExpression(expr.alternate);
		case "filter": return isConstantExpression(expr.input) && expr.args.every(isConstantExpression);
		default: return expr;
	}
}
function exprToString(expr) {
	switch (expr.kind) {
		case "literal": return expr.value === null ? "null" : JSON.stringify(expr.value);
		case "path": return expr.segments.join(".");
		case "unary": return `${expr.op} ${exprToString(expr.argument)}`;
		case "binary": return `${exprToString(expr.left)} ${expr.op} ${exprToString(expr.right)}`;
		case "ternary": return `${exprToString(expr.test)} ? ${exprToString(expr.consequent)} : ${exprToString(expr.alternate)}`;
		case "filter": return `${exprToString(expr.input)} | ${expr.name}${expr.args.length > 0 ? `(${expr.args.map(exprToString).join(", ")})` : ""}`;
		default: return expr;
	}
}
//#endregion
//#region ../compiler/dist/src/fonts.js
var FONT_METRICS = {
	"3x5": {
		id: 0,
		name: "3x5",
		glyphWidth: 3,
		glyphHeight: 5,
		advance: 4
	},
	"5x7": {
		id: 1,
		name: "5x7",
		glyphWidth: 5,
		glyphHeight: 7,
		advance: 6
	},
	"8x16": {
		id: 2,
		name: "8x16",
		glyphWidth: 8,
		glyphHeight: 16,
		advance: 8
	},
	seg7: {
		id: 3,
		name: "seg7",
		glyphWidth: 12,
		glyphHeight: 20,
		advance: 12
	}
};
function fontId(name) {
	const metrics = FONT_METRICS[name];
	if (!metrics) throw new Error(`Unknown font: ${name}`);
	return metrics.id;
}
function measureText(fontName, value) {
	const metrics = FONT_METRICS[fontName];
	if (!metrics) throw new Error(`Unknown font: ${fontName}`);
	if (value.length === 0) return {
		width: 0,
		height: metrics.glyphHeight
	};
	return {
		width: value.length * metrics.advance - Math.max(0, metrics.advance - metrics.glyphWidth),
		height: metrics.glyphHeight
	};
}
function estimateDynamicTextLength(type) {
	switch (type) {
		case "bool": return 5;
		case "color": return 7;
		case "float": return 8;
		case "int": return 6;
		case "string": return 10;
		default: return 10;
	}
}
//#endregion
//#region ../compiler/dist/src/sources/ambient.js
var ambientScopeSchema = z.object({
	device: z.object({
		bed_occupied: z.boolean(),
		brightness: z.number().int(),
		lux: z.number().int(),
		online: z.boolean(),
		presence: z.boolean(),
		rssi: z.number().int(),
		uptime_s: z.number().int()
	}),
	now: z.object({
		day: z.number().int(),
		dow: z.number().int(),
		hour: z.number().int(),
		minute: z.number().int(),
		month: z.number().int(),
		second: z.number().int(),
		ts: z.number().int(),
		year: z.number().int()
	}),
	room: z.object({
		humidity: z.number(),
		temp_c: z.number()
	}),
	scene: z.string(),
	weekday: z.boolean(),
	weekend: z.boolean()
});
//#endregion
//#region ../compiler/dist/src/sources/airkorea.js
var airKoreaSchema = z.object({
	grade: z.number().int().min(1).max(4),
	pm10: z.number().int(),
	pm25: z.number().int()
});
//#endregion
//#region ../compiler/dist/src/sources/kma.now.js
var kmaNowSchema = z.object({
	condition: z.string(),
	feels_c: z.number(),
	icon: z.string(),
	temp_c: z.number()
});
//#endregion
//#region ../compiler/dist/src/sources/seoul.bus.js
var seoulBusSchema = z.object({
	crowding: z.number().int().min(0).max(3),
	eta_min: z.number().int(),
	next_eta_min: z.number().int().nullable(),
	plate: z.string().nullable().optional(),
	route: z.string()
});
//#endregion
//#region ../compiler/dist/src/sources/index.js
var sourcePlugins = {
	airkorea: {
		kind: "airkorea",
		schema: airKoreaSchema
	},
	"kma.now": {
		kind: "kma.now",
		schema: kmaNowSchema
	},
	"seoul.bus": {
		kind: "seoul.bus",
		schema: seoulBusSchema
	}
};
//#endregion
//#region ../compiler/dist/src/resolve.js
function attributeLiteral(attrs, name) {
	const value = attrs[name];
	if (!value) return null;
	if (value.kind !== "literal") return null;
	return value.value;
}
function typeFromSchema(schema) {
	if (schema instanceof ZodOptional || schema instanceof ZodNullable) return {
		...typeFromSchema(schema.unwrap()),
		nullable: true
	};
	if (schema instanceof ZodObject) {
		const fields = {};
		for (const [key, value] of Object.entries(schema.shape)) fields[key] = typeFromSchema(value);
		return {
			fields,
			kind: "object",
			nullable: false
		};
	}
	if (schema instanceof ZodNumber) return {
		kind: schema.safeParse(1.5).success ? "float" : "int",
		nullable: false
	};
	if (schema instanceof ZodString) return {
		kind: "string",
		nullable: false
	};
	if (schema instanceof ZodBoolean) return {
		kind: "bool",
		nullable: false
	};
	return {
		kind: "unknown",
		nullable: false
	};
}
function rootAmbientType() {
	return typeFromSchema(ambientScopeSchema);
}
function rootSourceType(kind) {
	const plugin = sourcePlugins[kind];
	if (!plugin) return null;
	return typeFromSchema(plugin.schema);
}
function levenshtein(a, b) {
	const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
	for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
	for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
	for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) {
		const cost = a[i - 1] === b[j - 1] ? 0 : 1;
		matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
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
function resolveCard(card) {
	const diagnostics = [];
	const sources = [];
	const sourceKinds = /* @__PURE__ */ new Map();
	for (const child of card.children) {
		if (child.tagName !== "source") continue;
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
				hint: nearest(kind, Object.keys(sourcePlugins)) ?? void 0,
				message: `Unknown source kind '${kind}'`,
				severity: "error",
				span: child.span
			});
			continue;
		}
		sourceKinds.set(id, kind);
		const attrs = {};
		for (const [key, value] of Object.entries(child.attrs)) if (value.kind === "literal") attrs[key] = value.value;
		sources.push({
			attrs,
			id,
			kind,
			span: child.span
		});
	}
	return {
		diagnostics,
		sourceKinds,
		sources
	};
}
function resolvePathType(path, context, span) {
	const ambient = rootAmbientType();
	let type;
	let fields = [];
	if (context.sourceKinds.has(path[0])) {
		const sourceKind = context.sourceKinds.get(path[0]);
		const sourceType = sourceKind ? rootSourceType(sourceKind) : null;
		if (!sourceType) return null;
		type = sourceType;
		fields = Object.keys(type.fields ?? {});
		for (const segment of path.slice(1)) {
			if (!type.fields?.[segment]) {
				const hint = nearest(segment, fields);
				context.diagnostics.push({
					code: "path.unknown-field",
					hint: hint ? `Did you mean '${hint}'?` : void 0,
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
				hint: sourceHint ? `Did you mean '${sourceHint}'?` : void 0,
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
//#endregion
//#region ../compiler/dist/src/typecheck.js
function typeName(type) {
	const base = type.kind;
	return type.nullable ? `${base}|null` : base;
}
function scalar(type) {
	return type.kind !== "object";
}
function literalType(value) {
	if (value === null) return {
		kind: "null",
		nullable: true
	};
	switch (typeof value) {
		case "boolean": return {
			kind: "bool",
			nullable: false
		};
		case "number": return {
			kind: Number.isInteger(value) ? "int" : "float",
			nullable: false
		};
		case "string": return {
			kind: value.startsWith("#") ? "color" : "string",
			nullable: false
		};
	}
}
function extractTruthyGuards(expr) {
	const guards = /* @__PURE__ */ new Set();
	if (expr.kind === "binary" && expr.op === "!=" && (expr.left.kind === "path" && expr.right.kind === "literal" && expr.right.value === null || expr.right.kind === "path" && expr.left.kind === "literal" && expr.left.value === null)) {
		const path = expr.left.kind === "path" ? expr.left : expr.right.kind === "path" ? expr.right : null;
		if (path) guards.add(path.segments.join("."));
	}
	return guards;
}
function isNumeric(type) {
	return type.kind === "float" || type.kind === "int";
}
function requireNonNull(type, diagnostics, message, code, span) {
	if (type.nullable) diagnostics.push({
		code,
		message,
		severity: "error",
		span
	});
}
function inferFilterType(name, input, argTypes) {
	switch (name) {
		case "round":
		case "floor":
		case "ceil":
		case "abs":
		case "map":
		case "clamp": return {
			kind: "float",
			nullable: false
		};
		case "pad":
		case "comma":
		case "fixed":
		case "upper":
		case "lower":
		case "trunc":
		case "relative":
		case "duration":
		case "hhmm":
		case "hhmmss":
		case "date":
		case "icon_for": return {
			kind: "string",
			nullable: false
		};
		case "color_scale": return {
			kind: "color",
			nullable: false
		};
		case "default": {
			const fallback = argTypes[0] ?? {
				kind: "unknown",
				nullable: false
			};
			if (input.kind === "null") return {
				...fallback,
				nullable: false
			};
			if (fallback.kind === input.kind || fallback.kind === "unknown") return {
				...input,
				nullable: false
			};
			return {
				kind: "unknown",
				nullable: false
			};
		}
		default: return {
			kind: "unknown",
			nullable: false
		};
	}
}
function inferExpressionType(expr, context, guards = /* @__PURE__ */ new Set()) {
	switch (expr.kind) {
		case "literal": return literalType(expr.value);
		case "path": {
			const resolved = resolvePathType(expr.segments, context.resolve, expr.span);
			if (!resolved) return {
				kind: "unknown",
				nullable: true
			};
			if (guards.has(expr.segments.join("."))) return {
				...resolved,
				nullable: false
			};
			return resolved;
		}
		case "unary": {
			const argument = inferExpressionType(expr.argument, context, guards);
			requireNonNull(argument, context.diagnostics, "unguarded nullable", "type.nullable", expr.argument.span);
			if (expr.op === "not") return {
				kind: "bool",
				nullable: false
			};
			return {
				kind: argument.kind === "int" ? "int" : "float",
				nullable: false
			};
		}
		case "binary": {
			const left = inferExpressionType(expr.left, context, guards);
			const right = inferExpressionType(expr.right, context, guards);
			if (["and", "or"].includes(expr.op)) {
				requireNonNull(left, context.diagnostics, "unguarded nullable", "type.nullable", expr.left.span);
				requireNonNull(right, context.diagnostics, "unguarded nullable", "type.nullable", expr.right.span);
				return {
					kind: "bool",
					nullable: false
				};
			}
			if ([
				"+",
				"-",
				"*",
				"/",
				"%"
			].includes(expr.op)) {
				requireNonNull(left, context.diagnostics, "unguarded nullable", "type.nullable", expr.left.span);
				requireNonNull(right, context.diagnostics, "unguarded nullable", "type.nullable", expr.right.span);
				if (!isNumeric(left) || !isNumeric(right)) context.diagnostics.push({
					code: "type.numeric",
					message: `Operator '${expr.op}' expects numeric operands`,
					severity: "error",
					span: expr.span
				});
				return {
					kind: left.kind === "int" && right.kind === "int" && expr.op !== "/" ? "int" : "float",
					nullable: false
				};
			}
			if (!(expr.left.kind === "literal" && expr.left.value === null || expr.right.kind === "literal" && expr.right.value === null)) {
				requireNonNull(left, context.diagnostics, "unguarded nullable", "type.nullable", expr.left.span);
				requireNonNull(right, context.diagnostics, "unguarded nullable", "type.nullable", expr.right.span);
			}
			return {
				kind: "bool",
				nullable: false
			};
		}
		case "ternary": {
			requireNonNull(inferExpressionType(expr.test, context, guards), context.diagnostics, "unguarded nullable", "type.nullable", expr.test.span);
			const guarded = new Set(guards);
			for (const guard of extractTruthyGuards(expr.test)) guarded.add(guard);
			const consequent = inferExpressionType(expr.consequent, context, guarded);
			const alternate = inferExpressionType(expr.alternate, context, guards);
			if (consequent.kind === alternate.kind) return {
				kind: consequent.kind,
				nullable: consequent.nullable || alternate.nullable
			};
			if (consequent.kind === "null") return {
				...alternate,
				nullable: true
			};
			if (alternate.kind === "null") return {
				...consequent,
				nullable: true
			};
			return {
				kind: "unknown",
				nullable: consequent.nullable || alternate.nullable
			};
		}
		case "filter": {
			const input = inferExpressionType(expr.input, context, guards);
			const args = expr.args.map((arg) => inferExpressionType(arg, context, guards));
			if (expr.name !== "default") requireNonNull(input, context.diagnostics, "unguarded nullable", "type.nullable", expr.input.span);
			return inferFilterType(expr.name, input, args);
		}
		default: return expr;
	}
}
function attributeExpr(attrs, name) {
	const value = attrs[name];
	return value?.kind === "expression" ? value.expr : null;
}
function checkScalarTemplate(parts, context, guards) {
	for (const part of parts) {
		if (part.kind !== "expression") continue;
		const type = inferExpressionType(part.expr, context, guards);
		if (!scalar(type)) context.diagnostics.push({
			code: "type.template-object",
			message: "Template expressions must resolve to a scalar value",
			severity: "error",
			span: part.span
		});
		if (type.nullable) context.diagnostics.push({
			code: "type.nullable-template",
			hint: "Add | default(...) or guard with <when test=\"{{ path != null }}\">.",
			message: "unguarded nullable",
			severity: "error",
			span: part.span
		});
	}
}
function checkNode(node, context, guards) {
	switch (node.tagName) {
		case "source": return;
		case "text":
			checkScalarTemplate(node.template, context, guards);
			break;
		case "badge":
			checkScalarTemplate(node.template ?? [], context, guards);
			break;
		case "show": {
			const expr = attributeExpr(node.attrs, "when");
			if (expr) inferExpressionType(expr, context, guards);
			break;
		}
		case "when": {
			const expr = attributeExpr(node.attrs, "test");
			if (expr) {
				inferExpressionType(expr, context, guards);
				const nextGuards = new Set(guards);
				for (const guard of extractTruthyGuards(expr)) nextGuards.add(guard);
				for (const child of node.children) checkNode(child, context, nextGuards);
				return;
			}
			break;
		}
		case "bar":
			for (const key of ["value", "max"]) {
				const expr = attributeExpr(node.attrs, key);
				if (expr) {
					if (!isNumeric(inferExpressionType(expr, context, guards))) context.diagnostics.push({
						code: "type.bar",
						message: `<bar ${key}> expects a numeric expression`,
						severity: "error",
						span: expr.span
					});
				}
			}
			break;
		default:
			for (const key of ["color", "bg"]) {
				const expr = attributeExpr(node.attrs, key);
				if (expr) inferExpressionType(expr, context, guards);
			}
			break;
	}
	if ("children" in node) for (const child of node.children) checkNode(child, context, guards);
}
function typecheckCard(card, resolve) {
	const context = {
		diagnostics: [...resolve.diagnostics],
		resolve
	};
	for (const child of card.children) checkNode(child, context, /* @__PURE__ */ new Set());
	return context.diagnostics;
}
//#endregion
//#region ../compiler/dist/src/emit.js
var HEADER_SIZE$1 = 84;
var VERSION = 1;
var OPCODES$1 = {
	BLINK: 96,
	BLIT: 48,
	BLITC: 49,
	FRECT: 16,
	HALT: 255,
	JMP: 64,
	JMPCMP: 66,
	JMPSTALE: 67,
	JMPZ: 65,
	LINE: 18,
	PIXEL: 19,
	POPDIM: 83,
	PUSHDIM: 82,
	RECT: 17,
	TEXT: 32
};
var ByteWriter = class {
	bytes = [];
	get length() {
		return this.bytes.length;
	}
	patchU16(offset, value) {
		this.bytes[offset] = value & 255;
		this.bytes[offset + 1] = value >> 8 & 255;
	}
	writeI32(value) {
		const view = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(4));
		view.setInt32(0, value, true);
		this.writeBytes(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
	}
	writeBytes(...values) {
		this.bytes.push(...values.map((value) => value & 255));
	}
	writeU16(value) {
		this.writeBytes(value & 255, value >> 8 & 255);
	}
	writeU32(value) {
		this.writeBytes(value & 255, value >> 8 & 255, value >> 16 & 255, value >> 24 & 255);
	}
	writeU8(value) {
		this.writeBytes(value);
	}
};
var SlotRegistry = class {
	byKey = /* @__PURE__ */ new Map();
	entries = [];
	get slotMap() {
		return this.entries;
	}
	firstSourceSlot(sourceId) {
		const entry = this.entries.find((candidate) => candidate.sourceId === sourceId);
		return entry ? entry.index : null;
	}
	reserveComputed(key, type, sourceId) {
		return this.reserve(`computed:${key}`, key, type, sourceId);
	}
	reservePath(path, type, sourceId) {
		return this.reserve(`path:${sourceId}:${path}`, path, type, sourceId);
	}
	reserve(key, path, type, sourceId) {
		const existing = this.byKey.get(key);
		if (existing !== void 0) return existing;
		const index = this.entries.length;
		this.byKey.set(key, index);
		this.entries.push({
			index,
			path,
			sourceId,
			type
		});
		return index;
	}
};
function utf8Bytes(value) {
	return new TextEncoder().encode(value);
}
function crc32(data) {
	let crc = 4294967295;
	for (const byte of data) {
		crc ^= byte;
		for (let i = 0; i < 8; i += 1) {
			const mask = -(crc & 1);
			crc = crc >>> 1 ^ 3988292384 & mask;
		}
	}
	return (crc ^ 4294967295) >>> 0;
}
function cmpCode(op) {
	switch (op) {
		case "==": return 0;
		case "!=": return 1;
		case "<": return 2;
		case "<=": return 3;
		case ">": return 4;
		case ">=": return 5;
		default: return op;
	}
}
function invertCmp(op) {
	switch (op) {
		case "==": return "!=";
		case "!=": return "==";
		case "<": return ">=";
		case "<=": return ">";
		case ">": return "<=";
		case ">=": return "<";
		default: return op;
	}
}
function simpleCondition(expr) {
	if (expr.kind === "path") return {
		kind: "slot",
		path: expr.segments.join(".")
	};
	if (expr.kind === "binary" && [
		"==",
		"!=",
		"<",
		"<=",
		">",
		">="
	].includes(expr.op) && expr.left.kind === "path" && expr.right.kind === "literal" && typeof expr.right.value !== "object") return {
		expr,
		kind: "cmp",
		op: expr.op,
		path: expr.left.segments.join("."),
		value: expr.right.value
	};
	return null;
}
function sourceIdForDeps(paths, context) {
	const roots = /* @__PURE__ */ new Set();
	for (const path of paths) {
		const root = path.split(".")[0];
		if (context.resolve.sourceKinds.has(root)) roots.add(root);
	}
	if (roots.size === 1) return [...roots][0] ?? "computed";
	return roots.size === 0 ? "ambient" : "computed";
}
function slotForExpr(expr, context, slots) {
	if (expr.kind === "path") {
		const root = expr.segments[0];
		const sourceId = context.resolve.sourceKinds.has(root) ? root : root;
		const type = context.resolve.sourceKinds.has(root) ? typeName(inferExpressionType(expr, context)) : "unknown";
		return slots.reservePath(expr.segments.join("."), type, sourceId);
	}
	const key = exprToString(expr);
	const type = inferExpressionType(expr, context);
	const deps = collectPathReferences(expr);
	return slots.reserveComputed(key, typeName(type), sourceIdForDeps(deps, context));
}
function templateKey(node) {
	return node.template.map((part) => part.kind === "literal" ? part.value : `{{${exprToString(part.expr)}}}`).join("");
}
function emitStringTable(strings) {
	const writer = new ByteWriter();
	writer.writeU16(strings.length);
	for (const value of strings) {
		const bytes = utf8Bytes(value);
		writer.writeU16(bytes.length);
		writer.writeBytes(...bytes);
	}
	return new Uint8Array(writer.bytes);
}
function ensureLiteralColor(value, diagnostics, span) {
	try {
		return rgb565(value);
	} catch {
		diagnostics.push({
			code: "emit.color",
			message: `Invalid colour '${value}'`,
			severity: "error",
			span
		});
		return rgb565("#ffffff");
	}
}
function simpleTemplateSlot(node, context, slots, intern) {
	const dynamicParts = node.template.filter((part) => part.kind === "expression");
	if (dynamicParts.length === 0) {
		const text = node.template.map((part) => part.kind === "literal" ? part.value : "").join("");
		return intern.get(text) ?? 0;
	}
	if (dynamicParts.length === 1 && node.template.length === 1 && dynamicParts[0]?.kind === "expression") return 128 | slotForExpr(dynamicParts[0].expr, context, slots);
	const key = `template:${templateKey(node)}`;
	return 128 | slots.reserveComputed(key, "string", sourceIdForDeps(dynamicParts.flatMap((part) => collectPathReferences(part.expr)), context));
}
function emitText(writer, node, context, slots, intern, diagnostics) {
	if (node.color.expr) {
		const expr = node.color.expr;
		if (expr.kind === "ternary" && expr.consequent.kind === "literal" && expr.alternate.kind === "literal" && typeof expr.consequent.value === "string" && typeof expr.alternate.value === "string") {
			const consequentColor = expr.consequent.value;
			const alternateColor = expr.alternate.value;
			emitConditional(writer, expr.test, context, slots, diagnostics, () => {
				emitText(writer, {
					...node,
					color: { value: consequentColor }
				}, context, slots, intern, diagnostics);
			}, () => {
				emitText(writer, {
					...node,
					color: { value: alternateColor }
				}, context, slots, intern, diagnostics);
			});
			return;
		}
		diagnostics.push({
			code: "emit.dynamic-color",
			message: "Only ternary literal colour expressions are supported in Stage 1",
			severity: "error",
			span: node.span
		});
	}
	const color = ensureLiteralColor(node.color.value ?? "#ffffff", diagnostics, node.span);
	const source = simpleTemplateSlot(node, context, slots, intern);
	writer.writeU8(OPCODES$1.TEXT);
	writer.writeU8(node.x);
	writer.writeU8(node.y);
	writer.writeU8(fontId(node.font));
	writer.writeU16(color);
	writer.writeU8(source);
}
function emitConditional(writer, expr, context, slots, diagnostics, consequent, alternate) {
	const condition = simpleCondition(expr);
	if (condition?.kind === "slot") {
		const slot = slots.reservePath(condition.path, "bool", context.resolve.sourceKinds.has(condition.path.split(".")[0]) ? condition.path.split(".")[0] : "ambient");
		writer.writeU8(OPCODES$1.JMPZ);
		writer.writeU8(slot);
		const jumpOffset = writer.length;
		writer.writeU16(0);
		consequent();
		if (alternate) {
			writer.writeU8(OPCODES$1.JMP);
			const endJump = writer.length;
			writer.writeU16(0);
			writer.patchU16(jumpOffset, writer.length);
			alternate();
			writer.patchU16(endJump, writer.length);
		} else writer.patchU16(jumpOffset, writer.length);
		return;
	}
	if (condition?.kind === "cmp" && typeof condition.value === "number") {
		const sourceId = context.resolve.sourceKinds.has(condition.path.split(".")[0]) ? condition.path.split(".")[0] : "ambient";
		const slot = slots.reservePath(condition.path, "int", sourceId);
		writer.writeU8(OPCODES$1.JMPCMP);
		writer.writeU8(slot);
		writer.writeU8(cmpCode(invertCmp(condition.op ?? "==")));
		writer.writeI32(Math.trunc(condition.value));
		const jumpOffset = writer.length;
		writer.writeU16(0);
		consequent();
		if (alternate) {
			writer.writeU8(OPCODES$1.JMP);
			const endJump = writer.length;
			writer.writeU16(0);
			writer.patchU16(jumpOffset, writer.length);
			alternate();
			writer.patchU16(endJump, writer.length);
		} else writer.patchU16(jumpOffset, writer.length);
		return;
	}
	const slot = slotForExpr(expr, context, slots);
	writer.writeU8(OPCODES$1.JMPZ);
	writer.writeU8(slot);
	const jumpOffset = writer.length;
	writer.writeU16(0);
	consequent();
	if (alternate) {
		writer.writeU8(OPCODES$1.JMP);
		const endJump = writer.length;
		writer.writeU16(0);
		writer.patchU16(jumpOffset, writer.length);
		alternate();
		writer.patchU16(endJump, writer.length);
	} else writer.patchU16(jumpOffset, writer.length);
}
function emitBar(writer, node, context, slots, diagnostics) {
	const bgColor = ensureLiteralColor(node.bg.value ?? "#202020", diagnostics, node.span);
	const fillColor = ensureLiteralColor(node.color.value ?? "#33cc66", diagnostics, node.span);
	writer.writeU8(OPCODES$1.FRECT);
	writer.writeU8(node.x);
	writer.writeU8(node.y);
	writer.writeU8(node.w);
	writer.writeU8(node.h);
	writer.writeU16(bgColor);
	if (node.value.value !== void 0 && node.max.value !== void 0) {
		const ratio = node.max.value === 0 ? 0 : Math.max(0, Math.min(1, node.value.value / node.max.value));
		const fillWidth = Math.round(node.w * ratio);
		writer.writeU8(OPCODES$1.FRECT);
		writer.writeU8(node.x);
		writer.writeU8(node.y);
		writer.writeU8(fillWidth);
		writer.writeU8(node.h);
		writer.writeU16(fillColor);
		return;
	}
	if (node.max.value === void 0 || !Number.isInteger(node.max.value) || node.max.value <= 0) {
		diagnostics.push({
			code: "emit.bar-max",
			message: "Dynamic <bar max> is not supported in Stage 1",
			severity: "error",
			span: node.span
		});
		return;
	}
	const valueExpr = node.value.expr;
	const slot = valueExpr ? slotForExpr(valueExpr, context, slots) : slots.reserveComputed(`bar:${node.x}:${node.y}`, "int", "computed");
	const checkJumps = [];
	const endJumps = [];
	for (let step = node.max.value; step >= 1; step -= 1) {
		writer.writeU8(OPCODES$1.JMPCMP);
		writer.writeU8(slot);
		writer.writeU8(cmpCode(">="));
		writer.writeI32(step);
		const jumpToFill = writer.length;
		writer.writeU16(0);
		checkJumps.push({
			offset: jumpToFill,
			step
		});
	}
	writer.writeU8(OPCODES$1.JMP);
	const emptyJump = writer.length;
	writer.writeU16(0);
	for (const check of checkJumps) {
		writer.patchU16(check.offset, writer.length);
		writer.writeU8(OPCODES$1.FRECT);
		writer.writeU8(node.x);
		writer.writeU8(node.y);
		writer.writeU8(Math.round(node.w * check.step / node.max.value));
		writer.writeU8(node.h);
		writer.writeU16(fillColor);
		writer.writeU8(OPCODES$1.JMP);
		endJumps.push(writer.length);
		writer.writeU16(0);
	}
	writer.patchU16(emptyJump, writer.length);
	for (const offset of endJumps) writer.patchU16(offset, writer.length);
}
function emitDrawNode(writer, node, context, slots, intern, diagnostics) {
	switch (node.kind) {
		case "text":
			emitText(writer, node, context, slots, intern, diagnostics);
			return;
		case "frect":
			writer.writeU8(OPCODES$1.FRECT);
			writer.writeU8(node.x);
			writer.writeU8(node.y);
			writer.writeU8(node.w);
			writer.writeU8(node.h);
			writer.writeU16(ensureLiteralColor(node.color.value ?? "#ffffff", diagnostics, node.span));
			return;
		case "rect":
		case "stroke":
			writer.writeU8(OPCODES$1.RECT);
			writer.writeU8(node.x);
			writer.writeU8(node.y);
			writer.writeU8(node.w);
			writer.writeU8(node.h);
			writer.writeU16(ensureLiteralColor(node.color.value ?? "#ffffff", diagnostics, node.span));
			return;
		case "pixel":
			writer.writeU8(OPCODES$1.PIXEL);
			writer.writeU8(node.x);
			writer.writeU8(node.y);
			writer.writeU16(ensureLiteralColor(node.color.value ?? "#ffffff", diagnostics, node.span));
			return;
		case "line":
			writer.writeU8(OPCODES$1.LINE);
			writer.writeU8(node.x);
			writer.writeU8(node.y);
			writer.writeU8(node.x2 ?? node.x);
			writer.writeU8(node.y2 ?? node.y);
			writer.writeU16(ensureLiteralColor(node.color.value ?? "#ffffff", diagnostics, node.span));
			return;
		case "icon": {
			const assetId = 0;
			if (node.color?.value) {
				writer.writeU8(OPCODES$1.BLITC);
				writer.writeU8(node.x);
				writer.writeU8(node.y);
				writer.writeU16(assetId);
				writer.writeU16(ensureLiteralColor(node.color.value, diagnostics, node.span));
			} else {
				writer.writeU8(OPCODES$1.BLIT);
				writer.writeU8(node.x);
				writer.writeU8(node.y);
				writer.writeU16(assetId);
			}
			return;
		}
		case "bar":
			emitBar(writer, node, context, slots, diagnostics);
			return;
		default: return node;
	}
}
function emitRenderNode(writer, node, context, slots, intern, diagnostics) {
	if (node.kind !== "group") {
		emitDrawNode(writer, node, context, slots, intern, diagnostics);
		return;
	}
	const emitChildren = () => {
		if (node.blinkRateMs !== void 0) {
			writer.writeU8(OPCODES$1.BLINK);
			writer.writeU16(node.blinkRateMs);
			writer.writeU8(128);
			const endOffset = writer.length;
			writer.writeU16(0);
			for (const child of node.children) emitRenderNode(writer, child, context, slots, intern, diagnostics);
			writer.patchU16(endOffset, writer.length);
			return;
		}
		for (const child of node.children) emitRenderNode(writer, child, context, slots, intern, diagnostics);
	};
	if (node.test) {
		emitConditional(writer, node.test, context, slots, diagnostics, emitChildren);
		return;
	}
	emitChildren();
}
function collectStaticStrings(nodes) {
	const values = /* @__PURE__ */ new Set();
	const visit = (node) => {
		if (node.kind === "group") {
			for (const child of node.children) visit(child);
			return;
		}
		if (node.kind === "text") {
			if (node.template.every((part) => part.kind === "literal")) values.add(node.template.map((part) => part.kind === "literal" ? part.value : "").join(""));
		}
	};
	for (const node of nodes) visit(node);
	return [...values];
}
function emitProgram(layout, context, estimatedAmps, diagnostics) {
	const slots = new SlotRegistry();
	const strings = collectStaticStrings(layout.nodes);
	const stringIndex = new Map(strings.map((value, index) => [value, index]));
	const code = new ByteWriter();
	const emitBody = () => {
		for (const node of layout.nodes) emitRenderNode(code, node, context, slots, stringIndex, diagnostics);
	};
	if (layout.show) emitConditional(code, layout.show, context, slots, diagnostics, () => {
		if (layout.stale && layout.stale.style === "dim") {
			const staleSource = context.resolve.sources[0]?.id;
			const staleSlot = staleSource ? slots.reserveComputed(`${staleSource}.$stale`, "int", staleSource) : null;
			if (staleSource && staleSlot !== null) {
				code.writeU8(OPCODES$1.JMPSTALE);
				code.writeU8(staleSlot);
				code.writeU16(layout.stale.afterMs);
				const staleJump = code.length;
				code.writeU16(0);
				emitBody();
				code.writeU8(OPCODES$1.JMP);
				const endJump = code.length;
				code.writeU16(0);
				code.patchU16(staleJump, code.length);
				code.writeU8(OPCODES$1.PUSHDIM);
				code.writeU8(50);
				emitBody();
				code.writeU8(OPCODES$1.POPDIM);
				code.patchU16(endJump, code.length);
			} else emitBody();
		} else emitBody();
	});
	else if (layout.stale && layout.stale.style === "dim" && context.resolve.sources[0]?.id) {
		const staleSource = context.resolve.sources[0]?.id;
		const staleSlot = staleSource ? slots.reserveComputed(`${staleSource}.$stale`, "int", staleSource) : null;
		if (staleSource && staleSlot !== null) {
			code.writeU8(OPCODES$1.JMPSTALE);
			code.writeU8(staleSlot);
			code.writeU16(layout.stale.afterMs);
			const staleJump = code.length;
			code.writeU16(0);
			emitBody();
			code.writeU8(OPCODES$1.JMP);
			const endJump = code.length;
			code.writeU16(0);
			code.patchU16(staleJump, code.length);
			code.writeU8(OPCODES$1.PUSHDIM);
			code.writeU8(50);
			emitBody();
			code.writeU8(OPCODES$1.POPDIM);
			code.patchU16(endJump, code.length);
		} else emitBody();
	} else emitBody();
	code.writeU8(OPCODES$1.HALT);
	const stringTable = emitStringTable(strings);
	const codeOffset = HEADER_SIZE$1 + stringTable.length;
	const payload = new Uint8Array(stringTable.length + code.bytes.length);
	payload.set(stringTable, 0);
	payload.set(new Uint8Array(code.bytes), stringTable.length);
	const bytecode = new Uint8Array(HEADER_SIZE$1 + payload.length);
	bytecode.set(utf8Bytes("MXR1"), 0);
	const headerView = new DataView(bytecode.buffer);
	headerView.setUint16(4, VERSION, true);
	headerView.setUint16(6, layout.nodes.some((node) => node.kind === "group" && node.blinkRateMs !== void 0) ? 1 : 0, true);
	headerView.setUint8(8, slots.slotMap.length);
	headerView.setUint8(9, 0);
	headerView.setUint16(10, HEADER_SIZE$1, true);
	headerView.setUint16(12, codeOffset, true);
	headerView.setUint16(14, code.bytes.length, true);
	bytecode.set(payload, HEADER_SIZE$1);
	headerView.setUint32(16, crc32(bytecode.slice(HEADER_SIZE$1)), true);
	return {
		bytecode,
		diagnostics,
		estimatedAmps,
		slotMap: slots.slotMap,
		sources: context.resolve.sources.map((source) => source.id)
	};
}
//#endregion
//#region ../compiler/dist/src/layout.js
function literalValue(attrs, name) {
	const value = attrs[name];
	if (!value) return null;
	return value.kind === "literal" ? value.value : null;
}
function exprValue(attrs, name) {
	const value = attrs[name];
	if (!value) return null;
	return value.kind === "expression" ? value.expr : null;
}
function parseInteger(attrs, name, span, diagnostics, fallback) {
	const value = attrs[name];
	if (!value) return fallback ?? null;
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
function parseDuration(value) {
	const match = value.trim().match(/^(\d+)(ms|s|m|h)$/);
	if (!match) return null;
	const amount = Number.parseInt(match[1], 10);
	switch (match[2]) {
		case "ms": return amount;
		case "s": return amount * 1e3;
		case "m": return amount * 6e4;
		case "h": return amount * 36e5;
		default: return null;
	}
}
function colorValue(attrs, name, fallback) {
	const literal = literalValue(attrs, name);
	if (literal) return { value: literal };
	const expr = exprValue(attrs, name);
	return expr ? { expr } : { value: fallback };
}
function numberValue(attrs, name, fallback) {
	const literal = literalValue(attrs, name);
	if (literal !== null) return { value: Number(literal) };
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
	return {
		h: height,
		w: width
	};
}
function layoutNode(node, diagnostics, typeContext) {
	if (node.tagName === "source" || node.tagName === "show" || node.tagName === "stale") return [];
	if (node.tagName === "row" || node.tagName === "col" || node.tagName === "box" || node.tagName === "spacer") {
		diagnostics.push({
			code: "layout.unsupported-container",
			message: `Stage 1 only supports absolute layout; <${node.tagName}> is not implemented`,
			severity: "error",
			span: node.span
		});
		return [];
	}
	if (node.tagName === "when") return [{
		children: node.children.flatMap((child) => layoutNode(child, diagnostics, typeContext)),
		kind: "group",
		span: node.span,
		test: exprValue(node.attrs, "test") ?? void 0
	}];
	if (node.tagName === "blink") {
		const rateRaw = literalValue(node.attrs, "rate") ?? "600ms";
		const blinkRateMs = parseDuration(rateRaw);
		if (blinkRateMs === null) diagnostics.push({
			code: "layout.invalid-duration",
			message: `Invalid blink rate '${rateRaw}'`,
			severity: "error",
			span: node.span
		});
		return [{
			blinkRateMs: blinkRateMs ?? 600,
			children: node.children.flatMap((child) => layoutNode(child, diagnostics, typeContext)),
			kind: "group",
			span: node.span
		}];
	}
	if (node.tagName === "text") {
		const x = parseInteger(node.attrs, "x", node.span, diagnostics);
		const y = parseInteger(node.attrs, "y", node.span, diagnostics);
		if (x === null || y === null) return [];
		return [{
			color: colorValue(node.attrs, "color", "#ffffff"),
			font: literalValue(node.attrs, "font") ?? "5x7",
			kind: "text",
			span: node.span,
			template: node.template,
			x,
			y
		}];
	}
	if (node.tagName === "badge") {
		const x = parseInteger(node.attrs, "x", node.span, diagnostics);
		const y = parseInteger(node.attrs, "y", node.span, diagnostics);
		if (x === null || y === null) return [];
		const font = literalValue(node.attrs, "font") ?? "3x5";
		const pad = parseInteger(node.attrs, "pad", node.span, diagnostics, 1) ?? 1;
		const size = estimatedTemplateText(node.template ?? [], font, typeContext);
		return [{
			color: colorValue(node.attrs, "bg", "#000000"),
			h: size.h + pad * 2,
			kind: "frect",
			span: node.span,
			w: size.w + pad * 2,
			x,
			y
		}, {
			color: colorValue(node.attrs, "fg", "#ffffff"),
			font,
			kind: "text",
			span: node.span,
			template: node.template ?? [],
			x: x + pad,
			y: y + pad
		}];
	}
	if (node.tagName === "bar") {
		const x = parseInteger(node.attrs, "x", node.span, diagnostics);
		const y = parseInteger(node.attrs, "y", node.span, diagnostics);
		const w = parseInteger(node.attrs, "w", node.span, diagnostics);
		const h = parseInteger(node.attrs, "h", node.span, diagnostics);
		if (x === null || y === null || w === null || h === null) return [];
		return [{
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
		}];
	}
	if (node.tagName === "icon") {
		const x = parseInteger(node.attrs, "x", node.span, diagnostics);
		const y = parseInteger(node.attrs, "y", node.span, diagnostics);
		if (x === null || y === null) return [];
		return [{
			asset: literalValue(node.attrs, "src") ?? "icon:missing",
			color: exprValue(node.attrs, "color") || literalValue(node.attrs, "color") ? colorValue(node.attrs, "color", "#ffffff") : void 0,
			kind: "icon",
			span: node.span,
			x,
			y
		}];
	}
	const x = parseInteger(node.attrs, "x", node.span, diagnostics, node.tagName === "stroke" ? 0 : void 0);
	const y = parseInteger(node.attrs, "y", node.span, diagnostics, node.tagName === "stroke" ? 0 : void 0);
	if (x === null || y === null) return [];
	switch (node.tagName) {
		case "rect":
		case "frect":
		case "stroke": {
			const w = parseInteger(node.attrs, "w", node.span, diagnostics, node.tagName === "stroke" ? 64 : void 0);
			const h = parseInteger(node.attrs, "h", node.span, diagnostics, node.tagName === "stroke" ? 32 : void 0);
			if (w === null || h === null) return [];
			return [{
				color: colorValue(node.attrs, "color", "#ffffff"),
				h,
				kind: node.tagName,
				span: node.span,
				w,
				x,
				y
			}];
		}
		case "line": {
			const x2 = parseInteger(node.attrs, "x2", node.span, diagnostics);
			const y2 = parseInteger(node.attrs, "y2", node.span, diagnostics);
			if (x2 === null || y2 === null) return [];
			return [{
				color: colorValue(node.attrs, "color", "#ffffff"),
				h: 0,
				kind: "line",
				span: node.span,
				w: 0,
				x,
				x2,
				y,
				y2
			}];
		}
		case "pixel": return [{
			color: colorValue(node.attrs, "color", "#ffffff"),
			h: 1,
			kind: "pixel",
			span: node.span,
			w: 1,
			x,
			y
		}];
		default: return [];
	}
}
function layoutCard(card, typeContext) {
	const diagnostics = [];
	const nodes = card.children.flatMap((child) => layoutNode(child, diagnostics, typeContext));
	const show = exprValue(card.children.find((child) => child.tagName === "show")?.attrs ?? {}, "when") ?? void 0;
	const staleNode = card.children.find((child) => child.tagName === "stale");
	let stale;
	if (staleNode) {
		const after = literalValue(staleNode.attrs, "after");
		const afterMs = after ? parseDuration(after) : null;
		if (afterMs === null) diagnostics.push({
			code: "layout.invalid-stale",
			message: "Invalid <stale after> duration",
			severity: "error",
			span: staleNode.span
		});
		else stale = {
			afterMs,
			style: literalValue(staleNode.attrs, "style") ?? "dim"
		};
	}
	return {
		diagnostics,
		nodes,
		show,
		stale
	};
}
//#endregion
//#region ../compiler/dist/src/optimise.js
function foldValue(value) {
	if (!value.expr || !isConstantExpression(value.expr)) return value;
	return { value: evaluateExpression(value.expr, {}) };
}
function foldNode(node) {
	if (node.kind === "group") return {
		...node,
		children: node.children.map(foldNode)
	};
	switch (node.kind) {
		case "text": return {
			...node,
			color: foldValue(node.color)
		};
		case "icon": return {
			...node,
			color: node.color ? foldValue(node.color) : void 0
		};
		case "bar": return {
			...node,
			bg: foldValue(node.bg),
			color: foldValue(node.color),
			max: foldValue(node.max),
			value: foldValue(node.value)
		};
		default: return {
			...node,
			color: foldValue(node.color)
		};
	}
}
function collectLiteralColors(node, output) {
	if (node.kind === "group") {
		for (const child of node.children) collectLiteralColors(child, output);
		return;
	}
	const push = (value) => {
		if (value?.value) output.push({
			color: value.value,
			kind: node.kind
		});
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
function optimiseLayout(layout) {
	const diagnostics = [];
	const nodes = layout.nodes.map(foldNode);
	const colors = [];
	for (const node of nodes) collectLiteralColors(node, colors);
	const seen = /* @__PURE__ */ new Map();
	for (const entry of colors) try {
		const normalized = normaliseColorLiteral(entry.color);
		const reduced = rgb565(normalized);
		const previous = seen.get(reduced);
		if (previous && previous !== normalized) diagnostics.push({
			code: "color.rgb565-collapse",
			message: `Colours ${previous} and ${normalized} collapse to the same RGB565 value`,
			severity: "warning"
		});
		else seen.set(reduced, normalized);
	} catch {
		diagnostics.push({
			code: "color.invalid",
			message: `Invalid colour literal '${entry.color}'`,
			severity: "error"
		});
	}
	return {
		diagnostics,
		layout: {
			...layout,
			nodes
		}
	};
}
//#endregion
//#region ../compiler/dist/src/lex.js
function clonePosition$1(position) {
	return {
		column: position.column,
		line: position.line,
		offset: position.offset
	};
}
function advancePosition$1(position, value) {
	const next = clonePosition$1(position);
	for (const char of value) {
		next.offset += 1;
		if (char === "\n") {
			next.line += 1;
			next.column = 1;
		} else next.column += 1;
	}
	return next;
}
function makeSpan$1(start, end) {
	return {
		end: clonePosition$1(end),
		start: clonePosition$1(start)
	};
}
function lexMarkup(source) {
	const tokens = [];
	let index = 0;
	let position = {
		column: 1,
		line: 1,
		offset: 0
	};
	let inTag = false;
	const push = (kind, value) => {
		const start = clonePosition$1(position);
		position = advancePosition$1(position, value);
		tokens.push({
			kind,
			span: makeSpan$1(start, position),
			value
		});
	};
	while (index < source.length) {
		if (!inTag) {
			if (source.startsWith("<!--", index)) {
				const endIndex = source.indexOf("-->", index + 4);
				const chunk = endIndex >= 0 ? source.slice(index, endIndex + 3) : source.slice(index);
				position = advancePosition$1(position, chunk);
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
			position = advancePosition$1(position, char);
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
			const start = clonePosition$1(position);
			let raw = quote;
			index += 1;
			position = advancePosition$1(position, quote);
			let closed = false;
			while (index < source.length) {
				const next = source[index];
				raw += next;
				index += 1;
				position = advancePosition$1(position, next);
				if (next === quote) {
					closed = true;
					break;
				}
			}
			if (!closed) throw new Error(`Unterminated attribute string at ${start.line}:${start.column}`);
			tokens.push({
				kind: "string",
				span: makeSpan$1(start, position),
				value: raw.slice(1, -1)
			});
			continue;
		}
		if (/[A-Za-z_]/.test(char)) {
			const start = clonePosition$1(position);
			let value = char;
			index += 1;
			position = advancePosition$1(position, char);
			while (index < source.length && /[A-Za-z0-9_.:-]/.test(source[index])) {
				value += source[index];
				position = advancePosition$1(position, source[index]);
				index += 1;
			}
			tokens.push({
				kind: "identifier",
				span: makeSpan$1(start, position),
				value
			});
			continue;
		}
		throw new Error(`Unexpected character '${char}' at ${position.line}:${position.column}`);
	}
	tokens.push({
		kind: "eof",
		span: makeSpan$1(position, position),
		value: ""
	});
	return tokens;
}
//#endregion
//#region ../compiler/dist/src/parse.js
var MarkupParseError = class extends Error {
	span;
	constructor(message, span) {
		super(message);
		this.name = "MarkupParseError";
		this.span = span;
	}
};
function clonePosition(position) {
	return {
		column: position.column,
		line: position.line,
		offset: position.offset
	};
}
function advancePosition(position, value) {
	const next = clonePosition(position);
	for (const char of value) {
		next.offset += 1;
		if (char === "\n") {
			next.line += 1;
			next.column = 1;
		} else next.column += 1;
	}
	return next;
}
function makeSpan(start, end) {
	return {
		end: clonePosition(end),
		start: clonePosition(start)
	};
}
function parseAttributeValue(token) {
	const trimmed = token.value.trim();
	if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) {
		const inner = trimmed.slice(2, -2).trim();
		const prefixIndex = token.value.indexOf("{{");
		return {
			expr: parseExpression(inner, advancePosition(token.span.start, token.value.slice(0, prefixIndex + 2))),
			kind: "expression",
			span: token.span
		};
	}
	return {
		kind: "literal",
		span: token.span,
		value: token.value
	};
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
			if (chunk.length > 0) parts.push({
				kind: "literal",
				span: makeSpan(startPos, position),
				value: chunk
			});
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
		if (end < 0) throw new MarkupParseError("Unterminated interpolation", span);
		const raw = text.slice(start, end + 2);
		const startPos = clonePosition(position);
		const exprBase = advancePosition(position, "{{");
		const expr = parseExpression(text.slice(start + 2, end).trim(), advancePosition(exprBase, text.slice(start + 2, end).match(/^\s*/)?.[0] ?? ""));
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
		if (value.length === 0) next.shift();
		else next[0] = {
			...first,
			value
		};
	}
	const last = next.at(-1);
	if (last?.kind === "literal") {
		const value = last.value.replace(/\s+$/, "");
		if (value.length === 0) next.pop();
		else next[next.length - 1] = {
			...last,
			value
		};
	}
	return next;
}
var Parser = class {
	tokens;
	index = 0;
	constructor(tokens) {
		this.tokens = tokens;
	}
	parseDocument() {
		while (this.current().kind === "text" && this.current().value.trim() === "") this.advance();
		const node = this.parseElement();
		if (node.tagName !== "card") throw new MarkupParseError("Root element must be <card>", node.span);
		while (this.current().kind === "text" && this.current().value.trim() === "") this.advance();
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
		if (token.kind !== kind) throw new MarkupParseError(`Expected ${kind}`, token.span);
		return this.advance();
	}
	match(kind) {
		if (this.current().kind === kind) return this.advance();
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
		if (selfClosing) return this.buildNode(name.value, attrs, [], open.span.start, selfClosing.span.end);
		this.expect("gt");
		if (name.value === "text" || name.value === "badge") {
			const templateParts = [];
			while (!(this.current().kind === "ltSlash")) {
				if (this.current().kind === "lt") throw new MarkupParseError(`<${name.value}> cannot contain nested elements`, this.current().span);
				const textToken = this.expect("text");
				const parsed = parseTemplate(textToken.value, textToken.span);
				templateParts.push(...parsed);
			}
			this.expect("ltSlash");
			const closeName = this.expect("identifier");
			if (closeName.value !== name.value) throw new MarkupParseError(`Expected </${name.value}>`, closeName.span);
			const end = this.expect("gt");
			return this.buildNode(name.value, attrs, [], open.span.start, end.span.end, trimTemplate(templateParts));
		}
		const children = [];
		while (!(this.current().kind === "ltSlash")) {
			if (this.current().kind === "text") {
				if (this.current().value.trim() !== "") throw new MarkupParseError("Unexpected text content", this.current().span);
				this.advance();
				continue;
			}
			const child = this.parseElement();
			if (child.tagName === "card") throw new MarkupParseError("Nested <card> elements are not allowed", child.span);
			children.push(child);
		}
		this.expect("ltSlash");
		const closeName = this.expect("identifier");
		if (closeName.value !== name.value) throw new MarkupParseError(`Expected </${name.value}>`, closeName.span);
		const end = this.expect("gt");
		return this.buildNode(name.value, attrs, children, open.span.start, end.span.end);
	}
	buildNode(name, attrs, children, start, end, template) {
		const span = makeSpan(start, end);
		if (name === "source") return {
			attrs,
			children: [],
			span,
			tagName: "source"
		};
		if (name === "text") return {
			attrs,
			children: [],
			span,
			tagName: "text",
			template: template ?? []
		};
		if (name === "card") return {
			attrs,
			children,
			span,
			tagName: "card"
		};
		if (!(/* @__PURE__ */ new Set([
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
		])).has(name)) throw new MarkupParseError(`Unsupported element <${name}>`, span);
		return {
			attrs,
			children,
			span,
			tagName: name,
			template
		};
	}
};
function parseMxml(source) {
	try {
		return new Parser(lexMarkup(source)).parseDocument();
	} catch (error) {
		if (error instanceof ExprParseError) throw new MarkupParseError(error.message, error.span);
		throw error;
	}
}
//#endregion
//#region ../compiler/dist/src/power.js
var CAL_IDLE_A = .12;
var CAL_K = 35e-7;
function colorLuma565(color) {
	const packed = rgb565(color);
	return (packed >> 11 & 31) * 8 + (packed >> 5 & 63) * 4 + (packed & 31) * 8;
}
function estimateNode(node) {
	if (node.kind === "group") return node.children.reduce((sum, child) => sum + estimateNode(child), 0);
	switch (node.kind) {
		case "text": {
			const text = node.template.map((part) => part.kind === "literal" ? part.value : "0000").join("");
			const size = measureText(node.font, text);
			const color = node.color.value ?? "#ffffff";
			return size.width * size.height * colorLuma565(color) * .2;
		}
		case "icon": return 64 * colorLuma565(node.color?.value ?? "#ffffff");
		case "bar": {
			const fill = node.color.value ?? "#33cc66";
			const bg = node.bg.value ?? "#202020";
			return node.w * node.h * colorLuma565(fill) * .5 + node.w * node.h * colorLuma565(bg) * .2;
		}
		case "line": return 16 * colorLuma565(node.color.value ?? "#ffffff");
		default: {
			const color = node.color.value ?? "#ffffff";
			return node.w * node.h * colorLuma565(color);
		}
	}
}
function estimateAmps(layout) {
	try {
		const load = layout.nodes.reduce((sum, node) => sum + estimateNode(node), 0);
		return Number((CAL_IDLE_A + load * CAL_K).toFixed(3));
	} catch {
		return CAL_IDLE_A;
	}
}
//#endregion
//#region ../compiler/dist/src/validate.js
function overflowDiagnostics(message, span) {
	return {
		code: "layout.overflow",
		message,
		severity: "error",
		span
	};
}
function estimateTextBounds(node) {
	const text = node.template.map((part) => part.kind === "literal" ? part.value : "000000").join("");
	const measured = measureText(node.font, text);
	return {
		h: measured.height,
		w: measured.width
	};
}
function validateNode(node, diagnostics) {
	if (node.kind === "group") {
		for (const child of node.children) validateNode(child, diagnostics);
		return;
	}
	switch (node.kind) {
		case "text": {
			const { w, h } = estimateTextBounds(node);
			if (node.x < 0 || node.y < 0 || node.x + w > 64 || node.y + h > 32) diagnostics.push(overflowDiagnostics(`text overflows 64x32`, node.span));
			return;
		}
		case "icon":
			if (node.x < 0 || node.y < 0 || node.x + 8 > 64 || node.y + 8 > 32) diagnostics.push(overflowDiagnostics(`icon overflows 64x32`, node.span));
			return;
		case "line":
			if (node.x < 0 || node.y < 0 || (node.x2 ?? 0) < 0 || (node.y2 ?? 0) < 0 || node.x >= 64 || node.y >= 32 || (node.x2 ?? 0) >= 64 || (node.y2 ?? 0) >= 32) diagnostics.push(overflowDiagnostics(`line overflows 64x32`, node.span));
			return;
		default: if (node.x < 0 || node.y < 0 || node.x + node.w > 64 || node.y + node.h > 32) diagnostics.push(overflowDiagnostics(`${node.kind} overflows 64x32`, node.span));
	}
}
function validateLayout(layout, slotCount) {
	const diagnostics = [...layout.diagnostics];
	for (const node of layout.nodes) validateNode(node, diagnostics);
	if (slotCount > 255) diagnostics.push({
		code: "slot.overflow",
		message: `slot count ${slotCount} exceeds 255`,
		severity: "error"
	});
	return diagnostics;
}
//#endregion
//#region ../compiler/dist/src/index.js
function startPosition() {
	return {
		column: 1,
		line: 1,
		offset: 0
	};
}
function span() {
	const start = startPosition();
	return {
		end: { ...start },
		start
	};
}
function diagnostic(message, code, severity = "error") {
	return {
		code,
		message,
		severity
	};
}
function dedupeDiagnostics(input) {
	const seen = /* @__PURE__ */ new Set();
	const output = [];
	for (const entry of input) {
		const key = `${entry.code}:${entry.message}:${entry.span?.start.offset ?? -1}`;
		if (seen.has(key)) continue;
		seen.add(key);
		output.push(entry);
	}
	return output;
}
function emptyResolve() {
	return {
		diagnostics: [],
		sourceKinds: /* @__PURE__ */ new Map(),
		sources: []
	};
}
function fallbackResult(diagnostics, sources = []) {
	return {
		...emitProgram({
			diagnostics: [],
			nodes: []
		}, {
			diagnostics: [],
			resolve: emptyResolve()
		}, .12, dedupeDiagnostics(diagnostics)),
		diagnostics: dedupeDiagnostics(diagnostics),
		sources
	};
}
function parseJsonCard(source) {
	const value = typeof source === "string" ? JSON.parse(source) : source;
	if (typeof value !== "object" || value === null) throw new Error("Stage 0 input must be an object");
	const record = value;
	if (typeof record.id !== "string" || !Array.isArray(record.elements)) throw new Error("Stage 0 card must have string id and elements[]");
	return record;
}
function pathTemplate(path) {
	return [{
		expr: parseExpression(path, startPosition()),
		kind: "expression",
		span: span()
	}];
}
function stage0Node(element) {
	const op = String(element.op);
	switch (op) {
		case "text": return [{
			color: { value: String(element.color ?? "#ffffff") },
			font: String(element.font ?? "5x7"),
			kind: "text",
			span: span(),
			template: typeof element.value === "string" ? [{
				kind: "literal",
				span: span(),
				value: String(element.value)
			}] : pathTemplate(String(element.bind)),
			x: Number(element.x ?? 0),
			y: Number(element.y ?? 0)
		}];
		case "rect":
		case "frect":
		case "stroke": return [{
			color: { value: String(element.color ?? "#ffffff") },
			h: Number(element.h ?? (op === "stroke" ? 32 : 0)),
			kind: op,
			span: span(),
			w: Number(element.w ?? (op === "stroke" ? 64 : 0)),
			x: Number(element.x ?? 0),
			y: Number(element.y ?? 0)
		}];
		case "line": return [{
			color: { value: String(element.color ?? "#ffffff") },
			h: 0,
			kind: "line",
			span: span(),
			w: 0,
			x: Number(element.x1 ?? 0),
			x2: Number(element.x2 ?? 0),
			y: Number(element.y1 ?? 0),
			y2: Number(element.y2 ?? 0)
		}];
		case "pixel": return [{
			color: { value: String(element.color ?? "#ffffff") },
			h: 1,
			kind: "pixel",
			span: span(),
			w: 1,
			x: Number(element.x ?? 0),
			y: Number(element.y ?? 0)
		}];
		case "icon": return [{
			asset: String(element.src ?? "icon:missing"),
			color: element.color ? { value: String(element.color) } : void 0,
			kind: "icon",
			span: span(),
			x: Number(element.x ?? 0),
			y: Number(element.y ?? 0)
		}];
		case "bar": return [{
			bg: { value: String(element.bg ?? "#202020") },
			color: { value: String(element.color ?? "#33cc66") },
			h: Number(element.h ?? 0),
			kind: "bar",
			max: typeof element.max === "number" ? { value: element.max } : { expr: parseExpression(String(element.max ?? 1), startPosition()) },
			span: span(),
			value: typeof element.value === "number" ? { value: element.value } : element.bind ? { expr: parseExpression(String(element.bind), startPosition()) } : { value: 0 },
			w: Number(element.w ?? 0),
			x: Number(element.x ?? 0),
			y: Number(element.y ?? 0)
		}];
		case "badge": return [{
			color: { value: String(element.bg ?? "#000000") },
			h: 7,
			kind: "frect",
			span: span(),
			w: 16,
			x: Number(element.x ?? 0),
			y: Number(element.y ?? 0)
		}, {
			color: { value: String(element.fg ?? "#ffffff") },
			font: String(element.font ?? "3x5"),
			kind: "text",
			span: span(),
			template: typeof element.value === "string" ? [{
				kind: "literal",
				span: span(),
				value: String(element.value)
			}] : pathTemplate(String(element.bind)),
			x: Number(element.x ?? 0) + 1,
			y: Number(element.y ?? 0) + 1
		}];
		default: throw new Error(`Unsupported Stage 0 op '${op}'`);
	}
}
function stage0Resolve(nodes) {
	const sources = /* @__PURE__ */ new Map();
	const visit = (node) => {
		if (node.kind === "group") {
			for (const child of node.children) visit(child);
			return;
		}
		if (node.kind === "text") {
			for (const part of node.template) {
				if (part.kind !== "expression") continue;
				for (const path of [part.expr.kind === "path" ? part.expr.segments.join(".") : null]) {
					if (!path) continue;
					const root = path.split(".")[0];
					sources.set(root, {
						attrs: {},
						id: root,
						kind: `stage0.${root}`,
						span: part.span
					});
				}
			}
			return;
		}
		if (node.kind === "bar" && node.value.expr && node.value.expr.kind === "path") {
			const root = node.value.expr.segments[0];
			sources.set(root, {
				attrs: {},
				id: root,
				kind: `stage0.${root}`,
				span: node.span
			});
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
	const allDiagnostics = dedupeDiagnostics([
		...diagnostics,
		...optimised.diagnostics,
		...validation
	]);
	const emitted = emitProgram(optimised.layout, context, amps, allDiagnostics);
	const slotDiagnostics = emitted.slotMap.length > 255 ? [{
		code: "slot.overflow",
		message: `slot count ${emitted.slotMap.length} exceeds 255`,
		severity: "error"
	}] : [];
	return {
		...emitted,
		diagnostics: dedupeDiagnostics([...emitted.diagnostics, ...slotDiagnostics])
	};
}
function compileJson(source, _options) {
	try {
		const nodes = parseJsonCard(source).elements.flatMap((element) => stage0Node(element));
		const context = {
			diagnostics: [],
			resolve: stage0Resolve(nodes)
		};
		return finalise({
			diagnostics: [],
			nodes
		}, context, []);
	} catch (error) {
		return fallbackResult([diagnostic(error instanceof Error ? error.message : String(error), "stage0.parse")]);
	}
}
function compileMxml(source, _options) {
	try {
		const card = parseMxml(source);
		const resolve = resolveCard(card);
		const typedDiagnostics = typecheckCard(card, resolve);
		const typeContext = {
			diagnostics: [],
			resolve
		};
		return finalise(layoutCard(card, typeContext), typeContext, typedDiagnostics);
	} catch (error) {
		if (error instanceof Error && "span" in error) return fallbackResult([{
			code: "stage1.parse",
			message: error.message,
			severity: "error",
			span: error.span
		}]);
		return fallbackResult([diagnostic(error instanceof Error ? error.message : String(error), "stage1.parse")]);
	}
}
function compile(source, options) {
	if (typeof source === "object") return compileJson(source, options);
	if (source.trim().startsWith("<")) return compileMxml(source, options);
	return compileJson(source, options);
}
//#endregion
//#region src/lib/mxr/render.ts
var WIDTH = 64;
var HEIGHT = 32;
var HEADER_SIZE = 84;
var OPCODES = {
	CLEAR: 1,
	FRECT: 16,
	RECT: 17,
	LINE: 18,
	PIXEL: 19,
	TEXT: 32,
	BLIT: 48,
	BLITC: 49,
	JMP: 64,
	JMPZ: 65,
	JMPCMP: 66,
	JMPSTALE: 67,
	PUSHDIM: 82,
	POPDIM: 83,
	BLINK: 96,
	HALT: 255
};
var decoder = new TextDecoder();
var sourceCanvas = typeof document === "undefined" ? null : document.createElement("canvas");
typeof document === "undefined" || document.createElement("canvas");
function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}
function decodeRgb565(color) {
	const r = (color >> 11 & 31) * 255 / 31;
	const g = (color >> 5 & 63) * 255 / 63;
	const b = (color & 31) * 255 / 31;
	return {
		b: Math.round(b),
		g: Math.round(g),
		r: Math.round(r)
	};
}
function dimRgb565(color, percent) {
	if (percent >= 100) return color;
	const { r, g, b } = decodeRgb565(color);
	const scale = percent / 100;
	return rgb565({
		b: Math.round(b * scale),
		g: Math.round(g * scale),
		r: Math.round(r * scale)
	});
}
function createFramebuffer() {
	return new Uint16Array(WIDTH * HEIGHT);
}
function setPixel(framebuffer, x, y, color) {
	if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
	framebuffer[y * WIDTH + x] = color;
}
function fillRect(framebuffer, x, y, w, h, color) {
	for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) setPixel(framebuffer, xx, yy, color);
}
function strokeRect(framebuffer, x, y, w, h, color) {
	for (let xx = x; xx < x + w; xx += 1) {
		setPixel(framebuffer, xx, y, color);
		setPixel(framebuffer, xx, y + h - 1, color);
	}
	for (let yy = y; yy < y + h; yy += 1) {
		setPixel(framebuffer, x, yy, color);
		setPixel(framebuffer, x + w - 1, yy, color);
	}
}
function line(framebuffer, x0, y0, x1, y1, color) {
	let dx = Math.abs(x1 - x0);
	let sx = x0 < x1 ? 1 : -1;
	let dy = -Math.abs(y1 - y0);
	let sy = y0 < y1 ? 1 : -1;
	let err = dx + dy;
	while (true) {
		setPixel(framebuffer, x0, y0, color);
		if (x0 === x1 && y0 === y1) break;
		const e2 = err * 2;
		if (e2 >= dy) {
			err += dy;
			x0 += sx;
		}
		if (e2 <= dx) {
			err += dx;
			y0 += sy;
		}
		dx = Math.abs(x1 - x0);
		dy = -Math.abs(y1 - y0);
	}
}
function parseProgram(bytecode) {
	if (bytecode.length < HEADER_SIZE) throw new Error("Bytecode shorter than MXR header");
	if (decoder.decode(bytecode.slice(0, 4)) !== "MXR1") throw new Error("Bad MXR magic");
	const view = new DataView(bytecode.buffer, bytecode.byteOffset, bytecode.byteLength);
	const version = view.getUint16(4, true);
	const stringOffset = view.getUint16(10, true);
	const codeOffset = view.getUint16(12, true);
	const codeLength = view.getUint16(14, true);
	if (version !== 1) throw new Error(`Unsupported MXR version ${version}`);
	if (stringOffset < HEADER_SIZE || codeOffset < stringOffset || codeOffset + codeLength > bytecode.length) throw new Error("Invalid MXR string/code offsets");
	const strings = parseStringTable(bytecode.slice(stringOffset, codeOffset));
	return {
		code: bytecode.slice(codeOffset, codeOffset + codeLength),
		strings,
		version
	};
}
function parseStringTable(table) {
	if (table.length === 0) return [];
	const view = new DataView(table.buffer, table.byteOffset, table.byteLength);
	let offset = 0;
	const count = view.getUint16(offset, true);
	offset += 2;
	const strings = [];
	for (let index = 0; index < count; index += 1) {
		if (offset + 2 > table.length) break;
		const length = view.getUint16(offset, true);
		offset += 2;
		strings.push(decoder.decode(table.slice(offset, offset + length)));
		offset += length;
	}
	return strings;
}
function slotToText(slot) {
	const value = slot?.value;
	if (typeof value === "number") return Number.isInteger(value) ? `${value}` : value.toFixed(2).replace(/\.?0+$/, "");
	if (typeof value === "boolean") return value ? "true" : "false";
	if (value === null || value === void 0) return "--";
	return String(value);
}
function slotToNumber(slot) {
	const value = slot?.value;
	if (typeof value === "number") return value;
	if (typeof value === "boolean") return value ? 1 : 0;
	if (typeof value === "string" && value.trim().length > 0) {
		const numeric = Number(value);
		return Number.isNaN(numeric) ? null : numeric;
	}
	return null;
}
function slotTruthy(slot) {
	const value = slot?.value;
	if (typeof value === "number") return value !== 0;
	if (typeof value === "boolean") return value;
	if (typeof value === "string") return value.length > 0;
	return Boolean(value);
}
function slotUpdatedMs(slot, nowMs) {
	return slot?.updatedMs ?? nowMs;
}
function offscreenContext(width, height) {
	if (!sourceCanvas) return null;
	sourceCanvas.width = Math.max(1, width);
	sourceCanvas.height = Math.max(1, height);
	const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) return null;
	ctx.clearRect(0, 0, width, height);
	return ctx;
}
function drawText(framebuffer, x, y, fontId, color, text) {
	const scale = 4;
	const fontPx = fontId === 0 ? 5 : fontId === 1 ? 7 : fontId === 2 ? 16 : 18;
	const family = fontId === 3 ? "\"JetBrains Mono\", monospace" : "\"JetBrains Mono\", monospace";
	const estimateWidth = Math.max(1, Math.ceil(text.length * (fontId === 0 ? 4 : fontId === 1 ? 6 : fontId === 2 ? 8 : 10)));
	const estimateHeight = fontId === 0 ? 6 : fontId === 1 ? 7 : fontId === 2 ? 16 : 20;
	const ctx = offscreenContext(estimateWidth * scale + scale * 2, estimateHeight * scale + scale * 2);
	if (!ctx) return {
		h: estimateHeight,
		w: estimateWidth
	};
	ctx.fillStyle = "#ffffff";
	ctx.textBaseline = "top";
	ctx.font = `${fontId === 3 ? "700" : "500"} ${fontPx * scale}px ${family}`;
	ctx.fillText(text, 0, 0);
	const metrics = ctx.measureText(text);
	const width = clamp(Math.ceil(metrics.width / scale), 1, WIDTH);
	const height = clamp(estimateHeight, 1, HEIGHT);
	const image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
	for (let yy = 0; yy < height; yy += 1) for (let xx = 0; xx < width; xx += 1) {
		let lit = false;
		for (let sy = 0; sy < scale && !lit; sy += 1) for (let sx = 0; sx < scale; sx += 1) {
			const px = xx * scale + sx;
			const py = yy * scale + sy;
			if ((image.data[(py * image.width + px) * 4 + 3] ?? 0) > 64) {
				lit = true;
				break;
			}
		}
		if (lit) setPixel(framebuffer, x + xx, y + yy, color);
	}
	return {
		h: height,
		w: width
	};
}
function resolveByPath(path, sourceSlots) {
	return sourceSlots?.[path];
}
function hotspotForPath(input) {
	const sourceSlot = input.sourceSlots?.[input.path];
	const mappedSlot = input.slotMap.find((entry) => entry.path === input.path);
	const runtimeSlot = mappedSlot ? input.slots[mappedSlot.index] : void 0;
	const value = runtimeSlot?.value ?? sourceSlot?.value;
	if (value === void 0) return null;
	return {
		h: input.rect.h,
		path: input.path,
		slotIndex: mappedSlot?.index ?? null,
		sourceId: mappedSlot?.sourceId ?? sourceSlot?.sourceId ?? input.path.split(".")[0] ?? "unknown",
		type: mappedSlot?.type ?? sourceSlot?.type ?? typeof value,
		updatedMs: runtimeSlot?.updatedMs ?? sourceSlot?.updatedMs,
		value,
		w: input.rect.w,
		x: input.rect.x,
		y: input.rect.y
	};
}
function renderStage0(input) {
	const framebuffer = createFramebuffer();
	const hotspots = [];
	const warnings = [];
	const source = typeof input.source === "string" ? JSON.parse(input.source) : input.source;
	if (!source || !Array.isArray(source.elements)) throw new Error("Stage 0 fallback requires JSON card source");
	for (const element of source.elements) {
		const op = String(element.op);
		switch (op) {
			case "text": {
				const path = typeof element.bind === "string" ? element.bind : null;
				const value = path ? resolveByPath(path, input.sourceSlots) : void 0;
				const text = typeof element.value === "string" || typeof element.value === "number" ? String(element.value) : slotToText(value);
				const color = rgb565(element.color ?? "#ffffff");
				const bounds = drawText(framebuffer, Number(element.x ?? 0), Number(element.y ?? 0), fontNameToId(element.font ?? "5x7"), color, text);
				if (path) {
					const hotspot = hotspotForPath({
						path,
						rect: {
							...bounds,
							x: Number(element.x ?? 0),
							y: Number(element.y ?? 0)
						},
						slotMap: input.slotMap,
						slots: input.slots ?? {},
						sourceSlots: input.sourceSlots
					});
					if (hotspot) hotspots.push(hotspot);
				}
				break;
			}
			case "rect":
			case "stroke":
				strokeRect(framebuffer, Number(element.x ?? 0), Number(element.y ?? 0), Number(element.w ?? (op === "stroke" ? WIDTH : 0)), Number(element.h ?? (op === "stroke" ? HEIGHT : 0)), rgb565(element.color ?? "#ffffff"));
				break;
			case "frect":
				fillRect(framebuffer, Number(element.x ?? 0), Number(element.y ?? 0), Number(element.w ?? 0), Number(element.h ?? 0), rgb565(element.color ?? "#ffffff"));
				break;
			case "line":
				line(framebuffer, Number(element.x1 ?? 0), Number(element.y1 ?? 0), Number(element.x2 ?? 0), Number(element.y2 ?? 0), rgb565(element.color ?? "#ffffff"));
				break;
			case "pixel":
				setPixel(framebuffer, Number(element.x ?? 0), Number(element.y ?? 0), rgb565(element.color ?? "#ffffff"));
				break;
			case "bar": {
				const x = Number(element.x ?? 0);
				const y = Number(element.y ?? 0);
				const w = Number(element.w ?? 0);
				const h = Number(element.h ?? 0);
				fillRect(framebuffer, x, y, w, h, rgb565(element.bg ?? "#202020"));
				const path = typeof element.bind === "string" ? element.bind : null;
				const value = path ? resolveByPath(path, input.sourceSlots) : void 0;
				const current = typeof element.value === "number" ? element.value : slotToNumber(value) ?? 0;
				const max = typeof element.max === "number" && element.max > 0 ? element.max : 1;
				fillRect(framebuffer, x, y, clamp(Math.round(w * (current / max)), 0, w), h, rgb565(element.color ?? "#33cc66"));
				if (path) {
					const hotspot = hotspotForPath({
						path,
						rect: {
							h,
							w,
							x,
							y
						},
						slotMap: input.slotMap,
						slots: input.slots ?? {},
						sourceSlots: input.sourceSlots
					});
					if (hotspot) hotspots.push(hotspot);
				}
				break;
			}
			case "badge": {
				fillRect(framebuffer, Number(element.x ?? 0), Number(element.y ?? 0), 16, 7, rgb565(element.bg ?? "#000000"));
				const path = typeof element.bind === "string" ? element.bind : null;
				const value = path ? resolveByPath(path, input.sourceSlots) : void 0;
				const text = typeof element.value === "string" ? element.value : slotToText(value);
				const bounds = drawText(framebuffer, Number(element.x ?? 0) + 1, Number(element.y ?? 0) + 1, fontNameToId(element.font ?? "3x5"), rgb565(element.fg ?? "#ffffff"), text);
				if (path) {
					const hotspot = hotspotForPath({
						path,
						rect: {
							...bounds,
							x: Number(element.x ?? 0),
							y: Number(element.y ?? 0)
						},
						slotMap: input.slotMap,
						slots: input.slots ?? {},
						sourceSlots: input.sourceSlots
					});
					if (hotspot) hotspots.push(hotspot);
				}
				break;
			}
			case "icon":
				warnings.push("Icon assets are stubbed in the TypeScript fallback renderer.");
				strokeRect(framebuffer, Number(element.x ?? 0), Number(element.y ?? 0), 8, 8, rgb565(element.color ?? "#84cc16"));
				line(framebuffer, Number(element.x ?? 0), Number(element.y ?? 0), Number(element.x ?? 0) + 7, Number(element.y ?? 0) + 7, rgb565(element.color ?? "#84cc16"));
				break;
			default: warnings.push(`Unsupported Stage 0 op '${op}' in fallback renderer.`);
		}
	}
	return {
		framebuffer,
		height: HEIGHT,
		hotspots,
		mode: "stage0",
		warnings,
		width: WIDTH
	};
}
function fontNameToId(name) {
	switch (name) {
		case "3x5": return 0;
		case "5x7": return 1;
		case "8x16": return 2;
		case "seg7": return 3;
		default: return 1;
	}
}
function readU16(bytes, offset) {
	return bytes[offset] | bytes[offset + 1] << 8;
}
function readI32(bytes, offset) {
	return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getInt32(0, true);
}
function renderBytecode(input) {
	const program = parseProgram(input.bytecode);
	const framebuffer = createFramebuffer();
	const hotspots = [];
	const warnings = [];
	const slots = input.slots ?? {};
	const dimStack = [100];
	let pc = 0;
	while (pc < program.code.length) {
		const op = program.code[pc];
		if (op === OPCODES.HALT) break;
		switch (op) {
			case OPCODES.CLEAR: {
				const color = dimRgb565(readU16(program.code, pc + 1), currentDim(dimStack));
				framebuffer.fill(color);
				pc += 3;
				break;
			}
			case OPCODES.FRECT:
				fillRect(framebuffer, program.code[pc + 1], program.code[pc + 2], program.code[pc + 3], program.code[pc + 4], dimRgb565(readU16(program.code, pc + 5), currentDim(dimStack)));
				pc += 7;
				break;
			case OPCODES.RECT:
				strokeRect(framebuffer, program.code[pc + 1], program.code[pc + 2], program.code[pc + 3], program.code[pc + 4], dimRgb565(readU16(program.code, pc + 5), currentDim(dimStack)));
				pc += 7;
				break;
			case OPCODES.LINE:
				line(framebuffer, program.code[pc + 1], program.code[pc + 2], program.code[pc + 3], program.code[pc + 4], dimRgb565(readU16(program.code, pc + 5), currentDim(dimStack)));
				pc += 7;
				break;
			case OPCODES.PIXEL:
				setPixel(framebuffer, program.code[pc + 1], program.code[pc + 2], dimRgb565(readU16(program.code, pc + 3), currentDim(dimStack)));
				pc += 5;
				break;
			case OPCODES.TEXT: {
				const x = program.code[pc + 1];
				const y = program.code[pc + 2];
				const font = program.code[pc + 3];
				const color = dimRgb565(readU16(program.code, pc + 4), currentDim(dimStack));
				const source = program.code[pc + 6];
				const slotIndex = source & 128 ? source & 127 : null;
				const bounds = drawText(framebuffer, x, y, font, color, slotIndex !== null ? slotToText(slots[slotIndex]) : program.strings[source] ?? "");
				if (slotIndex !== null) {
					const entry = input.slotMap[slotIndex];
					hotspots.push({
						h: bounds.h,
						path: entry?.path ?? `slot:${slotIndex}`,
						slotIndex,
						sourceId: entry?.sourceId ?? "unknown",
						type: entry?.type ?? "unknown",
						updatedMs: slots[slotIndex]?.updatedMs,
						value: slots[slotIndex]?.value ?? null,
						w: bounds.w,
						x,
						y
					});
				}
				pc += 7;
				break;
			}
			case OPCODES.BLIT:
			case OPCODES.BLITC: {
				const x = program.code[pc + 1];
				const y = program.code[pc + 2];
				const color = op === OPCODES.BLITC ? dimRgb565(readU16(program.code, pc + 5), currentDim(dimStack)) : rgb565("#84cc16");
				strokeRect(framebuffer, x, y, 8, 8, color);
				line(framebuffer, x, y, x + 7, y + 7, color);
				warnings.push("Asset blits are placeholder outlines in the TypeScript fallback renderer.");
				pc += op === OPCODES.BLITC ? 7 : 5;
				break;
			}
			case OPCODES.JMP:
				pc = readU16(program.code, pc + 1);
				break;
			case OPCODES.JMPZ: {
				const slotIndex = program.code[pc + 1];
				const target = readU16(program.code, pc + 2);
				pc = slotTruthy(slots[slotIndex]) ? pc + 4 : target;
				break;
			}
			case OPCODES.JMPCMP: {
				const slotIndex = program.code[pc + 1];
				const cmp = program.code[pc + 2];
				const imm = readI32(program.code, pc + 3);
				const target = readU16(program.code, pc + 7);
				pc = compare(slotToNumber(slots[slotIndex]), imm, cmp) ? target : pc + 9;
				break;
			}
			case OPCODES.JMPSTALE: {
				const slotIndex = program.code[pc + 1];
				const staleMs = readU16(program.code, pc + 2);
				const target = readU16(program.code, pc + 4);
				pc = input.nowMs - slotUpdatedMs(slots[slotIndex], input.nowMs) > staleMs ? target : pc + 6;
				break;
			}
			case OPCODES.PUSHDIM:
				dimStack.push(clamp(program.code[pc + 1], 0, 100));
				pc += 2;
				break;
			case OPCODES.POPDIM:
				if (dimStack.length > 1) dimStack.pop();
				pc += 1;
				break;
			case OPCODES.BLINK: {
				const rate = readU16(program.code, pc + 1);
				const duty = program.code[pc + 3];
				const target = readU16(program.code, pc + 4);
				pc = (rate <= 0 ? 1 : input.nowMs % rate) < (rate <= 0 ? 1 : rate * (duty / 100)) ? pc + 6 : target;
				break;
			}
			default: throw new Error(`Unsupported MXR opcode 0x${op.toString(16)}`);
		}
	}
	return {
		framebuffer,
		height: HEIGHT,
		hotspots,
		mode: "bytecode",
		warnings,
		width: WIDTH
	};
}
function currentDim(stack) {
	return stack.reduce((accumulator, value) => Math.round(accumulator * (value / 100)), 100);
}
function compare(left, right, cmp) {
	if (left === null) return false;
	switch (cmp) {
		case 0: return left === right;
		case 1: return left !== right;
		case 2: return left < right;
		case 3: return left <= right;
		case 4: return left > right;
		case 5: return left >= right;
		default: return false;
	}
}
function render(input) {
	try {
		return renderBytecode(input);
	} catch (error) {
		if (!input.source) return {
			framebuffer: createFramebuffer(),
			height: HEIGHT,
			hotspots: [],
			mode: "bytecode",
			warnings: [error instanceof Error ? error.message : "Unknown renderer error"],
			width: WIDTH
		};
		const fallback = renderStage0(input);
		fallback.warnings.unshift(error instanceof Error ? error.message : "Bytecode renderer failed");
		return fallback;
	}
}
var MXR_DIMENSIONS = {
	height: HEIGHT,
	width: WIDTH
};
//#endregion
//#region src/lib/design/PixelCanvas.svelte
function PixelCanvas($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { class: className = "", framebuffer, hotspots = [], hovered = null, scale = 8, title = "Matrix framebuffer" } = $$props;
		$$renderer.push(`<div${attr("aria-label", title)}${attr_class(`relative inline-flex rounded-2xl border border-[color:var(--line)] bg-black/60 p-2 ${className}`)} role="img"><canvas${attr("aria-label", title)} class="block rounded-lg bg-black shadow-[0_0_0_1px_rgba(255,255,255,0.03)]" height="256" width="512"></canvas> `);
		if (hovered) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="pointer-events-none absolute rounded-md border border-amber-400/60 bg-amber-400/10"${attr_style(`left:${hovered.x * scale + 8}px;top:${hovered.y * scale + 8}px;width:${Math.max(1, hovered.w) * scale}px;height:${Math.max(1, hovered.h) * scale}px;`)}></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div>`);
		bind_props($$props, { hovered });
	});
}
//#endregion
//#region src/lib/device/Mirror.svelte
function Mirror($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { card, nowMs, snapshot } = $$props;
		let mirrorNow = Date.now();
		let compiled = derived(() => {
			if (!card) return null;
			return compile(card.source);
		});
		let frame = derived(() => {
			if (!compiled() || !card) return {
				framebuffer: new Uint16Array(MXR_DIMENSIONS.width * MXR_DIMENSIONS.height),
				height: MXR_DIMENSIONS.height,
				hotspots: [],
				mode: "bytecode",
				warnings: [],
				width: MXR_DIMENSIONS.width
			};
			return render({
				bytecode: compiled().bytecode,
				nowMs: mirrorNow,
				slotMap: compiled().slotMap,
				slots: snapshot.byIndex,
				source: card.source,
				sourceSlots: snapshot.byPath
			});
		});
		$$renderer.push(`<section class="panel rounded-2xl p-4"><div class="mb-3 flex items-center justify-between"><div><h2 class="text-sm font-semibold tracking-[0.18em] text-zinc-100 uppercase">Device mirror</h2> <p class="mt-1 text-xs text-[color:var(--muted)]">2 fps local mirror of the currently selected frame.</p></div> <span class="badge badge-amber">${escape_html(card?.slug ?? "no-card")}</span></div> `);
		PixelCanvas($$renderer, {
			framebuffer: frame().framebuffer,
			hotspots: [],
			scale: 8,
			title: "Device mirror framebuffer"
		});
		$$renderer.push(`<!----></section>`);
	});
}
//#endregion
export { compile as a, render as i, PixelCanvas as n, MXR_DIMENSIONS as r, Mirror as t };
