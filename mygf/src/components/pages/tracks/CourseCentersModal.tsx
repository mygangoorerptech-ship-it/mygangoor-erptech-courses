//src/components/pages/tracks/CourseCentersModal.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/store";
import buildingImage from "../../../assets/org/building.png";

type CourseCentersModalProps = {
    visible: boolean;
    course: any;
    onClose: () => void;
    onSelectCenter: (orgId: string, orgName: string) => void;
};

const CourseCentersModal: React.FC<CourseCentersModalProps> = ({
    visible,
    course,
    onClose,
    onSelectCenter,
}) => {
    const navigate = useNavigate();
    const { user } = useAuth();

    if (!visible || !course) return null;

    const handleEnroll = (orgId: string, orgName: string) => {
        if (!orgId) {
            console.error("❌ Invalid center selection");
            return;
        }

        // 🔒 AUTH GUARD
        if (!user) {
            navigate("/login", {
                state: { redirectTo: window.location.pathname },
            });
            return;
        }

        onSelectCenter(orgId, orgName);
    };

    // ✅ SAFE CENTER LIST PREPARATION
    const centers: { id: string; name: string }[] = Array.isArray(course.centerIds)
        ? course.centerIds.map((id: string, i: number) => ({
            id,
            name: course.centerNames?.[i] || "Unnamed Center",
        }))
        : [];

// RESPONSIVE + PREMIUM IMPROVED VERSION

return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        {/* BACKDROP */}
        <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[4px]"
            onClick={onClose}
        />

        {/* MODAL */}
        <div className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-gray-200/80 bg-white shadow-[0_25px_80px_rgba(0,0,0,0.14)] sm:rounded-[28px]">

            {/* HEADER */}
            <div className="border-b border-gray-100 px-4 py-5 sm:px-6 sm:py-6 lg:px-7">
                <div className="flex items-start justify-between gap-4">

                    {/* LEFT */}
                    <div className="min-w-0">
                        <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-gray-500 sm:text-[11px]">
                            Learning Centers
                        </div>

                        <h2 className="mt-3 truncate text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
                            {course.title}
                        </h2>

                        <p className="mt-2 max-w-lg text-sm leading-6 text-gray-500">
                            Select your preferred center to continue enrollment
                        </p>
                    </div>

                    {/* CLOSE */}
                    <button
                        onClick={onClose}
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition-all duration-200 hover:bg-gray-100 hover:text-gray-700"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* CENTER LIST */}
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-7">
                {centers.length > 0 ? (
                    <div className="space-y-3 sm:space-y-4">
                        {centers.map(({ id, name }) => (
                            <div
                                key={id}
                                className="group flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50/60 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
                            >
                                {/* LEFT */}
                                <div className="flex min-w-0 items-center gap-4">

                                    {/* IMAGE */}
                                    <div className="relative h-[48px] w-[48px] flex-shrink-0 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 sm:h-[62px] sm:w-[62px]">

                                        {/* SKELETON */}
                                        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100" />

                                        {/* IMAGE */}
                                        <img
                                            src={buildingImage}
                                            alt="Center"
                                            loading="lazy"
                                            className="relative z-10 h-full w-full object-cover"
                                            onLoad={(e) => {
                                                const skeleton =
                                                    e.currentTarget.previousElementSibling as HTMLElement;

                                                if (skeleton) {
                                                    skeleton.style.display = "none";
                                                }
                                            }}
                                        />
                                    </div>

                                    {/* CONTENT */}
                                    <div className="min-w-0">
                                        <h3 className="truncate text-[15px] font-semibold tracking-tight text-gray-900 sm:text-[17px]">
                                            {name}
                                        </h3>

                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                                                Verified
                                            </span>

                                            <span className="text-xs text-gray-400 sm:text-sm">
                                                Learning Center
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* ACTION */}
                                <button
                                    onClick={() => handleEnroll(id, name)}
                                    disabled={!user}
                                    className={`w-full rounded-xl px-5 py-3 text-sm font-medium transition-all duration-200 sm:w-auto sm:min-w-[150px] ${user
                                            ? "border border-gray-200 bg-gray-900 text-white hover:bg-black"
                                            : "border border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200"
                                        }`}
                                >
                                    {user ? "Enroll Now" : "Login to Enroll"}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center px-4 py-16 text-center sm:py-20">

                        <div className="relative mb-5 overflow-hidden rounded-3xl border border-gray-100 bg-gray-50 p-5">
                            <div className="absolute inset-0 bg-gradient-to-br from-gray-100/50 to-transparent" />

                            <img
                                src={buildingImage}
                                alt="No centers"
                                className="relative z-10 h-14 w-14 object-contain opacity-75 sm:h-16 sm:w-16"
                            />
                        </div>

                        <p className="text-base font-semibold text-gray-800">
                            No centers available
                        </p>

                        <p className="mt-2 max-w-sm text-sm leading-6 text-gray-400">
                            Organizations will appear here once assigned to this course
                        </p>
                    </div>
                )}
            </div>

            {/* FOOTER */}
            <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4 sm:px-6 lg:px-7">
                <button
                    onClick={onClose}
                    className="text-sm font-medium text-gray-500 transition-colors duration-200 hover:text-gray-900"
                >
                    Close
                </button>
            </div>
        </div>
    </div>
);
};

export default CourseCentersModal;