/**
 * `FileDropzone` — a reusable drag-and-drop + click-to-browse file picker styled with the
 * design system. It is a controlled input: the parent owns the selected `file` and reacts to
 * `onFileSelect`. Dropped/picked files are validated against `accept` (extensions and MIME
 * types) before they surface; a rejected file raises a toast and is dropped silently otherwise.
 *
 * It renders two states in place — an empty prompt and a filled chip (filename + size + a
 * remove/spinner affordance) — and is fully keyboard-operable (focusable, Enter/Space open the
 * picker). Nothing here is PDF-specific; callers pass `accept`/`fileKind` to specialise it.
 */
import * as React from "react";
import {
  IconFileTypePdf,
  IconLoader2,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type FileDropzoneProps = {
  /** The currently selected file, or `null` when empty. Controlled by the parent. */
  file: File | null;
  /** Called with the accepted file, or `null` when the selection is cleared. */
  onFileSelect: (file: File | null) => void;
  /** Native `accept` filter (e.g. `".pdf,application/pdf"`); also enforced on drop. */
  accept?: string;
  /** What a valid file is, used in the empty prompt and rejection toast. Defaults to "file". */
  fileKind?: string;
  /** Helper line shown under the prompt in the empty state. */
  hint?: string;
  /** Small status line shown under the filename in the filled state (e.g. "Extracting…"). */
  status?: React.ReactNode;
  /** When true, swaps the remove control for a spinner and blocks interaction (during upload). */
  pending?: boolean;
  disabled?: boolean;
  /** Id of the underlying input, so an external `<Label htmlFor>` can target it. */
  id?: string;
  className?: string;
};

/** Compact human-readable byte count for the filename chip. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Does `file` satisfy a comma-separated `accept` list of extensions and/or MIME types? */
function matchesAccept(file: File, accept?: string): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .some((token) => {
      if (token.startsWith(".")) return name.endsWith(token);
      if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
      return type === token;
    });
}

export function FileDropzone({
  file,
  onFileSelect,
  accept,
  fileKind = "file",
  hint,
  status,
  pending = false,
  disabled = false,
  id,
  className,
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  // dragenter/dragleave fire for every child crossed; count depth so nested elements don't flicker.
  const dragDepth = React.useRef(0);
  const [dragging, setDragging] = React.useState(false);

  const interactive = !disabled && !pending;

  function takeFiles(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;
    if (!matchesAccept(picked, accept)) {
      toast.error(`That doesn't look like a ${fileKind}.`, {
        description: picked.name,
      });
      return;
    }
    onFileSelect(picked);
  }

  function openPicker() {
    if (interactive) inputRef.current?.click();
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (interactive) takeFiles(event.dataTransfer.files);
  }

  function handleDragEnter(event: React.DragEvent) {
    event.preventDefault();
    if (!interactive) return;
    dragDepth.current += 1;
    setDragging(true);
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault(); // required so the browser fires `drop`
    if (interactive) event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(event: React.DragEvent) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  }

  function clearSelection(event: React.MouseEvent) {
    event.stopPropagation(); // don't reopen the picker
    onFileSelect(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div
      data-slot="file-dropzone"
      data-dragging={dragging || undefined}
      role="button"
      tabIndex={interactive ? 0 : -1}
      aria-disabled={interactive ? undefined : true}
      aria-label={file ? `Replace ${fileKind}` : `Upload ${fileKind}`}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "relative flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-card px-4 py-6 text-center text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        interactive && "cursor-pointer hover:border-ring/60 hover:bg-accent/40",
        dragging && "border-ring bg-accent/60 ring-3 ring-ring/40",
        !interactive && "opacity-70",
        className,
      )}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={!interactive}
        className="sr-only"
        onChange={(event) => {
          takeFiles(event.target.files);
          event.target.value = ""; // let the same file be re-picked after a clear
        }}
      />

      {file ? (
        <>
          <div className="flex w-full items-center gap-3">
            <IconFileTypePdf className="text-primary size-8 shrink-0" />
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate font-medium">{file.name}</p>
              <p className="text-muted-foreground text-xs">
                {formatBytes(file.size)}
              </p>
            </div>
            {pending ? (
              <IconLoader2 className="text-muted-foreground size-5 shrink-0 animate-spin" />
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${fileKind}`}
                onClick={clearSelection}
                disabled={disabled}
              >
                <IconX />
              </Button>
            )}
          </div>
          {status ? (
            <p className="text-muted-foreground w-full text-left text-xs">
              {status}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <IconUpload className="text-muted-foreground size-7" />
          <div className="space-y-0.5">
            <p className="font-medium">
              Drop {fileKind} here or{" "}
              <span className="text-primary underline underline-offset-2">
                browse
              </span>
            </p>
            {hint ? (
              <p className="text-muted-foreground text-xs">{hint}</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
