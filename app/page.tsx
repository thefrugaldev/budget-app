export default function Home() {
  const month = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold">Budget</h1>
        <p className="text-sm text-zinc-500">{month}</p>
      </header>

      <section className="rounded-lg border border-zinc-200 p-6">
        <h2 className="mb-4 text-lg font-medium">Spend by category</h2>
        <p className="text-sm text-zinc-500">
          No transactions yet. Connect storage to start tracking spend.
        </p>
      </section>
    </main>
  );
}
