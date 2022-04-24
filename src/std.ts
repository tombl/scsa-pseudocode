import { createInterface } from "readline";
import type { BuiltinContext, Value } from "./interpreter";

async function input(ctx: BuiltinContext): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });
  let response: Value = {
    type: "string",
    value: await new Promise<string>((resolve) =>
      rl.question("Input: ", resolve)
    ),
  };
  rl.close();
  if (/[0-9]+(?:\.[0-9]+)?/.test(response.value)) {
    response = {
      type: "number",
      value: parseFloat(response.value),
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

async function sleep(ctx: BuiltinContext): Promise<void> {
  const time = ctx.get(0);
  if (time?.type !== "number") {
    throw new TypeError("expected a number");
  }
  await new Promise((r) => setTimeout(r, time.value));
}
export { sleep as Delay, sleep as Sleep, sleep as Wait };
