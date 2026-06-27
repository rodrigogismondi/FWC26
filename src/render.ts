import { renderVisualBracket } from "./bracket";
import type { DashboardData } from "./api";
import { translateTeamName } from "./countries";
import { renderMatchDetailPanel } from "./match-detail";
import type { MatchDetail, MatchDetailTab } from "./match-detail-types";
import { buildMatchById, resolveTeamSlot } from "./team-resolve";
import {
  FLAG_BR,
  FLAG_US,
  filterLabel,
  navLabel,
  t,
  translateGroup,
  translateRound,
  type Lang,
} from "./i18n";
import type { GroupTable, Match, ViewId } from "./types";
import {
  escapeHtml,
  formatDateHeader,
  formatKickoff,
  formatScore,
  groupMatchesByDate,
  isMatchToday,
  isMatchUpcoming,
  statusLabel,
  teamInitials,
  timeAgo,
} from "./utils";

function flagImg(src: string, alt: string): string {
  if (!src) {
    return `<span class="flag-placeholder" title="${escapeHtml(alt)}">${escapeHtml(teamInitials(alt))}</span>`;
  }
  return `<img class="flag" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" width="28" height="20" />`;
}

function renderMatchRow(m: Match, lang: Lang, compact = false, matchById?: Map<number, Match>, groups?: DashboardData["groups"]): string {
  const resolved1 =
    matchById && groups
      ? resolveTeamSlot(m.team1, m.flag1, m.id, matchById, groups)
      : { label: m.team1, flag: m.flag1, isPlaceholder: false };
  const resolved2 =
    matchById && groups
      ? resolveTeamSlot(m.team2, m.flag2, m.id, matchById, groups)
      : { label: m.team2, flag: m.flag2, isPlaceholder: false };
  const name1 = translateTeamName(resolved1.label, lang);
  const name2 = translateTeamName(resolved2.label, lang);
  const flag1 = resolved1.flag || m.flag1;
  const flag2 = resolved2.flag || m.flag2;

  const liveBadge =
    m.status === "live"
      ? `<span class="badge badge-live">${m.liveMinute != null ? `${m.liveMinute}'` : t(lang, "statusLive")}</span>`
      : `<span class="badge badge-${m.status}">${statusLabel(m.status, lang)}</span>`;

  const round = translateRound(lang, m.round);
  const group = m.group ? translateGroup(lang, m.group) : "";

  const meta = compact
    ? `<span class="match-meta">${escapeHtml(round)}${group ? ` · ${escapeHtml(group)}` : ""}</span>`
    : `<div class="match-meta-block">
        <span class="match-round">${escapeHtml(round)}</span>
        ${group ? `<span class="match-group">${escapeHtml(group)}</span>` : ""}
        <span class="match-venue">${escapeHtml(m.venue)}</span>
      </div>`;

  return `
    <article class="match-card match-card-clickable ${m.status === "live" ? "match-card-live" : ""}" data-id="${m.id}" data-action="open-match" data-match-id="${m.id}" role="button" tabindex="0">
      ${meta}
      <div class="match-teams">
        <div class="team-row ${m.score && m.score[0] > m.score[1] ? "team-winner" : ""}">
          ${flagImg(flag1, name1)}
          <span class="team-name">${escapeHtml(name1)}</span>
          ${m.score ? `<span class="team-score">${m.score[0]}</span>` : ""}
        </div>
        <div class="team-row ${m.score && m.score[1] > m.score[0] ? "team-winner" : ""}">
          ${flagImg(flag2, name2)}
          <span class="team-name">${escapeHtml(name2)}</span>
          ${m.score ? `<span class="team-score">${m.score[1]}</span>` : ""}
        </div>
      </div>
      <div class="match-footer">
        ${liveBadge}
        <time class="match-time">${escapeHtml(m.status === "finished" ? formatScore(m) : formatKickoff(m, lang))}</time>
      </div>
    </article>`;
}

function renderSchedule(data: DashboardData, filter: string, lang: Lang): string {
  const matchById = buildMatchById(data.all);
  let matches = data.all;
  if (filter === "live") matches = matches.filter((m) => m.status === "live");
  else if (filter === "today") matches = matches.filter(isMatchToday);
  else if (filter === "upcoming") matches = matches.filter(isMatchUpcoming);
  else if (filter === "finished") matches = matches.filter((m) => m.status === "finished");

  const descending = filter === "all" || filter === "finished";
  const byDate = groupMatchesByDate(matches, descending);

  if (matches.length === 0) {
    return `<div class="empty-state"><p>${escapeHtml(t(lang, "noMatches"))}</p></div>`;
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => (descending ? b.localeCompare(a) : a.localeCompare(b)))
    .map(
      ([date, dayMatches]) => `
      <section class="day-section">
        <h3 class="day-header">${escapeHtml(formatDateHeader(date, lang))}</h3>
        <div class="match-grid">${dayMatches.map((m) => renderMatchRow(m, lang, false, matchById, data.groups)).join("")}</div>
      </section>`
    )
    .join("");
}

