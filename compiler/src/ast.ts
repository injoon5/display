import type { Expr } from "./expr.js";
import type { Span } from "./types.js";

export interface AttributeValueLiteral {
  kind: "literal";
  span: Span;
  value: string;
}

export interface AttributeValueExpression {
  kind: "expression";
  expr: Expr;
  span: Span;
}

export type AttributeValue = AttributeValueExpression | AttributeValueLiteral;

export interface TemplateLiteralPart {
  kind: "literal";
  span: Span;
  value: string;
}

export interface TemplateExpressionPart {
  kind: "expression";
  expr: Expr;
  span: Span;
}

export type TemplatePart = TemplateExpressionPart | TemplateLiteralPart;

export interface BaseNode {
  attrs: Record<string, AttributeValue>;
  span: Span;
  tagName: string;
}

export interface SourceNode extends BaseNode {
  children: [];
  tagName: "source";
}

export interface TextNode extends BaseNode {
  children: [];
  tagName: "text";
  template: TemplatePart[];
}

export interface ElementNode extends BaseNode {
  children: MxmlNode[];
  tagName:
    | "badge"
    | "bar"
    | "blink"
    | "box"
    | "col"
    | "frect"
    | "fx"
    | "icon"
    | "line"
    | "pixel"
    | "rect"
    | "row"
    | "show"
    | "spacer"
    | "stale"
    | "stroke"
    | "when";
  template?: TemplatePart[];
}

export type MxmlNode = ElementNode | SourceNode | TextNode;
export type AnyNode = CardNode | MxmlNode;

export interface CardNode extends BaseNode {
  children: MxmlNode[];
  tagName: "card";
}
