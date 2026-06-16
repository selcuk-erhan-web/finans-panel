const { parseMoneyInput, parseMoneyInputRequired } = require("../utils/money");
const { parseTransactionAmount } = require("../lib/finance");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function eq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: got ${actual}, want ${expected}`);
}

const cases = [
  ["42.357,00", 42357],
  ["153.662,50", 153662.5],
  ["1.250,75", 1250.75],
  ["42357", 42357],
  ["42357.00", 42357],
  ["42357,00", 42357],
  ["42.357", 42357],
  ["₺42.357,00", 42357],
  ["42.357 TL", 42357],
];

cases.forEach(([input, want]) => eq(parseMoneyInput(input), want, input));

assert(parseMoneyInput("abc") === null, "abc");
assert(parseMoneyInput("") === null, "empty");
assert(parseMoneyInput("---") === null, "dashes");

eq(parseMoneyInputRequired("42.357,00"), 42357, "required 42.357,00");
eq(parseTransactionAmount("153.662,50"), 153663, "transaction round 153662.5");
eq(parseTransactionAmount("42357"), 42357, "plain 42357");

try {
  parseMoneyInputRequired("abc");
  throw new Error("should throw on abc");
} catch (e) {
  assert(e.message === "Tutar geçerli değil", "error message");
}

console.log("✓ money input tests passed");
