import React from 'react';
import { Avatar } from './ui.jsx';
import { BellIcon } from './Icons.jsx';

export default function HeaderActions({ me, unreadCount = 0, onOpenNotifications }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onOpenNotifications}
        className="w-10 h-10 rounded-full bg-white border border-line-light flex items-center justify-center relative text-ink-500"
        aria-label="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {me && <Avatar user={me} size={40} />}
    </div>
  );
}
