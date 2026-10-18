/* Main app — ties landing, workspace, data loading, auth and chat together.
   Same flow as the original app.js, ported to React. */

import { useState, useEffect, useCallback } from "react";
import { useData } from "./hooks/useData";
import { useAuth } from "./hooks/useAuth";
import { Landing } from "./components/Landing";
import { Sidebar } from "./components/Sidebar";
import { AuthModal } from "./components/AuthModal";
import { ChatPanel } from "./components/ChatPanel";
import { Overview } from "./components/views/Overview";
import { Analysis } from "./components/views/Analysis";
import { Classification } from "./components/views/Classification";
import { Validation } from "./components/views/Validation";
import { Report } from "./components/views/Report";
import { Why } from "./components/views/Why";
import { DataUpload } from "./components/views/DataUpload";
import { per } from "./utils/format";

type Tab = "overview" | "data" | "analysis" | "class" | "valid" | "report" | "why";

const TAB_NAMES: Record<Tab, string> = {
  overview: "Overview",
  data: "Data upload",
  analysis: "Variance analysis",
  class: "Cause classification",
  valid: "Validation lab",
  report: "Investor report",
  why: "Methodology",
};

const TAB_SUBTITLES: Record<Tab, string> = {
  data: "Bring your own monthly data: validated in the browser, reconciled with a visible unexplained remainder.",
  overview: "A portfolio-level view of plant performance and unexplained variance.",
  analysis: "Trace every material contributor to the production gap.",
  class: "Understand whether each cause was predictable, controllable or external.",
  valid: "Test recovered attribution against known synthetic ground truth.",
  report: "A reproducible, investor-friendly account of the selected period.",
  why: "Methods, assumptions and product differentiation.",
};

