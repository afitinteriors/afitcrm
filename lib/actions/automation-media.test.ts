import { describe, it, expect, vi, beforeEach } from "vitest";

// Step 8 media hardening: coverage for the automation media upload Server
// Action -- image/video/document classification, size limits, admin
// enforcement, and insert-failure storage cleanup. No real Supabase, no
// real Meta/WhatsApp calls, no production data.

let profileRole: "admin" | "staff" | null = "admin";
const storageUploads: { path: string; contentType: string; bytes: number }[] = [];
const storageRemovals: string[][] = [];
let uploadShouldFail = false;
let insertShouldFail = false;
let insertedRows: Record<string, unknown>[] = [];

vi.mock("@/lib/auth", () => ({
  getCurrentProfile: vi.fn(async () => (profileRole ? { id: "u1", role: profileRole } : null)),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    storage: {
      from: () => ({
        upload: vi.fn(async (path: string, bytes: Buffer, opts: { contentType: string }) => {
          storageUploads.push({ path, contentType: opts.contentType, bytes: bytes.length });
          if (uploadShouldFail) return { error: { message: "simulated storage failure" } };
          return { error: null };
        }),
        remove: vi.fn(async (paths: string[]) => {
          storageRemovals.push(paths);
          return { error: null };
        }),
      }),
    },
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      insert: (values: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            if (insertShouldFail) return { data: null, error: { message: "simulated insert failure" } };
            insertedRows.push(values);
            return { data: { ...values }, error: null };
          },
        }),
      }),
    }),
  })),
}));

const { uploadAutomationMedia } = await import("@/lib/actions/automation-media");

function fileOf(bytes: number, type: string, name = "asset"): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function form(file: File, name: string): FormData {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("name", name);
  return fd;
}

beforeEach(() => {
  profileRole = "admin";
  storageUploads.length = 0;
  storageRemovals.length = 0;
  uploadShouldFail = false;
  insertShouldFail = false;
  insertedRows = [];
});

describe("uploadAutomationMedia", () => {
  it("rejects non-admins before touching storage", async () => {
    profileRole = "staff";
    const result = await uploadAutomationMedia(null, form(fileOf(10, "image/png"), "n"));
    expect(result).toEqual({ error: "Admin access required." });
    expect(storageUploads).toHaveLength(0);
  });

  it("rejects an unauthenticated caller the same way", async () => {
    profileRole = null;
    const result = await uploadAutomationMedia(null, form(fileOf(10, "image/png"), "n"));
    expect(result).toEqual({ error: "Admin access required." });
  });

  it("accepts a valid PDF and classifies it as a document asset", async () => {
    const result = await uploadAutomationMedia(null, form(fileOf(1024, "application/pdf"), "Brochure"));
    expect(result).toHaveProperty("asset");
    expect(insertedRows[0]).toMatchObject({ media_type: "document", mime_type: "application/pdf" });
    expect(storageUploads[0].path).toMatch(/^outbound\/.+\.pdf$/);
  });

  it("accepts a valid JPEG image", async () => {
    const result = await uploadAutomationMedia(null, form(fileOf(1024, "image/jpeg"), "Render"));
    expect(result).toHaveProperty("asset");
    expect(insertedRows[0]).toMatchObject({ media_type: "image" });
  });

  it("accepts a valid MP4 video", async () => {
    const result = await uploadAutomationMedia(null, form(fileOf(1024, "video/mp4"), "Clip"));
    expect(result).toHaveProperty("asset");
    expect(insertedRows[0]).toMatchObject({ media_type: "video" });
  });

  it("rejects an unsupported MIME type (e.g. a Word document)", async () => {
    const result = await uploadAutomationMedia(
      null,
      form(fileOf(1024, "application/msword"), "n")
    );
    expect(result).toEqual({
      error: "Unsupported file type. Use JPEG or PNG for images, MP4 or 3GPP for videos, or PDF for documents.",
    });
    expect(storageUploads).toHaveLength(0);
  });

  it("rejects a PDF over the 100MB document limit without uploading", async () => {
    const result = await uploadAutomationMedia(
      null,
      form(fileOf(101 * 1024 * 1024, "application/pdf"), "n")
    );
    expect(result).toEqual({ error: "File is too large -- WhatsApp's own limit for documents is 100MB." });
    expect(storageUploads).toHaveLength(0);
  });

  it("rejects an image over the 5MB limit without uploading", async () => {
    const result = await uploadAutomationMedia(
      null,
      form(fileOf(6 * 1024 * 1024, "image/png"), "n")
    );
    expect(result).toEqual({ error: "File is too large -- WhatsApp's own limit for images is 5MB." });
    expect(storageUploads).toHaveLength(0);
  });

  it("rejects a missing name", async () => {
    const fd = new FormData();
    fd.set("file", fileOf(10, "application/pdf"));
    const result = await uploadAutomationMedia(null, fd);
    expect(result).toEqual({ error: "A name is required." });
  });

  it("rejects a missing file", async () => {
    const fd = new FormData();
    fd.set("name", "n");
    const result = await uploadAutomationMedia(null, fd);
    expect(result).toEqual({ error: "No file provided." });
  });

  it("fails safely and cleans up the storage object when the DB insert fails", async () => {
    insertShouldFail = true;
    const result = await uploadAutomationMedia(null, form(fileOf(1024, "application/pdf"), "n"));
    expect(result).toEqual({ error: "simulated insert failure" });
    expect(storageRemovals).toHaveLength(1);
    expect(storageRemovals[0][0]).toMatch(/^outbound\/.+\.pdf$/);
  });

  it("surfaces a storage upload failure without attempting an insert", async () => {
    uploadShouldFail = true;
    const result = await uploadAutomationMedia(null, form(fileOf(1024, "application/pdf"), "n"));
    expect(result).toEqual({ error: "Failed to upload file: simulated storage failure" });
    expect(insertedRows).toHaveLength(0);
  });
});
