import type { DashboardData } from "./api";
import type { GroupTable, Match } from "./types";
import { isPlaceholderTeam } from "./types";
import { translateTeamName } from "./countries";
import { t, translateRound, type Lang } from "./i18n";
import { escapeHtml, formatKickoff, formatScore, teamInitials } from "./utils";

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

/**
 * Official FIFA 2026 knockout tree (API match ids).
 * W## references in the API use FIFA match numbers; id = FIFA # − 1.
 */
const BRACKET_LEFT = {
  r32Pairs: [
    [72, 74],
    [73, 76],
    [82, 83],
    [80, 81],
  ],
  r16: [89, 88, 92, 93],
  qf: [96, 97],
  sf: 100,
} as const;

const BRACKET_RIGHT = {
  r32Pairs: [
    [75, 77],
    [78, 79],
    [85, 87],
    [84, 86],
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

function renderTeamRow(slot: BracketSlot, lang: Lang): string {
  if (slot.isPlaceholder) {
    return `
      <div class="bk-team-row bk-team-tbd">
        <span class="bk-icon-tbd" aria-hidden="true"></span>
        <span class="bk-team-name"></span>
      </div>`;
  }

  const label = translateTeamName(slot.label, lang);
  const flag = slot.flag
    ? `<img class="bk-flag" src="${escapeHtml(slot.flag)}" alt="" width="20" height="14" loading="lazy" />`
    : `<span class="bk-flag-ph">${escapeHtml(teamInitials(label))}</span>`;

  const winner = slot.isWinner ? " bk-team-winner" : "";
  const score =
    slot.score !== undefined ? `<span class="bk-team-score">${slot.score}</span>` : "";

  return `
    <div class="bk-team-row${winner}" title="${escapeHtml(label)}">
      ${flag}
      <span class="bk-team-name">${escapeHtml(label)}</span>
      ${score}
    </div>`;
}

function renderMatchCard(m: Match, bm: BracketMatch, lang: Lang): string {
  const live = bm.status === "live" ? " bk-card-live" : "";
  const done = bm.finished ? " bk-card-done" : "";
  const time = formatKickoff(m, lang);

  return `
    <div class="bk-card${live}${done}" data-match-id="${bm.id}">
      <div class="bk-card-time">${escapeHtml(time)}</div>
      <div class="bk-card-body">
        ${renderTeamRow(bm.team1, lang)}
        ${renderTeamRow(bm.team2, lang)}
      </div>
    </div>`;
}

function renderMatchById(
  id: number,
  matchById: Map<number, Match>,
  groups: GroupTable[],
  lang: Lang
): string {
  const m = matchById.get(id);
  if (!m) return "";
  return renderMatchCard(m, toBracketMatch(m, matchById, groups), lang);
}

function bracketSlot(span: number, className: string, inner: string): string {
  return `<div class="${className}" style="height:calc(var(--bk-pair-unit) * ${span})">${inner}</div>`;
}

function renderR32Column(
  pairs: readonly (readonly number[])[],
  matchById: Map<number, Match>,
  groups: GroupTable[],
  lang: Lang
): string {
  const body = pairs
    .map(
      (pair) =>
        bracketSlot(
          1,
          `bk-pair bk-pair-r32 bk-connector-out`,
          pair.map((id) => renderMatchById(id, matchById, groups, lang)).join("")
        )
    )
    .join("");

  return `
    <div class="bk-col bk-col-r32">
      <div class="bk-col-label">${escapeHtml(roundLabel(lang, "Round of 32"))}</div>
      <div class="bk-col-stack">${body}</div>
    </div>`;
}

function renderMatchColumn(
  round: string,
  ids: readonly number[],
  span: number,
  connectorClass: string,
  matchById: Map<number, Match>,
  groups: GroupTable[],
  lang: Lang
): string {
  const body = ids
    .map((id) =>
      bracketSlot(
        span,
        `bk-bracket-slot ${connectorClass} bk-connector-out`,
        renderMatchById(id, matchById, groups, lang)
      )
    )
    .join("");

  return `
    <div class="bk-col">
      <div class="bk-col-label">${escapeHtml(roundLabel(lang, round))}</div>
      <div class="bk-col-stack">${body}</div>
    </div>`;
}

function renderSide(
  config: typeof BRACKET_LEFT | typeof BRACKET_RIGHT,
  side: "left" | "right",
  matchById: Map<number, Match>,
  groups: GroupTable[],
  lang: Lang
): string {
  const cols =
    side === "left"
      ? [
          renderR32Column(config.r32Pairs, matchById, groups, lang),
          renderMatchColumn("Round of 16", config.r16, 1, "bk-slot-r16", matchById, groups, lang),
          renderMatchColumn("Quarter-final", config.qf, 2, "bk-slot-qf", matchById, groups, lang),
          renderMatchColumn("Semi-final", [config.sf], 4, "bk-slot-sf", matchById, groups, lang),
        ]
      : [
          renderMatchColumn("Semi-final", [config.sf], 4, "bk-slot-sf", matchById, groups, lang),
          renderMatchColumn("Quarter-final", config.qf, 2, "bk-slot-qf", matchById, groups, lang),
          renderMatchColumn("Round of 16", config.r16, 1, "bk-slot-r16", matchById, groups, lang),
          renderR32Column(config.r32Pairs, matchById, groups, lang),
        ];

  return `<div class="bk-side bk-side-${side}">${cols.join("")}</div>`;
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
      ${renderMatchCard(finalM, bm, lang)}
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
    ? `<div class="bk-third">${renderMatchCard(thirdM, toBracketMatch(thirdM, matchById, data.groups), lang)}<span class="bk-third-label">${escapeHtml(t(lang, "thirdPlace"))}</span></div>`
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
        ${renderSide(BRACKET_LEFT, "left", matchById, data.groups, lang)}
        <div class="bk-center">
          ${renderFinalMatch(matchById, data.groups, lang)}
          ${thirdHtml}
        </div>
        ${renderSide(BRACKET_RIGHT, "right", matchById, data.groups, lang)}
      </div>
    </div>
    ${renderGroupStrip(data.groups, lang)}`;
}
