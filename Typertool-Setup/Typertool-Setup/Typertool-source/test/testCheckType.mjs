import assert from "assert";
import { parseScript, checkRows, arrangeRows } from "../src/lib/checkType.js";

// the three script formats: lines, the textBoxes export and the payload/content export
assert.deepStrictEqual(parseScript("1_ HELLO THERE\n2_ BYE").map((r) => [r.key, r.text]), [["1", "HELLO THERE"], ["2", "BYE"]]);
const boxes = JSON.stringify({ pages: [{ textBoxes: [{ mark: "1", text: "then I'll only\ntell you first,\nciel." }, { mark: "2", text: "ok" }] }] });
assert.deepStrictEqual(parseScript(boxes).map((r) => [r.key, r.text]), [["1", "then I'll only tell you first, ciel."], ["2", "ok"]]);
const payload = JSON.stringify({ payload: { en_US: {
  a: { pageIndex: 0, position: { x: 1, y: 900 }, content: "<p><span style=\"font-size: 0.8em;\">SECOND &amp; LAST</span></p>" },
  b: { pageIndex: 0, position: { x: 1, y: 10 }, content: "<p>FIRST</p><p>PART</p>" },
} } });
assert.deepStrictEqual(parseScript(payload).map((r) => [r.key, r.text]), [["1", "SECOND & LAST"], ["2", "FIRST PART"]], "file order, ids of the file unused");

const rows = parseScript("1_ ENJOY YOUR MEAL.\n2_ WERE YOU BOTH SURPRISED?\n3_ SORRY, I WAS AFRAID YOU WOULDN'T COME\n4_ NOT TYPESET");
const box = (left, top) => ({ left, top, right: left + 200, bottom: top + 60 });
const layers = [
  { id: 1, name: "1_ ENJOY", text: "ENJOY\rYOUR MEAL.", box: box(40, 100) },          // a break between words: fine
  { id: 2, name: "DKI: 2_ WERE", text: "WERE YOU BOTH\rSURPRISE?", box: box(300, 900) }, // other words: bad
  { id: 3, name: "3_ SORRY", text: "SORRY, I WAS AFRAID YOU WOULDN'T CO-\rME", box: box(100, 500) }, // cut word + hyphen: bad
  { id: 4, name: "Layer 4", text: "no code", box: box(0, 0) },
];
const checks = checkRows(rows, layers);
assert.deepStrictEqual(checks.map((c) => c.status), ["ok", "bad", "bad", "missing"]);
assert.deepStrictEqual(arrangeRows(checks), [0, 2, 1, 3], "by place on the page, no layer last");

// texts side by side on the same band stay together, left to right
const band = arrangeRows([{ box: box(320, 110) }, { box: box(40, 100) }, { box: box(100, 500) }, null && { box: null }].map((c) => c || { box: null }));
assert.deepStrictEqual(band, [1, 0, 2, 3]);
console.log("check type tests passed");
