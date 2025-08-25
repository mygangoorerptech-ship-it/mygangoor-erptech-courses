// mygf/src/components/pages/tracks/SidebarSmartFilter.tsx
import React from "react";
import type { Availability, Course } from "./types";

function RadioRow({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: () => void;
}) {
    return (
        <label className="flex cursor-pointer items-center gap-3 text-slate-700">
            <input type="radio" className="peer sr-only" checked={checked} onChange={onChange} />
            <span
                className={[
                    "grid h-5 w-5 place-content-center rounded-full border transition",
                    checked ? "border-blue-600" : "border-slate-300",
                ].join(" ")}
                aria-hidden
            >
                <span className={["h-3 w-3 rounded-full transition", checked ? "bg-blue-600 scale-100" : "bg-transparent scale-0"].join(" ")} />
            </span>
            <span className="select-none">{label}</span>
        </label>
    );
}

export default function SidebarSmartFilter({
    availability,
    setAvailability,
    wishlist = [],
    onToggleWishlist,
}: {
    availability: Availability;
    setAvailability: (a: Availability) => void;
    wishlist?: Course[];
    onToggleWishlist: (c: Course) => void;
}) {
    return (
        <aside className="">
            <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur">
                <h3 className="text-lg font-semibold text-slate-800">Smart Filter</h3>

                <div className="mt-4 space-y-3">
                    <RadioRow
                        label="Any Mentor"
                        checked={availability === "any"}
                        onChange={() => setAvailability("any")}
                    />
                    <RadioRow
                        label="Available Mentors"
                        checked={availability === "available"}
                        onChange={() => setAvailability("available")}
                    />
                    <RadioRow
                        label="Unavailable Mentors"
                        checked={availability === "unavailable"}
                        onChange={() => setAvailability("unavailable")}
                    />
                </div>

                <hr className="my-5 border-slate-200" />

                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                    <span className="grid h-9 w-9 place-content-center rounded-full bg-blue-100 text-blue-600">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M6 10h12v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9Z" stroke="currentColor" strokeWidth="2" />
                            <path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="2" />
                        </svg>
                    </span>
                    <div>
                        <p className="text-slate-800 font-medium">Payment secured</p>
                        <p className="text-xs text-slate-500">256-bit SSL • PCI-DSS compliant</p>
                    </div>
                </div>
            </div>

            {/* Wishlist preview (demo) */}
            <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-700">Wishlist (demo)</h3>
                {wishlist.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">Click the heart on any course to add it here.</p>
                ) : (
                    <div className="mt-3 grid grid-cols-1 gap-3">
                        {wishlist.map((c) => (
                            <div key={c.id} className="flex items-center gap-3 border border-slate-300 bg-white/70 px-3 py-2">
                                <div
                                    className="h-10 w-10 bg-cover bg-center rounded"
                                    style={{ backgroundImage: c.cover ? `url(${c.cover})` : undefined }}
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm text-slate-800">{c.title}</p>
                                    <p className="text-xs text-slate-500">{c.level} • {c.durationHours}h • {c.rating.toFixed(1)}★</p>
                                </div>
                                <button
                                    className="ml-auto p-1 text-slate-500 hover:text-rose-600"
                                    onClick={() => onToggleWishlist(c)}
                                    aria-label="Remove from wishlist"
                                    title="Remove"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </aside>
    );
}
