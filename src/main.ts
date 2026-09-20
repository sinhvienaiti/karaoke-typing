import "./styles.css";
import { GameEngine, visibleTarget } from "./game";
import { findActiveLine, parseLrc, sungCharacterCount } from "./lrc";
import { extractYouTubeId, LocalMediaController, YouTubeMediaController } from "./media";
import type { GameMode, LyricLine, MediaController, SongMeta } from "./types";

const app = document.querySelector<HTMLDivElement>("#app");
if (app === null) throw new Error("#app not found");

app.innerHTML = `
  <main class="app-shell">
    <section class="setup-panel" id="setup-panel">
      <div class="setup-copy">
        <div class="eyebrow">KARAOKE TYPING</div>
        <h1>Type with the song.</h1>
        <p>Stream from YouTube or choose a local MP3/MP4, then load synchronized LRC lyrics.</p>
      </div>

      <div class="setup-grid">
        <section class="setup-card">
          <h2>1. Media</h2>
          <div class="segmented" role="group" aria-label="Media source">
            <button type="button" class="source-button active" data-source="youtube">YouTube</button>
            <button type="button" class="source-button" data-source="local">Local file</button>
          </div>
          <label id="youtube-field">YouTube URL or video ID
            <input id="youtube-input" type="text" autocomplete="off" placeholder="https://youtube.com/watch?v=..." />
          </label>
          <label id="local-field" class="hidden">MP3 / MP4 / M4A / WebM
            <input id="media-file" type="file" accept="audio/*,video/*" />
          </label>
        </section>

        <section class="setup-card">
          <h2>2. Lyrics</h2>
          <label>Song title <input id="song-title" type="text" autocomplete="off" placeholder="Optional" /></label>
          <label>Artist <input id="song-artist" type="text" autocomplete="off" placeholder="Optional" /></label>
          <label>LRC file <input id="lrc-file" type="file" accept=".lrc,text/plain" /></label>
          <label>or paste LRC
            <textarea id="lrc-input" rows="7" spellcheck="false" placeholder="[00:12.34]First lyric line&#10;[00:18.52]Second lyric line"></textarea>
          </label>
        </section>

        <section class="setup-card">
          <h2>3. Game</h2>
          <label>Mode
            <select id="game-mode">
              <option value="normal">Normal — song keeps moving</option>
              <option value="easy">Easy — pause if a line is unfinished</option>
              <option value="blind">Blind — only the next character is visible</option>
              <option value="blank">Blank — lyrics are hidden</option>
            </select>
          </label>
          <label>Lyrics offset <span id="offset-value">0.00s</span>
            <input id="offset-input" type="range" min="-5" max="5" step="0.05" value="0" />
          </label>
          <label>Playback rate <span id="rate-value">1.00×</span>
            <input id="rate-input" type="range" min="0.5" max="1.5" step="0.05" value="1" />
          </label>
          <button id="start-button" class="primary" type="button">Load song</button>
          <p id="setup-error" class="error" role="alert"></p>
        </section>
      </div>
    </section>

    <section class="game hidden" id="game-panel">
      <header class="game-header">
        <div>
          <button id="back-button" class="text-button" type="button">← Songs</button>
          <div class="song-title" id="playing-title">Untitled</div>
          <div class="song-artist" id="playing-artist"></div>
        </div>
        <div class="header-actions">
          <button id="restart-button" type="button">Restart</button>
          <button id="pause-button" type="button">Pause</button>
        </div>
      </header>

      <div class="game-layout">
        <section class="media-panel">
          <div id="media-host" class="media-host"></div>
          <div class="timeline">
            <span id="time-current">0:00</span>
            <div class="timeline-track"><div id="timeline-fill" class="timeline-fill"></div></div>
            <span id="time-duration">0:00</span>
          </div>
        </section>

        <section class="typing-panel">
          <div class="lyric-stack">
            <div id="previous-line" class="side-line"></div>
            <div id="current-line" class="current-line">Waiting for lyrics…</div>
            <div id="next-line" class="side-line"></div>
          </div>

          <div class="line-progress"><div id="line-progress-fill"></div></div>
          <input id="typing-input" class="typing-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Type the current lyric" />
          <div class="typing-hint">Type the active line. Tab skips the line. Esc pauses.</div>

          <div class="stats-grid">
            <div><span>Score</span><strong id="stat-score">0</strong></div>
            <div><span>Combo</span><strong id="stat-combo">0</strong></div>
            <div><span>Accuracy</span><strong id="stat-accuracy">100%</strong></div>
            <div><span>Lines</span><strong id="stat-lines">0/0</strong></div>
          </div>
        </section>
      </div>
    </section>

    <section class="result hidden" id="result-panel">
      <div class="result-card">
        <div class="eyebrow">SONG COMPLETE</div>
        <h1 id="result-title">Result</h1>
        <div class="result-score" id="result-score">0</div>
        <div class="result-grid">
          <div><span>Max combo</span><strong id="result-combo">0</strong></div>
          <div><span>Correct</span><strong id="result-correct">0</strong></div>
          <div><span>Mistakes</span><strong id="result-mistakes">0</strong></div>
          <div><span>Completed lines</span><strong id="result-lines">0</strong></div>
          <div><span>Skipped chars</span><strong id="result-skipped">0</strong></div>
          <div><span>Typing accuracy</span><strong id="result-accuracy">100%</strong></div>
        </div>
        <div class="result-actions">
          <button id="result-restart" class="primary" type="button">Play again</button>
          <button id="result-back" type="button">Choose another song</button>
        </div>
      </div>
    </section>
  </main>
`;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`#${id} not found`);
  return element as T;
}

