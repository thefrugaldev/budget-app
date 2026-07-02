// PROTOTYPE — throwaway. Direction E · "Harvest+".
//
// A design-lead pass on the chosen direction D (Harvest). Same DNA — the warm
// Ledger palette, Bricolage + Nunito, the grove/columns signature — refined:
//   • Leads with a thesis hero (the money + momentum), not a small date label.
//   • Drops the templated 3-box KPI strip; folds the numbers into the hero and
//     the section subtotals (the brief calls out KPI-strip-over-grid to avoid).
//   • Makes savings the *visible* growth: a canopy trend line joins the savings
//     tops and the columns grow up from a soil line (one restrained, on-brief
//     load moment; the global reduced-motion layer curtails it automatically).
//   • Warm background wash, card hover-lift + focus-visible, a taller chart and
//     non-wrapping header on mobile.
// D is left untouched so the two can be compared side by side.

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
.hp { font-family: var(--proto-font-soft-body), system-ui, sans-serif; color: var(--hp-ink); min-height:100%;
  background: radial-gradient(130% 80% at 50% -12%, #fbf6ed 0%, var(--hp-bg) 58%);
  --hp-bg:#f1e8d7; --hp-surface:#fffdf7; --hp-ink:#221e17; --hp-muted:#6f6656; --hp-line:#e3d8c4;
  --hp-gold:#c68f22; --hp-good:#48895c; --hp-bad:#a8443f; --hp-accent:#9a7b3f; --hp-soil:#caab7d;
  --hp-gold-soft:#f1e6cf; --hp-good-soft:#e3ecdd; --hp-bad-soft:#f1ddd6; }
.dark .hp { background: radial-gradient(130% 80% at 50% -12%, #201b10 0%, var(--hp-bg) 62%);
  --hp-bg:#141109; --hp-surface:#211d15; --hp-ink:#efe7d8; --hp-muted:#a89e8b; --hp-line:#39342a;
  --hp-gold:#e0b84e; --hp-good:#86b590; --hp-bad:#db7d75; --hp-accent:#cba965; --hp-soil:#4d4331;
  --hp-gold-soft:#2c2416; --hp-good-soft:#232e24; --hp-bad-soft:#33211d; }
.hp__display { font-family: var(--proto-font-soft-display), system-ui, sans-serif; }
.hp__wrap { max-width:64rem; margin:0 auto; padding:2.5rem 1.5rem 9rem; }
.hp__eyebrow { font-size:.7rem; letter-spacing:.2em; text-transform:uppercase; color:var(--hp-muted); font-weight:700; }

.hp__hero { display:flex; justify-content:space-between; align-items:flex-start; gap:2rem; flex-wrap:wrap; margin-bottom:1.75rem; }
.hp__brandrow { display:flex; align-items:center; gap:.7rem; margin-bottom:1.1rem; }
.hp__mark { width:2.4rem; height:2.4rem; border-radius:50% 50% 50% 14%; background:linear-gradient(140deg,var(--hp-gold),var(--hp-good)); display:grid; place-items:center; color:#fff; }
.hp__headline { font-family:var(--proto-font-soft-display); font-size:clamp(2rem,4.6vw,3.1rem); line-height:1.04; font-weight:800; letter-spacing:-.025em; max-width:16ch; }
.hp__headline em { font-style:normal; color:var(--hp-good); }
.hp__sub { color:var(--hp-muted); margin-top:.85rem; font-size:1.02rem; line-height:1.5; max-width:38ch; }
.hp__aside { text-align:right; flex:none; }
.hp__rate { font-family:var(--proto-font-soft-display); font-size:2.6rem; font-weight:800; line-height:1; font-variant-numeric:tabular-nums; }
.hp__income { margin-top:.9rem; display:inline-flex; align-items:center; gap:.5rem; background:var(--hp-surface); border:1px solid var(--hp-line); border-radius:99px; padding:.45rem .9rem; font-size:.85rem; }
.hp__income b { font-family:var(--proto-font-soft-display); font-weight:800; font-variant-numeric:tabular-nums; }

.hp__panel { background:var(--hp-surface); border:1px solid var(--hp-line); border-radius:28px; padding:1.6rem 1.7rem; }
.hp__panelhead { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:.3rem; }
.hp__panelh2 { font-family:var(--proto-font-soft-display); font-size:1.25rem; font-weight:800; }
.hp__panelsub { font-size:.82rem; color:var(--hp-muted); margin-top:.15rem; }
.hp__badge { flex:none; display:inline-flex; align-items:center; gap:.3rem; white-space:nowrap; font-size:.72rem; font-weight:700; border-radius:99px; padding:.25rem .65rem; background:var(--hp-good-soft); color:var(--hp-good); }
.hp__legend { display:flex; gap:1.3rem; font-size:.78rem; color:var(--hp-muted); margin-top:.5rem; }
.hp__col { transform-box:fill-box; transform-origin:50% 100%; animation:hp-grow .7s cubic-bezier(.2,.7,.2,1) backwards; }
@keyframes hp-grow { from { transform:scaleY(0); } to { transform:scaleY(1); } }

.hp__sec { margin-top:2.4rem; }
.hp__sech { font-family:var(--proto-font-soft-display); font-size:1.2rem; font-weight:800; margin-bottom:1rem; display:flex; align-items:baseline; gap:.6rem; }
.hp__sech b { color:var(--hp-muted); font-family:var(--proto-font-soft-body); font-weight:700; font-size:.92rem; font-variant-numeric:tabular-nums; margin-left:auto; }
.hp__grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(232px,1fr)); gap:.9rem; }
.hp__card { border-radius:24px; padding:1.15rem 1.2rem; border:1px solid var(--hp-line); background:var(--hp-surface); transition:transform .18s ease, box-shadow .18s ease; }
.hp__card:hover { transform:translateY(-2px); box-shadow:0 12px 26px -14px rgba(60,42,12,.35); }
.hp__card:focus-visible { outline:none; box-shadow:0 0 0 2px var(--hp-bg), 0 0 0 4px var(--hp-accent); }
.hp__cardtop { display:flex; align-items:center; gap:.75rem; }
.hp__cardico { width:2.9rem; height:2.9rem; border-radius:50%; display:grid; place-items:center; flex:none; }
.hp__cardname { font-weight:700; font-size:1rem; }
.hp__cardcap { font-size:.74rem; color:var(--hp-muted); }
.hp__cardamt { font-family:var(--proto-font-soft-display); font-size:1.7rem; font-weight:800; margin-top:.9rem; font-variant-numeric:tabular-nums; }
.hp__track { height:9px; border-radius:99px; background:var(--hp-line); margin-top:.65rem; overflow:hidden; }
.hp__fill { height:100%; border-radius:99px; }
.hp__pill { display:inline-flex; align-items:center; gap:.3rem; font-size:.68rem; font-weight:700; border-radius:99px; padding:.22rem .6rem; margin-top:.75rem; }
@media (max-width:640px){
  .hp__aside { text-align:left; }
  .hp__sech b { margin-left:0; }
}
`;

function toneColor(tone: string) {
  return tone === "bad" ? "var(--hp-bad)" : tone === "warn" ? "var(--hp-gold)" : tone === "good" ? "var(--hp-good)" : "var(--hp-accent)";
}
function toneSoft(tone: string) {
  return tone === "bad" ? "var(--hp-bad-soft)" : tone === "warn" ? "var(--hp-gold-soft)" : "var(--hp-good-soft)";
}

function HarvestCard({ c }: { c: Cat }) {
  const state = thresholdState(c.kind, c.total, c.target);
  const tone = toneFor(c.kind, state);
  const ratio = c.target === 0 ? 0 : c.total / c.target;
  const col = toneColor(tone);
  const { Icon } = c;
  return (
    <div className="hp__card" tabIndex={0}>
      <div className="hp__cardtop">
        <span className="hp__cardico" style={{ background: toneSoft(tone), color: col }}>
          <Icon size={22} strokeWidth={2} />
        </span>
        <div>
          <div className="hp__cardname">{c.name}</div>
          <div className="hp__cardcap">
            {c.kind === "savings" ? "Goal" : "Cap"} {fmt(c.target)}/mo
          </div>
        </div>
      </div>
      <div className="hp__cardamt" style={{ color: col }}>
        {c.total < 0 ? `−${fmt(Math.abs(c.total))}` : fmt(c.total)}
      </div>
      <div className="hp__track">
        <span className="hp__fill" style={{ width: `${Math.min(100, ratio * 100)}%`, background: col }} />
      </div>
      <span className="hp__pill" style={{ background: toneSoft(tone), color: col }}>
        {c.kind === "savings" && <Leaf size={12} strokeWidth={2.4} />}
        {descriptorFor(c.kind, state)} · {pct(ratio)}
      </span>
    </div>
  );
}

function GrowthColumns() {
  const W = 760;
  const H = 250;
  const padX = 26;
  const baseline = 202;
  const plotH = 168;
  const domain = 6200;
  const budgetLine = KPIS.spentTarget + KPIS.savedTarget;
  const innerW = W - padX * 2;
  const step = innerW / MONTHLY.length;
  const barW = Math.min(46, step * 0.5);
  const h = (v: number) => (v / domain) * plotH;
  const targetY = baseline - h(budgetLine);

  const cols = MONTHLY.map((m, i) => {
    const cx = padX + step * (i + 0.5);
    const spendH = h(m.spend);
    const savedH = h(m.saved);
    const spendY = baseline - spendH;
    const savedY = spendY - savedH;
    return { m, i, cx, spendH, savedH, spendY, savedY };
  });
  const canopy = cols.map((c) => `${c.cx.toFixed(1)},${c.savedY.toFixed(1)}`).join(" ");
  const last = cols[cols.length - 1];

  return (
    <div className="hp__panel">
      <div className="hp__panelhead">
        <div>
          <h2 className="hp__panelh2">Your grove, month by month</h2>
          <p className="hp__panelsub">Savings (the canopy) climbing over spending, toward your {fmt(budgetLine)} plan</p>
        </div>
        <span className="hp__badge">
          <Leaf size={12} strokeWidth={2.4} /> Saving steadily
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Spending and savings per month, January to June, against the monthly plan">
        {/* soil */}
        <rect x={padX - 6} y={baseline} width={innerW + 12} height="6" rx="3" fill="var(--hp-soil)" opacity="0.5" />
        <line x1={padX - 6} y1={baseline} x2={W - padX + 6} y2={baseline} stroke="var(--hp-soil)" strokeWidth="2" />
        {/* plan line */}
        <line x1={padX} y1={targetY} x2={W - padX} y2={targetY} stroke="var(--hp-muted)" strokeWidth="1.5" strokeDasharray="6 5" opacity="0.55" />
        {/* Left-anchored so it never collides with the latest column's value label on the right. */}
        <text x={padX} y={targetY - 7} textAnchor="start" fontSize="11" fill="var(--hp-muted)" fontWeight="700">
          plan {fmt(budgetLine)}
        </text>
        {/* columns grow up from the soil */}
        {cols.map((c) => (
          <g key={c.m.label} className="hp__col" style={{ animationDelay: `${c.i * 70}ms` }}>
            <rect x={c.cx - barW / 2} y={c.spendY} width={barW} height={c.spendH} rx="8" fill="var(--hp-gold)" opacity={c.i === cols.length - 1 ? 1 : 0.82} />
            <rect x={c.cx - barW / 2} y={c.savedY} width={barW} height={c.savedH + 8} rx="8" fill="var(--hp-good)" opacity={c.i === cols.length - 1 ? 1 : 0.82} />
          </g>
        ))}
        {/* canopy trend line — savings is the thing that grows */}
        <polyline points={canopy} fill="none" stroke="var(--hp-good)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
        {cols.map((c) => (
          <circle key={c.m.label} cx={c.cx} cy={c.savedY} r="3" fill="var(--hp-good)" />
        ))}
        {/* latest bud + value */}
        <circle cx={last.cx} cy={last.savedY - 9} r="4.5" fill="var(--hp-good)" />
        <text x={last.cx} y={last.savedY - 18} textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--hp-good)" fontFamily="var(--proto-font-soft-display)">
          {fmt(last.m.saved)}
        </text>
        {/* month labels (outside the animated groups so they don't scale) */}
        {cols.map((c) => (
          <text key={c.m.label} x={c.cx} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--hp-muted)">
            {c.m.label}
          </text>
        ))}
      </svg>
      <div className="hp__legend">
        <span><span style={{ color: "var(--hp-gold)" }}>■</span> Spent</span>
        <span><span style={{ color: "var(--hp-good)" }}>■</span> Saved (canopy)</span>
      </div>
    </div>
  );
}

export function DirectionHarvestPlus() {
  return (
    <div className={`hp ${fontVars}`}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="hp__wrap">
        <header className="hp__hero">
          <div>
            <div className="hp__brandrow">
              <span className="hp__mark">
                <Leaf size={18} strokeWidth={2.2} />
              </span>
              <span className="hp__eyebrow">Pulse · June 2026</span>
            </div>
            <h1 className="hp__headline hp__display">
              You kept <em>{fmt(KPIS.saved)}</em> this month.
            </h1>
            <p className="hp__sub">
              That&rsquo;s {pct(KPIS.savingsRate)} of what you earned, and {fmt(KPIS.remaining)} under your
              spending cap — the canopy keeps climbing.
            </p>
          </div>
          <div className="hp__aside">
            <div className="hp__eyebrow">Savings rate</div>
            <div className="hp__rate" style={{ color: "var(--hp-good)" }}>{pct(KPIS.savingsRate)}</div>
            <div className="hp__income">
              <INCOME.Icon size={16} strokeWidth={2} style={{ color: "var(--hp-accent)" }} />
              Income <b>{fmt(INCOME.monthly)}</b>
            </div>
          </div>
        </header>

        <GrowthColumns />

        <section className="hp__sec">
          <h2 className="hp__sech">
            Where it went <b>{fmt(KPIS.spent)}</b>
          </h2>
          <div className="hp__grid">
            {EXPENSES.map((c) => (
              <HarvestCard key={c.id} c={c} />
            ))}
          </div>
        </section>

        <section className="hp__sec">
          <h2 className="hp__sech">
            What you kept <b>{fmt(KPIS.saved)}</b>
          </h2>
          <div className="hp__grid">
            {SAVINGS.map((c) => (
              <HarvestCard key={c.id} c={c} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
