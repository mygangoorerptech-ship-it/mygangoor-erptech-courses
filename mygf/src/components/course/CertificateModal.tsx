// mygf/src/components/course/CertificateModal.tsx
import { useEffect, useMemo, useRef, useState } from "react";

export default function CertificateModal({
  isVisible,
  onClose,
  courseName,
  studentName,
}: {
  isVisible: boolean;
  onClose: () => void;
  courseName: string;
  studentName: string;
}) {
  const certRef = useRef<HTMLDivElement | null>(null);
  const qrRef = useRef<HTMLDivElement | null>(null);

  const completionDate = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    []
  );

  const [certificateId] = useState<string>(
    `TED-${new Date().getFullYear()}-WD-${Math.floor(
      100000 + Math.random() * 899999
    )}`
  );

  useEffect(() => {
    if (!isVisible) return;

    // Load qrcode-generator from CDN (same as certificate.html)
    function ensureQrLib(): Promise<void> {
      if ((window as any).qrcode) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js";
        s.async = true;
        s.onload = () => resolve();
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    async function drawQR() {
      try {
        await ensureQrLib();
        const qrcode = (window as any).qrcode;
        if (!qrcode || !qrRef.current) return;
        const qr = qrcode(0, "M");
        qr.addData(certificateId);
        qr.make();
        qrRef.current.innerHTML = qr.createSvgTag(3, 0);
        const svg = qrRef.current.querySelector("svg");
        if (svg) {
          svg.setAttribute("width", "100%");
          svg.setAttribute("height", "100%");
        }
      } catch {
        if (qrRef.current) {
          qrRef.current.innerHTML =
            '<div style="width:100%;height:100%;border:1px solid #cbd5e1;display:flex;align-items:center;justify-content:center;font:600 10px/1 Inter,system-ui;color:#94a3b8;">QR</div>';
        }
      }
    }

    drawQR();
  }, [isVisible, certificateId]);

  // Download via html2canvas (loaded from CDN), fallback to print
  const handleDownload = async () => {
    const node = certRef.current;
    if (!node) return;

    async function ensureHtml2Canvas(): Promise<void> {
      if ((window as any).html2canvas) return;
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src =
          "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
        s.async = true;
        s.onload = () => resolve();
        s.onerror = reject;
        document.body.appendChild(s);
      });
    }

    try {
      await ensureHtml2Canvas();
      const html2canvas = (window as any).html2canvas as (
        el: HTMLElement,
        opts?: any
      ) => Promise<HTMLCanvasElement>;
      if (!html2canvas) throw new Error("html2canvas not available");

      const canvas = await html2canvas(node, { scale: 2, useCORS: true });
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${studentName || "Student"}-${courseName || "Course"}-Certificate.png`;
      a.click();
    } catch {
      window.print();
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Centered content */}
      <div className="relative z-[71] h-full flex items-center justify-center p-4">
        {/* Inline CSS from certificate.html */}
        <style>{`
          @import url("https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap");
          :root{ --outer-pad: clamp(10px, 1.8vw, 24px); --inner-pad: clamp(16px, 3.0vw, 42px); --corner: clamp(18px, 2.8vw, 40px); --radius: clamp(12px, 1.6vw, 20px); }
          .certificate-container{ font-family: "Inter", sans-serif; min-height: 100svh; padding: clamp(12px, 2vw, 28px); display: grid; place-items: center; background:
            radial-gradient(1200px 600px at 10% -10%, rgba(255,255,255,.28), transparent 60%),
            radial-gradient(1000px 800px at 110% 110%, rgba(255,255,255,.28), transparent 60%),
            linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
          .certificate-frame{ width: min(95vw, 1200px); aspect-ratio: 16 / 9; position: relative; }
          .certificate{ position: absolute; inset: 0; background: #fff; border-radius: var(--radius); box-shadow: 0 25px 50px rgba(0,0,0,.15); overflow: hidden; display: flex; flex-direction: column; isolation: isolate; }
          .certificate::before{ content:""; position: absolute; left:0; right:0; top:0; height: 6px; background: linear-gradient(90deg,#667eea,#764ba2,#f093fb,#f5576c); z-index: 2; }
          .certificate::after{ content:""; position:absolute; inset:0; background:
            radial-gradient(60% 40% at 50% 50%, rgba(102,126,234,.04), transparent 70%),
            repeating-linear-gradient(135deg, rgba(0,0,0,.025) 0 2px, transparent 2px 6px); z-index: 0; }
          .decorative-border{ margin: var(--outer-pad); padding: var(--inner-pad); border: 3px solid; border-image: linear-gradient(45deg, #667eea, #764ba2) 1; position: relative; border-radius: calc(var(--radius) - 4px); background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); z-index: 1; }
          .decorative-corner{ position: absolute; width: var(--corner); height: var(--corner); border: 3px solid #667eea; border-radius: 6px; background: #fff; }
          .corner-tl{ top:-3px; left:-3px; border-right:none; border-bottom:none; } .corner-tr{ top:-3px; right:-3px; border-left:none; border-bottom:none; } .corner-bl{ bottom:-3px; left:-3px; border-right:none; border-top:none; } .corner-br{ bottom:-3px; right:-3px; border-left:none; border-top:none; }
          .certificate-title{ font-family: "Playfair Display", serif; font-weight: 700; font-size: clamp(1.8rem, 5vw, 3rem); background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; text-align: center; margin: 0 0 .6rem; }
          .recipient-name{ font-family: "Playfair Display", serif; font-weight: 600; color: #2d3748; text-align: center; margin: clamp(.6rem, 1.8vw, 1.2rem) 0 clamp(.6rem, 1.6vw, 1rem); font-size: clamp(1.4rem, 4.2vw, 2.4rem); position: relative; }
          .recipient-name::after{ content:""; position:absolute; bottom: -10px; left:50%; transform: translateX(-50%); width: clamp(120px, 18vw, 240px); height:2px; background: linear-gradient(90deg, #667eea, #764ba2); }
          .lede{ text-align: center; color:#4a5568; font-size: clamp(.85rem, 1.6vw, 1.05rem); margin-bottom: clamp(.6rem, 1.4vw, 1rem); }
          .course-details{ background: linear-gradient(135deg, #ffffff 0%, #f5f7fa 100%); padding: clamp(12px, 2vw, 22px); border-radius: 14px; margin: clamp(10px, 1.6vw, 18px) 0; border-left: 5px solid #667eea; box-shadow: inset 0 0 0 1px rgba(102, 126, 234, .08); }
          .course-details h2{ color:#1f2937; font-weight: 700; font-size: clamp(1.1rem, 2.4vw, 1.7rem); margin: 0 0 .5rem; }
          .signature-section{ display: grid; grid-template-columns: 1fr 1fr; gap: clamp(14px, 2.4vw, 28px); margin-top: clamp(14px, 2.2vw, 26px); align-items: end; }
          .signature-box{ text-align:center; position:relative; }
          .signature-line{ border-bottom: 2px solid #667eea; height: clamp(40px, 7vw, 60px); display:flex; align-items:flex-end; justify-content:center; font-family: "Playfair Display", serif; font-size: clamp(1rem, 2.4vw, 1.4rem); color:#374151; letter-spacing:.2px; padding-bottom: 4px; }
          .seal{ position:absolute; top: clamp(10px, 1.6vw, 20px); right: clamp(10px, 1.6vw, 20px); width: clamp(74px, 12vw, 120px); height: clamp(74px, 12vw, 120px); border-radius: 50%; background: radial-gradient(60% 60% at 50% 35%, #8aa1ff 0%, #667eea 60%, #5a4da8 100%); color: #fff; display:flex; align-items:center; justify-content:center; text-align:center; font-weight: 700; font-size: clamp(.58rem, 1.4vw, .9rem); box-shadow: inset 0 2px 12px rgba(255,255,255,.22), 0 12px 30px rgba(102,126,234,.33); z-index: 2; }
          .seal div{ transform: translateY(1px); }
          .id-block{ position:absolute; top:  calc(var(--outer-pad) + var(--inner-pad) + 6px); left: calc(var(--outer-pad) + var(--inner-pad) + 6px); display:flex; align-items:center; gap:10px; background: rgba(255,255,255,.9); padding: 8px 10px; border-radius: 12px; border: 1px solid rgba(102,126,234,.25); box-shadow: 0 8px 20px rgba(102,126,234,.18); z-index: 3; }
          .id-qr{ width: clamp(44px, 6.5vw, 64px); height: clamp(44px, 6.5vw, 64px); display:grid; place-items:center; }
          .cert-id{ line-height: 1.15; } .cert-id small{ display:block; font-weight:700; letter-spacing:.08em; font-size:.68rem; color:#64748b; text-transform:uppercase; }
          .cert-id code{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-weight:600; font-size: clamp(.74rem, 1.2vw, .95rem); color:#111827; background:#f8fafc; padding:2px 6px; border-radius:6px; }
          @media print{ body{ -webkit-print-color-adjust: exact; print-color-adjust: exact; } .certificate-container{ padding: 0; background: #fff; } .certificate-frame{ width: 100%; aspect-ratio: auto; } .certificate{ box-shadow: none; border-radius: 0; } .id-block{ background:#fff; border-color:#999; box-shadow:none; } }
        `}</style>

        {/* Certificate canvas */}
        <div ref={certRef} className="certificate-container">
          <div className="certificate-frame">
            <div className="certificate">
              <div className="decorative-border">
                <div className="decorative-corner corner-tl" />
                <div className="decorative-corner corner-tr" />
                <div className="decorative-corner corner-bl" />
                <div className="decorative-corner corner-br" />

                <div className="text-center mb-4">
                  <div className="text-[clamp(.8rem,1.4vw,1rem)] font-semibold text-gray-600 mb-1 tracking-widest">CERTIFICATE OF</div>
                  <h1 className="certificate-title">COMPLETION</h1>
                  <div className="text-[clamp(.7rem,1.3vw,.9rem)] text-gray-500 uppercase tracking-wider">This is to certify that</div>
                </div>

                <div className="recipient-name">{studentName}</div>

                <p className="lede">has successfully completed the online course</p>

                <div className="course-details">
                  <h2>{courseName}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[clamp(.82rem,1.5vw,1rem)] text-gray-700">
                    <div><strong>Duration:</strong> <span>—</span></div>
                    <div><strong>Completion Date:</strong> <span>{completionDate}</span></div>
                    <div><strong>Grade:</strong> <span>—</span></div>
                    <div><strong>Institution:</strong> <span>—</span></div>
                  </div>
                </div>

                <p className="lede">
                  This certificate validates the recipient’s dedication to professional development and mastery of the course curriculum.
                </p>

                <div className="signature-section">
                  <div className="signature-box">
                    <div className="signature-line">Dr. Sarah Johnson</div>
                    <div className="text-[clamp(.72rem,1.3vw,.9rem)] text-gray-700 font-semibold">Course Instructor</div>
                    <div className="text-[clamp(.65rem,1.1vw,.8rem)] text-gray-500">Ph.D. Computer Science</div>
                  </div>
                  <div className="signature-box">
                    <div className="signature-line">Michael Chen</div>
                    <div className="text-[clamp(.72rem,1.3vw,.9rem)] text-gray-700 font-semibold">Academic Director</div>
                    <div className="text-[clamp(.65rem,1.1vw,.8rem)] text-gray-500">TechEd Academy</div>
                  </div>
                </div>
              </div>

              <div className="seal">
                <div>
                  <div className="font-bold tracking-wide">VERIFIED</div>
                  <div className="text-[clamp(.55rem,1.25vw,.8rem)]">CERTIFICATE</div>
                  <div className="text-[clamp(.55rem,1.25vw,.8rem)]">{new Date().getFullYear()}</div>
                </div>
              </div>

              {/* Top-left ID + QR */}
              <div className="id-block">
                <div ref={qrRef} className="id-qr" aria-label="QR code for certificate verification" />
                <div className="cert-id">
                  <small>Certificate ID</small>
                  <code>{certificateId}</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="absolute bottom-4 left-0 right-0 z-[72] mx-auto flex w-full max-w-[min(95vw,1200px)] gap-3 px-4">
          <button
            onClick={handleDownload}
            className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-all shadow-lg"
          >
            Download Certificate
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
