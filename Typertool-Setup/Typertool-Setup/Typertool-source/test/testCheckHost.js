// Runs typertoolScanTexts / typertoolDocKey of host/typertool_fast.jsx against a tiny fake Photoshop
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const source = fs.readFileSync(path.join(__dirname, "../host/typertool_fast.jsx"), "utf8");

// layer indexes 0..5 (a background exists): background, text, group end marker, text, a text that
// cannot be read, a group
const makeWorld = (opts = {}) => {
  const kinds = { 0: 1, 1: 3, 2: 13, 3: 3, 4: 3, 5: 7 };
  const layers = {
    1: { id: 11, name: "1_ ENJOY", text: "ENJOY\rYOUR MEAL.", box: { Left: 40, "Top ": 100, Rght: 240, Btom: 160 } },
    3: { id: 12, name: "DKI: 2_ WERE", text: "WERE YOU BOTH SURPRISED?", box: { Left: 300, "Top ": 900, Rght: 500, Btom: 960 } },
    4: { id: 13, name: "broken", text: "x", box: null },
  };
  const w = { calls: 0 };
  const desc = (values) => ({
    getInteger: (k) => values[k],
    getString: (k) => values[k],
    getBoolean: (k) => values[k],
    getObjectValue: (k) => {
      const o = values[k];
      if (!o) throw new Error("no object");
      return { getUnitDoubleValue: (key) => o[key] };
    },
  });
  const ctx = {
    documents: opts.noDoc ? [] : [1],
    app: { activeDocument: opts.idFails ? { get id() { throw new Error("no id"); }, name: "page1.psd" } : { id: 7, name: "page1.psd" } },
    charIDToTypeID: (s) => s,
    stringIDToTypeID: (s) => s,
    ActionReference: function () {
      this.putProperty = (p, k) => { this.prop = k; };
      this.putIndex = (c, i) => { this.index = i; };
      this.putEnumerated = () => { this.doc = true; };
    },
    executeActionGet: (ref) => {
      w.calls++;
      if (ref.doc) return desc({ numberOfLayers: 6, hasBackgroundLayer: true });
      const i = ref.index;
      const l = layers[i];
      if (ref.prop === "layerKind") return desc({ layerKind: kinds[i] });
      if (ref.prop === "Nm  ") return desc({ "Nm  ": l.name });
      if (ref.prop === "layerID") return desc({ layerID: l.id });
      if (ref.prop === "boundsNoEffects" || ref.prop === "bounds") return desc({ [ref.prop]: l.box });
      throw new Error("unexpected " + ref.prop);
    },
    jamEngine: {
      meaningfulIds: false,
      parseFriendly: false,
      jsonGet: (query) => {
        const i = query[1].layer["<index>"];
        if (i === 4) throw new Error("cannot read");
        return { textKey: { text: layers[i].text } };
      },
    },
    jamText: { fromLayerTextObject: (o) => ({ layerText: { textKey: o.text } }) },
    jamJSON: { stringify: (o) => JSON.stringify(o) },
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return { ctx, w };
};

{
  const { ctx } = makeWorld();
  const out = JSON.parse(vm.runInContext("typertoolScanTexts()", ctx));
  assert.strictEqual(out.docKey, "7|page1.psd");
  assert.deepStrictEqual(out.layers.map((l) => l.id), [11, 12], "text layers only, a layer that cannot be read is skipped");
  assert.deepStrictEqual(out.layers[0], { id: 11, name: "1_ ENJOY", text: "ENJOY\rYOUR MEAL.", box: { left: 40, top: 100, right: 240, bottom: 160 } });
  assert.strictEqual(out.layers[1].name, "DKI: 2_ WERE");
  assert.strictEqual(vm.runInContext("jamEngine.meaningfulIds", ctx), false, "settings of the engine put back");
  assert.strictEqual(vm.runInContext("jamEngine.parseFriendly", ctx), false);
}
{
  const { ctx } = makeWorld({ noDoc: true });
  assert.deepStrictEqual(JSON.parse(vm.runInContext("typertoolScanTexts()", ctx)), { error: "doc" });
  assert.strictEqual(vm.runInContext("typertoolDocKey()", ctx), "");
}
{
  const { ctx } = makeWorld({ idFails: true });
  assert.strictEqual(vm.runInContext("typertoolDocKey()", ctx), "|page1.psd", "the name alone still tells documents apart");
}
console.log("check type host tests passed");
