import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TDocOption } from "@/lib/documents/queries";
import { documentsKeys } from "@/lib/documents/queries";
import { extractDocument } from "@/lib/extract/extract-document";
import { cn } from "@/lib/utils";
import { FileDropzone } from "@/components/ui/dropzone";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TDocumentSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  docs: Array<TDocOption>;
  placeholder?: string;
  noneLabel?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  className?: string;
};

function docLabel(doc: TDocOption): string {
  return `${doc.sourceName} · ${doc.id.slice(0, 8)}`;
}

export function DocumentSelect({
  value,
  onValueChange,
  docs,
  placeholder = "Select a document…",
  noneLabel,
  disabled,
  id,
  ariaLabel,
  className,
}: TDocumentSelectProps) {
  return (
    <Select
      value={value === "" ? null : value}
      onValueChange={(next) => onValueChange(next ?? "")}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn("w-full", className)}
      >
        <SelectValue placeholder={placeholder}>
          {(selected: string | null) => {
            if (selected == null) return noneLabel ?? placeholder;
            const doc = docs.find((d) => d.id === selected);
            return doc ? docLabel(doc) : selected;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {noneLabel != null && <SelectItem value={null}>{noneLabel}</SelectItem>}
        {docs.map((doc) => (
          <SelectItem key={doc.id} value={doc.id}>
            {docLabel(doc)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type TUploadState = {
  file: File | null;
  pending: boolean;
  error: string | null;
};

const EMPTY_UPLOAD: TUploadState = { file: null, pending: false, error: null };

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

type TDocumentPickerProps = {
  /** Which kind of document this field provides — drives extraction + which cache is updated. */
  role: "content" | "design";
  /** Selected document id, or `""` for none. */
  value: string;
  /** Called when a document is chosen (from the list) or a fresh upload is stored + auto-selected. */
  onValueChange: (value: string) => void;
  docs: Array<TDocOption>;
  /** Helper line shown in the dropzone's empty state. */
  hint: string;
  placeholder?: string;
  noneLabel?: string;
  /** Id for the select trigger (or the dropzone when there is nothing to select yet). */
  id?: string;
  ariaLabel?: string;
};

export function DocumentPicker({
  role,
  value,
  onValueChange,
  docs,
  hint,
  placeholder,
  noneLabel,
  id,
  ariaLabel,
}: TDocumentPickerProps) {
  const queryClient = useQueryClient();
  const [upload, setUpload] = useState<TUploadState>(EMPTY_UPLOAD);
  const hasExisting = docs.length > 0;

  /** Extract the dropped file, fold the new doc into the shared cache, and select it. */
  async function runExtract(file: File) {
    setUpload({ file, pending: true, error: null });
    try {
      const pdfBase64 = await readAsBase64(file);
      const res = await extractDocument({
        data: { role, sourceName: file.name, pdfBase64 },
      });
      if (!res.ok) {
        setUpload({ file, pending: false, error: res.error });
        return;
      }
      // Newest first in the shared cache, then reconcile with the server; both the picker here and
      // the same-cache reads elsewhere pick it up. A design upload carries its tokens for previews.
      const option: TDocOption = {
        id: res.id,
        sourceName: res.sourceName,
        designTokens: res.designTokens ?? null,
        designFeel: res.designFeel ?? null,
        designArchetypes: res.designArchetypes ?? null,
      };
      queryClient.setQueryData<Array<TDocOption>>(
        documentsKeys.role(role),
        (prev) => [option, ...(prev ?? []).filter((d) => d.id !== res.id)],
      );
      void queryClient.invalidateQueries({
        queryKey: documentsKeys.role(role),
      });
      onValueChange(res.id);
      setUpload(EMPTY_UPLOAD);
    } catch (error) {
      setUpload({
        file,
        pending: false,
        error: error instanceof Error ? error.message : "Upload failed.",
      });
    }
  }

  function handleFile(file: File | null) {
    if (!file) {
      setUpload(EMPTY_UPLOAD);
      return;
    }
    void runExtract(file);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {hasExisting && (
        <>
          <DocumentSelect
            id={id}
            ariaLabel={ariaLabel}
            value={value}
            onValueChange={onValueChange}
            docs={docs}
            placeholder={placeholder}
            noneLabel={noneLabel}
            disabled={upload.pending}
          />
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <span className="bg-border h-px flex-1" />
            or upload new
            <span className="bg-border h-px flex-1" />
          </div>
        </>
      )}

      <FileDropzone
        // The dropzone claims the field's id (for an external `<Label>`) only when no select shows.
        id={hasExisting ? undefined : id}
        accept=".pdf,application/pdf"
        fileKind="PDF"
        hint={hint}
        file={upload.file}
        pending={upload.pending}
        status={upload.pending ? "Extracting…" : null}
        onFileSelect={handleFile}
      />

      {upload.error && (
        <p className="border-destructive/50 text-destructive rounded-md border p-3 text-sm">
          {upload.error}
        </p>
      )}
    </div>
  );
}
