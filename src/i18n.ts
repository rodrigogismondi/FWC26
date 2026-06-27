export type Lang = "en" | "pt";

const STORAGE_KEY = "fwc26-lang";

export const LOCALE: Record<Lang, string> = {
  en: "en-US",
  pt: "pt-BR",
};

export const FLAG_BR = "https://flagcdn.com/w40/br.png";
export const FLAG_US = "https://flagcdn.com/w40/us.png";

const strings = {
  en: {
    title: "World Cup 2026",
    tagline: "USA · Mexico · Canada",
    navSchedule: "Schedule",
    navLive: "Live",
    navGroups: "Groups",
    navBracket: "Bracket",
    filterAll: "All",
    filterLive: "Live",
    filterToday: "Today",
    filterUpcoming: "Upcoming",
    filterFinished: "Finished",
    statusLive: "LIVE",
    statusFinished: "FT",
    statusUpcoming: "Upcoming",
    statusScheduled: "Scheduled",
    loading: "Loading tournament data…",
    errorTitle: "Could not load data",
    tryAgain: "Try again",
    noMatches: "No matches in this view right now.",
    noLiveTitle: "No live matches right now",
    nextUp: "Next up",
    recentResults: "Recent results",
    matchesInProgress: "{n} match in progress",
    matchesInProgressPlural: "{n} matches in progress",
    alsoToday: "Also today",
    noOtherToday: "No other matches today.",
    group: "Group",
    colTeam: "Team",
    colPlayed: "P",
    colWon: "W",
    colDrawn: "D",
    colLost: "L",
    colGF: "GF",
    colGA: "GA",
    colGD: "GD",
    colPts: "Pts",
    updated: "Updated {time}",
    lastRefresh: "Last refresh",
    refreshNow: "Refresh now",
    footer:
      "Unofficial fan dashboard · Data from {wcup} & {wc26} · Not affiliated with FIFA",
    language: "Language",
    langPt: "Português (Brasil)",
    langEn: "English (US)",
    knockoutStage: "Knockout stage",
    r32Progress: "Round of 32 · {n}/16 played",
    teamsConfirmed: "{n}/32 teams confirmed",
    bracketNote:
      "Follow the path from the edges to the center. Maroon slots are TBD — they fill in as the group stage completes and winners advance.",
    bracketEmpty: "Knockout bracket data not available yet.",
    groupStageRef: "Group stage reference",
    thirdPlace: "3rd place",
    final: "Final",
    timeJustNow: "just now",
    timeSeconds: "{n}s ago",
    timeMinutes: "{n}m ago",
    timeHours: "{n}h ago",
    roundR32: "Round of 32",
    roundR16: "Round of 16",
    roundQF: "Quarter-finals",
    roundSF: "Semi-finals",
    roundFinal: "Final",
    roundThird: "Third place",
    roundMatchday: "Matchday {n}",
    roundGroup: "Group {name}",
    winner: "Winner {n}",
    loser: "Loser {n}",
    thirdSlot: "3rd ({groups})",
  },
  pt: {
    title: "Copa do Mundo 2026",
    tagline: "EUA · México · Canadá",
    navSchedule: "Jogos",
    navLive: "Ao vivo",
    navGroups: "Grupos",
    navBracket: "Chave",
    filterAll: "Todos",
    filterLive: "Ao vivo",
    filterToday: "Hoje",
    filterUpcoming: "Próximos",
    filterFinished: "Encerrados",
    statusLive: "AO VIVO",
    statusFinished: "FIM",
    statusUpcoming: "Próximo",
    statusScheduled: "Agendado",
    loading: "Carregando dados do torneio…",
    errorTitle: "Não foi possível carregar os dados",
    tryAgain: "Tentar novamente",
    noMatches: "Nenhum jogo nesta visualização no momento.",
    noLiveTitle: "Nenhum jogo ao vivo no momento",
    nextUp: "Próximo jogo",
    recentResults: "Resultados recentes",
    matchesInProgress: "{n} jogo em andamento",
    matchesInProgressPlural: "{n} jogos em andamento",
    alsoToday: "Também hoje",
    noOtherToday: "Nenhum outro jogo hoje.",
    group: "Grupo",
    colTeam: "Seleção",
    colPlayed: "J",
    colWon: "V",
    colDrawn: "E",
    colLost: "D",
    colGF: "GP",
    colGA: "GC",
    colGD: "SG",
    colPts: "Pts",
    updated: "Atualizado {time}",
    lastRefresh: "Última atualização",
    refreshNow: "Atualizar agora",
    footer:
      "Painel não oficial · Dados de {wcup} e {wc26} · Sem vínculo com a FIFA",
    language: "Idioma",
    langPt: "Português (Brasil)",
    langEn: "English (US)",
    knockoutStage: "Fase eliminatória",
    r32Progress: "32 avos · {n}/16 disputados",
    teamsConfirmed: "{n}/32 seleções confirmadas",
    bracketNote:
      "Siga o caminho das bordas ao centro. Vagas em vermelho são TBD — preenchidas conforme a fase de grupos avança e os vencedores avançam.",
    bracketEmpty: "Chave eliminatória ainda não disponível.",
    groupStageRef: "Referência da fase de grupos",
    thirdPlace: "3º lugar",
    final: "Final",
    timeJustNow: "agora",
    timeSeconds: "há {n}s",
    timeMinutes: "há {n} min",
    timeHours: "há {n} h",
    roundR32: "32 avos de final",
    roundR16: "Oitavas de final",
    roundQF: "Quartas de final",
    roundSF: "Semifinais",
    roundFinal: "Final",
    roundThird: "Disputa de 3º lugar",
    roundMatchday: "Rodada {n}",
    roundGroup: "Grupo {name}",
    winner: "Vencedor {n}",
    loser: "Perdedor {n}",
    thirdSlot: "3º ({groups})",
  },
} as const;

