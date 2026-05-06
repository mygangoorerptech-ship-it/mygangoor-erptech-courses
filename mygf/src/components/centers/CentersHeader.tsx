//src/components/centers/CentersHeader.tsx
//src/components/centers/CentersHeader.tsx
import { Building2, Search } from "lucide-react";

export default function CentersHeader({
    query,
    setQuery,
    region,
    setRegion,
}: {
    query: string;
    setQuery: (v: string) => void;
    region: string;
    setRegion: (v: string) => void;
}) {
    return (
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            {/* LEFT */}
            <div className="flex items-start gap-4">

                {/* ICON */}
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <Building2
                        size={26}
                        strokeWidth={1.8}
                        className="text-gray-700"
                    />
                </div>

                {/* TEXT */}
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-[28px] font-semibold tracking-tight text-gray-900">
                            Our Learning Centers
                        </h1>

                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
                            Verified
                        </span>
                    </div>

                    <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
                        Explore centers and their learning opportunities
                    </p>
                </div>
            </div>

            {/* RIGHT */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

                {/* SEARCH */}
                <div className="relative w-full sm:w-[320px]">
                    <Search
                        size={17}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search centers..."
                        className="h-12 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm text-gray-700 shadow-sm transition-all placeholder:text-gray-400 focus:border-gray-300 focus:outline-none focus:ring-4 focus:ring-gray-100"
                    />
                </div>

                {/* REGION */}
                <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="h-12 min-w-[180px] rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-700 shadow-sm transition focus:border-gray-300 focus:outline-none focus:ring-4 focus:ring-gray-100"
                >
                    <option value="all">All Regions</option>
                    <option value="Karnataka Region">Karnataka Region</option>
                    <option value="North Region">North Region</option>
                </select>
            </div>
        </div>
    );
}