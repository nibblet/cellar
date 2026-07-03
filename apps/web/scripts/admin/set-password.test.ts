import { describe, expect, it, vi } from "vitest";
import { ensureCellarUserProfile } from "./set-password";

function createSupabaseDouble(existingProfile: { id: string } | null = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: existingProfile });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ select, insert });
  const schema = vi.fn().mockReturnValue({ from });

  return {
    supabase: { schema },
    schema,
    from,
    select,
    eq,
    maybeSingle,
    insert,
  };
}

describe("ensureCellarUserProfile", () => {
  it("creates the missing profile in the cellar schema", async () => {
    const double = createSupabaseDouble();

    const result = await ensureCellarUserProfile({
      supabase: double.supabase,
      userId: "cf7290be-99e5-458f-aec7-71f3825107a4",
      nameFirst: "Paul",
      nameLastInitial: "c",
    });

    expect(result).toBe("created");
    expect(double.schema).toHaveBeenCalledWith("cellar");
    expect(double.from).toHaveBeenCalledWith("users");
    expect(double.insert).toHaveBeenCalledWith({
      id: "cf7290be-99e5-458f-aec7-71f3825107a4",
      name_first: "Paul",
      name_last_initial: "C",
    });
  });

  it("does not insert when names are missing", async () => {
    const double = createSupabaseDouble();

    const result = await ensureCellarUserProfile({
      supabase: double.supabase,
      userId: "cf7290be-99e5-458f-aec7-71f3825107a4",
    });

    expect(result).toBe("missing_names");
    expect(double.insert).not.toHaveBeenCalled();
  });
});