export type I18nKey = keyof (typeof strings)["en"];

export function detectLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "pt") return stored;
  const nav = navigator.language.toLowerCase();
  return nav.startsWith("pt") ? "pt" : "en";
}

export function saveLang(lang: Lang): void {
  localStorage.setItem(STORAGE_KEY, lang);
}

export function t(lang: Lang, key: I18nKey, vars?: Record<string, string | number>): string {
  let text: string = strings[lang][key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

export function translateRound(lang: Lang, round: string): string {
  if (round === "Round of 32") return t(lang, "roundR32");
  if (round === "Round of 16") return t(lang, "roundR16");
  if (round.startsWith("Quarter-final")) return t(lang, "roundQF");
  if (round.startsWith("Semi-final")) return t(lang, "roundSF");
  if (round === "Final") return t(lang, "roundFinal");
  if (round.startsWith("Match for third") || round === "Third place") return t(lang, "roundThird");

  const md = round.match(/^Matchday (\d+)$/);
  if (md) return t(lang, "roundMatchday", { n: md[1] });

  return round;
}

export function translateGroup(lang: Lang, group: string): string {
  const m = group.match(/^Group ([A-L])$/i);
  if (m) return t(lang, "roundGroup", { name: m[1] });
  return group;
}

export function filterLabel(lang: Lang, filter: string): string {
  const map: Record<string, I18nKey> = {
    all: "filterAll",
    live: "filterLive",
    today: "filterToday",
    upcoming: "filterUpcoming",
    finished: "filterFinished",
  };
  return t(lang, map[filter] ?? "filterAll");
}

export function navLabel(lang: Lang, view: string): string {
  const map: Record<string, I18nKey> = {
    schedule: "navSchedule",
    live: "navLive",
    groups: "navGroups",
    bracket: "navBracket",
  };
  return t(lang, map[view] ?? "navSchedule");
}