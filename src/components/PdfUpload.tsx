import { useCallback, useRef, useState } from "react";

interface PdfUploadProps {
  onFileSelected: (file: File) => void;
  onFileRemoved: () => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

export type UploadState =
  | { status: "idle" }
  | { status: "selected"; file: File }
  | { status: "error"; message: string }
  | { status: "loading" };

export function PdfUpload({
  onFileSelected,
  onFileRemoved,
  disabled = false,
}: PdfUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
  });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!file.type && !file.name.toLowerCase().endsWith(".pdf")) {
      return "Please select a PDF file.";
    }
    if (file.type && file.type !== "application/pdf") {
      return "Please select a PDF file.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File is too large. Maximum size is 15 MB.";
    }
    return null;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        setUploadState({ status: "error", message: error });
        return;
      }
      setUploadState({ status: "selected", file });
      onFileSelected(file);
    },
    [validateFile, onFileSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [disabled, handleFile]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setDragOver(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleRemove = useCallback(() => {
    setUploadState({ status: "idle" });
    onFileRemoved();
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [onFileRemoved]);

  const handleZoneClick = useCallback(() => {
    if (!disabled && uploadState.status !== "selected") {
      inputRef.current?.click();
    }
  }, [disabled, uploadState.status]);

  // --- IDLE STATE ---
  if (uploadState.status === "idle") {
    return (
      <div>
        <div
          onClick={handleZoneClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleZoneClick();
          }}
          aria-label="Upload a PDF contract"
          className={`
            relative cursor-pointer rounded-xl border-2 border-dashed p-12 text-center
            ${
              dragOver
                ? "border-accent bg-accent/5"
                : "border-border hover:border-accent/50"
            }
            ${disabled ? "pointer-events-none opacity-50" : ""}
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleInputChange}
            disabled={disabled}
            aria-hidden="true"
          />

          {/* Empty state icon */}
          <div className="mb-4 flex justify-center">
            <svg
              className="h-12 w-12 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>

          <p className="mb-1 text-base font-medium text-foreground">
            Drop your contract here or click to browse
          </p>
          <p className="text-sm text-text-muted">PDF only — up to 15 MB</p>
        </div>
      </div>
    );
  }

  // --- ERROR STATE ---
  if (uploadState.status === "error") {
    return (
      <div>
        <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-6 text-center">
          <div className="mb-3 flex justify-center">
            <svg
              className="h-10 w-10 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <p className="mb-2 text-sm font-medium text-destructive">
            {uploadState.message}
          </p>
          <button
            onClick={handleRemove}
            className="text-sm text-accent underline underline-offset-2 hover:text-accent/80"
          >
            Try another file
          </button>
        </div>
      </div>
    );
  }

  // --- LOADING STATE ---
  if (uploadState.status === "loading") {
    return (
      <div>
        <div className="rounded-xl border-2 border-muted bg-muted/10 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
              <svg
                className="h-5 w-5 animate-spin text-text-muted"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
            <p className="text-sm text-text-muted">Processing...</p>
          </div>
        </div>
      </div>
    );
  }

  // --- SUCCESS (FILE SELECTED) STATE ---
  // At this point uploadState is narrowed to { status: "selected"; file: File }
  const selectedFile = uploadState.file;
  return (
    <div>
      <div className="rounded-xl border-2 border-accent/30 bg-accent/5 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/10">
            <svg
              className="h-6 w-6 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {selectedFile.name}
            </p>
            <p className="text-xs text-text-muted">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <button
            onClick={handleRemove}
            disabled={disabled}
            className="shrink-0 rounded-lg p-2 text-text-muted hover:bg-background hover:text-foreground disabled:opacity-50"
            aria-label="Remove file"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Props for the analyze button (kept separate for clarity)
interface AnalyzeButtonProps {
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
  cooldownRemaining: number; // seconds, 0 = no cooldown
}

export function AnalyzeButton({
  disabled,
  loading,
  onClick,
  cooldownRemaining,
}: AnalyzeButtonProps) {
  const isDisabled = disabled || loading || cooldownRemaining > 0;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`
        w-full rounded-xl py-3 font-semibold text-base transition-all duration-150
        ${
          isDisabled
            ? "cursor-not-allowed bg-muted text-text-secondary"
            : "cursor-pointer bg-accent text-background hover:bg-accent/90 active:scale-[0.97]"
        }
      `}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg
            className="h-5 w-5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Analyzing...
        </span>
      ) : cooldownRemaining > 0 ? (
        `Wait ${cooldownRemaining}s before next analysis`
      ) : (
        "Analyze Contract"
      )}
    </button>
  );
}