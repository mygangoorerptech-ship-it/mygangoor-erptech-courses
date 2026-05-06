// src/components/enrolled/EnrolledTabs.tsx

export type EnrolledTabValue =
  | "all"
  | "progress"
  | "completed"
  | "pinned";

interface Props {
  active: EnrolledTabValue;

  setActive: (
    value: EnrolledTabValue
  ) => void;

  counts: {
    all: number;
    inProgress: number;
    completed: number;
    pinned?: number;
  };
}

export default function EnrolledTabs({
  active,
  setActive,
  counts,
}: Props) {
  const tabs = [
    {
      label: `All Courses (${counts.all})`,
      value: "all" as EnrolledTabValue,
    },
    {
      label: `In Progress (${counts.inProgress})`,
      value: "progress" as EnrolledTabValue,
    },
    {
      label: `Completed (${counts.completed})`,
      value: "completed" as EnrolledTabValue,
    },
    {
      label: `Pinned (${counts.pinned || 0})`,
      value: "pinned" as EnrolledTabValue,
    },
  ];

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-center gap-8 border-b border-slate-200">
        {tabs.map((tab) => {
          const isActive =
            active === tab.value;

          return (
            <button
              key={tab.value}
              onClick={() =>
                setActive(tab.value)
              }
              className={`border-b-2 px-1 pb-4 pt-2 text-sm font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}