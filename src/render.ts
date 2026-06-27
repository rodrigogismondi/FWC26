import { renderVisualBracket } from "./bracket";
import type { DashboardData } from "./api";
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

function renderMatchRow(m: Match, compact = false): string {
  const liveBadge =
    m.status === "live"
      ? `<span class="badge badge-live">${m.liveMinute != null ? `${m.liveMinute}'` : "LIVE"}</span>`
      : `<span class="badge badge-${m.status}">${statusLabel(m.status)}</span>`;

  const meta = compact
    ? `<span class="match-meta">${escapeHtml(m.round)}${m.group ? ` · ${escapeHtml(m.group)}` : ""}</span>`
    : `<div class="match-meta-block">
        <span class="match-round">${escapeHtml(m.round)}</span>
        ${m.group ? `<span class="match-group">${escapeHtml(m.group)}</span>` : ""}
        <span class="match-venue">${escapeHtml(m.venue)}</span>
      </div>`;

  return `
    <article class="match-card ${m.status === "live" ? "match-card-live" : ""}" data-id="${m.id}">
      ${meta}
      <div class="match-teams">
        <div class="team-row ${m.score && m.score[0] > m.score[1] ? "team-winner" : ""}">
          ${flagImg(m.flag1, m.team1)}
          <span class="team-name">${escapeHtml(m.team1)}</span>
          ${m.score ? `<span class="team-score">${m.score[0]}</span>` : ""}
        </div>
        <div class="team-row ${m.score && m.score[1] > m.score[0] ? "team-winner" : ""}">
          ${flagImg(m.flag2, m.team2)}
          <span class="team-name">${escapeHtml(m.team2)}</span>
          ${m.score ? `<span class="team-score">${m.score[1]}</span>` : ""}
        </div>
      </div>
      <div class="match-footer">
        ${liveBadge}
        <time class="match-time">${escapeHtml(m.status === "finished" ? formatScore(m) : formatKickoff(m))}</time>
      </div>
    </article>`;
}

function renderSchedule(data: DashboardData, filter: string): string {
  let matches = data.all;
  if (filter === "live") matches = matches.filter((m) => m.status === "live");
  else if (filter === "today") matches = matches.filter(isMatchToday);
  else if (filter === "upcoming") matches = matches.filter(isMatchUpcoming);
  else if (filter === "finished") matches = matches.filter((m) => m.status === "finished");

  const byDate = groupMatchesByDate(matches);

  if (matches.length === 0) {
    return `<div class="empty-state"><p>No matches in this view right now.</p></div>`;
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([date, dayMatches]) => `
      <section class="day-section">
        <h3 class="day-header">${escapeHtml(formatDateHeader(date))}</h3>
        <div class="match-grid">${dayMatches.map((m) => renderMatchRow(m)).join("")}</div>
      </section>`
    )
    .join("");
}

function renderLive(data: DashboardData): string {
  if (data.live.length === 0) {
    const next = data.upcoming[0];
    return `
      <div class="empty-state">
        <p class="empty-title">No live matches right now</p>
        ${
          next
            ? `<p class="empty-sub">Next up: <strong>${escapeHtml(next.team1)} vs ${escapeHtml(next.team2)}</strong><br/>${escapeHtml(formatKickoff(next))}</p>`
            : ""
        }
      </div>
      <section class="section-block">
        <h3>Recent results</h3>
        <div class="match-grid">${data.recent.map((m) => renderMatchRow(m, true)).join("")}</div>
      </section>`;
  }

  return `
    <div class="live-banner">
      <span class="pulse"></span>
      ${data.live.length} match${data.live.length > 1 ? "es" : ""} in progress
    </div>
    <div class="match-grid match-grid-live">${data.live.map((m) => renderMatchRow(m)).join("")}</div>
    <section class="section-block">
      <h3>Also today</h3>
      <div class="match-grid">${data.all.filter((m) => isMatchToday(m) && m.status !== "live").map((m) => renderMatchRow(m, true)).join("") || "<p class='muted'>No other matches today.</p>"}</div>
    </section>`;
}

