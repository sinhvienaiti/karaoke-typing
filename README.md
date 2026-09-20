# Karaoke Typing

A local-first song typing game for the `sinhvienaiti/typing-game` platform.

The game is inspired by the gameplay model of [TypingMania NEO](https://github.com/innocenat/typingmania), but this repository is a clean TypeScript implementation and does not copy its source code.

## Features

- YouTube playback by URL or video ID.
- Local audio/video playback (`MP3`, `MP4`, `M4A`, `WebM`, browser-supported formats).
- Standard LRC line synchronization.
- Enhanced LRC word timestamps with karaoke-style character progression.
- Runtime lyrics offset from `-5s` to `+5s`.
- Playback speed from `0.5x` to `1.5x`.
- Four modes:
  - Normal
  - Easy: pauses when a lyric line expires before it is completed.
  - Blind: only the next character remains visible.
  - Blank: target lyrics are hidden.
- Typing score, combo, accuracy, completed/skipped lines and skipped characters.
- Result screen and restart flow.
- No audio/video files are stored in Git.

## Local development

```bash
pnpm install
pnpm dev
```

Default port:

```text
3003
```

Platform host:

```text
https://karaoke.typing-game.local
```

## Build and tests

```bash
pnpm test
pnpm build
```

## Song setup

You need a synchronized LRC chart for the song.

Example:

```text
[00:12.34]When the first line begins
[00:18.52]The second line begins
```

Enhanced LRC is also accepted:

```text
[00:05.50]<00:05.50>Hello <00:06.00>world
```

For YouTube, paste either a full URL or the 11-character video ID.

For local media, choose a file from the browser. The file is played through an object URL and is never uploaded by this app.

## Copyright

This repository does not include songs, videos or commercial lyrics. Users are responsible for having the appropriate rights to media and lyric data they load.
