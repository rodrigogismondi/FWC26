import type { Match, MatchStatus } from "./types";

export type MatchDetailTab = "events" | "stats" | "group";

export interface MatchGoal {
  name: string;
  minute: string;
}

export interface MatchCard {
  team: 1 | 2;
  minute: number;
  name: string;
  type: "yellow" | "red";
  reasonEn?: string;
}

export interface MatchStatRow {
  keyEn: string;
  values: [number, number];
  unit: string;
}

export interface MatchDetail extends Match {
  halfTime: [number, number] | null;
  goals1: MatchGoal[];
  goals2: MatchGoal[];
  cards: MatchCard[];
  stats: MatchStatRow[];
}

export interface TimelineEvent {
  kind: "goal" | "yellow" | "red";
  team: 1 | 2;
  minute: string;
  sortKey: number;
  name: string;
  detail?: string;
}

export interface MatchSummary {
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
  datetime: number;
  venue: string;
}
