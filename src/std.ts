import { createInterface } from "readline";
import type { AllocatedValue, BuiltinContext, Value } from "./interpreter";

async function input(ctx: BuiltinContext): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });
  let response: AllocatedValue = ctx.interpreter.alloc({
    type: "string",
    value: await new Promise<string>((resolve) =>
      rl.question("Input:", resolve)
    ),
  });
  rl.close();
  if (/[0-9]+(?:\.[0-9]+)?/.test(response.value)) {
    response = {
      type: "number",
      value: parseFloat(response.value),
      id: response.id,
    };
  }
  ctx.set(0, response);
}
export { input as Input, input as Read };

function output(ctx: BuiltinContext): void {
  const printValue = (v: Value): string =>
    v.type === "null"
      ? "null"
      : v.type === "array"
      ? `[${v.values
          .map((id) =>
            printValue(ctx.interpreter.getVariable(id) ?? { type: "null" })
          )
          .join(", ")}]`
      : v.type === "record"
      ? `{ ${Object.entries(v.values)
          .map(
            ([key, id]) =>
              `${key}: ${printValue(
                ctx.interpreter.getVariable(id) ?? { type: "null" }
              )}`
          )
          .join(", ")} }`
      : v.value.toString();
  console.log(ctx.array().map(printValue).join(""));
}
export { output as Output, output as Write };
