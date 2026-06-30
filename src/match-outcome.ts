import type { Match } from "./types";

export function getMatchWinnerTeam(m: Match): 1 | 2 | null {
  if (m.status !== "finished" || !m.score) return null;
  if (m.score[0] > m.score[1]) return 1;
  if (m.score[1] > m.score[0]) return 2;
  if (m.penScore) {
    if (m.penScore[0] > m.penScore[1]) return 1;
    if (m.penScore[1] > m.penScore[0]) return 2;
  }
  return null;
}

export function getMatchWinnerName(m: Match): string | null {
  const winner = getMatchWinnerTeam(m);
  if (winner === 1) return m.team1;
  if (winner === 2) return m.team2;
  return null;
}

export function getMatchWinnerFlag(m: Match): string {
  const winner = getMatchWinnerTeam(m);
  if (winner === 1) return m.flag1;
  if (winner === 2) return m.flag2;
  return "";
}

export function decidedByPenalties(m: Match): boolean {
  return Boolean(m.penScore && m.score && m.score[0] === m.score[1]);
}

export function isKnockoutMatch(m: Match): boolean {
  if (m.group) return false;
  const r = m.round;
  return (
    r.includes("Round of") ||
    r.includes("Quarter") ||
    r.includes("Semi") ||
    r === "Final" ||
    r.includes("Third")
  );
}

export function needsPenaltyWinner(m: Match): boolean {
  return (
    m.status === "finished" &&
    Boolean(m.score && m.score[0] === m.score[1]) &&
    isKnockoutMatch(m) &&
    !m.penScore
  );
}
