// Check type: the lines of a script (.json from the TypeR tool, or "1_ text" lines) against the
// text layers of the open document. Pure functions: the panel does the Photoshop calls.
//
// A layer belongs to a script line when its NAME starts with the same code ("1_", "DKI: 1_").
// The line is bad when the text of that layer is not the text of the script: the words must be
// the same; a line break between two words is fine, a break that cuts a word (or a hyphen at the
// end of a line) changes the words and is bad.

const MARKER_RE = /^[\s"'\[\{,]*((?:[^\s_:"']{1,8}\s*:\s*)?[^\s_:"']{1,8})\s*_[ \t]*/;

const normalizeKey = (value) => String(value || "").toLowerCase().replace(/\s+/g, "");
const tailOf = (key) => key.split(":").pop();

export const parseMarker = (value) => {
  const match = MARKER_RE.exec(String(value || ""));
  if (!match) return null;
  const key = normalizeKey(match[1]);
  if (!key) return null;
  return { key, tail: tailOf(key), rest: String(value).slice(match[0].length) };
};


const decodeEntities = (text) => String(text)
  .replace(/&nbsp;/gi, " ")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&quot;/gi, "\"")
  .replace(/&#x([0-9a-f]+);/gi, (match, code) => String.fromCharCode(parseInt(code, 16)))
  .replace(/&#(\d+);/g, (match, code) => String.fromCharCode(parseInt(code, 10)))
  .replace(/&apos;/gi, "'")
  .replace(/&amp;/gi, "&");

// "<p><span style=...>TEXT</span></p>" -> "TEXT"
const htmlToText = (html) => decodeEntities(
  String(html)
    .replace(/<\s*br\s*\/?>/gi, " ")
    .replace(/<\/p>\s*<p[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
).replace(/\s+/g, " ").trim();

// Export with { payload: { en_US: { "<id>": { position, content: "<p>..</p>" } } } }:
// only the texts count. Every entry is one line, in the order of the file,
// numbered 1, 2, 3...; the ids of the file are not used and nothing is merged
// or dropped.
const convertContentJson = (data) => {
  let container = null;
  const find = (node) => {
    if (container || !node || typeof node !== "object") return;
    const values = Array.isArray(node) ? node : Object.keys(node).map((key) => node[key]);
    const entries = values.filter((value) => value && typeof value === "object" && typeof value.content === "string");
    if (entries.length) {
      container = entries;
      return;
    }
    values.forEach(find);
  };
  find(data);
  if (!container) return null;
  return container.map((entry, index) => (index + 1) + "_ " + htmlToText(entry.content)).join("\n");
};

export const convertScriptJson = (raw) => {
  const trimmed = String(raw || "").trim();
  if (trimmed[0] !== "{" && trimmed[0] !== "[") return null;
  let data;
  try {
    data = JSON.parse(trimmed);
  } catch (error) {
    return null;
  }
  const fromContent = convertContentJson(data);
  if (fromContent) return fromContent;
  const boxes = [];
  const collect = (node) => {
    if (Array.isArray(node)) {
      node.forEach(collect);
    } else if (node && typeof node === "object") {
      if (Array.isArray(node.textBoxes)) boxes.push(...node.textBoxes);
      else Object.keys(node).forEach((key) => collect(node[key]));
    }
  };
  collect(data);
  const lines = [];
  boxes.forEach((box) => {
    if (!box || typeof box.text !== "string") return;
    const flat = box.text.replace(/\s*[\r\n\t]+\s*/g, " ").replace(/\s{2,}/g, " ").trim();
    if (!flat) return;
    let mark = box.mark != null ? String(box.mark).trim() : "";
    if (!mark && typeof box.layerName === "string") {
      const fromName = parseMarker(box.layerName);
      if (fromName) mark = fromName.key;
    }
    lines.push(mark ? mark + "_ " + flat : flat);
  });
  return lines.length ? lines.join("\n") : null;
};


// The lines of a script in order: [{ key, tail, text }]. Lines without a code are not part of it.
export const parseScript = (raw) => {
  const text = String(raw || "").replace(/^\uFEFF/, "");
  const lines = (convertScriptJson(text) || text).split(/\r?\n/);
  const rows = [];
  lines.forEach((line) => {
    const marker = parseMarker(line);
    if (marker) rows.push({ key: marker.key, tail: marker.tail, text: marker.rest.replace(/\s+/g, " ").trim() });
  });
  return rows;
};

// Same words once the line breaks are turned into spaces
export const normalizeWords = (value) => {
  let text = String(value || "");
  if (text.normalize) text = text.normalize("NFC");
  return text.replace(/\*+/g, "").replace(/\s+/g, " ").trim();
};

// layers: [{ id, name, text }] -> the lookup used by checkRows
const indexLayers = (layers) => {
  const byKey = new Map();
  const byTail = new Map();
  const put = (map, key, layer) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(layer);
  };
  layers.forEach((layer) => {
    const marker = parseMarker(layer.name);
    if (!marker) return;
    const entry = { id: layer.id, key: marker.key, text: layer.text, box: layer.box || null };
    put(byKey, marker.key, entry);
    put(byTail, marker.tail, entry);
  });
  return { byKey, byTail };
};

const sameWords = (layer, row) => {
  let actual = String(layer.text || "");
  const inText = parseMarker(actual);
  if (inText && inText.key === row.key) actual = inText.rest;
  return normalizeWords(actual) === normalizeWords(row.text);
};

// status of every row: "ok", "bad" (a layer with this code has other text) or "missing" (no layer has this code)
export const checkRows = (rows, layers) => {
  const index = indexLayers(layers);
  return rows.map((row) => {
    const found = index.byKey.get(row.key) || index.byTail.get(row.tail) || [];
    if (!found.length) return { status: "missing", layerIds: [], box: null };
    const bad = found.some((layer) => !sameWords(layer, row));
    const placed = found.find((layer) => layer.box);
    return { status: bad ? "bad" : "ok", layerIds: found.map((layer) => layer.id), box: placed ? placed.box : null };
  });
};

// The order of the list: texts that sit close to each other on the page are listed next to each
// other (top to bottom; texts side by side on the same band go left to right). Rows whose layer
// is not known (missing, or no position) come last, in the order of the script.
export const arrangeRows = (checks) => {
  const placed = [];
  const rest = [];
  checks.forEach((check, index) => {
    if (check.box) placed.push({ index, box: check.box });
    else rest.push(index);
  });
  placed.sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left || a.index - b.index);
  // a band = texts whose vertical extents overlap by more than half of the smaller one
  const bands = [];
  placed.forEach((item) => {
    const band = bands[bands.length - 1];
    const height = Math.max(1, item.box.bottom - item.box.top);
    if (band) {
      const overlap = Math.min(band.bottom, item.box.bottom) - Math.max(band.top, item.box.top);
      if (overlap > 0.5 * Math.min(height, Math.max(1, band.minHeight))) {
        band.items.push(item);
        band.bottom = Math.max(band.bottom, item.box.bottom);
        band.minHeight = Math.min(band.minHeight, height);
        return;
      }
    }
    bands.push({ top: item.box.top, bottom: item.box.bottom, minHeight: height, items: [item] });
  });
  const order = [];
  bands.forEach((band) => {
    band.items.sort((a, b) => a.box.left - b.box.left || a.index - b.index);
    band.items.forEach((item) => order.push(item.index));
  });
  return order.concat(rest);
};
