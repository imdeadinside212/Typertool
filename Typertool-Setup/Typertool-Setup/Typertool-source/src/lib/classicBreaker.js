// The line breaker of the "Line Breaker" scripts (chiaDongThongMinh), ported to the panel.
//
// It is the FIRST option of every line count (and the first of "best"): the same diamond
// shaped target (1,2,3,2,1 ...), the same cost, the same local search and the same final
// clean-up as the scripts. The only difference is that it works on the unbreakable
// units of lineBreaker.js (a word with its marks glued on), so a mark can never be
// separated from its word by the search and then have to be repaired afterwards.

const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

// Number of lines the scripts pick for a text of this many words (the "auto" button)
export const optimalLineCount = (totalWords) => {
  if (totalWords <= 3) return totalWords === 3 ? 2 : 1;
  if (totalWords <= 7) return 3;
  if (totalWords <= 12) return 4;
  if (totalWords <= 22) return 5;
  if (totalWords <= 30) return 6;
  if (totalWords <= 39) return 7;
  if (totalWords <= 49) return 8;
  if (totalWords <= 60) return 9;
  if (totalWords <= 72) return 10;
  if (totalWords <= 85) return 11;
  if (totalWords <= 99) return 12;
  if (totalWords <= 114) return 13;
  if (totalWords <= 130) return 14;
  return 15;
};

// The diamond: 5 lines 1,2,3,2,1 - 6 lines 1,2,3,3,2,1 - normalised to sum 1
export const targetRatios = (numLines) => {
  if (numLines <= 0) return [];
  if (numLines === 1) return [1];
  const ratios = [];
  if (numLines % 2 === 1) {
    const mid = Math.floor(numLines / 2);
    for (let i = 0; i < numLines; i++) ratios[i] = i <= mid ? i + 1 : numLines - i;
  } else {
    const mid = numLines / 2 - 1;
    const peak = mid + 1;
    for (let i = 0; i < numLines; i++) ratios[i] = i <= mid ? i + 1 : i <= mid + 1 ? peak : numLines - i;
  }
  const sum = ratios.reduce((a, b) => a + b, 0);
  return ratios.map((r) => r / sum);
};

// Words dealt out to the lines following the ratios (every line gets at least one)
const initialDistribution = (units, ratios, N) => {
  const total = units.length;
  const lines = [];
  let at = 0;
  for (let i = 0; i < N; i++) {
    let count;
    if (i === N - 1) {
      count = total - at;
    } else {
      count = Math.round(ratios[i] * total);
      const remainingWords = total - (at + count);
      const remainingLines = N - (i + 1);
      if (count <= 0 && at < total && remainingLines > 0 && remainingWords >= remainingLines) count = 1;
      if (remainingWords < remainingLines && remainingLines > 0) count = Math.max(0, count - (remainingLines - remainingWords));
    }
    count = Math.min(Math.max(0, count), total - at);
    lines.push(units.slice(at, at + count));
    at += count;
  }
  while (at < total) lines[lines.length - 1].push(units[at++]);
  return lines;
};

const LEADING_ZERO = /^\s*(0|00|000)(\s+.*|$)/;

