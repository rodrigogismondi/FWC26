import type { MatchCard, MatchDetail, MatchGoal, MatchStatRow } from "./match-detail-types";
import { enrichMatchesWithPenalties, pickPenScoreFromWcup } from "./penalty-data";
import type { GroupTable, Match, MatchStatus, Team } from "./types";
import { isMatchToday, isMatchUpcoming } from "./utils";

const WCUP_BASE = "https://wcup2026.org/api/data.php";
const WC26_BASE = "https://worldcup26.ir/get";
const FETCH_TIMEOUT_MS = 12_000;

async function fetchWithTimeout(
  input: string,
  init?: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

interface WcupMatch {
  id: number;
  round: string;
  group: string;
  team1: string;
  team2: string;
  flag1: string;
  flag2: string;
  status: string;
  score: [number, number] | null;
  pen_score?: [number, number];
  score_pen?: [number, number];
  live_minute: number | null;
  date: string;
  time: string;
  datetime: number;
  ground: string;
}

interface WcupMatchDetail extends WcupMatch {
  ht?: [number, number];
  goals1?: MatchGoal[];
  goals2?: MatchGoal[];
  pen_score?: [number, number];
  score_pen?: [number, number];
  cards?: Array<{
    team: number;
    minute: number;
    name: string;
    type: string;
    reason_en?: string;
  }>;
  stats?: Array<{ k_en: string; v: [number, number]; unit: string }>;
}

interface WcupMatchDetailResponse {
  ok: boolean;
  match?: WcupMatchDetail;
}

interface WcupResponse {
  ok: boolean;
  matches: WcupMatch[];
}

interface Wc26Team {
  id: string;
  name_en: string;
  flag: string;
  groups: string;
  iso2: string;
}

interface Wc26GroupTeam {
  team_id: string;
  mp: string;
  w: string;
  l: string;
  d: string;
  pts: string;
  gf: string;
  ga: string;
  gd: string;
}

interface Wc26Group {
  name: string;
  teams: Wc26GroupTeam[];
}

function normalizeStatus(raw: string): MatchStatus {
  if (raw === "live") return "live";
  if (raw === "finished") return "finished";
  if (raw === "upcoming" || raw === "scheduled") return "upcoming";
  return "scheduled";
}

function mapMatch(m: WcupMatch): Match {
  return {
    id: m.id,
    round: m.round,
    group: m.group,
    team1: m.team1,
    team2: m.team2,
    flag1: m.flag1,
    flag2: m.flag2,
    status: normalizeStatus(m.status),
    score: m.score,
    penScore: pickPenScoreFromWcup(m),
    liveMinute: m.live_minute,
    date: m.date,
    time: m.time,
    datetime: m.datetime,
    venue: m.ground,
  };
}

async function fetchWcup(action: string, params: Record<string, string> = {}): Promise<WcupMatch[]> {
  const qs = new URLSearchParams({ action, ...params });
  const res = await fetchWithTimeout(`${WCUP_BASE}?${qs}`);
  if (!res.ok) throw new Error(`wcup2026 ${action}: HTTP ${res.status}`);
  const data = (await res.json()) as WcupResponse;
  if (!data.ok) throw new Error(`wcup2026 ${action}: response not ok`);
  return data.matches ?? [];
}

export async function fetchAllMatches(): Promise<Match[]> {
  const raw = await fetchWcup("all");
  const matches = raw.map(mapMatch).sort((a, b) => a.datetime - b.datetime);
  await enrichMatchesWithPenalties(matches);
  return matches;
}

export async function fetchLiveMatches(): Promise<Match[]> {
  const raw = await fetchWcup("live");
  return raw.map(mapMatch);
}

export async function fetchTodayMatches(): Promise<Match[]> {
  const raw = await fetchWcup("today");
  return raw.map(mapMatch);
}

export async function fetchUpcoming(limit = 20): Promise<Match[]> {
  const raw = await fetchWcup("upcoming", { limit: String(limit) });
  return raw.map(mapMatch);
}

export async function fetchRecentResults(limit = 10): Promise<Match[]> {
  const raw = await fetchWcup("results", { limit: String(limit) });
  return raw.map(mapMatch);
}

function mapMatchDetail(raw: WcupMatchDetail): MatchDetail {
  const base = mapMatch(raw);
  const cards: MatchCard[] = (raw.cards ?? []).map((c) => ({
    team: c.team === 2 ? 2 : 1,
    minute: c.minute,
    name: c.name,
    type: c.type === "red" ? "red" : "yellow",
    reasonEn: c.reason_en,
  }));
  const stats: MatchStatRow[] = (raw.stats ?? []).map((s) => ({
    keyEn: s.k_en,
    values: s.v,
    unit: s.unit ?? "",
  }));
  return {
    ...base,
    halfTime: raw.ht ?? null,
    goals1: raw.goals1 ?? [],
    goals2: raw.goals2 ?? [],
    cards,
    stats,
  };
}

export async function fetchMatchDetail(id: number): Promise<MatchDetail | null> {
  const res = await fetchWithTimeout(`${WCUP_BASE}?action=match&id=${id}`);
  if (!res.ok) throw new Error(`wcup2026 match: HTTP ${res.status}`);
  const data = (await res.json()) as WcupMatchDetailResponse;
  if (!data.ok || !data.match) return null;
  return mapMatchDetail(data.match);
}

export function matchSummaryFromList(m: Match): MatchDetail {
  return {
    ...m,
    halfTime: null,
    goals1: [],
    goals2: [],
    cards: [],
    stats: [],
  };
}

export async function fetchTeams(): Promise<Team[]> {
  const res = await fetchWithTimeout(`${WC26_BASE}/teams`);
  if (!res.ok) throw new Error(`worldcup26 teams: HTTP ${res.status}`);
  const data = (await res.json()) as { teams: Wc26Team[] };
  return data.teams.map((t) => ({
    id: t.id,
    name: t.name_en,
    flag: t.flag,
    group: t.groups,
    iso2: t.iso2,
  }));
}

export async function fetchGroupStandings(): Promise<GroupTable[]> {
  const [groupsRes, teams] = await Promise.all([
    fetchWithTimeout(`${WC26_BASE}/groups`),
    fetchTeams(),
  ]);

  if (!groupsRes.ok) throw new Error(`worldcup26 groups: HTTP ${groupsRes.status}`);
  const data = (await groupsRes.json()) as { groups: Wc26Group[] };
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  return data.groups
    .map((g) => ({
      name: g.name,
      teams: g.teams
        .map((row) => {
          const team = teamMap.get(row.team_id);
          return {
            teamId: row.team_id,
            name: team?.name ?? `Team ${row.team_id}`,
            flag: team?.flag ?? "",
            played: Number(row.mp),
            won: Number(row.w),
            drawn: Number(row.d),
            lost: Number(row.l),
            goalsFor: Number(row.gf),
            goalsAgainst: Number(row.ga),
            goalDiff: Number(row.gd),
            points: Number(row.pts),
          };
        })
        .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface DashboardData {
  all: Match[];
  live: Match[];
  today: Match[];
  upcoming: Match[];
  recent: Match[];
  groups: GroupTable[];
  fetchedAt: Date;
}

export async function fetchDashboard(): Promise<DashboardData> {
  const [allResult, groupsResult] = await Promise.allSettled([
    fetchAllMatches(),
    fetchGroupStandings(),
  ]);

  if (allResult.status === "rejected") {
    const reason = allResult.reason;
    throw reason instanceof Error ? reason : new Error("Could not load matches");
  }

  const all = allResult.value;
  const live = all.filter((m) => m.status === "live");
  const recent = all
    .filter((m) => m.status === "finished")
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, 8);
  const groups = groupsResult.status === "fulfilled" ? groupsResult.value : [];
  const today = all.filter(isMatchToday);
  const upcoming = all.filter(isMatchUpcoming).slice(0, 15);

  return { all, live, today, upcoming, recent, groups, fetchedAt: new Date() };
}
