// mygf/src/components/CourseProgress.tsx

export default function CourseProgress({
  currentLevel,
  totalLevels,
  completedLevels,
}: {
  currentLevel: number;
  totalLevels: number;
  completedLevels: number;
}) {
  const progressPercentage = Math.min(
    100,
    Math.round((completedLevels / totalLevels) * 100)
  );

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Course Progress</h3>
        <span className="text-sm text-gray-600">
          {completedLevels}/{totalLevels} Levels
        </span>
      </div>
      <div className="relative bg-gray-200 rounded-full h-3 mb-4">
        <div
          className="progress-fill bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      <div className="flex justify-between items-center">
        {Array.from({ length: totalLevels }, (_, index) => (
          <div key={index} className="flex flex-col items-center">
            <div
              className={
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium " +
                (index < completedLevels
                  ? "bg-green-500 text-white"
                  : index === currentLevel
                  ? "bg-blue-500 text-white"
                  : "bg-gray-300 text-gray-600")
              }
            >
              {index < completedLevels ? (
                <i className="fas fa-check" />
              ) : (
                index + 1
              )}
            </div>
            <span className="text-xs text-gray-600 mt-1">
              Level {index + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
