import { beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` is provided by Next's bundler, not installed as a resolvable
// package, so the action's transitive DB imports fail to load under vitest
// without this stub.
vi.mock("server-only", () => ({}));
// The action's three side-effecting seams — stubbed so these tests exercise the
// pure form-data → repository-call translation (the bit that can silently
// mis-map a cleared institution) without a session, a DB, or the Next cache.
vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/repositories/accounts");

import { createAccount, updateAccount } from "@/lib/repositories/accounts";

import { createAccountAction, updateAccountAction } from "./net-worth";
import { NET_WORTH_ACTION_INITIAL } from "./net-worth-state";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks(); // reset call history so each test reads its own call, not an accrued one
  vi.mocked(createAccount).mockResolvedValue({ id: "acct-1", name: "A", class: "asset" });
  vi.mocked(updateAccount).mockResolvedValue({ ok: true });
});

describe("createAccountAction — institution (#195)", () => {
  it("passes a provided institution through to createAccount", async () => {
    await createAccountAction(
      NET_WORTH_ACTION_INITIAL,
      form({ name: "HYSA", class: "asset", kind: "cash", balance: "100", institution: "  Ally  " }),
    );
    expect(vi.mocked(createAccount).mock.calls[0][0]).toMatchObject({ institution: "Ally" });
  });

  it("passes institution: undefined for a blank field (created without one)", async () => {
    await createAccountAction(
      NET_WORTH_ACTION_INITIAL,
      form({ name: "HYSA", class: "asset", kind: "cash", balance: "100", institution: "   " }),
    );
    expect(vi.mocked(createAccount).mock.calls[0][0].institution).toBeUndefined();
  });
});

describe("updateAccountAction — institution (#195)", () => {
  it("sets a provided institution on the patch", async () => {
    await updateAccountAction(
      NET_WORTH_ACTION_INITIAL,
      form({ id: "acct-1", name: "HYSA", class: "asset", kind: "cash", balance: "100", institution: "Fidelity" }),
    );
    const patch = vi.mocked(updateAccount).mock.calls[0][1];
    expect(patch.institution).toBe("Fidelity");
    expect(patch.clearInstitution).toBeUndefined();
  });

  it("maps a blanked field to clearInstitution (never institution: '') so the old value is $unset", async () => {
    await updateAccountAction(
      NET_WORTH_ACTION_INITIAL,
      form({ id: "acct-1", name: "HYSA", class: "asset", kind: "cash", balance: "100", institution: "" }),
    );
    const patch = vi.mocked(updateAccount).mock.calls[0][1];
    expect(patch.clearInstitution).toBe(true);
    expect(patch.institution).toBeUndefined();
  });
});
