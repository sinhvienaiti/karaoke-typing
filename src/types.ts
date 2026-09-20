export type GameMode = "normal" | "easy" | "blind" | "blank";

export type LyricToken = {
  time: number;
  text: string;
};

export type LyricLine = {
  start: number;
  end: number;
  text: string;
  tokens: LyricToken[];
};

export type GameStats = {
  score: number;
  combo: number;
  maxCombo: number;
  correct: number;
  mistakes: number;
  completedLines: number;
  skippedLines: number;
  skippedChars: number;
};

export type SongMeta = {
  title: string;
  artist: string;
};

export interface MediaController {
  readonly kind: "local" | "youtube";
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  currentTime(): number;
  duration(): number;
  setVolume(volume: number): void;
  setRate(rate: number): void;
  isPaused(): boolean;
  destroy(): void;
}
