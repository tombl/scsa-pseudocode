import { parseCall, parseExpression } from "./expression";
import { Tokens } from "./tokens";
import type {
  AssignmentStatement,
  CaseStatement,
  ForStatement,
  IfStatement,
  ModuleStatement,
  RepeatStatement,
  Statement,
  WhileStatement,
} from "./types/statement";

function parseAssignment(tokens: Tokens): AssignmentStatement | null {
  const position = tokens.position();
  const to = parseExpression(tokens);
  if (to === null) return null;

  if (!tokens.matchAndPop("<-")) return null;

  const value = parseExpression(tokens);
  if (value === null) throw tokens.makeError("Expected expression");

  return { position, type: "assignment", to, value };
}

function parseIf(tokens: Tokens): IfStatement | null {
  const position = tokens.position();
  if (!tokens.matchAndPop("If")) return null;

  const condition = parseExpression(tokens);
  if (condition === null) throw tokens.makeError("Expected expression");

  if (!tokens.matchAndPop("then")) throw tokens.makeError("Expected 'then'");

  const body = [
    ...parseStatements(tokens, (t) => t.match("End") || t.match("Else")),
  ];

  const elseBody = tokens.matchAndPop("Else")
    ? [...parseStatements(tokens, (t) => t.match("End"))]
    : undefined;

  if (!tokens.matchAndPop("End")) throw tokens.makeError("Expected 'End If'");
  if (!tokens.matchAndPop("If")) throw tokens.makeError("Expected 'End If'");

  return { position, type: "if", condition, then: body, else: elseBody };
}

function parseCase(tokens: Tokens): CaseStatement | null {
  const position = tokens.position();
  if (!tokens.matchAndPop("Case")) return null;

  const value = parseExpression(tokens);
  if (value === null) throw tokens.makeError("Expected expression");

  if (!tokens.matchAndPop("of")) throw tokens.makeError("Expected 'of'");

  const branches: CaseStatement["branches"] = [];
  while (!tokens.match("End")) {
    const operatorToken = tokens.pop();

    const operator: CaseStatement["branches"][number]["operator"] | null =
      operatorToken?.data === "="
        ? "equals"
        : operatorToken?.data === "≠"
        ? "not-equals"
        : operatorToken?.data === "<"
        ? "lt"
        : operatorToken?.data === "⩽"
        ? "lte"
        : operatorToken?.data === ">"
        ? "gt"
        : operatorToken?.data === "⩾"
        ? "gte"
        : null;

    if (operator === null) {
      throw tokens.makeError(
        "Expected one of: '=', '≠', '<', '⩽', '>', '⩾'",
        {},
        operatorToken
      );
    }

    const value = parseExpression(tokens);
    if (value === null) throw tokens.makeError("Expected expression");

    if (!tokens.matchAndPop(":")) throw tokens.makeError("Expected ':'");

    const body = [
      ...parseStatements(tokens, (t) => {
        if (t.match("End")) return true;
        t = t.clone();
        if (
          !(
            t.matchAndPop("=") ||
            t.matchAndPop("≠") ||
            t.matchAndPop("<") ||
            t.matchAndPop("⩽") ||
            t.matchAndPop(">") ||
            t.matchAndPop("⩾")
          )
        ) {
          return false;
        }
        const expr = parseExpression(t);
        if (expr === null) return false;
        if (!t.matchAndPop(":")) return false;
        return true;
      }),
    ];

    branches.push({ value, operator, body });
  }

  if (!tokens.matchAndPop("End")) throw tokens.makeError("Expected 'End Case'");
  if (!tokens.matchAndPop("Case")) {
    throw tokens.makeError("Expected 'End Case'");
  }

  return { position, type: "case", value, branches };
}

