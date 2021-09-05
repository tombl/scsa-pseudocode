import { LexerError } from "./errors";

export interface NumberToken {
  type: "number";
  value: string;
}
export interface StringToken {
  type: "string";
  contents: string;
  quote: "'" | '"';
}
export interface CommentToken {
  type: "comment";
  text: string;
}
export interface IdentifierToken {
  type: "identifier";
  name: string;
}

export interface Token {
  source: string;
  line: number;
  column: number;
  data:
    | NumberToken
    | StringToken
    | CommentToken
    | IdentifierToken
    | ":"
    | "<-"
    | ","
    | "."
    | "("
    | ")"
    | "["
    | "]"
    | "="
    | "≠"
    | "+"
    | "-"
    | "÷"
    | "×"
    | "<"
    | "⩽"
    | ">"
    | "⩾"
    | "and"
    | "or"
    | "not"
    | "End"
    | "If"
    | "then"
    | "Else"
    | "Case"
    | "of"
    | "For"
    | "While"
    | "Repeat"
    | "Until"
    | "to"
    | "Module";
}

export class Lexer {
  #code;
  readonly #originalCode;
  constructor(code: string) {
    this.#code = this.#originalCode = code;
  }

  #line = 0;
  #column = 0;
  #increment(code: string): void {
    this.#code = this.#code.slice(code.length);
    for (const char of code) {
      if (char === "\n") {
        this.#line++;
        this.#column = 0;
      } else {
        this.#column++;
      }
    }
  }

  #constant<T extends string>(...choices: T[]): T | null {
    for (const choice of choices.sort((a, b) => b.length - a.length)) {
      if (this.#code.startsWith(choice)) {
        if (
          /[a-z]/i.test(choice[choice.length - 1]) &&
          this.#code !== choice &&
          /[a-z]/i.test(this.#code[choice.length])
        ) {
          continue;
        }

        this.#increment(choice);
        return choice;
      }
    }
    return null;
  }
  #takeWhile(predicate: (char: string) => boolean): string {
    let matched = "";
    while (this.#code.length > 0 && predicate(this.#code[0])) {
      matched += this.#code[0];
      this.#increment(this.#code[0]);
    }
    return matched;
  }

  #lex(): Token | null {
    this.#takeWhile((char) => char === " " || char === "\n");

    const token = {
      column: this.#column,
      line: this.#line,
    };

    if (this.#constant("//")) {
      const text = this.#takeWhile((char) => char !== "\n");
      return { ...token, source: `//${text}`, data: { type: "comment", text } };
    }

    const literal = this.#constant(
      ":",
      "<-",
      ",",
      ".",
      "(",
      ")",
      "[",
      "]",
      "!=",
      "≠",
      "=",
      "+",
      "-",
      "/",
      "÷",
      "*",
      "×",
      "and",
      "or",
      "not",
      "<=",
      "⩽",
      "<",
      ">=",
      "⩾",
      ">",
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
      "Module"
    );
    if (literal !== null) {
      return {
        ...token,
        source: literal,
        data:
          literal === "/"
            ? "÷"
            : literal === "*"
            ? "×"
            : literal === "!="
            ? "≠"
            : literal === "<="
            ? "⩽"
            : literal === ">="
            ? "⩾"
            : literal,
      };
    }

    {
      const number = this.#takeWhile((char) => /[0-9]/.test(char));
      if (number !== "") {
        return {
          ...token,
          source: number,
          data: { type: "number", value: number },
        };
      }
    }

    {
      const line = this.#line;
      const column = this.#column;
      const quote = this.#constant("'", '"');
      if (quote !== null) {
        const contents = this.#takeWhile((char) => char !== quote);
        if (this.#constant(quote) === null) {
          throw new LexerError("Unterminated quote", {
            line,
            column,
            code: this.#originalCode,
            bottom: "Encountered quote here, but the error might be earlier",
          });
        }
        return {
          ...token,
          source: `${quote}${contents}${quote}`,
          data: { type: "string", quote, contents },
        };
      }
    }

    {
      const identifier = this.#takeWhile((char) => /[A-Za-z]/.test(char));
      if (identifier !== "") {
        return {
          ...token,
          source: identifier,
          data: { type: "identifier", name: identifier },
        };
      }
    }

    return null;
  }

  *[Symbol.iterator](): Generator<Token, void, void> {
    while (this.#code.trim() !== "") {
      const token = this.#lex();
      if (token === null) {
        throw new LexerError("Unexpected character", {
          line: this.#line,
          column: this.#column,
          code: this.#originalCode,
        });
      }
      yield token;
    }
  }
}
