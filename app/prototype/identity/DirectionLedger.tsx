// PROTOTYPE — throwaway. Direction A · "Ledger".
//
// Point of view: a personal finance *statement*, set like print. The justified
// risk is a high-contrast optical serif (Fraunces) on the money figures — the
// opposite of fintech's default grotesque — on warm paper, with hairline rules
// instead of cards. Layout risk: the dashboard is a right-aligned ruled ledger,
// not a card grid. Signature: an editorial timeline of spend against the
// monthly cap, the actual line crossing above (oxblood) / below (pine) a dashed
// target rule.

import {
  EXPENSES,
  SAVINGS,
  INCOME,
  KPIS,
  MONTHLY,
  EXPENSE_TARGET_LINE,
  fmt,
  pct,
  descriptorFor,
  thresholdState,
  toneFor,
} from "./data";
import { fontVars } from "./fonts";

type Cat = (typeof EXPENSES)[number];

const css = `
.la { font-family: var(--proto-font-clean), system-ui, sans-serif; background: var(--la-bg); color: var(--la-ink); min-height: 100%;
  --la-bg:#f5efe3; --la-surface:#fffdf7; --la-ink:#23201a; --la-muted:#726a5b; --la-line:#e0d6c3;
  --la-accent:#9a7b3f; --la-good:#3f6f4e; --la-warn:#a9791f; --la-bad:#8f3b3b; }
.dark .la { --la-bg:#16140e; --la-surface:#201d15; --la-ink:#ece5d6; --la-muted:#a89e8b; --la-line:#39342a;
  --la-accent:#cba965; --la-good:#77a281; --la-warn:#d3a552; --la-bad:#cd6f6f; }
.la__wrap { max-width: 64rem; margin: 0 auto; padding: 2.5rem 1.75rem 9rem; }
.la__serif { font-family: var(--proto-font-serif), Georgia, serif; }
.la__eyebrow { font-size: .68rem; letter-spacing: .22em; text-transform: uppercase; color: var(--la-muted); }
.la__masthead { display:flex; justify-content:space-between; align-items:flex-end; gap:1.5rem; flex-wrap:wrap;
  padding-bottom:1.1rem; border-bottom:2px solid var(--la-ink); }
.la__title { font-size: clamp(2.2rem, 5vw, 3.2rem); line-height:1; font-weight:600; letter-spacing:-.01em; margin-top:.35rem; }
.la__income { text-align:right; }
.la__income b { font-family: var(--proto-font-serif), serif; font-size:1.6rem; font-weight:600; font-variant-numeric: tabular-nums; }
.la__chips { display:flex; gap:1.4rem; margin:1.1rem 0 2rem; font-size:.82rem; }
.la__chip { color:var(--la-muted); padding-bottom:.15rem; }
.la__chip[data-on="1"] { color:var(--la-ink); border-bottom:2px solid var(--la-accent); font-weight:600; }
.la__panel { background:var(--la-surface); border:1px solid var(--la-line); border-radius:4px; padding:1.4rem 1.5rem; }
.la__panelhead { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:.9rem; }
.la__legend { display:flex; gap:1.1rem; font-size:.72rem; color:var(--la-muted); }
.la__swatch { display:inline-block; width:.7rem; height:.7rem; border-radius:2px; margin-right:.35rem; vertical-align:-1px; }
.la__kpis { display:grid; grid-template-columns: repeat(3, 1fr); margin:2.2rem 0; border-top:1px solid var(--la-line); border-bottom:1px solid var(--la-line); }
.la__kpi { padding:1.3rem 1.4rem; }
.la__kpi + .la__kpi { border-left:1px solid var(--la-line); }
.la__kpival { font-family: var(--proto-font-serif), serif; font-size:2.6rem; line-height:1; font-weight:600; font-variant-numeric: tabular-nums; letter-spacing:-.02em; }
.la__kpisub { font-size:.74rem; color:var(--la-muted); margin-top:.5rem; }
.la__section { margin-top:2.4rem; }
.la__sechead { display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid var(--la-ink); padding-bottom:.5rem; }
.la__row { display:grid; grid-template-columns: auto 1fr auto; align-items:center; gap:1rem; padding:.95rem .1rem; border-bottom:1px solid var(--la-line); }
.la__ico { width:2.4rem; height:2.4rem; display:grid; place-items:center; border:1px solid var(--la-line); border-radius:3px; color:var(--la-ink); }
.la__name { font-weight:500; font-size:1rem; }
.la__meta { font-size:.74rem; color:var(--la-muted); margin-top:.1rem; }
.la__amtcol { text-align:right; min-width:9rem; }
.la__amt { font-family: var(--proto-font-serif), serif; font-size:1.5rem; font-weight:600; font-variant-numeric: tabular-nums; }
.la__tag { font-size:.62rem; letter-spacing:.08em; text-transform:uppercase; color:var(--la-muted); margin-left:.5rem; }
.la__bar { margin-top:.5rem; height:2px; background:var(--la-line); position:relative; overflow:hidden; }
.la__barfill { position:absolute; inset:0 auto 0 0; height:100%; }
`;

function toneColor(tone: string) {
  return tone === "bad" ? "var(--la-bad)" : tone === "warn" ? "var(--la-warn)" : tone === "good" ? "var(--la-good)" : "var(--la-ink)";
}

