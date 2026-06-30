import { decidedByPenalties } from "./match-outcome";
import type { Match } from "./types";
import type { Lang } from "./i18n";
import { LOCALE, t } from "./i18n";

/** Calendar date (YYYY-MM-DD) in the user's local timezone. */
export function localDateKey(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export function todayLocalKey(): string {
  return localDateKey(Math.floor(Date.now() / 1000));
}

export function isMatchToday(m: Match): boolean {
  return localDateKey(m.datetime) === todayLocalKey();
}

export function isMatchUpcoming(m: Match): boolean {
  if (m.status === "finished" || m.status === "live") return false;
  return m.datetime * 1000 > Date.now();
}

export function formatKickoff(match: Match, lang: Lang): string {
  const d = new Date(match.datetime * 1000);
  const formatted = d.toLocaleString(LOCALE[lang], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return capitalizeLocale(formatted, lang);
}

export function formatDateHeader(localKey: string, lang: Lang): string {
  const [y, mo, d] = localKey.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  const formatted = date.toLocaleDateString(LOCALE[lang], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return capitalizeLocale(formatted, lang);
}

/** pt-BR locale lowercases weekdays; capitalize to match en-US style. */
function capitalizeLocale(text: string, lang: Lang): string {
  if (lang !== "pt" || !text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatScore(match: Match, lang?: Lang): string {
  if (!match.score) return "–";
  const base = `${match.score[0]} – ${match.score[1]}`;
  if (!lang || !decidedByPenalties(match) || !match.penScore) return base;
  return `${base} (${match.penScore[0]}–${match.penScore[1]} ${t(lang, "penShort")})`;
}

export function statusLabel(status: Match["status"], lang: Lang): string {
  switch (status) {
    case "live":
      return t(lang, "statusLive");
    case "finished":
      return t(lang, "statusFinished");
    case "upcoming":
      return t(lang, "statusUpcoming");
    default:
      return t(lang, "statusScheduled");
  }
}

export function groupMatchesByDate(matches: Match[], descending = false): Map<string, Match[]> {
  const map = new Map<string, Match[]>();
  for (const m of matches) {
    const key = localDateKey(m.datetime);
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (descending ? b.datetime - a.datetime : a.datetime - b.datetime));
  }
  return map;
}

export function groupMatchesByRound(matches: Match[]): Map<string, Match[]> {
  const map = new Map<string, Match[]>();
  for (const m of matches) {
    const list = map.get(m.round) ?? [];
    list.push(m);
    map.set(m.round, list);
  }
  return map;
}

export function teamInitials(name: string): string {
  if (name.length <= 3 && /^[\dA-L\/]+/.test(name)) return name;
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function timeAgo(date: Date, lang: Lang): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 10) return t(lang, "timeJustNow");
  if (sec < 60) return t(lang, "timeSeconds", { n: sec });
  const min = Math.floor(sec / 60);
  if (min < 60) return t(lang, "timeMinutes", { n: min });
  return t(lang, "timeHours", { n: Math.floor(min / 60) });
}
