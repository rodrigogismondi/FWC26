import type { DashboardData } from "./api";
import { translateTeamName } from "./countries";
import { t, translateGroup, translateRound, type Lang } from "./i18n";
import type { MatchDetail, MatchDetailTab, TimelineEvent } from "./match-detail-types";
import type { GroupTable } from "./types";
import { buildMatchById, resolveTeamSlot } from "./team-resolve";
import { escapeHtml, formatKickoff, formatScore, statusLabel, teamInitials } from "./utils";

export function minuteSortKey(minute: string | number): number {
  if (typeof minute === "number") return minute;
  const m = minute.match(/^(\d+)(?:\+(\d+))?/);
  if (!m) return 0;
  return Number(m[1]) + (m[2] ? Number(m[2]) : 0);
}

export function buildTimeline(detail: MatchDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const g of detail.goals1) {
    events.push({
      kind: "goal",
      team: 1,
      minute: g.minute,
      sortKey: minuteSortKey(g.minute),
      name: g.name,
    });
  }
  for (const g of detail.goals2) {
    events.push({
      kind: "goal",
      team: 2,
      minute: g.minute,
      sortKey: minuteSortKey(g.minute),
      name: g.name,
    });
  }
  for (const c of detail.cards) {
    events.push({
      kind: c.type,
      team: c.team,
      minute: String(c.minute),
      sortKey: minuteSortKey(c.minute),
      name: c.name,
      detail: c.reasonEn,
    });
  }

  return events.sort((a, b) => a.sortKey - b.sortKey || a.kind.localeCompare(b.kind));
}

function statLabel(keyEn: string, lang: Lang): string {
  const map: Record<string, string> =
    lang === "pt"
      ? {
          Possession: "Posse de bola",
          Shots: "Finalizações",
          "Shots on target": "Finalizações no gol",
          Corners: "Escanteios",
          Offsides: "Impedimentos",
          Fouls: "Faltas",
          Saves: "Defesas do goleiro",
          "Yellow cards": "Cartões amarelos",
        }
      : {};
  return map[keyEn] ?? keyEn;
}

function flagImg(src: string, alt: string, size = 28): string {
  if (!src) {
    return `<span class="flag-placeholder flag-placeholder-sm" title="${escapeHtml(alt)}">${escapeHtml(teamInitials(alt))}</span>`;
  }
  const h = Math.round(size * 0.72);
  return `<img class="flag" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="${size}" height="${h}" loading="lazy" />`;
}