function renderGroupTable(g: GroupTable): string {
  return `
    <div class="group-card">
      <h3 class="group-title">Group ${escapeHtml(g.name)}</h3>
      <table class="standings-table">
        <thead>
          <tr>
            <th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
          </tr>
        </thead>
        <tbody>
          ${g.teams
            .map(
              (t, i) => `
            <tr class="${i < 2 ? "qualifying" : i === 2 ? "third-place" : ""}">
              <td class="team-cell">
                ${t.flag ? `<img class="flag-sm" src="${escapeHtml(t.flag)}" alt="" width="20" height="14" />` : ""}
                ${escapeHtml(t.name)}
              </td>
              <td>${t.played}</td><td>${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td>
              <td>${t.goalsFor}</td><td>${t.goalsAgainst}</td>
              <td class="${t.goalDiff > 0 ? "positive" : t.goalDiff < 0 ? "negative" : ""}">${t.goalDiff > 0 ? "+" : ""}${t.goalDiff}</td>
              <td><strong>${t.points}</strong></td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function renderGroups(data: DashboardData): string {
  return `<div class="groups-grid">${data.groups.map(renderGroupTable).join("")}</div>`;
}

function renderBracket(data: DashboardData): string {
  return renderVisualBracket(data);
}

export interface AppState {
  view: ViewId;
  scheduleFilter: string;
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
}

export function renderApp(state: AppState): string {
  const { view, data, loading, error, scheduleFilter } = state;

  let content = "";
  if (loading && !data) {
    content = `<div class="loading"><div class="spinner"></div><p>Loading tournament data…</p></div>`;
  } else if (error && !data) {
    content = `<div class="error-state"><p>Could not load data</p><p class="muted">${escapeHtml(error)}</p><button class="btn" data-action="refresh">Try again</button></div>`;
  } else if (data) {
    switch (view) {
      case "schedule":
        content = `
          <div class="filter-bar">
            ${["all", "live", "today", "upcoming", "finished"]
              .map(
                (f) =>
                  `<button class="filter-btn ${scheduleFilter === f ? "active" : ""}" data-filter="${f}">${f.charAt(0).toUpperCase() + f.slice(1)}</button>`
              )
              .join("")}
          </div>
          ${renderSchedule(data, scheduleFilter)}`;
        break;
      case "live":
        content = renderLive(data);
        break;
      case "groups":
        content = renderGroups(data);
        break;
      case "bracket":
        content = renderBracket(data);
        break;
    }
  }

  const liveCount = data?.live.length ?? 0;
  const updated = data ? timeAgo(data.fetchedAt) : "";

  return `
    <div class="app">
      <header class="header">
        <div class="header-inner">
          <div class="brand">
            <span class="brand-icon">⚽</span>
            <div>
              <h1>World Cup 2026</h1>
              <p class="tagline">USA · Mexico · Canada</p>
            </div>
          </div>
          <div class="header-actions">
            ${updated ? `<span class="updated" title="Last refresh">Updated ${updated}</span>` : ""}
            <button class="btn btn-ghost" data-action="refresh" title="Refresh now" ${loading ? "disabled" : ""}>
              ${loading ? "…" : "↻"}
            </button>
          </div>
        </div>
        <nav class="nav">
          ${navItem("schedule", "Schedule", view)}
          ${navItem("live", "Live", view, liveCount)}
          ${navItem("groups", "Groups", view)}
          ${navItem("bracket", "Bracket", view)}
        </nav>
      </header>
      <main class="main${view === "bracket" ? " main--bracket" : ""}">${content}</main>
      <footer class="footer">
        <p>Unofficial fan dashboard · Data from <a href="https://wcup2026.org" target="_blank" rel="noopener">wcup2026.org</a> &amp; <a href="https://worldcup26.ir" target="_blank" rel="noopener">worldcup26.ir</a> · Not affiliated with FIFA</p>
      </footer>
    </div>`;
}

function navItem(id: ViewId, label: string, current: ViewId, badge?: number): string {
  return `
    <button class="nav-btn ${current === id ? "active" : ""}" data-view="${id}">
      ${label}${badge ? `<span class="nav-badge">${badge}</span>` : ""}
    </button>`;
}
