import type { DashboardData } from "./api";
import type { GroupTable, Match } from "./types";
import { isPlaceholderTeam } from "./types";
import { escapeHtml, formatScore, teamInitials } from "./utils";

export interface BracketSlot {
  label: string;
  flag: string;
  isPlaceholder: boolean;
  isWinner?: boolean;
  score?: number;
}

export interface BracketMatch {
  id: number;
  round: string;
  team1: BracketSlot;
  team2: BracketSlot;
  status: Match["status"];
  finished: boolean;
}

const ROUND_LABELS: Record<string, string> = {
  "Round of 32": "Round of 32",
  "Round of 16": "Round of 16",
  "Quarter-final": "Quarter-finals",
  "Semi-final": "Semi-finals",
  Final: "Final",
};

/** Bracket tree: left half flows inward; right half is mirrored. */
const LEFT_R32_PAIRS = [
  [73, 75],
  [76, 78],
  [79, 80],
  [83, 84],
] as const;

const RIGHT_R32_PAIRS = [
  [74, 77],
  [81, 82],
  [85, 87],
  [72, 86],
] as const;

const LEFT_R16 = [89, 90, 91, 92] as const;
const RIGHT_R16 = [88, 93, 94, 95] as const;

const LEFT_QF = [96, 98] as const;
const RIGHT_QF = [97, 99] as const;

const LEFT_SF = 100;
const RIGHT_SF = 101;
const FINAL = 103;
const THIRD = 102;

