import type { Program } from "./compiler";
import { ExecutionError } from "./errors";
import type { Position } from "./parser/types/shared";

export type Value =
  | StringValue
  | NumberValue
  | BooleanValue
  | NullValue
  | ArrayValue
  | RecordValue;
export interface StringValue {
  type: "string";
  value: string;
}
export interface NumberValue {
  type: "number";
  value: number;
}
export interface BooleanValue {
  type: "boolean";
  value: boolean;
}
export interface NullValue {
  type: "null";
}
export interface ArrayValue {
  type: "array";
  values: number[];
}
export interface RecordValue {
  type: "record";
  values: Record<string, number>;
}
export type AllocatedValue<T extends Value = Value> = T & { id: number };

export interface BuiltinContext {
  length: number;
  array(): AllocatedValue[];
  get(index: number): AllocatedValue | undefined;
  set(index: number, value: Value): void;
  interpreter: Interpreter;
}
export type Builtin = (ctx: BuiltinContext) => Promise<void> | void;

interface ProgramCounter {
  module: number;
  address: number;
}

const COMPILER_ERROR = "This isn't your fault, blame the compiler";
export class Interpreter {
  #program: Program;
  readonly #highlightedCode: string;
  #builtins = new Map<number, Builtin>();

  constructor(
    program: Program,
    highlightedCode: string,
    {
      builtins = {},
      variables = {},
    }: {
      builtins?: Record<string, Builtin>;
      variables?: Record<string, Value>;
    }
  ) {
    this.#program = program;
    this.#highlightedCode = highlightedCode;
    for (const [name, func] of Object.entries(builtins)) {
      const module = program.moduleNames.indexOf(name);
      if (module === -1) continue;
      this.#builtins.set(module, func);
    }
    for (const [name, value] of Object.entries({
      ...variables,
      null: { type: "null" },
    } as const)) {
      const variable = program.variableNames.indexOf(name);
      if (variable === -1) continue;
      this.#heap.set(variable, { ...value, id: variable });
    }
  }

