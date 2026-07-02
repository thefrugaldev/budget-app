// PROTOTYPE — throwaway. Direction B · "Signal".
//
// Point of view: a live instrument panel for your money. The justified risk is
// a dark-first identity (a near-black canvas in *both* themes) with a single
// electric accent and monospaced numerals — money as telemetry. Signature: the
// "Pulse Ring", a twin radial gauge that literally draws the product's name —
// outer arc = budget consumed, inner = savings funded — over an ECG trace of
// the savings-rate history, so progress-against-target reads as a heartbeat.

import {
  EXPENSES,
  SAVINGS,
  INCOME,
  KPIS,
  MONTHLY,
  fmt,
  pct,
  descriptorFor,
  thresholdState,
  toneFor,
} from "./data";
import { fontVars } from "./fonts";

type Cat = (typeof EXPENSES)[number];

const css = `
.sg { font-family: var(--proto-font-tech), system-ui, sans-serif; background: var(--sg-bg); color: var(--sg-ink); min-height:100%;
  --sg-bg:#0b0d0c; --sg-panel:#141816; --sg-panel2:#1b201d; --sg-ink:#eafff2; --sg-muted:#7f8c85; --sg-line:#26302b;
  --sg-accent:#c8f94e; --sg-good:#4ade80; --sg-warn:#fbbf24; --sg-bad:#ff4d6d; }
.dark .sg { --sg-bg:#070806; --sg-panel:#111512; }
.sg__mono { font-family: var(--proto-font-mono), ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.sg__wrap { max-width:66rem; margin:0 auto; padding:2rem 1.5rem 9rem; }
.sg__top { display:flex; justify-content:space-between; align-items:center; margin-bottom:1.75rem; }
.sg__brand { display:flex; align-items:center; gap:.6rem; font-weight:600; font-size:1.15rem; letter-spacing:.02em; }
.sg__dot { width:.55rem; height:.55rem; border-radius:99px; background:var(--sg-accent); box-shadow:0 0 12px 2px var(--sg-accent); }
.sg__tag { font-size:.62rem; letter-spacing:.16em; text-transform:uppercase; color:var(--sg-muted); border:1px solid var(--sg-line); border-radius:99px; padding:.2rem .6rem; }
.sg__inc { text-align:right; }
.sg__inclabel { font-size:.6rem; letter-spacing:.16em; text-transform:uppercase; color:var(--sg-muted); }
.sg__incval { font-size:1.35rem; font-weight:600; }
.sg__hero { display:grid; grid-template-columns: minmax(240px,320px) 1fr; gap:1.25rem; align-items:stretch; }
@media (max-width:720px){ .sg__hero{ grid-template-columns:1fr; } }
.sg__panel { background:var(--sg-panel); border:1px solid var(--sg-line); border-radius:14px; padding:1.4rem; }
.sg__ringwrap { display:grid; place-items:center; text-align:center; }
.sg__ringcenter { font-size:2.7rem; font-weight:700; line-height:1; }
.sg__eyebrow { font-size:.6rem; letter-spacing:.18em; text-transform:uppercase; color:var(--sg-muted); }
.sg__ecg { margin-top:1rem; }
.sg__stats { display:grid; grid-template-columns:repeat(3,1fr); gap:.9rem; }
.sg__stat { background:var(--sg-panel2); border:1px solid var(--sg-line); border-radius:12px; padding:1rem 1.1rem; position:relative; overflow:hidden; }
.sg__stat::after { content:""; position:absolute; left:0; right:0; bottom:0; height:2px; background:var(--sg-accent); box-shadow:0 0 10px 1px var(--sg-accent); opacity:.7; }
.sg__statval { font-size:1.9rem; font-weight:700; line-height:1; margin:.35rem 0; }
.sg__statsub { font-size:.68rem; color:var(--sg-muted); }
.sg__sec { margin-top:2rem; }
.sg__sechead { display:flex; align-items:center; gap:.6rem; margin-bottom:.85rem; }
.sg__sechead h2 { font-size:.72rem; letter-spacing:.18em; text-transform:uppercase; color:var(--sg-muted); }
.sg__grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:.75rem; }
.sg__tile { background:var(--sg-panel); border:1px solid var(--sg-line); border-radius:12px; padding:.9rem; }
.sg__tilehead { display:flex; align-items:center; justify-content:space-between; gap:.5rem; }
.sg__chip { width:2.1rem; height:2.1rem; border-radius:9px; display:grid; place-items:center; color:#0b0d0c; }
.sg__pctlabel { font-size:.72rem; font-weight:600; }
.sg__tilename { font-size:.82rem; color:var(--sg-muted); margin:.7rem 0 .15rem; }
.sg__tileamt { font-size:1.35rem; font-weight:700; }
.sg__track { height:5px; border-radius:99px; background:var(--sg-panel2); margin-top:.6rem; overflow:hidden; }
.sg__fill { height:100%; border-radius:99px; }
.sg__desc { font-size:.6rem; letter-spacing:.12em; text-transform:uppercase; margin-top:.5rem; }
`;

