/* Evidence drawer — same visual as original drawer(). */

import { fmt, mwh, sg, lakh, esc, wrap } from "../utils/format";

interface EvidenceDrawerProps {
  sel: string | undefined | null;
  a: any;
}

export const EvidenceDrawer = ({ sel, a }: EvidenceDrawerProps) => {
  if (!sel) {
    return (
      <div className="card drawer">
        <h4>Evidence drawer</h4>
        <div className="note">
          Click any bar in the waterfall to see the evidence, formula, confidence and (for curtailment) the claimable flag behind it.
        </div>
      </div>
    );
  }

  if (sel === "unexplained") {
    const u = a.unexplained;
    return (
      <div className="card drawer">
        <h4>Unexplained</h4>
        <div className="big" style={{ color: "var(--una-ink)" }}>
          {sg(u.kwh)}
        </div>
        <div className="note">
          {lakh(u.inr)} · band {sg(u.lower_kwh)} to {sg(u.upper_kwh)}
        </div>
        <span className="chip">{u.status.replace("_", " ").toLowerCase()}</span>
        <span className="mono">{esc(u.formula)}</span>
        <p>{esc(u.message)}</p>
      </div>
    );
  }

  if (sel === "interaction") {
    return (
      <div className="card drawer">
        <h4>Interaction</h4>
        <div className="big">{sg(a.interaction.kwh)}</div>
        <p>{esc(a.interaction.note)}</p>
      </div>
    );
  }

  if (sel === "total") {
    return (
      <div className="card drawer">
        <h4>Total gap</h4>
        <div className="big">{sg(a.gap_kwh)}</div>
        <p className="note">
          Actual minus forecast. Equals Σ causes + unexplained.
        </p>
      </div>
    );
  }

  const c = a.components.find((x: any) => x.id === sel);
  if (!c) return null;

  const ev = a.evidence.filter((e: any) => c.evidence_ids.includes(e.id));

  return (
    <div className="card drawer">
      <h4>{esc(c.cause)}</h4>
      <div className={`big ${c.kwh < 0 ? "neg" : "pos"}`}>{sg(c.kwh)}</div>
      <div className="note">
        {lakh(c.inr)} · 90% band {sg(c.lower_kwh)} to {sg(c.upper_kwh)}
      </div>
      <div style={{ margin: "8px 0" }}>
        <span className="chip">{esc(c.class_label)}</span>{" "}
        <span className={`chip ${c.confidence}`}>{c.confidence} confidence</span>{" "}
        {c.claimable ? <span className="chip claim">potentially claimable</span> : ""}
      </div>
      {c.class_detail ? <div className="hl">{esc(c.class_detail)}</div> : ""}
      {c.claimable ? <p className="note">{esc(c.claim_note)}</p> : ""}
      <b style={{ fontSize: 13 }}>Formula</b>{" "}
      <span className="mono">{esc(c.formula)}</span>{" "}
      <b style={{ fontSize: 13 }}>Signals</b>{" "}
      <div className="note">{c.signals.map((s: string) => esc(s)).join(" · ")}</div>
      <div className="note">
        Model {esc(c.model_version)} · isolated effect {sg(c.main_effect_kwh)}
      </div>
      <b style={{ fontSize: 13, display: "block", marginTop: 8 }}>
        Evidence ({ev.length})
      </b>
      {ev.length > 0 ? (
        ev.map((e: any) => (
          <div key={e.id} className="ev">
            <b>
              {esc(e.title)} {e.kwh != null ? ` · ${sg(e.kwh, 1)} MWh` : ""}
            </b>
            <br />
            <small>
              {esc(e.window)} · {esc(e.signal)}
            </small>
            <div>{esc(e.detail)}</div>
          </div>
        ))
      ) : (
        <div className="note">No events in this period.</div>
      )}
    </div>
  );
};
