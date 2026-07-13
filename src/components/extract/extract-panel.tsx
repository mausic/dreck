/**
 * `ExtractPanel` — the extraction scaffolding, mounted above the deck preview on `/`.
 *
 * Drop a content PDF and/or a design PDF → the `extractDocument` server function runs the two
 * extraction stages (Mistral markdown, then the deterministic section tree) and persists them.
 * Each drop-zone uploads its own role independently: the content result renders as stored raw
 * markdown (to eyeball that tables survived) beside the collapsible generic section tree, and
 * the design result renders the extracted design system (fonts + palette). It lives on the home
 * page rather than a separate route because extraction is the front of the same flow that
 * produces the preview below.
 */
import { useState } from "react";
import type { ISection } from "@/lib/extract/section";
import type { TExtractDocumentResult } from "@/lib/extract/extract-schema";
import { extractDocument } from "@/lib/extract/extract-document";
import { Badge } from "@/components/ui/badge";
import { FileDropzone } from "@/components/ui/dropzone";
import { Label } from "@/components/ui/label";

type TRole = "content" | "design";

/** Per-role upload state: the chosen file, whether extraction is in flight, and its result. */
type TExtractState = {
  file: File | null;
  pending: boolean;
  result: TExtractDocumentResult | null;
};

const EMPTY_STATE: TExtractState = { file: null, pending: false, result: null };

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

/** The short status line rendered under a drop-zone's filename while/after it uploads. */
function statusLine(state: TExtractState): React.ReactNode {
  if (state.pending) return "Extracting…";
  if (state.result?.ok)
    return (
      <span className="text-primary">
        Extracted · id {state.result.id.slice(0, 8)}
      </span>
    );
  return null;
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
  const [content, setContent] = useState<TExtractState>(EMPTY_STATE);
  const [design, setDesign] = useState<TExtractState>(EMPTY_STATE);

  /** Read the file, extract it under `role`, and stream the states into `setState`. */
  async function runExtract(
    role: TRole,
    file: File,
    setState: (next: TExtractState) => void,
  ) {
    setState({ file, pending: true, result: null });
    try {
      const pdfBase64 = await readAsBase64(file);
      const res = await extractDocument({
        data: { role, sourceName: file.name, pdfBase64 },
      });
      setState({ file, pending: false, result: res });
    } catch (error) {
      setState({
        file,
        pending: false,
        result: {
          ok: false,
          error: error instanceof Error ? error.message : "Upload failed.",
        },
      });
    }
  }

  /** Drop-zone callback: clear on removal, otherwise kick off extraction for the role. */
  function handleSelect(
    role: TRole,
    setState: (next: TExtractState) => void,
    file: File | null,
  ) {
    if (!file) {
      setState(EMPTY_STATE);
      return;
    }
    void runExtract(role, file, setState);
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div>
        <h2 className="text-sm font-semibold">Extract from PDF</h2>
        <p className="text-muted-foreground text-sm">
          Drop a content PDF and a design PDF — each is stored as table-aware
          markdown + a generic section tree; the design PDF also yields a design
          system.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="content-pdf">Content PDF</Label>
          <FileDropzone
            id="content-pdf"
            accept=".pdf,application/pdf"
            fileKind="PDF"
            hint="The reference document your slides draw their content from."
            file={content.file}
            pending={content.pending}
            status={statusLine(content)}
            onFileSelect={(file) => handleSelect("content", setContent, file)}
          />
          {content.result && !content.result.ok && (
            <p className="border-destructive/50 text-destructive rounded-md border p-3 text-sm">
              {content.result.error}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="design-pdf">Design PDF</Label>
          <FileDropzone
            id="design-pdf"
            accept=".pdf,application/pdf"
            fileKind="PDF"
            hint="The styled deck whose fonts + palette define the look."
            file={design.file}
            pending={design.pending}
            status={statusLine(design)}
            onFileSelect={(file) => handleSelect("design", setDesign, file)}
          />
          {design.result && !design.result.ok && (
            <p className="border-destructive/50 text-destructive rounded-md border p-3 text-sm">
              {design.result.error}
            </p>
          )}
        </div>
      </div>

      {design.result?.ok && design.result.designTokens && (
        <div className="flex flex-col gap-3 rounded-md border p-4">
          <h3 className="text-sm font-semibold">
            Extracted design system{" "}
            <span className="text-muted-foreground font-normal">
              ({design.result.sourceName} · id {design.result.id.slice(0, 8)})
            </span>
          </h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(design.result.designTokens.colors).map(
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
              {design.result.designTokens.fonts.display}
            </p>
            <p>
              <span className="font-medium">body:</span>{" "}
              {design.result.designTokens.fonts.body}
            </p>
            {design.result.designFeel && (
              <p className="mt-1 italic">“{design.result.designFeel}”</p>
            )}
          </div>
        </div>
      )}

      {content.result?.ok && (
        <div className="grid min-h-0 gap-6 lg:grid-cols-2">
          <div className="flex min-h-0 flex-col gap-2">
            <h3 className="text-sm font-semibold">
              Stored markdown{" "}
              <span className="text-muted-foreground font-normal">
                ({content.result.sourceName} · {content.result.role} · id{" "}
                {content.result.id.slice(0, 8)})
              </span>
            </h3>
            <pre className="bg-muted/50 max-h-[50vh] overflow-auto rounded-md border p-3 text-xs whitespace-pre">
              {content.result.markdown}
            </pre>
          </div>
          <div className="flex min-h-0 flex-col gap-2">
            <h3 className="text-sm font-semibold">
              Section tree{" "}
              <span className="text-muted-foreground font-normal">
                ({content.result.sections.length} root
                {content.result.sections.length === 1 ? "" : "s"})
              </span>
            </h3>
            <div className="max-h-[50vh] space-y-2 overflow-auto rounded-md border p-3">
              {content.result.sections.map((section) => (
                <SectionNode key={section.id} section={section} />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
