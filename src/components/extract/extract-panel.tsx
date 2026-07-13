/**
 * `ExtractPanel` — the extraction scaffolding, mounted above the deck preview on `/`.
 *
 * Each zone (design first, then content) lets you either pick an already-extracted document from
 * the DB or drop a new PDF. On upload, the `extractDocument` server function runs the extraction
 * stages (design → design system; content → Mistral markdown + the deterministic section tree),
 * persists them, and folds the freshly-stored doc into the picker so it can be re-selected.
 * Picking an existing document simply marks it chosen; a subsequent upload clears that selection
 * (and vice versa), so the drop target stays live either way. Only a fresh upload renders the
 * result blocks below: the content result shows the stored raw
 * markdown (to eyeball that tables survived) beside the collapsible section tree, and the design
 * result shows the extracted design system (fonts + palette). It lives on the home page rather
 * than a separate route because extraction is the front of the same flow that produces the
 * preview below.
 */
import { useEffect, useState } from "react";
import type { ISection } from "@/lib/extract/section";
import type { TExtractDocumentResult } from "@/lib/extract/extract-schema";
import type { ITokens } from "@/lib/slides/types";
import { extractDocument } from "@/lib/extract/extract-document";
import {
  listRecentContentDocs,
  listRecentDesignDocs,
} from "@/lib/ai/generate-deck";
import { Badge } from "@/components/ui/badge";
import { FileDropzone } from "@/components/ui/dropzone";
import { Label } from "@/components/ui/label";

type TRole = "content" | "design";

/**
 * A pickable already-extracted document (newest first) for a zone's "existing" dropdown. Design
 * docs also carry their cached design system, so re-selecting one can preview it below.
 */
type TDocOption = {
  id: string;
  sourceName: string;
  designTokens?: ITokens | null;
  designFeel?: string | null;
};

/** Per-role state: an existing selection, or a chosen file with its in-flight/extraction result. */
type TExtractState = {
  file: File | null;
  pending: boolean;
  result: TExtractDocumentResult | null;
  /** Id of the chosen existing document, or "" when uploading / nothing chosen. */
  selectedId: string;
};

const EMPTY_STATE: TExtractState = {
  file: null,
  pending: false,
  result: null,
  selectedId: "",
};

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

/** The extracted design system (palette swatches + fonts + feel note) for a design document. */
function DesignSystemView({
  sourceName,
  id,
  tokens,
  feel,
}: {
  sourceName: string;
  id: string;
  tokens: ITokens;
  feel?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <h3 className="text-sm font-semibold">
        Extracted design system{" "}
        <span className="text-muted-foreground font-normal">
          ({sourceName} · id {id.slice(0, 8)})
        </span>
      </h3>
      <div className="flex flex-wrap gap-3">
        {Object.entries(tokens.colors).map(([colorRole, hex]) => (
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
        ))}
      </div>
      <div className="text-muted-foreground text-xs">
        <p>
          <span className="font-medium">display:</span> {tokens.fonts.display}
        </p>
        <p>
          <span className="font-medium">body:</span> {tokens.fonts.body}
        </p>
        {feel && <p className="mt-1 italic">“{feel}”</p>}
      </div>
    </div>
  );
}

/** One zone: an optional "existing document" picker over the DB, then a drop-to-upload target. */
function PdfZone({
  idBase,
  label,
  hint,
  docs,
  state,
  onFile,
  onSelectExisting,
}: {
  idBase: string;
  label: string;
  hint: string;
  docs: Array<TDocOption>;
  state: TExtractState;
  onFile: (file: File | null) => void;
  onSelectExisting: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`${idBase}-pdf`}>{label}</Label>

      {/* The picker only appears once the DB has documents of this role to offer. */}
      {docs.length > 0 && (
        <>
          <select
            aria-label={`Select an existing ${label}`}
            value={state.selectedId}
            onChange={(event) => onSelectExisting(event.target.value)}
            disabled={state.pending}
            className="border-input bg-background h-9 rounded-md border px-3 text-sm disabled:opacity-50"
          >
            <option value="">Select an existing document…</option>
            {docs.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.sourceName} · {doc.id.slice(0, 8)}
              </option>
            ))}
          </select>
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <span className="bg-border h-px flex-1" />
            or upload new
            <span className="bg-border h-px flex-1" />
          </div>
        </>
      )}

      <FileDropzone
        id={`${idBase}-pdf`}
        accept=".pdf,application/pdf"
        fileKind="PDF"
        hint={hint}
        file={state.file}
        pending={state.pending}
        status={statusLine(state)}
        onFileSelect={onFile}
      />

      {state.result && !state.result.ok && (
        <p className="border-destructive/50 text-destructive rounded-md border p-3 text-sm">
          {state.result.error}
        </p>
      )}
    </div>
  );
}

