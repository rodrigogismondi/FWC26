import type { GroupTable, Match, MatchStatus, Team } from "./types";
import { isMatchToday, isMatchUpcoming } from "./utils";

const WCUP_BASE = "https://wcup2026.org/api/data.php";
const WC26_BASE = "https://worldcup26.ir/get";

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
  live_minute: number | null;
  date: string;
  time: string;
  datetime: number;
  ground: string;
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
    liveMinute: m.live_minute,
    date: m.date,
    time: m.time,
    datetime: m.datetime,
    venue: m.ground,
  };
}

async function fetchWcup(action: string, params: Record<string, string> = {}): Promise<WcupMatch[]> {
  const qs = new URLSearchParams({ action, ...params });
  const res = await fetch(`${WCUP_BASE}?${qs}`);
  if (!res.ok) throw new Error(`wcup2026 ${action}: HTTP ${res.status}`);
  const data = (await res.json()) as WcupResponse;
  if (!data.ok) throw new Error(`wcup2026 ${action}: response not ok`);
  return data.matches ?? [];
}

export async function fetchAllMatches(): Promise<Match[]> {
  const raw = await fetchWcup("all");
  return raw.map(mapMatch).sort((a, b) => a.datetime - b.datetime);
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

export async function fetchTeams(): Promise<Team[]> {
  const res = await fetch(`${WC26_BASE}/teams`);
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
    fetch(`${WC26_BASE}/groups`),
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
  const [all, live, recent, groups] = await Promise.all([
    fetchAllMatches(),
    fetchLiveMatches(),
    fetchRecentResults(8),
    fetchGroupStandings(),
  ]);

  const today = all.filter(isMatchToday);
  const upcoming = all.filter(isMatchUpcoming).slice(0, 15);

  return { all, live, today, upcoming, recent, groups, fetchedAt: new Date() };
}
