import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(async () => ({ error: null })),
      })),
    })),
    storage: {
      getBucket: vi.fn(async (name: string) => ({
        data: { name },
        error: null,
      })),
    },
  })),
}));

import { GET } from "./route";

describe("Health route smoke test", () => {
  it("returns 200 ok with database, auth, and storage status", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      database: "supabase-connected",
      authentication: "supabase",
      storage: "supabase-configured",
    });
    expect(typeof body.timestamp).toBe("string");
  });
});
