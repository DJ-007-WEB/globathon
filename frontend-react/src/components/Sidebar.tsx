/* Sidebar navigation — same visual as original app shell sidebar. */

import { useAuth } from "../hooks/useAuth";

interface SidebarProps {
  tab: string;
  setTab: (t: string) => void;
}

export const Sidebar = ({ tab, setTab }: SidebarProps) => {
  const { user } = useAuth();

  const names: Record<string, string> = {
    overview: "Overview",
    data: "Data upload",
    analysis: "Variance analysis",
    class: "Cause classification",
    valid: "Validation lab",
    report: "Investor report",
    why: "Methodology",
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-label">WORKSPACE</div>
      <nav id="tabs" className="side-nav">
        <button
          data-tab="overview"
          className={tab === "overview" ? "on" : ""}
          onClick={() => setTab("overview")}
        >
          <span>◫</span> Overview
        </button>
        <button
          data-tab="data"
          className={tab === "data" ? "on" : ""}
          onClick={() => setTab("data")}
        >
          <span>⇧</span> Data upload
        </button>
        <button
          data-tab="analysis"
          className={tab === "analysis" ? "on" : ""}
          onClick={() => setTab("analysis")}
        >
          <span>⌁</span> Variance analysis
        </button>
        <button
          data-tab="class"
          className={tab === "class" ? "on" : ""}
          onClick={() => setTab("class")}
        >
          <span>◉</span> Cause classification
        </button>
        <button
          data-tab="valid"
          className={tab === "valid" ? "on" : ""}
          onClick={() => setTab("valid")}
        >
          <span>✓</span> Validation lab
        </button>
        <button
          data-tab="report"
          className={tab === "report" ? "on" : ""}
          onClick={() => setTab("report")}
        >
          <span>▤</span> Investor report
        </button>
        <button
          data-tab="why"
          className={tab === "why" ? "on" : ""}
          onClick={() => setTab("why")}
        >
          <span>◇</span> Methodology
        </button>
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-mini-icon">✳</div>
        <div>
          <b id="sbName">{user ? user.name : "SolarSleuth Demo"}</b>
          <small id="sbEmail">{user ? user.email : "Local synthetic workspace"}</small>
        </div>
        <span className="live-dot"></span>
      </div>
    </aside>
  );
};
