// Wayform — book/chapter-count table backing the Chapter-a-Day and Custom
// Passage Range plans. Names and chapter counts only; scripture text is
// fetched at read time (see /api/passage) with the embedded KJV as fallback.

export interface BibleBook {
  name: string;
  chapters: number;
}

export const BIBLE_BOOKS: BibleBook[] = [
  { name: "Genesis", chapters: 50 },
  { name: "Exodus", chapters: 40 },
  { name: "Leviticus", chapters: 27 },
  { name: "Numbers", chapters: 36 },
  { name: "Deuteronomy", chapters: 34 },
  { name: "Joshua", chapters: 24 },
  { name: "Judges", chapters: 21 },
  { name: "Ruth", chapters: 4 },
  { name: "1 Samuel", chapters: 31 },
  { name: "2 Samuel", chapters: 24 },
  { name: "1 Kings", chapters: 22 },
  { name: "2 Kings", chapters: 25 },
  { name: "1 Chronicles", chapters: 29 },
  { name: "2 Chronicles", chapters: 36 },
  { name: "Ezra", chapters: 10 },
  { name: "Nehemiah", chapters: 13 },
  { name: "Esther", chapters: 10 },
  { name: "Job", chapters: 42 },
  { name: "Psalms", chapters: 150 },
  { name: "Proverbs", chapters: 31 },
  { name: "Ecclesiastes", chapters: 12 },
  { name: "Song of Solomon", chapters: 8 },
  { name: "Isaiah", chapters: 66 },
  { name: "Jeremiah", chapters: 52 },
  { name: "Lamentations", chapters: 5 },
  { name: "Ezekiel", chapters: 48 },
  { name: "Daniel", chapters: 12 },
  { name: "Hosea", chapters: 14 },
  { name: "Joel", chapters: 3 },
  { name: "Amos", chapters: 9 },
  { name: "Obadiah", chapters: 1 },
  { name: "Jonah", chapters: 4 },
  { name: "Micah", chapters: 7 },
  { name: "Nahum", chapters: 3 },
  { name: "Habakkuk", chapters: 3 },
  { name: "Zephaniah", chapters: 3 },
  { name: "Haggai", chapters: 2 },
  { name: "Zechariah", chapters: 14 },
  { name: "Malachi", chapters: 4 },
  { name: "Matthew", chapters: 28 },
  { name: "Mark", chapters: 16 },
  { name: "Luke", chapters: 24 },
  { name: "John", chapters: 21 },
  { name: "Acts", chapters: 28 },
  { name: "Romans", chapters: 16 },
  { name: "1 Corinthians", chapters: 16 },
  { name: "2 Corinthians", chapters: 13 },
  { name: "Galatians", chapters: 6 },
  { name: "Ephesians", chapters: 6 },
  { name: "Philippians", chapters: 4 },
  { name: "Colossians", chapters: 4 },
  { name: "1 Thessalonians", chapters: 5 },
  { name: "2 Thessalonians", chapters: 3 },
  { name: "1 Timothy", chapters: 6 },
  { name: "2 Timothy", chapters: 4 },
  { name: "Titus", chapters: 3 },
  { name: "Philemon", chapters: 1 },
  { name: "Hebrews", chapters: 13 },
  { name: "James", chapters: 5 },
  { name: "1 Peter", chapters: 5 },
  { name: "2 Peter", chapters: 3 },
  { name: "1 John", chapters: 5 },
  { name: "2 John", chapters: 1 },
  { name: "3 John", chapters: 1 },
  { name: "Jude", chapters: 1 },
  { name: "Revelation", chapters: 22 },
];

export function chaptersInBook(name: string): number {
  return BIBLE_BOOKS.find((b) => b.name === name)?.chapters ?? 0;
}

// --- Scripture references inside prose -------------------------------------
// The lesson guide cites passages in running text ("Read Heb. 1:1, 2; Rom.
// 1:19, 20"), using its own abbreviations. These are the extra spellings to
// recognise beyond the full book names above.