function toneColor(tone: string) {
  return tone === "bad" ? "var(--sg-bad)" : tone === "warn" ? "var(--sg-warn)" : tone === "good" ? "var(--sg-good)" : "var(--sg-accent)";
}

function SignalTile({ c }: { c: Cat }) {
  const state = thresholdState(c.kind, c.total, c.target);
  const tone = toneFor(c.kind, state);
  const ratio = c.target === 0 ? 0 : c.total / c.target;
  const col = toneColor(tone);
  const { Icon } = c;
  return (
    <div className="sg__tile">
      <div className="sg__tilehead">
        <span className="sg__chip" style={{ background: col, boxShadow: `0 0 12px -2px ${col}` }}>
          <Icon size={18} strokeWidth={2.4} />
        </span>
        <span className="sg__pctlabel sg__mono" style={{ color: col }}>
          {pct(ratio)}
        </span>
      </div>
      <div className="sg__tilename">{c.name}</div>
      <div className="sg__tileamt sg__mono">{c.total < 0 ? `-${fmt(Math.abs(c.total))}` : fmt(c.total)}</div>
      <div className="sg__track">
        <span className="sg__fill" style={{ width: `${Math.min(100, ratio * 100)}%`, background: col, boxShadow: `0 0 8px 0 ${col}` }} />
      </div>
      <div className="sg__desc sg__mono" style={{ color: col }}>
        {descriptorFor(c.kind, state)} · cap {fmt(c.target)}
      </div>
    </div>
  );
}

function PulseRing() {
  const budgetUsed = Math.min(1, KPIS.spent / KPIS.spentTarget); // 0.89
  const savingsFunded = Math.min(1, KPIS.saved / KPIS.savedTarget); // 1.0
  const R1 = 92;
  const R2 = 66;
  const c1 = 2 * Math.PI * R1;
  const c2 = 2 * Math.PI * R2;

  // ECG-style savings-rate trace across the panel width.
  const W = 360;
  const H = 70;
  const pts = MONTHLY.map((m, i) => {
    const x = 6 + (i * (W - 12)) / (MONTHLY.length - 1);
    const yy = H - 8 - (m.rate / 0.3) * (H - 16);
    return `${x.toFixed(1)},${yy.toFixed(1)}`;
  }).join(" ");

  return (
    <div className="sg__panel sg__ringwrap">
      <div className="sg__eyebrow">Pulse · this month</div>
      <svg viewBox="0 0 240 240" width="200" height="200" role="img" aria-label={`Budget ${pct(budgetUsed)} consumed, savings ${pct(savingsFunded)} funded`}>
        <defs>
          <filter id="sg-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="120" cy="120" r={R1} fill="none" stroke="var(--sg-line)" strokeWidth="13" />
        <circle cx="120" cy="120" r={R2} fill="none" stroke="var(--sg-line)" strokeWidth="13" />
        <circle
          cx="120" cy="120" r={R1} fill="none" stroke="var(--sg-accent)" strokeWidth="13" strokeLinecap="round"
          strokeDasharray={`${budgetUsed * c1} ${c1}`} transform="rotate(-90 120 120)" filter="url(#sg-glow)"
        />
        <circle
          cx="120" cy="120" r={R2} fill="none" stroke="var(--sg-good)" strokeWidth="13" strokeLinecap="round"
          strokeDasharray={`${savingsFunded * c2} ${c2}`} transform="rotate(-90 120 120)" filter="url(#sg-glow)"
        />
        <text x="120" y="116" textAnchor="middle" className="sg__mono" fontSize="40" fontWeight="700" fill="var(--sg-ink)">
          {pct(KPIS.savingsRate)}
        </text>
        <text x="120" y="140" textAnchor="middle" fontSize="11" letterSpacing="2" fill="var(--sg-muted)">
          SAVINGS RATE
        </text>
      </svg>
      <div style={{ display: "flex", gap: "1.1rem", fontSize: ".68rem", marginTop: ".4rem" }}>
        <span style={{ color: "var(--sg-accent)" }}>● Budget {pct(budgetUsed)}</span>
        <span style={{ color: "var(--sg-good)" }}>● Saved {pct(savingsFunded)}</span>
      </div>
      <svg className="sg__ecg" viewBox={`0 0 ${W} ${H}`} width="100%" height="56" role="img" aria-label="Savings-rate trend, last six months" preserveAspectRatio="none">
        <polyline points={pts} fill="none" stroke="var(--sg-accent)" strokeWidth="2" strokeLinejoin="round" opacity="0.85" />
        {MONTHLY.map((m, i) => {
          const x = 6 + (i * (W - 12)) / (MONTHLY.length - 1);
          const yy = H - 8 - (m.rate / 0.3) * (H - 16);
          return <circle key={m.label} cx={x} cy={yy} r="2.4" fill="var(--sg-accent)" />;
        })}
      </svg>
    </div>
  );
}