  #stack: AllocatedValue[] = [];
  #heap = new Map<number, AllocatedValue>();
  #callStack: ProgramCounter[] = [];
  get #pc(): ProgramCounter | null {
    return this.#callStack[this.#callStack.length - 1] ?? null;
  }

  #allocID = -2;
  alloc<T extends Value>(value: T): AllocatedValue<T> {
    const id = this.#allocID--;
    const valueWithId: AllocatedValue<T> = { id, ...value };
    this.#heap.set(id, valueWithId as AllocatedValue<Value>);
    return valueWithId;
  }

  getVariable(id: number): Value | undefined {
    return this.#heap.get(id);
  }

  async main(): Promise<void> {
    await this.call("$main");
  }

  async call(module: string, parameters: AllocatedValue[] = []): Promise<void> {
    const moduleID = this.#program.moduleNames.indexOf(module);
    if (moduleID === -1) {
      throw new ReferenceError(`Module ${module} not found`);
    }
    for (const [i, param] of parameters.entries()) {
      const variableID = this.#program.variableNames.indexOf(
        `module$${module}$${i}`
      );
      if (variableID === -1) {
        throw new RangeError(
          `${module} takes ${i} arguments, not ${parameters.length}`
        );
      }
      this.#heap.set(variableID, param);
    }

    this.#callStack.push({ module: moduleID, address: 0 });
    while (this.#pc !== null) {
      await this.#runInstruction();
    }

    for (const i of parameters.keys()) {
      this.#heap.delete(
        this.#program.variableNames.indexOf(`module$${module}$${i}`)
      );
    }
  }

  #makeError(
    message: string,
    { bottom, annotation }: { bottom?: string; annotation?: string } = {}
  ): ExecutionError {
    let position: Position | undefined = undefined;
    if (this.#pc === null) {
      throw new Error(message);
    }
    let { address } = this.#pc;
    while (position === undefined && address >= 0) {
      position = this.#program.positions.get(`${this.#pc.module}-${address--}`);
    }
    return new ExecutionError(message, {
      code: this.#highlightedCode,
      line: position?.line ?? 0,
      column: position?.column ?? 0,
      bottom,
      annotation,
    });
  }

  async #runInstruction(): Promise<void> {
    if (this.#pc === null) {
      return;
    }
    const module = this.#program.modules.get(this.#pc.module);
    if (module === undefined) {
      throw new ReferenceError(
        `Module "${
          this.#program.moduleNames[this.#pc.module] ?? this.#pc.module
        }" not found`
      );
    }
    const instr = module[this.#pc.address];
    if (instr === undefined) {
      this.#callStack.pop();
      return;
    }
    const pcBefore = { ...this.#pc };
    switch (instr.type) {
      case "placeholder": {
        throw this.#makeError("Unexpected placeholder value", {
          bottom: COMPILER_ERROR,
        });
      }
      case "jump": {
        this.#pc.address = instr.to;
        break;
      }
      case "branch": {
        const condition = this.#stack.pop();
        if (condition?.type !== "boolean") {
          throw this.#makeError("Expected boolean");
        }

        if (condition.value) {
          this.#pc.address = instr.to;
        } else {
          this.#pc.address++;
        }

        break;
      }
      case "literal": {
        const value = this.#program.literals[instr.literal];
        this.#stack.push(
          typeof value === "string"
            ? this.alloc({ type: "string", value })
            : typeof value === "number"
            ? this.alloc({ type: "number", value })
            : this.alloc({ type: "boolean", value })
        );
        this.#pc.address++;
        break;
      }
      case "assign": {
        const value = this.#stack.pop();
        const target = this.#stack.pop();

        if (value === undefined) {
          throw this.#makeError("Invalid value in assignment");
        }
        if (target === undefined) {
          throw this.#makeError("Invalid left-hand side in assignment");
        }

        this.#heap.set(target.id, { ...value, id: target.id });
        this.#pc.address++;
        break;
      }
      case "call": {
        const builtin = this.#builtins.get(instr.module);
        if (builtin !== undefined) {
          const moduleName = this.#program.moduleNames[instr.module];
          const get = (index: number) =>
            this.#heap.get(
              this.#program.variableNames.indexOf(
                `module$${moduleName}$${index}`
              )
            );
          let length = 0;
          while (
            this.#heap.has(
              this.#program.variableNames.indexOf(
                `module$${moduleName}$${length}`
              )
            )
          ) {
            length++;
          }
          try {
            await builtin({
              length,
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- we determine length via definedness
              array: () => Array.from({ length }, (_, i) => get(i)!),
              get,
              set: (index, value) => {
                const variable = this.#program.variableNames.indexOf(
                  `module$${moduleName}$${index}`
                );
                console.log(
                  "set",
                  this.#program.variableNames[variable],
                  value
                );
                this.#heap.set(variable, { ...value, id: variable });
              },
              interpreter: this,
            });
          } catch (error) {
            throw this.#makeError(String(error));
          }
          this.#pc.address++;
        } else {
          this.#pc.address++;
          this.#callStack.push({ module: instr.module, address: 0 });
        }
        break;
      }
      case "read": {
        const value = this.#heap.get(instr.variable) ?? {
          type: "null",
          id: instr.variable,
        };
        this.#stack.push(value);
        this.#pc.address++;
        break;
      }
      case "drop": {
        this.#heap.delete(instr.variable);
        this.#pc.address++;
        break;
      }
      case "index": {
        const index = this.#stack.pop();
        let subject = this.#stack.pop() as AllocatedValue<
          RecordValue | ArrayValue
        >;

        if (subject === undefined) {
          throw this.#makeError("Expected identifier");
        }
        if (index?.type === "string" && subject.type !== "record") {
          subject = {
            type: "record",
            values: Object.create(null) as Record<string, unknown>,
            id: subject.id,
          } as AllocatedValue<RecordValue>;
          this.#heap.set(subject.id, subject);
        } else if (index?.type === "number" && subject.type !== "array") {
          subject = {
            type: "array",
            values: [],
            id: subject.id,
          } as AllocatedValue<ArrayValue>;
          this.#heap.set(subject.id, subject);
        } else if (index?.type !== "string" && index?.type !== "number") {
          throw this.#makeError("Expected string or number");
        }

        if (!(index.value in subject.values)) {
          (subject.values as Record<string | number, number>)[index.value] =
            this.alloc({ type: "null" }).id;
        }
        this.#stack.push(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          this.#heap.get(
            (subject.values as Record<string | number, number>)[index.value]
          )!
        );

        this.#pc.address++;
        break;
      }
      case "not": {
        const boolean = this.#stack.pop();
        if (boolean?.type !== "boolean") {
          throw this.#makeError("Expected boolean");
        }
        this.#stack.push(
          this.alloc({ type: "boolean", value: !boolean.value })
        );
        this.#pc.address++;
        break;
      }
      case "binary-operator-equals": {
        const right = this.#stack.pop();
        const left = this.#stack.pop();

        if (left === undefined)
          throw this.#makeError("Invalid left-hand side in =");
        if (right === undefined)
          throw this.#makeError("Invalid right-hand side in =");
        if (
          (left.type === "string" && right.type === "string") ||
          (left.type === "number" && right.type === "number") ||
          (left.type === "boolean" && right.type === "boolean")
        ) {
          this.#stack.push(
            this.alloc({ type: "boolean", value: left.value === right.value })
          );
        } else if (left.type === "null" && right.type === "null") {
          this.#stack.push(this.alloc({ type: "boolean", value: true }));
        } else {
          throw this.#makeError(
            `Can't compare ${left.type} with ${right.type}`
          );
        }
        this.#pc.address++;
        break;
      }
      case "binary-operator-plus": {
        const right = this.#stack.pop();
        const left = this.#stack.pop();

        if (left?.type !== "number" || right?.type !== "number") {
          throw this.#makeError(
            `Can't add ${left?.type ?? "nothing"} to ${
              right?.type ?? "nothing"
            }`
          );
        }

        this.#stack.push(
          this.alloc({ type: "number", value: left.value + right.value })
        );
        this.#pc.address++;
        break;
      }
      case "binary-operator-minus": {
        const right = this.#stack.pop();
        const left = this.#stack.pop();

        if (left?.type !== "number" || right?.type !== "number") {
          throw this.#makeError(
            `Can't subtract ${right?.type ?? "nothing"} from ${
              left?.type ?? "nothing"
            }`
          );
        }

        this.#stack.push(
          this.alloc({ type: "number", value: left.value - right.value })
        );
        this.#pc.address++;
        break;
      }
      case "binary-operator-multiply": {
        const right = this.#stack.pop();
        const left = this.#stack.pop();

        if (left?.type !== "number" || right?.type !== "number") {
          throw this.#makeError(
            `Can't multiply ${left?.type ?? "nothing"} with ${
              right?.type ?? "nothing"
            }`
          );
        }

        this.#stack.push(
          this.alloc({ type: "number", value: left.value * right.value })
        );
        this.#pc.address++;
        break;
      }
      case "binary-operator-modulo": {
        const right = this.#stack.pop();
        const left = this.#stack.pop();

        if (left?.type !== "number" || right?.type !== "number") {
          throw this.#makeError(
            `Can't modulo ${left?.type ?? "nothing"} with ${
              right?.type ?? "nothing"
            }`
          );
        }

        this.#stack.push(
          this.alloc({ type: "number", value: left.value % right.value })
        );
        this.#pc.address++;
        break;
      }
      case "binary-operator-divide": {
        const right = this.#stack.pop();
        const left = this.#stack.pop();

        if (left?.type !== "number" || right?.type !== "number") {
          throw this.#makeError(
            `Can't divide ${left?.type ?? "nothing"} by ${
              right?.type ?? "nothing"
            }`
          );
        }

        this.#stack.push(
          this.alloc({ type: "number", value: left.value / right.value })
        );
        this.#pc.address++;
        break;
      }
      case "binary-operator-and": {
        const right = this.#stack.pop();
        const left = this.#stack.pop();

        if (left?.type !== "boolean" || right?.type !== "boolean") {
          throw this.#makeError(
            `Can't divide ${left?.type ?? "nothing"} by ${
              right?.type ?? "nothing"
            }`
          );
        }

        this.#stack.push(
          this.alloc({ type: "boolean", value: left.value && right.value })
        );
        this.#pc.address++;
        break;
      }
      case "binary-operator-or": {
        const right = this.#stack.pop();
        const left = this.#stack.pop();

        if (left?.type !== "boolean" || right?.type !== "boolean") {
          throw this.#makeError(
            `Can't divide ${left?.type ?? "nothing"} by ${
              right?.type ?? "nothing"
            }`
          );
        }

        this.#stack.push(
          this.alloc({ type: "boolean", value: left.value || right.value })
        );
        this.#pc.address++;
        break;
      }
      case "binary-operator-lt": {
        const right = this.#stack.pop();
        const left = this.#stack.pop();

        if (left?.type !== "number" || right?.type !== "number") {
          throw this.#makeError(
            `Can't compare ${left?.type ?? "nothing"} and ${
              right?.type ?? "nothing"
            }`
          );
        }

        this.#stack.push(
          this.alloc({ type: "boolean", value: left.value < right.value })
        );
        this.#pc.address++;
        break;
      }
      case "binary-operator-lte": {
        const right = this.#stack.pop();
        const left = this.#stack.pop();

        if (left?.type !== "number" || right?.type !== "number") {
          throw this.#makeError(
            `Can't compare ${left?.type ?? "nothing"} and ${
              right?.type ?? "nothing"
            }`
          );
        }

        this.#stack.push(
          this.alloc({ type: "boolean", value: left.value <= right.value })
        );
        this.#pc.address++;
        break;
      }
      case "binary-operator-gt": {
        const right = this.#stack.pop();
        const left = this.#stack.pop();

        if (left?.type !== "number" || right?.type !== "number") {
          throw this.#makeError(
            `Can't compare ${left?.type ?? "nothing"} and ${
              right?.type ?? "nothing"
            }`
          );
        }

        this.#stack.push(
          this.alloc({ type: "boolean", value: left.value > right.value })
        );
        this.#pc.address++;
        break;
      }
      case "binary-operator-gte": {
        const right = this.#stack.pop();
        const left = this.#stack.pop();

        if (left?.type !== "number" || right?.type !== "number") {
          throw this.#makeError(
            `Can't compare ${left?.type ?? "nothing"} and ${
              right?.type ?? "nothing"
            }`
          );
        }

        this.#stack.push(
          this.alloc({ type: "boolean", value: left.value >= right.value })
        );
        this.#pc.address++;
        break;
      }
      default: {
        const unreachable: never = instr;
        throw new Error(unreachable);
      }
    }

    if (
      this.#pc.address === pcBefore.address &&
      this.#pc.module === pcBefore.module
    ) {
      throw this.#makeError(`PC didn't change on ${instr.type}`, {
        bottom: COMPILER_ERROR,
      });
    }
  }
}
