import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Upload, FileText } from "lucide-react";
import { cn } from "../../lib/cn";

interface UploadSlotProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  acceptedTypes?: string;
  demoFilename?: string;
  variant?: "primary" | "compact";
}

export function UploadSlot({
  title,
  description,
  icon: Icon,
  acceptedTypes = ".pdf,.docx,.xlsx,.txt",
  demoFilename,
  variant = "compact",
}: UploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localFile, setLocalFile] = useState<string | null>(null);
  const displayName = localFile ?? demoFilename;

  if (variant === "primary") {
    return (
      <div
        className={cn(
          "relative rounded-[var(--radius-xl)] border-2 border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] p-7 flex flex-col gap-5 hover:border-[var(--color-ink)] transition-colors",
        )}
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--color-ink)] text-white grid place-items-center shrink-0 shadow-[var(--shadow-sm)]">
            {Icon ? (
              <Icon className="w-5 h-5" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink)]">
              Primary input
            </div>
            <h3 className="text-[17px] font-semibold text-[var(--color-text)] mt-0.5 tracking-tight">
              {title}
            </h3>
            {description && (
              <p className="text-[12.5px] text-[var(--color-text-muted)] mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center justify-center gap-2 h-12 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] text-[13px] font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-colors"
        >
          <Upload className="w-4 h-4" />
          Drop file or click to select
          <span className="text-[var(--color-text-subtle)] font-normal">
            · demo / local-only
          </span>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={acceptedTypes}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setLocalFile(file.name);
          }}
        />

        {displayName && (
          <div className="flex items-center gap-2 text-[12px] text-[var(--color-text-muted)] px-3 py-2 bg-[var(--color-surface-muted)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{displayName}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] transition-colors">
      <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] grid place-items-center shrink-0">
        {Icon ? <Icon className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-[var(--color-text)] truncate">
          {title}
        </div>
        {displayName ? (
          <div className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] truncate">
            <FileText className="w-3 h-3 shrink-0" />
            <span className="truncate">{displayName}</span>
          </div>
        ) : (
          <div className="text-[11px] text-[var(--color-text-subtle)] truncate">
            {description ?? "Drop demo file"}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-subtle)] hover:text-[var(--color-ink)] transition-colors px-1.5"
      >
        Select
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={acceptedTypes}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setLocalFile(file.name);
        }}
      />
    </div>
  );
}
