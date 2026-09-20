import { describe, expect, it } from "vitest";
import { activeTokenIndex, findActiveLine, parseLrc, sungCharacterCount } from "../src/lrc";

describe("parseLrc", () => {
  it("parses standard lines, multiple timestamps and offset", () => {
    const lines = parseLrc("[offset:500]\n[00:01.00][00:03.00]Hello\n[00:05.00]World");
    expect(lines).toHaveLength(3);
    expect(lines[0]?.start).toBe(1.5);
    expect(lines[0]?.end).toBe(3.5);
    expect(lines[1]?.text).toBe("Hello");
    expect(lines[2]?.text).toBe("World");
  });

  it("parses enhanced word timestamps", () => {
    const [line] = parseLrc("[00:05.00]<00:05.00>Hello <00:05.50>world");
    expect(line?.text).toBe("Hello world");
    expect(line?.tokens.map((token) => token.text)).toEqual(["Hello ", "world"]);
    expect(activeTokenIndex(line!, 5.6)).toBe(1);
    expect(sungCharacterCount(line!, 5.25)).toBeGreaterThan(0);
  });

  it("finds the active lyric line with runtime offset", () => {
    const lines = parseLrc("[00:01.00]A\n[00:02.00]B");
    expect(findActiveLine(lines, 1.2, 0.2)).toBe(0);
    expect(findActiveLine(lines, 2.2, 0.2)).toBe(1);
  });
});
