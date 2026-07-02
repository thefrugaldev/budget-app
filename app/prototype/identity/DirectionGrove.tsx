// PROTOTYPE — throwaway. Direction C · "Grove".
//
// Point of view: a warm, human, lived-in place — money as something you tend,
// not a spreadsheet. The justified risk is a warm clay + sage palette (no gray)
// with a characterful rounded display face (Bricolage) and generous rounding.
// Signature: "Growth Columns" — each month a rounded column with spend at the
// base and savings stacked on top as a sage cap, climbing toward a dashed
// budget line, the newest month sprouting a bud: progress-against-target that
// literally grows over time.

import { Leaf } from "lucide-react";
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
.gr { font-family: var(--proto-font-soft-body), system-ui, sans-serif; background: var(--gr-bg); color: var(--gr-ink); min-height:100%;
  --gr-bg:#fbf5ec; --gr-surface:#fffdf9; --gr-ink:#352a1e; --gr-muted:#8b7d6b; --gr-line:#ece0cf;
  --gr-primary:#c26a3d; --gr-sage:#6f9469; --gr-good:#5f9464; --gr-warn:#d59a3f; --gr-bad:#c65f4e;
  --gr-clay-soft:#f3e4d6; --gr-sage-soft:#e4eddd; }
.dark .gr { --gr-bg:#1b1611; --gr-surface:#251f18; --gr-ink:#f0e7da; --gr-muted:#b1a390; --gr-line:#3a3127;
  --gr-primary:#dc7f50; --gr-sage:#88ad80; --gr-good:#88ad80; --gr-warn:#e0ac5c; --gr-bad:#d8776a;
  --gr-clay-soft:#33271d; --gr-sage-soft:#242e21; }
.gr__display { font-family: var(--proto-font-soft-display), system-ui, sans-serif; }
.gr__wrap { max-width:64rem; margin:0 auto; padding:2.25rem 1.5rem 9rem; }
.gr__head { display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap; margin-bottom:1.75rem; }
.gr__brand { display:flex; align-items:center; gap:.7rem; }
.gr__mark { width:2.6rem; height:2.6rem; border-radius:50% 50% 50% 12%; background:linear-gradient(135deg,var(--gr-primary),var(--gr-sage)); display:grid; place-items:center; color:#fff; }
.gr__hello { font-size:.8rem; color:var(--gr-muted); }
.gr__month { font-family: var(--proto-font-soft-display); font-size:1.5rem; font-weight:700; line-height:1; }
.gr__incpill { background:var(--gr-surface); border:1px solid var(--gr-line); border-radius:99px; padding:.55rem 1.1rem; display:flex; align-items:center; gap:.6rem; }
.gr__incval { font-family: var(--proto-font-soft-display); font-weight:700; font-size:1.15rem; font-variant-numeric: tabular-nums; }
.gr__panel { background:var(--gr-surface); border:1px solid var(--gr-line); border-radius:28px; padding:1.6rem 1.7rem; }
.gr__panelhead { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:.4rem; }
.gr__panelh2 { font-family: var(--proto-font-soft-display); font-size:1.2rem; font-weight:700; }
.gr__panelsub { font-size:.8rem; color:var(--gr-muted); }
.gr__kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin:1.5rem 0 2.25rem; }
@media (max-width:640px){ .gr__kpis{ grid-template-columns:1fr; } }
.gr__kpi { border-radius:24px; padding:1.3rem 1.4rem; border:1px solid var(--gr-line); }
.gr__kpiico { width:2.6rem; height:2.6rem; border-radius:50%; display:grid; place-items:center; margin-bottom:.8rem; }
.gr__kpilabel { font-size:.78rem; color:var(--gr-muted); }
.gr__kpival { font-family: var(--proto-font-soft-display); font-size:2.3rem; font-weight:700; line-height:1; margin-top:.15rem; font-variant-numeric: tabular-nums; }
.gr__kpisub { font-size:.76rem; color:var(--gr-muted); margin-top:.4rem; }
.gr__sec { margin-top:2.25rem; }
.gr__sech { font-family: var(--proto-font-soft-display); font-size:1.1rem; font-weight:700; margin-bottom:.9rem; }
.gr__grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:.9rem; }
.gr__card { border-radius:24px; padding:1.1rem 1.2rem; border:1px solid var(--gr-line); background:var(--gr-surface); }
.gr__cardtop { display:flex; align-items:center; gap:.75rem; }
.gr__cardico { width:2.9rem; height:2.9rem; border-radius:50%; display:grid; place-items:center; flex:none; }
.gr__cardname { font-weight:700; font-size:.98rem; }
.gr__cardcap { font-size:.74rem; color:var(--gr-muted); }
.gr__cardamt { font-family: var(--proto-font-soft-display); font-size:1.6rem; font-weight:700; margin-top:.9rem; font-variant-numeric: tabular-nums; }
.gr__track { height:9px; border-radius:99px; background:var(--gr-line); margin-top:.6rem; overflow:hidden; }
.gr__fill { height:100%; border-radius:99px; }
.gr__pill { display:inline-flex; align-items:center; gap:.3rem; font-size:.68rem; font-weight:700; border-radius:99px; padding:.2rem .6rem; margin-top:.7rem; }
`;

function toneColor(tone: string) {
  return tone === "bad" ? "var(--gr-bad)" : tone === "warn" ? "var(--gr-warn)" : tone === "good" ? "var(--gr-good)" : "var(--gr-sage)";
}
function toneSoft(tone: string) {
  return tone === "bad" || tone === "warn" ? "var(--gr-clay-soft)" : "var(--gr-sage-soft)";
}

function GroveCard({ c }: { c: Cat }) {
  const state = thresholdState(c.kind, c.total, c.target);
  const tone = toneFor(c.kind, state);
  const ratio = c.target === 0 ? 0 : c.total / c.target;
  const col = toneColor(tone);
  const { Icon } = c;
  return (
    <div className="gr__card">
      <div className="gr__cardtop">
        <span className="gr__cardico" style={{ background: toneSoft(tone), color: col }}>
          <Icon size={22} strokeWidth={2} />
        </span>
        <div>
          <div className="gr__cardname">{c.name}</div>
          <div className="gr__cardcap">
            {c.kind === "savings" ? "Goal" : "Cap"} {fmt(c.target)}/mo
          </div>
        </div>
      </div>
      <div className="gr__cardamt" style={{ color: col }}>
        {c.total < 0 ? `−${fmt(Math.abs(c.total))}` : fmt(c.total)}
      </div>
      <div className="gr__track">
        <span className="gr__fill" style={{ width: `${Math.min(100, ratio * 100)}%`, background: col }} />
      </div>
      <span className="gr__pill" style={{ background: toneSoft(tone), color: col }}>
        {c.kind === "savings" && <Leaf size={12} strokeWidth={2.4} />}
        {descriptorFor(c.kind, state)} · {pct(ratio)}
      </span>
    </div>
  );
}

function GrowthColumns() {
  const W = 720;
  const H = 230;
  const baseline = 188;
  const plotH = 150;
  const domain = 6200; // headroom above the busiest month
  const budgetLine = KPIS.spentTarget + KPIS.savedTarget; // 5900 monthly plan
  const step = (W - 40) / MONTHLY.length;
  const barW = Math.min(52, step * 0.62);
  const h = (v: number) => (v / domain) * plotH;
  const targetY = baseline - h(budgetLine);
  return (
    <div className="gr__panel">
      <div className="gr__panelhead">
        <div>
          <div className="gr__panelh2">Growing your grove</div>
          <div className="gr__panelsub">Spend + savings each month, climbing toward your {fmt(budgetLine)} plan</div>
        </div>
        <span className="gr__pill" style={{ background: "var(--gr-sage-soft)", color: "var(--gr-good)" }}>
          <Leaf size={12} strokeWidth={2.4} /> Saving steadily
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Spend and savings per month, January to June, against the monthly plan">
        <line x1="20" y1={targetY} x2={W - 20} y2={targetY} stroke="var(--gr-muted)" strokeWidth="1.5" strokeDasharray="6 5" opacity="0.6" />
        <text x={W - 22} y={targetY - 6} textAnchor="end" fontSize="11" fill="var(--gr-muted)">
          plan {fmt(budgetLine)}
        </text>
        {MONTHLY.map((m, i) => {
          const cx = 20 + step * i + step / 2;
          const x = cx - barW / 2;
          const spendH = h(m.spend);
          const savedH = h(m.saved);
          const spendY = baseline - spendH;
          const savedY = spendY - savedH;
          const last = i === MONTHLY.length - 1;
          return (
            <g key={m.label}>
              <rect x={x} y={spendY} width={barW} height={spendH} rx="9" fill="var(--gr-primary)" opacity={last ? 1 : 0.85} />
              <rect x={x} y={savedY} width={barW} height={savedH + 10} rx="9" fill="var(--gr-sage)" opacity={last ? 1 : 0.85} />
              {last && <circle cx={cx} cy={savedY - 4} r="5" fill="var(--gr-good)" />}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--gr-muted)">
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: "1.2rem", fontSize: ".76rem", color: "var(--gr-muted)", marginTop: ".4rem" }}>
        <span><span style={{ color: "var(--gr-primary)" }}>■</span> Spent</span>
        <span><span style={{ color: "var(--gr-sage)" }}>■</span> Saved</span>
      </div>
    </div>
  );
}

export function DirectionGrove() {
  const SpendIcon = EXPENSES[0].Icon;
  return (
    <div className={`gr ${fontVars}`}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="gr__wrap">
        <header className="gr__head">
          <div className="gr__brand">
            <span className="gr__mark">
              <Leaf size={20} strokeWidth={2.2} />
            </span>
            <div>
              <div className="gr__hello">Your Pulse</div>
              <div className="gr__month">June 2026</div>
            </div>
          </div>
          <div className="gr__incpill">
            <INCOME.Icon size={18} strokeWidth={2} style={{ color: "var(--gr-primary)" }} />
            <span className="gr__cardcap">Income</span>
            <span className="gr__incval">{fmt(INCOME.monthly)}</span>
          </div>
        </header>

        <GrowthColumns />

        <div className="gr__kpis">
          <div className="gr__kpi" style={{ background: "var(--gr-clay-soft)" }}>
            <div className="gr__kpiico" style={{ background: "var(--gr-surface)", color: "var(--gr-primary)" }}>
              <SpendIcon size={20} strokeWidth={2} />
            </div>
            <div className="gr__kpilabel">Spent</div>
            <div className="gr__kpival">{fmt(KPIS.spent)}</div>
            <div className="gr__kpisub">{fmt(KPIS.remaining)} left this month</div>
          </div>
          <div className="gr__kpi" style={{ background: "var(--gr-sage-soft)" }}>
            <div className="gr__kpiico" style={{ background: "var(--gr-surface)", color: "var(--gr-good)" }}>
              <Leaf size={20} strokeWidth={2} />
            </div>
            <div className="gr__kpilabel">Saved</div>
            <div className="gr__kpival" style={{ color: "var(--gr-good)" }}>{fmt(KPIS.saved)}</div>
            <div className="gr__kpisub">goal {fmt(KPIS.savedTarget)} · ahead of pace</div>
          </div>
          <div className="gr__kpi">
            <div className="gr__kpiico" style={{ background: "var(--gr-clay-soft)", color: "var(--gr-primary)" }}>
              <INCOME.rsuIcon size={20} strokeWidth={2} />
            </div>
            <div className="gr__kpilabel">Savings rate</div>
            <div className="gr__kpival">{pct(KPIS.savingsRate)}</div>
            <div className="gr__kpisub">of {fmt(KPIS.income)} income</div>
          </div>
        </div>

        <section className="gr__sec">
          <h2 className="gr__sech">Where it went</h2>
          <div className="gr__grid">
            {EXPENSES.map((c) => (
              <GroveCard key={c.id} c={c} />
            ))}
          </div>
        </section>

        <section className="gr__sec">
          <h2 className="gr__sech">What you kept</h2>
          <div className="gr__grid">
            {SAVINGS.map((c) => (
              <GroveCard key={c.id} c={c} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
