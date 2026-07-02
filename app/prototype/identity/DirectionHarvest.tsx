// PROTOTYPE — throwaway. Direction D · "Harvest".
//
// A convergence variant from owner feedback: Ledger's (A) warm palette — gold,
// oxblood, forest/sage greens, and the dark-brown ground — paired with Grove's
// (C) rounded humanist type (Bricolage + Nunito) and soft tinted-circle icons.
// Structure and signature follow Grove (rounded cards + Growth Columns), so the
// only thing that changes vs C is the color system. A and C are left untouched.

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
.hv { font-family: var(--proto-font-soft-body), system-ui, sans-serif; background: var(--hv-bg); color: var(--hv-ink); min-height:100%;
  --hv-bg:#f5efe3; --hv-surface:#fffdf7; --hv-ink:#23201a; --hv-muted:#726a5b; --hv-line:#e0d6c3;
  /* Signal colors lifted together (~+6-7% lightness, a touch more saturation):
     warn=Moderate gold, good/bad brightened by the same step so the palette
     stays balanced rather than a lone bright yellow over muddy red/green. */
  --hv-gold:#9a7b3f; --hv-good:#48895c; --hv-warn:#c68f22; --hv-bad:#a8443f;
  --hv-gold-soft:#f0e6d0; --hv-good-soft:#e3ecdd; --hv-bad-soft:#f1ddd6; }
.dark .hv { --hv-bg:#16140e; --hv-surface:#201d15; --hv-ink:#ece5d6; --hv-muted:#a89e8b; --hv-line:#39342a;
  --hv-gold:#cba965; --hv-good:#86b590; --hv-warn:#e0b84e; --hv-bad:#db7d75;
  --hv-gold-soft:#2c2416; --hv-good-soft:#232e24; --hv-bad-soft:#33211d; }
.hv__display { font-family: var(--proto-font-soft-display), system-ui, sans-serif; }
.hv__wrap { max-width:64rem; margin:0 auto; padding:2.25rem 1.5rem 9rem; }
.hv__head { display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap; margin-bottom:1.75rem; }
.hv__brand { display:flex; align-items:center; gap:.7rem; }
.hv__mark { width:2.6rem; height:2.6rem; border-radius:50% 50% 50% 12%; background:linear-gradient(135deg,var(--hv-gold),var(--hv-good)); display:grid; place-items:center; color:#fff; }
.hv__hello { font-size:.8rem; color:var(--hv-muted); }
.hv__month { font-family: var(--proto-font-soft-display); font-size:1.5rem; font-weight:700; line-height:1; }
.hv__incpill { background:var(--hv-surface); border:1px solid var(--hv-line); border-radius:99px; padding:.55rem 1.1rem; display:flex; align-items:center; gap:.6rem; }
.hv__incval { font-family: var(--proto-font-soft-display); font-weight:700; font-size:1.15rem; font-variant-numeric: tabular-nums; }
.hv__panel { background:var(--hv-surface); border:1px solid var(--hv-line); border-radius:28px; padding:1.6rem 1.7rem; }
.hv__panelhead { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:.4rem; gap:1rem; }
.hv__panelh2 { font-family: var(--proto-font-soft-display); font-size:1.2rem; font-weight:700; }
.hv__panelsub { font-size:.8rem; color:var(--hv-muted); }
.hv__kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin:1.5rem 0 2.25rem; }
@media (max-width:640px){ .hv__kpis{ grid-template-columns:1fr; } }
.hv__kpi { border-radius:24px; padding:1.3rem 1.4rem; border:1px solid var(--hv-line); }
.hv__kpiico { width:2.6rem; height:2.6rem; border-radius:50%; display:grid; place-items:center; margin-bottom:.8rem; }
.hv__kpilabel { font-size:.78rem; color:var(--hv-muted); }
.hv__kpival { font-family: var(--proto-font-soft-display); font-size:2.3rem; font-weight:700; line-height:1; margin-top:.15rem; font-variant-numeric: tabular-nums; }
.hv__kpisub { font-size:.76rem; color:var(--hv-muted); margin-top:.4rem; }
.hv__sec { margin-top:2.25rem; }
.hv__sech { font-family: var(--proto-font-soft-display); font-size:1.1rem; font-weight:700; margin-bottom:.9rem; }
.hv__grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:.9rem; }
.hv__card { border-radius:24px; padding:1.1rem 1.2rem; border:1px solid var(--hv-line); background:var(--hv-surface); }
.hv__cardtop { display:flex; align-items:center; gap:.75rem; }
.hv__cardico { width:2.9rem; height:2.9rem; border-radius:50%; display:grid; place-items:center; flex:none; }
.hv__cardname { font-weight:700; font-size:.98rem; }
.hv__cardcap { font-size:.74rem; color:var(--hv-muted); }
.hv__cardamt { font-family: var(--proto-font-soft-display); font-size:1.6rem; font-weight:700; margin-top:.9rem; font-variant-numeric: tabular-nums; }
.hv__track { height:9px; border-radius:99px; background:var(--hv-line); margin-top:.6rem; overflow:hidden; }
.hv__fill { height:100%; border-radius:99px; }
.hv__pill { display:inline-flex; align-items:center; gap:.3rem; font-size:.68rem; font-weight:700; border-radius:99px; padding:.2rem .6rem; margin-top:.7rem; }
`;

function toneColor(tone: string) {
  return tone === "bad" ? "var(--hv-bad)" : tone === "warn" ? "var(--hv-warn)" : tone === "good" ? "var(--hv-good)" : "var(--hv-gold)";
}
function toneSoft(tone: string) {
  return tone === "bad" ? "var(--hv-bad-soft)" : tone === "warn" ? "var(--hv-gold-soft)" : tone === "good" ? "var(--hv-good-soft)" : "var(--hv-gold-soft)";
}

function HarvestCard({ c }: { c: Cat }) {
  const state = thresholdState(c.kind, c.total, c.target);
  const tone = toneFor(c.kind, state);
  const ratio = c.target === 0 ? 0 : c.total / c.target;
  const col = toneColor(tone);
  const { Icon } = c;
  return (
    <div className="hv__card">
      <div className="hv__cardtop">
        <span className="hv__cardico" style={{ background: toneSoft(tone), color: col }}>
          <Icon size={22} strokeWidth={2} />
        </span>
        <div>
          <div className="hv__cardname">{c.name}</div>
          <div className="hv__cardcap">
            {c.kind === "savings" ? "Goal" : "Cap"} {fmt(c.target)}/mo
          </div>
        </div>
      </div>
      <div className="hv__cardamt" style={{ color: col }}>
        {c.total < 0 ? `−${fmt(Math.abs(c.total))}` : fmt(c.total)}
      </div>
      <div className="hv__track">
        <span className="hv__fill" style={{ width: `${Math.min(100, ratio * 100)}%`, background: col }} />
      </div>
      <span className="hv__pill" style={{ background: toneSoft(tone), color: col }}>
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
  const domain = 6200;
  const budgetLine = KPIS.spentTarget + KPIS.savedTarget;
  const step = (W - 40) / MONTHLY.length;
  const barW = Math.min(52, step * 0.62);
  const h = (v: number) => (v / domain) * plotH;
  const targetY = baseline - h(budgetLine);
  return (
    <div className="hv__panel">
      <div className="hv__panelhead">
        <div>
          <div className="hv__panelh2">Growing your grove</div>
          <div className="hv__panelsub">Spend + savings each month, climbing toward your {fmt(budgetLine)} plan</div>
        </div>
        <span className="hv__pill" style={{ background: "var(--hv-good-soft)", color: "var(--hv-good)" }}>
          <Leaf size={12} strokeWidth={2.4} /> Saving steadily
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Spend and savings per month, January to June, against the monthly plan">
        <line x1="20" y1={targetY} x2={W - 20} y2={targetY} stroke="var(--hv-muted)" strokeWidth="1.5" strokeDasharray="6 5" opacity="0.6" />
        <text x={W - 22} y={targetY - 6} textAnchor="end" fontSize="11" fill="var(--hv-muted)">
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
              <rect x={x} y={spendY} width={barW} height={spendH} rx="9" fill="var(--hv-warn)" opacity={last ? 1 : 0.85} />
              <rect x={x} y={savedY} width={barW} height={savedH + 10} rx="9" fill="var(--hv-good)" opacity={last ? 1 : 0.85} />
              {last && <circle cx={cx} cy={savedY - 4} r="5" fill="var(--hv-good)" />}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--hv-muted)">
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: "1.2rem", fontSize: ".76rem", color: "var(--hv-muted)", marginTop: ".4rem" }}>
        <span><span style={{ color: "var(--hv-warn)" }}>■</span> Spent</span>
        <span><span style={{ color: "var(--hv-good)" }}>■</span> Saved</span>
      </div>
    </div>
  );
}

export function DirectionHarvest() {
  const SpendIcon = EXPENSES[0].Icon;
  return (
    <div className={`hv ${fontVars}`}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="hv__wrap">
        <header className="hv__head">
          <div className="hv__brand">
            <span className="hv__mark">
              <Leaf size={20} strokeWidth={2.2} />
            </span>
            <div>
              <div className="hv__hello">Your Pulse</div>
              <div className="hv__month">June 2026</div>
            </div>
          </div>
          <div className="hv__incpill">
            <INCOME.Icon size={18} strokeWidth={2} style={{ color: "var(--hv-gold)" }} />
            <span className="hv__cardcap">Income</span>
            <span className="hv__incval">{fmt(INCOME.monthly)}</span>
          </div>
        </header>

        <GrowthColumns />

        <div className="hv__kpis">
          <div className="hv__kpi" style={{ background: "var(--hv-gold-soft)" }}>
            <div className="hv__kpiico" style={{ background: "var(--hv-surface)", color: "var(--hv-gold)" }}>
              <SpendIcon size={20} strokeWidth={2} />
            </div>
            <div className="hv__kpilabel">Spent</div>
            <div className="hv__kpival">{fmt(KPIS.spent)}</div>
            <div className="hv__kpisub">{fmt(KPIS.remaining)} left this month</div>
          </div>
          <div className="hv__kpi" style={{ background: "var(--hv-good-soft)" }}>
            <div className="hv__kpiico" style={{ background: "var(--hv-surface)", color: "var(--hv-good)" }}>
              <Leaf size={20} strokeWidth={2} />
            </div>
            <div className="hv__kpilabel">Saved</div>
            <div className="hv__kpival" style={{ color: "var(--hv-good)" }}>{fmt(KPIS.saved)}</div>
            <div className="hv__kpisub">goal {fmt(KPIS.savedTarget)} · ahead of pace</div>
          </div>
          <div className="hv__kpi">
            <div className="hv__kpiico" style={{ background: "var(--hv-gold-soft)", color: "var(--hv-gold)" }}>
              <INCOME.rsuIcon size={20} strokeWidth={2} />
            </div>
            <div className="hv__kpilabel">Savings rate</div>
            <div className="hv__kpival">{pct(KPIS.savingsRate)}</div>
            <div className="hv__kpisub">of {fmt(KPIS.income)} income</div>
          </div>
        </div>

        <section className="hv__sec">
          <h2 className="hv__sech">Where it went</h2>
          <div className="hv__grid">
            {EXPENSES.map((c) => (
              <HarvestCard key={c.id} c={c} />
            ))}
          </div>
        </section>

        <section className="hv__sec">
          <h2 className="hv__sech">What you kept</h2>
          <div className="hv__grid">
            {SAVINGS.map((c) => (
              <HarvestCard key={c.id} c={c} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
