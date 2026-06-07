import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Saint Laurent LE 5 À 7")).toBe("saint-laurent-le-5-a-7");
  });
  it("strips diacritics", () => {
    expect(slugify("Café Crème")).toBe("cafe-creme");
  });
  it("collapses repeated separators", () => {
    expect(slugify("foo --  bar")).toBe("foo-bar");
  });
  it("removes leading/trailing hyphens", () => {
    expect(slugify("-foo-")).toBe("foo");
  });
});
