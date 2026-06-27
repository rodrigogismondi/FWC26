import type { Match } from "./types";

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

export function formatKickoff(match: Match): string {
  const d = new Date(match.datetime * 1000);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateHeader(localKey: string): string {
  const [y, mo, d] = localKey.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatScore(match: Match): string {
  if (!match.score) return "–";
  return `${match.score[0]} – ${match.score[1]}`;
}

export function statusLabel(status: Match["status"]): string {
  switch (status) {
    case "live":
      return "LIVE";
    case "finished":
      return "FT";
    case "upcoming":
      return "Upcoming";
    default:
      return "Scheduled";
  }
}

export function groupMatchesByDate(matches: Match[]): Map<string, Match[]> {
  const map = new Map<string, Match[]>();
  for (const m of matches) {
    const key = localDateKey(m.datetime);
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.datetime - b.datetime);
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

export function timeAgo(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}