// The cost of the scripts: distance to the ideal character lengths, the slope between
// neighbouring lines, the widest line, the spread of the lengths, a very short first
// line and lines that start with "0", "00", "000"
export const makeCost = (N, totalChars) => {
  const ratios = targetRatios(N);
  const ideal = ratios.map((r) => r * totalChars);
  return (lineStrings) => {
    const len = lineStrings.map((l) => l.length);
    let cost = 0;
    for (let i = 0; i < len.length; i++) {
      const diff = len[i] - ideal[i];
      cost += diff * diff * (diff < 0 ? 1.5 : 2.5);
    }
    for (let i = 0; i < len.length - 1; i++) {
      const actual = len[i + 1] - len[i];
      const wanted = ideal[i + 1] - ideal[i];
      if (sign(actual) !== sign(wanted) && sign(wanted) !== 0) cost += (actual - wanted) ** 2 * 1.5;
      else cost += (actual - wanted) ** 2 * 0.8;
      if (Math.abs(len[i] - len[i + 1]) > totalChars * 0.3 && sign(wanted) === 0) cost += Math.abs(len[i] - len[i + 1]) * 1.5;
    }
    const widest = Math.max(...len);
    if (widest > 0) cost += widest * widest * 0.5;
    const avg = len.reduce((a, b) => a + b, 0) / len.length;
    let spread = 0;
    len.forEach((l) => {
      spread += (l - avg) * (l - avg);
    });
    cost += spread * 0.2;
    if (len.length > 0 && len[0] > 0 && len[0] < 2) cost += 5000;
    for (let i = 1; i < lineStrings.length; i++) {
      if (lineStrings[i] && LEADING_ZERO.test(lineStrings[i])) cost += 10000;
    }
    return cost;
  };
};

const PUNCT_LINE = /^\s*([.,;:!?»›)"'\]}¿¡«‹"'[{(…-]+)\s*$/;
const ZERO_WORD = /^(0|00|000)$/;
const joinLine = (units) => units.join(" ");

// The final clean-up of the scripts, on lists of units
const finalValidation = (input) => {
  let lines = input.map((l) => l.slice());
  if (lines.length <= 1) return lines;
  let changed = true;
  while (changed && lines.length > 1) {
    changed = false;
    const last = lines.length - 1;
    if (PUNCT_LINE.test(joinLine(lines[last]))) {
      lines[last - 1] = lines[last - 1].concat(lines[last]);
      lines.pop();
      changed = true;
      continue;
    }
    const first = joinLine(lines[0]);
    if (PUNCT_LINE.test(first) || first.length < 2) {
      lines[1] = lines[0].concat(lines[1]);
      lines.shift();
      changed = true;
      continue;
    }
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].length) continue;
      const word = lines[i][0];
      if (PUNCT_LINE.test(word) || ZERO_WORD.test(word)) {
        lines[i - 1] = lines[i - 1].concat([word]);
        lines[i] = lines[i].slice(1);
        if (!lines[i].length) lines.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return lines;
};

// The scripts' result for N lines as lists of units (null when there is no N-line result)
export const classicLines = (units, N) => {
  const total = units.length;
  if (!(N >= 1) || N > total) return null;
  const ratios = targetRatios(N);
  let lines = initialDistribution(units, ratios, N);
  const totalChars = units.reduce((s, u) => s + u.length, 0) + Math.max(0, total - 1);
  const cost = makeCost(N, totalChars);
  const strings = (ls) => ls.map(joinLine);
  let best = cost(strings(lines));
  const maxIterations = Math.max(100, total * 5);
  let streak = 0;
  for (let iter = 0; iter < maxIterations && streak < 15; iter++) {
    let moved = false;
    for (let i = 0; i < N - 1; i++) {
      // the last word of line i goes down to line i+1
      if (lines[i].length > 1) {
        const next = lines.slice();
        next[i] = lines[i].slice(0, -1);
        next[i + 1] = [lines[i][lines[i].length - 1]].concat(lines[i + 1]);
        const c = cost(strings(next));
        if (c < best) {
          best = c;
          lines = next;
          moved = true;
          streak = 0;
        }
      }
      // the first word of line i+1 comes up to line i
      if (lines[i + 1].length > 1 || (lines[i + 1].length === 1 && !lines[i].length)) {
        if (lines[i + 1].length > 0) {
          const next = lines.slice();
          next[i] = lines[i].concat([lines[i + 1][0]]);
          next[i + 1] = lines[i + 1].slice(1);
          const c = cost(strings(next));
          if (c < best) {
            best = c;
            lines = next;
            moved = true;
            streak = 0;
          }
        }
      }
    }
    if (!moved) streak++;
  }
  const clean = finalValidation(lines);
  // the clean-up may merge lines: then there is no result for exactly N lines
  return clean.length === N && clean.every((l) => l.length) ? clean : null;
};
