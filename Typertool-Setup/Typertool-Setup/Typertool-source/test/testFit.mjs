import assert from "assert";
import { buildOptionTable, fitEval, fitOptions, FIT_MARGINS, textWidth } from "../src/lib/lineBreaker.js";

// The bubble of the study: the round part is 501 x 375 px, lines are 32 px high, 48 px apart
const text = "JE VAIS VOIR LE DIRECTEUR EXÉCUTIF UN INSTANT.";
const geom = { a: 250.5, b: 187.5 };
const unitPx = 516 / textWidth("JE VAIS VOIR LE DIRECTEUR"); // the long line of the screenshot is 516 px wide
const cal = { unitPx, linePx: 48, capPx: 32 };
const table = buildOptionTable(text);
const list = fitOptions(table, geom, cal);

console.log("fit options:", list.length);
list.slice(0, 5).forEach((o, i) => console.log(" ", i + 1, "level", o.fitLevel, "fill", o.fill.toFixed(2), JSON.stringify(o.lines)));

assert(list.length > 3, "several options to choose from");
assert.strictEqual(new Set(list.map((o) => o.text)).size, list.length, "no duplicates");
// the screenshot layout (2 lines, the first as wide as the whole bubble) is NOT a fit
assert(!list.some((o) => o.lines.length === 2 && o.lines[0] === "JE VAIS VOIR LE DIRECTEUR"), "the layout that touched the circle is not offered");
list.forEach((o) => {
  assert(!o.tight, "something fits");
  // every option really fits with the margin of its level, and levels never get roomier down the list
  const e = fitEval(o, geom, cal, FIT_MARGINS[o.fitLevel] * Math.min(geom.a, geom.b));
  assert(e.worst <= 1, "fits at its margin");
  assert(o.lines.join(" ").replace(/\s+/g, " ") === text, "words kept in order");
});
for (let i = 1; i < list.length; i++) assert(list[i].fitLevel >= list[i - 1].fitLevel, "roomiest margin first");

// the best one keeps at least the roomiest margin that any option can keep
const levels = list.map((o) => o.fitLevel);
assert.strictEqual(list[0].fitLevel, Math.min(...levels));

// a bubble too small for the text: nothing fits, the closest are offered (tight)
const tiny = fitOptions(table, { a: 60, b: 45 }, cal);
assert(tiny.length > 0 && tiny.every((o) => o.tight), "closest options when nothing fits");
for (let i = 1; i < tiny.length; i++) {
  assert(fitEval(tiny[i], { a: 60, b: 45 }, cal).worst >= fitEval(tiny[i - 1], { a: 60, b: 45 }, cal).worst - 1e-9, "closest first");
}

// a bigger text size (larger px per unit) never gives roomier fits
const big = fitOptions(table, geom, { unitPx: unitPx * 1.5, linePx: 72, capPx: 48 });
if (!big[0].tight) assert(big[0].fitLevel >= list[0].fitLevel);

// bad input is harmless
assert.deepStrictEqual(fitOptions(null, geom, cal), []);
assert.deepStrictEqual(fitOptions(table, null, cal), []);
assert.deepStrictEqual(fitOptions(table, geom, { unitPx: 0, linePx: 48 }), []);

// one word: one option
const one = fitOptions(buildOptionTable("HELLO"), geom, cal);
assert.strictEqual(one.length, 1);

const t0 = Date.now();
const long = buildOptionTable("I WAS PLANNING TO TELL YOU SLOWLY DURING DINNER, BUT CIEL GOT TOO EXCITED AND SPOILED THE SURPRISE!");
fitOptions(long, { a: 300, b: 260 }, { unitPx: 18, linePx: 40, capPx: 26 });
console.log("17 words ranked in", Date.now() - t0, "ms");
console.log("fit tests passed");
