import type { Position } from "./shared";

export type Expression =
  | LiteralExpression
  | BracketedExpression
  | CallExpression
  | IndexExpression
  | BinaryOperatorExpression
  | UnaryOperatorExpression
  | IdentifierExpression;

export interface LiteralExpression {
  position: Position;
  type: "literal";
  value: string | number;
}

export interface BracketedExpression {
  position: Position;
  type: "bracketed";
  expression: Expression;
}

export interface CallExpression {
  position: Position;
  type: "call";
  name: string;
  parameters: Expression[];
}

export interface IndexExpression {
  position: Position;
  type: "index";
  subject: Expression;
  index: Expression;
}

export interface BinaryOperatorExpression {
  position: Position;
  type: "binary-operator";
  left: Expression;
  right: Expression;
  operator:
    | "equals"
    | "not-equals"
    | "plus"
    | "minus"
    | "divide"
    | "multiply"
    | "and"
    | "or"
    | "lt"
    | "lte"
    | "gt"
    | "gte";
}

export interface UnaryOperatorExpression {
  position: Position;
  type: "unary-operator";
  value: Expression;
  operator: "negate" | "not";
}

export interface IdentifierExpression {
  position: Position;
  type: "identifier";
  name: string;
}
