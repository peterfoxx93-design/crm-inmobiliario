import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("scaffold smoke test", () => {
  it("resolves the @ alias and merges class names", () => {
    expect(cn("px-2", false && "hidden", "py-1")).toBe("px-2 py-1");
  });
});
