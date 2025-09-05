
// src/components/notifications/NotificationBell.tsx
import React from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';

export default function NotificationBell() {
  const { items, unread, read, close } = useNotifications();
  const [open, setOpen] = React.useState(false);
  const nav = useNavigate();

  const onClickItem = async (id: string, it: any) => {
    await read(id);
    if (it?.data?.courseId) {
      nav(`/courses/${it.data.courseId}`);
    } else if (it?.type === 'certificate_available' && it?.data?.progressId) {
      nav(`/courses/${it.data.courseId || ''}`);
    }
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 shadow-sm hover:bg-gray-50 active:bg-gray-100"
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-gray-200 bg-white shadow-lg ring-1 ring-black/5">
          <div className="max-h-80 overflow-auto">
            {items.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No new reminders</div>
            ) : (
              items.map((it) => (
                <div key={it._id} className="p-3 hover:bg-gray-50 border-b border-gray-100 last:border-none">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900">{it.title}</div>
                      <div className="text-sm text-gray-600 mt-0.5">{it.body}</div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => onClickItem(it._id, it)}
                          className="inline-flex items-center rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-50"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => close(it._id)}
                          className="inline-flex items-center rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                    {!it.readAt && <span className="mt-0.5 h-2 w-2 rounded-full bg-blue-500" />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
