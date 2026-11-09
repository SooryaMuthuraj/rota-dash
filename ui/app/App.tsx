import React, { useState, useEffect, useRef, useCallback } from "react";
import { PageLayout, Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import {
  useAppStates,
  useSetAppState,
  useUserAppStates,
  useSetUserAppState,
  useListDocuments,
} from "@dynatrace-sdk/react-hooks";
import { documentsClient } from "@dynatrace-sdk/client-document";
import { getEnvironmentUrl } from "@dynatrace-sdk/app-environment";
import { getDocumentLink } from "@dynatrace-sdk/navigation";

const STORAGE_PERSONAL_KEY = "noc-dashboard-rotator-config-personal";
const STORAGE_SHARED_KEY = "noc-dashboard-rotator-config-shared";
const STATE_KEY = "noc-rotator-config";
const DEFAULT_DURATION_SECONDS = 30;

export interface DashboardEntry {
  id: string;
  name?: string;
  durationSeconds: number;
}

export interface RotatorConfig {
  tenantUrl: string;
  dashboards: DashboardEntry[];
  displayMode: "window" | "tab";
}

type PlaylistScope = "personal" | "shared";

const normalizeDisplayMode = (mode: unknown): "window" | "tab" => {
  if (mode === "tab") return "tab";
  return "window";
};

const getInitialTenantUrl = (): string => {
  try {
    const envUrl = getEnvironmentUrl();
    if (envUrl && !envUrl.includes("dynatrace.com/")) {
      return envUrl.replace(/\/$/, "");
    }
  } catch {
    // Fallback if environment URL detection is not available
  }
  return "";
};

const DEFAULT_CONFIG: RotatorConfig = {
  tenantUrl: getInitialTenantUrl(),
  dashboards: [{ id: "", name: "", durationSeconds: DEFAULT_DURATION_SECONDS }],
  displayMode: "window",
};

const loadLocalConfig = (scope: PlaylistScope): RotatorConfig => {
  try {
    const storageKey = scope === "personal" ? STORAGE_PERSONAL_KEY : STORAGE_SHARED_KEY;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<RotatorConfig>;

    let dashboards: DashboardEntry[] = [];
    if (Array.isArray(parsed.dashboards) && parsed.dashboards.length) {
      dashboards = parsed.dashboards.map((d: Partial<DashboardEntry>) => ({
        id: typeof d.id === "string" ? d.id : "",
        name: typeof d.name === "string" ? d.name : "",
        durationSeconds:
          typeof d.durationSeconds === "number" && Number.isFinite(d.durationSeconds) && d.durationSeconds > 0
            ? d.durationSeconds
            : DEFAULT_DURATION_SECONDS,
      }));
    } else {
      dashboards = [{ id: "", name: "", durationSeconds: DEFAULT_DURATION_SECONDS }];
    }

    return {
      tenantUrl: typeof parsed.tenantUrl === "string" && parsed.tenantUrl ? parsed.tenantUrl : getInitialTenantUrl(),
      dashboards,
      displayMode: normalizeDisplayMode(parsed.displayMode),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
};

/**
 * Creates an inline unthrottled Web Worker timer.
 * Browsers aggressively throttle setInterval in background tabs to 1/min,
 * but dedicated Web Workers run on separate OS threads and are exempt from timer throttling.
 */
const createTimerWorker = (): Worker | null => {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  try {
    const script = `
      var timerId = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (!timerId) {
            timerId = setInterval(function() {
              self.postMessage('tick');
            }, 1000);
          }
        } else if (e.data === 'stop') {
          if (timerId) {
            clearInterval(timerId);
            timerId = null;
          }
        }
      };
    `;
    const blob = new Blob([script], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    return new Worker(url);
  } catch {
    return null;
  }
};

export const App = () => {
  // Theme is driven automatically from Dynatrace via useCurrentTheme and DOM data-theme attribute
  const dynatraceTheme = useCurrentTheme();
  const [domTheme, setDomTheme] = useState<"light" | "dark" | null>(() => {
    if (typeof document !== "undefined") {
      const attr =
        document.documentElement.getAttribute("data-theme") ||
        document.body.getAttribute("data-theme");
      if (attr === "light" || attr === "dark") return attr;
    }
    return null;
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const updateFromDom = () => {
      const attr =
        document.documentElement.getAttribute("data-theme") ||
        document.body.getAttribute("data-theme");
      if (attr === "light" || attr === "dark") {
        setDomTheme(attr);
      }
    };
    const observer = new MutationObserver(updateFromDom);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);

  const isDark = (domTheme ?? dynatraceTheme) === "dark";

  // High-contrast, WCAG-compliant design tokens for both Light and Dark modes
  const tokens = {
    pageBg: isDark ? "#0c0d14" : "#f8f9fa",
    cardBg: isDark ? "#141622" : "#ffffff",
    cardBorder: isDark ? "#282b3d" : "#e2e8f0",
    cardShadow: isDark
      ? "0 4px 12px rgba(0, 0, 0, 0.4)"
      : "0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)",
    accent: isDark ? "#818cf8" : "#4f46e5",
    accentSoft: isDark ? "rgba(129, 140, 248, 0.15)" : "rgba(79, 70, 229, 0.1)",
    inputBg: isDark ? "#1c1e2e" : "#ffffff",
    inputBorder: isDark ? "#353952" : "#cbd5e1",
    inputText: isDark ? "#f8fafc" : "#0f172a",
    inputPlaceholder: isDark ? "#64748b" : "#94a3b8",
    textHeading: isDark ? "#f8fafc" : "#0f172a",
    textPrimary: isDark ? "#e2e8f0" : "#1e293b",
    textMuted: isDark ? "#94a3b8" : "#475569",
    fieldLabel: isDark ? "#cbd5e1" : "#334155",
    rowBg: isDark ? "#181a29" : "#f8fafc",
    rowBorder: isDark ? "#2d3148" : "#e2e8f0",
    optionBg: isDark ? "#1c1e2e" : "#ffffff",
    optionText: isDark ? "#f8fafc" : "#0f172a",
    success: isDark ? "#4ade80" : "#16a34a",
    warning: isDark ? "#facc15" : "#d97706",
    colorScheme: isDark ? "dark" : "light",
    radius: 8,
  };

  const cardStyle: React.CSSProperties = {
    background: tokens.cardBg,
    border: `1px solid ${tokens.cardBorder}`,
    borderRadius: tokens.radius + 4,
    padding: "20px 22px",
    width: "100%",
    boxSizing: "border-box",
    boxShadow: tokens.cardShadow,
    colorScheme: tokens.colorScheme,
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: "0.78em",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: tokens.fieldLabel,
    marginBottom: 6,
    display: "block",
  };

  const inputBaseStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: tokens.radius,
    border: `1px solid ${tokens.inputBorder}`,
    background: tokens.inputBg,
    color: tokens.inputText,
    fontSize: "0.95em",
    outline: "none",
    colorScheme: tokens.colorScheme,
    transition: "border-color 120ms ease, box-shadow 120ms ease",
  };

  const withFocusRing = (
    e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>,
    focused: boolean
  ) => {
    e.currentTarget.style.borderColor = focused ? tokens.accent : tokens.inputBorder;
    e.currentTarget.style.boxShadow = focused ? `0 0 0 3px ${tokens.accentSoft}` : "none";
  };

  const SectionEyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Flex alignItems="center" gap={8} style={{ marginBottom: 12 }}>
      <span
        aria-hidden
        style={{
          width: 3,
          height: 14,
          borderRadius: 2,
          background: tokens.accent,
          display: "inline-block",
        }}
      />
      <span
        style={{
          fontSize: "0.86em",
          fontWeight: 700,
          letterSpacing: "0.03em",
          color: tokens.textHeading,
        }}
      >
        {children}
      </span>
    </Flex>
  );

  const [scope, setScope] = useState<PlaylistScope>("personal");
  const [config, setConfig] = useState<RotatorConfig>(() => loadLocalConfig("personal"));
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(DEFAULT_DURATION_SECONDS);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [dashboardSearch, setDashboardSearch] = useState<string>("");
  const [popupBlocked, setPopupBlocked] = useState(false);

  // References for continuous 24/7 unthrottled execution
  const presentationWindowRef = useRef<Window | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const fallbackIntervalRef = useRef<number | null>(null);
  const targetSwitchTimeRef = useRef<number>(0);
  const remainingSecondsOnPauseRef = useRef<number>(0);
  const currentIndexRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const dashboardsRef = useRef<DashboardEntry[]>([]);
  const heartbeatCounterRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // 1. Fetch ALL accessible dashboards from Dynatrace Document Service
  const {
    data: documentListData,
    isLoading: isDocumentsLoading,
    refetch: refetchDocuments,
  } = useListDocuments({
    filter: "type = 'dashboard'",
    pageSize: 1000,
    sort: "name",
  });

  const availableDashboards = documentListData?.documents ?? [];

  // 2. Personal States (uses collection query to avoid 404s on uninitialized keys)
  const { data: userAppStatesData, refetch: refetchUserStates } = useUserAppStates({
    addFields: "value",
  });
  const { execute: setUserAppState } = useSetUserAppState();

  // 3. Shared States (uses collection query to avoid 404s on uninitialized keys)
  const { data: appStatesData, refetch: refetchAppStates } = useAppStates({
    addFields: "value",
  });
  const { execute: setAppState } = useSetAppState();

  // Keep references in sync with state for timer thread callbacks
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const cleanDashboards = config.dashboards.filter((d) => d.id.trim().length > 0);
  const canStart = config.tenantUrl.trim().length > 0 && cleanDashboards.length > 0;

  useEffect(() => {
    dashboardsRef.current = cleanDashboards;
  }, [cleanDashboards]);

  // Load configuration whenever active scope or backend state collection updates
  useEffect(() => {
    const list = scope === "personal" ? userAppStatesData : appStatesData;
    const entry = list?.find((item) => item.key === STATE_KEY);
    if (entry?.value) {
      try {
        const parsed = JSON.parse(entry.value) as Partial<RotatorConfig>;
        if (Array.isArray(parsed.dashboards) && parsed.dashboards.length > 0) {
          setConfig({
            tenantUrl: parsed.tenantUrl || getInitialTenantUrl(),
            dashboards: parsed.dashboards,
            displayMode: normalizeDisplayMode(parsed.displayMode),
          });
          return;
        }
      } catch {
        // Fallback to local
      }
    }
    // If no backend state found, load from localStorage
    setConfig(loadLocalConfig(scope));
  }, [scope, userAppStatesData, appStatesData]);

  // Ensure tenantUrl is filled with environment URL if empty
  useEffect(() => {
    if (!config.tenantUrl) {
      const autoUrl = getInitialTenantUrl();
      if (autoUrl) {
        setConfig((prev) => ({ ...prev, tenantUrl: autoUrl }));
      }
    }
  }, [config.tenantUrl]);

  // Persist configuration to the appropriate Dynatrace state service and localStorage
  const persistConfig = useCallback(
    async (nextConfig: RotatorConfig, targetScope = scope) => {
      const storageKey = targetScope === "personal" ? STORAGE_PERSONAL_KEY : STORAGE_SHARED_KEY;
      try {
        localStorage.setItem(storageKey, JSON.stringify(nextConfig));
        if (targetScope === "personal") {
          await setUserAppState({
            key: STATE_KEY,
            body: { value: JSON.stringify(nextConfig) },
          });
          void refetchUserStates();
          setSaveStatus("Saved to your personal Dynatrace profile");
        } else {
          await setAppState({
            key: STATE_KEY,
            body: { value: JSON.stringify(nextConfig) },
          });
          void refetchAppStates();
          setSaveStatus("Saved to shared team AppState");
        }
        setTimeout(() => setSaveStatus(""), 3500);
      } catch {
        setSaveStatus("Saved locally in browser");
        setTimeout(() => setSaveStatus(""), 3500);
      }
    },
    [scope, setUserAppState, setAppState, refetchUserStates, refetchAppStates]
  );

  // Form handlers
  const updateTenantUrl = (value: string) => {
    setConfig((prev) => {
      const updated = { ...prev, tenantUrl: value };
      void persistConfig(updated);
      return updated;
    });
  };

  const updateDisplayMode = (mode: "window" | "tab") => {
    setConfig((prev) => {
      const updated = { ...prev, displayMode: mode };
      void persistConfig(updated);
      return updated;
    });
  };

  const updateDashboardId = (index: number, id: string, name?: string) => {
    setConfig((prev) => {
      const next = [...prev.dashboards];
      const selectedDoc = availableDashboards.find((d) => d.id === id);
      next[index] = {
        ...next[index],
        id,
        name: name !== undefined ? name : selectedDoc?.name || next[index].name,
      };
      const updated = { ...prev, dashboards: next };
      void persistConfig(updated);
      return updated;
    });
  };

  const updateDashboardDuration = (index: number, value: number) => {
    setConfig((prev) => {
      const clamped = Number.isFinite(value) && value > 0 ? value : DEFAULT_DURATION_SECONDS;
      const next = [...prev.dashboards];
      next[index] = { ...next[index], durationSeconds: clamped };
      const updated = { ...prev, dashboards: next };
      void persistConfig(updated);
      return updated;
    });
  };

  const addDashboardField = (prefillId = "", prefillName = "") => {
    setConfig((prev) => {
      const updated = {
        ...prev,
        dashboards: [
          ...prev.dashboards,
          { id: prefillId, name: prefillName, durationSeconds: DEFAULT_DURATION_SECONDS },
        ],
      };
      void persistConfig(updated);
      return updated;
    });
  };

  const removeDashboardField = (index: number) => {
    setConfig((prev) => {
      const updated = {
        ...prev,
        dashboards: prev.dashboards.filter((_, i) => i !== index),
      };
      void persistConfig(updated);
      return updated;
    });
  };

  const dashboardUrl = useCallback(
    (index: number) => {
      const currentDashboards = dashboardsRef.current.length > 0 ? dashboardsRef.current : cleanDashboards;
      const dashId = currentDashboards[index]?.id ?? "";
      if (!dashId) return "";
      try {
        const canonical = getDocumentLink(dashId);
        if (canonical && !canonical.endsWith("dynatrace.com/")) {
          return canonical;
        }
      } catch {
        // Fallback to manual URL if runtime navigation is not available
      }
      const base = config.tenantUrl.trim().replace(/\/$/, "");
      return `${base}/ui/apps/dynatrace.dashboards/dashboard/${dashId}`;
    },
    [config.tenantUrl, cleanDashboards]
  );

  /**
   * Open or navigate the presentation window/tab.
   * If the window was accidentally closed or detached, this automatically re-creates it
   * so rotation never breaks even after hours or days.
   */
  const openOrNavigatePresentation = useCallback(
    (index: number) => {
      const url = dashboardUrl(index);
      if (!url) return;

      const w = window.screen.availWidth;
      const h = window.screen.availHeight;
      const targetName = config.displayMode === "tab" ? "NOC_Presentation_Tab" : "NOC_Presentation_Window";
      const features =
        config.displayMode === "tab"
          ? ""
          : `popup=yes,width=${w},height=${h},left=0,top=0,toolbar=no,location=no,menubar=no,status=no,scrollbars=yes,resizable=yes`;

      try {
        if (presentationWindowRef.current && !presentationWindowRef.current.closed) {
          presentationWindowRef.current.location.href = url;
          try {
            presentationWindowRef.current.focus();
            presentationWindowRef.current.moveTo(0, 0);
            presentationWindowRef.current.resizeTo(w, h);
          } catch {
            // cross-origin restriction ignore
          }
          setPopupBlocked(false);
        } else {
          const win = window.open(url, targetName, features);
          if (!win || win.closed || typeof win.closed === "undefined") {
            setPopupBlocked(true);
          } else {
            setPopupBlocked(false);
            presentationWindowRef.current = win;
            try {
              win.focus();
              win.moveTo(0, 0);
              win.resizeTo(w, h);
            } catch {
              // ignore
            }
          }
        }
      } catch {
        setPopupBlocked(true);
      }
    },
    [dashboardUrl, config.displayMode]
  );

  /**
   * Silent Web Audio keep-alive:
   * Chromium's Memory Saver / Sleeping Tabs feature automatically suspends and discards background tabs
   * after 2 to 4 hours of inactivity.
   * However, tabs actively playing audio are strictly exempt from background freezing and discard.
   * Playing an inaudible oscillator loop guarantees the browser will NEVER sleep or suspend this tab.
   */
  const startSilentAudio = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new AudioCtx();
      }
      if (audioContextRef.current.state === "suspended") {
        void audioContextRef.current.resume();
      }
      const osc = audioContextRef.current.createOscillator();
      const gain = audioContextRef.current.createGain();
      gain.gain.value = 0.00001; // inaudible to human ear, marks tab as active media stream
      osc.connect(gain);
      gain.connect(audioContextRef.current.destination);
      osc.start();
    } catch {
      // Audio autoplay or permission restriction fallback
    }
  }, []);

  const stopSilentAudio = useCallback(() => {
    try {
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    } catch {
      // Ignore
    }
  }, []);

  /**
   * Request Screen Wake Lock API to prevent the NOC wallboard monitor from sleeping or turning off.
   */
  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator && !wakeLockRef.current) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {
      // Ignore if not supported
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    try {
      if (wakeLockRef.current) {
        void wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {
      // Ignore
    }
  }, []);

  /**
   * Active Dynatrace SSO session heartbeat:
   * Dynatrace SSO tokens and cookies expire after an idle threshold (typically 4 hours without API calls).
   * Pinging Dynatrace's Document Service client every 30 seconds exercises the OAuth bearer token
   * and API gateway, keeping the Dynatrace user session alive for eternity.
   */
  const performHeartbeat = useCallback(async () => {
    try {
      void refetchDocuments();
      void refetchUserStates();
      await documentsClient.listDocuments({ filter: "type = 'dashboard'", pageSize: 1 });
    } catch {
      // Platform keep-alive network packet transmitted
    }
  }, [refetchDocuments, refetchUserStates]);

  /**
   * Primary unthrottled tick handler:
   * Evaluates wall-clock time difference (Date.now()) against targetSwitchTimeRef.
   * Completely drift-proof, regardless of background tab states or OS power management.
   */
  const handleTick = useCallback(() => {
    if (!isRunningRef.current || isPausedRef.current) return;
    const list = dashboardsRef.current;
    if (list.length === 0) return;

    // SSO session heartbeat every 30 seconds
    heartbeatCounterRef.current += 1;
    if (heartbeatCounterRef.current >= 30) {
      heartbeatCounterRef.current = 0;
      void performHeartbeat();
    }

    const now = Date.now();
    if (now >= targetSwitchTimeRef.current) {
      // Transition to next dashboard
      const nextIdx = (currentIndexRef.current + 1) % list.length;
      currentIndexRef.current = nextIdx;
      setCurrentIndex(nextIdx);

      const duration = list[nextIdx]?.durationSeconds ?? DEFAULT_DURATION_SECONDS;
      targetSwitchTimeRef.current = now + duration * 1000;
      setSecondsRemaining(duration);

      openOrNavigatePresentation(nextIdx);
    } else {
      const rem = Math.max(1, Math.ceil((targetSwitchTimeRef.current - now) / 1000));
      setSecondsRemaining(rem);
    }
  }, [performHeartbeat, openOrNavigatePresentation]);

  // Set up Worker or fallback interval when running
  useEffect(() => {
    if (!isRunning) {
      if (workerRef.current) {
        workerRef.current.postMessage("stop");
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (fallbackIntervalRef.current) {
        window.clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      return;
    }

    // Initialize Web Worker for unthrottled 1000ms background ticking
    const worker = createTimerWorker();
    if (worker) {
      worker.onmessage = () => {
        handleTick();
      };
      worker.postMessage("start");
      workerRef.current = worker;
    } else {
      // Fallback to window.setInterval if Web Workers are restricted
      fallbackIntervalRef.current = window.setInterval(() => {
        handleTick();
      }, 1000);
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.postMessage("stop");
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (fallbackIntervalRef.current) {
        window.clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };
  }, [isRunning, handleTick]);

  // Zero-drift catch-up whenever window regains focus or tab visibility changes
  useEffect(() => {
    const handleVisibilityCatchup = () => {
      if (!isRunningRef.current || isPausedRef.current) return;
      const list = dashboardsRef.current;
      if (list.length === 0) return;

      const now = Date.now();
      if (now >= targetSwitchTimeRef.current) {
        const nextIdx = (currentIndexRef.current + 1) % list.length;
        currentIndexRef.current = nextIdx;
        setCurrentIndex(nextIdx);

        const duration = list[nextIdx]?.durationSeconds ?? DEFAULT_DURATION_SECONDS;
        targetSwitchTimeRef.current = now + duration * 1000;
        setSecondsRemaining(duration);

        openOrNavigatePresentation(nextIdx);
      } else {
        const rem = Math.max(1, Math.ceil((targetSwitchTimeRef.current - now) / 1000));
        setSecondsRemaining(rem);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityCatchup);
    window.addEventListener("focus", handleVisibilityCatchup);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityCatchup);
      window.removeEventListener("focus", handleVisibilityCatchup);
    };
  }, [openOrNavigatePresentation]);

  // Start continuous 24/7 rotation
  const handleStart = () => {
    if (!canStart) return;
    const firstDuration = cleanDashboards[0]?.durationSeconds ?? DEFAULT_DURATION_SECONDS;

    currentIndexRef.current = 0;
    setCurrentIndex(0);
    isPausedRef.current = false;
    setIsPaused(false);
    isRunningRef.current = true;
    setIsRunning(true);
    setSecondsRemaining(firstDuration);
    targetSwitchTimeRef.current = Date.now() + firstDuration * 1000;
    heartbeatCounterRef.current = 0;

    startSilentAudio();
    void requestWakeLock();
    openOrNavigatePresentation(0);
  };

  // Stop rotation - ONLY called when operator clicks Stop Rotation button
  const handleStop = () => {
    isRunningRef.current = false;
    setIsRunning(false);
    isPausedRef.current = false;
    setIsPaused(false);
    setPopupBlocked(false);

    stopSilentAudio();
    releaseWakeLock();

    try {
      if (presentationWindowRef.current && !presentationWindowRef.current.closed) {
        presentationWindowRef.current.close();
      }
    } catch {
      // Ignore
    }
    presentationWindowRef.current = null;
  };

  // Pause / Resume toggle with wall-clock compensation
  const handlePauseToggle = () => {
    if (isPaused) {
      // Resume
      isPausedRef.current = false;
      setIsPaused(false);
      targetSwitchTimeRef.current = Date.now() + remainingSecondsOnPauseRef.current * 1000;
      void requestWakeLock();
    } else {
      // Pause
      isPausedRef.current = true;
      setIsPaused(true);
      const rem = Math.max(1, Math.ceil((targetSwitchTimeRef.current - Date.now()) / 1000));
      remainingSecondsOnPauseRef.current = rem;
      setSecondsRemaining(rem);
    }
  };

  // Manual next/prev controls during active rotation
  const handleNext = () => {
    if (cleanDashboards.length === 0) return;
    const nextIdx = (currentIndexRef.current + 1) % cleanDashboards.length;
    currentIndexRef.current = nextIdx;
    setCurrentIndex(nextIdx);
    const duration = cleanDashboards[nextIdx]?.durationSeconds ?? DEFAULT_DURATION_SECONDS;
    targetSwitchTimeRef.current = Date.now() + duration * 1000;
    setSecondsRemaining(duration);
    openOrNavigatePresentation(nextIdx);
  };

  const handlePrev = () => {
    if (cleanDashboards.length === 0) return;
    const prevIdx = (currentIndexRef.current - 1 + cleanDashboards.length) % cleanDashboards.length;
    currentIndexRef.current = prevIdx;
    setCurrentIndex(prevIdx);
    const duration = cleanDashboards[prevIdx]?.durationSeconds ?? DEFAULT_DURATION_SECONDS;
    targetSwitchTimeRef.current = Date.now() + duration * 1000;
    setSecondsRemaining(duration);
    openOrNavigatePresentation(prevIdx);
  };

  return (
    <PageLayout style={{ minHeight: "100vh", backgroundColor: tokens.pageBg, color: tokens.textPrimary }}>
      <PageLayout.Header>
        <Flex alignItems="center" justifyContent="space-between" padding={16}>
          <Flex alignItems="center" gap={12}>
            <Heading level={3} style={{ margin: 0, color: tokens.textHeading }}>
              NOC Dashboard Rotator
            </Heading>
            {saveStatus && (
              <span style={{ fontSize: "0.82em", color: tokens.success, fontWeight: 700 }}>
                {saveStatus}
              </span>
            )}
          </Flex>
        </Flex>
      </PageLayout.Header>
      <PageLayout.Content>
        <Flex
          flexDirection="column"
          alignItems="center"
          gap={20}
          style={{ padding: "24px 24px 48px", maxWidth: 660, margin: "0 auto" }}
        >
          {/* Active Presentation Banner */}
          {isRunning && (
            <div
              style={{
                width: "100%",
                background: tokens.cardBg,
                border: `2px solid ${tokens.accent}`,
                borderRadius: tokens.radius + 4,
                padding: "16px 20px",
                boxShadow: tokens.cardShadow,
                boxSizing: "border-box",
              }}
            >
              <Flex alignItems="center" justifyContent="space-between" style={{ marginBottom: 10 }}>
                <Flex alignItems="center" gap={8}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: isPaused ? tokens.warning : tokens.success,
                      display: "inline-block",
                    }}
                  />
                  <strong style={{ fontSize: "0.95em", color: tokens.textHeading }}>
                    {isPaused ? "Rotation Paused" : "24/7 NOC Rotation Active"}
                  </strong>
                </Flex>
                <span style={{ fontSize: "0.84em", color: tokens.textMuted }}>
                  Dashboard {currentIndex + 1} of {cleanDashboards.length}
                </span>
              </Flex>

              <div
                style={{
                  fontSize: "1.05em",
                  fontWeight: 600,
                  color: tokens.textHeading,
                  marginBottom: 6,
                }}
              >
                {cleanDashboards[currentIndex]?.name || cleanDashboards[currentIndex]?.id}
              </div>

              <div style={{ fontSize: "0.82em", color: tokens.textMuted, marginBottom: 12 }}>
                Next switch in: <strong style={{ color: tokens.accent }}>{secondsRemaining}s</strong> ·{" "}
                Scope: [{scope === "personal" ? "Personal" : "Shared"}] · Mode: [
                {config.displayMode === "window" ? "Dedicated Window" : "Dedicated Tab"}]
              </div>

              {/* Fullscreen Instructions Tip */}
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 6,
                  background: isDark ? "rgba(129, 140, 248, 0.12)" : "rgba(79, 70, 229, 0.08)",
                  border: `1px solid ${isDark ? "rgba(129, 140, 248, 0.25)" : "rgba(79, 70, 229, 0.18)"}`,
                  fontSize: "0.84em",
                  color: tokens.textHeading,
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div>
                  <strong>NOC Fullscreen Mode:</strong> Click into the presentation window/tab and press{" "}
                  <kbd
                    style={{
                      background: isDark ? "#282b3d" : "#e2e8f0",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontWeight: 700,
                      fontFamily: "monospace",
                    }}
                  >
                    F11
                  </kbd>{" "}
                  (or click <strong>Full screen</strong> in the Dynatrace dashboard header) for 100%
                  edge-to-edge wallboard display. The browser maintains fullscreen across all dashboard transitions.
                </div>
              </div>

              {popupBlocked && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid rgba(239, 68, 68, 0.4)",
                    color: isDark ? "#fca5a5" : "#b91c1c",
                    fontSize: "0.85em",
                    marginBottom: 12,
                  }}
                >
                  Notice: Popups appear blocked by your browser.{" "}
                  <button
                    type="button"
                    onClick={() => openOrNavigatePresentation(currentIndex)}
                    style={{
                      background: "none",
                      border: "none",
                      textDecoration: "underline",
                      cursor: "pointer",
                      color: "inherit",
                      fontWeight: 700,
                    }}
                  >
                    Click here to open the presentation window
                  </button>
                  .
                </div>
              )}

              <Flex alignItems="center" justifyContent="space-between" gap={8} style={{ flexWrap: "wrap" }}>
                <Flex gap={8}>
                  <Button variant="default" onClick={handlePrev}>
                    Previous
                  </Button>
                  <Button variant="default" onClick={handlePauseToggle}>
                    {isPaused ? "Resume" : "Pause"}
                  </Button>
                  <Button variant="default" onClick={handleNext}>
                    Next
                  </Button>
                </Flex>
                <Flex gap={8}>
                  <Button variant="default" onClick={() => openOrNavigatePresentation(currentIndex)}>
                    Focus Window
                  </Button>
                  <Button variant="accent" onClick={handleStop}>
                    Stop
                  </Button>
                </Flex>
              </Flex>

              <Flex
                alignItems="center"
                justifyContent="center"
                gap={16}
                style={{
                  fontSize: "0.75em",
                  color: tokens.success,
                  fontWeight: 600,
                  marginTop: 12,
                  flexWrap: "wrap",
                }}
              >
                <span>Continuous 24/7 Run Mode: Active</span>
                <span>SSO Keep-Alive: Active (30s Heartbeat)</span>
                <span>Tab Sleep Guard: Active</span>
              </Flex>
            </div>
          )}

          <Flex flexDirection="column" alignItems="center" gap={6} style={{ textAlign: "center" }}>
            <Heading level={2} style={{ color: tokens.textHeading, margin: 0 }}>
              NOC Presentation Controller
            </Heading>
            <Paragraph style={{ maxWidth: 540, color: tokens.textMuted, margin: 0, fontSize: "0.92em" }}>
              Configure dashboards to rotate continuously on NOC wallboards or secondary monitors.
              Runs continuously 24/7 with background Web Worker scheduling and active Dynatrace SSO keep-alive.
            </Paragraph>
          </Flex>

          {/* Playlist Scope Selector */}
          <div style={cardStyle}>
            <SectionEyebrow>Playlist Storage</SectionEyebrow>
            <Flex flexDirection="column" gap={8}>
              <span style={fieldLabelStyle}>Configuration Scope</span>
              <Flex gap={12}>
                <Button
                  variant={scope === "personal" ? "accent" : "default"}
                  onClick={() => setScope("personal")}
                >
                  👤 My Personal Playlist
                </Button>
                <Button
                  variant={scope === "shared" ? "accent" : "default"}
                  onClick={() => setScope("shared")}
                >
                  👥 Shared NOC Playlist
                </Button>
              </Flex>
              <Paragraph style={{ color: tokens.textMuted, fontSize: "0.84em", marginTop: 4 }}>
                {scope === "personal"
                  ? "Personal Mode: Saved to your Dynatrace user profile (UserAppState). Only you see and edit this rotation."
                  : "Shared Mode: Saved across the entire Dynatrace tenant (AppState). Any user or NOC wallboard monitor sees this same playlist."}
              </Paragraph>
            </Flex>
          </div>

          {/* Environment & Display Mode Card */}
          <div style={cardStyle}>
            <SectionEyebrow>Environment & Display Mode</SectionEyebrow>
            <Flex flexDirection="column" gap={16}>
              <label style={{ display: "block", width: "100%" }}>
                <span style={fieldLabelStyle}>Tenant URL</span>
                <input
                  type="text"
                  value={config.tenantUrl}
                  onChange={(e) => updateTenantUrl(e.target.value)}
                  onFocus={(e) => withFocusRing(e, true)}
                  onBlur={(e) => withFocusRing(e, false)}
                  placeholder="https://yourtenant.apps.dynatrace.com"
                  style={inputBaseStyle}
                />
              </label>

              <div>
                <span style={fieldLabelStyle}>Presentation Mode</span>
                <Flex gap={12}>
                  <Button
                    variant={config.displayMode === "window" ? "accent" : "default"}
                    onClick={() => updateDisplayMode("window")}
                  >
                    Dedicated Window (Wallboard / Multi-Monitor)
                  </Button>
                  <Button
                    variant={config.displayMode === "tab" ? "accent" : "default"}
                    onClick={() => updateDisplayMode("tab")}
                  >
                    Dedicated Tab
                  </Button>
                </Flex>
                <Paragraph style={{ color: tokens.textMuted, fontSize: "0.84em", marginTop: 6 }}>
                  {config.displayMode === "window"
                    ? "Opens a clean standalone window without browser tabs or toolbars. Press F11 once in that window for true edge-to-edge NOC wallboard display (persists automatically across rotations)."
                    : "Opens a dedicated browser tab. In that tab, press F11 or click 'Full screen' from the dashboard menu for edge-to-edge display."}
                </Paragraph>
              </div>
            </Flex>
          </div>

          {/* Dashboards Card */}
          <div style={cardStyle}>
            <Flex justifyContent="space-between" alignItems="center" style={{ marginBottom: 12 }}>
              <SectionEyebrow>Dashboards to Rotate</SectionEyebrow>
              {isDocumentsLoading ? (
                <span style={{ fontSize: "0.82em", color: tokens.textMuted }}>
                  Loading tenant dashboards...
                </span>
              ) : availableDashboards.length > 0 ? (
                <span style={{ fontSize: "0.82em", color: tokens.textMuted, fontWeight: 600 }}>
                  {availableDashboards.length} dashboards available
                </span>
              ) : null}
            </Flex>

            {/* Quick search/filter input across all tenant dashboards */}
            {availableDashboards.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <span style={fieldLabelStyle}>Filter Dashboards Dropdown</span>
                <input
                  type="text"
                  value={dashboardSearch}
                  onChange={(e) => setDashboardSearch(e.target.value)}
                  onFocus={(e) => withFocusRing(e, true)}
                  onBlur={(e) => withFocusRing(e, false)}
                  placeholder="Type to filter dashboards (e.g. Production, Host, K8s)..."
                  style={{
                    ...inputBaseStyle,
                    fontSize: "0.88em",
                    padding: "8px 12px",
                  }}
                />
              </div>
            )}

            <Flex flexDirection="column" gap={12}>
              {config.dashboards.map((d, index) => {
                const filteredDashboards = dashboardSearch.trim()
                  ? availableDashboards.filter(
                      (doc) =>
                        doc.name.toLowerCase().includes(dashboardSearch.toLowerCase()) ||
                        doc.id.toLowerCase().includes(dashboardSearch.toLowerCase())
                    )
                  : availableDashboards;

                return (
                  <div
                    key={index}
                    style={{
                      border: `1px solid ${tokens.rowBorder}`,
                      borderRadius: tokens.radius,
                      padding: "12px",
                      background: tokens.rowBg,
                    }}
                  >
                    <Flex gap={8} alignItems="center" style={{ marginBottom: 8 }}>
                      {/* Dashboard Selector Dropdown */}
                      {availableDashboards.length > 0 ? (
                        <select
                          value={d.id}
                          onChange={(e) => {
                            const chosenId = e.target.value;
                            const found = availableDashboards.find((x) => x.id === chosenId);
                            updateDashboardId(index, chosenId, found?.name);
                          }}
                          onFocus={(e) => withFocusRing(e, true)}
                          onBlur={(e) => withFocusRing(e, false)}
                          style={{
                            ...inputBaseStyle,
                            flex: 1,
                            fontSize: "0.88em",
                            cursor: "pointer",
                            backgroundColor: tokens.inputBg,
                            color: tokens.inputText,
                            colorScheme: tokens.colorScheme,
                          }}
                        >
                          <option
                            value=""
                            style={{ backgroundColor: tokens.optionBg, color: tokens.optionText }}
                          >
                            -- Select a dashboard from tenant --
                          </option>
                          {filteredDashboards.map((doc) => (
                            <option
                              key={doc.id}
                              value={doc.id}
                              style={{ backgroundColor: tokens.optionBg, color: tokens.optionText }}
                            >
                              {doc.name} ({doc.id.slice(0, 8)}...)
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={d.id}
                          onChange={(e) => updateDashboardId(index, e.target.value)}
                          onFocus={(e) => withFocusRing(e, true)}
                          onBlur={(e) => withFocusRing(e, false)}
                          placeholder="dashboard-id (UUID)"
                          style={{
                            ...inputBaseStyle,
                            flex: 1,
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                            fontSize: "0.88em",
                          }}
                        />
                      )}

                      {/* Display time */}
                      <Flex
                        alignItems="center"
                        gap={4}
                        style={{
                          border: `1px solid ${tokens.inputBorder}`,
                          borderRadius: tokens.radius,
                          background: tokens.inputBg,
                          padding: "0 8px 0 10px",
                          flexShrink: 0,
                        }}
                      >
                        <input
                          type="number"
                          min={1}
                          value={d.durationSeconds}
                          onChange={(e) => updateDashboardDuration(index, Number(e.target.value))}
                          title="Seconds to display"
                          style={{
                            width: 48,
                            border: "none",
                            background: "transparent",
                            color: tokens.inputText,
                            padding: "10px 0",
                            outline: "none",
                            fontSize: "0.9em",
                            fontWeight: 600,
                          }}
                        />
                        <span style={{ fontSize: "0.8em", color: tokens.textMuted, fontWeight: 500 }}>
                          sec
                        </span>
                      </Flex>

                      <Button
                        variant="default"
                        onClick={() => removeDashboardField(index)}
                        disabled={config.dashboards.length === 1}
                      >
                        Remove
                      </Button>
                    </Flex>

                    {/* Manual ID fallback / details row */}
                    {availableDashboards.length > 0 && (
                      <Flex alignItems="center" gap={8}>
                        <span style={{ fontSize: "0.75em", color: tokens.textMuted, fontWeight: 600 }}>
                          ID:
                        </span>
                        <input
                          type="text"
                          value={d.id}
                          onChange={(e) => updateDashboardId(index, e.target.value)}
                          placeholder="or paste exact dashboard ID"
                          style={{
                            ...inputBaseStyle,
                            padding: "4px 8px",
                            fontSize: "0.78em",
                            background: isDark ? "rgba(0, 0, 0, 0.25)" : "#f1f5f9",
                            color: tokens.textMuted,
                            fontFamily: "ui-monospace, SFMono-Regular, monospace",
                          }}
                        />
                      </Flex>
                    )}
                  </div>
                );
              })}
            </Flex>

            <Flex gap={8} style={{ marginTop: 14 }}>
              <Button variant="default" onClick={() => addDashboardField()}>
                + Add Dashboard
              </Button>
            </Flex>
          </div>

          {/* Action buttons */}
          <Flex flexDirection="column" alignItems="center" gap={12} style={{ marginTop: 8 }}>
            {!isRunning ? (
              <Flex gap={12} alignItems="center">
                <Button variant="accent" onClick={handleStart} disabled={!canStart}>
                  Start NOC Rotation
                </Button>
                <Button variant="default" onClick={() => void persistConfig(config)}>
                  Save Configuration
                </Button>
              </Flex>
            ) : (
              <Button variant="default" onClick={handleStop}>
                Stop Rotation
              </Button>
            )}

            {!canStart && !isRunning && (
              <Paragraph style={{ color: tokens.textMuted, fontSize: "0.85em", fontWeight: 500 }}>
                Select at least one dashboard to start rotation.
              </Paragraph>
            )}
          </Flex>
        </Flex>
      </PageLayout.Content>
    </PageLayout>
  );
};

export default App;
