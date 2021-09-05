import ansi from "ansi-styles";

abstract class CodeError extends Error {
  abstract name: string;
  public line: number;
  public column: number;
  public code: string;
  public bottom?: string;
  public annotation?: string;

  constructor(
    message: string,
    {
      line,
      column,
      code,
      bottom,
      annotation,
    }: {
      line: number;
      column: number;
      code: string;
      bottom?: string;
      annotation?: string;
    }
  ) {
    super(message);
    this.line = line;
    this.column = column === -1 ? 0 : column;
    this.code = code;
    this.bottom = bottom;
    this.annotation = annotation;
  }

  toString(): string {
    const lines = this.code.split("\n");
    const before = lines[this.line - 1];
    const line = lines[this.line];
    const after = lines[this.line + 1];
    const padSize = (this.line + 1).toString().length + 1;
    const msg = [
      `${ansi.red.open}${this.name}:${ansi.red.close} ${this.message} ${
        ansi.gray.open
      }at ${this.line + 1}:${this.column}${ansi.gray.close}`,
    ];
    if (before !== undefined) {
      msg.push(
        `${ansi.gray.open}${this.line.toString().padStart(padSize, " ")} │${
          ansi.gray.close
        } ${before}`
      );
    }
    msg.push(
      `${ansi.gray.open}${(this.line + 1).toString().padStart(padSize, " ")} │${
        ansi.gray.close
      } ${line}`
    );
    msg.push(
      `${" ".repeat(padSize)} ${ansi.gray.open}│${ansi.gray.close} ${" ".repeat(
        this.column
      )}${ansi.red.open}^${ansi.red.close}${
        this.annotation === undefined ? "" : ` ${this.annotation}`
      }`
    );
    if (after !== undefined && after !== "") {
      msg.push(
        `${ansi.gray.open}${(this.line + 2)
          .toString()
          .padStart(padSize, " ")} │${ansi.gray.close} ${after}`
      );
    }
    if (this.bottom !== undefined) {
      msg.push(this.bottom);
    }
    return msg.join("\n");
  }

  _showStack = false;
}

export class LexerError extends CodeError {
  name = "LexerError";
}

export class ParserError extends CodeError {
  name = "ParserError";
}

export class ExecutionError extends CodeError {
  name = "ExecutionError";
}