export function DirectionSignal() {
  return (
    <div className={`sg ${fontVars}`}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="sg__wrap">
        <div className="sg__top">
          <div className="sg__brand">
            <span className="sg__dot" />
            PULSE
            <span className="sg__tag">June 2026</span>
          </div>
          <div className="sg__inc">
            <div className="sg__inclabel">Income / mo</div>
            <div className="sg__incval sg__mono">{fmt(INCOME.monthly)}</div>
          </div>
        </div>

        <div className="sg__hero">
          <PulseRing />
          <div className="sg__panel" style={{ display: "grid", alignContent: "space-between", gap: "1rem" }}>
            <div className="sg__stats">
              <div className="sg__stat">
                <div className="sg__eyebrow">Spent</div>
                <div className="sg__statval sg__mono">{fmt(KPIS.spent)}</div>
                <div className="sg__statsub sg__mono">{fmt(KPIS.remaining)} left of {fmt(KPIS.spentTarget)}</div>
              </div>
              <div className="sg__stat">
                <div className="sg__eyebrow">Saved</div>
                <div className="sg__statval sg__mono" style={{ color: "var(--sg-good)" }}>{fmt(KPIS.saved)}</div>
                <div className="sg__statsub sg__mono">goal {fmt(KPIS.savedTarget)}</div>
              </div>
              <div className="sg__stat">
                <div className="sg__eyebrow">Rate</div>
                <div className="sg__statval sg__mono" style={{ color: "var(--sg-accent)" }}>{pct(KPIS.savingsRate)}</div>
                <div className="sg__statsub sg__mono">of income</div>
              </div>
            </div>
            <p style={{ fontSize: ".8rem", color: "var(--sg-muted)", lineHeight: 1.5 }}>
              <span style={{ color: "var(--sg-ink)" }} className="sg__mono">{fmt(INCOME.rsu)}</span> RSU vest landed
              this month — one-time income, tracked separately from the recurring baseline.
            </p>
          </div>
        </div>

        <section className="sg__sec">
          <div className="sg__sechead">
            <h2>Spend</h2>
          </div>
          <div className="sg__grid">
            {EXPENSES.map((c) => (
              <SignalTile key={c.id} c={c} />
            ))}
          </div>
        </section>

        <section className="sg__sec">
          <div className="sg__sechead">
            <h2>Save</h2>
          </div>
          <div className="sg__grid">
            {SAVINGS.map((c) => (
              <SignalTile key={c.id} c={c} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
