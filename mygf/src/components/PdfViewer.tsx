// src/components/PdfViewer.tsx
// Small, dependency-free PDF viewer using <iframe> with an optional swipe hint

import { useMemo } from "react";

type PdfViewerProps = {
  url: string;                // direct URL or a signed URL
  showSwipeHint?: boolean;    // UI-only prop, must NOT reach DOM
  className?: string;
  style?: React.CSSProperties;
};

export default function PdfViewer(props: PdfViewerProps) {
  const { url, showSwipeHint, className, style } = props; // don't pass showSwipeHint down

  const src = useMemo(() => {
    // keep native toolbar; add fragment controls if you want
    return url.includes("#") ? url : `${url}#toolbar=1&navpanes=0&scrollbar=1`;
  }, [url]);

  return (
    <div className={className} style={style}>
      {showSwipeHint && (
        <div className="pointer-events-none select-none text-xs text-slate-600 mb-2">
          Swipe/scroll to read →
        </div>
      )}
      <iframe
        src={src}
        title="PDF"
        className="w-full h-[70vh] rounded-lg border"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
