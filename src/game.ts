import type { GameMode, GameStats, LyricLine } from "./types";

export type LineState = {
  typed: string;
  mistakesInLine: number;
  completed: boolean;
  finalized: boolean;
};

export class GameEngine {
  readonly mode: GameMode;
  readonly lines: LyricLine[];
  readonly states: LineState[];
  readonly stats: GameStats = {
    score: 0,
    combo: 0,
    maxCombo: 0,
    correct: 0,
    mistakes: 0,
    completedLines: 0,
    skippedLines: 0,
    skippedChars: 0,
  };

  constructor(lines: LyricLine[], mode: GameMode) {
    this.lines = lines;
    this.mode = mode;
    this.states = lines.map(() => ({
      typed: "",
      mistakesInLine: 0,
      completed: false,
      finalized: false,
    }));
  }

  input(lineIndex: number, key: string, elapsedSeconds: number): boolean {
    const line = this.lines[lineIndex];
    const state = this.states[lineIndex];
    if (line === undefined || state === undefined || state.finalized || state.completed) return false;

    const expected = line.text[state.typed.length];
    if (expected === undefined) return false;

    if (key === expected) {
      state.typed += key;
      this.stats.correct += 1;
      this.stats.combo += 1;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.stats.combo);

      const minutes = Math.max(elapsedSeconds, 1) / 60;
      const cpm = this.stats.correct / minutes;
      this.stats.score += Math.round(1000 + cpm * 0.25 + this.stats.combo);

      if (state.typed.length === line.text.length) {
        state.completed = true;
        this.stats.completedLines += 1;
        const lineBase = line.text.length * 1000;
        this.stats.score += Math.round(lineBase * (state.mistakesInLine === 0 ? 0.25 : 0.1));
      }
      return true;
    }

    state.mistakesInLine += 1;
    this.stats.mistakes += 1;
    this.stats.combo = 0;
    this.stats.score = Math.max(0, this.stats.score - 500);
    return false;
  }

  finalizeLine(lineIndex: number): void {
    const line = this.lines[lineIndex];
    const state = this.states[lineIndex];
    if (line === undefined || state === undefined || state.finalized) return;

    state.finalized = true;
    if (state.completed) return;

    this.stats.skippedLines += 1;
    this.stats.skippedChars += Math.max(0, line.text.length - state.typed.length);
    this.stats.combo = 0;
  }

  accuracy(): number {
    const attempts = this.stats.correct + this.stats.mistakes;
    return attempts === 0 ? 100 : (this.stats.correct / attempts) * 100;
  }

  typingAccuracy(): number {
    const total = this.stats.correct + this.stats.mistakes + this.stats.skippedChars;
    return total === 0 ? 100 : (this.stats.correct / total) * 100;
  }
}

export function visibleTarget(text: string, typedLength: number, mode: GameMode): string {
  if (mode === "blank") return "•".repeat(Math.max(1, text.length));
  if (mode === "blind") {
    const hidden = "•".repeat(typedLength);
    const next = text[typedLength] ?? "";
    const rest = "•".repeat(Math.max(0, text.length - typedLength - 1));
    return hidden + next + rest;
  }
  return text;
}


export function canAcceptGameInput(isPaused: boolean, easyPausedForLine: number): boolean {
  return !isPaused || easyPausedForLine >= 0;
}
