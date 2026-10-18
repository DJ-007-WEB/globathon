/* Landing page — same visual as original index.html landing section. */

import { useAuth } from "../hooks/useAuth";
import { esc } from "../utils/format";

interface LandingProps {
  scenarios: any[];
  startDemo: () => void;
}

export const Landing = ({ scenarios, startDemo }: LandingProps) => {
  const { user, isAuthed, login } = useAuth();

  const cards = scenarios.map((s: any, i: number) => (
    <button
      key={s.key}
      className="sc"
      data-k={s.key}
      onClick={startDemo}
    >
      <span className="scenario-index">SCENARIO 0{i + 1}</span>
      <b>{esc(s.name)}</b>
      <span>{esc(s.blurb)}</span>
      <span className="scenario-open">
        Explore scenario <span aria-hidden="true"> ↗ </span>
      </span>
    </button>
  ));

  return (
    <section id="landing" className="landing-shell">
      <div className="hero-grid">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-line"></span> SOLAR ASSET INTELLIGENCE · GLOBATHON PS 3
          </div>
          <h1>
            When output falls short,<br />
            find the <span>reason behind it.</span>
          </h1>
          <p className="hero-lede">
            Turn a solar plant's forecast gap into an evidence-backed explanation. Separate weather,
            operational losses and grid curtailment — and keep the unknowns visible.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" id="startdemo" onClick={startDemo}>
              Explore the live demo <span aria-hidden="true"> ↗ </span>
            </button>{" "}
            <a className="text-link" href="#how">
              See how it works <span> ↓ </span>
            </a>
          </div>
          <div className="hero-proof">
            <div className="proof-avatars">
              <span>PV</span>
              <span>AI</span>
              <span>✓</span>
            </div>
            <div>
              <b>Explainable by design</b>
              <small>Deterministic analysis · Reconciled numbers · No black-box claims</small>
            </div>
          </div>
        </div>
        <div className="hero-visual" aria-label="Illustrative solar performance visualization">
          <div className="visual-orbit orbit-one"></div>
          <div className="visual-orbit orbit-two"></div>
          <div className="sun-glow"></div>
          <div className="solar-art">
            <div className="sun-disc"></div>
            <div className="sun-ray ray-a"></div>
            <div className="sun-ray ray-b"></div>
            <div className="sun-ray ray-c"></div>
            <div className="solar-hill hill-back"></div>
            <div className="solar-hill hill-front"></div>
            <div className="panel-grid">
              <span></span><span></span><span></span><span></span><span></span><span></span>
              <span></span><span></span><span></span><span></span><span></span><span></span>
            </div>
          </div>
          <div className="visual-caption">ILLUSTRATIVE DATA · NOT A LIVE PLANT</div>
        </div>
      </div>
      <div className="trust-strip">
        <div>
          <b>4</b><span>prebuilt scenarios</span>
        </div>
        <div>
          <b>128</b><span>cause coalitions analysed</span>
        </div>
        <div>
          <b>90%</b><span>uncertainty bands</span>
        </div>
        <div>
          <b>0</b><span>invented residual causes</span>
        </div>
      </div>
      <section className="landing-section" id="how">
        <div className="section-heading">
          <div>
            <div className="eyebrow">FROM VARIANCE TO EVIDENCE</div>
            <h2>A clearer view of every lost MWh.</h2>
          </div>
          <p>
            Built for asset owners, lenders and operators who need to know not only what changed —
            but what the evidence supports.
          </p>
        </div>
        <div className="feature-grid">
          <article className="feature-card">
            <span className="feature-number">01 / ATTRIBUTE</span>
            <div className="feature-icon icon-sun">☼</div>
            <h3>Separate the causes</h3>
            <p>
              Quantify weather, temperature, downtime, curtailment and other drivers with order-independent attribution.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-number">02 / BE HONEST</span>
            <div className="feature-icon icon-unknown">◌</div>
            <h3>Keep unknowns visible</h3>
            <p>
              Give unexplained loss its own value and uncertainty band. Show which missing evidence could narrow it.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-number">03 / VALIDATE</span>
            <div className="feature-icon icon-validate">✓</div>
            <h3>Test against known truth</h3>
            <p>
              Validate recovered causes against injected synthetic ground truth and check that the numbers reconcile.
            </p>
          </article>
        </div>
      </section>
      <section className="scenario-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">CHOOSE YOUR DEMO</div>
            <h2>Four scenarios. Different stories.</h2>
          </div>
          <span className="data-disclosure">ⓘ All scenarios use synthetic data</span>
        </div>
        <div id="landscen" className="scenario-grid" onClick={(e) => {
          const b = (e.target as HTMLElement).closest(".sc");
          if (b) startDemo();
        }}>
          {cards}
        </div>
      </section>
      <footer className="site-footer">
        <span>SolarSleuth © 2026</span>
        <span>Globathon · Problem Statement 3</span>
        <span>Prototype only · Synthetic data</span>
      </footer>
    </section>
  );
};