function renderLive(data: DashboardData, lang: Lang): string {
  const matchById = buildMatchById(data.all);
  if (data.live.length === 0) {
    const next = data.upcoming[0];
    const next1 = next
      ? translateTeamName(resolveTeamSlot(next.team1, next.flag1, next.id, matchById, data.groups).label, lang)
      : "";
    const next2 = next
      ? translateTeamName(resolveTeamSlot(next.team2, next.flag2, next.id, matchById, data.groups).label, lang)
      : "";
    return `
      <div class="empty-state">
        <p class="empty-title">${escapeHtml(t(lang, "noLiveTitle"))}</p>
        ${
          next
            ? `<p class="empty-sub">${escapeHtml(t(lang, "nextUp"))}: <strong>${escapeHtml(next1)} vs ${escapeHtml(next2)}</strong><br/>${escapeHtml(formatKickoff(next, lang))}</p>`
            : ""
        }
      </div>
      <section class="section-block">
        <h3>${escapeHtml(t(lang, "recentResults"))}</h3>
        <div class="match-grid">${data.recent.map((m) => renderMatchRow(m, lang, true, matchById, data.groups)).join("")}</div>
      </section>`;
  }

  const progressKey = data.live.length === 1 ? "matchesInProgress" : "matchesInProgressPlural";

  return `
    <div class="live-banner">
      <span class="pulse"></span>
      ${escapeHtml(t(lang, progressKey, { n: data.live.length }))}
    </div>
    <div class="match-grid match-grid-live">${data.live.map((m) => renderMatchRow(m, lang, false, matchById, data.groups)).join("")}</div>
    <section class="section-block">
      <h3>${escapeHtml(t(lang, "alsoToday"))}</h3>
      <div class="match-grid">${data.all.filter((m) => isMatchToday(m) && m.status !== "live").map((m) => renderMatchRow(m, lang, true, matchById, data.groups)).join("") || `<p class='muted'>${escapeHtml(t(lang, "noOtherToday"))}</p>`}</div>
    </section>`;
}

