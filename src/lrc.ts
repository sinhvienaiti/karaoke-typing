import type { LyricLine, LyricToken } from "./types";

const LINE_TIME = /\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]/g;
const TOKEN_TIME = /<(\d{1,3}):(\d{2}(?:\.\d{1,3})?)>/g;
const OFFSET = /^\[offset:([+-]?\d+)\]$/i;

function toSeconds(minutes: string, seconds: string): number {
  return Number(minutes) * 60 + Number(seconds);
}

function parseTokens(source: string): LyricToken[] {
  const matches = [...source.matchAll(TOKEN_TIME)];
  if (matches.length === 0) return [];

  const tokens: LyricToken[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const next = matches[index + 1];
    const minutes = match[1];
    const seconds = match[2];
    if (minutes === undefined || seconds === undefined) continue;

    const from = (match.index ?? 0) + match[0].length;
    const to = next?.index ?? source.length;
    const text = source.slice(from, to);
    if (text.length === 0) continue;
    tokens.push({ time: toSeconds(minutes, seconds), text });
  }
  return tokens;
}

function cleanText(source: string): string {
  return source.replace(TOKEN_TIME, "").replace(/\s+/g, " ").trim();
}

export function parseLrc(input: string, fallbackTailSeconds = 6): LyricLine[] {
  const rows = input.replace(/\r\n?/g, "\n").split("\n");
  const raw: Array<{ start: number; text: string; tokens: LyricToken[] }> = [];
  let offsetSeconds = 0;

  for (const row of rows) {
    const offsetMatch = OFFSET.exec(row.trim());
    if (offsetMatch !== null) {
      offsetSeconds = Number(offsetMatch[1]) / 1000;
      break;
    }
  }

  for (const row of rows) {
    const trimmed = row.trim();
    if (trimmed.length === 0) continue;

    if (OFFSET.test(trimmed)) continue;

    const matches = [...trimmed.matchAll(LINE_TIME)];
    if (matches.length === 0) continue;

    const last = matches[matches.length - 1];
    const textStart = (last?.index ?? 0) + (last?.[0].length ?? 0);
    const body = trimmed.slice(textStart);
    const text = cleanText(body);
    if (text.length === 0) continue;
    const tokens = parseTokens(body);

    for (const match of matches) {
      const minutes = match[1];
      const seconds = match[2];
      if (minutes === undefined || seconds === undefined) continue;
      raw.push({
        start: Math.max(0, toSeconds(minutes, seconds) + offsetSeconds),
        text,
        tokens: tokens.map((token) => ({ ...token, time: Math.max(0, token.time + offsetSeconds) })),
      });
    }
  }

  raw.sort((a, b) => a.start - b.start);

  return raw.map((item, index) => {
    const next = raw[index + 1];
    return {
      start: item.start,
      end: next?.start ?? item.start + fallbackTailSeconds,
      text: item.text,
      tokens: item.tokens,
    };
  });
}

export function findActiveLine(lines: LyricLine[], time: number, offsetSeconds = 0): number {
  const adjusted = time + offsetSeconds;
  let low = 0;
  let high = lines.length - 1;
  let match = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const line = lines[middle];
    if (line === undefined) break;
    if (line.start <= adjusted) {
      match = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (match < 0) return -1;
  const line = lines[match];
  if (line === undefined || adjusted >= line.end) return -1;
  return match;
}

export function activeTokenIndex(line: LyricLine, time: number, offsetSeconds = 0): number {
  if (line.tokens.length === 0) return -1;
  const adjusted = time + offsetSeconds;
  let index = -1;
  for (let i = 0; i < line.tokens.length; i += 1) {
    const token = line.tokens[i];
    if (token !== undefined && token.time <= adjusted) index = i;
    else break;
  }
  return index;
}

export function sungCharacterCount(line: LyricLine, time: number, offsetSeconds = 0): number {
  const adjusted = time + offsetSeconds;
  if (adjusted <= line.start) return 0;
  if (adjusted >= line.end) return line.text.length;

  if (line.tokens.length === 0) {
    const duration = Math.max(0.001, line.end - line.start);
    const progress = (adjusted - line.start) / duration;
    return Math.max(0, Math.min(line.text.length, Math.floor(line.text.length * progress)));
  }

  let completedLength = 0;
  for (let index = 0; index < line.tokens.length; index += 1) {
    const token = line.tokens[index];
    if (token === undefined) continue;
    const nextTime = line.tokens[index + 1]?.time ?? line.end;

    if (adjusted >= nextTime) {
      completedLength += token.text.length;
      continue;
    }

    if (adjusted >= token.time) {
      const tokenDuration = Math.max(0.001, nextTime - token.time);
      const tokenProgress = Math.min(1, Math.max(0, (adjusted - token.time) / tokenDuration));
      completedLength += Math.floor(token.text.length * tokenProgress);
    }
    break;
  }

  return Math.max(0, Math.min(line.text.length, completedLength));
}
