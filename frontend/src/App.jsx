import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { api } from './api.js';
import Home from './screens/Home.jsx';
import Projects from './screens/Projects.jsx';
import Bugs from './screens/Bugs.jsx';
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
import { useBackHandler } from './hooks/useBackHandler.js';
import { usePullToRefresh } from './hooks/usePullToRefresh.js';
import { HomeIcon, FolderIcon, CalendarIcon, UserIcon, BugIcon } from './components/Icons.jsx';
import FAB from './components/FAB.jsx';
import { Avatar } from './components/ui.jsx';

const tabs = [
  { id: 'home',    label: 'Home',     Icon: HomeIcon,     component: Home },
  { id: 'projects',label: 'Projects', Icon: FolderIcon,   component: Projects },
  { id: 'bugs',    label: 'Bugs',     Icon: BugIcon,      component: Bugs },
  { id: 'calendar',label: 'Calendar', Icon: CalendarIcon, component: Calendar },
  { id: 'profile', label: 'Profile',  Icon: UserIcon,     component: Profile },
];

// ── Pull-to-refresh indicator ────────────────────────────────
// Floats under the status bar, fades in with pull, locks into a
// spinner while refreshing. Dark glass to match the app vocabulary.
function PullRefreshIndicator({ pullDelta, refreshing, threshold }) {
  const visible = refreshing || pullDelta > 4;
  const ratio = Math.min(1, pullDelta / threshold);
  const travel = refreshing ? threshold * 0.55 : pullDelta * 0.4;
  return (
    <div
      className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-[65] transition-opacity duration-200"
      style={{
        // Shell already has safe-area-inset-top padding; 8px sits just below it
        top: 8,
        transform: `translate(-50%, ${travel}px)`,
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center"
        style={{
          background: 'rgba(17,24,39,0.82)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
          transform: `scale(${0.7 + ratio * 0.3})`,
          transition: refreshing ? 'transform 180ms ease' : 'none',
        }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          {refreshing ? (
            // Spinner — rotating arc
            <circle cx="12" cy="12" r="8" strokeDasharray="24 36" style={{ animation: 'spin 0.8s linear infinite', transformOrigin: '12px 12px' }} />
          ) : (
            // Progress arc fills as user pulls
            <circle
              cx="12"
              cy="12"
              r="8"
              strokeDasharray={`${Math.max(2, ratio * 50)} 100`}
              transform="rotate(-90 12 12)"
            />
          )}
        </svg>
      </div>
    </div>
  );
}

export default function App() {
  const { user: me, isAuthenticated, isAuthLoading } = useAuth();
  const [tab, setTab] = useState('home');
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [deepLink, setDeepLink] = useState(null);

  // Two refs handle the notification-driven detour:
  //   resumeNotifsRef — on detail-close, reopen Notifications (consumed once).
  //   restoreTabRef   — on notif-close, go back to the tab the user was on
  //                     before the detour (survives through the reopen).
  // Both clear on any explicit user navigation (bottom nav, palette, etc.).
  const resumeNotifsRef = useRef(false);
  const restoreTabRef = useRef(null);

  const handlePaletteNavigate = ({ tab: nextTab, projectId }) => {
    // Command palette is a fresh intent — no detour to resume.
    resumeNotifsRef.current = false;
    restoreTabRef.current = null;
    setNotifOpen(false);
    if (nextTab) setTab(nextTab);
    if (projectId) setDeepLink({ kind: 'project', id: projectId, ts: Date.now() });
  };

  // When a detail view (project / bug / event modal) closes, dispatch
  // 'nexo:detail-closed' from the screen that owns it. We catch it here
  // and, if the user got into that detail by tapping a notification,
  // re-open the Notifications overlay so back-nav feels intuitive.
  useEffect(() => {
    const h = () => {
      if (resumeNotifsRef.current) {
        resumeNotifsRef.current = false;
        setNotifOpen(true);
      }
    };
    window.addEventListener('nexo:detail-closed', h);
    return () => window.removeEventListener('nexo:detail-closed', h);
  }, []);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const refreshUnread = useCallback(async () => {
    try {
      const notifs = await api.notifications();
      setUnreadCount(notifs.filter(n => !n.read).length);
    } catch {}
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    refreshUnread();
    // Poll unread count every 60s so newly-created notifications show up in the badge
    const i = setInterval(refreshUnread, 60000);
    return () => clearInterval(i);
  }, [isAuthenticated, refreshUnread]);

  useAlarms();
  // Closing Notifications — whether via the X button, the back button,
  // or the back-handler — should also restore the tab the user was on
  // before the notif-driven detour (if one happened).
  const closeNotificationsAndMaybeRestore = useCallback(() => {
    setNotifOpen(false);
    refreshUnread();
    if (restoreTabRef.current) {
      setTab(restoreTabRef.current);
      restoreTabRef.current = null;
    }
  }, [refreshUnread]);
  useBackHandler('notifications', notifOpen, closeNotificationsAndMaybeRestore);

  // Pull-to-refresh for the mobile shell. Screens subscribe to the
  // 'nexo:refresh' window event to re-fetch their data.
  const mainRef = useRef(null);
  const onPullRefresh = useCallback(() => {
    window.dispatchEvent(new Event('nexo:refresh'));
    refreshUnread();
  }, [refreshUnread]);
  const { pullDelta, refreshing, threshold } = usePullToRefresh(mainRef, onPullRefresh);

  if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center text-ink-300">Loading…</div>;
  if (!isAuthenticated) return <Login />;

  const openNotifications = () => setNotifOpen(true);
  const closeNotifications = closeNotificationsAndMaybeRestore;

  const Active = tabs.find(t => t.id === tab).component;

  const content = (
    <ErrorBoundary>
      {notifOpen ? (
        <Notifications
          onClose={closeNotifications}
          onNavigate={(nextTab, payload) => {
            // The user tapped a notification that opens a detail view.
            // Mark that we should return to notifs when that detail closes,
            // AND remember the tab they were on so we can restore it when
            // notifs finally closes. Only save origin on the first detour
            // so chained notif taps don't overwrite the true origin tab.
            resumeNotifsRef.current = true;
            if (restoreTabRef.current === null) restoreTabRef.current = tab;
            setNotifOpen(false);
            if (nextTab) setTab(nextTab);
            if (payload) setDeepLink({ ...payload, ts: Date.now() });
            refreshUnread();
          }}
        />
      ) : (
        <Active me={me} unreadCount={unreadCount} onOpenNotifications={openNotifications} deepLink={deepLink} onSwitchTab={(t, payload) => {
          // User navigated themselves — not expecting to land back in Notifications.
          resumeNotifsRef.current = false;
          restoreTabRef.current = null;
          setTab(t); setNotifOpen(false);
          if (payload?.addEvent) setDeepLink({ kind: 'addEvent', title: payload.addEvent, ts: Date.now() });
          if (payload?.kind) setDeepLink({ ...payload, ts: Date.now() });
        }} />
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
          <nav className="flex-1 px-3 space-y-1">
            {tabs.map(t => {
              const active = tab === t.id && !notifOpen;
              return (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setNotifOpen(false); setDeepLink(null); }}
                  className={'w-full flex items-center gap-3 px-3 h-10 rounded-xl text-left text-sm font-medium transition-all duration-300 ' +
                    (active ? '' : 'text-ink-500 hover:text-ink-700')}
                  style={active ? { background: 'linear-gradient(135deg, rgba(91,140,255,0.15) 0%, rgba(91,140,255,0.06) 100%)', border: '1px solid rgba(91,140,255,0.18)', boxShadow: '0 0 16px rgba(91,140,255,0.15), inset 0 1px 0 rgba(255,255,255,0.08)', color: '#7EB0FF' } : { background: 'transparent', border: '1px solid transparent' }}
                >
                  <div style={active ? { filter: 'drop-shadow(0 0 6px rgba(91,140,255,0.5))' } : {}}>
                    <t.Icon style={active ? { stroke: '#7EB0FF', strokeWidth: 2 } : {}} />
                  </div>
                  <span>{t.label}</span>
                </button>
              );
            })}
            {/* SVG gradient for sidebar icons */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
              <defs>
                <linearGradient id="sidebar-icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7EB0FF" />
                  <stop offset="100%" stopColor="#5B8CFF" />
                </linearGradient>
              </defs>
            </svg>
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
      <FAB tab={tab} />
      <ConfettiHost />
      <OnboardingTour />
      <CommandPalette onNavigate={handlePaletteNavigate} />
    </div>
  );

  return (
    <div className="h-screen bg-page overflow-hidden">
      <div className="flex justify-center h-full">
        <div
          className="w-full max-w-[420px] bg-page h-full flex flex-col relative"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          {/* Pull-to-refresh indicator — fades in as the user pulls, spins while refreshing */}
          <PullRefreshIndicator pullDelta={pullDelta} refreshing={refreshing} threshold={threshold} />

          <main ref={mainRef} className="flex-1 px-5 pt-4 pb-4 overflow-y-auto">
            {content}
          </main>
          <nav className="flex-shrink-0 w-full border-t"
            style={{ background: '#0A0E1C', borderColor: 'rgba(255,255,255,0.08)', boxShadow: '0 -4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
            <div className="flex h-16">
              {tabs.map(t => {
                const active = tab === t.id && !notifOpen;
                return (
                  <button
                    key={t.id}
                    onClick={() => { resumeNotifsRef.current = false; restoreTabRef.current = null; setTab(t.id); setNotifOpen(false); setDeepLink(null); }}
                    className="flex-1 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 relative"
                  >
                    {/* Active glow backdrop */}
                    {active && (
                      <div className="absolute inset-x-2 top-1.5 bottom-1.5 rounded-2xl transition-all duration-300"
                        style={{ background: 'linear-gradient(135deg, rgba(91,140,255,0.12) 0%, rgba(91,140,255,0.04) 100%)', border: '1px solid rgba(91,140,255,0.15)', boxShadow: '0 0 20px rgba(91,140,255,0.12), inset 0 1px 0 rgba(255,255,255,0.08)' }} />
                    )}
                    {/* Icon */}
                    <div className="relative z-10" style={active ? { filter: 'drop-shadow(0 0 8px rgba(91,140,255,0.5))' } : {}}>
                      <t.Icon style={active ? { stroke: 'url(#nav-icon-grad)', strokeWidth: 2 } : { stroke: '#4B5563', strokeWidth: 1.5 }} />
                    </div>
                    <span className="relative z-10 text-[10px] font-semibold transition-colors duration-300" style={{ color: active ? '#7EB0FF' : '#4B5563' }}>{t.label}</span>
                  </button>
                );
              })}
            </div>
            {/* Safe area spacer */}
            <div style={{ height: 'env(safe-area-inset-bottom)', background: '#0A0E1C' }} />
            {/* SVG gradient def for active icons */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
              <defs>
                <linearGradient id="nav-icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7EB0FF" />
                  <stop offset="100%" stopColor="#5B8CFF" />
                </linearGradient>
              </defs>
            </svg>
          </nav>
        </div>
      </div>

      <FAB tab={tab} />
      <ConfettiHost />
      <OnboardingTour />
      <CommandPalette onNavigate={handlePaletteNavigate} />
    </div>
  );
}
