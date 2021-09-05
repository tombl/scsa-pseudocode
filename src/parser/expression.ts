import type { IdentifierToken, NumberToken, StringToken } from "../lexer";
import { Tokens } from "./tokens";
import type {
  BinaryOperatorExpression,
  BracketedExpression,
  CallExpression,
  Expression,
  IdentifierExpression,
  IndexExpression,
  LiteralExpression,
  UnaryOperatorExpression,
} from "./types/expression";

function parseIndexExpression(tokens: Tokens): IndexExpression | null {
  const position = tokens.position();
  const subject = parseExpression(tokens, true);
  if (subject === null) return null;

  let index: Expression;
  if (tokens.matchAndPop("[")) {
    const idx = parseExpression(tokens);
    if (idx === null) throw tokens.makeError("Expected expression");
    index = idx;
    if (!tokens.matchAndPop("]")) throw tokens.makeError("Expected ']'");
  } else if (tokens.matchAndPop(".") && tokens.match({ type: "identifier" })) {
    const indexPosition = tokens.position();
    const token = tokens.pop()?.data as IdentifierToken;
    index = { position: indexPosition, type: "literal", value: token.name };
  } else {
    return null;
  }

  return { position, type: "index", subject, index };
}

const BINARY_OPERATORS = {
  "=": "equals",
  "≠": "not-equals",
  "+": "plus",
  "-": "minus",
  "÷": "divide",
  "×": "multiply",
  and: "and",
  or: "or",
  "<": "lt",
  "⩽": "lte",
  ">": "gt",
  "⩾": "gte",
} as const;
function parseBinaryOperator(tokens: Tokens): BinaryOperatorExpression | null {
  const left = parseExpression(tokens, true);
  if (left === null) return null;

  const position = tokens.position();
  const operator = tokens.pop()?.data;
  if (typeof operator !== "string" || !(operator in BINARY_OPERATORS)) {
    return null;
  }

  const right = parseExpression(tokens);
  if (right === null) throw tokens.makeError("Expected expression");

  return {
    position,
    type: "binary-operator",
    left,
    operator: BINARY_OPERATORS[operator as keyof typeof BINARY_OPERATORS],
    right,
  };
}

function parseLiteral(tokens: Tokens): LiteralExpression | null {
  const position = tokens.position();

  if (tokens.match({ type: "number" })) {
    const token = tokens.pop()?.data as NumberToken;
    let number = parseInt(token.value);
    if (tokens.matchAndPop(".")) {
      if (!tokens.match({ type: "number" }))
        throw tokens.makeError("Expected number");
      const decimalToken = tokens.pop()?.data as NumberToken;
      number += parseFloat(`0.${decimalToken.value}`);
    }
    return { position, type: "literal", value: number };
  }

  if (tokens.match({ type: "string" })) {
    const string = tokens.pop()?.data as StringToken;
    return { position, type: "literal", value: string.contents };
  }

  return null;
}

function parseBracketed(tokens: Tokens): BracketedExpression | null {
  const position = tokens.position();
  if (!tokens.matchAndPop("(")) return null;

  const expression = parseExpression(tokens);
  if (expression === null) return null;

  if (!tokens.matchAndPop(")")) throw tokens.makeError("Expected ')'");

  return { position, type: "bracketed", expression };
}

const UNARY_OPERATORS = { "-": "negate", not: "not" } as const;
function parseUnaryOperator(tokens: Tokens): UnaryOperatorExpression | null {
  const position = tokens.position();
  for (const [token, operator] of Object.entries(UNARY_OPERATORS) as Array<
    [
      keyof typeof UNARY_OPERATORS,
      typeof UNARY_OPERATORS[keyof typeof UNARY_OPERATORS]
    ]
  >) {
    if (tokens.matchAndPop(token)) {
      const expression = parseExpression(tokens);
      if (expression === null) throw tokens.makeError("Expected expression");
      return { position, type: "unary-operator", value: expression, operator };
    }
  }

  return null;
}

export function parseCall(tokens: Tokens): CallExpression | null {
  const position = tokens.position();
  if (!(tokens.match({ type: "identifier" }) && tokens.match("(", 1))) {
    return null;
  }

  const name = tokens.pop()?.data as IdentifierToken;
  tokens.pop();

  const parameters: Expression[] = [];
  while (!tokens.matchAndPop(")")) {
    const parameter = parseExpression(tokens);
    if (parameter === null) throw tokens.makeError("Expected expression");

    parameters.push(parameter);

    if (!(tokens.matchAndPop(",") || tokens.match(")"))) {
      throw tokens.makeError("Expected ','");
    }
  }

  return { position, type: "call", name: name.name, parameters };
}

function parseIdentifier(tokens: Tokens): IdentifierExpression | null {
  const position = tokens.position();
  if (!tokens.match({ type: "identifier" })) return null;
  const identifier = tokens.pop()?.data as IdentifierToken;
  return { position, type: "identifier", name: identifier.name };
}

export const parseExpression = Tokens.chain<Expression>(
  [parseIndexExpression, { recursive: true }],
  [parseBinaryOperator, { recursive: true }],
  parseLiteral,
  parseBracketed,
  parseUnaryOperator,
  parseCall,
  parseIdentifier
);
