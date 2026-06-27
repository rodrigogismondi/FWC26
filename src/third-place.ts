import type { GroupTable } from "./types";
import { ANNEX_C_ROWS, ANNEX_C_WINNERS } from "./third-place-data";

/** API match id → group letter of the fixed winner in third-place R32 slots (FIFA Art. 12.6). */
export const THIRD_PLACE_MATCH_WINNERS: Record<number, string> = {
  73: "E", // M74 — Germany
  76: "I", // M77 — France
  78: "A", // M79 — Mexico
  79: "L", // M80
  80: "D", // M81 — USA
  81: "G", // M82
  84: "B", // M85 — Switzerland
  86: "K", // M87
};

const THIRD_PLACE_LOOKUP = new Map<string, Record<string, string>>();
for (const row of ANNEX_C_ROWS) {
  const byWinner: Record<string, string> = {};
  for (let j = 0; j < ANNEX_C_WINNERS.length; j++) {
    byWinner[ANNEX_C_WINNERS[j]] = row[j];
  }
  THIRD_PLACE_LOOKUP.set(row.split("").sort().join(""), byWinner);
}

interface ThirdPlaceRow {
  group: string;
  points: number;
  goalDiff: number;
  goalsFor: number;
}

function collectThirdPlaceRows(groups: GroupTable[]): ThirdPlaceRow[] {
  return groups.map((g) => {
    const third = g.teams[2];
    if (!third) return null;
    return {
      group: g.name,
      points: third.points,
      goalDiff: third.goalDiff,
      goalsFor: third.goalsFor,
    };
  }).filter((r): r is ThirdPlaceRow => r !== null);
}

function pickQualifyingThirdGroups(thirds: ThirdPlaceRow[]): ThirdPlaceRow[] {
  const sorted = [...thirds].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.group.localeCompare(b.group)
  );
  return sorted.slice(0, 8);
}

function lookupThirdGroupForWinner(qualifyingGroups: string[], winnerGroup: string): string | null {
  const combo = [...qualifyingGroups].sort().join("");
  const byWinner = THIRD_PLACE_LOOKUP.get(combo);
  if (!byWinner) return null;
  return byWinner[winnerGroup] ?? null;
}

/** Parse pool codes like `3A/B/C/D/F` into group letters. */
export function parseThirdPlacePool(code: string): string[] | null {
  if (!code.startsWith("3") || !code.includes("/")) return null;
  const parts = code.slice(1).split("/");
  if (parts.some((p) => !/^[A-L]$/.test(p))) return null;
  return parts;
}

/**
 * Resolve a third-place pool code to a team using FIFA Annex C and current standings.
 * Returns null when the combination is not yet determined.
 */
export function resolveThirdPlacePool(
  code: string,
  groups: GroupTable[],
  matchId: number
): { name: string; flag: string } | null {
  const pool = parseThirdPlacePool(code);
  const winnerGroup = THIRD_PLACE_MATCH_WINNERS[matchId];
  if (!pool || !winnerGroup) return null;

  const thirds = collectThirdPlaceRows(groups);
  if (thirds.length < 8) return null;

  const qualifying = pickQualifyingThirdGroups(thirds);
  const assignedGroup = lookupThirdGroupForWinner(qualifying.map((t) => t.group), winnerGroup);
  if (!assignedGroup || !pool.includes(assignedGroup)) return null;

  const group = groups.find((g) => g.name === assignedGroup);
  const team = group?.teams[2];
  if (!team?.name) return null;

  return { name: team.name, flag: team.flag };
}