const setupPanel = byId<HTMLElement>("setup-panel");
const gamePanel = byId<HTMLElement>("game-panel");
const resultPanel = byId<HTMLElement>("result-panel");
const youtubeField = byId<HTMLElement>("youtube-field");
const localField = byId<HTMLElement>("local-field");
const youtubeInput = byId<HTMLInputElement>("youtube-input");
const mediaFile = byId<HTMLInputElement>("media-file");
const songTitle = byId<HTMLInputElement>("song-title");
const songArtist = byId<HTMLInputElement>("song-artist");
const lrcFile = byId<HTMLInputElement>("lrc-file");
const lrcInput = byId<HTMLTextAreaElement>("lrc-input");
const gameMode = byId<HTMLSelectElement>("game-mode");
const offsetInput = byId<HTMLInputElement>("offset-input");
const offsetValue = byId<HTMLElement>("offset-value");
const rateInput = byId<HTMLInputElement>("rate-input");
const rateValue = byId<HTMLElement>("rate-value");
const startButton = byId<HTMLButtonElement>("start-button");
const setupError = byId<HTMLElement>("setup-error");
const mediaHost = byId<HTMLElement>("media-host");
const typingInput = byId<HTMLInputElement>("typing-input");
const currentLine = byId<HTMLElement>("current-line");
const previousLine = byId<HTMLElement>("previous-line");
const nextLine = byId<HTMLElement>("next-line");
const lineProgressFill = byId<HTMLElement>("line-progress-fill");
const timelineFill = byId<HTMLElement>("timeline-fill");
const pauseButton = byId<HTMLButtonElement>("pause-button");

let source: "youtube" | "local" = "youtube";
let controller: MediaController | null = null;
let lyrics: LyricLine[] = [];
let engine: GameEngine | null = null;
let activeLine = -1;
let previousActiveLine = -1;
let frameId = 0;
let gameStartedAt = 0;
let meta: SongMeta = { title: "Untitled", artist: "" };
let easyPausedForLine = -1;
let ended = false;

for (const button of document.querySelectorAll<HTMLButtonElement>(".source-button")) {
  button.addEventListener("click", () => {
    source = button.dataset["source"] === "local" ? "local" : "youtube";
    for (const item of document.querySelectorAll(".source-button")) item.classList.remove("active");
    button.classList.add("active");
    youtubeField.classList.toggle("hidden", source !== "youtube");
    localField.classList.toggle("hidden", source !== "local");
  });
}

offsetInput.addEventListener("input", () => {
  offsetValue.textContent = `${Number(offsetInput.value).toFixed(2)}s`;
});

rateInput.addEventListener("input", () => {
  const rate = Number(rateInput.value);
  rateValue.textContent = `${rate.toFixed(2)}×`;
  controller?.setRate(rate);
});

lrcFile.addEventListener("change", async () => {
  const file = lrcFile.files?.[0];
  if (file === undefined) return;
  lrcInput.value = await file.text();
});

startButton.addEventListener("click", () => void loadSong());
byId<HTMLButtonElement>("back-button").addEventListener("click", returnToSetup);
byId<HTMLButtonElement>("restart-button").addEventListener("click", () => void restartGame());
byId<HTMLButtonElement>("result-restart").addEventListener("click", () => void restartGame());
byId<HTMLButtonElement>("result-back").addEventListener("click", returnToSetup);