export function ExtractPanel() {
  const [content, setContent] = useState<TExtractState>(EMPTY_STATE);
  const [design, setDesign] = useState<TExtractState>(EMPTY_STATE);
  const [contentDocs, setContentDocs] = useState<Array<TDocOption>>([]);
  const [designDocs, setDesignDocs] = useState<Array<TDocOption>>([]);

  // Load already-extracted documents so each zone can offer them instead of a re-upload.
  useEffect(() => {
    let active = true;
    listRecentContentDocs()
      .then((res) => {
        if (active && res.ok) setContentDocs(res.docs);
      })
      .catch(() => {
        /* soft — the picker just stays hidden */
      });
    listRecentDesignDocs()
      .then((res) => {
        if (active && res.ok) setDesignDocs(res.docs);
      })
      .catch(() => {
        /* soft — the picker just stays hidden */
      });
    return () => {
      active = false;
    };
  }, []);

  /** Read the file, extract under `role`, stream states, and fold the new doc into the picker. */
  async function runExtract(
    role: TRole,
    file: File,
    setState: (next: TExtractState) => void,
    setDocs: React.Dispatch<React.SetStateAction<Array<TDocOption>>>,
  ) {
    setState({ file, pending: true, result: null, selectedId: "" });
    try {
      const pdfBase64 = await readAsBase64(file);
      const res = await extractDocument({
        data: { role, sourceName: file.name, pdfBase64 },
      });
      setState({ file, pending: false, result: res, selectedId: "" });
      if (res.ok) {
        // Newest first, de-duped, so the just-uploaded doc is immediately reselectable — and a
        // design upload carries its tokens so re-selecting it can preview the design system.
        setDocs((prev) => [
          {
            id: res.id,
            sourceName: res.sourceName,
            designTokens: res.designTokens ?? null,
            designFeel: res.designFeel ?? null,
          },
          ...prev.filter((doc) => doc.id !== res.id),
        ]);
      }
    } catch (error) {
      setState({
        file,
        pending: false,
        result: {
          ok: false,
          error: error instanceof Error ? error.message : "Upload failed.",
        },
        selectedId: "",
      });
    }
  }

  /** Drop-zone callback: clear on removal, otherwise kick off extraction for the role. */
  function handleFile(
    role: TRole,
    setState: (next: TExtractState) => void,
    setDocs: React.Dispatch<React.SetStateAction<Array<TDocOption>>>,
    file: File | null,
  ) {
    if (!file) {
      setState(EMPTY_STATE);
      return;
    }
    void runExtract(role, file, setState, setDocs);
  }

  /** Existing-doc dropdown callback: choose a stored document (or clear back to empty). */
  function handleSelectExisting(
    setState: (next: TExtractState) => void,
    id: string,
  ) {
    setState(id ? { ...EMPTY_STATE, selectedId: id } : EMPTY_STATE);
  }

  // Which design system to preview: a fresh upload's result, or the design system cached on an
  // existing design doc chosen from the picker. The two are mutually exclusive by construction
  // (uploading clears the selection and vice versa), so at most one is active.
  const selectedDesignDoc = design.selectedId
    ? designDocs.find((doc) => doc.id === design.selectedId)
    : undefined;
  const designSystem =
    design.result?.ok && design.result.designTokens
      ? {
          sourceName: design.result.sourceName,
          id: design.result.id,
          tokens: design.result.designTokens,
          feel: design.result.designFeel,
        }
      : selectedDesignDoc?.designTokens
        ? {
            sourceName: selectedDesignDoc.sourceName,
            id: selectedDesignDoc.id,
            tokens: selectedDesignDoc.designTokens,
            feel: selectedDesignDoc.designFeel,
          }
        : null;

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <div>
        <h2 className="text-sm font-semibold">Extract from PDF</h2>
        <p className="text-muted-foreground text-sm">
          For each source pick an already-extracted document or drop a new PDF —
          uploads are stored (design → a design system; content → table-aware
          markdown + a generic section tree).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PdfZone
          idBase="design"
          label="Design PDF"
          hint="The styled deck whose fonts + palette define the look."
          docs={designDocs}
          state={design}
          onFile={(file) =>
            handleFile("design", setDesign, setDesignDocs, file)
          }
          onSelectExisting={(id) => handleSelectExisting(setDesign, id)}
        />

        <PdfZone
          idBase="content"
          label="Content PDF"
          hint="The reference document your slides draw their content from."
          docs={contentDocs}
          state={content}
          onFile={(file) =>
            handleFile("content", setContent, setContentDocs, file)
          }
          onSelectExisting={(id) => handleSelectExisting(setContent, id)}
        />
      </div>

      {designSystem && (
        <DesignSystemView
          sourceName={designSystem.sourceName}
          id={designSystem.id}
          tokens={designSystem.tokens}
          feel={designSystem.feel}
        />
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
