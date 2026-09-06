import { describe, expect, it } from "vitest";
import { FOUNDER_ENGINE_VERSION } from "../src/index.js";

describe("scaffolding", () => {
  it("exposes an engine version", () => {
    expect(FOUNDER_ENGINE_VERSION).toBe("0.0.0");
  });
});