pauseButton.addEventListener("click", () => void togglePause());

typingInput.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    skipActiveLine();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    void togglePause();
    return;
  }
  if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
  event.preventDefault();
  handleTyping(event.key);
});

async function loadSong(): Promise<void> {
  setupError.textContent = "";
  const parsed = parseLrc(lrcInput.value);
  if (parsed.length === 0) {
    setupError.textContent = "Load a valid synchronized LRC file or paste LRC text first.";
    return;
  }

  startButton.disabled = true;
  startButton.textContent = "Loading…";

  try {
    destroyController();
    if (source === "youtube") {
      const videoId = extractYouTubeId(youtubeInput.value);
      if (videoId === null) throw new Error("Enter a valid YouTube URL or 11-character video ID.");
      controller = await YouTubeMediaController.create(videoId, mediaHost);
    } else {
      const file = mediaFile.files?.[0];
      if (file === undefined) throw new Error("Choose a local audio or video file.");
      controller = new LocalMediaController(file, mediaHost);
    }

    lyrics = parsed;
    meta = {
      title: songTitle.value.trim() || "Untitled song",
      artist: songArtist.value.trim(),
    };
    controller.setRate(Number(rateInput.value));
    showGame();
    await restartGame();
  } catch (error) {
    destroyController();
    setupError.textContent = error instanceof Error ? error.message : "Could not load this song.";
  } finally {
    startButton.disabled = false;
    startButton.textContent = "Load song";
  }
}

function showGame(): void {
  setupPanel.classList.add("hidden");
  resultPanel.classList.add("hidden");
  gamePanel.classList.remove("hidden");
  byId("playing-title").textContent = meta.title;
  byId("playing-artist").textContent = meta.artist;
}

async function restartGame(): Promise<void> {
  if (controller === null || lyrics.length === 0) return;
  cancelAnimationFrame(frameId);
  ended = false;
  activeLine = -1;
  previousActiveLine = -1;
  easyPausedForLine = -1;
  engine = new GameEngine(lyrics, gameMode.value as GameMode);
  controller.pause();
  controller.seek(0);
  controller.setRate(Number(rateInput.value));
  typingInput.value = "";
  gameStartedAt = performance.now();
  resultPanel.classList.add("hidden");
  gamePanel.classList.remove("hidden");
  renderStats();
  renderLyrics(-1);
  await controller.play();
  pauseButton.textContent = "Pause";
  typingInput.focus();
  frameId = requestAnimationFrame(tick);
}

function tick(): void {
  if (controller === null || engine === null || ended) return;

  const time = controller.currentTime();
  const duration = controller.duration();
  const offset = Number(offsetInput.value);
  activeLine = findActiveLine(lyrics, time, offset);

  if (previousActiveLine >= 0 && activeLine !== previousActiveLine) {
    const previousState = engine.states[previousActiveLine];
    if (engine.mode === "easy" && previousState !== undefined && !previousState.completed) {
      controller.pause();
      controller.seek(lyrics[previousActiveLine]?.end ?? time);
      easyPausedForLine = previousActiveLine;
      activeLine = previousActiveLine;
    } else {
      engine.finalizeLine(previousActiveLine);
    }
  }

  renderLyrics(activeLine);
  previousActiveLine = activeLine;

  renderTimeline(time, duration);
  renderStats();

  const lastEnd = (lyrics[lyrics.length - 1]?.end ?? 0) - offset;
  const mediaEnded = duration > 0 && time >= duration - 0.15;
  if (!controller.isPaused() && (mediaEnded || time >= lastEnd + 0.15)) {
    finishGame();
    return;
  }

  frameId = requestAnimationFrame(tick);
}

function handleTyping(key: string): void {
  if (engine === null) return;
  const lineIndex = easyPausedForLine >= 0 ? easyPausedForLine : activeLine;
  if (lineIndex < 0) return;

  const elapsed = Math.max(0.001, (performance.now() - gameStartedAt) / 1000);
  engine.input(lineIndex, key, elapsed);
  const state = engine.states[lineIndex];
  typingInput.value = state?.typed ?? "";
  renderLyrics(lineIndex);
  renderStats();

  if (easyPausedForLine === lineIndex && state?.completed) {
    engine.finalizeLine(lineIndex);
    easyPausedForLine = -1;
    previousActiveLine = lineIndex;
    const next = lyrics[lineIndex + 1];
    if (next !== undefined && controller !== null) {
      controller.seek(Math.max(0, next.start - Number(offsetInput.value)));
      void controller.play();
      pauseButton.textContent = "Pause";
    }
  }
}

