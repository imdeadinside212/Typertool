// Runs host/typertool_fast.jsx against a tiny fake Photoshop
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const source = fs.readFileSync(path.join(__dirname, "../host/typertool_fast.jsx"), "utf8");

// A fake document: one text layer and one selection; `dragSelection` makes a layer move
// take the selection along (what the panel had to guard against)
const makeWorld = (opts = {}) => {
  const w = {
    layer: { left: 100, top: 100, right: 300, bottom: 150 },
    selection: opts.noSelection ? null : { left: 150, top: 150, right: 450, bottom: 450 },
    history: 7,
    text: "I WAS PLANNING\rTO TELL YOU",
    log: [],
    textFails: opts.textFails || "",
    dragSelection: !!opts.dragSelection,
  };
  const rect = (r) => (r ? Object.assign({}, r, { width: r.right - r.left, height: r.bottom - r.top, xMid: (r.left + r.right) / 2, yMid: (r.top + r.bottom) / 2 }) : null);
  const ctx = {
    documents: [1],
    app: { activeDocument: {
      suspendHistory: (name, code) => { w.log.push("history:" + name); vm.runInContext(code, ctx); },
      // content-only write: the DOM setter changes the text and shifts the layer (left anchored), never its style
      activeLayer: { textItem: { get contents() { return w.text; }, set contents(v) { w.text = v;  w.log.push("contents:" + JSON.stringify(v)); if (opts.contentsFails) throw new Error("no"); w.layer.right += 60; } } },
    } },
    _normalizeTextKey: (t) => String(t).replace(/\r\n/g, "\r").replace(/\n/g, "\r"),
    _recentreOnBox: (e) => { const b = ctx._currentLayerBox(); const dx = e.xMid - b.xMid, dy = e.yMid - b.yMid; if (dx || dy) ctx._moveLayer(dx, dy); },
    charID: { Channel: 1, FrameSelect: 2, Horizontal: 3, PixelUnit: 4, Vertical: 5, Null: 6, To: 7, Offset: 8, Move: 9 },
    DialogModes: { NO: 0 },
    _MIN_BUBBLE_AREA: 200,
    _hostState: { setTextShapeRText: { data: null, result: "" }, setActiveLayerText: { data: null, result: "" } },
    _setTextShapeRText: () => {
      const t = ctx._hostState.setTextShapeRText;
      w.log.push("text:" + t.data.text);
      t.result = w.textFails;
      // the stock routine changes the layer size and keeps its centre
      if (!w.textFails) { const cx = (w.layer.left + w.layer.right) / 2; w.layer.left = cx - 120; w.layer.right = cx + 120; }
    },
    _setActiveLayerText: () => { w.log.push("fallbackText"); ctx._hostState.setActiveLayerText.result = ""; },
    _liveSelectionBounds: () => rect(w.selection),
    _currentLayerBox: () => rect(w.layer),
    _getCurrentTextLayerBounds: () => rect(w.layer),
    _moveLayer: (dx, dy) => {
      w.log.push("moveLayer:" + dx + "," + dy);
      for (const k of ["left", "right"]) w.layer[k] += dx;
      for (const k of ["top", "bottom"]) w.layer[k] += dy;
      if (w.dragSelection && w.selection) { for (const k of ["left", "right"]) w.selection[k] += dx; for (const k of ["top", "bottom"]) w.selection[k] += dy; }
    },
    _getActiveLayerId: () => 5,
    _getActiveHistoryIndex: () => w.history,
    ActionReference: function () { this.putProperty = () => {}; },
    ActionDescriptor: function () {
      this.values = {};
      this.putUnitDouble = (k, u, v) => { this.values[k] = v; };
      this.putReference = () => {};
      this.putObject = (k, cls, o) => { this.offset = o.values; }; // (key, class, descriptor) like Photoshop
    },
    executeAction: (ev, desc) => {
      w.log.push("moveSelection:" + desc.offset[3] + "," + desc.offset[5]);
      for (const k of ["left", "right"]) w.selection[k] += desc.offset[3];
      for (const k of ["top", "bottom"]) w.selection[k] += desc.offset[5];
    },
    jamJSON: { stringify: (o) => JSON.stringify(o) },
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return { w, ctx };
};

const payload = (center) => ({ text: { text: "A\nB", style: { textProps: { layerText: { textStyleRange: [{}] } } }, direction: "ltr", richTextRuns: [] }, center });
const run = (world, center) => JSON.parse(world.ctx.typertoolApply(payload(center)));
const mid = (r) => [(r.left + r.right) / 2, (r.top + r.bottom) / 2];

// 1. centre target honoured, one history state, selection untouched
{
  const world = makeWorld();
  const out = run(world, { key: "150,150,450,450", x: 300, y: 300 });
  assert.strictEqual(out.error, "");
  assert.deepStrictEqual(mid(world.w.layer), [300, 300]);
  assert.deepStrictEqual(world.w.selection, { left: 150, top: 150, right: 450, bottom: 450 });
  assert.strictEqual(world.w.log.filter((l) => l.startsWith("history:")).length, 1, "one history state");
  assert(!world.w.log.some((l) => l.startsWith("moveSelection")), "selection not touched when nothing dragged it");
  assert.strictEqual(out.signature, "5:7");
  assert.strictEqual(out.bounds.xMid, 300);
}
// 2. a layer move that drags the selection along: the selection is put back
{
  const world = makeWorld({ dragSelection: true });
  run(world, { key: "150,150,450,450", x: 300, y: 300 });
  assert.deepStrictEqual(mid(world.w.layer), [300, 300], "text centred");
  assert.deepStrictEqual(world.w.selection, { left: 150, top: 150, right: 450, bottom: 450 }, "selection back in place");
  assert(world.w.log.some((l) => l.startsWith("moveSelection")));
}
// 2b. if putting the selection back throws, the apply is still a success
{
  const world = makeWorld({ dragSelection: true });
  world.ctx.executeAction = () => { throw new Error("boom"); };
  const out = run(world, { key: "150,150,450,450", x: 300, y: 300 });
  assert.strictEqual(out.error, "", "guard failure is not an error");
  assert.deepStrictEqual(mid(world.w.layer), [300, 300]);
}
// 3. stale key (selection changed since the panel looked): centre of the live selection is used
{
  const world = makeWorld();
  run(world, { key: "0,0,10,10", x: 5, y: 5 });
  assert.deepStrictEqual(mid(world.w.layer), [300, 300]);
}
// 4. no target / no selection: the layer keeps its centre, nothing moves
{
  const world = makeWorld();
  run(world, null);
  assert.deepStrictEqual(mid(world.w.layer), [200, 125]);
  assert(!world.w.log.some((l) => l.startsWith("moveLayer")));
  const none = makeWorld({ noSelection: true });
  run(none, { key: "150,150,450,450", x: 300, y: 300 });
  assert.deepStrictEqual(mid(none.w.layer), [200, 125]);
}
// 5. text failure is reported and nothing else happens
{
  const world = makeWorld({ textFails: "layer" });
  const out = run(world, { key: "150,150,450,450", x: 300, y: 300 });
  assert.strictEqual(out.error, "layer");
  assert(!world.w.log.some((l) => l.startsWith("moveLayer")));
}
// 6. payload without a usable style takes the stock fallback
{
  const world = makeWorld();
  const out = JSON.parse(world.ctx.typertoolApply({ text: { text: "A\nB" }, center: null }));
  assert.strictEqual(out.error, "");
  assert(world.w.log.includes("fallbackText"));
}
console.log("host apply tests passed");

// 5. content-only write: only the text changes (no style routine runs), the layer keeps its centre
{
  const world = makeWorld({ noSelection: true });
  const p = payload(null); p.text.contentOnly = true;
  const before = mid(world.w.layer);
  const out = JSON.parse(world.ctx.typertoolApply(p));
  assert.strictEqual(out.error, "");
  assert(world.w.log.some((l) => l.startsWith("contents:")), "text written through the content setter");
  assert(!world.w.log.some((l) => l.startsWith("text:") || l === "fallbackText"), "no style rewrite: the size cannot change");
  assert.deepStrictEqual(mid(world.w.layer), before, "no target: the layer keeps its centre");
}
{
  const world = makeWorld({});
  const p = payload({ key: "150,150,450,450", x: 300, y: 300 }); p.text.contentOnly = true;
  world.ctx.typertoolApply(p);
  assert(!world.w.log.some((l) => l.startsWith("text:")), "no style rewrite");
  assert.deepStrictEqual(mid(world.w.layer), [300, 300], "the layer lands on the target");
  assert.deepStrictEqual(world.w.selection, { left: 150, top: 150, right: 450, bottom: 450 }, "selection untouched");
}
{
  // if the content setter fails the stock routine still gets the job done
  const world = makeWorld({ noSelection: true, contentsFails: true });
  const p = payload(null); p.text.contentOnly = true;
  const out = JSON.parse(world.ctx.typertoolApply(p));
  assert.strictEqual(out.error, "");
  assert(world.w.log.some((l) => l.startsWith("text:")), "fallback used");
}
console.log("host apply content-only tests passed");

// 7. the panel does not poll Photoshop any more: it says what it expects and the host refuses a stale write
{
  const world = makeWorld({});
  const p = payload(true); p.text.contentOnly = true; p.text.text = "I WAS\nPLANNING TO\nTELL YOU";
  p.expect = { layerId: 5, text: "I WAS PLANNING\rTO TELL YOU" }; // same words, other breaks: fine
  const out = JSON.parse(world.ctx.typertoolApply(p));
  assert.strictEqual(out.error, "", "same layer, same words: written");
  assert(world.w.log.some((l) => l.startsWith("contents:")));
  assert.deepStrictEqual(mid(world.w.layer), [300, 300], "centre target = centre of the live selection (no outline needed)");
}
{
  const world = makeWorld({});
  const p = payload(true); p.text.contentOnly = true; p.expect = { layerId: 9, text: "I WAS PLANNING TO TELL YOU" };
  const out = JSON.parse(world.ctx.typertoolApply(p));
  assert.strictEqual(out.error, "stale", "another layer is active now");
  assert(!world.w.log.some((l) => l.startsWith("contents:") || l.startsWith("text:")), "nothing written");
}
{
  const world = makeWorld({});
  const p = payload(true); p.text.contentOnly = true; p.expect = { layerId: 5, text: "SOMETHING ELSE ENTIRELY" };
  const out = JSON.parse(world.ctx.typertoolApply(p));
  assert.strictEqual(out.error, "stale", "the words were edited in Photoshop");
  assert(!world.w.log.some((l) => l.startsWith("contents:")), "nothing written");
  assert.deepStrictEqual(mid(world.w.layer), [200, 125], "nothing moved");
}
console.log("host apply stale-guard tests passed");
