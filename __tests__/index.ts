import { jest } from "@jest/globals";
import { compile, Interpreter, std } from "../src";

async function execute(
  code: string,
  send: (value: string | number | boolean | null) => void
): Promise<void> {
  const { program, highlightedCode } = compile(code);
  await new Interpreter(program, highlightedCode, {
    builtins: {
      Output: std.Output,
      send(ctx) {
        const value = ctx.get(0);
        if (value === undefined) {
          throw new Error("no value");
        }
        send(
          value.type === "string" ||
            value.type === "number" ||
            value.type === "boolean"
            ? value.value
            : null
        );
      },
    },
  }).main();
}

test("builtin calls", async () => {
  const send = jest.fn();
  await execute(`send(1)`, send);
  expect(send).toHaveBeenLastCalledWith(1);
  await execute(`send("hi")`, send);
  expect(send).toHaveBeenLastCalledWith("hi");
  await execute(`send(true)`, send);
  expect(send).toHaveBeenLastCalledWith(true);
});

test("assignment", async () => {
  const send = jest.fn();
  await execute(
    `
      x <- 1
      send(x)
    `,
    send
  );
  expect(send).toHaveBeenCalledWith(1);
});

describe("if", () => {
  it("no else", async () => {
    const send = jest.fn();
    await execute(
      `
        If true then
          send(true)
        End If
      `,
      send
    );
    expect(send).toHaveBeenLastCalledWith(true);
    await execute(
      `
        If false then
          send(true)
        End If
      `,
      send
    );
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("else", async () => {
    const send = jest.fn();
    await execute(
      `
        If true then
          send(true)
        Else
          send(false)
        End If
      `,
      send
    );
    expect(send).toHaveBeenLastCalledWith(true);

    await execute(
      `
        If false then
          send(true)
        Else
          send(false)
        End If
      `,
      send
    );
    expect(send).toHaveBeenLastCalledWith(false);
  });
});

test("parser", () => {
  const code = `
// comment

Assignment <- Identifier
Assignment <- Index.Static
Assignment <- Index["Computed"]
Assignment <- "String"
Assignment <- 'Also string'
Assignment <- 1234
Assignment <- 1234.5678
Assignment <- (Bracketed)
Assignment <- 1 + 1
Assignment <- Call()
Assignment <- not UnaryOperator

If true then
    Output("If")
End If

If false then
    Output("If true")
Else
    Output("If false")
End If

Case 1 of
    = 1 : Output(1)
    = 2 : Output(2)
    >= 3 : Output(3)
End Case

For n <- 1 to 10
    Output(n)
End For

While false
    Output("While")
End While

Repeat
    Output("While")
Until false

Module NoParams
    Output("Hello from NoParams")
End NoParams

Module HasParams(x, y, z)
    Output("Hello from HasParams")
End HasParams

NoParams()
HasParams(1, 2, 3)`;

  expect(() => compile(code)).not.toThrow();
});