function skipActiveLine(): void {
  if (engine === null) return;
  const lineIndex = easyPausedForLine >= 0 ? easyPausedForLine : activeLine;
  if (lineIndex < 0) return;
  engine.finalizeLine(lineIndex);
  easyPausedForLine = -1;

  const next = lyrics[lineIndex + 1];
  if (next !== undefined && controller !== null) {
    controller.seek(Math.max(0, next.start - Number(offsetInput.value)));
    void controller.play();
  } else {
    finishGame();
  }
}

function renderLyrics(lineIndex: number): void {
  if (engine === null || lineIndex < 0) {
    previousLine.textContent = "";
    currentLine.textContent = "♪ Waiting for the next line…";
    nextLine.textContent = lyrics[0]?.text ?? "";
    lineProgressFill.style.width = "0%";
    typingInput.value = "";
    return;
  }

  const line = lyrics[lineIndex];
  const state = engine.states[lineIndex];
  if (line === undefined || state === undefined) return;

  previousLine.textContent = lyrics[lineIndex - 1]?.text ?? "";
  nextLine.textContent = lyrics[lineIndex + 1]?.text ?? "";

  const display = visibleTarget(line.text, state.typed.length, engine.mode);
  const sungChars =
    engine.mode === "normal"
      ? sungCharacterCount(line, controller?.currentTime() ?? 0, Number(offsetInput.value))
      : 0;
  currentLine.replaceChildren();

  for (let index = 0; index < display.length; index += 1) {
    const character = document.createElement("span");
    character.textContent = display[index] ?? "";
    if (index < state.typed.length) character.className = "typed-character";
    else if (index < sungChars) character.className = "sung-character";
    else character.className = "pending-character";
    currentLine.append(character);
  }

  const progress = line.text.length === 0 ? 0 : (state.typed.length / line.text.length) * 100;
  lineProgressFill.style.width = `${Math.min(100, progress)}%`;
  typingInput.value = state.typed;
}

function renderStats(): void {
  if (engine === null) return;
  byId("stat-score").textContent = engine.stats.score.toLocaleString();
  byId("stat-combo").textContent = String(engine.stats.combo);
  byId("stat-accuracy").textContent = `${engine.accuracy().toFixed(1)}%`;
  byId("stat-lines").textContent = `${engine.stats.completedLines}/${lyrics.length}`;
}

function renderTimeline(time: number, duration: number): void {
  byId("time-current").textContent = formatTime(time);
  byId("time-duration").textContent = formatTime(duration);
  const progress = duration > 0 ? (time / duration) * 100 : 0;
  timelineFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
}

async function togglePause(): Promise<void> {
  if (controller === null) return;
  if (controller.isPaused()) {
    await controller.play();
    pauseButton.textContent = "Pause";
    typingInput.focus();
  } else {
    controller.pause();
    pauseButton.textContent = "Resume";
  }
}

function finishGame(): void {
  if (engine === null || ended) return;
  ended = true;
  cancelAnimationFrame(frameId);
  controller?.pause();

  for (let index = 0; index < lyrics.length; index += 1) engine.finalizeLine(index);

  byId("result-title").textContent = meta.title;
  byId("result-score").textContent = engine.stats.score.toLocaleString();
  byId("result-combo").textContent = String(engine.stats.maxCombo);
  byId("result-correct").textContent = String(engine.stats.correct);
  byId("result-mistakes").textContent = String(engine.stats.mistakes);
  byId("result-lines").textContent = `${engine.stats.completedLines}/${lyrics.length}`;
  byId("result-skipped").textContent = String(engine.stats.skippedChars);
  byId("result-accuracy").textContent = `${engine.typingAccuracy().toFixed(1)}%`;

  gamePanel.classList.add("hidden");
  resultPanel.classList.remove("hidden");
}

function returnToSetup(): void {
  cancelAnimationFrame(frameId);
  controller?.pause();
  ended = true;
  gamePanel.classList.add("hidden");
  resultPanel.classList.add("hidden");
  setupPanel.classList.remove("hidden");
}

function destroyController(): void {
  controller?.destroy();
  controller = null;
  mediaHost.replaceChildren();
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

window.addEventListener("beforeunload", destroyController);
