import type { LyricLine } from "../types";

export const LEARNING_ATTEMPT_MESSAGE = "typing-game:learning:v1:attempt";
export const REVIEW_DATASET_MESSAGE = "typing-game:learning:v1:review-dataset";
export const REVIEW_READY_MESSAGE = "typing-game:learning:v1:review-ready";
export const REVIEW_ERROR_MESSAGE = "typing-game:learning:v1:review-error";
export const ENGLISH_ACTIVITY_DATASET_MESSAGE =
  "typing-game:english-content:v1:activity-dataset";
export const PARENT_ORIGIN = "https://typing-game.local";

export type KaraokeReviewGoal =
  | "remember-words"
  | "listening"
  | "sentence-building"
  | "mixed";

export type KaraokeEnglishActivity =
  | "example-typing"
  | "dialogue"
  | "listening-typing"
  | "translation";

export type KaraokeEnglishActivityDataset = {
  version: 1;
  type: typeof ENGLISH_ACTIVITY_DATASET_MESSAGE;
  requestId: string;
  gameId: "karaoke-typing";
  activity: KaraokeEnglishActivity;
  items: Array<{
    contentId: string;
    entityType: "sentence";
    entityId: string;
    promptText: string;
    answerText: string;
    meaningVi?: string;
    audioText?: string;
  }>;
};

export type KaraokeReviewItem = {
  entityType: "vocabulary" | "sentence";
  entityId: string;
  text: string;
};

export type KaraokeReviewDataset = {
  version: 1;
  type: typeof REVIEW_DATASET_MESSAGE;
  requestId: string;
  goal: KaraokeReviewGoal;
  items: KaraokeReviewItem[];
};

export type LyricWord = {
  key: string;
  text: string;
  start: number;
  end: number;
};

export type KaraokeLearningEvent = {
  version: 1;
  entityType: "vocabulary" | "sentence";
  entityId: string;
  gameId: "karaoke-typing";
  activityType: "typing" | "karaoke-line" | "listening";
  result: "correct" | "wrong";
  occurredAt: string;
  responseMs?: number;
  hintUsed: false;
  replayUsed: boolean;
  userAnswer?: string;
  expectedAnswer: string;
  errorType?: "spelling" | "skipped-line" | "missed-word";
};

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;
const GOALS = new Set<KaraokeReviewGoal>([
  "remember-words",
  "listening",
  "sentence-building",
  "mixed",
]);
const ENGLISH_ACTIVITIES = new Set<KaraokeEnglishActivity>([
  "example-typing",
  "dialogue",
  "listening-typing",
  "translation",
]);

function plainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ");
}

export function normalizeVocabularyKey(value: string): string {
  return cleanText(value).toLocaleLowerCase("en-US");
}

export function lyricWords(text: string): LyricWord[] {
  const result: LyricWord[] = [];
  const pattern = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
  for (const match of text.matchAll(pattern)) {
    const value = match[0];
    const start = match.index ?? 0;
    result.push({
      key: normalizeVocabularyKey(value),
      text: value,
      start,
      end: start + value.length,
    });
  }
  return result;
}

export function wordAtIndex(
  text: string,
  index: number,
): LyricWord | null {
  return (
    lyricWords(text).find(
      (word) => index >= word.start && index < word.end,
    ) ?? null
  );
}

export function parseKaraokeEnglishActivityDataset(
  value: unknown,
): KaraokeEnglishActivityDataset | null {
  if (!plainObject(value) || value["type"] !== ENGLISH_ACTIVITY_DATASET_MESSAGE) {
    return null;
  }
  if (value["version"] !== 1 || value["gameId"] !== "karaoke-typing") {
    throw new TypeError("Karaoke English activity dataset identity is invalid");
  }
  const requestId = value["requestId"];
  if (typeof requestId !== "string" || !REQUEST_ID_PATTERN.test(requestId)) {
    throw new TypeError("Karaoke English activity requestId is invalid");
  }
  const activity = value["activity"];
  if (
    typeof activity !== "string" ||
    !ENGLISH_ACTIVITIES.has(activity as KaraokeEnglishActivity)
  ) {
    throw new TypeError("Karaoke English activity is invalid");
  }
  const items = value["items"];
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    throw new TypeError("Karaoke English activity items must contain 1 to 100 items");
  }
  const parsed: KaraokeEnglishActivityDataset["items"] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!plainObject(item)) throw new TypeError("Karaoke English activity item is invalid");
    if (
      typeof item["contentId"] !== "string" ||
      item["entityType"] !== "sentence" ||
      typeof item["entityId"] !== "string" ||
      typeof item["promptText"] !== "string" ||
      typeof item["answerText"] !== "string"
    ) {
      throw new TypeError("Karaoke English activity item fields are invalid");
    }
    const contentId = cleanText(item["contentId"]);
    const entityId = cleanText(item["entityId"]);
    const promptText = cleanText(item["promptText"]);
    const answerText = cleanText(item["answerText"]);
    if (seen.has(contentId)) {
      throw new TypeError("Karaoke English activity contentId is duplicated");
    }
    seen.add(contentId);
    parsed.push({
      contentId,
      entityType: "sentence",
      entityId,
      promptText,
      answerText,
      ...(typeof item["meaningVi"] === "string" && item["meaningVi"].trim() !== ""
        ? { meaningVi: cleanText(item["meaningVi"]) }
        : {}),
      ...(typeof item["audioText"] === "string" && item["audioText"].trim() !== ""
        ? { audioText: cleanText(item["audioText"]) }
        : {}),
    });
  }
  return {
    version: 1,
    type: ENGLISH_ACTIVITY_DATASET_MESSAGE,
    requestId,
    gameId: "karaoke-typing",
    activity: activity as KaraokeEnglishActivity,
    items: parsed,
  };
}

