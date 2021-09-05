#!/bin/node --enable-source-maps
import { readFile } from "fs/promises";
import { compile, Interpreter, std } from "../dist/index.js";

const code = await readFile(process.argv[2], "utf8");
try {
  const { program, highlightedCode } = compile(code);
  await new Interpreter(program, highlightedCode, {
    builtins: { ...std },
  }).main();
} catch (error) {
  console.error(error.toString());
  if (error._showStack !== false) {
    console.error(error.stack);
  }
  process.exitCode = 1;
}
