import { describe, expect, it } from "vitest";
import type { CategoriesData, ItemDictionaryData } from "../types";
import { searchCategories, searchItemDictionary } from "./itemSearch";

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

const itemDictionary: ItemDictionaryData = {
  municipalityCode: "sapporo",
  sourceUrl: "https://www.city.sapporo.jp/seiso/bunbetsu/index.html",
  items: [
    { name: "雑誌", categoryId: null, subItemId: null, special: "community_recycling", note: "できるだけ集団資源回収へ", fee: null },
    { name: "アイスピック", categoryId: "burnable", subItemId: null, special: null, note: null, fee: "有料" },
    {
      name: "スプレー缶",
      categoryId: "burnable",
      subItemId: "spray_can",
      special: null,
      note: null,
      fee: "無料",
    },
    { name: "ピアノ", categoryId: null, subItemId: null, special: "not_collected", note: "販売店に相談", fee: null },
  ],
};

describe("searchItemDictionary", () => {
  it("matches an item by exact name and resolves it to a regular category", () => {
    const result = searchItemDictionary(categoriesData, itemDictionary, "アイスピック");
    expect(result?.category?.id).toBe("burnable");
    expect(result?.subItem).toBeNull();
    expect(result?.entry.fee).toBe("有料");
  });

  it("resolves an entry's subItemId to the parent category's actual sub-item", () => {
    const result = searchItemDictionary(categoriesData, itemDictionary, "スプレー缶");
    expect(result?.category?.id).toBe("burnable");
    expect(result?.subItem?.id).toBe("spray_can");
  });

  it("returns a null category (with the special case and note intact) for items the city doesn't collect", () => {
    const result = searchItemDictionary(categoriesData, itemDictionary, "ピアノ");
    expect(result?.category).toBeNull();
    expect(result?.entry.special).toBe("not_collected");
    expect(result?.entry.note).toBe("販売店に相談");
  });

  it("returns a null category for community-recycling items", () => {
    const result = searchItemDictionary(categoriesData, itemDictionary, "雑誌");
    expect(result?.category).toBeNull();
    expect(result?.entry.special).toBe("community_recycling");
  });

  it("returns null for an unmatched query", () => {
    expect(searchItemDictionary(categoriesData, itemDictionary, "存在しない品目")).toBeNull();
  });

  it("returns null for an empty query", () => {
    expect(searchItemDictionary(categoriesData, itemDictionary, "  ")).toBeNull();
  });
});
