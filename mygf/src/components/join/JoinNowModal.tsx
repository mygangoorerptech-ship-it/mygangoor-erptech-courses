// mygf/src/components/join/JoinNowModal.tsx
import React from "react";
import { X, ChevronRight, GraduationCap, Loader2, ShieldCheck } from "lucide-react";
import Steps from "./ui/Steps";
import CourseStep from "./steps/CourseStep";
import DetailsStep from "./steps/DetailsStep";
import PaymentStep from "./steps/PaymentStep";
import SuccessStep from "./steps/SuccessStep";
import { COURSES } from "./constants";
import { classNames } from "./utils";
import type { CourseOption, DiscountKind, Gender, PayMethod, PayMode, Step } from "./types";

export default function JoinNowModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = React.useState<Step>(1);
  const [selectedCourse, setSelectedCourse] = React.useState<CourseOption | null>(null);

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

  // price math
  const base = selectedCourse?.price ?? 0;
  const discount = (() => {
    if (!selectedCourse) return 0;
    if (discountKind === "coupon" && couponCode.trim().toLowerCase() === "welcome10")
      return Math.round(base * 0.1);
    if (discountKind === "refer") return Math.round(base * 0.05);
    return 0;
  })();
  const total = Math.max(0, base - discount);

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
    if (file) setPhotoUrl(URL.createObjectURL(file));
    else setPhotoUrl(null);
  }
  async function simulatePayment() {
    if (Object.keys(errors).length) return;
    setIsPaying(true);
    await new Promise((r) => setTimeout(r, 1400));
    setIsPaying(false);
    setPaid(true);
    setStep(4);
  }

    // --- build a simple demo receipt (no backend) ---
  const receipt = React.useMemo(() => {
    const paidNow =
      mode === "part" ? (typeof partAmount === "number" ? partAmount : Number(partAmount) || 0) : total;

    return {
      platform: "MYGF",
      demo: true,
      name: fullName || "Student",
      course: selectedCourse?.title || "",
      method,
      mode,
      paidNow,
      total,
      discountKind,
      discount,
      dateISO: new Date().toISOString(),
    };
  }, [fullName, selectedCourse, method, mode, partAmount, total, discountKind, discount]);

  function downloadReceipt() {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mygf-receipt-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function shareReceipt() {
    const text =
      `MYGF Receipt (Demo)\n` +
      `Name: ${receipt.name}\n` +
      `Course: ${receipt.course}\n` +
      `Method: ${receipt.method}\n` +
      `Mode: ${receipt.mode}\n` +
      `Paid now: ₹${receipt.paidNow}\n` +
      `Total: ₹${receipt.total}\n` +
      `Date: ${new Date(receipt.dateISO).toLocaleString()}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "MYGF Receipt", text });
      } catch {
        // user cancelled share; no-op
      }
    } else {
      await navigator.clipboard?.writeText(text);
      alert("Receipt details copied to clipboard.");
    }
  }

  // --- auto-close after success (10s) ---
  React.useEffect(() => {
    if (step === 4) {
      const t = setTimeout(onClose, 10_000);
      return () => clearTimeout(t);
    }
  }, [step, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" aria-modal role="dialog">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[92vw] max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold">Join a Course</h3>
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
              Demo • No payment made
            </span>
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
            <CourseStep
              selected={selectedCourse?.id ?? ""}
              onSelect={(id) => setSelectedCourse(COURSES.find(c => c.id === id) || null)}
              error={errors.course}
            />
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
              onPay={simulatePayment}
              errors={errors}
            />
          )}

          {step === 4 && paid && selectedCourse && (
            <SuccessStep name={fullName} course={selectedCourse.title} method={method} onDownload={downloadReceipt} onShare={shareReceipt} />
          )}
        </div>

        {step <= 3 && (
          <div className="flex items-center justify-between px-5 py-4 border-t bg-slate-50">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4" />
              <span>Your data is safe. This is a local demo only.</span>
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
                  onClick={simulatePayment}
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
                  ) : (
                    <>
                      Pay now <ChevronRight className="w-4 h-4" />
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
