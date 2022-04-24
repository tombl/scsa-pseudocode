import type { Expression, Statement } from "./parser";
import type { Position } from "./parser/types/shared";

export type Instruction =
  | { type: "placeholder" }
  | { type: "jump"; to: number }
  | { type: "branch"; to: number }
  | { type: "literal"; literal: number }
  | { type: "assign" }
  | { type: "call"; module: number }
  | { type: "read"; variable: number }
  | { type: "drop"; variable: number }
  | { type: "index" }
  | { type: "not" }
  | {
      type: `binary-operator-${
        | "plus"
        | "minus"
        | "multiply"
        | "modulo"
        | "divide"
        | "equals"
        | "and"
        | "or"
        | "lt"
        | "lte"
        | "gt"
        | "gte"}`;
    };

export interface Program {
  literals: Array<string | number | boolean>;
  modules: Map<number, Instruction[]>;
  moduleNames: string[];
  variableNames: string[];
  positions: Map<`${number}-${number}`, Position>;
}

class NumericAssigner<T> {
  #map = new Map<T, number>();
  alias(alias: T, existing: T) {
    const value = this.#map.get(alias);
    this.#map.set(alias, this.get(existing));
    return () => {
      if (value === undefined) {
        this.#map.delete(alias);
      } else {
        this.#map.set(alias, value);
      }
    };
  }
  get(value: T): number {
    if (!this.#map.has(value)) {
      this.#map.set(value, this.#map.size);
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.#map.get(value)!;
  }
  toArray(): T[] {
    const array = new Array<T>(this.#map.size);
    for (const [value, index] of this.#map) {
      array[index] = value;
    }
    return array;
  }
}

export class Compiler {
  #literals = new NumericAssigner<string | number | boolean>();
  #variables = new NumericAssigner<string>();
  #moduleIDs = new NumericAssigner<string>();
  #modules = new Map<number, Instruction[]>();
  #positions = new Map<`${number}-${number}`, Position>();

  #getModule(moduleID: number): Instruction[] {
    const module = this.#modules.get(moduleID);
    if (module === undefined) {
      throw new ReferenceError(`No module with id ${moduleID}`);
    }
    return module;
  }
  #sizeOf(moduleID: number): number {
    return this.#getModule(moduleID).length;
  }
  #push(moduleID: number, instr: Instruction): number {
    return this.#getModule(moduleID).push(instr) - 1;
  }

  #compileExpression(module: number, expr: Expression): void {
    this.#positions.set(
      `${module}-${this.#getModule(module).length}`,
      expr.position
    );
    switch (expr.type) {
      case "literal": {
        const literal = this.#literals.get(expr.value);
        this.#push(module, { type: "literal", literal });
        break;
      }
      case "bracketed": {
        this.#compileExpression(module, expr.expression);
        break;
      }
      case "call": {
        for (const [i, param] of expr.parameters.entries()) {
          this.#push(module, {
            type: "read",
            variable: this.#variables.get(`module$${expr.name}$${i}`),
          });
          this.#compileExpression(module, param);
          this.#push(module, { type: "assign" });
        }
        this.#push(module, {
          type: "call",
          module: this.#moduleIDs.get(expr.name),
        });
        this.#push(module, {
          type: "read",
          variable: this.#variables.get(expr.name),
        });
        for (const i of expr.parameters.keys()) {
          this.#push(module, {
            type: "drop",
            variable: this.#variables.get(`module$${expr.name}$${i}`),
          });
        }
        break;
      }
      case "index": {
        this.#compileExpression(module, expr.subject);
        this.#compileExpression(module, expr.index);
        this.#push(module, { type: "index" });
        break;
      }
      case "binary-operator": {
        this.#compileExpression(module, expr.left);
        this.#compileExpression(module, expr.right);
        if (expr.operator === "not-equals") {
          this.#push(module, { type: "binary-operator-equals" });
          this.#push(module, { type: "not" });
        } else {
          this.#push(module, { type: `binary-operator-${expr.operator}` });
        }
        break;
      }
      case "unary-operator": {
        switch (expr.operator) {
          case "not": {
            this.#compileExpression(module, expr.value);
            this.#push(module, { type: "not" });
            break;
          }
          case "negate": {
            this.#push(module, {
              type: "literal",
              literal: this.#literals.get(0),
            });
            this.#compileExpression(module, expr.value);
            this.#push(module, { type: "binary-operator-minus" });
            break;
          }
        }
        break;
      }
      case "identifier": {
        switch (expr.name) {
          case "true":
            this.#push(module, {
              type: "literal",
              literal: this.#literals.get(true),
            });
            break;
          case "false":
            this.#push(module, {
              type: "literal",
              literal: this.#literals.get(false),
            });
            break;
          default:
            this.#push(module, {
              type: "read",
              variable: this.#variables.get(expr.name),
            });
        }
        break;
      }
    }
  }

  #tempVarID = 0;
  #compileStatement(module: number, statement: Statement): void {
    this.#positions.set(
      `${module}-${this.#getModule(module).length}`,
      statement.position
    );
    switch (statement.type) {
      case "assignment": {
        this.#compileExpression(module, statement.to);
        this.#compileExpression(module, statement.value);
        this.#push(module, { type: "assign" });
        break;
      }
      case "if": {
        this.#compileExpression(module, statement.condition);
        const branchAddress = this.#push(module, { type: "placeholder" });
        if (statement.else !== undefined) {
          this.#compileStatements(module, statement.else);
        }
        const jumpEndAddress = this.#push(module, { type: "placeholder" });
        this.#getModule(module)[branchAddress] = {
          type: "branch",
          to: this.#sizeOf(module),
        };
        this.#compileStatements(module, statement.then);
        this.#getModule(module)[jumpEndAddress] = {
          type: "jump",
          to: this.#sizeOf(module),
        };
        break;
      }
      case "case": {
        const tempVariable = this.#variables.get(`$${this.#tempVarID++}`);
        this.#push(module, { type: "read", variable: tempVariable });
        this.#compileExpression(module, statement.value);
        this.#push(module, { type: "assign" });

        const branchAddresses: number[] = [];
        for (const [i, { operator, value }] of statement.branches.entries()) {
          this.#push(module, { type: "read", variable: tempVariable });
          this.#compileExpression(module, value);
          if (operator === "not-equals") {
            this.#push(module, { type: "binary-operator-equals" });
            this.#push(module, { type: "not" });
          } else {
            this.#push(module, {
              type: `binary-operator-${operator}`,
            });
          }

          branchAddresses[i] = this.#push(module, {
            type: "placeholder",
          });
        }

        const jumpEndAddresses: number[] = [];
        for (const [i, { body }] of statement.branches.entries()) {
          this.#getModule(module)[branchAddresses[i]] = {
            type: "branch",
            to: this.#sizeOf(module),
          };
          this.#compileStatements(module, body);
          jumpEndAddresses[i] = this.#push(module, {
            type: "placeholder",
          });
        }
        for (const jumpEndAddress of jumpEndAddresses) {
          this.#getModule(module)[jumpEndAddress] = {
            type: "jump",
            to: this.#sizeOf(module),
          };
        }

        this.#push(module, { type: "drop", variable: tempVariable });
        break;
      }
      case "for": {
        const counter = this.#variables.get(statement.name);
        this.#push(module, { type: "read", variable: counter });
        this.#compileExpression(module, statement.start);
        this.#push(module, { type: "assign" });

        const end = this.#variables.get(`$${this.#tempVarID++}`);
        this.#push(module, { type: "read", variable: end });
        this.#compileExpression(module, statement.end);
        this.#push(module, { type: "assign" });

        const topAddress = this.#sizeOf(module);

        this.#push(module, { type: "read", variable: counter });
        this.#push(module, { type: "read", variable: end });
        this.#push(module, { type: "binary-operator-equals" });
        const branchEndAddress = this.#push(module, {
          type: "placeholder",
        });

        this.#compileStatements(module, statement.body);

        this.#push(module, { type: "read", variable: counter });
        this.#push(module, { type: "read", variable: counter });
        this.#push(module, { type: "literal", literal: this.#literals.get(1) });
        this.#push(module, { type: "binary-operator-plus" });
        this.#push(module, { type: "assign" });

        this.#push(module, { type: "jump", to: topAddress });

        this.#getModule(module)[branchEndAddress] = {
          type: "branch",
          to: this.#sizeOf(module),
        };
        this.#push(module, { type: "drop", variable: end });
        break;
      }
      case "while": {
        const topAddress = this.#sizeOf(module);
        this.#compileExpression(module, statement.condition);
        this.#push(module, { type: "not" });
        const branchEndAddress = this.#push(module, { type: "placeholder" });

        this.#compileStatements(module, statement.body);
        this.#push(module, { type: "jump", to: topAddress });

        this.#getModule(module)[branchEndAddress] = {
          type: "branch",
          to: this.#sizeOf(module),
        };
        break;
      }
      case "repeat": {
        const topAddress = this.#sizeOf(module);
        this.#compileStatements(module, statement.body);
        this.#compileExpression(module, statement.condition);

        const branchEndAddress = this.#push(module, { type: "placeholder" });
        this.#push(module, { type: "jump", to: topAddress });

        this.#getModule(module)[branchEndAddress] = {
          type: "branch",
          to: this.#sizeOf(module),
        };
        break;
      }
      case "module": {
        const submodule = this.#moduleIDs.get(statement.name);
        this.#modules.set(submodule, []);
        const reverters: Array<() => void> = [];
        for (const [i, param] of statement.parameters.entries()) {
          reverters.push(
            this.#variables.alias(param, `module$${statement.name}$${i}`)
          );
        }
        this.#compileStatements(submodule, statement.body);
        for (const revert of reverters) revert();
        break;
      }
      case "call": {
        for (const [i, param] of statement.parameters.entries()) {
          this.#push(module, {
            type: "read",
            variable: this.#variables.get(`module$${statement.name}$${i}`),
          });
          this.#compileExpression(module, param);
          this.#push(module, { type: "assign" });
        }
        this.#push(module, {
          type: "call",
          module: this.#moduleIDs.get(statement.name),
        });
        for (const i of statement.parameters.keys()) {
          this.#push(module, {
            type: "drop",
            variable: this.#variables.get(`module$${statement.name}$${i}`),
          });
        }
      }
    }
  }

  #compileStatements(module: number, statements: Statement[]): void {
    for (const statement of statements) {
      this.#compileStatement(module, statement);
    }
  }

  compile(program: Statement[]): void {
    const main = this.#moduleIDs.get("$main");
    this.#modules.set(main, []);
    this.#compileStatements(main, program);
  }

  getProgram(): Program {
    return {
      literals: this.#literals.toArray(),
      modules: this.#modules,
      moduleNames: this.#moduleIDs.toArray(),
      variableNames: this.#variables.toArray(),
      positions: this.#positions,
    };
  }
}
