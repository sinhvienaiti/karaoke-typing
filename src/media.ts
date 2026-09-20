import type { MediaController } from "./types";

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: {
          videoId: string;
          playerVars?: Record<string, number>;
          events?: {
            onReady?: () => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: (event: { data: number }) => void;
          };
        },
      ) => YouTubePlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YouTubePlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(volume: number): void;
  setPlaybackRate(rate: number): void;
  getPlayerState(): number;
  destroy(): void;
};

let youtubeApiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player !== undefined) return Promise.resolve();
  if (youtubeApiPromise !== null) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (existing !== null) return;

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.addEventListener("error", () => reject(new Error("Could not load YouTube Player API")), { once: true });
    document.head.append(script);
  });

  return youtubeApiPromise;
}

export function extractYouTubeId(value: string): string | null {
  const trimmed = value.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id !== undefined && /^[\w-]{11}$/.test(id) ? id : null;
    }

    if (url.hostname.endsWith("youtube.com")) {
      const direct = url.searchParams.get("v");
      if (direct !== null && /^[\w-]{11}$/.test(direct)) return direct;
      const parts = url.pathname.split("/").filter(Boolean);
      const marker = parts.findIndex((part) => ["embed", "shorts", "live"].includes(part));
      const id = marker >= 0 ? parts[marker + 1] : undefined;
      return id !== undefined && /^[\w-]{11}$/.test(id) ? id : null;
    }
  } catch {
    return null;
  }

  return null;
}

export class LocalMediaController implements MediaController {
  readonly kind = "local" as const;
  readonly element: HTMLMediaElement;
  private readonly objectUrl: string;

  constructor(file: File, host: HTMLElement) {
    this.objectUrl = URL.createObjectURL(file);
    const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name);
    this.element = document.createElement(isVideo ? "video" : "audio");
    this.element.src = this.objectUrl;
    this.element.preload = "metadata";
    this.element.controls = false;
    if (this.element instanceof HTMLVideoElement) {
      this.element.playsInline = true;
      this.element.className = "local-video";
    }
    host.replaceChildren(this.element);
  }

  async play(): Promise<void> {
    await this.element.play();
  }

  pause(): void {
    this.element.pause();
  }

  seek(seconds: number): void {
    this.element.currentTime = Math.max(0, seconds);
  }

  currentTime(): number {
    return Number.isFinite(this.element.currentTime) ? this.element.currentTime : 0;
  }

  duration(): number {
    return Number.isFinite(this.element.duration) ? this.element.duration : 0;
  }

  setVolume(volume: number): void {
    this.element.volume = Math.min(1, Math.max(0, volume));
  }

  setRate(rate: number): void {
    this.element.playbackRate = rate;
  }

  isPaused(): boolean {
    return this.element.paused;
  }

  destroy(): void {
    this.element.pause();
    this.element.removeAttribute("src");
    this.element.load();
    URL.revokeObjectURL(this.objectUrl);
    this.element.remove();
  }
}

export class YouTubeMediaController implements MediaController {
  readonly kind = "youtube" as const;
  private constructor(private readonly player: YouTubePlayer) {}

  static async create(videoId: string, host: HTMLElement): Promise<YouTubeMediaController> {
    await loadYouTubeApi();
    if (window.YT?.Player === undefined) throw new Error("YouTube Player API is unavailable");

    host.replaceChildren();
    const target = document.createElement("div");
    target.className = "youtube-player";
    host.append(target);

    const player = await new Promise<YouTubePlayer>((resolve, reject) => {
      let instance: YouTubePlayer;
      instance = new window.YT!.Player(target, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => resolve(instance),
          onError: (event) => reject(new Error(`YouTube player error ${event.data}`)),
        },
      });
    });

    return new YouTubeMediaController(player);
  }

  async play(): Promise<void> {
    this.player.playVideo();
  }

  pause(): void {
    this.player.pauseVideo();
  }

  seek(seconds: number): void {
    this.player.seekTo(Math.max(0, seconds), true);
  }

  currentTime(): number {
    return this.player.getCurrentTime() || 0;
  }

  duration(): number {
    return this.player.getDuration() || 0;
  }

  setVolume(volume: number): void {
    this.player.setVolume(Math.round(Math.min(1, Math.max(0, volume)) * 100));
  }

  setRate(rate: number): void {
    this.player.setPlaybackRate(rate);
  }

  isPaused(): boolean {
    const state = this.player.getPlayerState();
    return state !== window.YT?.PlayerState.PLAYING;
  }

  destroy(): void {
    this.player.destroy();
  }
}
