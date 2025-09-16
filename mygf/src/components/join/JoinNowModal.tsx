import React from "react";
import { X, ChevronRight, GraduationCap, Loader2, ShieldCheck } from "lucide-react";
import Steps from "./ui/Steps";
import CourseStep from "./steps/CourseStep";
import DetailsStep from "./steps/DetailsStep";
import PaymentStep from "./steps/PaymentStep";
import SuccessStep from "./steps/SuccessStep";
import { classNames } from "./utils";
import { rzpCreateOrder, rzpVerifyPayment, rzpReceipt } from "../../api/checkout";
import { loadRazorpay } from "./utils/loadRazorpay";
import type { CourseOption, DiscountKind, Gender, PayMethod, PayMode, Step } from "./types";
import { formatINRFromPaise } from "../../admin/utils/currency";
// axios client + auth
import { useAuth } from "../../auth/store";
import { api } from "../../api/client"; // <-- added back
//zustand catalog store
import { useJoinCatalog, type CatalogState } from "./store/useJoinCatalog";
import { useShallow } from "zustand/react/shallow";
import { claimReceipt } from "../../api/payments";

// lazy imports to keep bundle small
const loadJsPDF = () => import("jspdf");

export default function JoinNowModal({
  onClose,
  selectedCourseId,                     // NEW: optional preselection prop
}: {
  onClose: () => void;
  selectedCourseId?: string;
}) {
  const [step, setStep] = React.useState<Step>(1);
  const [selectedCourse, setSelectedCourse] = React.useState<CourseOption | null>(null);

  // 🚀 use cached catalog (no local fetching state anymore)
  const selectCatalog = useShallow((s: CatalogState) => ({
    courses: s.courses,
    loadingCourses: s.loading,
    coursesError: s.error,
    fetchCatalog: s.fetch,
    invalidateCatalog: s.invalidate,
  }));
  const { courses, loadingCourses, coursesError, fetchCatalog, invalidateCatalog } =
    useJoinCatalog(selectCatalog);

  // ✨ Ensure array element type for inference in .find callbacks
  const typedCourses: CourseOption[] = courses as CourseOption[];

  // form state
  const [fullName, setFullName] = React.useState("");
  const [age, setAge] = React.useState<number | "">("");
  const [gender, setGender] = React.useState<Gender | "">("");
  const [birth, setBirth] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [mobile, setMobile] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);

  // payment state
  const [discountKind, setDiscountKind] = React.useState<DiscountKind>("none");
  const [couponCode, setCouponCode] = React.useState("");
  const [method, setMethod] = React.useState<PayMethod>("online");
  const [mode, setMode] = React.useState<PayMode>("full");
  const [partAmount, setPartAmount] = React.useState<number | "">("");
  const [isPaying, setIsPaying] = React.useState(false);
  const [paid, setPaid] = React.useState(false);
   const [receiptNo, setReceiptNo] = React.useState<string>(""); 
 const [referenceId, setReferenceId] = React.useState<string>("");

  // real receipt/status
  const [orderId, setOrderId] = React.useState<string | null>(null);
  const [receipt, setReceipt] = React.useState<any | null>(null);
  const [loadingReceipt, setLoadingReceipt] = React.useState(false);
  const receiptRef = React.useRef<HTMLDivElement>(null);

  // auth (Zustand)
  const { user, status, hydrate } = useAuth();
  React.useEffect(() => { if (status === "idle") hydrate(); }, [status, hydrate]);

  // ⛔️ STOP refetching on every select:
  // Only (re)load when we actually show Step 1 AND auth is ready.
  React.useEffect(() => {
    if (step !== 1 || status !== "ready") return;
    if (!user || !user.orgId) return; // show message instead of fetching
    fetchCatalog({ force: false });    // uses TTL cache; background refresh if stale
  }, [step, status, user?.orgId, fetchCatalog]);

  React.useEffect(() => {
    if (!selectedCourseId || selectedCourse || typedCourses.length === 0) return;
    const match = typedCourses.find((c) => c.id === selectedCourseId) ?? null;
    if (match) setSelectedCourse(match);
  }, [selectedCourseId, selectedCourse, typedCourses]);

// ---------- Per-course user state (enrollment/payment) for Step 1 ----------
type CourseState = {
  enrollment?: string | null; // e.g. "premium"
  payment?: { status?: string | null; amount?: number | null }; // status & amount (paise)
};
const [courseStates, setCourseStates] = React.useState<Record<string, CourseState>>({});

