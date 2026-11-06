// Line breaker of Typertool.
//
// Rules (they are what the user asked for, none of them is a heuristic):
//  - a line only ever breaks BETWEEN words: no hyphenation, no word is cut;
//  - a mark after a word (? ! ... ?? !! , . ; : ...) always stays with the word
//    before it, with or without a space in between;
//  - when the very first word of the text has a single character, it cannot
//    stand alone on the first line (it needs at least one more word);
//  - for a given number of lines every option is a different breaking. The FIRST one is
//    the result of the "Line Breaker" scripts (classicBreaker.js: diamond shape); the
//    next ones are the closest alternatives under the same cost (one or two words
//    moved) and the roundest breakings found by dynamic programming.

// Same character width model as the TypeR engine (1 = a normal letter)
import { classicLines, makeCost, optimalLineCount } from './classicBreaker.js';

export const charWidth = (char) => {
  if (!char) return 0;
  if (/\s/.test(char)) return 0.45;
  if (/[ilI.,;:!|'’]/.test(char)) return 0.45;
  if (/[mwMW@#%&]/.test(char)) return 1.32;
  if (/[A-ZÀÂÄÉÈÊËÎÏÔÖÙÛÜ]/.test(char)) return 1.12;
  return 1;
};

export const textWidth = (text) => {
  let width = 0;
  const clean = String(text || "");
  for (let i = 0; i < clean.length; i++) width += charWidth(clean[i]);
  return width;
};

const SPACE = charWidth(" ");
const PUNCT_ONLY = /^[!?.,;:…~"'“”‘’«»()\[\]{}<>*\-–—_♡♥❤★☆]+$/;
const OPENERS_ONLY = /^[“‘«(\[{<¿¡]+$/;
const LETTER = /[A-Za-z0-9\u00C0-\u024F\u1E00-\u1EFF\u0370-\u03FF\u0400-\u04FF\u3040-\u9FFF\uAC00-\uD7AF]/g;

export const coreLength = (unit) => (String(unit).match(LETTER) || []).length;

// The unbreakable pieces of a text: words, with the marks that follow them
// (and the opening marks that precede them) glued on, spaces included, so the
// text of a unit is exactly what the user typed
export const buildUnits = (text) => {
  const tokens = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const units = [];
  let forward = "";
  tokens.forEach((token) => {
    if (OPENERS_ONLY.test(token) || (PUNCT_ONLY.test(token) && !units.length)) {
      forward = forward ? forward + " " + token : token;
      return;
    }
    if (PUNCT_ONLY.test(token)) {
      units[units.length - 1] += " " + token;
      return;
    }
    units.push(forward ? forward + " " + token : token);
    forward = "";
  });
  if (forward) {
    if (units.length) units[units.length - 1] += " " + forward;
    else units.push(forward);
  }
  return units;
};

export const buildContext = (text) => {
  const units = buildUnits(text);
  const widths = units.map(textWidth);
  const prefix = [0];
  widths.forEach((w, i) => prefix.push(prefix[i] + w));
  return {
    units,
    widths,
    prefix,
    total: prefix[prefix.length - 1],
    // A one-character first word cannot be alone on its line
    firstNeedsCompany: units.length > 1 && coreLength(units[0]) === 1,
  };
};

// Width of the units [i, j) written on one line
const lineWidth = (ctx, i, j) => ctx.prefix[j] - ctx.prefix[i] + (j - i - 1) * SPACE;

// How wide the lines of a round block of N lines are (1 = the widest line)
const idealProfile = (N) => {
  if (N <= 2) return new Array(N).fill(1);
  const raw = [];
  for (let j = 0; j < N; j++) {
    const t = ((j + 0.5) / N) * 2 - 1;
    raw.push(Math.sqrt(Math.max(0, 1 - t * t)));
  }
  const top = Math.max(...raw);
  return raw.map((v) => v / top);
};

// The K cheapest ways to write the units on exactly N lines, where the cost of
// a way is how far its lines are from a round block (K-best dynamic program)
const kBest = (ctx, N, K) => {
  const m = ctx.units.length;
  if (N < 1 || N > m) return [];
  const profile = idealProfile(N);
  const profileSum = profile.reduce((a, b) => a + b, 0);
  const scale = (ctx.total + (m - N) * SPACE) / profileSum;
  const cost = (k, i, j) => {
    const d = (lineWidth(ctx, i, j) - scale * profile[k]) / scale;
    return d * d;
  };
  // table[k][j]: best partial solutions for the first j units on k+1 lines
  let table = [];
  for (let k = 0; k < N; k++) table.push(new Array(m + 1).fill(null).map(() => []));
  for (let j = 1; j <= m; j++) {
    if (ctx.firstNeedsCompany && j < 2) continue;
    table[0][j] = [{ cost: cost(0, 0, j), prev: 0, rank: 0 }];
  }
  for (let k = 1; k < N; k++) {
    for (let j = k + 1; j <= m; j++) {
      const candidates = [];
      for (let i = k; i < j; i++) {
        const before = table[k - 1][i];
        for (let r = 0; r < before.length; r++) {
          candidates.push({ cost: before[r].cost + cost(k, i, j), prev: i, rank: r });
        }
      }
      candidates.sort((a, b) => a.cost - b.cost);
      table[k][j] = candidates.slice(0, K);
    }
  }
  const finals = table[N - 1][m];
  return finals.map((entry, index) => {
    const starts = [];
    let j = m;
    let k = N - 1;
    let cursor = entry;
    for (;;) {
      starts.push(cursor.prev);
      if (k === 0) break;
      const previous = table[k - 1][cursor.prev][cursor.rank];
      j = cursor.prev;
      cursor = previous;
      k--;
    }
    return { starts: starts.reverse(), dp: entry.cost, index };
  });
};

export const layoutOf = (ctx, starts) => {
  const bounds = starts.concat([ctx.units.length]);
  const lines = [];
  const widths = [];
  for (let k = 0; k < starts.length; k++) {
    lines.push(ctx.units.slice(bounds[k], bounds[k + 1]).join(" "));
    widths.push(lineWidth(ctx, bounds[k], bounds[k + 1]));
  }
  return { lines, widths, text: lines.join("\n"), count: lines.length, key: starts.join(",") };
};

// Roundness of a layout: lower is rounder. `target` is the width/height of the
// place the text goes in (1 = a circle); `lineUnits` the height of a line in
// the width unit of charWidth; `fit` (optional) says how big the place is.
export const scoreLayout = (layout, { target = 1, lineUnits = 2.0, fit = null } = {}) => {
  const N = layout.count;
  const M = Math.max(...layout.widths);
  const profile = idealProfile(N);
  let deviation = 0;
  for (let k = 0; k < N; k++) {
    const d = layout.widths[k] / M - profile[k];
    deviation += d * d;
  }
  deviation /= N;
  const aspect = M / (N * lineUnits);
  const aspectGap = Math.log(aspect / target);
  let score = deviation + 0.18 * aspectGap * aspectGap;
  if (fit && fit.unitPx > 0 && fit.width > 0 && fit.height > 0) {
    const over = Math.max((M * fit.unitPx) / (0.85 * fit.width), (N * lineUnits * fit.unitPx) / (0.85 * fit.height));
    if (over > 1) score += 1.5 * (over - 1);
  }
  return score;
};

const startsOfLines = (lines) => {
  const starts = [];
  let at = 0;
  lines.forEach((line) => {
    starts.push(at);
    at += line.length;
  });
  return starts;
};

// Breakings next to `starts`: each line break moved by one or two words
const neighbours = (starts, m) => {
  const out = [];
  for (let j = 1; j < starts.length; j++) {
    [-2, -1, 1, 2].forEach((d) => {
      const next = starts.slice();
      next[j] += d;
      const lo = next[j - 1] + 1;
      const hi = (j + 1 < next.length ? next[j + 1] : m) - 1;
      if (next[j] >= lo && next[j] <= hi) out.push(next);
    });
  }
  return out;
};

const LEADING_ZERO_LINE = /^\s*(0|00|000)(\s+.*|$)/;

// The options of one line count: the result of the scripts first, then up to `limit - 1`
// other breakings, the cheapest first (same cost as the scripts)
export const optionsForLineCount = (ctx, N, settings = {}, limit = 10) => {
  const m = ctx.units.length;
  if (N < 1 || N > m) return [];
  const totalChars = ctx.units.reduce((sum, u) => sum + u.length, 0) + Math.max(0, m - 1);
  const cost = makeCost(N, totalChars);
  const validStarts = (starts) => !(ctx.firstNeedsCompany && N > 1 && starts[1] < 2);

  const classic = classicLines(ctx.units, N);
  const classicStarts = classic ? startsOfLines(classic) : null;

  const pool = [];
  kBest(ctx, N, 60).forEach((candidate) => pool.push(candidate.starts));
  if (classicStarts) neighbours(classicStarts, m).forEach((starts) => pool.push(starts));

  const seen = new Set();
  const decorate = (starts, isClassic) => {
    const layout = layoutOf(ctx, starts);
    if (seen.has(layout.text)) return null;
    seen.add(layout.text);
    return Object.assign(layout, {
      score: scoreLayout(layout, settings),
      cost: cost(layout.lines),
      classic: isClassic,
    });
  };

  const options = [];
  const first = classicStarts ? decorate(classicStarts, true) : null;
  const rest = [];
  pool.forEach((starts) => {
    if (!validStarts(starts)) return;
    const option = decorate(starts, false);
    if (option) rest.push(option);
  });
  // lines that start with 0 / 00 / 000 only when there is nothing else
  const clean = rest.filter((o) => !o.lines.slice(1).some((l) => LEADING_ZERO_LINE.test(l)));
  const chosen = clean.length ? clean : rest;
  chosen.sort((a, b) => a.cost - b.cost || a.score - b.score || a.key.localeCompare(b.key));
  if (first) options.push(first);
  chosen.forEach((o) => options.push(o));
  return options.slice(0, limit);
};

// Everything the panel shows: the options of each line count (1..max) and the
// best ones over all line counts ("best" button: at most `perCount` of each)
export const buildOptionTable = (text, settings = {}, { maxLines = 15, limit = 10, bestLimit = 10, perCount = 3 } = {}) => {
  const ctx = buildContext(text);
  const byCount = {};
  const pool = [];
  for (let N = 1; N <= Math.min(maxLines, ctx.units.length); N++) {
    const options = optionsForLineCount(ctx, N, settings, limit);
    if (!options.length) continue;
    byCount[N] = options;
    options.slice(0, perCount).forEach((option) => pool.push(option));
  }
  pool.sort((a, b) => a.score - b.score || a.count - b.count);
  const best = [];
  const used = new Set();
  // the first of "best" is what the scripts pick: their line count, their breaking
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  const optimal = Math.min(Math.max(1, optimalLineCount(words)), Math.max(1, ctx.units.length));
  if (byCount[optimal] && byCount[optimal].length) {
    used.add(byCount[optimal][0].text);
    best.push(byCount[optimal][0]);
  }
  pool.forEach((option) => {
    if (best.length < bestLimit && !used.has(option.text)) {
      used.add(option.text);
      best.push(option);
    }
  });
  return { ctx, byCount, best, wordCount: ctx.units.length };
};

// True when the lines are the text broken between words only (no hyphen, no
// cut word, nothing added or lost). Used as a last guard before writing.
export const isCleanBreak = (original, lines) => {
  const source = String(original || "").replace(/\s+/g, " ").trim();
  const joined = lines.join(" ").replace(/\s+/g, " ").trim();
  return source === joined;
};