function renderGroupMiniTable(group: GroupTable, lang: Lang): string {
  return `
    <table class="md-standings">
      <thead>
        <tr>
          <th>${escapeHtml(t(lang, "colTeam"))}</th>
          <th>${escapeHtml(t(lang, "colPts"))}</th>
          <th>${escapeHtml(t(lang, "colGD"))}</th>
        </tr>
      </thead>
      <tbody>
        ${group.teams
          .map(
            (team, i) => `
          <tr class="${i < 2 ? "qualifying" : i === 2 ? "third-place" : ""}">
            <td class="team-cell">
              ${team.flag ? `<img class="flag-sm" src="${escapeHtml(team.flag)}" alt="" width="18" height="13" />` : ""}
              ${escapeHtml(translateTeamName(team.name, lang))}
            </td>
            <td><strong>${team.points}</strong></td>
            <td>${team.goalDiff > 0 ? "+" : ""}${team.goalDiff}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function renderEventsTab(detail: MatchDetail, lang: Lang): string {
  const timeline = buildTimeline(detail);

  if (timeline.length === 0) {
    return `<p class="md-empty">${escapeHtml(t(lang, "mdNoEvents"))}</p>`;
  }

  return `
    <div class="md-timeline">
      ${timeline
        .map((ev) => {
          const icon =
            ev.kind === "goal"
              ? "⚽"
              : ev.kind === "red"
                ? '<span class="md-card-icon md-card-red"></span>'
                : '<span class="md-card-icon md-card-yellow"></span>';
          const label =
            ev.kind === "goal"
              ? t(lang, "mdGoal", { player: ev.name })
              : ev.kind === "red"
                ? t(lang, "mdRedCard", { player: ev.name })
                : t(lang, "mdYellowCard", { player: ev.name });
          const cls = ev.kind === "goal" ? "md-event md-event-goal" : "md-event";
          return `
            <article class="${cls}">
              <div class="md-event-time">${escapeHtml(ev.minute)}'</div>
              <div class="md-event-body">
                <div class="md-event-title">${icon} ${escapeHtml(label)}</div>
                ${ev.detail ? `<p class="md-event-detail">${escapeHtml(ev.detail)}</p>` : ""}
              </div>
            </article>`;
        })
        .join("")}
    </div>`;
}

function renderStatsTab(detail: MatchDetail, lang: Lang): string {
  if (detail.stats.length === 0) {
    return `<p class="md-empty">${escapeHtml(t(lang, "mdNoStats"))}</p>`;
  }

  return `
    <div class="md-stats">
      ${detail.stats
        .map((row) => {
          const [v1, v2] = row.values;
          const isPct = row.unit === "%";
          const left = isPct ? `${v1}%` : String(v1);
          const right = isPct ? `${v2}%` : String(v2);
          const leftWin = v1 > v2;
          const rightWin = v2 > v1;
          return `
          <div class="md-stat-row">
            <span class="md-stat-val ${leftWin ? "md-stat-best" : ""}">${escapeHtml(left)}</span>
            <span class="md-stat-label">${escapeHtml(statLabel(row.keyEn, lang))}</span>
            <span class="md-stat-val ${rightWin ? "md-stat-best" : ""}">${escapeHtml(right)}</span>
          </div>`;
        })
        .join("")}
    </div>`;
}

export function renderMatchDetailPanel(
  detail: MatchDetail,
  tab: MatchDetailTab,
  data: DashboardData,
  lang: Lang
): string {
  const matchById = buildMatchById(data.all);
  const r1 = resolveTeamSlot(detail.team1, detail.flag1, detail.id, matchById, data.groups);
  const r2 = resolveTeamSlot(detail.team2, detail.flag2, detail.id, matchById, data.groups);
  const name1 = translateTeamName(r1.label, lang);
  const name2 = translateTeamName(r2.label, lang);
  const flag1 = r1.flag || detail.flag1;
  const flag2 = r2.flag || detail.flag2;

  const groupLetter = detail.group.match(/Group ([A-L])/i)?.[1];
  const groupTable = groupLetter ? data.groups.find((g) => g.name === groupLetter) : undefined;
  const hasGroup = Boolean(groupTable);

  const tabs: MatchDetailTab[] = hasGroup ? ["events", "stats", "group"] : ["events", "stats"];

  const tabLabels: Record<MatchDetailTab, string> = {
    events: t(lang, "mdTabEvents"),
    stats: t(lang, "mdTabStats"),
    group: t(lang, "mdTabGroup"),
  };

  let tabBody = "";
  if (tab === "events") tabBody = renderEventsTab(detail, lang);
  else if (tab === "stats") tabBody = renderStatsTab(detail, lang);
  else if (tab === "group" && groupTable) tabBody = renderGroupMiniTable(groupTable, lang);

  const ht =
    detail.halfTime
      ? `<span class="md-ht">${escapeHtml(t(lang, "mdHalfTime"))}: ${detail.halfTime[0]}–${detail.halfTime[1]}</span>`
      : "";

  const score =
    detail.status === "finished" && detail.score
      ? `<span class="md-score">${escapeHtml(formatScore(detail))}</span>`
      : detail.score
        ? `<span class="md-score">${detail.score[0]} – ${detail.score[1]}</span>`
        : `<span class="md-score md-score-upcoming">${escapeHtml(formatKickoff(detail, lang))}</span>`;

  const statusBadge =
    detail.status === "live"
      ? `<span class="badge badge-live">${detail.liveMinute != null ? `${detail.liveMinute}'` : t(lang, "statusLive")}</span>`
      : `<span class="badge badge-${detail.status}">${statusLabel(detail.status, lang)}</span>`;

  return `
    <div class="md-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(name1)} vs ${escapeHtml(name2)}">
      <div class="md-backdrop" data-action="close-match"></div>
      <div class="md-sheet">
        <header class="md-header">
          <button type="button" class="md-close" data-action="close-match" aria-label="${escapeHtml(t(lang, "mdClose"))}">×</button>
          <div class="md-meta">
            <span>${escapeHtml(translateRound(lang, detail.round))}</span>
            ${detail.group ? `<span> · ${escapeHtml(translateGroup(lang, detail.group))}</span>` : ""}
          </div>
          <div class="md-teams">
            <div class="md-team">
              ${flagImg(flag1, name1, 32)}
              <span class="md-team-name">${escapeHtml(name1)}</span>
            </div>
            <div class="md-center">
              ${score}
              ${ht}
              ${statusBadge}
            </div>
            <div class="md-team md-team-right">
              ${flagImg(flag2, name2, 32)}
              <span class="md-team-name">${escapeHtml(name2)}</span>
            </div>
          </div>
          <p class="md-venue">${escapeHtml(detail.venue)} · ${escapeHtml(formatKickoff(detail, lang))}</p>
        </header>
        <nav class="md-tabs" role="tablist">
          ${tabs
            .map(
              (id) =>
                `<button type="button" class="md-tab ${tab === id ? "active" : ""}" data-action="md-tab" data-md-tab="${id}" role="tab">${escapeHtml(tabLabels[id])}</button>`
            )
            .join("")}
        </nav>
        <div class="md-body">
          ${tabBody}
          <p class="md-footnote">${escapeHtml(t(lang, "mdLineupNote"))}</p>
        </div>
      </div>
    </div>`;
}
