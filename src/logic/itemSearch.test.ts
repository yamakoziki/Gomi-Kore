import { describe, expect, it } from "vitest";
import type { CategoriesData } from "../types";
import { searchCategories } from "./itemSearch";

const categoriesData: CategoriesData = {
  municipalityCode: "sapporo",
  noCollection: { code: "", label: { ja: "収集なし" } },
  categories: [
    {
      code: "1",
      id: "burnable",
      name: { ja: "燃やせるごみ", en: "Burnable garbage" },
      scheduleType: "regular",
      feeType: "designated_bag",
      keywords: ["生ごみ"],
      subItem: {
        id: "spray_can",
        name: { ja: "スプレー缶類", en: "Spray cans" },
        feeType: "free",
        keywords: ["スプレー", "カセットボンベ"],
      },
    },
    {
      code: "10",
      id: "mixed_paper",
      name: { ja: "雑がみ", en: "Mixed paper" },
      scheduleType: "regular",
      feeType: "free",
      keywords: ["紙"],
    },
    {
      id: "bulky_waste",
      name: { ja: "大型ごみ（粗大ごみ）", en: "Bulky waste" },
      scheduleType: "on_request",
      feeType: "sticker_required",
      keywords: ["粗大ごみ"],
    },
  ],
};

describe("searchCategories", () => {
  it("matches a category by its exact name", () => {
    const result = searchCategories(categoriesData, "雑がみ");
    expect(result?.category.id).toBe("mixed_paper");
    expect(result?.matchedSubItem).toBeNull();
  });

  it("matches a category via a keyword alias", () => {
    const result = searchCategories(categoriesData, "紙");
    expect(result?.category.id).toBe("mixed_paper");
  });

  it("matches a sub-item and returns its parent category with the sub-item attached", () => {
    const result = searchCategories(categoriesData, "スプレー缶");
    expect(result?.category.id).toBe("burnable");
    expect(result?.matchedSubItem?.id).toBe("spray_can");
  });

  it("matches voice transcripts normalized across katakana/hiragana and whitespace", () => {
    const result = searchCategories(categoriesData, "  カセット ボンベ  ");
    expect(result?.matchedSubItem?.id).toBe("spray_can");
  });

  it("matches an English name", () => {
    const result = searchCategories(categoriesData, "Bulky waste");
    expect(result?.category.id).toBe("bulky_waste");
  });

  it("returns null for an unmatched query", () => {
    expect(searchCategories(categoriesData, "蛍光灯")).toBeNull();
  });

  it("returns null for an empty or whitespace-only query", () => {
    expect(searchCategories(categoriesData, "   ")).toBeNull();
  });

  it("prefers an exact match over a broader partial match", () => {
    const result = searchCategories(categoriesData, "生ごみ");
    expect(result?.category.id).toBe("burnable");
  });
});
