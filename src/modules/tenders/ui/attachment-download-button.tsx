"use client";
import { useState } from "react";
import { TenderIcon } from "./tender-icon";

export function AttachmentDownloadButton({
  url,
  fileName,
  label,
  errorLabel,
  resolveUrl,
  showLabel = false,
}: {
  url: string;
  fileName: string;
  label: string;
  errorLabel: string;
  resolveUrl?: () => Promise<string>;
  showLabel?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function download() {
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      const response = await fetch(resolveUrl ? await resolveUrl() : url);
      if (!response.ok) throw new Error("Download failed");
      // Browsers ignore `download` on cross-origin signed URLs. A local blob
      // makes PDF and CAD downloads behave consistently without a public cache.
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        className={`tender-button ${showLabel ? "" : "icon-only"} small`}
        disabled={pending}
        aria-label={`${label} ${fileName}`}
        onClick={download}
      >
        {showLabel ? label : <TenderIcon name="download" size={18} />}
      </button>
      {error ? (
        <span className="tender-download-error" role="alert">
          {errorLabel}
        </span>
      ) : null}
    </div>
  );
}
