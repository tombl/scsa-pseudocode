import { Compiler, Program } from "./compiler";
import { highlight } from "./highlighter";
import { Lexer, Token } from "./lexer";
import { parseStatements, Statement } from "./parser";
import { Tokens } from "./parser/tokens";

export type { Program };
export { highlight };
export * from "./interpreter";
export * as std from "./std";
export * from "./errors";

export function compile(code: string): {
  tokens: Token[];
  ast: Statement[];
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
  return {
    tokens,
    ast: parsed,
    program: compiler.getProgram(),
    highlightedCode,
  };
}
