import React from 'react';
import { Avatar } from './ui.jsx';
import { BellIcon, ActivityIcon } from './Icons.jsx';

// Top-right action cluster used across Home, Calendar, Projects, Reports, Profile.
//
// Optional props:
//   onOpenActivity     if provided, renders an Activity icon button left of the bell.
//                      (Only Home passes this today — the activity feed is Home-specific.)
//   activityHasUnread  boolean → shows a small dot on the Activity button.

export default function HeaderActions({
  me,
  unreadCount = 0,
  onOpenNotifications,
  onOpenProfile,
  onOpenActivity,
  activityHasUnread = false,
}) {
  return (
    <div className="flex items-center gap-2">
      {onOpenActivity && (
        <button
          onClick={onOpenActivity}
          className="w-10 h-10 rounded-full bg-white border border-line-light flex items-center justify-center relative text-ink-500"
          aria-label="Activity feed"
          title="Activity feed"
        >
          <ActivityIcon />
          {activityHasUnread && (
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ background: '#5B8CFF', boxShadow: '0 0 6px rgba(91,140,255,0.7)' }}
            />
          )}
        </button>
      )}
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
      {me && (
        <button onClick={onOpenProfile} className="rounded-full transition hover:ring-2 hover:ring-brand-blue/30" aria-label="Profile">
          <Avatar user={me} size={40} />
        </button>
      )}
    </div>
  );
}
