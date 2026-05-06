// mygf/src/components/join/steps/PaymentStep.tsx
import { AlertCircle, BadgePercent, CreditCard, Timer, Wallet } from "lucide-react";
import InlineError from "../ui/InlineError";
import type { CourseOption, DiscountKind, PayMethod, PayMode } from "../types";
import { formatINRFromPaise } from "../../../admin/utils/currency";

export default function PaymentStep(props: {
  course: CourseOption; base: number; discount: number; total: number;
  discountKind: DiscountKind; setDiscountKind: (v: DiscountKind) => void;
  couponCode: string; setCouponCode: (v: string) => void;
  method: PayMethod; setMethod: (v: PayMethod) => void;
  mode: PayMode; setMode: (v: PayMode) => void;
  partAmount: number | ""; setPartAmount: (v: number | "") => void;
  isPaying: boolean; onPay?: () => void | Promise<void>;
  errors: Record<string, string>;
  receiptNo: string; setReceiptNo: (v: string) => void;
  referenceId: string; setReferenceId: (v: string) => void;
  orgName?: string | null;
}) {
  const {
    course, base, discount, total,
    discountKind, setDiscountKind,
    couponCode, setCouponCode,
    method, setMethod,
    mode, setMode,
    partAmount, setPartAmount,
    errors,
    receiptNo, setReceiptNo,
    referenceId, setReferenceId,
  } = props;

  // Derive MRP/Sale from the course in **paise** (authoritative)
  const mrpPaise =
    Number.isFinite((course as any)?.mrpPaise) && (course as any)?.mrpPaise! > 0
      ? Number((course as any).mrpPaise)
      : Number((course as any)?.pricePaise) || 0;

  const salePaise =
    Number.isFinite((course as any)?.salePaise) && (course as any)?.salePaise! > 0
      ? Number((course as any).salePaise)
      : mrpPaise;

  // Course discount % (excludes coupon/referral; those are shown in the "You saved" banner)
  const courseDiscountPct =
    mrpPaise > 0 && salePaise < mrpPaise
      ? Math.round(((mrpPaise - salePaise) * 100) / mrpPaise)
      : 0;

  return (
    <div className="space-y-5">
      {/* Org attribution — always shown; defaults to "Platform" for global courses */}
      <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-2.5 text-sm text-indigo-800">
        Enrolling under:{" "}
        <span className="font-semibold">
          {props.orgName ?? "Unknown Center"}
        </span>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{course.title}</div>
            <div className="text-sm text-slate-600 flex items-center gap-2 mt-0.5">
              <Timer className="w-4 h-4" /> {course.duration || "—"}
            </div>
          </div>

          <div className="text-right">
            {/* Cut-off = MRP */}
            <div className="text-slate-500 line-through">
              {mrpPaise > 0 ? formatINRFromPaise(mrpPaise) : "-"}
            </div>

            {/* Payable = current total (after course discount + any coupon) */}
            <div className="text-lg font-semibold">
              {formatINRFromPaise((total || 0) * 100)}
            </div>

            {/* Course discount % */}
            {courseDiscountPct > 0 && (
              <div className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <BadgePercent className="h-3 w-3" />
                {courseDiscountPct}% OFF
              </div>
            )}
          </div>
        </div>

        {/* Discount chooser */}
        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          <label className="CardRadio">
            <input
              type="radio"
              name="disc"
              checked={discountKind === "none"}
              onChange={() => setDiscountKind("none")}
            />
            <BadgePercent className="w-4 h-4" />
            <span>No discount</span>
          </label>
          <label className="CardRadio">
            <input
              type="radio"
              name="disc"
              checked={discountKind === "coupon"}
              onChange={() => setDiscountKind("coupon")}
            />
            <BadgePercent className="w-4 h-4" />
            <span>Coupon</span>
          </label>
          <label className="CardRadio">
            <input
              type="radio"
              name="disc"
              checked={discountKind === "refer"}
              onChange={() => setDiscountKind("refer")}
            />
            <BadgePercent className="w-4 h-4" />
            <span>Refer discount</span>
          </label>
        </div>

        {discountKind === "coupon" && (
          <div className="mt-3 flex gap-2">
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Try WELCOME10"
              className="Input flex-1"
            />
            <button className="px-3 py-2 rounded-lg border bg-white hover:bg-slate-50">
              Apply
            </button>
          </div>
        )}

        {discount > 0 && (
          <div className="mt-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
            You saved {formatINRFromPaise((discount || 0) * 100)}. New total is{" "}
            {formatINRFromPaise((total || 0) * 100)}.
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border p-4">
          <div className="font-medium mb-3">Payment option</div>
          <div className="grid gap-2">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="method"
                className="Radio"
                checked={method === "online"}
                onChange={() => setMethod("online")}
              />
              <CreditCard className="w-4 h-4" />
              <span>Online (UPI / Card)</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="method"
                className="Radio"
                checked={method === "cash"}
                onChange={() => setMethod("cash")}
              />
              <Wallet className="w-4 h-4" />
              <span>Cash (admin confirmation required)</span>
            </label>
          </div>
          {method === "cash" && (
            <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              Your enrollment will activate after payment verification. Please contact admin to confirm payment.
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <div className="font-medium mb-3">Amount</div>
          <div className="grid gap-2">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                className="Radio"
                checked={mode === "full"}
                onChange={() => setMode("full")}
              />
              <span>Pay full ({formatINRFromPaise((total || 0) * 100)})</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                className="Radio"
                checked={mode === "part"}
                onChange={() => setMode("part")}
              />
              <span>Part payment (min 20%)</span>
            </label>
            {mode === "part" && (
              <>
                <input
                  type="number"
                  min={Math.ceil(total * 0.2)}
                  max={total}
                  value={partAmount}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : "";
                    if (val === "") setPartAmount("");
                    else setPartAmount(Math.max(0, Math.min(val, total)));
                  }}
                  className="Input"
                  placeholder={`Enter between ${formatINRFromPaise(Math.ceil(total * 0.2) * 100)} and ${formatINRFromPaise((total || 0) * 100)}`}
                />
                {errors.partAmount && <InlineError msg={errors.partAmount} />}
              </>
            )}
            {props.method === "cash" && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg flex items-start gap-2 md:col-span-2">
                  At least one identifier is required.*
                </p>
                <label className="block">
                  <span className="text-sm font-medium">Receipt No.</span>
                  <input
                    type="text"
                    value={receiptNo}
                    onChange={(e) => setReceiptNo(e.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 outline-none focus:ring"
                    placeholder="e.g., RCPT-12345"
                    autoComplete="off"
                    inputMode="text"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium">Reference ID / UTR</span>
                  <input
                    type="text"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 outline-none focus:ring"
                    placeholder="e.g., UTR/Txn Ref"
                    autoComplete="off"
                    inputMode="text"
                  />
                </label>

                <p className="text-xs text-muted-foreground md:col-span-2">
                  Adding these helps the admin verify your cash payment faster.
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
