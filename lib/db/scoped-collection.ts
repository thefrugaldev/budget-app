import type {
  AggregationCursor,
  Collection,
  Document,
  Filter,
  FindCursor,
  OptionalUnlessRequiredId,
  UpdateFilter,
  UpdateOptions,
  WithId,
} from "mongodb";

/**
 * The ownership stamp every household-owned document carries. Kept structural
 * (rather than importing `HouseholdOwned` from `documents.ts`) so this stays a
 * pure, driver-only module with no app imports — unit-testable against a mock
 * `Collection` without pulling the session/Clerk chain.
 */
type HouseholdOwned = { householdId?: string };

/**
 * A MongoDB collection pre-bound to one household (#121). Every read merges
 * `{ householdId }` into the filter, every write stamps it, and every
 * aggregation is prefixed with a household `$match` — so a repository *cannot*
 * issue an unscoped query through this wrapper. It makes "forgot to scope by
 * household" unrepresentable at the data seam, rather than a filter each repo
 * has to remember to add (the silent-omission risk that outlived chunk 4's
 * manual scoping — #111 story 14).
 *
 * Deliberately narrow: it exposes only the operations the repositories use, and
 * only in their scoped form. Genuinely app-global data (the quote cache) and the
 * pre-/cross-household write paths (bootstrap backfill, seed) use raw `getDb()`
 * instead — they resolve or predate the request's household.
 *
 * The `scopedCollection` factory pairs an instance with the resolved household;
 * this class holds only the merging logic so it can be tested in isolation.
 */
export class ScopedCollection<T extends HouseholdOwned & Document> {
  constructor(
    private readonly collection: Collection<T>,
    private readonly householdId: string,
  ) {}

  find(filter: Filter<T> = {}): FindCursor<WithId<T>> {
    return this.collection.find(this.scopedFilter(filter));
  }

  findOne(filter: Filter<T> = {}): Promise<WithId<T> | null> {
    return this.collection.findOne(this.scopedFilter(filter));
  }

  countDocuments(
    filter: Filter<T> = {},
    options?: Parameters<Collection<T>["countDocuments"]>[1],
  ): Promise<number> {
    return this.collection.countDocuments(this.scopedFilter(filter), options);
  }

  aggregate<R extends Document>(pipeline: Document[]): AggregationCursor<R> {
    // Prefix a household `$match` so no stage can read across households,
    // whatever the caller's pipeline does afterward.
    return this.collection.aggregate<R>([
      { $match: { householdId: this.householdId } },
      ...pipeline,
    ]);
  }

  insertOne(doc: OptionalUnlessRequiredId<T>) {
    return this.collection.insertOne(this.stamped(doc));
  }

  insertMany(docs: OptionalUnlessRequiredId<T>[]) {
    return this.collection.insertMany(docs.map((doc) => this.stamped(doc)));
  }

  updateOne(
    filter: Filter<T>,
    update: UpdateFilter<T> | Partial<T>,
    options?: UpdateOptions,
  ) {
    return this.collection.updateOne(this.scopedFilter(filter), update, options);
  }

  updateMany(
    filter: Filter<T>,
    update: UpdateFilter<T> | Partial<T>,
    options?: UpdateOptions,
  ) {
    return this.collection.updateMany(this.scopedFilter(filter), update, options);
  }

  deleteOne(filter: Filter<T> = {}) {
    return this.collection.deleteOne(this.scopedFilter(filter));
  }

  deleteMany(filter: Filter<T> = {}) {
    return this.collection.deleteMany(this.scopedFilter(filter));
  }

  /** Merge the bound household into a read/update/delete filter. */
  private scopedFilter(filter: Filter<T>): Filter<T> {
    // Cast: `Filter<T>` is a conditional type the object spread widens; the
    // result (the caller's fields plus a `householdId` equality) is exactly the
    // shape the driver expects.
    return { ...filter, householdId: this.householdId } as Filter<T>;
  }

  /** Stamp the bound household onto a document being inserted. */
  private stamped(doc: OptionalUnlessRequiredId<T>): OptionalUnlessRequiredId<T> {
    return { ...doc, householdId: this.householdId } as OptionalUnlessRequiredId<T>;
  }
}
