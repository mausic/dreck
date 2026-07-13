/**
 * `ExtractPanel` — the extraction scaffolding, mounted above the deck preview on `/`.
 *
 * Upload a reference/design PDF → the `extractDocument` server function runs the two
 * extraction stages (Mistral markdown, then the deterministic section tree) and persists
 * them → this panel renders the stored raw markdown (to eyeball that tables survived) beside
 * the collapsible generic section tree. It lives on the home page rather than a separate
 * route because extraction is the front of the same flow that produces the preview below.
 */
import { useState } from "react";
import type { ISection } from "@/lib/extract/section";
import type { TExtractDocumentResult } from "@/lib/extract/extract-schema";
import { extractDocument } from "@/lib/extract/extract-document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type TRole = "content" | "design";

/** Read a File to base64 (without the `data:…;base64,` prefix) for the JSON payload. */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected file read result"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/** One node of the section tree, rendered as a collapsible block, recursing into children. */
function SectionNode({ section }: { section: ISection }) {
  return (
    <details
      open
      className="border-border/60 rounded-md border-l-2 pl-3 [&_details]:mt-2"
    >
      <summary className="flex cursor-pointer items-center gap-2 text-sm">
        <code className="text-muted-foreground text-xs">{section.id}</code>
        <Badge variant="secondary" className="font-mono text-[10px]">
          {section.kind}
        </Badge>
        <span className="font-medium">{section.title || "(untitled)"}</span>
      </summary>
      {section.content && (
        <pre className="bg-muted/50 text-muted-foreground mt-2 overflow-x-auto rounded p-2 text-xs whitespace-pre-wrap">
          {section.content}
        </pre>
      )}
      {section.children?.map((child) => (
        <SectionNode key={child.id} section={child} />
      ))}
    </details>
  );
}

export function ExtractPanel() {
  const [role, setRole] = useState<TRole>("content");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<TExtractDocumentResult | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file || pending) return;
    setPending(true);
    setResult(null);
    try {
      const pdfBase64 = await readAsBase64(file);
      const res = await extractDocument({
        data: { role, sourceName: file.name, pdfBase64 },
      });
      setResult(res);
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : "Upload failed.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Extract from PDF</h2>
          <p className="text-muted-foreground text-sm">
            Upload a PDF → stored table-aware markdown + generic section tree.
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap items-end gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pdf">Reference PDF</Label>
            <input
              id="pdf"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as TRole)}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              <option value="content">content</option>
              <option value="design">design</option>
            </select>
          </div>
          <Button type="submit" disabled={!file || pending}>
            {pending ? "Extracting…" : "Extract"}
          </Button>
        </form>
      </div>

      {result && !result.ok && (
        <p className="border-destructive/50 text-destructive rounded-md border p-4 text-sm">
          {result.error}
        </p>
      )}

      {result?.ok && result.designTokens && (
        <div className="flex flex-col gap-3 rounded-md border p-4">
          <h3 className="text-sm font-semibold">
            Extracted design system{" "}
            <span className="text-muted-foreground font-normal">
              ({result.sourceName} · id {result.id.slice(0, 8)})
            </span>
          </h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(result.designTokens.colors).map(
              ([colorRole, hex]) => (
                <div key={colorRole} className="flex items-center gap-2">
                  <span
                    className="h-8 w-8 rounded border"
                    style={{ background: hex }}
                  />
                  <span className="text-xs">
                    <span className="font-medium">{colorRole}</span>
                    <br />
                    <code className="text-muted-foreground">{hex}</code>
                  </span>
                </div>
              ),
            )}
          </div>
          <div className="text-muted-foreground text-xs">
            <p>
              <span className="font-medium">display:</span>{" "}
              {result.designTokens.fonts.display}
            </p>
            <p>
              <span className="font-medium">body:</span>{" "}
              {result.designTokens.fonts.body}
            </p>
            {result.designFeel && (
              <p className="mt-1 italic">“{result.designFeel}”</p>
            )}
          </div>
        </div>
      )}

      {result?.ok && !result.designTokens && (
        <div className="grid min-h-0 gap-6 lg:grid-cols-2">
          <div className="flex min-h-0 flex-col gap-2">
            <h3 className="text-sm font-semibold">
              Stored markdown{" "}
              <span className="text-muted-foreground font-normal">
                ({result.sourceName} · {result.role} · id{" "}
                {result.id.slice(0, 8)})
              </span>
            </h3>
            <pre className="bg-muted/50 max-h-[50vh] overflow-auto rounded-md border p-3 text-xs whitespace-pre">
              {result.markdown}
            </pre>
          </div>
          <div className="flex min-h-0 flex-col gap-2">
            <h3 className="text-sm font-semibold">
              Section tree{" "}
              <span className="text-muted-foreground font-normal">
                ({result.sections.length} root
                {result.sections.length === 1 ? "" : "s"})
              </span>
            </h3>
            <div className="max-h-[50vh] space-y-2 overflow-auto rounded-md border p-3">
              {result.sections.map((section) => (
                <SectionNode key={section.id} section={section} />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
