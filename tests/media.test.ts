import { describe, expect, it } from "vitest";
import { extractYouTubeId } from "../src/media";

describe("extractYouTubeId", () => {
  it("accepts IDs and common YouTube URLs", () => {
    expect(extractYouTubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects invalid values", () => {
    expect(extractYouTubeId("not-a-video")).toBeNull();
  });
});
