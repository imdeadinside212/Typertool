// The shortcuts of the line break buttons, listened to WITHOUT asking Photoshop anything.
//
// Photoshop does not give the keyboard to a panel while the canvas has the focus, and asking
// Photoshop for the key state again and again slows it down. So the panel starts a tiny helper
// process (ext/keys/KeyWatcher.cs, run by PowerShell; Windows only) that only looks at the
// shortcut keys and prints a line when one is pressed while Photoshop is the active window.
// The panel (Node is enabled for it) reads those lines: Photoshop is never involved.
import { csInterface } from "../shim/utils";
import { COMMANDS, MODIFIERS } from "./hotkeys";

// "A".."Z", "0".."9" (and the numpad), "F1".."F12" -> Windows virtual key codes
export const virtualKeys = (name) => {
  const key = String(name || "").toUpperCase();
  if (/^[0-9]$/.test(key)) return [48 + Number(key), 96 + Number(key)];
  if (/^[A-Z]$/.test(key)) return [key.charCodeAt(0)];
  const f = key.match(/^F([0-9]{1,2})$/);
  if (f && Number(f[1]) >= 1 && Number(f[1]) <= 12) return [111 + Number(f[1])];
  return [];
};

// { "3": ["ALT", "3"], best: ["ALT", "0"] } -> "3:ALT:51,99;best:ALT:48,96"
export const helperArgument = (bindings) => {
  const parts = [];
  COMMANDS.forEach((command) => {
    const binding = bindings && bindings[command];
    if (!Array.isArray(binding) || !binding.length) return;
    const mods = MODIFIERS.filter((m) => binding.includes(m));
    const keys = binding.filter((k) => !MODIFIERS.includes(String(k).toUpperCase()));
    if (keys.length !== 1) return;
    const vks = virtualKeys(keys[0]);
    if (!vks.length) return;
    parts.push(command + ":" + (mods.length ? mods.join("+") : "NONE") + ":" + vks.join(","));
  });
  return parts.join(";");
};

const nodeRequire = () => (window.cep_node && window.cep_node.require) || window.require || null;

const extensionFolder = () => {
  let base = "";
  try {
    base = String(csInterface.getSystemPath("extension") || "");
  } catch (error) {}
  if (/^file:\/\/\//i.test(base)) base = decodeURIComponent(base.replace(/^file:\/\/\//i, ""));
  return base.replace(/\\/g, "/").replace(/\/+$/, "");
};

// Starts the watcher; onStatus({ state, detail }) with state = starting | active (detail: hook | poll) |
// stopped | unavailable | idle. block: keep the keys of a shortcut away from Photoshop. Returns stop().
export const startGlobalKeys = ({ bindings, block = true, onPress, onStatus }) => {
  const say = (state, detail) => onStatus && onStatus({ state, detail: detail || "" });
  const platform = (window.process && window.process.platform) || "";
  if (!/^win/i.test(platform)) {
    say("unavailable", "windows");
    return () => {};
  }
  const argument = helperArgument(bindings);
  if (!argument) {
    say("idle", "no-bindings");
    return () => {};
  }
  const req = nodeRequire();
  if (!req) {
    say("unavailable", "node");
    return () => {};
  }
  let stopped = false;
  let child = null;
  let pending = "";
  let errors = "";
  say("starting");
  try {
    child = req("child_process").spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass",
        "-File", extensionFolder() + "/keys/typertool-keys.ps1",
        "-ParentPid", String((window.process && window.process.pid) || 0), "-Bindings", argument,
        "-Block", block ? "1" : "0"],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch (error) {
    say("unavailable", String((error && error.message) || error));
    return () => {};
  }
  child.stdout.on("data", (chunk) => {
    pending += String(chunk);
    let at;
    while ((at = pending.indexOf("\n")) >= 0) {
      const line = pending.slice(0, at).trim();
      pending = pending.slice(at + 1);
      // "READY hook": the keys are kept away from Photoshop; "READY poll": only heard
      if (line.indexOf("READY") === 0) say("active", line.slice(5).trim());
      else if (line.indexOf("KEY ") === 0 && !stopped) onPress(line.slice(4).trim());
    }
  });
  child.stderr.on("data", (chunk) => {
    errors = (errors + String(chunk)).slice(-400);
  });
  child.on("error", (error) => {
    if (!stopped) say("unavailable", String((error && error.message) || error));
  });
  child.on("exit", (code) => {
    if (!stopped) say("stopped", errors.trim() || "exit " + code);
  });
  return () => {
    stopped = true;
    try {
      child.kill();
    } catch (error) {}
  };
};