// NEW: one clear fetch to the dedicated endpoint
React.useEffect(() => {
  let cancel = false;
  if (step !== 1 || status !== "ready" || !user?.orgId) return;
  if (!typedCourses.length) return;

  (async () => {
    try {
      const { data } = await api.get("/student/join/state", { withCredentials: true });
      const st = (data && data.states) || {};
      const merged: Record<string, CourseState> = {};
      for (const c of typedCourses) {
        const s = st[c.id] || {};
        merged[c.id] = {
          enrollment: s.enrollment ?? null,
          payment: s.payment
            ? { status: s.payment.status || null, amount: Number(s.payment.amount) || null }
            : undefined,
        };
      }
      if (!cancel) setCourseStates(merged);
    } catch (e) {
      console.warn("[join state] fetch failed", e);
      if (!cancel) setCourseStates({});
    }
  })();

  return () => { cancel = true; };
}, [step, status, user?.orgId, typedCourses]);

// compute visible list (hide already-premium or captured/verified)
const visibleCourses = React.useMemo(() => {
  return typedCourses.filter((c) => {
    const st = courseStates[c.id];
    if (!st) return true;

    if ((st.enrollment || "").toLowerCase() === "premium") return false;

    const ps = (st.payment?.status || "").toLowerCase();
    if (ps === "captured" || ps === "verified") return false; // hide paid/verified

    if (["refunded", "failed", "cancelled", "canceled", "rejected"].includes(ps)) return true;
    return true; // pending/submitted → keep (badge shown)
  });
}, [typedCourses, courseStates]);

// pending badge text (₹ from paise) — unchanged
const pendingMap = React.useMemo(() => {
  const m: Record<string, string> = {};
  for (const [id, st] of Object.entries(courseStates)) {
    const ps = (st.payment?.status || "").toLowerCase();
    if (ps === "pending" || ps === "submitted") {
      const amt = st.payment?.amount;
      m[id] = amt ? `Pending • ${formatINRFromPaise(amt)}` : "Pending";
    }
  }
  return m;
}, [courseStates]);

  // price math
const basePaise = (selectedCourse as any)?.pricePaise ?? 0; 
const mrpPaise  = (selectedCourse as any)?.mrpPaise ?? basePaise; 
const salePaise = (selectedCourse as any)?.salePaise ?? mrpPaise; 
const base      = (salePaise ?? basePaise) / 100; // UI total uses sale price
const discount = (() => {
  if (!selectedCourse) return 0;
  if (discountKind === "coupon" && couponCode.trim().toLowerCase() === "welcome10")
    return Math.round(base * 0.1);
  if (discountKind === "refer") return Math.round(base * 0.05);
  return 0;
})();
const total = Math.max(0, base - discount);

  // ---- payment flow
  async function handleOnlinePay() {
    if (!selectedCourse || !user?.orgId) return;
    setIsPaying(true);
    try {
      const order = await rzpCreateOrder({
        courseId: selectedCourse.id,
        orgId: String(user.orgId),
        discountKind,
        couponCode,
        mode,
        partAmount: mode === "part" ? Number(partAmount) || 0 : undefined,
      });
      if (!order?.ok) throw new Error("order create failed");
      setOrderId(order.orderId);

      await loadRazorpay();
      const rzp = new (window as any).Razorpay({
        key: order.key,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "MYGF",
        description: selectedCourse.title,
        prefill: { name: fullName, email, contact: mobile },
        notes: { courseId: selectedCourse.id, orgId: String(user.orgId) },
        method: { upi: true, netbanking: true, card: true, wallet: true, paylater: true },
        handler: async (resp: any) => {
          try {
            await rzpVerifyPayment({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              courseId: selectedCourse.id,
              orgId: String(user.orgId),
              joinForm: { fullName, age, gender, birth, address, mobile, email, photo: photoUrl },
            });

            // fetch real receipt/status
            setLoadingReceipt(true);
            const data = await rzpReceipt(resp.razorpay_order_id);
            setReceipt(data?.receipt || null);
            setPaid(true);
            setStep(4);

            // 🔄 optional: mark catalog stale so next open revalidates
            invalidateCatalog();
          } catch (e) {
            alert("Payment verification failed. If debited, contact support.");
          } finally {
            setLoadingReceipt(false);
            setIsPaying(false);
          }
        },
        modal: { ondismiss: () => setIsPaying(false) },
      });
      rzp.open();
    } catch (err) {
      console.error("[join/pay]", err);
      setIsPaying(false);
      alert("Could not start payment. Please try again.");
    }
  }

    // ---- offline (cash) flow
