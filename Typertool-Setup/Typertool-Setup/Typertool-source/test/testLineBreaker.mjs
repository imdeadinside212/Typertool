import assert from "assert";
import { buildOptionTable, buildContext, buildUnits, isCleanBreak, coreLength } from "../src/lib/lineBreaker.js";

// marks stick to the word before them, spaced or not
assert.deepStrictEqual(buildUnits("WHAT ? NO !! REALLY ... OK"), ["WHAT ?", "NO !!", "REALLY ...", "OK"]);
assert.deepStrictEqual(buildUnits("WAIT!! ... WHAT?"), ["WAIT!! ...", "WHAT?"]);
assert.deepStrictEqual(buildUnits("... WAIT"), ["... WAIT"]);
assert.deepStrictEqual(buildUnits("SAY \" HI \" NOW"), ["SAY \"", "HI \"", "NOW"]);

const text = "I WAS PLANNING TO TELL YOU SLOWLY DURING DINNER, BUT CIEL GOT TOO EXCITED AND SPOILED THE SURPRISE!";
const t = buildOptionTable(text);
console.log("words:", t.wordCount, "counts:", Object.keys(t.byCount).join(" "));
Object.keys(t.byCount).forEach((n) => {
  const options = t.byCount[n];
  assert(options.length >= 1 && options.length <= 10);
  assert.strictEqual(new Set(options.map((o) => o.text)).size, options.length, "no duplicate in " + n);
  options.forEach((o) => {
    assert.strictEqual(o.count, +n);
    assert(isCleanBreak(text, o.lines), "clean break");
    assert(!o.lines.some((l) => /-$/.test(l) && !/-$/.test(text)), "no hyphen");
    assert(o.lines.every((l) => l.trim().length), "no empty line");
    // the first word has one character: never alone on the first line
    assert(!(o.lines[0] === "I" && +n > 1), "single character first word alone");
    // a mark never starts a line
    assert(o.lines.every((l) => !/^[!?.,;:…]/.test(l)), "mark starts a line");
  });
});
assert.strictEqual(new Set(t.best.map((o) => o.text)).size, t.best.length);
console.log("best:");
t.best.slice(0, 4).forEach((o) => console.log(" ", o.count, "lines, score", o.score.toFixed(3), "\n    " + o.lines.join("\n    ")));
console.log("3 lines options:", t.byCount[3].length, " 6 lines:", t.byCount[6].length, " 15 lines:", t.byCount[15] ? t.byCount[15].length : 0);

// few words: fewer options, buttons beyond the word count do not exist
const small = buildOptionTable("HELLO THERE FRIEND");
console.log("small:", Object.keys(small.byCount).join(","), Object.values(small.byCount).map((o) => o.length).join(","));
assert.strictEqual(Object.keys(small.byCount).length, 3);
assert.strictEqual(small.byCount[3].length, 1);
// one-character first word: 2 words -> only one line possible
const two = buildOptionTable("I SEE");
assert.deepStrictEqual(Object.keys(two.byCount), ["1"]);
const three = buildOptionTable("I WAS HERE");
assert(three.byCount[2].every((o) => o.lines[0].split(" ").length >= 2));
assert.strictEqual(coreLength("I'M"), 2);
// a long mark chain at the end stays glued
const glue = buildOptionTable("DO YOU REALLY MEAN IT ?! YES !!");
Object.values(glue.byCount).flat().forEach((o) => assert(o.lines.every((l) => !/^[?!]/.test(l))));
// speed on a long text
const long = "THIS IS A MUCH LONGER TEXT WITH MANY WORDS SO THAT THE BREAKER HAS A LOT OF CHOICES TO PICK FROM AND STILL ANSWERS FAST WITHOUT FREEZING THE PANEL AT ALL OK";
const s0 = Date.now(); const big = buildOptionTable(long); console.log("long:", big.wordCount, "words,", Date.now() - s0, "ms");
// words that already contain a hyphen are never cut at it, nothing is hyphenated
const hy = buildOptionTable("A WELL-KNOWN SELF-DEFENSE EXPERT ARRIVED TODAY");
Object.values(hy.byCount).flat().forEach((o) => {
  assert(o.lines.every((l) => !/-$/.test(l)), "no line ends with a hyphen");
  assert(isCleanBreak("A WELL-KNOWN SELF-DEFENSE EXPERT ARRIVED TODAY", o.lines));
});
console.log("line breaker tests passed");
