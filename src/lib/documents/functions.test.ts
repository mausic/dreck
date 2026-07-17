import { describe, expect, it, vi } from "vitest";

import { deleteDesignDocumentResult } from "@/lib/documents/functions";

const DESIGN_ID = "00000000-0000-4000-8000-000000000001";

describe("deleteDesignDocumentResult", () => {
  it("returns the deleted design identifier", async () => {
    const deleteRecord = vi.fn(() => Promise.resolve(true));

    await expect(
      deleteDesignDocumentResult(DESIGN_ID, deleteRecord),
    ).resolves.toEqual({ ok: true, id: DESIGN_ID });
    expect(deleteRecord).toHaveBeenCalledWith(DESIGN_ID);
  });

  it("distinguishes a missing design from a database failure", async () => {
    await expect(
      deleteDesignDocumentResult(DESIGN_ID, () => Promise.resolve(false)),
    ).resolves.toEqual({ ok: false, error: "Extracted design not found." });
    await expect(
      deleteDesignDocumentResult(DESIGN_ID, () =>
        Promise.reject(new Error("database detail")),
      ),
    ).resolves.toEqual({
      ok: false,
      error: "The extracted design could not be deleted.",
    });
  });
});
