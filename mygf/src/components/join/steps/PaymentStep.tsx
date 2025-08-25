// mygf/src/components/join/steps/PaymentStep.tsx
import React from "react";
import { AlertCircle, BadgePercent, CreditCard, Timer, Wallet } from "lucide-react";
import InlineError from "../ui/InlineError";
import type { CourseOption, DiscountKind, PayMethod, PayMode } from "../types";

export default function PaymentStep(props: {
  course: CourseOption; base: number; discount: number; total: number;
  discountKind: DiscountKind; setDiscountKind: (v: DiscountKind)=>void;
  couponCode: string; setCouponCode: (v: string)=>void;
  method: PayMethod; setMethod: (v: PayMethod)=>void;
  mode: PayMode; setMode: (v: PayMode)=>void;
  partAmount: number | ""; setPartAmount: (v: number | "") => void;
  isPaying: boolean; onPay: () => void;
  errors: Record<string, string>;
}) {
  const {
    course, base, discount, total,
    discountKind, setDiscountKind,
    couponCode, setCouponCode,
    method, setMethod,
    mode, setMode,
    partAmount, setPartAmount,
    errors
  } = props;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{course.title}</div>
            <div className="text-sm text-slate-600 flex items-center gap-2 mt-0.5">
              <Timer className="w-4 h-4" /> {course.duration}
            </div>
          </div>
          <div className="text-right">
            <div className="text-slate-500 line-through">{base ? `₹${base}` : "-"}</div>
            <div className="text-lg font-semibold">₹{total}</div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          <label className="CardRadio">
            <input type="radio" name="disc" checked={discountKind === "none"} onChange={() => setDiscountKind("none")} />
            <BadgePercent className="w-4 h-4" />
            <span>No discount</span>
          </label>
          <label className="CardRadio">
            <input type="radio" name="disc" checked={discountKind === "coupon"} onChange={() => setDiscountKind("coupon")} />
            <BadgePercent className="w-4 h-4" />
            <span>Coupon</span>
          </label>
          <label className="CardRadio">
            <input type="radio" name="disc" checked={discountKind === "refer"} onChange={() => setDiscountKind("refer")} />
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
            You saved ₹{discount}. New total is ₹{total}.
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border p-4">
          <div className="font-medium mb-3">Payment option</div>
          <div className="grid gap-2">
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="method" className="Radio" checked={method === "online"} onChange={() => setMethod("online")} />
              <CreditCard className="w-4 h-4" />
              <span>Online (UPI / Card)</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="method" className="Radio" checked={method === "cash"} onChange={() => setMethod("cash")} />
              <Wallet className="w-4 h-4" />
              <span>Cash (admin confirmation required)</span>
            </label>
          </div>
          {method === "cash" && (
            <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              We’ll hold your seat for 48 hours. Please contact admin to confirm payment.
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <div className="font-medium mb-3">Amount</div>
          <div className="grid gap-2">
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="mode" className="Radio" checked={mode === "full"} onChange={() => setMode("full")} />
              <span>Pay full (₹{total})</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="mode" className="Radio" checked={mode === "part"} onChange={() => setMode("part")} />
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
                  placeholder={`Enter between ₹${Math.ceil(total * 0.2)} and ₹${total}`}
                />
                {errors.partAmount && <InlineError msg={errors.partAmount} />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
