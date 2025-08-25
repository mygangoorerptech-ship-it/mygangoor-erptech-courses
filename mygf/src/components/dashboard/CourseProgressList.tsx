// mygf/src/components/dashboard/CourseProgressList.tsx
import React from "react";
import Card from "./ui/Card";
import ProgressBar from "./ui/ProgressBar";
import type { CourseProgress } from "./types";

type Props = {
  items: CourseProgress[];
};

export default function CourseProgressList({ items }: Props) {
  return (
    <Card className="p-8">
      <h4 className="text-xl font-bold text-gray-900 mb-6">Course Progress</h4>
      <div className="space-y-4">
        {items.map((c) => (
          <div
            key={c.id}
            className={`bg-gradient-to-r ${c.gradient.from} ${c.gradient.to} rounded-xl p-4`}
          >
            <div className="flex justify-between items-center mb-2">
              <h5 className="font-semibold text-gray-900">{c.title}</h5>
              <span className={`${c.barColor.replace("bg-", "text-")} font-bold`}>
                {c.percent}%
              </span>
            </div>

            <ProgressBar
              value={c.percent}
              barColor={c.barColor}
              trackColor={c.trackColor}
            />

            <div className="flex justify-between items-center mt-2 text-sm text-gray-600">
              <span>{c.status}</span>
              {c.status === "Completed" ? (
                <i className="fas fa-certificate text-yellow-500" />
              ) : (
                <span>{c.remaining}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