function renderGroupTable(g: GroupTable, lang: Lang): string {
  return `
    <div class="group-card">
      <h3 class="group-title">${escapeHtml(t(lang, "group"))} ${escapeHtml(g.name)}</h3>
      <table class="standings-table">
        <thead>
          <tr>
            <th>${escapeHtml(t(lang, "colTeam"))}</th>
            <th>${escapeHtml(t(lang, "colPlayed"))}</th>
            <th>${escapeHtml(t(lang, "colWon"))}</th>
            <th>${escapeHtml(t(lang, "colDrawn"))}</th>
            <th>${escapeHtml(t(lang, "colLost"))}</th>
            <th>${escapeHtml(t(lang, "colGF"))}</th>
            <th>${escapeHtml(t(lang, "colGA"))}</th>
            <th>${escapeHtml(t(lang, "colGD"))}</th>
            <th>${escapeHtml(t(lang, "colPts"))}</th>
          </tr>
        </thead>
        <tbody>
          ${g.teams
            .map(
              (team, i) => `
            <tr class="${i < 2 ? "qualifying" : i === 2 ? "third-place" : ""}">
              <td class="team-cell">
                ${team.flag ? `<img class="flag-sm" src="${escapeHtml(team.flag)}" alt="" width="20" height="14" />` : ""}
                ${escapeHtml(translateTeamName(team.name, lang))}
              </td>
              <td>${team.played}</td><td>${team.won}</td><td>${team.drawn}</td><td>${team.lost}</td>
              <td>${team.goalsFor}</td><td>${team.goalsAgainst}</td>
              <td class="${team.goalDiff > 0 ? "positive" : team.goalDiff < 0 ? "negative" : ""}">${team.goalDiff > 0 ? "+" : ""}${team.goalDiff}</td>
              <td><strong>${team.points}</strong></td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function renderGroups(data: DashboardData, lang: Lang): string {
  return `<div class="groups-grid">${data.groups.map((g) => renderGroupTable(g, lang)).join("")}</div>`;
}

function renderLangSwitch(lang: Lang): string {
  return `
    <div class="lang-switch" role="group" aria-label="${escapeHtml(t(lang, "language"))}">
      <span class="lang-icon" aria-hidden="true">🌐</span>
      <button type="button" class="lang-btn ${lang === "pt" ? "active" : ""}" data-lang="pt" title="${escapeHtml(t(lang, "langPt"))}">
        <img src="${FLAG_BR}" alt="PT-BR" width="22" height="15" loading="lazy" />
      </button>
      <button type="button" class="lang-btn ${lang === "en" ? "active" : ""}" data-lang="en" title="${escapeHtml(t(lang, "langEn"))}">
        <img src="${FLAG_US}" alt="EN" width="22" height="15" loading="lazy" />
      </button>
    </div>`;
}

export interface AppState {
  view: ViewId;
  scheduleFilter: string;
  lang: Lang;
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  selectedMatchId: number | null;
  matchDetail: MatchDetail | null;
  matchDetailLoading: boolean;
  matchDetailTab: MatchDetailTab;
}

function renderMatchDetailOverlay(state: AppState): string {
  if (!state.selectedMatchId || !state.data) return "";

  if (state.matchDetailLoading) {
    return `
      <div class="md-panel md-panel-loading" role="dialog" aria-modal="true">
        <div class="md-backdrop" data-action="close-match"></div>
        <div class="md-sheet md-sheet-compact">
          <div class="loading"><div class="spinner"></div><p>${escapeHtml(t(state.lang, "mdLoading"))}</p></div>
        </div>
      </div>`;
  }

  if (!state.matchDetail) return "";

  return renderMatchDetailPanel(state.matchDetail, state.matchDetailTab, state.data, state.lang);
}

export function renderApp(state: AppState): string {
  const { view, data, loading, error, scheduleFilter, lang } = state;

  let content = "";
  if (loading && !data) {
    content = `<div class="loading"><div class="spinner"></div><p>${escapeHtml(t(lang, "loading"))}</p></div>`;
  } else if (error && !data) {
    content = `<div class="error-state"><p>${escapeHtml(t(lang, "errorTitle"))}</p><p class="muted">${escapeHtml(error)}</p><button class="btn" data-action="refresh">${escapeHtml(t(lang, "tryAgain"))}</button></div>`;
  } else if (data) {
    switch (view) {
      case "schedule":
        content = `
          <div class="filter-bar">
            ${["all", "live", "today", "upcoming", "finished"]
              .map(
                (f) =>
                  `<button class="filter-btn ${scheduleFilter === f ? "active" : ""}" data-filter="${f}">${escapeHtml(filterLabel(lang, f))}</button>`
              )
              .join("")}
          </div>
          ${renderSchedule(data, scheduleFilter, lang)}`;
        break;
      case "live":
        content = renderLive(data, lang);
        break;
      case "groups":
        content = renderGroups(data, lang);
        break;
      case "bracket":
        content = renderVisualBracket(data, lang);
        break;
    }
  }

  const liveCount = data?.live.length ?? 0;
  const updated = data ? timeAgo(data.fetchedAt, lang) : "";

  const footerHtml =
    lang === "pt"
      ? `Painel não oficial · Dados de <a href="https://wcup2026.org" target="_blank" rel="noopener">wcup2026.org</a> e <a href="https://worldcup26.ir" target="_blank" rel="noopener">worldcup26.ir</a> · Sem vínculo com a FIFA`
      : `Unofficial fan dashboard · Data from <a href="https://wcup2026.org" target="_blank" rel="noopener">wcup2026.org</a> &amp; <a href="https://worldcup26.ir" target="_blank" rel="noopener">worldcup26.ir</a> · Not affiliated with FIFA`;

  return `
    <div class="app">
      <header class="header">
        <div class="header-inner">
          <div class="brand">
            <span class="brand-icon">⚽</span>
            <div>
              <h1>${escapeHtml(t(lang, "title"))}</h1>
              <p class="tagline">${escapeHtml(t(lang, "tagline"))}</p>
            </div>
          </div>
          <div class="header-actions">
            ${renderLangSwitch(lang)}
            ${updated ? `<span class="updated" title="${escapeHtml(t(lang, "lastRefresh"))}">${escapeHtml(t(lang, "updated", { time: updated }))}</span>` : ""}
            <button class="btn btn-ghost" data-action="refresh" title="${escapeHtml(t(lang, "refreshNow"))}" ${loading ? "disabled" : ""}>
              ${loading ? "…" : "↻"}
            </button>
          </div>
        </div>
        <nav class="nav">
          ${navItem("schedule", lang, view)}
          ${navItem("live", lang, view, liveCount)}
          ${navItem("groups", lang, view)}
          ${navItem("bracket", lang, view)}
        </nav>
      </header>
      <main class="main${view === "bracket" ? " main--bracket" : ""}">${content}</main>
      <footer class="footer">
        <p>${footerHtml}</p>
      </footer>
    </div>
    ${renderMatchDetailOverlay(state)}`;
}

function navItem(id: ViewId, lang: Lang, current: ViewId, badge?: number): string {
  return `
    <button class="nav-btn ${current === id ? "active" : ""}" data-view="${id}">
      ${escapeHtml(navLabel(lang, id))}${badge ? `<span class="nav-badge">${badge}</span>` : ""}
    </button>`;
}
