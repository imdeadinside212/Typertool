// The shortcut table of the line break buttons (see globalKeys.js for how the keys are heard).

export const MODIFIERS = ["WIN", "CTRL", "ALT", "SHIFT"];
export const COMMANDS = ["best"].concat(Array.from({ length: 15 }, (_, i) => String(i + 1)));

// ALT+1..ALT+9 pick the 1..9 line buttons, ALT+0 the best option
export const DEFAULT_BINDINGS = (() => {
  const bindings = { best: ["ALT", "0"] };
  for (let n = 1; n <= 9; n++) bindings[String(n)] = ["ALT", String(n)];
  return bindings;
})();

const STORAGE_KEY = "typertoolShortcuts";

export const loadBindings = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch (error) {}
  return Object.assign({}, DEFAULT_BINDINGS);
};

export const saveBindings = (bindings) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch (error) {}
};

// "NUMPAD1", "DIGIT1" and "1" are the same key for a shortcut
export const normalizeKey = (key) => {
  const upper = String(key || "").toUpperCase();
  const digit = upper.match(/^(?:NUMPAD|NUM|KP|DIGIT)([0-9])$/);
  return digit ? digit[1] : upper;
};

export const describeBinding = (binding) => (Array.isArray(binding) && binding.length ? binding.join(" + ") : "—");

// Duplicated combinations: { command: true }
export const findConflicts = (bindings) => {
  const seen = {};
  const conflicts = {};
  COMMANDS.forEach((command) => {
    const binding = bindings[command];
    if (!Array.isArray(binding) || !binding.length) return;
    const key = binding.map(normalizeKey).sort().join("+");
    if (seen[key]) {
      conflicts[command] = true;
      conflicts[seen[key]] = true;
    } else {
      seen[key] = command;
    }
  });
  return conflicts;
};

// Name of the pressed key for a shortcut ("1", "Q", "F5"), or null for keys that cannot be used
export const keyNameOf = (event) => {
  const code = String(event.code || "");
  let m = code.match(/^(?:Digit|Numpad)([0-9])$/);
  if (m) return m[1];
  m = code.match(/^Key([A-Z])$/);
  if (m) return m[1];
  m = code.match(/^F([0-9]{1,2})$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return "F" + m[1];
  const key = String(event.key || "");
  return /^[a-zA-Z0-9]$/.test(key) ? key.toUpperCase() : null;
};

// Records the next combination from the keys pressed in the panel (Record button):
// `onDone(keys | null)`, null = cancelled with Esc. Returns a function that cancels.
export const recordCombination = (onDone) => {
  let done = false;
  const finish = (keys) => {
    if (done) return;
    done = true;
    window.removeEventListener("keydown", onKey, true);
    onDone(keys);
  };
  function onKey(event) {
    if (["Alt", "Control", "Shift", "Meta", "OS"].includes(event.key)) return; // wait for the real key
    event.preventDefault();
    event.stopPropagation();
    const mods = [];
    if (event.metaKey) mods.push("WIN");
    if (event.ctrlKey) mods.push("CTRL");
    if (event.altKey) mods.push("ALT");
    if (event.shiftKey) mods.push("SHIFT");
    if (event.key === "Escape" && !mods.length) {
      finish(null);
      return;
    }
    const name = keyNameOf(event);
    if (name) finish(mods.concat([name]));
  }
  window.addEventListener("keydown", onKey, true);
  return () => {
    if (done) return;
    done = true;
    window.removeEventListener("keydown", onKey, true);
  };
};
