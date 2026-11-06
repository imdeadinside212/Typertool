// Runs scaleTextLikeB of the adapted Copy Style host with stubbed Photoshop calls
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");
const code = fs.readFileSync(__dirname + "/../host/copy_style.jsx", "utf8").replace(/^#target.*$/m, "");
const ctx = vm.createContext({ app: { documents: [] }, stringIDToTypeID: (s) => s, charIDToTypeID: (s) => s });
vm.runInContext(code, ctx);
vm.runInContext(`
  var FONT_STATS = {};
  var SCALE_TEXT_BY_B = true;
  var __bSize = 20, __aSize = 100;
  getTextInfo = function (l) { return l === "B" ? { font: "F", size: __bSize } : { raw: __aSize, leading: null }; };
  getBaseSize = function () { return 20; };
  setTextSize = function (l, size) { __result = size; };
  var __result = null;
`, ctx);
const run = (bSize, manual) => {
  vm.runInContext(`__bSize = ${bSize}; __aSize = 100; __result = null; MANUAL_BASE_SIZE = ${manual || 0};`, ctx);
  const did = vm.runInContext(`scaleTextLikeB("A", "B")`, ctx);
  return { did, size: vm.runInContext("__result", ctx) };
};
const near = (a, b) => Math.abs(a - b) < 1e-6;
assert.strictEqual(vm.runInContext("ONLY_SCALE_UP", ctx), true, "size can only grow");
// base 20: B 20 -> no change
assert.strictEqual(run(20).did, false);
// B +1% (new lower limit): +10 more -> A +11%
assert(near(run(20.2).size, 111), "B +1% -> A +11%: " + run(20.2).size);
// B +5%: A +15%
assert(near(run(21).size, 115));
// B +8%: A +18%
assert(near(run(21.6).size, 118));
// B +20%: A +30%
assert(near(run(24).size, 130));
// B +30% (upper limit): A +40%
assert(near(run(26).size, 140));
// B +31% (above the range): plain zoom, no bonus
assert(near(run(26.2).size, 131));
// B +60%: plain
assert(near(run(32).size, 160));
// B smaller than the base: NEVER shrinks, A is left alone
for (const b of [19.9, 18, 10, 1]) {
  const r = run(b);
  assert.strictEqual(r.did, false, "no change for B=" + b);
  assert.strictEqual(r.size, null, "no size written for B=" + b);
}
// manual base size (Sp / Nar box): the calculation starts from it instead of the automatic base
assert(near(run(27.5, 25).size, 120), "manual base 25, B 27.5 (+10%) -> A +20%: " + run(27.5, 25).size);
assert.strictEqual(run(24, 25).did, false, "B below the manual base: no shrink");
assert.strictEqual(run(25, 25).did, false, "B equal to the manual base: no change");
// without manual base the automatic one (20) is used again
assert(near(run(24, 0).size, 130));
console.log("copy style bonus tests passed");
