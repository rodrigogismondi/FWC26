import type { DashboardData } from "./api";
import type { GroupTable, Match } from "./types";
import { isPlaceholderTeam } from "./types";
import { translateTeamName } from "./countries";
import { t, translateRound, type Lang } from "./i18n";
import { escapeHtml, formatScore } from "./utils";

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

const ROUND_KEYS = {
  "Round of 32": "roundR32",
  "Round of 16": "roundR16",
  "Quarter-final": "roundQF",
  "Semi-final": "roundSF",
  Final: "roundFinal",
} as const;

function roundLabel(lang: Lang, round: string): string {
  if (round in ROUND_KEYS) return t(lang, ROUND_KEYS[round as keyof typeof ROUND_KEYS]);
  return translateRound(lang, round);
}

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
    return { label: "", flag: "", isPlaceholder: true };
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
    return { label: "", flag: "", isPlaceholder: true };
  }

  const groupResolved = resolveGroupSlot(raw, groups);
  if (groupResolved) {
    return { label: groupResolved.name, flag: groupResolved.flag, isPlaceholder: false };
  }

  const isPlaceholder = isPlaceholderTeam(raw) || !flag;
  return { label: "", flag: "", isPlaceholder };
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

function renderSlot(slot: BracketSlot, side: "left" | "right", lang: Lang): string {
  if (slot.isPlaceholder) {
    return `<div class="bk-slot bk-slot-empty bk-slot-tbd ${side === "right" ? "bk-slot-right" : ""}"></div>`;
  }

  const label = translateTeamName(slot.label, lang);
  const flag = slot.flag
    ? `<img class="bk-flag" src="${escapeHtml(slot.flag)}" alt="" width="22" height="15" loading="lazy" />`
    : "";

  const classes = [
    "bk-slot",
    side === "right" ? "bk-slot-right" : "",
    slot.isWinner ? "bk-slot-winner" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const score =
    slot.score !== undefined ? `<span class="bk-score">${slot.score}</span>` : "";

  return `
    <div class="${classes}" title="${escapeHtml(label)}">
      ${side === "left" ? `${flag}<span class="bk-label">${escapeHtml(label)}</span>${score}` : `${score}<span class="bk-label">${escapeHtml(label)}</span>${flag}`}
    </div>`;
}

function renderBracketMatch(bm: BracketMatch, side: "left" | "right", lang: Lang): string {
  const live = bm.status === "live" ? " bk-match-live" : "";
  const done = bm.finished ? " bk-match-done" : "";
  return `
    <div class="bk-match${live}${done}" data-match-id="${bm.id}">
      ${renderSlot(bm.team1, side, lang)}
      ${renderSlot(bm.team2, side, lang)}
    </div>`;
}

function renderColumn(
  label: string,
  matchIds: readonly number[],
  side: "left" | "right",
  matchById: Map<number, Match>,
  groups: GroupTable[],
  sizeClass: string,
  pairs: readonly (readonly number[])[] | undefined,
  lang: Lang,
): string {
  const ids = side === "right" ? [...matchIds].reverse() : [...matchIds];

  const renderOne = (id: number) => {
    const m = matchById.get(id);
    if (!m) return "";
    return renderBracketMatch(toBracketMatch(m, matchById, groups), side, lang);
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
  groups: GroupTable[],
  lang: Lang
): string {
  const finalM = matchById.get(FINAL);
  if (!finalM) return "";

  const bm = toBracketMatch(finalM, matchById, groups);
  return `
    <div class="bk-final">
      <div class="bk-final-badge">🏆</div>
      <div class="bk-final-label">${escapeHtml(t(lang, "final"))}</div>
      <div class="bk-match bk-match-final">
        ${renderSlot(bm.team1, "left", lang)}
        ${renderSlot(bm.team2, "right", lang)}
      </div>
      ${bm.finished ? `<div class="bk-final-score">${escapeHtml(formatScore(finalM))}</div>` : ""}
    </div>`;
}

function renderGroupStrip(groups: GroupTable[], lang: Lang): string {
  return `
    <div class="bk-groups-strip">
      <h3 class="bk-groups-title">${escapeHtml(t(lang, "groupStageRef"))}</h3>
      <div class="bk-groups-row">
        ${groups
          .map(
            (g) => `
          <div class="bk-group-chip">
            <span class="bk-group-name">${escapeHtml(g.name)}</span>
            <div class="bk-group-flags">
              ${g.teams.map((team) => (team.flag ? `<img src="${escapeHtml(team.flag)}" alt="${escapeHtml(translateTeamName(team.name, lang))}" title="${escapeHtml(translateTeamName(team.name, lang))}" width="18" height="13" loading="lazy" />` : "")).join("")}
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

export function renderVisualBracket(data: DashboardData, lang: Lang): string {
  const matchById = new Map<number, Match>();
  for (const m of data.all) matchById.set(m.id, m);

  const r32 = data.all.filter((m) => m.round === "Round of 32");
  if (r32.length === 0) {
    return `<div class="empty-state"><p>${escapeHtml(t(lang, "bracketEmpty"))}</p></div>`;
  }

  const confirmed = countConfirmedR32(matchById, data.groups);
  const finishedR32 = r32.filter((m) => m.status === "finished").length;

  const leftHalf = `
    <div class="bk-region bk-region-left">
      ${renderColumn(roundLabel(lang, "Round of 32"), LEFT_R32_PAIRS.flat(), "left", matchById, data.groups, "bk-col-r32", LEFT_R32_PAIRS, lang)}
      ${renderColumn(roundLabel(lang, "Round of 16"), LEFT_R16, "left", matchById, data.groups, "bk-col-r16", undefined, lang)}
      ${renderColumn(roundLabel(lang, "Quarter-final"), LEFT_QF, "left", matchById, data.groups, "bk-col-qf", undefined, lang)}
      ${renderColumn(roundLabel(lang, "Semi-final"), [LEFT_SF], "left", matchById, data.groups, "bk-col-sf", undefined, lang)}
    </div>`;

  const rightHalf = `
    <div class="bk-region bk-region-right">
      ${renderColumn(roundLabel(lang, "Semi-final"), [RIGHT_SF], "right", matchById, data.groups, "bk-col-sf", undefined, lang)}
      ${renderColumn(roundLabel(lang, "Quarter-final"), RIGHT_QF, "right", matchById, data.groups, "bk-col-qf", undefined, lang)}
      ${renderColumn(roundLabel(lang, "Round of 16"), RIGHT_R16, "right", matchById, data.groups, "bk-col-r16", undefined, lang)}
      ${renderColumn(roundLabel(lang, "Round of 32"), RIGHT_R32_PAIRS.flat(), "right", matchById, data.groups, "bk-col-r32", RIGHT_R32_PAIRS, lang)}
    </div>`;

  const thirdM = matchById.get(THIRD);
  const thirdHtml = thirdM
    ? `<div class="bk-third">${renderBracketMatch(toBracketMatch(thirdM, matchById, data.groups), "left", lang)}<span class="bk-third-label">${escapeHtml(t(lang, "thirdPlace"))}</span></div>`
    : "";

  return `
    <div class="bk-header">
      <div class="bk-status">
        <span class="bk-status-title">${escapeHtml(t(lang, "knockoutStage"))}</span>
        <span class="bk-status-pill">${escapeHtml(t(lang, "r32Progress", { n: finishedR32 }))}</span>
        <span class="bk-status-pill bk-status-pill-alt">${escapeHtml(t(lang, "teamsConfirmed", { n: confirmed }))}</span>
      </div>
      <p class="bk-note">${escapeHtml(t(lang, "bracketNote"))}</p>
    </div>
    <div class="bk-scroll">
      <div class="bk-tree">
        ${leftHalf}
        <div class="bk-center">
          ${renderFinalMatch(matchById, data.groups, lang)}
          ${thirdHtml}
        </div>
        ${rightHalf}
      </div>
    </div>
    ${renderGroupStrip(data.groups, lang)}`;
}
