import { describe, expect, it } from "vitest";

import {
  buildKaraokeLineEvent,
  buildKaraokeReviewLines,
  buildKaraokeWordEvent,
  lyricWords,
  parseKaraokeReviewDataset,
  wordAtIndex,
} from "../src/learning/shared";

describe("Karaoke shared learning contract", () => {
  it("maps lyric character positions to stable English word tokens", () => {
    expect(lyricWords("Hello, don't stop!")).toEqual([
      { key: "hello", text: "Hello", start: 0, end: 5 },
      { key: "don't", text: "don't", start: 7, end: 12 },
      { key: "stop", text: "stop", start: 13, end: 17 },
    ]);
    expect(wordAtIndex("Hello, world", 8)?.key).toBe("world");
    expect(wordAtIndex("Hello, world", 5)).toBeNull();
  });

  it("builds sentence and vocabulary learning events without per-key spam", () => {
    const word = lyricWords("Hello world")[1]!;
    expect(
      buildKaraokeWordEvent({
        word,
        result: "wrong",
        errorType: "spelling",
        occurredAt: "2026-09-24T16:00:00.000Z",
      }),
    ).toMatchObject({
      entityType: "vocabulary",
      entityId: "world",
      gameId: "karaoke-typing",
      activityType: "typing",
      result: "wrong",
      errorType: "spelling",
    });

    expect(
      buildKaraokeLineEvent({
        line: {
          start: 1,
          end: 3,
          text: "Hello world",
          tokens: [],
        },
        typed: "Hello worle",
        mistakes: 1,
        completed: true,
        responseMs: 1250.4,
        occurredAt: "2026-09-24T16:00:00.000Z",
      }),
    ).toMatchObject({
      entityType: "sentence",
      entityId: "Hello world",
      result: "wrong",
      responseMs: 1250,
      userAnswer: "Hello worle",
      expectedAnswer: "Hello world",
      errorType: "spelling",
    });
  });

  it("parses compatible contextual review items and builds bounded synthetic lines", () => {
    const dataset = parseKaraokeReviewDataset({
      version: 1,
      type: "typing-game:learning:v1:review-dataset",
      requestId: "karaoke-review-1",
      goal: "mixed",
      items: [
        {
          entityType: "sentence",
          entityId: "Hello world",
          text: "Hello world",
        },
        {
          entityType: "vocabulary",
          entityId: " Airport ",
          text: "Airport",
        },
      ],
    });

    expect(dataset).not.toBeNull();
    expect(dataset?.items.map((item) => item.entityId)).toEqual([
      "Hello world",
      "airport",
    ]);
    expect(buildKaraokeReviewLines(dataset!)).toEqual([
      { start: 0, end: 7, text: "Hello world", tokens: [] },
      { start: 8, end: 15, text: "Airport", tokens: [] },
    ]);
  });

  it("rejects unsupported grammar and spelling-goal review input", () => {
    expect(() =>
      parseKaraokeReviewDataset({
        version: 1,
        type: "typing-game:learning:v1:review-dataset",
        requestId: "karaoke-review-2",
        goal: "spelling",
        items: [
          { entityType: "vocabulary", entityId: "airport", text: "airport" },
        ],
      }),
    ).toThrow("goal is invalid");

    expect(() =>
      parseKaraokeReviewDataset({
        version: 1,
        type: "typing-game:learning:v1:review-dataset",
        requestId: "karaoke-review-3",
        goal: "mixed",
        items: [
          { entityType: "grammar", entityId: "time.present", text: "present" },
        ],
      }),
    ).toThrow("vocabulary or sentence");
  });
});