export default function App() {
  const { data, loading, error, apiConnected, load } = useData();
  const { user, logout, isAuthed } = useAuth();

  const [preDemo, setPreDemo] = useState(true);
  const [scenario, setScenario] = useState("s1");
  const [period, setPeriod] = useState("FY");
  const [tab, setTab] = useState<Tab>("overview");
  const [meta, setMeta] = useState<any>({ scenarios: [] });
  const [apiUse, setApiUse] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Load scenario metadata on startup
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const resp = await fetch("/data/scenarios.json");
        if (resp.ok) {
          const m = await resp.json();
          setMeta(m);
        }
      } catch {}
    };
    fetchMeta();
  }, []);

  useEffect(() => {
    setApiUse(apiConnected);
  }, [apiConnected]);

  const handleScenarioChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val !== scenario) {
      setScenario(val);
      setPeriod("FY");
      void load(val, "FY");
    }
  }, [scenario, load]);

  const handlePeriodChange = useCallback((p: string) => {
    if (p !== period) {
      setPeriod(p);
      void load(scenario, p);
    }
  }, [scenario, period, load]);

  const handleTabChange = useCallback((t: string) => {
    setTab(t as Tab);
  }, []);

  const scenMeta = meta.scenarios.find((s: any) => s.key === scenario);

  // Render the active view content
  const renderView = () => {
    if (!data || !data.analysis || !data.validation) return null;

    const a = data.analysis;
    const v = data.validation;
    const page: Tab = tab;

    switch (page) {
      case "overview":
        return <Overview a={a} meta={meta} scenario={scenario} useApi={apiUse} />;
      case "data":
        return <DataUpload meta={meta} scenario={scenario} />;
      case "analysis":
        return <Analysis a={a} v={v} scenario={scenario} period={period} />;
      case "class":
        return <Classification a={a} />;
      case "valid":
        return <Validation v={v} />;
      case "report":
        return <Report a={a} v={v} />;
      case "why":
        return <Why a={a} />;
      default:
        return null;
    }
  };

  if (preDemo) {
    return (
      <>
        <Landing
          scenarios={meta.scenarios}
          startDemo={() => {
            if (isAuthed()) {
              setPreDemo(false);
              setTab("overview");
            } else {
              setShowAuth(true);
            }
          }}
        />
        {showAuth && (
          <AuthModal
            open={showAuth}
            onClose={() => setShowAuth(false)}
            onAuth={() => {
              setShowAuth(false);
              setPreDemo(false);
              setTab("overview");
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <a
          className="brand"
          href="#home"
          id="brandHome"
          aria-label="SolarSleuth home"
          onClick={(e) => {
            e.preventDefault();
            if (isAuthed()) {
              setTab("overview");
            } else {
              setPreDemo(true);
            }
          }}
        >
          <span className="brand-mark">
            <svg viewBox="0 0 40 40" aria-hidden="true">
              <path
                d="M20 4 5 12.5v15L20 36l15-8.5v-15L20 4Z"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
              />
              <path
                d="M20 10v20M10 15.5l20 9M10 24.5l20-9"
                stroke="currentColor"
                strokeWidth={1.5}
              />
              <circle cx={20} cy={20} r={4} fill="currentColor" />
            </svg>
          </span>
          <span className="brand-copy">
            <b>SolarSleuth</b>
            <small>Performance intelligence</small>
          </span>
        </a>
        <div className="topbar-right">
          <span className="environment-pill">
            <span className="status-dot"></span> Synthetic demo environment
          </span>
          <button
            className="icon-btn theme-toggle"
            id="themeToggle"
            aria-label="Toggle light and dark mode"
            title="Toggle theme"
          >
            <span className="theme-symbol">☼</span>
          </button>
          <div className="avatar-wrap">
            {user ? (
              <>
                <button className="avatar-btn" id="accountButton" title="Account" aria-haspopup="true">
                  {user.name.charAt(0).toUpperCase()}
                </button>
                <div className="user-menu" id="userMenu">
                  <div className="um-name" id="umName">{user.name}</div>
                  <div className="um-email" id="umEmail">{user.email}</div>
                  <button type="button" id="umData">Upload plant data</button>
                  <button
                    type="button"
                    className="um-out"
                    id="umOut"
                    onClick={() => {
                      logout();
                      setPreDemo(true);
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <>
                <button className="signin-btn hide" id="signinButton" type="button">
                  Sign in
                </button>
                <button className="avatar-btn" id="accountButton" title="Account" aria-haspopup="true">
                  G
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {showAuth && (
        <AuthModal
          open={showAuth}
          onClose={() => setShowAuth(false)}
          onAuth={() => {
            setShowAuth(false);
          }}
        />
      )}

      <div id="app" className="app-shell">
        <aside className="sidebar">
          <Sidebar tab={tab} setTab={handleTabChange} />
        </aside>
        <main className="workspace">
          <div className="workspace-head">
            <div>
              <div className="breadcrumb">
                WORKSPACE <span>/</span> <b id="pageCrumb">{TAB_NAMES[tab]}</b>
              </div>
              <h1 id="pageTitle">
                {tab === "overview" ? "Plant overview" : TAB_NAMES[tab]}
              </h1>
              <p id="pageSubtitle">
                {TAB_SUBTITLES[tab as keyof typeof TAB_SUBTITLES] || ""}
              </p>
            </div>
            <div className="head-actions">
              <span className="plant-select-label">ACTIVE PLANT</span>
              <div className="plant-select">
                <span className="plant-icon">☼</span>
                <span>
                  <b>Rajasthan Solar One</b>
                  <small>30 MWp · Rajasthan, India</small>
                </span>
                <span className="chevron">⌄</span>
              </div>
            </div>
          </div>
          <section className="controls-panel">
            <div>
              <label htmlFor="scenarioSelect">Scenario</label>
              <select
                id="scenarioSelect"
                aria-label="Choose scenario"
                value={scenario}
                onChange={handleScenarioChange}
              >
                {meta.scenarios.map((s: any) => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="period-control">
              <span className="control-label">Reporting period</span>
              <div id="periods" className="periods">
                <button
                  className={`pc ${period === "FY" ? "on" : ""}`}
                  data-p="FY"
                  onClick={() => handlePeriodChange("FY")}
                >
                  Full year
                  <i style={{ width: "100%" }} />
                </button>
                {scenMeta?.monthly.map((m: any) => (
                  <button
                    key={m.period}
                    className={`pc ${period === m.period ? "on" : ""}`}
                    data-p={m.period}
                    title={m.gap_pct + "% vs forecast"}
                    onClick={() => handlePeriodChange(m.period)}
                  >
                    {per(m.period).split(" ")[0]}
                    <i
                      style={{
                        width: Math.max(8, Math.abs(m.gap_pct)) + "%",
                        background: m.gap_pct < 0 ? "var(--red)" : "var(--green)",
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="engine-status" id="apinote">
              <span className="status-dot"></span>
              {apiUse ? "Live analysis API connected" : "Offline demo · precomputed engine snapshots"}
            </div>
          </section>
          <div
            id="loading"
            className="loading"
            style={{ display: loading ? "block" : "none" }}
          >
            <span className="loader"></span> Preparing plant analysis…
          </div>
          <div id="view-overview" className="view"></div>
          <div id="view-data" className="view hide"></div>
          <div id="view-analysis" className="view hide"></div>
          <div id="view-class" className="view hide"></div>
          <div id="view-valid" className="view hide"></div>
          <div id="view-report" className="view hide"></div>
          <div id="view-why" className="view hide"></div>

          {renderView()}
        </main>
      </div>

      <footer className="app-footer">
        SolarSleuth is a prototype. All plant, weather, outage and curtailment records are synthetic. Tariff is an illustrative assumption; outputs are not investment or legal advice.
      </footer>

      <div id="toast" className="toast" role="status" aria-live="polite"></div>

      <button
        id="chatLauncher"
        className="chat-launcher"
        aria-label="Open Variance Assistant"
        onClick={() => setChatOpen(!chatOpen)}
      >
        <span>✳</span>
        <b>Ask the assistant</b>
      </button>

      {chatOpen && <ChatPanel page={tab} data={data} />}
    </>
  );
}
