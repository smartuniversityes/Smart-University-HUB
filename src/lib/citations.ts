/**
 * Citation helpers shared by the chat API and the chat UI.
 *
 * The model is given a numbered list of excerpts and is asked to cite them
 * inline (`[1]`, `[2]`...). Retrieval often returns more excerpts than the
 * answer actually uses, so this module trims the source list down to the ones
 * the answer really references and renumbers both the text and the list so the
 * numbers still line up.
 */

export type CitationLike = {
  materialId: string;
  title: string;
  subjectCode: string;
  pageLabel: string | null;
  quote: string;
};

/** Matches `[1]`, `[1][2]` and `[1, 2]` style citation markers. */
const MARKER = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

function citedIndexes(text: string, max: number): number[] {
  const order: number[] = [];
  const seen = new Set<number>();

  for (const match of text.matchAll(MARKER)) {
    for (const part of match[1].split(",")) {
      const index = Number(part.trim());
      if (
        Number.isInteger(index) &&
        index >= 1 &&
        index <= max &&
        !seen.has(index)
      ) {
        seen.add(index);
        order.push(index);
      }
    }
  }

  return order;
}

/**
 * Keeps only the citations the answer refers to and rewrites the markers to
 * `[1]…[n]` in order of first use. Running it twice is safe: already-normalised
 * text maps each marker to itself.
 */
export function normalizeCitations<T extends CitationLike>(
  text: string,
  citations: readonly T[] | null | undefined,
): { text: string; citations: T[] | null } {
  if (!citations || citations.length === 0) {
    return { text, citations: citations ? [...citations] : null };
  }

  const order = citedIndexes(text, citations.length);

  // The model forgot to cite anything. Keep the retrieved excerpts so the
  // answer is still verifiable instead of silently hiding every source.
  if (order.length === 0) {
    return { text, citations: [...citations] };
  }

  const renumber = new Map(
    order.map((oldIndex, position) => [oldIndex, position + 1] as const),
  );

  const normalizedText = text.replace(MARKER, (_whole, inner: string) => {
    const parts = inner.split(",").map((part) => {
      const index = Number(part.trim());
      return String(renumber.get(index) ?? part.trim());
    });
    return `[${parts.join(", ")}]`;
  });

  return {
    text: normalizedText,
    citations: order.map((index) => citations[index - 1]),
  };
}
