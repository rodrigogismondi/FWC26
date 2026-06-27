import { fetchDashboard, fetchMatchDetail, matchSummaryFromList } from "./api";
import { detectLang, LOCALE, saveLang, type Lang } from "./i18n";
import { renderApp, type AppState } from "./render";
import type { MatchDetailTab } from "./match-detail-types";
import type { ViewId } from "./types";
import "./style.css";

const REFRESH_MS = 60_000;
const LIVE_REFRESH_MS = 30_000;

let state: AppState = {
  view: "schedule",
  scheduleFilter: "today",
  lang: detectLang(),
  data: null,
  loading: true,
  error: null,
  selectedMatchId: null,
  matchDetail: null,
  matchDetailLoading: false,
  matchDetailTab: "events",
};

let refreshTimer: ReturnType<typeof setInterval> | null = null;

function mount(): void {
  const root = document.getElementById("app");
  if (!root) return;

  const paint = () => {
    document.documentElement.lang = LOCALE[state.lang];
    root.innerHTML = renderApp(state);
    bindEvents(root);
    if (state.view === "bracket") centerBracketScroll(root);
  };

  const loadMatchDetail = async (id: number, silent = false) => {
    if (!silent) {
      state = { ...state, matchDetailLoading: true, matchDetail: null };
      paint();
    }
    try {
      const detail = await fetchMatchDetail(id);
      const fallback = state.data?.all.find((m) => m.id === id);
      state = {
        ...state,
        matchDetail: detail ?? (fallback ? matchSummaryFromList(fallback) : null),
        matchDetailLoading: false,
      };
    } catch {
      const fallback = state.data?.all.find((m) => m.id === id);
      state = {
        ...state,
        matchDetail: fallback ? matchSummaryFromList(fallback) : null,
        matchDetailLoading: false,
      };
    }
    paint();
  };

  const openMatch = (id: number) => {
    state = {
      ...state,
      selectedMatchId: id,
      matchDetailTab: "events",
      matchDetail: null,
      matchDetailLoading: true,
    };
    paint();
    loadMatchDetail(id);
  };

  const closeMatch = () => {
    state = {
      ...state,
      selectedMatchId: null,
      matchDetail: null,
      matchDetailLoading: false,
    };
    paint();
  };

  const load = async (silent = false) => {
    if (!silent) state = { ...state, loading: true, error: null };
    else state = { ...state, loading: true };
    paint();

    try {
      const data = await fetchDashboard();
      state = { ...state, data, loading: false, error: null };
      scheduleRefresh(data.live.length > 0);
      if (state.selectedMatchId) {
        await loadMatchDetail(state.selectedMatchId, true);
      }
    } catch (err) {
      state = {
        ...state,
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
    paint();
  };

  const scheduleRefresh = (hasLive: boolean) => {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => load(true), hasLive ? LIVE_REFRESH_MS : REFRESH_MS);
  };

  const bindEvents = (root: HTMLElement) => {
    root.querySelectorAll("[data-view]").forEach((el) => {
      el.addEventListener("click", () => {
        state = { ...state, view: (el as HTMLElement).dataset.view as ViewId };
        paint();
      });
    });

    root.querySelectorAll("[data-filter]").forEach((el) => {
      el.addEventListener("click", () => {
        state = { ...state, scheduleFilter: (el as HTMLElement).dataset.filter! };
        paint();
      });
    });

    root.querySelectorAll('[data-action="refresh"]').forEach((el) => {
      el.addEventListener("click", () => load());
    });

    root.querySelectorAll("[data-lang]").forEach((el) => {
      el.addEventListener("click", () => {
        const lang = (el as HTMLElement).dataset.lang as Lang;
        if (lang === state.lang) return;
        state = { ...state, lang };
        saveLang(lang);
        paint();
      });
    });

    root.querySelectorAll('[data-action="open-match"]').forEach((el) => {
      el.addEventListener("click", () => {
        const id = Number((el as HTMLElement).dataset.matchId);
        if (id) openMatch(id);
      });
      el.addEventListener("keydown", (e) => {
        const key = (e as KeyboardEvent).key;
        if (key === "Enter" || key === " ") {
          e.preventDefault();
          const id = Number((el as HTMLElement).dataset.matchId);
          if (id) openMatch(id);
        }
      });
    });

    root.querySelectorAll('[data-action="close-match"]').forEach((el) => {
      el.addEventListener("click", () => closeMatch());
    });

    root.querySelectorAll('[data-action="md-tab"]').forEach((el) => {
      el.addEventListener("click", () => {
        const tab = (el as HTMLElement).dataset.mdTab as MatchDetailTab;
        if (tab) state = { ...state, matchDetailTab: tab };
        paint();
      });
    });
  };

  load();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") load(true);
  });
}

mount();

function centerBracketScroll(root: HTMLElement): void {
  requestAnimationFrame(() => {
    const el = root.querySelector<HTMLElement>(".bk-scroll");
    if (!el) return;
    const overflow = el.scrollWidth - el.clientWidth;
    if (overflow > 0) el.scrollLeft = overflow / 2;
  });
}
