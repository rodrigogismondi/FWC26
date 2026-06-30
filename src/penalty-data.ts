import { needsPenaltyWinner } from "./match-outcome";
import type { Match } from "./types";

const FOOTBALL_RESULTS_URL = "https://wcup2026.org/football.php?results";
const FOOTBALL_REPORTS_URL = "https://wcup2026.org/football.php?reports";
const FETCH_TIMEOUT_MS = 12_000;

/** Shootout results not yet synced in wcup2026.org JSON/football feeds. */
const PENALTY_FALLBACK: Readonly<Record<number, [number, number]>> = {
  73: [3, 4], // Germany 1–1 Paraguay (R32) — Paraguay advances on pens
  74: [2, 3], // Netherlands 1–1 Morocco (R32) — Morocco advances on pens
};

function teamKey(team1: string, team2: string): string {
  return [team1.trim(), team2.trim()].sort().join("|");
}

function normalizeTeamName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

function parseScoreLineTeams(line: string): { team1: string; team2: string; ft: [number, number] } | null {
  const match = line.match(
    /^\s*(.+?)\s+(\d+)-(\d+)\s+\(\s*\d+\s*-\s*\d+\s*\)\s+(.+?)(?:\s+\[|\s+@|\s*$)/
  );
  if (!match) return null;
  const ft: [number, number] = [Number(match[2]), Number(match[3])];
  return {
    team1: normalizeTeamName(match[1]),
    team2: normalizeTeamName(match[4]),
    ft,
  };
}

function parseInlinePenalties(line: string): [number, number] | null {
  const m = line.match(/\[?\s*aet\s*;\s*(\d+)-(\d+)\s+on\s+pens\s*\]?/i);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

function parsePenaltiesLine(line: string): [number, number] | null {
  const m = line.match(/^\s*Penalties?:?\s*(?:\()?(\d+)-(\d+)/i);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

export function parseFootballTextPenalties(text: string): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  let pendingDraw: { team1: string; team2: string } | null = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\s+/g, " ").trimEnd();
    const parsed = parseScoreLineTeams(line);

    if (parsed) {
      if (parsed.ft[0] === parsed.ft[1]) {
        pendingDraw = { team1: parsed.team1, team2: parsed.team2 };
      } else {
        pendingDraw = null;
      }

      const inlinePen = parseInlinePenalties(line);
      if (inlinePen && parsed.ft[0] === parsed.ft[1]) {
        out.set(teamKey(parsed.team1, parsed.team2), inlinePen);
        pendingDraw = null;
      }
      continue;
    }

    const penScore = parsePenaltiesLine(line);
    if (penScore && pendingDraw) {
      out.set(teamKey(pendingDraw.team1, pendingDraw.team2), penScore);
      pendingDraw = null;
    }
  }

  return out;
}

async function fetchFootballText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    window.clearTimeout(timer);
  }
}

function pickPenScoreFromRaw(raw: Record<string, unknown>): [number, number] | null {
  const direct = raw.pen_score ?? raw.penalties ?? raw.score_pen;
  if (Array.isArray(direct) && direct.length >= 2) {
    return [Number(direct[0]), Number(direct[1])];
  }

  const score = raw.score;
  if (score && typeof score === "object" && !Array.isArray(score)) {
    const p = (score as { p?: number[]; pen?: number[] }).p ?? (score as { pen?: number[] }).pen;
    if (Array.isArray(p) && p.length >= 2) {
      return [Number(p[0]), Number(p[1])];
    }
  }

  return null;
}

async function fetchPenScoreFromMatchDetail(id: number): Promise<[number, number] | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://wcup2026.org/api/data.php?action=match&id=${id}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { match?: Record<string, unknown> };
    if (!data.match) return null;
    return pickPenScoreFromRaw(data.match);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function applyPenScore(match: Match, penScore: [number, number]): void {
  match.penScore = penScore;
}

export async function enrichMatchesWithPenalties(matches: Match[]): Promise<void> {
  const byTeams = new Map<string, Match>();
  for (const m of matches) {
    byTeams.set(teamKey(m.team1, m.team2), m);
  }

  const [resultsText, reportsText] = await Promise.all([
    fetchFootballText(FOOTBALL_RESULTS_URL),
    fetchFootballText(FOOTBALL_REPORTS_URL),
  ]);

  for (const penMap of [parseFootballTextPenalties(resultsText), parseFootballTextPenalties(reportsText)]) {
    for (const [key, penScore] of penMap) {
      const match = byTeams.get(key);
      if (match && !match.penScore) applyPenScore(match, penScore);
    }
  }

  const pending = matches.filter((m) => needsPenaltyWinner(m));
  if (pending.length > 0) {
    await Promise.all(
      pending.map(async (m) => {
        const penScore = await fetchPenScoreFromMatchDetail(m.id);
        if (penScore) applyPenScore(m, penScore);
      })
    );
  }

  for (const m of matches) {
    if (!m.penScore && PENALTY_FALLBACK[m.id]) {
      applyPenScore(m, PENALTY_FALLBACK[m.id]);
    }
  }
}

export function pickPenScoreFromWcup(raw: {
  pen_score?: [number, number];
  score_pen?: [number, number];
  penScore?: [number, number];
}): [number, number] | null {
  const candidate = raw.pen_score ?? raw.score_pen ?? raw.penScore;
  if (Array.isArray(candidate) && candidate.length >= 2) {
    return [Number(candidate[0]), Number(candidate[1])];
  }
  return null;
}
