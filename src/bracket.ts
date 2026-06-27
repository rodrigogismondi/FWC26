import type { DashboardData } from "./api";
import type { GroupTable, Match } from "./types";
import { isPlaceholderTeam } from "./types";
import { translateTeamName } from "./countries";
import { t, translateRound, type Lang } from "./i18n";
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

const ROUND_KEYS = {
  "Round of 32": "roundR32",
  "Round of 16": "roundR16",
  "Quarter-final": "roundQF",
  "Semi-final": "roundSF",
  Final: "roundFinal",
} as const;

/** Rows in the shared side grid (2 rows per slot × 2 slots × 4 pairs). */
const GRID_ROWS = 16;

/**
 * Official FIFA 2026 knockout tree (API match ids).
 * W## references in the API use FIFA match numbers; id = FIFA # − 1.
 */
const BRACKET_LEFT = {
  r32Pairs: [
    [72, 74], // → R16 89 (W73 vs W75)
    [73, 76], // → R16 88 (W74 vs W77)
    [82, 83], // → R16 92 (W83 vs W84)
    [80, 81], // → R16 93 (W81 vs W82)
  ],
  r16: [89, 88, 92, 93],
  qf: [96, 97],
  sf: 100,
} as const;

const BRACKET_RIGHT = {
  r32Pairs: [
    [75, 77], // → R16 90 (W76 vs W78) — Brazil/Japan & Ivory Coast/Norway
    [78, 79], // → R16 91 (W79 vs W80)
    [85, 87], // → R16 94 (W86 vs W88)
    [84, 86], // → R16 95 (W85 vs W87)
  ],
  r16: [90, 91, 94, 95],
  qf: [98, 99],
  sf: 101,
} as const;

const FINAL = 103;
const THIRD = 102;

function roundLabel(lang: Lang, round: string): string {
  if (round in ROUND_KEYS) return t(lang, ROUND_KEYS[round as keyof typeof ROUND_KEYS]);
  return translateRound(lang, round);
}

function normalizeRound(round: string): string {
  if (round.startsWith("Match for third")) return "Third place";
  return round;
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
    const src = matchById.get(winnerRefToId(Number(wMatch[1])));
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

  if (isPlaceholderTeam(raw)) {
    return { label: "", flag: "", isPlaceholder: true };
  }

  return { label: raw, flag: flag || "", isPlaceholder: false };
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
    : `<span class="bk-flag-ph">${escapeHtml(teamInitials(label))}</span>`;

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

function renderMatchById(
  id: number,
  side: "left" | "right",
  matchById: Map<number, Match>,
  groups: GroupTable[],
  lang: Lang
): string {
  const m = matchById.get(id);
  if (!m) return "";
  return renderBracketMatch(toBracketMatch(m, matchById, groups), side, lang);
}

/** R32 pair p occupies rows p×4+1 … p×4+4; R16 p at rows p×4+2 … p×4+3. */
function r32PairRows(p: number): string {
  const start = p * 4 + 1;
  return `${start} / ${start + 4}`;
}

function r16Rows(p: number): string {
  const start = p * 4 + 2;
  return `${start} / ${start + 2}`;
}

/** QF q spans the vertical center of two adjacent R16 blocks (8 rows each). */
function qfRows(q: number): string {
  const start = q * 8 + 3;
  return `${start} / ${start + 4}`;
}

function sfRows(): string {
  return "7 / 11";
}

function renderSideGrid(
  config: typeof BRACKET_LEFT | typeof BRACKET_RIGHT,
  side: "left" | "right",
  matchById: Map<number, Match>,
  groups: GroupTable[],
  lang: Lang
): string {
  const colOrder =
    side === "left"
      ? (["r32", "r16", "qf", "sf"] as const)
      : (["sf", "qf", "r16", "r32"] as const);

  const labels: Record<(typeof colOrder)[number], string> = {
    r32: roundLabel(lang, "Round of 32"),
    r16: roundLabel(lang, "Round of 16"),
    qf: roundLabel(lang, "Quarter-final"),
    sf: roundLabel(lang, "Semi-final"),
  };

  const headerCells = colOrder
    .map(
      (col, i) =>
        `<div class="bk-col-label" style="grid-column:${i + 1};grid-row:1">${escapeHtml(labels[col])}</div>`
    )
    .join("");

  const r32Cells = config.r32Pairs
    .map(
      (pair, p) =>
        `<div class="bk-pair bk-pair-r32" style="grid-column:${colOrder.indexOf("r32") + 1};grid-row:${r32PairRows(p)}">${pair
          .map((id) => renderMatchById(id, side, matchById, groups, lang))
          .join("")}</div>`
    )
    .join("");

  const r16Cells = config.r16
    .map(
      (id, p) =>
        `<div class="bk-match-wrap bk-match-r16" style="grid-column:${colOrder.indexOf("r16") + 1};grid-row:${r16Rows(p)}">${renderMatchById(id, side, matchById, groups, lang)}</div>`
    )
    .join("");

  const qfCells = config.qf
    .map(
      (id, q) =>
        `<div class="bk-match-wrap bk-match-qf" style="grid-column:${colOrder.indexOf("qf") + 1};grid-row:${qfRows(q)}">${renderMatchById(id, side, matchById, groups, lang)}</div>`
    )
    .join("");

  const sfCell = `<div class="bk-match-wrap bk-match-sf" style="grid-column:${colOrder.indexOf("sf") + 1};grid-row:${sfRows()}">${renderMatchById(config.sf, side, matchById, groups, lang)}</div>`;

  return `
    <div class="bk-region bk-region-${side}">
      <div class="bk-side-grid bk-side-${side}" style="grid-template-rows: auto repeat(${GRID_ROWS}, var(--bk-row))">
        ${headerCells}
        ${r32Cells}
        ${r16Cells}
        ${qfCells}
        ${sfCell}
      </div>
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
        ${renderSideGrid(BRACKET_LEFT, "left", matchById, data.groups, lang)}
        <div class="bk-center">
          ${renderFinalMatch(matchById, data.groups, lang)}
          ${thirdHtml}
        </div>
        ${renderSideGrid(BRACKET_RIGHT, "right", matchById, data.groups, lang)}
      </div>
    </div>
    ${renderGroupStrip(data.groups, lang)}`;
}
