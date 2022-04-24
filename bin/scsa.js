#!/bin/node --enable-source-maps
import { readFile } from "fs/promises";
import { compile, Interpreter, std } from "../dist/index.js";

const code = await readFile(process.argv[2], "utf8");

try {
  const { tokens, ast, program, highlightedCode } = compile(code);

  switch (process.argv[3]) {
    case "tokens": {
      for (const t of tokens) {
        if (typeof t.data === "string") {
          console.log(t.data);
        } else {
          console.log(
            Object.entries(t.data)
              .map(([key, value]) =>
                key === "type" ? value : `${key}: ${JSON.stringify(value)}`
              )
              .join(" ")
          );
        }
      }
      break;
    }
    case "highlight": {
      console.log(highlightedCode);
      break;
    }
    case "ast": {
      console.log(
        JSON.stringify(
          ast,
          (key, value) => (key === "position" ? undefined : value),
          2
        )
      );
      break;
    }
    case "bytecode": {
      for (const [moduleId, module] of program.modules) {
        console.log(`Module ${program.moduleNames[moduleId]}`);
        for (const [index, instr] of module.entries()) {
          console.log(
            `${index
              .toString()
              .padStart(module.length.toString().length)}: ${Object.entries(
              instr
            )
              .map(([key, value]) => {
                switch (key) {
                  case "type":
                    return value;
                  case "variable":
                    return program.variableNames[value];
                  case "literal":
                    return JSON.stringify(program.literals[value]);
                  case "module":
                    return program.moduleNames[value];
                  default:
                    return `${key} ${value}`;
                }
              })
              .join(" ")}`
          );
        }
      }
      break;
    }
    default: {
      await new Interpreter(program, highlightedCode, {
        builtins: { ...std },
      }).main();
    }
  }
} catch (error) {
  console.error(error.toString());
  if (error._showStack !== false) {
    console.error(error.stack);
  }
  process.exitCode = 1;
}
