// mygf/src/components/dashboard/LearningStreakCard.tsx
import React from "react";
import Card from "./ui/Card";

type Props = {
  days: number;
  message?: string;
};

export default function LearningStreakCard({
  days,
  message = "Keep it up! You're on fire! 🔥",
}: Props) {
  return (
    <Card>
      <h4 className="text-lg font-bold text-gray-900 mb-4">Learning Streak</h4>
      <div className="text-center">
        <div className="bg-gradient-to-r from-orange-400 to-red-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3">
          <i className="fas fa-fire text-white text-2xl" />
        </div>
        <p className="text-3xl font-bold text-gray-900">{days}</p>
        <p className="text-gray-600">Days in a row</p>
        <div className="mt-4 bg-orange-100 rounded-lg p-3">
          <p className="text-sm text-orange-800">{message}</p>
        </div>
      </div>
    </Card>
  );
}
