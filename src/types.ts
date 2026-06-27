export type MatchStatus = "scheduled" | "live" | "finished" | "upcoming";

export interface Match {
  id: number;
  round: string;
  group: string;
  team1: string;
  team2: string;
  flag1: string;
  flag2: string;
  status: MatchStatus;
  score: [number, number] | null;
  liveMinute: number | null;
  date: string;
  time: string;
  datetime: number;
  venue: string;
}

export interface GroupStanding {
  teamId: string;
  name: string;
  flag: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

export interface GroupTable {
  name: string;
  teams: GroupStanding[];
}

export interface Team {
  id: string;
  name: string;
  flag: string;
  group: string;
  iso2: string;
}

export type ViewId = "schedule" | "live" | "groups" | "bracket";

export const KNOCKOUT_ROUNDS = [
  "Round of 32",
  "Round of 16",
  "Quarter-final",
  "Semi-final",
  "Third place",
  "Final",
] as const;

export function isKnockoutRound(round: string): boolean {
  return KNOCKOUT_ROUNDS.some((r) => round.startsWith(r) || round === r);
}

export function isPlaceholderTeam(name: string): boolean {
  return /^[\d]?[A-L]$/.test(name) || name.includes("/") || name.includes("rd ");
}
