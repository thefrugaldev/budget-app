import { requireHouseholdId } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { COLLECTIONS } from "@/lib/db/collections";
import { monthDateRange } from "@/lib/db/dates";
import { getCategoriesByIds } from "@/lib/repositories/categories";
import type { MonthlySpendByCategory } from "@/types/budget";

type SpendAggregateRow = {
  _id: string;
  total: number;
};

// Uses only $match + $group — supported on Atlas and Cosmos Mongo API.
// Category names are joined in app code to avoid $lookup.
export async function getMonthlySpendByCategory(
  year: number,
  month: number,
): Promise<MonthlySpendByCategory[]> {
  const householdId = await requireHouseholdId();
  const db = await getDb();

  const { start, end } = monthDateRange(year, month);
  const rows = await db
    .collection(COLLECTIONS.transactions)
    .aggregate<SpendAggregateRow>([
      { $match: { householdId, date: { $gte: start, $lte: end } } },
      { $group: { _id: "$categoryId", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
    ])
    .toArray();

  const categories = await getCategoriesByIds(rows.map((row) => row._id));

  return rows.map((row) => {
    const category = categories.get(row._id);
    return {
      categoryId: row._id,
      categoryName: category?.name ?? "Unknown category",
      total: row.total,
    };
  });
}