const BOOK_ALIASES: Record<string, string> = {
  gen: "Genesis", exod: "Exodus", ex: "Exodus", lev: "Leviticus",
  num: "Numbers", deut: "Deuteronomy", josh: "Joshua", judg: "Judges",
  "1 sam": "1 Samuel", "2 sam": "2 Samuel", "1 kings": "1 Kings",
  "2 kings": "2 Kings", "1 chron": "1 Chronicles", "2 chron": "2 Chronicles",
  neh: "Nehemiah", esth: "Esther", ps: "Psalms", psa: "Psalms",
  psalm: "Psalms", prov: "Proverbs", eccl: "Ecclesiastes",
  "song of sol": "Song of Solomon", isa: "Isaiah", jer: "Jeremiah",
  lam: "Lamentations", ezek: "Ezekiel", dan: "Daniel", hos: "Hosea",
  obad: "Obadiah", mic: "Micah", nah: "Nahum", hab: "Habakkuk",
  zeph: "Zephaniah", hag: "Haggai", zech: "Zechariah", mal: "Malachi",
  matt: "Matthew", mk: "Mark", lk: "Luke", jn: "John", rom: "Romans",
  "1 cor": "1 Corinthians", "2 cor": "2 Corinthians", gal: "Galatians",
  eph: "Ephesians", phil: "Philippians", col: "Colossians",
  "1 thess": "1 Thessalonians", "2 thess": "2 Thessalonians",
  "1 tim": "1 Timothy", "2 tim": "2 Timothy", philem: "Philemon",
  heb: "Hebrews", "1 pet": "1 Peter", "2 pet": "2 Peter", rev: "Revelation",
};

/** Every spelling we recognise, longest first so "1 John" beats "John". */
const BOOK_LOOKUP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const book of BIBLE_BOOKS) map[book.name.toLowerCase()] = book.name;
  for (const [alias, name] of Object.entries(BOOK_ALIASES)) map[alias] = name;
  return map;
})();

const BOOK_PATTERN = Object.keys(BOOK_LOOKUP)
  .sort((a, b) => b.length - a.length)
  .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

// The second half of a numbered book's name. Needed to tell a verse list
// from the start of the next citation: in "Heb. 1:1, 2" the 2 is a verse,
// but in "Judges 4:4, 2 Kings 22:14" it is the number of the next book.
const NUMBERED_BOOK_TAIL =
  "Samuel|Sam|Kings|Kgs|Chronicles|Chron|Corinthians|Cor|Thessalonians|Thess|Timothy|Tim|Peter|Pet|John";

// Only treat ", N" as the next citation when a book name and its own
// chapter:verse follow it, so "Heb. 1:1, 2 says" keeps 2 as a verse.
const NEXT_BOOK_AHEAD = `(?!\\s+(?:${NUMBERED_BOOK_TAIL})\\.?\\s+\\d+:\\d+)`;

const VERSE_LIST =
  `\\d+:\\d+(?:\\s*[–—-]\\s*\\d+)?` +
  `(?:\\s*,\\s*\\d+${NEXT_BOOK_AHEAD}(?:\\s*[–—-]\\s*\\d+)?)*`;

// Book, then chapter:verse with optional en-dash ranges and comma lists.
// A comma is only swallowed when digits follow, so "John 14:9, NKJV" keeps
// the translation out of the reference.
const REFERENCE_RE = new RegExp(
  `\\b(${BOOK_PATTERN})\\.?\\s+(${VERSE_LIST})`,
  "gi",
);

export interface ScriptureMatch {
  /** Exactly as written in the lesson, e.g. "2 Tim. 3:16, 17". */
  text: string;
  /** Canonical form for the passage API, e.g. "2 Timothy 3:16,17". */
  query: string;
  start: number;
  end: number;
}

/** Locate every scripture reference in a run of prose. */
export function findScriptureRefs(input: string): ScriptureMatch[] {
  const found: ScriptureMatch[] = [];
  for (const m of input.matchAll(REFERENCE_RE)) {
    const book = BOOK_LOOKUP[m[1].toLowerCase().replace(/\.$/, "")];
    if (!book) continue;
    found.push({
      text: m[0],
      query: `${book} ${m[2].replace(/\s*[–—]\s*/g, "-").replace(/\s+/g, "")}`,
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return found;
}
