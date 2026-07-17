import { useRef, useState } from "react";
import { IconDownload, IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export interface IDeckPdfDownloadButtonProps {
  deckId: string;
  disabled?: boolean;
}

export function DeckPdfDownloadButton({
  deckId,
  disabled = false,
}: IDeckPdfDownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const downloadPendingRef = useRef(false);

  async function handleDownload() {
    if (downloadPendingRef.current) return;
    downloadPendingRef.current = true;
    setDownloading(true);
    try {
      const response = await fetch(`/api/decks/${deckId}/pdf`, {
        method: "POST",
      });
      if (!response.ok) {
        let description = "The PDF could not be generated. Please try again.";
        try {
          const body: unknown = await response.json();
          if (
            typeof body === "object" &&
            body !== null &&
            "error" in body &&
            typeof body.error === "string"
          ) {
            description = body.error;
          }
        } catch {
          // Keep the generic message when the response is not JSON.
        }
        throw new Error(description);
      }

      const blobUrl = URL.createObjectURL(await response.blob());
      const disposition = response.headers.get("Content-Disposition");
      const filename = /filename="([^"]+)"/.exec(disposition ?? "")?.[1];
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = filename ?? "generated-deck.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1_000);
      toast.success("PDF download started");
    } catch (error) {
      toast.error("PDF not downloaded", {
        description:
          error instanceof Error
            ? error.message
            : "The PDF could not be generated. Please try again.",
      });
    } finally {
      downloadPendingRef.current = false;
      setDownloading(false);
    }
  }

  return (
    <Button
      type="button"
      disabled={disabled || downloading}
      aria-busy={downloading}
      onClick={handleDownload}
    >
      {downloading ? (
        <IconLoader2 data-icon="inline-start" className="animate-spin" />
      ) : (
        <IconDownload data-icon="inline-start" />
      )}
      {downloading ? "Generating PDF" : "Download PDF"}
    </Button>
  );
}
