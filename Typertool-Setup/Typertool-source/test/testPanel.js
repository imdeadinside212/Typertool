// Runs the built panel in jsdom against a fake Photoshop host
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { JSDOM } = require("jsdom");

const dist = path.join(__dirname, "../dist/Typertool");
const html = fs.readFileSync(path.join(dist, "index.html"), "utf8")
  .replace(/<script[^>]*><\/script>/g, "").replace(/<link[^>]*>/g, "");
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
const { window } = dom;

const { EventEmitter } = require("events");
const calls = [];
const listeners = {};
// the key watcher: the panel starts it with child_process.spawn (Node is enabled in the real panel)
const spawned = [];
const fakeSpawn = (command, args) => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  child.kill = () => { child.killed = true; };
  child.command = command;
  child.args = args;
  spawned.push(child);
  return child;
};
window.process = { platform: "win32", pid: 4242 };
window.require = (name) => { if (name === "child_process") return { spawn: fakeSpawn }; throw new Error("no " + name); };
const world = {
  text: "I WAS PLANNING TO TELL YOU SLOWLY DURING DINNER.",
  selection: null,
  history: 1,
  keys: "a",
  noLayer: false,
  forceStale: false,
  docKey: "7|page1.psd",
  activeId: 12,
  // the layers of the open document: [code in the name, text, where it sits]
  docLayers: [
    { id: 11, name: "2_ WERE YOU", text: "WERE YOU BOTH\rSURPRISED?", box: { left: 300, top: 900, right: 500, bottom: 960 } },
    { id: 12, name: "1_ ENJOY", text: "ENJOY YOUR MEAL.", box: { left: 40, top: 100, right: 240, bottom: 160 } },
    { id: 13, name: "3_ SORRY", text: "SORRY, I WAS AFRAID\rYOU WOULDN'T COME", box: { left: 100, top: 500, right: 300, bottom: 560 } },
    { id: 14, name: "Layer 9", text: "no code", box: { left: 0, top: 0, right: 10, bottom: 10 } },
  ],
};
const layerData = () => ({
  activeLayer: world.noLayer ? { error: "noLayer" } : {
    layerId: 5, layerName: "1_ I WAS", signature: "5:" + world.history,
    bounds: { left: 100, top: 100, right: 300, bottom: 150, width: 200, height: 50, xMid: 200, yMid: 125 },
    textProps: { layerText: { textKey: world.text, textStyleRange: [{ from: 0, to: 10, textStyle: { size: 20 } }] } },
    stroke: null,
  },
  selection: world.selection,
  layers: [],
});
window.__adobe_cep__ = {
  getHostEnvironment: () => JSON.stringify({ appUILocale: "en_US" }),
  getSystemPath: () => "C:/Users/me/AppData/Roaming/Adobe/CEP/extensions/Typertool",
  addEventListener: (type, listener) => { (listeners[type] = listeners[type] || []).push(listener); },
  removeEventListener: (type, listener) => { listeners[type] = (listeners[type] || []).filter((l) => l !== listener); },
  evalScript: (script, cb) => {
    calls.push(script);
    let result = "";
    let delay = 0;
    if (script.startsWith("getTypeRPanelSnapshot")) {
      const snap = layerData();
      const sig = JSON.parse(script.slice(script.indexOf("(") + 1, -1)).signature;
      if (snap.activeLayer.signature && snap.activeLayer.signature === sig) snap.activeLayer = { unchanged: true };
      result = JSON.stringify(snap);
    } else if (script.startsWith("typertoolDocKey")) {
      result = world.noDoc ? "" : world.docKey;
    } else if (script.startsWith("typertoolScanTexts")) {
      world.scanCount = (world.scanCount || 0) + 1;
      result = world.noDoc ? JSON.stringify({ error: "doc" }) : JSON.stringify({ docKey: world.docKey, layers: world.docLayers });
    } else if (script.startsWith("getActiveLayerText")) {
      world.activeReads = (world.activeReads || 0) + 1;
      const l = world.docLayers.find((x) => x.id === world.activeId);
      result = JSON.stringify({ layerId: l.id, layerName: l.name, bounds: Object.assign({ width: 0, height: 0 }, l.box), textProps: { layerText: { textKey: l.text } } });
    } else if (script.startsWith("typertoolApply")) {
      const data = JSON.parse(script.slice("typertoolApply(".length, -1));
      world.lastPayload = data;
      if (world.forceStale) result = JSON.stringify({ error: "stale", bounds: null, signature: "" });
      else {
        world.text = data.text.text.replace(/\n/g, "\r");
        world.history++;
        world.lastApplied = data.text;
        world.lastCenter = data.center;
        world.applyCount = (world.applyCount || 0) + 1;
        delay = world.applyDelay || 0;
        result = JSON.stringify({ error: "", bounds: { left: 90, top: 110, right: 290, bottom: 160, width: 200, height: 50, xMid: 190, yMid: 135 }, signature: "5:" + world.history });
      }
    }
    if (cb) setTimeout(() => cb(result), delay);
  },
};
window.localStorage.clear();
window.eval(fs.readFileSync(path.join(dist, "js/CSInterface.js"), "utf8"));
window.eval(fs.readFileSync(path.join(dist, "js/bundle.js"), "utf8"));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (sel) => window.document.querySelector(sel);
const qa = (sel) => Array.from(window.document.querySelectorAll(sel));
const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const enter = () => q(".lb").dispatchEvent(new window.MouseEvent("mouseover", { bubbles: true, relatedTarget: null })); // the pointer comes into the panel
const sendShortcut = (data) => (listeners["com.typertool.shortcut"] || []).forEach((l) => l({ type: "com.typertool.shortcut", data }));
const names = () => calls.map((c) => c.split("(")[0]);
const cardTexts = () => qa(".lb-card pre").map((p) => p.textContent);

