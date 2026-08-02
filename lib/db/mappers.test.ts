import { describe, expect, it } from "vitest";

import type {
  CategoryDocument,
  HouseholdDocument,
  InviteDocument,
  MemberDocument,
  TargetSuggestionDismissalDocument,
  TransactionDocument,
  UserDocument,
} from "./documents";
import {
  toCategory,
  toHousehold,
  toInvite,
  toMember,
  toTargetSuggestionDismissal,
  toTransaction,
  toUser,
} from "./mappers";

describe("toCategory", () => {
  const baseDoc: CategoryDocument = {
    _id: "cat-1",
    name: "Salary",
    emoji: "💼",
    kind: "income",
    activeFrom: "2026-01",
    createdAt: new Date("2026-01-15T00:00:00Z"),
  };

  it("passes through a well-formed document", () => {
    const cat = toCategory({
      ...baseDoc,
      activeUntil: "2026-12",
      incomeFrequency: "recurring",
      payCadence: "bi-weekly",
    });
    expect(cat).toEqual({
      id: "cat-1",
      name: "Salary",
      emoji: "💼",
      kind: "income",
      activeFrom: "2026-01",
      activeUntil: "2026-12",
      incomeFrequency: "recurring",
      payCadence: "bi-weekly",
    });
  });

  it("leaves activeUntil undefined when the document omits it", () => {
    expect(toCategory(baseDoc).activeUntil).toBeUndefined();
  });

  it("normalizes a leaked Mongo null on activeUntil to undefined", () => {
    // Mongo writes `null` (not omitted) when an insert payload includes
    // `activeUntil: undefined`. Without normalisation that null leaks into
    // checks like `activeUntil !== undefined`, fooling them and crashing
    // downstream calls like `monthLabel(activeUntil!).split('-')`.
    const doc = { ...baseDoc, activeUntil: null as unknown as string };
    expect(toCategory(doc).activeUntil).toBeUndefined();
  });

  it("backfills a legacy income document with no frequency to 'recurring' (story 8)", () => {
    // An income doc predating #46 has no `incomeFrequency` stored.
    expect(toCategory(baseDoc).incomeFrequency).toBe("recurring");
  });

  it("leaves a one-time income document's stored frequency intact", () => {
    const doc = { ...baseDoc, incomeFrequency: "one-time" as const };
    expect(toCategory(doc).incomeFrequency).toBe("one-time");
  });

  it("does not assign a frequency to non-income categories", () => {
    const expenseDoc = { ...baseDoc, kind: "expense" as const };
    expect(toCategory(expenseDoc).incomeFrequency).toBeUndefined();
  });

  it("reads payCadence through and leaves it undefined when unset (story 10 fallback)", () => {
    expect(toCategory(baseDoc).payCadence).toBeUndefined();
    const withCadence = { ...baseDoc, payCadence: "bi-weekly" as const };
    expect(toCategory(withCadence).payCadence).toBe("bi-weekly");
  });

  it("normalizes a leaked Mongo null on payCadence to undefined", () => {
    const doc = { ...baseDoc, payCadence: null as unknown as undefined };
    expect(toCategory(doc).payCadence).toBeUndefined();
  });

  it("reads firstPaycheckDate through and normalizes unset/null to undefined", () => {
    expect(toCategory(baseDoc).firstPaycheckDate).toBeUndefined();
    const withDate = { ...baseDoc, firstPaycheckDate: "2026-06-15" };
    expect(toCategory(withDate).firstPaycheckDate).toBe("2026-06-15");
    const leaked = {
      ...baseDoc,
      firstPaycheckDate: null as unknown as undefined,
    };
    expect(toCategory(leaked).firstPaycheckDate).toBeUndefined();
  });

  it("does not leak the tenancy householdId onto the budget domain type", () => {
    // householdId is a persistence/tenancy concern (chunk 2) — the budget
    // domain Category must not carry it.
    const owned = { ...baseDoc, householdId: "h1" };
    expect(toCategory(owned)).not.toHaveProperty("householdId");
  });
});

describe("toTransaction", () => {
  it("does not leak the tenancy householdId onto the budget domain type", () => {
    // Parity with the toCategory guard: the persistence layer carries
    // householdId, the budget domain Transaction must not.
    const doc: TransactionDocument = {
      _id: "t1",
      categoryId: "c1",
      amount: 12.5,
      date: "2026-06-08",
      householdId: "h1",
      createdAt: new Date("2026-06-08T00:00:00Z"),
    };
    expect(toTransaction(doc)).not.toHaveProperty("householdId");
  });
});

describe("toUser", () => {
  it("reassembles the Clerk-agnostic provider link from flat document fields", () => {
    const doc: UserDocument = {
      _id: "u1",
      email: "owner@example.com",
      provider: "clerk",
      providerSubjectId: "user_clerk_123",
      createdAt: new Date("2026-07-03T00:00:00Z"),
    };
    expect(toUser(doc)).toEqual({
      id: "u1",
      email: "owner@example.com",
      provider: { provider: "clerk", subjectId: "user_clerk_123" },
    });
  });
});

describe("toHousehold", () => {
  it("projects the id and drops persistence-only fields", () => {
    const doc: HouseholdDocument = {
      _id: "h1",
      createdAt: new Date("2026-07-03T00:00:00Z"),
    };
    expect(toHousehold(doc)).toEqual({ id: "h1" });
  });
});

describe("toMember", () => {
  it("passes through the tenancy association", () => {
    const doc: MemberDocument = {
      _id: "m1",
      householdId: "h1",
      userId: "u1",
      role: "editor",
      createdAt: new Date("2026-07-03T00:00:00Z"),
    };
    expect(toMember(doc)).toEqual({
      userId: "u1",
      householdId: "h1",
      role: "editor",
    });
  });
});

describe("toInvite", () => {
  it("passes through the grant without the createdAt/acceptedAt persistence fields", () => {
    const doc: InviteDocument = {
      _id: "i1",
      householdId: "h1",
      email: "Spouse@Example.com",
      role: "viewer",
      status: "pending",
      createdAt: new Date("2026-07-03T00:00:00Z"),
    };
    expect(toInvite(doc)).toEqual({
      id: "i1",
      householdId: "h1",
      // Email is passed through verbatim — normalization happens at match time.
      email: "Spouse@Example.com",
      role: "viewer",
      status: "pending",
    });
  });
});

describe("toTargetSuggestionDismissal", () => {
  it("drops persistence fields and projects dismissedAt to an ISO string", () => {
    const doc: TargetSuggestionDismissalDocument = {
      _id: "d1",
      householdId: "h1",
      categoryId: "daycare",
      dismissedMedian: 1300,
      dismissedAgainstTarget: 1000,
      dismissedAt: new Date("2026-07-15T12:34:56Z"),
    };
    expect(toTargetSuggestionDismissal(doc)).toEqual({
      categoryId: "daycare",
      dismissedMedian: 1300,
      dismissedAgainstTarget: 1000,
      dismissedAt: "2026-07-15T12:34:56.000Z",
    });
  });
});
