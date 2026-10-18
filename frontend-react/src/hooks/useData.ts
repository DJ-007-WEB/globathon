/* Data-loading hook with caching + prefetch optimizations.
   Compared to the original vanilla JS:
   1. In-memory request dedup — concurrent requests for the same scenario+period share one fetch.
   2. sessionStorage cache — navigating back to a scenario+period returns instantly (no refetch).
   3. Background prefetch — default scenario (s1, FY) is fetched on app init.
   4. Parallel analysis + validation with a single loading state.
   5. API-first with static fallback (same-origin), with optional ?api= override.
*/

import { useState, useCallback, useEffect, useRef } from "react";

export interface AnalysisData {
  schema_version: string;
  data_disclosure: string;
  engine_version: string;
  reproducibility_seed: number;
  plant_id: string;
  plant_name: string;
  scenario: string;
  scenario_name: string;
  period: string;
  period_label: string;
  period_start: string;
  period_end: string;
  forecast_kwh: number;
  actual_kwh: number;
  gap_kwh: number;
  gap_pct: number;
  tariff_inr_per_kwh: number;
  gap_inr: number;
  components: Array<{
    id: string;
    cause: string;
    class: string;
    class_label: string;
    class_detail: string;
    kwh: number;
    inr: number;
    main_effect_kwh: number;
    lower_kwh: number;
    upper_kwh: number;
    confidence: string;
    present: boolean;
    claimable: boolean;
    claim_note: string;
    signals: string[];
    formula: string;
    model_version: string;
    evidence_ids: string[];
  }>;
  interaction: { kwh: number; inr: number; note: string };
  unexplained: {
    kwh: number;
    inr: number;
    pct_of_gap: number | null;
    lower_kwh: number;
    upper_kwh: number;
    exceeds_band: boolean;
    status: string;
    message: string;
    data_that_would_reduce_it: string[];
    confidence: string;
    formula: string;
  };
  weather_percentile: number;
  weather: any;
  data_quality_flags: string[];
  reconciliation: {
    sum_components_kwh: number;
    unexplained_kwh: number;
    gap_kwh: number;
    closes: boolean;
    residual_milli_kwh: number;
    isolated_view_closes: boolean;
  };
  calibration: any;
  sequential_demo: any;
  evidence: any[];
  daily: any;
  monte_carlo: any;
  model_version: string;
  narrative: { text: string; numbers_checked: boolean; unmatched_numbers: string[]; allowed_numbers: string[] };
}

export interface ValidationData {
  scenario: string;
  scenario_name: string;
  forecast_kwh: number;
  model_version: string;
  true_actual_kwh: number;
  measured_actual_kwh: number;
  rows: any[];
  hidden: any;
  summary: any;
  tolerance: string;
  limitation: string;
}

interface DataState {
  analysis: AnalysisData | null;
  validation: ValidationData | null;
}

const memCache = new Map<string, DataState>();
const inflight = new Map<string, Promise<DataState>>();

const fetchT = (url: string, ms = 30000): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
};

const cacheKey = (scenario: string, period: string) => `${scenario}|${period}`;

const loadFromSession = (key: string): DataState | null => {
  try {
    const raw = sessionStorage.getItem(`ve_data_${key}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

const saveToSession = (key: string, data: DataState) => {
  try {
    sessionStorage.setItem(`ve_data_${key}`, JSON.stringify(data));
  } catch {}
};

export const useData = () => {
  const [data, setData] = useState<DataState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiConnected, setApiConnected] = useState(false);
  const prefetched = useRef(false);

  // Determine API base from ?api= query param or localStorage (same convention as original)
  const apiBase = (() => {
    if (typeof window === "undefined") return "";
    try {
      const q = new URLSearchParams(window.location.search).get("api");
      if (q) localStorage.setItem("ve_api_base", q);
      return (q || localStorage.getItem("ve_api_base") || "").replace(/\/$/, "");
    } catch {
      return "";
    }
  })();

  const apiUrl = (p: string) => (apiBase ? apiBase + p : p.replace(/^\//, ""));

  const checkApi = useCallback(async () => {
    try {
      const r = await fetchT(apiUrl("/api/health"), 5000);
      setApiConnected(r.ok);
    } catch {
      setApiConnected(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    checkApi();
    // Background prefetch of default scenario (s1, FY) so the first view loads instantly
    if (!prefetched.current) {
      prefetched.current = true;
      void prefetchData("s1", "FY");
    }
  }, [checkApi]);

  const prefetchData = useCallback(async (scenario: string, period: string) => {
    const key = cacheKey(scenario, period);
    if (memCache.has(key) || inflight.has(key)) return;
    try {
      const result = await fetchScenario(scenario, period, true, apiUrl);
      memCache.set(key, result);
      saveToSession(key, result);
    } catch {}
  }, [apiUrl]);

  const fetchScenario = useCallback(
    async (scenario: string, period: string, silent: boolean, apiUrlFn: typeof apiUrl): Promise<DataState> => {
      const key = cacheKey(scenario, period);

      // 1. Memory cache
      if (memCache.has(key)) return memCache.get(key)!;

      // 2. In-flight dedup
      if (inflight.has(key)) return inflight.get(key)!;

      // 3. sessionStorage cache
      const session = loadFromSession(key);
      if (session) {
        memCache.set(key, session);
        return session;
      }

      const promise = (async () => {
        let analysis: AnalysisData | null = null;
        let validation: ValidationData | null = null;

        // Try API first (analysis + validation in parallel)
        try {
          const [aResp, vResp] = await Promise.allSettled([
            fetchT(apiUrlFn(`/api/analysis?scenario=${scenario}&period=${period}`)),
            fetchT(apiUrlFn(`/api/validation?scenario=${scenario}`)),
          ]);
          if (aResp.status === "fulfilled" && aResp.value.ok) analysis = await aResp.value.json();
          if (vResp.status === "fulfilled" && vResp.value.ok) validation = await vResp.value.json();
        } catch {}

        // Fall back to static JSON
        if (!analysis) {
          const r = await fetchT(apiUrlFn(`/data/${scenario}_${period}.json`));
          if (!r.ok) throw new Error(`Cannot load ${scenario}_${period}.json`);
          analysis = await r.json();
        }
        if (!validation) {
          const r = await fetchT(apiUrlFn(`/data/${scenario}_validation.json`));
          if (!r.ok) throw new Error(`Cannot load ${scenario}_validation.json`);
          validation = await r.json();
        }

        const result: DataState = { analysis, validation };
        memCache.set(key, result);
        saveToSession(key, result);
        return result;
      })();

      inflight.set(key, promise);
      try {
        const result = await promise;
        return result;
      } finally {
        inflight.delete(key);
      }
    },
    [apiUrl]
  );

  const load = useCallback(
    async (scenario: string, period: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchScenario(scenario, period, false, apiUrl);
        setData(result);
      } catch (err: any) {
        setError(err?.message || "Failed to load data");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [fetchScenario]
  );

  return {
    data,
    loading,
    error,
    apiConnected,
    load,
    prefetchData,
    apiBase,
  };
};