(async () => {
  await wait(800);
  // 4 sections in the asked order
  const titles = qa(".section-title").map((e) => e.textContent.toLowerCase());
  assert.deepStrictEqual(titles, ["line break", "check type", "image mask", "copy style"]);
  // best view: the cards, the count buttons, the star
  assert(qa(".lb-card").length >= 4, "best options shown");
  assert.strictEqual(qa(".lb-count").length, 16);
  assert(qa(".lb-count:not(:disabled)").length >= 9, "buttons enabled up to the word count");
  assert(q(".lb-count:nth-child(16)").disabled, "15 lines is impossible with 9 words");
  assert.strictEqual(qa(".lb-card pre")[0].textContent.split("\n").length, 4, "best starts with the 4 lines the Line Breaker scripts pick for 9 words");

  // NOTHING runs in the background: an idle panel does not call Photoshop at all, no key polling
  calls.length = 0;
  await wait(3000);
  assert.strictEqual(calls.length, 0, "idle panel makes no host call, got: " + calls.join(" | "));

  // choose 3 lines: ALL the options of 3 lines at once, no paging, all different
  click(qa(".lb-count").find((b) => b.textContent === "3"));
  await wait(100);
  const cards3 = cardTexts();
  assert(cards3.length > 4, "every option of the line count is shown at once: " + cards3.length);
  assert(cards3.every((t) => t.split("\n").length === 3));
  assert.strictEqual(new Set(cards3).size, cards3.length);
  assert(!q(".lb-pager"), "no pager");

  // a click = exactly ONE host call: text content only + centre on the selection + a stale guard
  const textBefore = world.text;
  calls.length = 0;
  click(qa(".lb-card")[1]);
  await wait(300);
  assert.deepStrictEqual(names(), ["typertoolApply"], "a click is a single host call, got " + names().join(","));
  assert.strictEqual(world.lastApplied.text, cards3[1]);
  assert.strictEqual(world.lastApplied.contentOnly, true, "only the line breaks are written, never the style");
  assert.strictEqual(world.lastPayload.text.style, undefined, "no style travels with the click");
  assert.strictEqual(world.lastPayload.center, true, "auto center on: the host centres on the selection (no outline, no tail)");
  assert.deepStrictEqual(world.lastPayload.expect, { layerId: 5, text: textBefore });
  assert(!/getCurrentSelectionPolygons|getCurrentSelection\(/.test(calls.join("|")), "no outline scan, no selection round trip");

  // auto center off: no centre target
  click(q(".lb-toggle"));
  await wait(50);
  click(qa(".lb-card")[2]);
  await wait(300);
  assert.strictEqual(world.lastPayload.center, null, "auto center off");
  click(q(".lb-toggle"));
  assert.strictEqual(qa(".lb-toggle").length, 1, "only the auto center toggle (no ignore tail)");
  assert(!q(".lb-warn"), "no outline warning any more");

  // Photoshop changes behind the panel's back: nothing happens until the pointer comes in / the panel is focused
  world.text = "ONE TWO THREE FOUR FIVE SIX SEVEN"; world.history++;
  await wait(1500);
  assert(!/ONE/.test(cardTexts().join(" ")), "no polling: the panel has not looked yet");
  calls.length = 0;
  enter();
  await wait(300);
  assert.deepStrictEqual(names(), ["getTypeRPanelSnapshot"], "pointer enters: one refresh");
  assert(/ONE/.test(cardTexts().join(" ")), "the new text is shown");
  world.text = "UNO DOS TRES CUATRO CINCO SEIS"; world.history++;
  await wait(400);
  window.dispatchEvent(new window.Event("focus"));
  await wait(300);
  assert(/UNO/.test(cardTexts().join(" ")), "panel focused: refreshed");
  calls.length = 0;
  enter(); enter(); enter();
  await wait(300);
  assert(names().length <= 1, "refreshes are throttled: " + names().join(","));

  // another layer is active when you click (the pointer did not leave the panel): the host refuses, nothing is overwritten
  world.forceStale = true;
  calls.length = 0;
  click(qa(".lb-card")[0]);
  await wait(300);
  world.forceStale = false;
  assert(!calls.some((c) => c.startsWith("alert")), "stale is not an error box");
  assert(/changed/i.test(q(".lb-status").textContent), "status tells the layer changed: " + q(".lb-status").textContent);
  assert(names().includes("getTypeRPanelSnapshot"), "the panel looked again");

  // clicks while busy: only the latest one runs after the current one
  world.applyDelay = 150;
  const before = world.applyCount;
  const c = qa(".lb-card");
  click(c[0]);
  await wait(20);
  click(c[1]);
  click(c[2]);
  click(c[3]);
  await wait(700);
  world.applyDelay = 0;
  assert.strictEqual(world.applyCount - before, 2, "first click + only the last queued click, got " + (world.applyCount - before));
  assert.strictEqual(world.lastApplied.text, qa(".lb-card pre")[3].textContent, "the last click wins");

  // SHORTCUT = a message from the "Typertool - N lines" script in Photoshop. The layer is read first (it
  // may have changed), the number button lights up, its FIRST option is applied
  world.text = "I WAS PLANNING TO TELL YOU SLOWLY DURING DINNER."; world.history++;
  calls.length = 0;
  sendShortcut("3");
  await wait(600);
  assert.deepStrictEqual(names(), ["getTypeRPanelSnapshot", "typertoolApply"], "read, then apply: " + names().join(","));
  assert.strictEqual(world.lastApplied.text.split("\n").length, 3, "3 lines");
  assert(qa(".lb-count").find((b) => b.textContent === "3").classList.contains("is-on"), "the 3 button lights up");
  assert.strictEqual(world.lastApplied.text, qa(".lb-card pre")[0].textContent, "...and its first option is applied");
  assert.strictEqual(world.lastPayload.expect.text, "I WAS PLANNING TO TELL YOU SLOWLY DURING DINNER.");
  // the layer text was changed in Photoshop since the panel last looked: the shortcut uses the NEW text
  world.text = "ONE TWO THREE FOUR FIVE SIX"; world.history++;
  sendShortcut("2");
  await wait(600);
  assert.strictEqual(world.lastApplied.text.replace(/\n/g, " "), "ONE TWO THREE FOUR FIVE SIX", "applied to the current text of the layer");
  assert.strictEqual(world.lastApplied.text.split("\n").length, 2);
  assert(qa(".lb-count").find((b) => b.textContent === "2").classList.contains("is-on"));
  // best
  sendShortcut("best");
  await wait(500);
  assert(q(".lb-best").classList.contains("is-on"), "best button lit");
  // two shortcuts in a row: both run, the last one wins
  world.applyDelay = 150;
  const n0 = world.applyCount;
  sendShortcut("2");
  sendShortcut("3");
  await wait(1200);
  world.applyDelay = 0;
  assert.strictEqual(world.applyCount - n0, 2, "both applied, got " + (world.applyCount - n0));
  assert.strictEqual(world.lastApplied.text.split("\n").length, 3, "the last shortcut wins");
  // a count that is impossible for this text, and a document without a text layer: nothing breaks, nothing is written
  const n1 = world.applyCount;
  sendShortcut("15");
  await wait(400);
  world.noLayer = true;
  sendShortcut("2");
  await wait(400);
  assert.strictEqual(world.applyCount, n1, "nothing written");
  assert(/Select a text layer/.test(q(".lb-status").textContent) || /Select a text layer/.test(q(".lb-message") ? q(".lb-message").textContent : ""), "tells there is no text layer");
  world.noLayer = false;
  enter();
  await wait(400);
  // the key watcher: started at once with the default shortcuts, nothing for the user to set up
  assert.strictEqual(spawned.length, 1, "one key watcher");
  const watcher = spawned[0];
  assert.strictEqual(watcher.command, "powershell.exe");
  assert(watcher.args.includes("-File") && watcher.args.includes("C:/Users/me/AppData/Roaming/Adobe/CEP/extensions/Typertool/keys/typertool-keys.ps1"), "runs the script of the extension");
  assert(watcher.args.includes("4242"), "told which process to follow");
  assert.strictEqual(watcher.args[watcher.args.indexOf("-Block") + 1], "1", "the keys are kept away from Photoshop by default");
  const bindingArg = watcher.args[watcher.args.indexOf("-Bindings") + 1];
  assert(/(^|;)3:ALT:51,99(;|$)/.test(bindingArg) && /(^|;)best:ALT:48,96(;|$)/.test(bindingArg) && /(^|;)9:ALT:57,105(;|$)/.test(bindingArg), "ALT+1..9 and ALT+0 by default: " + bindingArg);
  watcher.stdout.emit("data", "READY\n");
  // ALT+3 pressed in Photoshop: the helper prints a line (here split in two chunks)
  world.text = "I WAS PLANNING TO TELL YOU SLOWLY DURING DINNER."; world.history++;
  world.lastApplied = null;
  calls.length = 0;
  watcher.stdout.emit("data", "KEY");
  watcher.stdout.emit("data", " 3\n");
  await wait(600);
  assert.deepStrictEqual(names(), ["getTypeRPanelSnapshot", "typertoolApply"], "read, then apply: " + names().join(","));
  assert.strictEqual(world.lastApplied.text.split("\n").length, 3, "ALT+3 -> 3 lines");
  assert(qa(".lb-count").find((b) => b.textContent === "3").classList.contains("is-on"), "the 3 button lights up");
  assert.strictEqual(world.lastApplied.text, qa(".lb-card pre")[0].textContent, "...and its first option is applied");
  watcher.stdout.emit("data", "KEY best\n");
  await wait(500);
  assert(q(".lb-best").classList.contains("is-on"), "ALT+0 -> best");

  // a text box of the panel that has the keyboard focus: the keys are meant for typing, not for the shortcut
  click(qa(".cs-base-btn")[0]);
  await wait(30);
  const spBox = q(".cs-base-input");
  spBox.focus();
  world.lastApplied = null;
  watcher.stdout.emit("data", "KEY 5\n");
  await wait(400);
  assert.strictEqual(world.lastApplied, null, "typing in the box: shortcut ignored");
  const realHasFocus = window.document.hasFocus;
  window.document.hasFocus = () => false; // the canvas of Photoshop has the keyboard now
  watcher.stdout.emit("data", "KEY 5\n");
  await wait(600);
  window.document.hasFocus = realHasFocus;
  assert(world.lastApplied && world.lastApplied.text.split("\n").length === 5, "panel not focused: ALT+5 works although the box is still the active element");
  spBox.blur();
  click(qa(".cs-base-btn")[0]); // Sp off again

  // the settings: status of the watcher, the table of keys, recording from the keys pressed in the panel
  assert(!q(".lb-head .lb-icon"), "no gear inside the line break box");
  const gear = q(".app-header .app-gear");
  assert(gear, "gear in the top header");
  assert(q(".app").firstElementChild === q(".app-header"), "header is the first thing of the tool");
  click(gear);
  await wait(50);
  assert(q(".ss"), "settings open");
  assert(q(".ss-state.is-active"), "status: shortcuts active");
  assert(/Photoshop is the active window/.test(q(".ss-state").textContent));
  assert(/File > Scripts/.test(q(".ss-steps").textContent), "fallback explained");
  assert.strictEqual(qa(".ss-row").length, 16);
  const key = (init) => window.dispatchEvent(new window.KeyboardEvent("keydown", Object.assign({ bubbles: true, cancelable: true }, init)));
  click(qa(".ss-row")[2].querySelectorAll("button")[0]); // 2 lines -> record
  await wait(50);
  key({ key: "Control", code: "ControlLeft", ctrlKey: true }); // modifiers alone do not finish it
  key({ key: "Alt", code: "AltLeft", ctrlKey: true, altKey: true });
  assert(/Press keys/.test(qa(".ss-row")[2].textContent), "still waiting for the real key");
  key({ key: "q", code: "KeyQ", ctrlKey: true, altKey: true });
  await wait(100);
  assert(/CTRL \+ ALT \+ Q/.test(qa(".ss-row")[2].textContent), "recorded: " + qa(".ss-row")[2].textContent);
  // the key watcher is restarted with the new table
  assert.strictEqual(spawned.length, 2, "restarted with the new shortcuts");
  assert(spawned[0].killed, "the old one is stopped");
  assert(/(^|;)2:CTRL\+ALT:81(;|$)/.test(spawned[1].args[spawned[1].args.indexOf("-Bindings") + 1]), "new table sent");
  spawned[1].stdout.emit("data", "READY\n");
  // Esc cancels, a duplicate is marked
  click(qa(".ss-row")[3].querySelectorAll("button")[0]); // 3 lines
  key({ key: "Escape", code: "Escape" });
  await wait(50);
  assert(/ALT \+ 3/.test(qa(".ss-row")[3].textContent), "Esc cancels: " + qa(".ss-row")[3].textContent);
  click(qa(".ss-row")[3].querySelectorAll("button")[0]);
  key({ key: "q", code: "KeyQ", ctrlKey: true, altKey: true });
  await wait(100);
  assert(qa(".ss-row.is-conflict").length === 2, "conflict marked");
  click(qa(".ss-row")[3].querySelectorAll("button")[1]); // clear
  await wait(50);
  assert(!qa(".ss-row.is-conflict").length, "conflict gone");
  click(q(".ss-foot .ss-btn")); // defaults
  await wait(100);
  const lastWatcher = spawned[spawned.length - 1];
  assert(/(^|;)2:ALT:50,98(;|$)/.test(lastWatcher.args[lastWatcher.args.indexOf("-Bindings") + 1]), "defaults back");
  lastWatcher.stdout.emit("data", "READY\n");
  // blocking: the status says whether Photoshop still sees the keys; the switch restarts the watcher without blocking
  lastWatcher.stdout.emit("data", "READY hook\n");
  await wait(50);
  assert(/does NOT receive/.test(q(".ss-state").textContent) && !q(".ss-state.is-open"), "hook: Photoshop does not see the keys: " + q(".ss-state").textContent);
  lastWatcher.stdout.emit("data", "READY poll\n");
  await wait(50);
  assert(/still receives/.test(q(".ss-state").textContent) && q(".ss-state.is-open"), "poll: warns that they still reach Photoshop");
  assert(q(".ss-poll input").checked, "block is on by default");
  const nBefore = spawned.length;
  click(q(".ss-poll input"));
  await wait(100);
  assert.strictEqual(spawned.length, nBefore + 1, "restarted");
  assert(lastWatcher.killed, "old one stopped");
  const openWatcher = spawned[spawned.length - 1];
  assert.strictEqual(openWatcher.args[openWatcher.args.indexOf("-Block") + 1], "0", "block off");
  assert.strictEqual(window.localStorage.getItem("typertoolBlockKeys"), "0", "remembered");
  click(q(".ss-poll input"));
  await wait(100);
  const blockedAgain = spawned[spawned.length - 1];
  assert.strictEqual(blockedAgain.args[blockedAgain.args.indexOf("-Block") + 1], "1", "block back on");
  blockedAgain.stdout.emit("data", "READY hook\n");
  const lastWatcher2 = blockedAgain;
  // a watcher that dies is reported (antivirus...), not hidden
  lastWatcher2.emit("exit", 1);
  await wait(50);
  assert(q(".ss-state.is-stopped"), "stopped is shown");
  click(q(".ss-close"));
  await wait(30);
  assert(!q(".ss"), "settings closed");

  // copy style: the typed base size of Sp (or Nar) goes to the host, the other box is ignored
  click(qa(".cs-base-btn")[1]); // Nar
  await wait(30);
  const narBox = qa(".cs-base-input")[1];
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setValue.call(narBox, "25");
  narBox.dispatchEvent(new window.Event("input", { bubbles: true }));
  await wait(30);
  calls.length = 0;
  click(q(".cs-run"));
  await wait(100);
  assert(calls.some((c2) => /^copyStylePanelRun\(.*,25\)$/.test(c2)), "Nar base size sent: " + calls.join(" | "));
  click(qa(".cs-base-btn")[1]); // deselect
  await wait(30);
  calls.length = 0;
  click(q(".cs-run"));
  await wait(100);
  assert(calls.some((c2) => /^copyStylePanelRun\(.*,0\)$/.test(c2)), "no box selected: automatic base size: " + calls.join(" | "));

  // the menu (auto center + number buttons) is pinned while the options scroll
  assert(q(".lb-sticky .lb-head") && q(".lb-sticky .lb-counts"), "menu inside the sticky block");
  assert(!q(".lb-sticky .lb-grid"), "the options are not part of it");

  // collapse buttons: at the right of every title bar; a collapsed panel does not work
  const toggles = () => qa(".section-title .section-toggle");
  assert.strictEqual(toggles().length, 4, "a collapse button on each panel");
  assert(qa(".section-title").every((t) => t.lastElementChild.classList.contains("section-toggle")), "at the right of the title");
  const aliveWatcher = spawned[spawned.length - 1];
  const watchersBefore = spawned.length;
  click(toggles()[0]);
  await wait(100);
  assert(!q(".lb"), "line break content gone");
  assert(q(".section-line-break").classList.contains("is-collapsed"));
  assert(aliveWatcher.killed, "the key watcher stops with the panel");
  assert(qa(".splitter")[0].classList.contains("is-disabled"), "bar next to a collapsed panel is disabled");
  const nApply = world.applyCount;
  sendShortcut("2");
  aliveWatcher.stdout.emit("data", "KEY 2\n");
  await wait(400);
  assert.strictEqual(world.applyCount, nApply, "shortcuts do nothing while the panel is collapsed");
  click(gear);
  await wait(50);
  assert(q(".ss-state.is-off"), "settings say it is off: " + q(".ss-state").textContent);
  click(q(".ss-close"));
  assert.deepStrictEqual(JSON.parse(window.localStorage.getItem("typertoolCollapsed")), [true, false, false, false], "remembered");
  click(toggles()[1]);
  click(toggles()[2]);
  click(toggles()[3]);
  await wait(100);
  assert(!q(".ct") && !q(".mip") && !q(".cs"), "the other three panels are gone too");
  assert.strictEqual(qa(".section.is-collapsed").length, 4);
  click(toggles()[0]);
  click(toggles()[1]);
  click(toggles()[2]);
  click(toggles()[3]);
  await wait(300);
  assert(q(".lb") && q(".ct") && q(".mip") && q(".cs"), "all panels back");
  assert.strictEqual(spawned.length, watchersBefore + 1, "the key watcher runs again");
  assert(!spawned[spawned.length - 1].killed);
  assert.deepStrictEqual(JSON.parse(window.localStorage.getItem("typertoolCollapsed")), [false, false, false, false]);

  // the bars still work around a collapsed panel: with the MIDDLE one collapsed they resize the other two
  const bars = () => qa(".splitter");
  const grabHeights = (h) => qa(".section").forEach((el, i) => { el.getBoundingClientRect = () => ({ height: h[i], top: 0, left: 0, right: 0, bottom: h[i], width: 300 }); });
  const fireMouse = (target, type, init) => target.dispatchEvent(new window.MouseEvent(type, Object.assign({ bubbles: true, button: 0, buttons: 1 }, init)));
  click(toggles()[1]); // collapse the middle one
  await wait(100);
  assert(!bars()[0].classList.contains("is-disabled") && !bars()[1].classList.contains("is-disabled"), "both bars work when the middle panel is collapsed");
  grabHeights([300, 30, 300, 200]);
  const weights = () => qa(".section").map((el) => parseFloat(el.style.flexGrow));
  const before3 = JSON.parse(window.localStorage.getItem("typertoolSectionSizes")) || [28, 24, 28, 20];
  fireMouse(bars()[0], "mousedown", { clientY: 300 });
  fireMouse(window.document, "mousemove", { clientY: 360 }); // +60 px
  await wait(30);
  fireMouse(window.document, "mouseup", { buttons: 0 });
  await wait(30);
  const w3 = weights();
  const open = w3[0] + w3[2];
  assert(Math.abs(w3[0] / open * 600 - 360) < 1.5 && Math.abs(w3[2] / open * 600 - 240) < 1.5, "top grew 60px, bottom shrank 60px: " + w3.join(","));
  const after3 = JSON.parse(window.localStorage.getItem("typertoolSectionSizes"));
  assert.strictEqual(after3[1], before3[1], "the collapsed panel keeps its own size for later");
  grabHeights([360, 30, 240, 200]); // what the layout is now
  fireMouse(bars()[1], "mousedown", { clientY: 600 }); // the other bar does the same pair
  fireMouse(window.document, "mousemove", { clientY: 540 }); // -60 px
  await wait(30);
  fireMouse(window.document, "mouseup", { buttons: 0 });
  await wait(30);
  const w4 = weights();
  assert(Math.abs(w4[0] / (w4[0] + w4[2]) * 600 - 300) < 1.5, "the second bar moved the same border back: " + w4.join(","));
  click(toggles()[1]); // open it again
  await wait(100);
  click(toggles()[0]); // now the first one is collapsed: the bar above the second has nothing open above it
  await wait(100);
  assert(bars()[0].classList.contains("is-disabled"), "nothing open above the first bar");
  assert(!bars()[1].classList.contains("is-disabled"), "the second bar still works");
  click(toggles()[0]);
  await wait(100);
  assert(!bars()[0].classList.contains("is-disabled"));
  await wait(100);

  // splitters: three bars between the four sections; dragging moves the border, double-click resets
  const splitters = qa(".splitter");
  assert.strictEqual(splitters.length, 3, "three bars between four sections");
  const secs = qa(".section");
  const heights = [300, 300, 200, 200];
  secs.forEach((el, i) => { el.getBoundingClientRect = () => ({ height: heights[i], top: 0, left: 0, right: 0, bottom: heights[i], width: 300 }); });
  const grow = () => secs.map((el) => parseFloat(el.style.flexGrow));
  const g0 = grow();
  assert(g0.every((n) => n > 0), "sections have a flex weight");
  const fire = (target, type, init) => target.dispatchEvent(new window.MouseEvent(type, Object.assign({ bubbles: true, button: 0, buttons: 1 }, init)));
  fire(splitters[0], "mousedown", { clientY: 300 });
  fire(window.document, "mousemove", { clientY: 380 }); // +80 px
  await wait(30);
  let g1 = grow();
  const sum = g1.reduce((a, b) => a + b, 0);
  assert(Math.abs(g1[0] / sum * 1000 - 380) < 1.5, "first section grew by 80px: " + g1[0] / sum * 1000);
  assert(Math.abs(g1[1] / sum * 1000 - 220) < 1.5, "second shrank by 80px");
  assert(Math.abs(g1[2] / sum * 1000 - 200) < 1.5, "third untouched");
  fire(window.document, "mousemove", { clientY: 1000 }); // way too far: the second keeps its minimum
  await wait(30);
  g1 = grow();
  const sum2 = g1.reduce((a, b) => a + b, 0);
  assert(Math.abs(g1[1] / sum2 * 1000 - 90) < 1.5, "minimum height respected: " + g1[1] / sum2 * 1000);
  fire(window.document, "mouseup", { buttons: 0 });
  await wait(30);
  const saved = JSON.parse(window.localStorage.getItem("typertoolSectionSizes"));
  assert(Array.isArray(saved) && saved.length === 4, "sizes remembered");
  assert(!window.document.body.classList.contains("is-resizing"), "drag ended");
  // moving after the button is up changes nothing
  const frozen = grow().join();
  fire(window.document, "mousemove", { clientY: 10, buttons: 0 });
  await wait(30);
  assert.strictEqual(grow().join(), frozen);
  splitters[1].dispatchEvent(new window.MouseEvent("dblclick", { bubbles: true }));
  await wait(30);
  assert.deepStrictEqual(grow(), [28, 24, 28, 20], "double-click resets");

  // --- Check type: a script against the layers of the document, once, then only the changed layer
  const ctEnter = () => q(".ct").dispatchEvent(new window.MouseEvent("mouseover", { bubbles: true, relatedTarget: null }));
  const ctRows = () => qa(".ct-row").map((r) => ({ num: r.querySelector(".ct-num").textContent, cls: r.className.replace("ct-row ", "") }));
  const ctCalls = () => calls.filter((c) => /^(typertoolScanTexts|typertoolDocKey|getActiveLayerText)/.test(c)).length;
  assert(q(".ct-empty"), "nothing to check before a script is added");
  assert.strictEqual(ctCalls(), 0, "Photoshop is not asked while there is no script");
  const addJson = async (text, name) => {
    const input = q(".ct input[type=file]");
    const file = new window.File([text], name || "script.json", { type: "application/json" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new window.Event("change", { bubbles: true }));
    await wait(300);
  };
  await addJson("1_ ENJOY YOUR MEAL.\n2_ WERE YOU BOTH SURPRISED?\n3_ SORRY, I WAS AFRAID YOU WOULDN'T COME\n4_ NOT TYPESET YET");
  assert.strictEqual(world.scanCount, 1, "the document is scanned once when the script comes in");
  // the closest texts are listed next to each other: by place on the page, not by number; no layer last
  assert.deepStrictEqual(ctRows().map((r) => r.num), ["1", "3", "2", "4"]);
  assert.deepStrictEqual(ctRows().map((r) => r.cls), ["is-ok", "is-ok", "is-ok", "is-missing"]);
  assert(/0 to fix/.test(q(".ct-summary").textContent), "summary: " + q(".ct-summary").textContent);
  assert(window.localStorage.getItem("typertoolCheckScript"), "the script is remembered");
  // the text of the layer in front is changed: only that layer is read again, its line turns red
  const scans = world.scanCount;
  world.docLayers[1].text = "ENJOY YOUR MEA\rL.";   // a word cut by a line break
  await wait(350);
  ctEnter();
  await wait(300);
  assert.strictEqual(world.scanCount, scans, "no second scan");
  assert(world.activeReads >= 1, "the changed layer was read");
  assert.deepStrictEqual(ctRows().map((r) => r.cls), ["is-bad", "is-ok", "is-ok", "is-missing"], "the cut word is red");
  assert(/1 to fix/.test(q(".ct-summary").textContent));
  world.docLayers[1].text = "ENJOY\rYOUR MEAL.";   // fixed: a break between words is fine
  await wait(350);
  ctEnter();
  await wait(300);
  assert.deepStrictEqual(ctRows().map((r) => r.cls), ["is-ok", "is-ok", "is-ok", "is-missing"], "back to normal");
  // nothing runs in the background
  const idle = ctCalls();
  await wait(1500);
  assert.strictEqual(ctCalls(), idle, "no polling");
  // another document comes in front: the one full scan
  world.docKey = "8|page2.psd";
  world.activeId = 21;
  world.docLayers = [
    { id: 21, name: "DKI: 4_ NOT", text: "NOT TYPESET\rYET", box: { left: 10, top: 50, right: 90, bottom: 90 } },
    { id: 22, name: "1_ ENJOY", text: "ENJOY MY MEAL.", box: { left: 10, top: 10, right: 90, bottom: 40 } },
  ];
  await wait(350);
  ctEnter();
  await wait(300);
  assert.strictEqual(world.scanCount, scans + 1, "the new file is scanned once");
  assert.deepStrictEqual(ctRows().map((r) => [r.num, r.cls]), [["1", "is-bad"], ["4", "is-ok"], ["2", "is-missing"], ["3", "is-missing"]]);
  // the Rescan button scans again, a closed document says so
  click(qa(".ct-btn")[1]);
  await wait(300);
  assert.strictEqual(world.scanCount, scans + 2);
  world.noDoc = true;
  await wait(350);
  ctEnter();
  await wait(300);
  assert(q(".ct-note") && /Open a file/.test(q(".ct-note").textContent), "no document: said");
  assert(ctRows().every((r) => r.cls === "is-idle"), "no judgement without a scan");
  world.noDoc = false;

  // ---- settings: two tabs. "Interface layout" = one card per panel with an eye (show / switch off) and Move up / Move down
  assert(/Settings/.test(gear.textContent), "the button of the header is the settings button");
  click(gear);
  await wait(50);
  assert(q(".ss"), "settings open");
  assert.deepStrictEqual(qa(".ss-tab").map((b) => b.textContent), ["Shortcuts", "Interface layout"], "two tabs on top");
  assert(q(".ss-tab-shortcuts").classList.contains("is-on") && q(".ss-row"), "opens on the shortcuts, same as before");
  click(q(".ss-tab-layout"));
  await wait(50);
  assert(q(".ss-tab-layout").classList.contains("is-on") && !q(".ss-row"), "layout tab shown, shortcut rows gone");
  const cards = () => qa(".ll-card");
  const cardOf = (name) => cards().find((c) => c.querySelector(".ll-name").textContent === name);
  const sectionNames = () => qa(".section-title span").map((e) => e.textContent);
  assert.deepStrictEqual(cards().map((c) => c.querySelector(".ll-name").textContent), ["Line break", "Check type", "Image mask", "Copy style"]);
  assert(cards()[0].querySelector(".ll-up").disabled && !cards()[0].querySelector(".ll-down").disabled, "first card: no Move up");
  assert(!cards()[3].querySelector(".ll-up").disabled && cards()[3].querySelector(".ll-down").disabled, "last card: no Move down");
  assert(cards().every((c) => c.querySelector(".ll-eye")), "an eye on every card");
  // moving: Line break one step down; the panel is not rebuilt (it keeps its state)
  const lbNode = q(".lb");
  click(cardOf("Line break").querySelector(".ll-down"));
  await wait(50);
  assert.deepStrictEqual(sectionNames(), ["Check type", "Line break", "Image mask", "Copy style"], "panel moved down");
  assert.deepStrictEqual(cards().map((c) => c.querySelector(".ll-name").textContent), ["Check type", "Line break", "Image mask", "Copy style"], "cards follow");
  assert(q(".lb") === lbNode, "moving does not rebuild the panel");
  assert.deepStrictEqual(JSON.parse(window.localStorage.getItem("typertoolOrder")), [1, 0, 2, 3], "order remembered");
  assert(!cardOf("Line break").querySelector(".ll-up").disabled, "it can go up again now");
  click(cardOf("Copy style").querySelector(".ll-up"));
  await wait(50);
  assert.deepStrictEqual(sectionNames(), ["Check type", "Line break", "Copy style", "Image mask"]);
  click(cardOf("Image mask").querySelector(".ll-up")); // back to where it was
  click(cardOf("Line break").querySelector(".ll-up"));
  await wait(50);
  assert.deepStrictEqual(sectionNames(), ["Line break", "Check type", "Image mask", "Copy style"], "back to the default order");
  // eye: the panel disappears completely (title bar too) and is not running
  assert.strictEqual(qa(".splitter").length, 3);
  assert(q(".ct"), "check type is running");
  click(cardOf("Check type").querySelector(".ll-eye"));
  await wait(60);
  assert(!q(".section-check") && !q(".ct"), "check type: no title bar, nothing mounted");
  assert.deepStrictEqual(sectionNames(), ["Line break", "Image mask", "Copy style"]);
  assert.strictEqual(qa(".splitter").length, 2, "one bar less");
  assert(cardOf("Check type").classList.contains("is-hidden"), "its card is dimmed");
  assert(cardOf("Check type").querySelector(".ll-eye").getAttribute("aria-pressed") === "false");
  assert.deepStrictEqual(JSON.parse(window.localStorage.getItem("typertoolHidden")), [false, true, false, false], "remembered");
  // a hidden panel does not work: hiding the line break stops its key watcher and its shortcuts
  const watcherNow = spawned[spawned.length - 1];
  const appliedBefore = world.applyCount;
  click(cardOf("Line break").querySelector(".ll-eye"));
  await wait(60);
  assert(!q(".lb") && !q(".section-line-break"), "line break gone completely");
  assert(watcherNow.killed, "its key watcher stopped");
  sendShortcut("2");
  await wait(300);
  assert.strictEqual(world.applyCount, appliedBefore, "no shortcut works while it is hidden");
  click(q(".ss-tab-shortcuts"));
  await wait(50);
  assert(q(".ss-state.is-off"), "the shortcuts tab says it is off: " + q(".ss-state").textContent);
  assert(/hidden/.test(q(".ss-state").textContent));
  click(q(".ss-tab-layout"));
  await wait(50);
  const watchersBefore2 = spawned.length;
  click(cardOf("Line break").querySelector(".ll-eye"));
  await wait(300);
  assert(q(".lb") && q(".section-line-break"), "line break is back");
  assert.strictEqual(spawned.length, watchersBefore2 + 1, "its key watcher runs again");
  // the bars work on what is drawn: line break (0), image mask (2), copy style (3) with check type hidden
  assert.deepStrictEqual(sectionNames(), ["Line break", "Image mask", "Copy style"]);
  const shown = qa(".section");
  const hh = [300, 300, 200];
  shown.forEach((el, i) => { el.getBoundingClientRect = () => ({ height: hh[i], top: 0, left: 0, right: 0, bottom: hh[i], width: 300 }); });
  const share = () => { const g = qa(".section").map((el) => parseFloat(el.style.flexGrow)); const t = g.reduce((x, y) => x + y, 0); return g.map((v) => v / t * 800); };
  const fireM = (target, type, init) => target.dispatchEvent(new window.MouseEvent(type, Object.assign({ bubbles: true, button: 0, buttons: 1 }, init)));
  const barsNow = qa(".splitter");
  assert.strictEqual(barsNow.length, 2);
  assert(barsNow.every((b) => !b.classList.contains("is-disabled")));
  fireM(barsNow[0], "mousedown", { clientY: 300 });
  fireM(window.document, "mousemove", { clientY: 340 }); // +40 px
  await wait(30);
  fireM(window.document, "mouseup", { buttons: 0 });
  await wait(30);
  const sh = share();
  assert(Math.abs(sh[0] - 340) < 1.5 && Math.abs(sh[1] - 260) < 1.5 && Math.abs(sh[2] - 200) < 1.5, "the first bar moved the border of line break / image mask: " + sh.join(","));
  // moving a panel keeps its own collapsed state and size
  click(toggles()[1]); // collapse image mask (second drawn)
  await wait(60);
  assert.deepStrictEqual(JSON.parse(window.localStorage.getItem("typertoolCollapsed")), [false, false, true, false], "collapsed state belongs to the panel (image mask = 2)");
  click(cardOf("Image mask").querySelector(".ll-up"));
  await wait(50);
  assert.deepStrictEqual(sectionNames(), ["Line break", "Image mask", "Copy style"], "check type (hidden) swapped with image mask: same drawn order");
  click(cardOf("Image mask").querySelector(".ll-up"));
  await wait(50);
  assert.deepStrictEqual(sectionNames(), ["Image mask", "Line break", "Copy style"]);
  assert(q(".section-mask").classList.contains("is-collapsed"), "image mask is still collapsed after moving");
  click(toggles()[0]); // expand it
  await wait(60);
  // everything hidden: a note, nothing else running
  ["Line break", "Image mask", "Copy style"].forEach((n) => click(cardOf(n).querySelector(".ll-eye")));
  await wait(80);
  assert(!q(".section") && q(".app-empty"), "all hidden: only a note is left");
  assert(/Interface layout/.test(q(".app-empty").textContent), "the note says where to bring them back");
  assert.strictEqual(qa(".ll-card.is-hidden").length, 4);
  // back: show everything and restore the default order
  cards().forEach((c) => click(c.querySelector(".ll-eye")));
  await wait(100);
  assert.strictEqual(qa(".section").length, 4, "all four back");
  assert.deepStrictEqual(JSON.parse(window.localStorage.getItem("typertoolHidden")), [false, false, false, false]);
  // a stale order saved by an older version must not break the tool
  const orderBefore = window.localStorage.getItem("typertoolOrder");
  assert(JSON.parse(orderBefore).length === 4);
  // the tab can be left while a shortcut is being recorded
  click(q(".ss-tab-shortcuts"));
  await wait(50);
  click(qa(".ss-row")[1].querySelectorAll("button")[0]);
  await wait(50);
  assert(/Press keys/.test(qa(".ss-row")[1].textContent), "recording");
  click(q(".ss-tab-layout"));
  await wait(50);
  click(q(".ss-tab-shortcuts"));
  await wait(50);
  assert(!/Press keys/.test(qa(".ss-row")[1].textContent), "recording ended when the tab was left");
  click(q(".ss-close"));
  await wait(30);
  assert(!q(".ss"), "settings closed");
  // restore the default order for the checks below
  window.localStorage.setItem("typertoolOrder", JSON.stringify([0, 1, 2, 3]));

  // image mask: the thumbnails come two to a line
  const css = fs.readFileSync(path.join(dist, "css/bundle.css"), "utf8");
  assert(/\.mip-list\{[^}]*display:grid[^}]*grid-template-columns:1fr 1fr/.test(css), "image list is a 2 column grid");
  assert(/\.mip-empty\{[^}]*grid-column:1\s*\/\s*-1/.test(css), "the empty note spans both columns");

  // image mask panel present with its buttons and copy style switches
  assert(qa(".mip-btn").length === 4);
  assert.strictEqual(qa(".cs-toggle").length, 3);
  console.log("panel tests passed");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
