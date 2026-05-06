// mygf/src/components/dashboard/RecentCertificatesCard.tsx
import { useEffect, useState } from "react";
import Card from "./ui/Card";
import type { CertificateItem } from "./types";
import { api } from "../../api/client";
import { fetchCertificateBlobFromUrl } from "../../admin/api/certificates";

type Props = {
  items: CertificateItem[]; // incoming mock; ignored for data, kept for styling compat
  onViewAll?: () => void;
};

function formatIssued(d?: string | Date | null) {
  if (!d) return "—";
  try {
    const dt = typeof d === "string" ? new Date(d) : d;
    if (!dt || Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return "—";
  }
}

export default function RecentCertificatesCard({ items: _incoming, onViewAll }: Props) {
  const [items, setItems] = useState<CertificateItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // ✅ correct endpoint
        const enr = await api.get("/student/enrollments/active");
        const list = Array.isArray(enr?.data) ? enr.data : (enr?.data?.items || []);
        const courseIds: string[] = (list || [])
          .filter((i: any) => String(i?.status || '').toLowerCase() === 'premium')
          .map((i: any) => String(i.courseId || ''))
          .filter(Boolean);

        if (!courseIds.length) {
          if (!cancelled) setItems([]);
          return;
        }

        // check progress for certificateUrl
        const progs = await Promise.all(
          courseIds.map(async (cid) => {
            try {
              const r = await api.get(`/student/progress/${cid}`);
              return { cid, data: r?.data || null };
            } catch {
              return { cid, data: null };
            }
          })
        );

        const withCert = progs.filter(p => p.data && p.data.certificateUrl);
        if (!withCert.length) {
          if (!cancelled) setItems([]);
          return;
        }

        // get course titles
        const rows: Array<{ courseId: string; title: string; url: string; issued?: string | null }> = [];
        for (const w of withCert) {
          const url = String(w.data.certificateUrl);
          let title = 'Course';
          let issued = w.data?.updatedAt || w.data?.createdAt || null;
          try {
            const c = await api.get(`/student-catalog/courses/${w.cid}`);
            title = String(c?.data?.title || 'Course');
          } catch {}
          rows.push({ courseId: w.cid, title, url, issued });
        }

        // to UI items (same palette vibe)
        const palette = [
          { iconColor: "text-yellow-600", bgGradient: "from-yellow-50 to-yellow-100", borderColor: "border-yellow-200" },
          { iconColor: "text-blue-600",   bgGradient: "from-blue-50 to-blue-100",     borderColor: "border-blue-200" },
          { iconColor: "text-green-600",  bgGradient: "from-green-50 to-green-100",   borderColor: "border-green-200" },
          { iconColor: "text-purple-600", bgGradient: "from-purple-50 to-purple-100", borderColor: "border-purple-200" },
          { iconColor: "text-pink-600",   bgGradient: "from-pink-50 to-pink-100",     borderColor: "border-pink-200" },
        ];

        const mapped: CertificateItem[] = rows.slice(0, 5).map((r, idx) => ({
          id: r.courseId,
          title: r.title,
          issued: formatIssued(r.issued || null),
          iconColor: palette[idx % palette.length].iconColor,
          bgGradient: palette[idx % palette.length].bgGradient,
          borderColor: palette[idx % palette.length].borderColor,
          // @ts-ignore stash url for click
          _url: r.url
        }));

        if (!cancelled) setItems(mapped);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleDownload = async (it: any) => {
    const url: string | undefined = it?._url;
    if (!url) return;
    try {
      const { blob, filename } = await fetchCertificateBlobFromUrl(url);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename || "certificate.pdf";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 0);
    } catch (e) {
      console.error("Certificate download failed", e);
      try { window.open(url, "_blank"); } catch {}
    }
  };

  const empty = loaded && (!items || items.length === 0);

return (
  <Card>
    {/* HEADER */}
    <div className="flex items-center justify-between mb-4">
      <h4 className="text-sm font-semibold text-gray-900">
        Certificates
      </h4>

      {onViewAll ? (
        <button
          onClick={onViewAll}
          className="text-sm text-gray-500 hover:text-gray-700 transition"
        >
          View all
        </button>
      ) : null}
    </div>

    {/* EMPTY STATE */}
    {empty ? (
      <div className="text-sm text-gray-500">
        No certificates available
      </div>
    ) : (
      <div className="divide-y divide-gray-200">
        {items.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 transition"
            onClick={() => handleDownload(c as any)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) =>
              e.key === "Enter" ? handleDownload(c as any) : undefined
            }
            title="Download certificate"
          >
            {/* LEFT */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-100">
                <i className="fas fa-award text-gray-500 text-sm" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {c.title}
                </p>
                <p className="text-xs text-gray-500">
                  Issued: {c.issued || "—"}
                </p>
              </div>
            </div>

            {/* RIGHT ICON */}
            <i className="fas fa-download text-gray-400 text-sm" />
          </div>
        ))}
      </div>
    )}

    {/* FOOTER BUTTON */}
    {onViewAll ? (
      <button
        onClick={onViewAll}
        className="w-full mt-4 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-md hover:bg-gray-50 transition"
      >
        View All Certificates
      </button>
    ) : null}
  </Card>
);
}