async function handleCashClaim() {
  if (!selectedCourse || !user?.orgId) return;
  if (Object.keys(errors).length) return;

  setIsPaying(true);
  try {
    const rupees = mode === "part" ? Number(partAmount) || 0 : total;
    const paise  = Math.round(rupees * 100);

    const notePayload = {
      method: "cash",
      discountKind,
      couponCode,
      mode,
      partAmount: mode === "part" ? Number(partAmount) || 0 : null,
      joinForm: {
        fullName, age, gender, birth, address, mobile, email, photoUrl
      },
      courseId: selectedCourse.id,
      orgId: user.orgId,
    };

 await claimReceipt({
   orgId: String(user.orgId),
   courseId: selectedCourse.id,
   amount: paise,
   receiptNo: receiptNo?.trim() || undefined,
   referenceId: referenceId?.trim() || undefined,
   notes: JSON.stringify(notePayload),
 });

    // ... your existing success/receipt UI ...
    setReceipt({
      orderId: `CASH-${Date.now()}`,
      paymentId: null,
      status: "submitted",
      verified: false,
      method: "cash",
      currency: "INR",
      amount: paise,
      dateISO: new Date().toISOString(),
      student: { name: fullName },
      course:  { title: selectedCourse.title },
      enrollment: { present: false, status: "pending" },
    });
    setPaid(true);
    setStep(4);

    // clear the optional fields
    setReceiptNo("");
    setReferenceId("");
  } catch (e) {
    console.error("[cash claim] failed", e);
    alert("Could not submit your cash payment request. Please try again.");
  } finally {
    setIsPaying(false);
  }
}


  // validators
  const errors: Record<string, string> = {};
  if (step === 1) {
    if (!selectedCourse || selectedCourse.id === "more") errors.course = "Please select an available course.";
  }
  if (step === 2) {
    if (!fullName.trim()) errors.fullName = "Full name is required.";
    if (age === "" || Number(age) < 10 || Number(age) > 100) errors.age = "Age must be between 10 and 100.";
    if (!gender) errors.gender = "Select a gender.";
    if (!birth) errors.birth = "Birth date is required.";
    if (!address.trim()) errors.address = "Address is required.";
    if (!/^\d{10}$/.test(mobile)) errors.mobile = "Enter a valid 10-digit mobile number.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email.";
    if (!photo) errors.photo = "Please upload a profile photo.";
  }
  if (step === 3) {
    if (mode === "part") {
      const amt = Number(partAmount);
      if (!amt || amt < Math.ceil(total * 0.2) || amt > total) {
        errors.partAmount = `Part payment must be between 20% and 100% of ₹${total}.`;
      }
    }
  }

  function next() {
    if (Object.keys(errors).length) return;
    setStep((s) => (s + 1) as Step);
  }
  function prev() {
    setStep((s) => (s - 1) as Step);
  }
  function onPhotoChange(file: File | null) {
    setPhoto(file);
    setPhotoUrl(file ? URL.createObjectURL(file) : null);
  }

  // computed message if not signed in to an org
  const orgGateError = !user || !user.orgId ? "Please sign in using your organisation account to view available courses." : "";

  // -------- Receipt capture (PDF / PNG) + Share --------
  function buildReceiptData() {
    return {
      title: "MYGF",
      subtitle: "Payment Receipt",
      date: receipt?.dateISO ? new Date(receipt.dateISO).toLocaleString() : "-",
      student: receipt?.student?.name || fullName || "-",
      course: receipt?.course?.title || selectedCourse?.title || "-",
      orderId: receipt?.orderId || "-",
      paymentId: receipt?.paymentId || "-",
      method: (receipt?.method || "-").toString(),
      status: receipt?.status || "-",
      amount: receipt ? (receipt.amount / 100).toLocaleString("en-IN", { style: "currency", currency: receipt.currency || "INR" }) : "-",
      enroll: receipt?.enrollment?.present ? "Enrollment: active" : `Enrollment: ${receipt?.enrollment?.status || "pending"}`
    };
  }

  function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 12) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }

  async function buildReceiptCanvas(): Promise<HTMLCanvasElement> {
    const d = buildReceiptData();

    // Canvas size (device-independent, then scale for DPR)
    const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const W = 940;   // px
    const H = 600;   // px (enough for our layout)
    const M = 28;    // margin

    const canvas = document.createElement("canvas");
    canvas.width  = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(DPR, DPR);

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Card
    const cardX = M, cardY = M, cardW = W - M*2, cardH = H - M*2;
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#e5e7eb"; // slate-200
    ctx.stroke();

    // Header
    ctx.fillStyle = "#0f172a"; // slate-900
    ctx.font = "600 20px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu";
    ctx.fillText(d.title, cardX + 20, cardY + 32);

    ctx.fillStyle = "#64748b"; // slate-500
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText(d.subtitle, cardX + 20, cardY + 50);

    ctx.textAlign = "right";
    ctx.fillStyle = "#0f172a";
    ctx.font = "500 14px ui-sans-serif, system-ui";
    ctx.fillText(d.date, cardX + cardW - 20, cardY + 36);
    ctx.textAlign = "left";

    // Divider
    ctx.strokeStyle = "#e5e7eb";
    ctx.beginPath();
    ctx.moveTo(cardX + 20, cardY + 66);
    ctx.lineTo(cardX + cardW - 20, cardY + 66);
    ctx.stroke();

    // Two-column grid labels
    const colL = cardX + 20;
    const colR = cardX + cardW / 2 + 10;
    let y = cardY + 98;

    function labelValue(label: string, value: string) {
      ctx.fillStyle = "#64748b";
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillText(label, colL, y);
      ctx.fillStyle = "#0f172a";
      ctx.font = "600 14px ui-sans-serif, system-ui";
      ctx.fillText(value, colL, y + 18);
    }
    function labelValueR(label: string, value: string) {
      ctx.fillStyle = "#64748b";
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillText(label, colR, y);
      ctx.fillStyle = "#0f172a";
      ctx.font = "600 14px ui-sans-serif, system-ui";
      ctx.fillText(value, colR, y + 18);
    }

    labelValue("Student", d.student);
    labelValueR("Course", d.course);
    y += 56;
    labelValue("Order ID", d.orderId);
    labelValueR("Payment ID", d.paymentId);
    y += 56;
    labelValue("Method", d.method);
    labelValueR("Status", d.status);
    y += 56;

    // Amount box
    const bx = cardX + 20, bw = cardW - 40, bh = 56;
    drawRoundedRect(ctx, bx, y, bw, bh, 12);
    ctx.fillStyle = "#f8fafc";   // slate-50
    ctx.fill();
    ctx.strokeStyle = "#e5e7eb";
    ctx.stroke();

    ctx.fillStyle = "#475569";   // slate-600
    ctx.font = "14px ui-sans-serif, system-ui";
    ctx.fillText("Amount paid", bx + 16, y + 22 + 10);

    ctx.textAlign = "right";
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 20px ui-sans-serif, system-ui";
    ctx.fillText(d.amount, bx + bw - 16, y + 22 + 10);
    ctx.textAlign = "left";

    // Footer line
    y += bh + 20;
    ctx.fillStyle = "#64748b";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText(d.enroll, bx, y);

    return canvas;
  }

  // ---- Download as PDF (vector page with our PNG) ----
  async function downloadReceipt(format: "pdf" | "png" = "pdf") {
    const canvas = await buildReceiptCanvas();
    const dataUrl = canvas.toDataURL("image/png");

    if (format === "png") {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `receipt-${orderId || Date.now()}.png`;
      a.click();
      return;
    }

    const { default: jsPDF } = await loadJsPDF();
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 36;
    const imgW = pageW - margin * 2;
    const ratio = canvas.height / canvas.width;
    const imgH = imgW * ratio;

    pdf.addImage(dataUrl, "PNG", margin, margin, imgW, imgH);
    pdf.save(`receipt-${orderId || Date.now()}.pdf`);
  }

  // ---- Share the same PNG (no DOM capture) ----
  async function shareReceipt() {
    try {
      const canvas = await buildReceiptCanvas();
      const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b as Blob), "image/png"));
      const file = new File([blob], `receipt-${orderId || Date.now()}.png`, { type: "image/png" });

      const text =
        `Payment Receipt - ${receipt?.course?.title || "Course"}\n` +
        `Amount: ${(receipt?.amount ?? 0) / 100} ${receipt?.currency || "INR"}\n` +
        `Order: ${receipt?.orderId}\n` +
        `${receipt?.enrollment?.present ? "Enrolled" : "Enrollment pending"}`;

      // @ts-ignore
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        // @ts-ignore
        await navigator.share({ title: "Payment receipt", text, files: [file] });
        return;
      }
      const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
      const tw = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      window.open(wa, "_blank") || window.open(tw, "_blank") || (await navigator.clipboard.writeText(text));
      alert("Receipt details copied to clipboard.");
    } catch {
      /* user canceled / no share target */
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" aria-modal role="dialog">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[92vw] max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold">Join a Course</h3>
            {paid && receipt && (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                {receipt.verified ? "Verified by provider" : "Awaiting verification"}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <Steps step={step} />

        <div className="p-5 overflow-y-auto max-h-[60vh]">
          {step === 1 && (
            <>
              {loadingCourses ? (
                <div className="h-28 grid place-items-center text-sm text-slate-600">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading courses…
                  </span>
                </div>
              ) : (orgGateError || coursesError) ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {orgGateError || coursesError}
                </div>
              ) : (
                <CourseStep
                  selected={selectedCourse?.id ?? ""}
                  onSelect={(id) => setSelectedCourse(visibleCourses.find((c) => c.id === id) ?? null)}
                  error={errors.course}
                  courses={visibleCourses}
                  pendingMap={pendingMap} // <-- NEW
                />
              )}
            </>
          )}

          {step === 2 && (
            <DetailsStep
              values={{ fullName, age, gender, birth, address, mobile, email, photoUrl }}
              onValues={{
                fullName: setFullName,
                age: (v) => setAge(v as number | ""),
                gender: (v) => setGender(v as any),
                birth: setBirth, address: setAddress, mobile: setMobile, email: setEmail,
                photo: onPhotoChange
              }}
              errors={errors}
            />
          )}

          {step === 3 && selectedCourse && (
            <PaymentStep
              course={selectedCourse}
              total={total}
              base={base}
              discount={discount}
              discountKind={discountKind}
              setDiscountKind={setDiscountKind}
              couponCode={couponCode}
              setCouponCode={setCouponCode}
              method={method}
              setMethod={setMethod}
              mode={mode}
              setMode={setMode}
              partAmount={partAmount}
              setPartAmount={setPartAmount}
              isPaying={isPaying}
              onPay={method === "online" ? handleOnlinePay : undefined}
              errors={errors}
                receiptNo={receiptNo}
  setReceiptNo={setReceiptNo}
  referenceId={referenceId}
  setReferenceId={setReferenceId}
            />
          )}

          {step === 4 && paid && (
            <>
              {loadingReceipt ? (
                <div className="h-28 grid place-items-center text-sm text-slate-600">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Finalizing…
                  </span>
                </div>
              ) : (
                <SuccessStep
                  receipt={receipt ? {
                    orderId: receipt.orderId,
                    paymentId: receipt.paymentId,
                    status: receipt.status,
                    verified: receipt.verified,
                    method: receipt.method,
                    currency: receipt.currency,
                    amount: receipt.amount,
                    dateISO: receipt.dateISO,
                    student: { name: receipt.student?.name || fullName },
                    course: { title: receipt.course?.title || selectedCourse?.title || "" },
                    enrollment: { present: !!receipt.enrollment?.present, status: receipt.enrollment?.status || "pending" },
                  } : null}
                  onDownload={downloadReceipt}
                  onShare={shareReceipt}
                  innerRef={receiptRef}
                />
              )}
            </>
          )}
        </div>

        {step <= 3 && (
          <div className="flex items-center justify-between px-5 py-4 border-t bg-slate-50">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4" />
              <span>Payments are processed securely.</span>
            </div>
            <div className="flex items-center gap-3">
              {step > 1 && (
                <button onClick={prev} className="px-4 py-2 rounded-lg border hover:bg-white">
                  Back
                </button>
              )}
              {step < 3 && (
                <button
                  onClick={next}
                  className={classNames(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white",
                    "bg-indigo-600 hover:bg-indigo-700"
                  )}
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              )}
              {step === 3 && (
<button
  onClick={method === "online" ? handleOnlinePay : handleCashClaim}
  disabled={isPaying || Object.keys(errors).length > 0}
  className={classNames(
    "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white",
    isPaying ? "bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-700",
    "disabled:opacity-60 disabled:cursor-not-allowed"
  )}
>
  {isPaying ? (
    <>
      <Loader2 className="w-4 h-4 animate-spin" /> Processing…
    </>
  ) : method === "online" ? (
    <>
      Pay now <ChevronRight className="w-4 h-4" />
    </>
  ) : (
    <>
      Submit request <ChevronRight className="w-4 h-4" />
    </>
  )}
</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
