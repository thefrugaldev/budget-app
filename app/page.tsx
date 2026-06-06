import { CategoryCard } from "@/components/budget/CategoryCard";
import { CATEGORIES, TRANSACTIONS } from "@/lib/fixtures/budget";
import {
  currentMonthKey,
  fmt,
  monthLabel,
  monthTotalsByCategory,
  ytdTotalsByCategory,
} from "@/lib/budget";

export default function Home() {
  const now = new Date();
  const monthKey = currentMonthKey(now);
  const ytd = ytdTotalsByCategory(TRANSACTIONS, CATEGORIES, now);
  const thisMonth = monthTotalsByCategory(TRANSACTIONS, CATEGORIES, monthKey);

  const expenses = CATEGORIES.filter((c) => c.kind === "expense");
  const savings = CATEGORIES.filter((c) => c.kind === "savings");
  const ytdExpense = expenses.reduce((s, c) => s + (ytd.get(c.id) ?? 0), 0);
  const ytdSavings = savings.reduce((s, c) => s + (ytd.get(c.id) ?? 0), 0);
  const monthsIn = now.getUTCMonth() + now.getUTCDate() / 30;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 pb-28">
      <header className="mb-8">
        <p className="text-sm text-muted-foreground">{monthLabel(monthKey)}</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Pulse</h1>
      </header>

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <HeroKpi emoji="💸" label="Spent YTD" value={fmt(ytdExpense)} />
        <HeroKpi emoji="🌱" label="Saved YTD" value={fmt(ytdSavings)} positive />
        <HeroKpi emoji="📅" label="Months in" value={monthsIn.toFixed(1)} sub="of 12" />
      </div>

      <SectionHeading>Expenses · this month</SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {expenses.map((c) => (
          <CategoryCard
            key={c.id}
            category={c}
            monthAmount={thisMonth.get(c.id) ?? 0}
            ytdAmount={ytd.get(c.id) ?? 0}
            transactions={TRANSACTIONS}
          />
        ))}
      </div>

      <div className="mt-8">
        <SectionHeading>Savings · this month</SectionHeading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {savings.map((c) => (
            <CategoryCard
              key={c.id}
              category={c}
              monthAmount={thisMonth.get(c.id) ?? 0}
              ytdAmount={ytd.get(c.id) ?? 0}
              transactions={TRANSACTIONS}
            />
          ))}
        </div>
      </div>

      <button
        className="fixed bottom-8 right-8 z-10 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-base font-medium text-primary-foreground shadow-lg ring-1 ring-black/10 hover:bg-primary/80"
        aria-label="Add transaction"
      >
        <span className="text-xl leading-none">+</span>
        <span>Add</span>
      </button>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

function HeroKpi({
  emoji,
  label,
  value,
  sub,
  positive,
}: {
  emoji: string;
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <div className="mb-2 text-2xl">{emoji}</div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          "mt-1 font-heading text-3xl font-semibold tabular-nums " +
          (positive ? "text-emerald-700 dark:text-emerald-400" : "")
        }
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
