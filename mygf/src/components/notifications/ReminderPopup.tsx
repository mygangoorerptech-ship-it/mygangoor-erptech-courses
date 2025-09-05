
// src/components/notifications/ReminderPopup.tsx
import React from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ReminderPopup() {
  const { lastPopup, read, close } = useNotifications();
  const [visible, setVisible] = React.useState(false);
  const nav = useNavigate();

  React.useEffect(() => {
    if (lastPopup) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 7000);
      return () => clearTimeout(t);
    }
  }, [lastPopup]);

  if (!lastPopup || !visible) return null;

  const go = async () => {
    await read(lastPopup._id);
    if (lastPopup.data?.courseId) nav(`/courses/${lastPopup.data.courseId}`);
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-gray-200 bg-white p-3 shadow-xl ring-1 ring-black/5">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="text-sm font-semibold text-gray-900">{lastPopup.title}</div>
          <div className="text-sm text-gray-700 mt-0.5">{lastPopup.body}</div>
          <div className="mt-2 flex gap-2">
            <button onClick={go} className="inline-flex items-center rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-50">
              Open
            </button>
            <button onClick={() => { close(lastPopup._id); setVisible(false); }} className="inline-flex items-center rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-50">
              Dismiss
            </button>
          </div>
        </div>
        <button onClick={() => setVisible(false)} className="p-1 rounded-md hover:bg-gray-50"><X size={16} /></button>
      </div>
    </div>
  );
}
