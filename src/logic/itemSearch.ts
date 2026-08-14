import type { CategoriesData, Category, CategorySubItem, ItemDictionaryData, ItemDictionaryEntry, LocalizedText } from "../types";

export type ItemSearchMatch = {
  category: Category;
  matchedSubItem: CategorySubItem | null;
};

export type ItemDictionaryMatch = {
  entry: ItemDictionaryEntry;
  category: Category | null;
  subItem: CategorySubItem | null;
};

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s　]+/g, "")
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60)); // katakana -> hiragana
}

/** Exact matches win over partial ones; among partial matches, the closer the term's length is to the query, the better. */
function scoreTerm(term: string, normalizedQuery: string): number {
  if (term === normalizedQuery) return 100;
  if (term.includes(normalizedQuery)) return 60 - Math.abs(term.length - normalizedQuery.length);
  if (normalizedQuery.includes(term)) return 50 - Math.abs(term.length - normalizedQuery.length);
  return -1;
}

function candidateTerms(name: LocalizedText, keywords: string[] | undefined): string[] {
  const raw = [name.ja, name.en, ...(keywords ?? [])].filter((value): value is string => Boolean(value));
  return raw.map(normalize).filter(Boolean);
}

/**
 * Finds the category (and, if more specific, the sub-item) whose name or
 * keyword aliases best match a free-text or voice-transcribed query. Sub-item
 * matches are considered alongside their parent category since they can be
 * the more specific answer (e.g. "スプレー缶" should surface the spray-can
 * sub-item note, not just "燃やせるごみ" in general).
 */
export function searchCategories(categoriesData: CategoriesData, query: string): ItemSearchMatch | null {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return null;

  let bestMatch: ItemSearchMatch | null = null;
  let bestScore = -1;

  const consider = (match: ItemSearchMatch, terms: string[]) => {
    for (const term of terms) {
      const score = scoreTerm(term, normalizedQuery);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = match;
      }
    }
  };

  for (const category of categoriesData.categories) {
    consider({ category, matchedSubItem: null }, candidateTerms(category.name, category.keywords));
    if (category.subItem) {
      consider(
        { category, matchedSubItem: category.subItem },
        candidateTerms(category.subItem.name, category.subItem.keywords),
      );
    }
  }

  return bestMatch;
}

/**
 * Same matching approach as `searchCategories`, but against a municipality's
 * full official item-by-item sorting dictionary (see `ItemDictionaryData`)
 * rather than the small hand-curated `keywords` list on each category. Only
 * municipalities with a bundled dictionary (currently Sapporo) support this;
 * `categoriesData` is used to resolve the matched entry's `categoryId`/
 * `subItemId` back to the actual `Category`/`CategorySubItem` objects.
 */
export function searchItemDictionary(
  categoriesData: CategoriesData,
  itemDictionary: ItemDictionaryData,
  query: string,
): ItemDictionaryMatch | null {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return null;

  let bestEntry: ItemDictionaryEntry | null = null;
  let bestScore = -1;
  for (const entry of itemDictionary.items) {
    const score = scoreTerm(normalize(entry.name), normalizedQuery);
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }
  if (!bestEntry) return null;

  const category = bestEntry.categoryId
    ? (categoriesData.categories.find((c) => c.id === bestEntry!.categoryId) ?? null)
    : null;
  const subItem = (bestEntry.subItemId && category?.subItem?.id === bestEntry.subItemId) ? category.subItem! : null;

  return { entry: bestEntry, category, subItem };
}
