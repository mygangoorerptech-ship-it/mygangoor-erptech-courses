//mygf/src/components/course/SuccessAnimation.tsx
export default function SuccessAnimation({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 text-center">
        <div className="success-pulse mb-4">
          <i className="fas fa-check-circle text-6xl text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Level Completed!</h2>
        <p className="text-gray-600">Great job! Moving to the next level…</p>
      </div>
    </div>
  );
}
