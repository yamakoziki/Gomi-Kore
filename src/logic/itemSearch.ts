import type { CategoriesData, Category, CategorySubItem, LocalizedText } from "../types";

export type ItemSearchMatch = {
  category: Category;
  matchedSubItem: CategorySubItem | null;
};

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s　]+/g, "")
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60)); // katakana -> hiragana
}

function candidateTerms(name: LocalizedText, keywords: string[] | undefined): string[] {
  const raw = [name.ja, name.en, ...(keywords ?? [])].filter((value): value is string => Boolean(value));
  return raw.map(normalize).filter(Boolean);
}

/**
 * Finds the category (and, if more specific, the sub-item) whose name or
 * keyword aliases best match a free-text or voice-transcribed query. Exact
 * matches win over partial ones; sub-item matches are considered alongside
 * their parent category since they can be the more specific answer (e.g.
 * "スプレー缶" should surface the spray-can sub-item note, not just
 * "燃やせるごみ" in general).
 */
export function searchCategories(categoriesData: CategoriesData, query: string): ItemSearchMatch | null {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return null;

  let bestMatch: ItemSearchMatch | null = null;
  let bestScore = -1;

  const consider = (match: ItemSearchMatch, terms: string[]) => {
    for (const term of terms) {
      let score = -1;
      if (term === normalizedQuery) {
        score = 100;
      } else if (term.includes(normalizedQuery)) {
        score = 60 - Math.abs(term.length - normalizedQuery.length);
      } else if (normalizedQuery.includes(term)) {
        score = 50 - Math.abs(term.length - normalizedQuery.length);
      }
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
