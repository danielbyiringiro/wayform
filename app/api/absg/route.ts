import { NextRequest } from "next/server";

// Server-side fetch of the real, current-week Adult Bible Study Guide from
// Adventech's open lesson repository (the same content source behind the
// official GC Sabbath School app). We fetch live rather than vendoring a
// copy, since the content changes weekly and isn't ours to redistribute.
//
// Repo layout: src/en/<year>-0<quarter>/<week 01-13>/<day 01-07>.md
// Quarters run exactly 13 weeks back-to-back, starting on a Saturday.

const RAW_BASE =
  "https://raw.githubusercontent.com/Adventech/sabbath-school-lessons/stage/src/en";
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDDMMYYYY(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

interface QuarterInfo {
  title: string;
  startDate: Date;
  endDate: Date;
}

async function fetchText(path: string): Promise<string | null> {
  const res = await fetch(`${RAW_BASE}/${path}`, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  return res.text();
}

function yamlValue(yaml: string, key: string): string | null {
  const match = yaml.match(new RegExp(`^\\s*${key}:\\s*"?([^"\\n]*)"?\\s*$`, "m"));
  return match ? match[1].trim() : null;
}

async function fetchQuarterInfo(quarterSlug: string): Promise<QuarterInfo | null> {
  const yaml = await fetchText(`${quarterSlug}/info.yml`);
  if (!yaml) return null;
  const title = yamlValue(yaml, "title");
  const startDate = yamlValue(yaml, "start_date");
  const endDate = yamlValue(yaml, "end_date");
  if (!title || !startDate || !endDate) return null;
  return { title, startDate: parseDDMMYYYY(startDate), endDate: parseDDMMYYYY(endDate) };
}

/** Find the quarter folder (e.g. "2026-04") that contains `today`. */
async function findQuarter(
  today: Date,
): Promise<{ slug: string; info: QuarterInfo } | null> {
  const guessNum = Math.ceil((today.getUTCMonth() + 1) / 3);
  // Try the calendar-quarter guess, then step outward (quarters sometimes
  // start a few days before the calendar month, so the guess can be off by one).
  for (const offset of [0, -1, 1, -2, 2]) {
    let num = guessNum + offset;
    let year = today.getUTCFullYear();
    if (num < 1) {
      num += 4;
      year -= 1;
    } else if (num > 4) {
      num -= 4;
      year += 1;
    }
    const slug = `${year}-0${num}`;
    const info = await fetchQuarterInfo(slug);
    if (info && today >= info.startDate && today <= info.endDate) {
      return { slug, info };
    }
  }
  return null;
}

// The lesson markdown uses a small, consistent vocabulary:
//   `backticks`  → a study question (the official app shows these as a
//                  prompt card with space to answer)
//   #### / ###   → a section heading, e.g. "Additional Reading"
//   >            → a pull quote, e.g. the week's Memory Text
//   ---          → a separator before the supplementary material
export type BlockKind = "text" | "question" | "heading" | "quote";
export interface Block {
  kind: BlockKind;
  text: string;
  /** Heading depth, for headings only. "###" stays inline; "####" starts the
   *  supplementary reading at the end of the day's section. */
  level?: number;
}

function clean(text: string): string {
  return text
    .replace(/<\/?p>/g, "")
    .replace(/\\\s*$/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/[_*`]/g, "")
    .trim();
}

function toBlocks(paragraph: string): Block[] {
  const trimmed = paragraph.trim();
  if (!trimmed || /^-{3,}$/.test(trimmed)) return [];

  if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return [{ kind: "question", text: clean(trimmed) }];
  }
  if (trimmed.startsWith("#")) {
    // A heading and the lines under it share one chunk when the source has no
    // blank line between them (e.g. "Read for This Week's Study" + its texts).
    const [headingLine, ...rest] = trimmed.split("\n");
    const level = (headingLine.match(/^#+/) ?? ["#"])[0].length;
    const blocks: Block[] = [
      { kind: "heading", level, text: clean(headingLine.replace(/^#+\s*/, "")) },
    ];
    const body = clean(rest.join("\n"));
    if (body) blocks.push({ kind: "text", text: body });
    return blocks;
  }
  if (trimmed.startsWith(">")) {
    return [{ kind: "quote", text: clean(trimmed.replace(/^>\s?/gm, "")) }];
  }
  return [{ kind: "text", text: clean(trimmed) }];
}

function parseDayFile(raw: string): {
  title: string | null;
  blocks: Block[];
  additionalTitle: string | null;
  additional: Block[];
} {
  const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const frontmatter = frontmatterMatch ? frontmatterMatch[1] : "";
  const body = frontmatterMatch ? raw.slice(frontmatterMatch[0].length) : raw;
  const title = yamlValue(frontmatter, "title");

  const all = body
    .split(/\n\s*\n/)
    .flatMap(toBlocks)
    .filter((b) => b.text.length > 0);

  // Everything from the first h4 onward is supplementary reading, which the
  // official app tucks behind a disclosure rather than showing inline. Shallower
  // headings ("Read for This Week's Study") belong to the lesson itself.
  const splitAt = all.findIndex(
    (b) => b.kind === "heading" && (b.level ?? 0) >= 4,
  );
  if (splitAt === -1) {
    return { title, blocks: all, additionalTitle: null, additional: [] };
  }

  return {
    title,
    blocks: all.slice(0, splitAt),
    additionalTitle: all[splitAt].text,
    additional: all.slice(splitAt + 1),
  };
}

export async function GET(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get("date");
  const today = utcMidnight(dateParam ? new Date(dateParam) : new Date());

  const quarter = await findQuarter(today);
  if (!quarter) {
    return Response.json(
      { error: "Could not find this week's ABSG content for today's date." },
      { status: 502 },
    );
  }

  const daysSinceStart = Math.round(
    (today.getTime() - quarter.info.startDate.getTime()) / DAY_MS,
  );
  const weekNumber = Math.floor(daysSinceStart / 7) + 1;
  const dayOfWeek = (daysSinceStart % 7) + 1; // 1 = Sabbath ... 7 = Friday
  const weekSlug = String(weekNumber).padStart(2, "0");
  const daySlug = String(dayOfWeek).padStart(2, "0");

  const [weekYaml, dayRaw] = await Promise.all([
    fetchText(`${quarter.slug}/${weekSlug}/info.yml`),
    fetchText(`${quarter.slug}/${weekSlug}/${daySlug}.md`),
  ]);

  if (!dayRaw) {
    return Response.json(
      { error: "This week's ABSG section could not be loaded." },
      { status: 502 },
    );
  }

  const weekTitle = weekYaml ? yamlValue(weekYaml, "title") : null;
  const { title: dayTitle, blocks, additionalTitle, additional } =
    parseDayFile(dayRaw);

  return Response.json({
    quarterTitle: quarter.info.title,
    coverUrl: `${RAW_BASE}/${quarter.slug}/cover.png`,
    weekTitle: weekTitle ?? dayTitle ?? "",
    dayTitle: dayTitle ?? weekTitle ?? "",
    weekNumber,
    dayOfWeek,
    date: today.toISOString().slice(0, 10),
    blocks,
    additionalTitle,
    additional,
  });
}