function parseFor(tokens: Tokens): ForStatement | null {
  const position = tokens.position();
  if (!tokens.matchAndPop("For")) return null;

  const name = tokens.pop()?.data;
  if (typeof name !== "object" || name.type !== "identifier") {
    throw tokens.makeError("Expected identifier");
  }

  if (!tokens.matchAndPop("<-")) throw tokens.makeError("Expected '<-'");

  const start = parseExpression(tokens);
  if (start === null) throw tokens.makeError("Expected expression");

  if (!tokens.matchAndPop("to")) throw tokens.makeError("Expected 'to'");

  const end = parseExpression(tokens);
  if (end === null) throw tokens.makeError("Expected expression");

  const body = [...parseStatements(tokens, (t) => t.match("End"))];

  if (!tokens.matchAndPop("End")) throw tokens.makeError("Expected 'End For'");
  if (!tokens.matchAndPop("For")) throw tokens.makeError("Expected 'End For'");

  return { position, type: "for", name: name.name, start, end, body };
}

function parseWhile(tokens: Tokens): WhileStatement | null {
  const position = tokens.position();
  if (!tokens.matchAndPop("While")) return null;

  const condition = parseExpression(tokens);
  if (condition === null) throw tokens.makeError("Expected expression");

  const body = [...parseStatements(tokens, (t) => t.match("End"))];

  if (!tokens.matchAndPop("End"))
    throw tokens.makeError("Expected 'End While'");
  if (!tokens.matchAndPop("While")) {
    throw tokens.makeError("Expected 'End While'");
  }

  return { position, type: "while", condition, body };
}

function parseRepeat(tokens: Tokens): RepeatStatement | null {
  const position = tokens.position();
  if (!tokens.matchAndPop("Repeat")) return null;

  const body = [...parseStatements(tokens, (t) => t.match("Until"))];

  if (!tokens.matchAndPop("Until")) throw tokens.makeError("Expected 'Until'");

  const condition = parseExpression(tokens);
  if (condition === null) throw tokens.makeError("Expected expression");

  return { position, type: "repeat", body, condition };
}

function parseModule(tokens: Tokens): ModuleStatement | null {
  const position = tokens.position();
  if (!tokens.matchAndPop("Module")) return null;

  const name = tokens.pop();
  if (typeof name?.data !== "object" || name.data.type !== "identifier") {
    throw tokens.makeError("Expected identifier", {}, name);
  }

  const parameters: string[] = [];
  if (tokens.matchAndPop("(")) {
    while (!tokens.matchAndPop(")")) {
      const parameter = tokens.pop();
      if (
        typeof parameter?.data !== "object" ||
        parameter.data.type !== "identifier"
      ) {
        throw tokens.makeError("Expected identifier", {}, parameter);
      }

      parameters.push(parameter.data.name);

      if (!(tokens.matchAndPop(",") || tokens.match(")"))) {
        throw tokens.makeError("Expected ','");
      }
    }
  }

  const body = [...parseStatements(tokens, (t) => t.match("End"))];

  if (!tokens.matchAndPop("End"))
    throw tokens.makeError(`Expected 'End ${name.data.name}'`);
  if (!tokens.matchAndPop({ type: "identifier", name: name.data.name })) {
    throw tokens.makeError(`Expected 'End ${name.data.name}'`);
  }

  return { position, type: "module", name: name.data.name, parameters, body };
}

const parseStatement = Tokens.chain<Statement>(
  parseAssignment,
  parseIf,
  parseCase,
  parseFor,
  parseWhile,
  parseRepeat,
  parseModule,
  parseCall
);

export function* parseStatements(
  tokens: Tokens,
  terminate?: (tokens: Tokens) => boolean
): Generator<Statement, void, void> {
  for (;;) {
    const statement = parseStatement(tokens);

    if (statement === null) {
      const topToken = tokens.peek();
      if (topToken === undefined || terminate?.(tokens)) {
        break;
      } else {
        throw tokens.makeError(
          `Unexpected ${
            typeof topToken.data === "object"
              ? topToken.data.type
              : topToken.data
          }`,
          {},
          topToken
        );
      }
    }

    yield statement;
  }
}
