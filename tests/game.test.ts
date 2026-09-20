import { describe, expect, it } from "vitest";
import { GameEngine, visibleTarget } from "../src/game";
import type { LyricLine } from "../src/types";

const lines: LyricLine[] = [
  { start: 0, end: 2, text: "abc", tokens: [] },
  { start: 2, end: 4, text: "de", tokens: [] },
];

describe("GameEngine", () => {
  it("scores correct typing, tracks combo and completes a line", () => {
    const game = new GameEngine(lines, "normal");
    expect(game.input(0, "a", 1)).toBe(true);
    expect(game.input(0, "b", 1.5)).toBe(true);
    expect(game.input(0, "c", 2)).toBe(true);
    expect(game.stats.correct).toBe(3);
    expect(game.stats.maxCombo).toBe(3);
    expect(game.stats.completedLines).toBe(1);
    expect(game.stats.score).toBeGreaterThan(3000);
  });

  it("penalizes mistakes and finalizes unfinished lines once", () => {
    const game = new GameEngine(lines, "normal");
    game.input(0, "x", 1);
    game.input(0, "a", 1.1);
    game.finalizeLine(0);
    game.finalizeLine(0);
    expect(game.stats.mistakes).toBe(1);
    expect(game.stats.skippedLines).toBe(1);
    expect(game.stats.skippedChars).toBe(2);
  });

  it("computes typing accuracy including skipped chars", () => {
    const game = new GameEngine(lines, "normal");
    game.input(0, "a", 1);
    game.finalizeLine(0);
    expect(game.typingAccuracy()).toBeCloseTo(33.333, 2);
  });
});

describe("visibleTarget", () => {
  it("supports blind and blank modes", () => {
    expect(visibleTarget("hello", 2, "blind")).toBe("••l••");
    expect(visibleTarget("hello", 2, "blank")).toBe("•••••");
    expect(visibleTarget("hello", 2, "normal")).toBe("hello");
  });
});
