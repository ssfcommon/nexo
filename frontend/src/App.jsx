import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { api } from './api.js';
import Home from './screens/Home.jsx';
import Projects from './screens/Projects.jsx';
import Calendar from './screens/Calendar.jsx';
import Profile from './screens/Profile.jsx';
import Login from './screens/Login.jsx';
import Notifications from './screens/Notifications.jsx';
import ConfettiHost from './components/Confetti.jsx';
import useMediaQuery from './hooks/useMediaQuery.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import OnboardingTour from './components/OnboardingTour.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import useAlarms from './hooks/useAlarms.js';
import { HomeIcon, FolderIcon, CalendarIcon, UserIcon } from './components/Icons.jsx';
import FAB from './components/FAB.jsx';
import { Avatar } from './components/ui.jsx';

const tabs = [
  { id: 'home',    label: 'Home',     Icon: HomeIcon,     component: Home },
  { id: 'projects',label: 'Projects', Icon: FolderIcon,   component: Projects },
  { id: 'calendar',label: 'Calendar', Icon: CalendarIcon, component: Calendar },
  { id: 'profile', label: 'Profile',  Icon: UserIcon,     component: Profile },
];

export default function App() {
  const { user: me, isAuthenticated, isAuthLoading } = useAuth();
  const [tab, setTab] = useState('home');
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [deepLink, setDeepLink] = useState(null);

  const handlePaletteNavigate = ({ tab: nextTab, projectId }) => {
    setNotifOpen(false);
    if (nextTab) setTab(nextTab);
    if (projectId) setDeepLink({ kind: 'project', id: projectId, ts: Date.now() });
  };
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const refreshUnread = useCallback(async () => {
    try {
      const notifs = await api.notifications();
      setUnreadCount(notifs.filter(n => !n.read).length);
    } catch {}
  }, []);

  useEffect(() => {
    if (isAuthenticated) refreshUnread();
  }, [isAuthenticated, refreshUnread]);

  useAlarms();

  if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center text-ink-300">Loading…</div>;
  if (!isAuthenticated) return <Login />;

  const openNotifications = () => setNotifOpen(true);
  const closeNotifications = () => { setNotifOpen(false); refreshUnread(); };

  const Active = tabs.find(t => t.id === tab).component;

  const content = (
    <ErrorBoundary>
      {notifOpen ? (
        <Notifications onClose={closeNotifications} />
      ) : (
        <Active me={me} unreadCount={unreadCount} onOpenNotifications={openNotifications} deepLink={deepLink} onSwitchTab={(t, payload) => { setTab(t); setNotifOpen(false); if (payload?.addEvent) setDeepLink({ kind: 'addEvent', title: payload.addEvent, ts: Date.now() }); if (payload?.kind) setDeepLink({ ...payload, ts: Date.now() }); }} />
      )}
    </ErrorBoundary>
  );

  if (isDesktop) return (
    <div className="min-h-screen bg-page">
      <div className="flex min-h-screen">
        <aside className="w-60 border-r border-line-light bg-white flex flex-col">
          <div className="px-5 py-5">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Nexo" className="w-10 h-10 object-contain" />
              <div>
                <span className="font-bold text-lg text-ink-900 leading-none block tracking-tight">Nexo</span>
                <span className="text-xs text-ink-400 leading-tight">Know What's Next to Do</span>
              </div>
            </div>
          </div>
          <nav className="flex-1 px-3 space-y-0.5">
            {tabs.map(t => {
              const active = tab === t.id && !notifOpen;
              return (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setNotifOpen(false); setDeepLink(null); }}
                  className={'w-full flex items-center gap-3 px-3 h-10 rounded-input text-left text-sm font-medium transition-all duration-150 ' +
                    (active ? 'bg-brand-blue/10 text-brand-blue' : 'text-ink-500 hover:bg-ink-100/60 hover:text-ink-700')}
                >
                  <t.Icon />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>
          {me && (
            <button onClick={() => setTab('profile')} className="w-full px-4 py-3.5 border-t border-line-light flex items-center gap-2.5 hover:bg-ink-100/60 transition text-left">
              <Avatar user={me} size={32} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-900 truncate">{me.name}</p>
                <p className="text-xs text-ink-400 truncate">{me.department}</p>
              </div>
            </button>
          )}
        </aside>
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1100px] mx-auto px-8 py-6">
            {content}
          </div>
        </main>
      </div>
      <FAB />
      <ConfettiHost />
      <OnboardingTour />
      <CommandPalette onNavigate={handlePaletteNavigate} />
    </div>
  );

  return (
    <div className="min-h-screen bg-page">
      <div className="flex justify-center">
        <div className="w-full max-w-[420px] bg-page min-h-screen flex flex-col relative">
          <main className="flex-1 px-5 pt-4 pb-28 overflow-y-auto">
            {content}
          </main>
          <nav className="fixed bottom-0 w-full max-w-[420px] bg-white/90 backdrop-blur-lg border-t border-line-light h-[60px] pb-[env(safe-area-inset-bottom)] flex">
            {tabs.map(t => {
              const active = tab === t.id && !notifOpen;
              return (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setNotifOpen(false); setDeepLink(null); }}
                  className={'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ' + (active ? 'text-brand-blue' : 'text-ink-400')}
                >
                  <t.Icon />
                  <span className="text-[10px] font-medium">{t.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <FAB />
      <ConfettiHost />
      <OnboardingTour />
      <CommandPalette onNavigate={handlePaletteNavigate} />
    </div>
  );
}