export function karaokeEnglishActivityAsReview(
  dataset: KaraokeEnglishActivityDataset,
): KaraokeReviewDataset {
  return {
    version: 1,
    type: REVIEW_DATASET_MESSAGE,
    requestId: dataset.requestId,
    goal:
      dataset.activity === "listening-typing"
        ? "listening"
        : dataset.activity === "translation"
          ? "sentence-building"
          : "mixed",
    items: dataset.items.map((item) => ({
      entityType: "sentence",
      entityId: item.entityId,
      text: item.answerText,
    })),
  };
}

export function buildKaraokeEnglishActivityLines(
  dataset: KaraokeEnglishActivityDataset,
): LyricLine[] {
  return dataset.items.map((item, index) => ({
    start: index * 8,
    end: index * 8 + 7,
    text: item.answerText,
    tokens: [],
    learning: {
      entityType: "sentence",
      entityId: item.entityId,
      activityType: dataset.activity,
    },
  }));
}

export function parseKaraokeReviewDataset(
  value: unknown,
): KaraokeReviewDataset | null {
  if (!plainObject(value) || value["type"] !== REVIEW_DATASET_MESSAGE) {
    return null;
  }
  if (value["version"] !== 1) {
    throw new TypeError("review dataset version is invalid");
  }

  const requestId = value["requestId"];
  if (
    typeof requestId !== "string" ||
    !REQUEST_ID_PATTERN.test(requestId)
  ) {
    throw new TypeError("review requestId is invalid");
  }

  const goal = value["goal"];
  if (typeof goal !== "string" || !GOALS.has(goal as KaraokeReviewGoal)) {
    throw new TypeError("Karaoke review goal is invalid");
  }

  const items = value["items"];
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    throw new TypeError("review items must contain 1 to 100 items");
  }

  const parsed: KaraokeReviewItem[] = [];
  for (const item of items) {
    if (!plainObject(item)) {
      throw new TypeError("Karaoke review item is invalid");
    }
    const entityType = item["entityType"];
    if (entityType !== "vocabulary" && entityType !== "sentence") {
      throw new TypeError(
        "Karaoke review accepts vocabulary or sentence items only",
      );
    }
    if (typeof item["entityId"] !== "string") {
      throw new TypeError("review entityId is invalid");
    }
    const entityId = cleanText(item["entityId"]);
    const reviewText =
      typeof item["text"] === "string"
        ? cleanText(item["text"])
        : entityId;
    if (entityId === "" || reviewText === "") {
      throw new TypeError("Karaoke review text is invalid");
    }
    parsed.push({
      entityType,
      entityId:
        entityType === "vocabulary"
          ? normalizeVocabularyKey(entityId)
          : entityId,
      text: reviewText,
    });
  }

  return {
    version: 1,
    type: REVIEW_DATASET_MESSAGE,
    requestId,
    goal: goal as KaraokeReviewGoal,
    items: parsed,
  };
}

export function buildKaraokeReviewLines(
  dataset: KaraokeReviewDataset,
): LyricLine[] {
  return dataset.items.map((item, index) => ({
    start: index * 8,
    end: index * 8 + 7,
    text: item.text,
    tokens: [],
    learning: {
      entityType: item.entityType,
      entityId: item.entityId,
      activityType:
        dataset.goal === "listening" ? "listening" : "karaoke-line",
    },
  }));
}

export function buildKaraokeWordEvent(options: {
  word: LyricWord;
  result: "correct" | "wrong";
  occurredAt?: string;
  errorType?: "spelling" | "missed-word";
  replayUsed?: boolean;
}): KaraokeLearningEvent {
  return {
    version: 1,
    entityType: "vocabulary",
    entityId: options.word.key,
    gameId: "karaoke-typing",
    activityType: "typing",
    result: options.result,
    occurredAt: options.occurredAt ?? new Date().toISOString(),
    hintUsed: false,
    replayUsed: options.replayUsed ?? false,
    expectedAnswer: options.word.text,
    ...(options.result === "wrong"
      ? { errorType: options.errorType ?? ("spelling" as const) }
      : {}),
  };
}

export function buildKaraokeLineEvent(options: {
  line: LyricLine;
  typed: string;
  mistakes: number;
  completed: boolean;
  responseMs?: number;
  occurredAt?: string;
  listening?: boolean;
  replayUsed?: boolean;
}): KaraokeLearningEvent {
  const correct = options.completed && options.mistakes === 0;
  const learning = options.line.learning;
  return {
    version: 1,
    entityType: learning?.entityType ?? "sentence",
    entityId: learning?.entityId ?? cleanText(options.line.text),
    gameId: "karaoke-typing",
    activityType:
      learning?.activityType ??
      (options.listening ? "listening" : "karaoke-line"),
    result: correct ? "correct" : "wrong",
    occurredAt: options.occurredAt ?? new Date().toISOString(),
    ...(options.responseMs === undefined
      ? {}
      : { responseMs: Math.max(0, Math.round(options.responseMs)) }),
    hintUsed: false,
    replayUsed: options.replayUsed ?? false,
    userAnswer: options.typed,
    expectedAnswer: options.line.text,
    ...(correct
      ? {}
      : {
          errorType: options.completed
            ? ("spelling" as const)
            : ("skipped-line" as const),
        }),
  };
}
