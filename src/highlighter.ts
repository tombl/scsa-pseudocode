import ansi from "ansi-styles";
import type { Token } from "./lexer";

interface WrappedChar {
  prefix: string;
  char: string;
  suffix: string;
}

const KEYWORDS = new Set([
  "and",
  "or",
  "not",
  "End",
  "If",
  "then",
  "Else",
  "Case",
  "of",
  "For",
  "While",
  "Repeat",
  "Until",
  "to",
  "Module",
]);

const SYMBOLS = new Set([
  "<-",
  "=",
  "≠",
  "+",
  "-",
  "÷",
  "×",
  "<",
  "⩽",
  ">",
  "⩾",
]);

const COLORS: Record<string, string> = {
  number: ansi.yellow.open,
  string: ansi.green.open,
  comment: ansi.dim.open,
  moduleName: ansi.blue.open + ansi.modifier.bold.open,
  boolean: ansi.yellow.open,
  identifier: ansi.redBright.open + ansi.modifier.italic.open,
  keyword: ansi.magenta.open + ansi.modifier.italic.open,
  symbol: ansi.cyan.open,
};

function tokenType(token: Token) {
  return typeof token.data === "object"
    ? token.data.type
    : KEYWORDS.has(token.data)
    ? "keyword"
    : SYMBOLS.has(token.data)
    ? "symbol"
    : token.data;
}

export function highlight(tokens: Token[]): string {
  const lengths: number[] = [];
  for (const token of tokens) {
    lengths[token.line] ??= 0;
    const length = token.column + token.source.length;
    if (lengths[token.line] < length) {
      lengths[token.line] = length;
    }
  }

  const lines: WrappedChar[][] = [];
  for (const [line, length = 0] of lengths.entries()) {
    lines[line] = [];
    for (let column = 0; column < length; column++) {
      lines[line][column] = { prefix: "", char: " ", suffix: "" };
    }
  }

  for (const [tokenIndex, token] of tokens.entries()) {
    for (const [offset, char] of [...token.source].entries()) {
      lines[token.line][token.column + offset].char = char;
    }

    const start = lines[token.line][token.column];
    const end = lines[token.line][token.column + token.source.length - 1] ?? {};

    const nextToken: Token | undefined = tokens[tokenIndex + 1];
    const nextTokenType =
      nextToken === undefined ? undefined : tokenType(nextToken);

    let type =
      typeof token.data === "object" &&
      token.data.type === "identifier" &&
      (token.data.name === "true" ||
        token.data.name === "false" ||
        token.data.name === "null")
        ? "boolean"
        : tokenType(token);
    if (type === "identifier" && nextTokenType === "(") {
      type = "moduleName";
    }

    start.prefix = COLORS[type] ?? "";
    end.suffix = ansi.reset.close;
  }

  return lines
    .map((line) =>
      line.map(({ prefix, char, suffix }) => prefix + char + suffix).join("")
    )
    .join("\n");
}
