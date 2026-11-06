import assert from "assert";
const store = {};
globalThis.window = { localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } } };
const { COMMANDS, DEFAULT_BINDINGS, loadBindings, saveBindings, findConflicts, describeBinding } = await import("../src/lib/hotkeys.js");

assert.deepStrictEqual(COMMANDS.slice(0, 2), ["best", "1"], "order of the list unchanged");
assert.strictEqual(COMMANDS[COMMANDS.length - 1], "fit");
assert(!COMMANDS.includes("15"), "no 15 lines any more");
assert.strictEqual(COMMANDS.length, 16);
assert.deepStrictEqual(DEFAULT_BINDINGS.fit, ["ALT", "Q"]);
assert.deepStrictEqual(findConflicts(DEFAULT_BINDINGS), {}, "no default key is used twice");

// nothing saved: the defaults
assert.deepStrictEqual(loadBindings(), DEFAULT_BINDINGS);
// keys saved before Fit existed keep their own keys and get the default for Fit
saveBindings({ best: ["CTRL", "B"], 3: ["ALT", "3"] });
const old = loadBindings();
assert.deepStrictEqual(old.best, ["CTRL", "B"]);
assert.deepStrictEqual(old.fit, ["ALT", "Q"]);
// a Fit shortcut the user cleared stays cleared (the settings save an empty list)
saveBindings({ best: ["ALT", "0"], fit: [] });
assert.deepStrictEqual(loadBindings().fit, []);
assert.strictEqual(describeBinding([]), "—");
console.log("hotkeys fit tests passed");