function LedgerRow({ c }: { c: Cat }) {
  const state = thresholdState(c.kind, c.total, c.target);
  const tone = toneFor(c.kind, state);
  const ratio = c.target === 0 ? 0 : Math.min(1.15, c.total / c.target);
  const { Icon } = c;
  return (
    <div className="la__row">
      <div className="la__ico">
        <Icon size={19} strokeWidth={1.25} />
      </div>
      <div>
        <div className="la__name">{c.name}</div>
        <div className="la__meta">
          {c.kind === "savings" ? "Goal" : "Cap"} · {fmt(c.target)}/mo
        </div>
        <div className="la__bar">
          <span
            className="la__barfill"
            style={{ width: `${Math.min(100, ratio * 100)}%`, background: toneColor(tone) }}
          />
        </div>
      </div>
      <div className="la__amtcol">
        <span className="la__amt" style={{ color: toneColor(tone) }}>
          {c.total < 0 ? `(${fmt(Math.abs(c.total))})` : fmt(c.total)}
        </span>
        <div className="la__meta">
          {pct(c.target === 0 ? 0 : c.total / c.target)} · {descriptorFor(c.kind, state)}
        </div>
      </div>
    </div>
  );
}

function TimelineSignature() {
  const W = 760;
  const H = 210;
  const padX = 10;
  const padTop = 16;
  const padBottom = 30;
  const min = 3400;
  const max = 4600;
  const plotW = W - padX * 2;
  const plotH = H - padTop - padBottom;
  const x = (i: number) => padX + (i * plotW) / (MONTHLY.length - 1);
  const y = (v: number) => padTop + (1 - (v - min) / (max - min)) * plotH;
  const line = MONTHLY.map((m, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(m.spend).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(MONTHLY.length - 1).toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${x(0).toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`;
  const targetY = y(EXPENSE_TARGET_LINE);
  return (
    <div className="la__panel">
      <div className="la__panelhead">
        <div>
          <div className="la__eyebrow">The Ledger Line</div>
          <div className="la__serif" style={{ fontSize: "1.15rem", fontWeight: 600, marginTop: ".2rem" }}>
            Monthly spend against cap
          </div>
        </div>
        <div className="la__legend">
          <span>
            <span className="la__swatch" style={{ background: "var(--la-good)" }} />
            Under cap
          </span>
          <span>
            <span className="la__swatch" style={{ background: "var(--la-bad)" }} />
            Over cap
          </span>
          <span>— — cap {fmt(EXPENSE_TARGET_LINE)}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Spend against monthly cap, January to June">
        <defs>
          <linearGradient id="la-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--la-accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--la-accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#la-fill)" />
        <line x1={padX} y1={targetY} x2={W - padX} y2={targetY} stroke="var(--la-ink)" strokeWidth="1" strokeDasharray="5 4" opacity="0.55" />
        <path d={line} fill="none" stroke="var(--la-ink)" strokeWidth="2" />
        {MONTHLY.map((m, i) => (
          <g key={m.label}>
            <circle cx={x(i)} cy={y(m.spend)} r="3.2" fill={m.spend > EXPENSE_TARGET_LINE ? "var(--la-bad)" : "var(--la-good)"} />
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--la-muted)" fontFamily="var(--proto-font-serif), serif">
              {m.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function DirectionLedger() {
  return (
    <div className={`la ${fontVars}`}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="la__wrap">
        <header className="la__masthead">
          <div>
            <div className="la__eyebrow">Pulse · Monthly ledger</div>
            <h1 className="la__title la__serif">June 2026</h1>
          </div>
          <div className="la__income">
            <div className="la__eyebrow">Income</div>
            <b>{fmt(INCOME.monthly)}</b>
            <div className="la__meta" style={{ marginTop: ".2rem" }}>
              + {fmt(INCOME.rsu)} RSU vest
            </div>
          </div>
        </header>

        <nav className="la__chips">
          <span className="la__chip" data-on="1">This month</span>
          <span className="la__chip">Last month</span>
          <span className="la__chip">Quarter</span>
          <span className="la__chip">Year</span>
        </nav>

        <TimelineSignature />

        <div className="la__kpis">
          <div className="la__kpi">
            <div className="la__eyebrow">Spent</div>
            <div className="la__kpival">{fmt(KPIS.spent)}</div>
            <div className="la__kpisub">{fmt(KPIS.remaining)} under cap of {fmt(KPIS.spentTarget)}</div>
          </div>
          <div className="la__kpi">
            <div className="la__eyebrow">Saved</div>
            <div className="la__kpival" style={{ color: "var(--la-good)" }}>{fmt(KPIS.saved)}</div>
            <div className="la__kpisub">Goal {fmt(KPIS.savedTarget)} · ahead</div>
          </div>
          <div className="la__kpi">
            <div className="la__eyebrow">Savings rate</div>
            <div className="la__kpival">{pct(KPIS.savingsRate)}</div>
            <div className="la__kpisub">of {fmt(KPIS.income)} income</div>
          </div>
        </div>

        <section className="la__section">
          <div className="la__sechead">
            <span className="la__eyebrow">Expenses</span>
            <span className="la__eyebrow">{fmt(KPIS.spent)}</span>
          </div>
          {EXPENSES.map((c) => (
            <LedgerRow key={c.id} c={c} />
          ))}
        </section>

        <section className="la__section">
          <div className="la__sechead">
            <span className="la__eyebrow">Savings</span>
            <span className="la__eyebrow">{fmt(KPIS.saved)}</span>
          </div>
          {SAVINGS.map((c) => (
            <LedgerRow key={c.id} c={c} />
          ))}
        </section>
      </div>
    </div>
  );
}
