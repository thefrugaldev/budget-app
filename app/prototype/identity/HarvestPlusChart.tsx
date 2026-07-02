"use client";

// PROTOTYPE — throwaway. The interactive Growth Columns for variant E.
//
// Split into a client component so months are explorable: hovering OR
// keyboard-focusing a column reveals its spent/saved/rate, and Escape
// dismisses it. Each column carries an aria-label with the same numbers, so
// screen-reader users get the data without needing the visual tooltip
// (WCAG 1.4.13 — content on hover/focus). Consumes the hp__ classes from
// DirectionHarvestPlus's stylesheet (same subtree).

import { useState } from "react";
import { Leaf } from "lucide-react";
import { KPIS, MONTHLY, fmt, pct } from "./data";

const W = 760;
const H = 250;
const PAD_X = 26;
const BASELINE = 202;
const PLOT_H = 168;
const DOMAIN = 6200;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function HarvestPlusChart() {
  const [active, setActive] = useState<number | null>(null);

  const budgetLine = KPIS.spentTarget + KPIS.savedTarget;
  const innerW = W - PAD_X * 2;
  const step = innerW / MONTHLY.length;
  const barW = Math.min(46, step * 0.5);
  const h = (v: number) => (v / DOMAIN) * PLOT_H;
  const targetY = BASELINE - h(budgetLine);

  const cols = MONTHLY.map((m, i) => {
    const cx = PAD_X + step * (i + 0.5);
    const spendH = h(m.spend);
    const savedH = h(m.saved);
    const spendY = BASELINE - spendH;
    const savedY = spendY - savedH;
    return { m, i, cx, spendH, savedH, spendY, savedY };
  });
  const canopy = cols.map((c) => `${c.cx.toFixed(1)},${c.savedY.toFixed(1)}`).join(" ");
  const last = cols[cols.length - 1];
  const clear = (i: number) => setActive((a) => (a === i ? null : a));

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

      <div className="hp__chartwrap">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Spending and savings per month, January to June, against the monthly plan. Focus a column for its detail.">
          {/* soil */}
          <rect x={PAD_X - 6} y={BASELINE} width={innerW + 12} height="6" rx="3" fill="var(--hp-soil)" opacity="0.5" />
          <line x1={PAD_X - 6} y1={BASELINE} x2={W - PAD_X + 6} y2={BASELINE} stroke="var(--hp-soil)" strokeWidth="2" />
          {/* plan line (left-anchored label so it can't collide with the latest value) */}
          <line x1={PAD_X} y1={targetY} x2={W - PAD_X} y2={targetY} stroke="var(--hp-muted)" strokeWidth="1.5" strokeDasharray="6 5" opacity="0.55" />
          <text x={PAD_X} y={targetY - 7} textAnchor="start" fontSize="11" fill="var(--hp-muted)" fontWeight="700">
            plan {fmt(budgetLine)}
          </text>
          {/* active-column backdrop */}
          {active !== null && (
            <rect x={cols[active].cx - step / 2 + 3} y={8} width={step - 6} height={BASELINE - 8} rx="12" fill="var(--hp-accent)" opacity="0.1" />
          )}
          {/* columns grow up from the soil */}
          {cols.map((c) => (
            <g key={c.m.label} className="hp__col" style={{ animationDelay: `${c.i * 70}ms` }}>
              <rect x={c.cx - barW / 2} y={c.spendY} width={barW} height={c.spendH} rx="8" fill="var(--hp-gold)" opacity={active === c.i || c.i === cols.length - 1 ? 1 : 0.82} />
              <rect x={c.cx - barW / 2} y={c.savedY} width={barW} height={c.savedH + 8} rx="8" fill="var(--hp-good)" opacity={active === c.i || c.i === cols.length - 1 ? 1 : 0.82} />
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
            <text key={c.m.label} x={c.cx} y={H - 8} textAnchor="middle" fontSize="12" fill={active === c.i ? "var(--hp-ink)" : "var(--hp-muted)"} fontWeight={active === c.i ? 700 : 400}>
              {c.m.label}
            </text>
          ))}
          {/* focusable / hoverable hit targets — same info exposed to AT via aria-label */}
          {cols.map((c) => (
            <rect
              key={c.m.label}
              className="hp__hit"
              x={PAD_X + step * c.i}
              y={8}
              width={step}
              height={BASELINE - 8}
              fill="transparent"
              tabIndex={0}
              role="img"
              aria-label={`${c.m.label} 2026 — spent ${fmt(c.m.spend)}, saved ${fmt(c.m.saved)}, savings rate ${pct(c.m.rate)}`}
              onMouseEnter={() => setActive(c.i)}
              onMouseLeave={() => clear(c.i)}
              onFocus={() => setActive(c.i)}
              onBlur={() => clear(c.i)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setActive(null);
              }}
            />
          ))}
        </svg>

        {active !== null && (
          <div
            className="hp__tip"
            role="presentation"
            style={{
              left: `${clamp((cols[active].cx / W) * 100, 15, 85)}%`,
              top: `${(cols[active].savedY / H) * 100}%`,
            }}
          >
            <div className="hp__tiptitle">{cols[active].m.label} 2026</div>
            <div className="hp__tiprow">
              <span>Spent</span>
              <b style={{ color: "var(--hp-gold)" }}>{fmt(cols[active].m.spend)}</b>
            </div>
            <div className="hp__tiprow">
              <span>Saved</span>
              <b style={{ color: "var(--hp-good)" }}>{fmt(cols[active].m.saved)}</b>
            </div>
            <div className="hp__tiprow hp__tiprate">
              <span>Savings rate</span>
              <b>{pct(cols[active].m.rate)}</b>
            </div>
          </div>
        )}
      </div>

      <div className="hp__legend">
        <span><span style={{ color: "var(--hp-gold)" }}>■</span> Spent</span>
        <span><span style={{ color: "var(--hp-good)" }}>■</span> Saved (canopy)</span>
        <span className="hp__hint">Hover or focus a month for detail</span>
      </div>
    </div>
  );
}
