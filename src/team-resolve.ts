import type { GroupTable, Match } from "./types";
import { isPlaceholderTeam } from "./types";
import { resolveThirdPlacePool } from "./third-place";

export interface ResolvedTeam {
  label: string;
  flag: string;
  isPlaceholder: boolean;
}

/** API stores W## using FIFA match numbers; our ids are FIFA # − 1. */
function winnerRefToId(fifaMatchNum: number): number {
  return fifaMatchNum - 1;
}

function getWinnerName(m: Match): string | null {
  if (m.status !== "finished" || !m.score) return null;
  if (m.score[0] > m.score[1]) return m.team1;
  if (m.score[1] > m.score[0]) return m.team2;
  return null;
}

function getWinnerFlag(m: Match): string {
  if (!m.score) return "";
  if (m.score[0] > m.score[1]) return m.flag1;
  if (m.score[1] > m.score[0]) return m.flag2;
  return "";
}

function findGroup(groups: GroupTable[], letter: string): GroupTable | undefined {
  return groups.find((g) => g.name === letter || g.name === `Group ${letter}`);
}

function resolveGroupSlot(code: string, groups: GroupTable[]): { name: string; flag: string } | null {
  const m = code.match(/^([12])([A-L])$/);
  if (!m) return null;
  const rank = Number(m[1]) - 1;
  const group = findGroup(groups, m[2]);
  if (!group || !group.teams[rank]) return null;
  return { name: group.teams[rank].name, flag: group.teams[rank].flag };
}

export function resolveTeamSlot(
  raw: string,
  flag: string,
  matchId: number,
  matchById: Map<number, Match>,
  groups: GroupTable[]
): ResolvedTeam {
  const wMatch = raw.match(/^W(\d+)$/);
  if (wMatch) {
    const src = matchById.get(winnerRefToId(Number(wMatch[1])));
    if (src) {
      const winner = getWinnerName(src);
      if (winner) {
        return {
          label: winner,
          flag: getWinnerFlag(src),
          isPlaceholder: false,
        };
      }
    }
    return { label: "", flag: "", isPlaceholder: true };
  }

  const lMatch = raw.match(/^L(\d+)$/);
  if (lMatch) {
    const src = matchById.get(winnerRefToId(Number(lMatch[1])));
    if (src) {
      const winner = getWinnerName(src);
      if (winner) {
        const loser = winner === src.team1 ? src.team2 : src.team1;
        const loserFlag = winner === src.team1 ? src.flag2 : src.flag1;
        return { label: loser, flag: loserFlag, isPlaceholder: false };
      }
    }
    return { label: "", flag: "", isPlaceholder: true };
  }

  const groupResolved = resolveGroupSlot(raw, groups);
  if (groupResolved) {
    return { label: groupResolved.name, flag: groupResolved.flag, isPlaceholder: false };
  }

  const thirdResolved = resolveThirdPlacePool(raw, groups, matchId);
  if (thirdResolved) {
    return { label: thirdResolved.name, flag: thirdResolved.flag, isPlaceholder: false };
  }

  if (isPlaceholderTeam(raw)) {
    return { label: "", flag: "", isPlaceholder: true };
  }

  return { label: raw, flag: flag || "", isPlaceholder: false };
}

export function buildMatchById(matches: Match[]): Map<number, Match> {
  return new Map(matches.map((m) => [m.id, m]));
}
