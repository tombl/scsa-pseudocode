import type { CallExpression, Expression } from "./expression";
import type { Position } from "./shared";

export type Statement =
  | AssignmentStatement
  | IfStatement
  | CaseStatement
  | ForStatement
  | WhileStatement
  | RepeatStatement
  | ModuleStatement
  | CallExpression;

export interface AssignmentStatement {
  position: Position;
  type: "assignment";
  to: Expression;
  value: Expression;
}

export interface IfStatement {
  position: Position;
  type: "if";
  condition: Expression;
  then: Statement[];
  else?: Statement[];
}

export interface CaseStatement {
  position: Position;
  type: "case";
  value: Expression;
  branches: Array<{
    operator: "equals" | "not-equals" | "lt" | "lte" | "gt" | "gte";
    value: Expression;
    body: Statement[];
  }>;
}

export interface ForStatement {
  position: Position;
  type: "for";
  name: string;
  start: Expression;
  end: Expression;
  body: Statement[];
}

export interface WhileStatement {
  position: Position;
  type: "while";
  condition: Expression;
  body: Statement[];
}

export interface RepeatStatement {
  position: Position;
  type: "repeat";
  body: Statement[];
  condition: Expression;
}

export interface ModuleStatement {
  position: Position;
  type: "module";
  name: string;
  parameters: string[];
  body: Statement[];
}
