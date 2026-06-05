import { useRef, useState } from "react";
import { Upload, FileText } from "lucide-react";
import { Card, CardBody } from "./Card";
import { cn } from "../../lib/cn";

interface UploadCardProps {
  title: string;
  description: string;
  acceptedTypes?: string;
  demoFilename?: string;
}

export function UploadCard({
  title,
  description,
  acceptedTypes = ".pdf,.docx,.xlsx,.txt",
  demoFilename,
}: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localFile, setLocalFile] = useState<string | null>(null);

  const displayName = localFile ?? demoFilename;

  return (
    <Card className="hover:border-[var(--color-border-strong)] transition-colors">
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              {title}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex items-center gap-2 px-3 py-2 border border-dashed rounded-md text-xs font-medium",
            "border-[var(--color-border-strong)] text-[var(--color-text-muted)]",
            "hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] transition-colors",
          )}
        >
          <Upload className="w-3.5 h-3.5" />
          Select file (demo / local-only)
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
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] px-2 py-1.5 bg-[var(--color-surface-muted)] rounded">
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{displayName}</span>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
