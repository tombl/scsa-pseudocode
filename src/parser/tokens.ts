import { ParserError } from "../errors";
import type { Token } from "../lexer";
import type { Position } from "./types/shared";

export class Tokens {
  #tokens: Token[];
  readonly #code: string;
  readonly #highlightedCode: string;

  constructor(tokens: Token[], code: string, highlightedCode: string) {
    this.#tokens = tokens.filter(
      (token) =>
        !(typeof token.data === "object" && token.data.type === "comment")
    );
    this.#code = code;
    this.#highlightedCode = highlightedCode;
  }

  position(): Position {
    const token = this.peek();
    const lines = this.#code.split("\n");
    return {
      line: token?.line ?? lines.length - 1,
      column: token?.column ?? lines[lines.length - 1].length - 1,
    };
  }

  clone(): Tokens {
    return new Tokens([...this.#tokens], this.#code, this.#highlightedCode);
  }
  peek(index = 0): Token | undefined {
    return this.#tokens[index];
  }
  match(matcher: Partial<Token["data"]>, index?: number): boolean {
    const token = this.peek(index);
    if (token === undefined) {
      return false;
    }
    if (typeof matcher === "object") {
      if (typeof token.data !== "object") return false;
      for (const [key, value] of Object.entries(matcher)) {
        if ((token.data as unknown as Record<string, unknown>)[key] !== value) {
          return false;
        }
      }
      return true;
    } else {
      return token.data === matcher;
    }
  }
  matchAndPop(matcher: Partial<Token["data"]>): boolean {
    const matched = this.match(matcher);
    if (matched) {
      this.pop();
    }
    return matched;
  }
  pop(): Token | undefined {
    return this.#tokens.shift();
  }

  makeError(
    message: string,
    { annotation, bottom }: { annotation?: string; bottom?: string } = {},
    token = this.peek()
  ): Error {
    const lines = this.#code.split("\n");
    return new ParserError(message, {
      annotation,
      bottom,
      line: token?.line ?? lines.length - 1,
      column: token?.column ?? lines[lines.length - 1].length - 1,
      code: this.#highlightedCode,
    });
  }

  static chain<T>(
    ...handlers: Array<
      | ((tokens: Tokens) => T | null)
      | [(tokens: Tokens) => T | null, { recursive: boolean }]
    >
  ): (tokens: Tokens, shallow?: boolean) => T | null {
    return (tokens, shallow = false) => {
      for (const handler of handlers) {
        if (typeof handler === "object" && handler[1].recursive && shallow) {
          continue;
        }
        const cloned = tokens.clone();
        const got = (typeof handler === "function" ? handler : handler[0])(
          cloned
        );
        if (got !== null) {
          tokens.#tokens = cloned.#tokens;
          return got;
        }
      }
      return null;
    };
  }
}
