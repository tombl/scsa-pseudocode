import { Compiler, Program } from "./compiler";
import { highlight } from "./highlighter";
import { Lexer } from "./lexer";
import { parseStatements } from "./parser";
import { Tokens } from "./parser/tokens";

export type { Program };
export { highlight };
export * from "./interpreter";
export * as std from "./std";
export * from "./errors";

export function compile(code: string): {
  program: Program;
  highlightedCode: string;
} {
  const tokens = [...new Lexer(code)];
  const highlightedCode = highlight(tokens);
  const parsed = [
    ...parseStatements(new Tokens(tokens, code, highlightedCode)),
  ];
  const compiler = new Compiler();
  compiler.compile(parsed);
  return { program: compiler.getProgram(), highlightedCode };
}
