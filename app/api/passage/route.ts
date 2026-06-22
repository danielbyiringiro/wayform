import { NextRequest } from "next/server";

// Server-side proxy for ESV passage text. The ESV API requires an
// Authorization header (which the browser must never see), so we keep the
// key server-side here and the client fetches /api/passage?q=<reference>.
//
// Set ESV_API_KEY in .env.local. Get a free key at https://api.esv.org/.

const ESV_ENDPOINT = "https://api.esv.org/v3/passage/text/";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q) {
    return Response.json({ error: "Missing passage query (q)." }, { status: 400 });
  }

  const apiKey = process.env.ESV_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ESV_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  const params = new URLSearchParams({
    q,
    "include-passage-references": "false",
    "include-verse-numbers": "false",
    "include-first-verse-numbers": "false",
    "include-footnotes": "false",
    "include-headings": "false",
    "include-short-copyright": "false",
    "include-passage-horizontal-lines": "false",
    "include-heading-horizontal-lines": "false",
    "indent-poetry": "false",
    "indent-paragraphs": "0",
    "line-length": "0",
  });

  let esvResponse: Response;
  try {
    esvResponse = await fetch(`${ESV_ENDPOINT}?${params.toString()}`, {
      headers: { Authorization: `Token ${apiKey}` },
      // Passage text is immutable, so cache it and avoid repeat API calls.
      cache: "force-cache",
    });
  } catch {
    return Response.json({ error: "Failed to reach the ESV API." }, { status: 502 });
  }

  if (!esvResponse.ok) {
    return Response.json(
      { error: `ESV API returned ${esvResponse.status}.` },
      { status: 502 },
    );
  }

  const data = (await esvResponse.json()) as {
    canonical?: string;
    passages?: string[];
  };

  const raw = (data.passages ?? []).join("\n").trim();
  // Collapse the API's whitespace/newlines into clean, single-spaced prose.
  const text = raw.replace(/\s+/g, " ").trim();

  if (!text) {
    return Response.json({ error: "No passage text returned." }, { status: 404 });
  }

  return Response.json({ canonical: data.canonical ?? q, text });
}
