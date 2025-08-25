// mygf/src/components/course/LevelCard.tsx
import React from "react";
import type { CourseLevel } from "./types";

export default function LevelCard({
  level,
  index,
  isUnlocked,
  isCompleted,
  isCurrent,
  onLevelClick,
}: {
  level: CourseLevel;
  index: number;
  isUnlocked: boolean;
  isCompleted: boolean;
  isCurrent: boolean;
  onLevelClick: (i: number) => void;
}) {
  return (
    <div
      className={
        "level-card bg-white rounded-xl p-6 shadow-lg cursor-pointer " +
        (!isUnlocked ? "opacity-50 cursor-not-allowed" : "")
      }
      onClick={() => isUnlocked && onLevelClick(index)}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{level.title}</h3>
        <div className="flex items-center">
          {isCompleted && (
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-2">
              <i className="fas fa-check text-white text-sm" />
            </div>
          )}
          {!isUnlocked && (
            <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
              <i className="fas fa-lock text-white text-sm" />
            </div>
          )}
        </div>
      </div>

      <p className="text-gray-600 mb-4">{level.description}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center text-gray-500">
          <i className="fas fa-clock mr-2" />
          <span className="text-sm">{level.duration}</span>
        </div>
        <div className="flex items-center text-gray-500">
          <i className="fas fa-video mr-2" />
          <span className="text-sm">{level.lessons} lessons</span>
        </div>
      </div>

      {level.assignment && (
        <div className="mt-4 p-3 bg-orange-50 rounded-lg border-l-4 border-orange-400">
          <div className="flex items-center">
            <i className="fas fa-tasks text-orange-500 mr-2" />
            <span className="text-sm font-medium text-orange-800">
              Assignment Required
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