function normalizeRound(round: string): string {
  if (round.startsWith("Match for third")) return "Third place";
  return round;
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

function resolveGroupSlot(code: string, groups: GroupTable[]): { name: string; flag: string } | null {
  const m = code.match(/^([12])([A-L])$/);
  if (!m) return null;
  const rank = Number(m[1]) - 1;
  const group = groups.find((g) => g.name === m[2]);
  if (!group || !group.teams[rank]) return null;
  return { name: group.teams[rank].name, flag: group.teams[rank].flag };
}

function resolveTeamLabel(
  raw: string,
  flag: string,
  matchById: Map<number, Match>,
  groups: GroupTable[]
): BracketSlot {
  const wMatch = raw.match(/^W(\d+)$/);
  if (wMatch) {
    const src = matchById.get(Number(wMatch[1]));
    if (src) {
      const winner = getWinnerName(src);
      if (winner) {
        return {
          label: winner,
          flag: getWinnerFlag(src),
          isPlaceholder: false,
          isWinner: true,
        };
      }
    }
    return { label: `W${wMatch[1]}`, flag: "", isPlaceholder: true };
  }

  const lMatch = raw.match(/^L(\d+)$/);
  if (lMatch) {
    const src = matchById.get(Number(lMatch[1]));
    if (src) {
      const winner = getWinnerName(src);
      if (winner) {
        const loser = winner === src.team1 ? src.team2 : src.team1;
        const loserFlag = winner === src.team1 ? src.flag2 : src.flag1;
        return { label: loser, flag: loserFlag, isPlaceholder: false };
      }
    }
    return { label: `L${lMatch[1]}`, flag: "", isPlaceholder: true };
  }

  const groupResolved = resolveGroupSlot(raw, groups);
  if (groupResolved) {
    return { label: groupResolved.name, flag: groupResolved.flag, isPlaceholder: false };
  }

  const isPlaceholder = isPlaceholderTeam(raw) || !flag;
  return { label: raw.replace(/\//g, ""), flag, isPlaceholder };
}

function toBracketMatch(m: Match, matchById: Map<number, Match>, groups: GroupTable[]): BracketMatch {
  const winner = getWinnerName(m);
  return {
    id: m.id,
    round: normalizeRound(m.round),
    team1: {
      ...resolveTeamLabel(m.team1, m.flag1, matchById, groups),
      isWinner: winner === m.team1,
      score: m.score?.[0],
    },
    team2: {
      ...resolveTeamLabel(m.team2, m.flag2, matchById, groups),
      isWinner: winner === m.team2,
      score: m.score?.[1],
    },
    status: m.status,
    finished: m.status === "finished",
  };
}

function renderSlot(slot: BracketSlot, side: "left" | "right"): string {
  const flag = slot.flag
    ? `<img class="bk-flag" src="${escapeHtml(slot.flag)}" alt="" width="22" height="15" loading="lazy" />`
    : `<span class="bk-flag-ph">${escapeHtml(teamInitials(slot.label))}</span>`;

  const classes = [
    "bk-slot",
    side === "right" ? "bk-slot-right" : "",
    slot.isPlaceholder ? "bk-slot-tbd" : "",
    slot.isWinner ? "bk-slot-winner" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const score =
    slot.score !== undefined ? `<span class="bk-score">${slot.score}</span>` : "";

  return `
    <div class="${classes}" title="${escapeHtml(slot.label)}">
      ${side === "left" ? `${flag}<span class="bk-label">${escapeHtml(slot.label)}</span>${score}` : `${score}<span class="bk-label">${escapeHtml(slot.label)}</span>${flag}`}
    </div>`;
}

function renderBracketMatch(bm: BracketMatch, side: "left" | "right"): string {
  const live = bm.status === "live" ? " bk-match-live" : "";
  const done = bm.finished ? " bk-match-done" : "";
  return `
    <div class="bk-match${live}${done}" data-match-id="${bm.id}">
      ${renderSlot(bm.team1, side)}
      ${renderSlot(bm.team2, side)}
    </div>`;
}

function renderColumn(
  label: string,
  matchIds: readonly number[],
  side: "left" | "right",
  matchById: Map<number, Match>,
  groups: GroupTable[],
  sizeClass: string,
  pairs?: readonly (readonly number[])[]
): string {
  const ids = side === "right" ? [...matchIds].reverse() : [...matchIds];

  const renderOne = (id: number) => {
    const m = matchById.get(id);
    if (!m) return "";
    return renderBracketMatch(toBracketMatch(m, matchById, groups), side);
  };

  let body: string;
  if (pairs) {
    const pairList = side === "right" ? [...pairs].reverse() : [...pairs];
    body = pairList
      .map((pair) => `<div class="bk-pair">${pair.map((id) => renderOne(id)).join("")}</div>`)
      .join("");
  } else {
    body = ids.map((id) => renderOne(id)).join("");
  }

  return `
    <div class="bk-col ${sizeClass} bk-col-${side}">
      <div class="bk-col-label">${escapeHtml(label)}</div>
      <div class="bk-col-matches">${body}</div>
    </div>`;
}

function renderFinalMatch(
  matchById: Map<number, Match>,
  groups: GroupTable[]
): string {
  const finalM = matchById.get(FINAL);
  if (!finalM) return "";

  const bm = toBracketMatch(finalM, matchById, groups);
  return `
    <div class="bk-final">
      <div class="bk-final-badge">🏆</div>
      <div class="bk-final-label">Final</div>
      <div class="bk-match bk-match-final">
        ${renderSlot(bm.team1, "left")}
        ${renderSlot(bm.team2, "right")}
      </div>
      ${bm.finished ? `<div class="bk-final-score">${escapeHtml(formatScore(finalM))}</div>` : ""}
    </div>`;
}

function renderGroupStrip(groups: GroupTable[]): string {
  return `
    <div class="bk-groups-strip">
      <h3 class="bk-groups-title">Group stage reference</h3>
      <div class="bk-groups-row">
        ${groups
          .map(
            (g) => `
          <div class="bk-group-chip">
            <span class="bk-group-name">${escapeHtml(g.name)}</span>
            <div class="bk-group-flags">
              ${g.teams.map((t) => (t.flag ? `<img src="${escapeHtml(t.flag)}" alt="${escapeHtml(t.name)}" title="${escapeHtml(t.name)}" width="18" height="13" loading="lazy" />` : "")).join("")}
            </div>
          </div>`
          )
          .join("")}
      </div>
    </div>`;
}

function countConfirmedR32(matchById: Map<number, Match>, groups: GroupTable[]): number {
  let count = 0;
  for (let id = 72; id <= 87; id++) {
    const m = matchById.get(id);
    if (!m) continue;
    const s1 = resolveTeamLabel(m.team1, m.flag1, matchById, groups);
    const s2 = resolveTeamLabel(m.team2, m.flag2, matchById, groups);
    if (!s1.isPlaceholder) count++;
    if (!s2.isPlaceholder) count++;
  }
  return count;
}

export function renderVisualBracket(data: DashboardData): string {
  const matchById = new Map<number, Match>();
  for (const m of data.all) matchById.set(m.id, m);

  const r32 = data.all.filter((m) => m.round === "Round of 32");
  if (r32.length === 0) {
    return `<div class="empty-state"><p>Knockout bracket data not available yet.</p></div>`;
  }

  const confirmed = countConfirmedR32(matchById, data.groups);
  const finishedR32 = r32.filter((m) => m.status === "finished").length;

  const leftHalf = `
    <div class="bk-region bk-region-left">
      ${renderColumn(ROUND_LABELS["Round of 32"], LEFT_R32_PAIRS.flat(), "left", matchById, data.groups, "bk-col-r32", LEFT_R32_PAIRS)}
      ${renderColumn(ROUND_LABELS["Round of 16"], LEFT_R16, "left", matchById, data.groups, "bk-col-r16")}
      ${renderColumn(ROUND_LABELS["Quarter-final"], LEFT_QF, "left", matchById, data.groups, "bk-col-qf")}
      ${renderColumn(ROUND_LABELS["Semi-final"], [LEFT_SF], "left", matchById, data.groups, "bk-col-sf")}
    </div>`;

  const rightHalf = `
    <div class="bk-region bk-region-right">
      ${renderColumn(ROUND_LABELS["Semi-final"], [RIGHT_SF], "right", matchById, data.groups, "bk-col-sf")}
      ${renderColumn(ROUND_LABELS["Quarter-final"], RIGHT_QF, "right", matchById, data.groups, "bk-col-qf")}
      ${renderColumn(ROUND_LABELS["Round of 16"], RIGHT_R16, "right", matchById, data.groups, "bk-col-r16")}
      ${renderColumn(ROUND_LABELS["Round of 32"], RIGHT_R32_PAIRS.flat(), "right", matchById, data.groups, "bk-col-r32", RIGHT_R32_PAIRS)}
    </div>`;

  const thirdM = matchById.get(THIRD);
  const thirdHtml = thirdM
    ? `<div class="bk-third">${renderBracketMatch(toBracketMatch(thirdM, matchById, data.groups), "left")}<span class="bk-third-label">3rd place</span></div>`
    : "";

  return `
    <div class="bk-header">
      <div class="bk-status">
        <span class="bk-status-title">Knockout stage</span>
        <span class="bk-status-pill">Round of 32 · ${finishedR32}/16 played</span>
        <span class="bk-status-pill bk-status-pill-alt">${confirmed}/32 teams confirmed</span>
      </div>
      <p class="bk-note">Follow the path from the edges to the center. Maroon slots are TBD — they fill in as the group stage completes and winners advance.</p>
    </div>
    <div class="bk-scroll">
      <div class="bk-tree">
        ${leftHalf}
        <div class="bk-center">
          ${renderFinalMatch(matchById, data.groups)}
          ${thirdHtml}
        </div>
        ${rightHalf}
      </div>
    </div>
    ${renderGroupStrip(data.groups)}`;
}
