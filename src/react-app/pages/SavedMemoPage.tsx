import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { MemoReview } from "../components/MemoReview";
import { ReportQnA } from "../components/ReportQnA";
import { getSavedMemo } from "../lib/savedMemos";
import { downloadResearchPdf } from "../lib/researchPdf";

// Read-only view of a single saved memo, reached from the library at
// /memo/:id. Renders the same MemoReview the workbench produces (so PDF
// download / print still work) without touching the live project state.
export function SavedMemoPage() {
  const { id } = useParams<{ id: string }>();
  const saved = useMemo(
    () => (id ? getSavedMemo(decodeURIComponent(id)) : null),
    [id],
  );

  const [downloadingReport, setDownloadingReport] = useState(false);
  const report = saved?.report;
  const handleDownloadResearch = async (): Promise<void> => {
    if (!report) return;
    setDownloadingReport(true);
    try {
      await downloadResearchPdf(report);
    } finally {
      setDownloadingReport(false);
    }
  };

  const back = (
    <Link to="/library">
      <Button
        variant="outline"
        size="sm"
        leadingIcon={<ArrowLeft className="w-3.5 h-3.5" />}
      >
        Back to library
      </Button>
    </Link>
  );

  if (!saved) {
    return (
      <div className="space-y-6">
        <div>{back}</div>
        <EmptyState
          icon={<FileText className="w-7 h-7" />}
          title="Memo not found"
          description="This saved memo is no longer available — it may have been deleted, or saved in a different browser."
        />
      </div>
    );
  }

  return (
    <div className="max-w-[1320px] mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3">
        {back}
        {saved.company && (
          <div className="text-[12px] text-[var(--color-text-muted)] truncate">
            {saved.company.companyName}
            <span className="text-[var(--color-text-subtle)]">
              {" · "}
              {saved.company.ticker}
            </span>
          </div>
        )}
      </div>

      {/* Memo reads on the left; "Ask the research" is a sticky side panel on
          the right so questions can be asked while reading. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_390px] gap-6 items-start">
        <div className="min-w-0">
          <MemoReview
            memo={saved.memo}
            generationType={saved.generationType}
            researchWindowLabel={saved.researchWindowLabel}
            onDownloadResearch={saved.report ? handleDownloadResearch : undefined}
            downloadingResearch={downloadingReport}
            showBody
          />
        </div>

        {/* Stage 3: the stored report powers follow-up Q&A, reusable across
            devices without re-running research. The full report itself is a
            download (see the memo actions above), not an inline dump. */}
        {saved.report && (
          <div className="lg:sticky lg:top-2">
            <ReportQnA report={saved.report} />
          </div>
        )}
      </div>
    </div>
  );
}
