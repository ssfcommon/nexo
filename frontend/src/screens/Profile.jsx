import React, { useEffect, useState } from 'react';
import { api, ASSET_ORIGIN } from '../api.js';
import { Avatar, Pill } from '../components/ui.jsx';
import HeaderActions from '../components/HeaderActions.jsx';
import Modal, { Field, inputCls } from '../components/Modal.jsx';
import { PrivacyModal, HelpModal } from '../components/InfoModals.jsx';
import { resetOnboarding } from '../components/OnboardingTour.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// ── Shared helpers ──

// Minimal SVG icons (16x16, stroke-based, no emoji)
const icons = {
  moon:     <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  bell:     <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  calendar: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  clock:    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  user:     <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  lock:     <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  help:     <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  refresh:  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  play:     <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>,
  mail:     <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>,
  logout:   <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

function Row({ icon, label, right, onClick, danger }) {
  const Tag = onClick ? 'button' : 'div';
  const iconEl = typeof icon === 'string' ? icons[icon] || <span className="text-lg">{icon}</span> : icon;
  return (
    <Tag onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-ink-100/60 transition">
      <span className={'w-5 flex-shrink-0 ' + (danger ? 'text-danger' : 'text-ink-300')}>{iconEl}</span>
      <span className={'flex-1 text-[14px] ' + (danger ? 'text-danger' : 'text-ink-900')}>{label}</span>
      {right}
    </Tag>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className={'w-10 h-6 rounded-full relative transition ' + (on ? 'bg-brand-blue' : 'bg-line-light')}
      aria-pressed={on}>
      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: on ? '18px' : '2px' }} />
    </button>
  );
}

function roleColor(role) {
  if (role === 'admin') return { bg: 'rgba(239,68,68,0.12)', fg: '#EF4444' };
  if (role === 'manager') return { bg: 'rgba(74,108,247,0.12)', fg: '#4A6CF7' };
  return { bg: 'rgba(107,114,128,0.12)', fg: '#6B7280' };
}

// ── Edit profile modal ──

const DEPARTMENTS = ['Operations', "CEO's Office", 'Common'];

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function EditProfileModal({ open, onClose, user, onSaved, refreshUser }) {
  const showToast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [department, setDepartment] = useState(user?.department || 'Operations');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [cropSrc, setCropSrc] = useState(null); // raw image for cropping
  const [cropPos, setCropPos] = useState({ x: 0, y: 0, size: 0 }); // crop square
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 }); // natural dims
  const [busy, setBusy] = useState(false);
  const cropRef = React.useRef(null);
  const dragging = React.useRef(false);
  const dragStart = React.useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  useEffect(() => { if (open) { setName(user?.name || ''); setDepartment(user?.department || 'Operations'); setPhotoPreview(null); setPhotoFile(null); setCropSrc(null); } }, [open, user]);

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
      const minDim = Math.min(img.naturalWidth, img.naturalHeight);
      setCropPos({ x: (img.naturalWidth - minDim) / 2, y: (img.naturalHeight - minDim) / 2, size: minDim });
      setCropSrc(url);
    };
    img.src = url;
  };

  const applyCrop = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, cropPos.x, cropPos.y, cropPos.size, cropPos.size, 0, 0, 256, 256);
      canvas.toBlob(blob => {
        setPhotoFile(blob);
        setPhotoPreview(URL.createObjectURL(blob));
        setCropSrc(null);
      }, 'image/jpeg', 0.9);
    };
    img.src = cropSrc;
  };

  // Drag to reposition crop area
  const onPointerDown = (e) => {
    dragging.current = true;
    const rect = cropRef.current.getBoundingClientRect();
    dragStart.current = { x: e.clientX, y: e.clientY, ox: cropPos.x, oy: cropPos.y, rw: rect.width, rh: rect.height };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging.current) return;
    const { x: sx, y: sy, ox, oy, rw, rh } = dragStart.current;
    const scaleX = imgDims.w / rw;
    const scaleY = imgDims.h / rh;
    let nx = ox - (e.clientX - sx) * scaleX;
    let ny = oy - (e.clientY - sy) * scaleY;
    nx = Math.max(0, Math.min(imgDims.w - cropPos.size, nx));
    ny = Math.max(0, Math.min(imgDims.h - cropPos.size, ny));
    setCropPos(p => ({ ...p, x: nx, y: ny }));
  };
  const onPointerUp = () => { dragging.current = false; };

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      let u = await api.updateMe({ name: name.trim(), department });
      if (photoFile) {
        const dataUrl = await readAsDataURL(photoFile instanceof Blob ? new File([photoFile], 'avatar.jpg', { type: photoFile.type || 'image/jpeg' }) : photoFile);
        u = await api.uploadAvatar(dataUrl);
      }
      onSaved?.(u);
      refreshUser?.();
      onClose();
    } catch (err) { showToast(err.message || 'Failed to update profile', 'error'); } finally { setBusy(false); }
  };

  const currentPhoto = photoPreview || (user?.avatar_url ? (user.avatar_url.startsWith('http') ? user.avatar_url : ASSET_ORIGIN + user.avatar_url) : null);

  // Crop UI
  if (cropSrc) {
    const previewSize = 280;
    const scale = previewSize / Math.max(imgDims.w, imgDims.h);
    const dispW = imgDims.w * scale;
    const dispH = imgDims.h * scale;
    const cropDispSize = cropPos.size * scale;
    const cropDispX = cropPos.x * scale;
    const cropDispY = cropPos.y * scale;

    return (
      <Modal open={open} onClose={() => setCropSrc(null)} title="Crop Photo">
        <div className="flex flex-col items-center gap-4">
          <p className="text-[12px] text-ink-500">Drag to reposition. Use slider to resize.</p>
          <div ref={cropRef} className="relative overflow-hidden rounded-[12px] cursor-move select-none" style={{ width: dispW, height: dispH }}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          >
            <img src={cropSrc} alt="crop" className="block" style={{ width: dispW, height: dispH }} draggable={false} />
            {/* Dim overlay outside crop */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5))`,
              clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${cropDispX}px ${cropDispY}px, ${cropDispX}px ${cropDispY + cropDispSize}px, ${cropDispX + cropDispSize}px ${cropDispY + cropDispSize}px, ${cropDispX + cropDispSize}px ${cropDispY}px, ${cropDispX}px ${cropDispY}px)`,
            }} />
            {/* Crop circle border */}
            <div className="absolute border-2 border-white rounded-full pointer-events-none shadow-lg" style={{
              left: cropDispX, top: cropDispY, width: cropDispSize, height: cropDispSize,
            }} />
          </div>
          {/* Size slider */}
          <div className="w-full flex items-center gap-3 px-2">
            <span className="text-[11px] text-ink-400">Zoom</span>
            <input type="range" className="flex-1 accent-brand-blue" min={Math.min(imgDims.w, imgDims.h) * 0.3} max={Math.min(imgDims.w, imgDims.h)} step={1} value={cropPos.size}
              onChange={e => {
                const newSize = Number(e.target.value);
                setCropPos(p => ({
                  size: newSize,
                  x: Math.max(0, Math.min(imgDims.w - newSize, p.x + (p.size - newSize) / 2)),
                  y: Math.max(0, Math.min(imgDims.h - newSize, p.y + (p.size - newSize) / 2)),
                }));
              }}
            />
          </div>
          {/* Preview */}
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-line-light" style={{ backgroundImage: `url(${cropSrc})`, backgroundSize: `${imgDims.w * (64 / cropPos.size)}px ${imgDims.h * (64 / cropPos.size)}px`, backgroundPosition: `-${cropPos.x * (64 / cropPos.size)}px -${cropPos.y * (64 / cropPos.size)}px` }} />
            <span className="text-[11px] text-ink-400">Preview</span>
          </div>
          <div className="flex gap-2 w-full">
            <button type="button" onClick={() => setCropSrc(null)} className="flex-1 h-11 rounded-[10px] border border-line-light text-ink-700 font-semibold">Cancel</button>
            <button type="button" onClick={applyCrop} className="flex-1 h-11 rounded-[10px] bg-brand-blue text-white font-semibold">Use This Crop</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Profile">
      <form onSubmit={submit}>
        <div className="flex flex-col items-center mb-4">
          <label className="cursor-pointer group relative">
            {currentPhoto ? (
              <img src={currentPhoto} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-line-light group-hover:opacity-75 transition" />
            ) : (
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl group-hover:opacity-75 transition" style={{ backgroundColor: user?.avatar_color || '#6B7280' }}>
                {user?.initials}
              </div>
            )}
            <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition">
              <span className="text-white text-lg">📷</span>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </label>
          <p className="text-[11px] text-ink-300 mt-2">Click to change photo</p>
        </div>
        <Field label="Full name"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} required autoFocus /></Field>
        <Field label="Department"><select className={inputCls} value={department} onChange={e => setDepartment(e.target.value)}>{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}</select></Field>
        <button disabled={busy} type="submit" className="w-full h-11 rounded-[10px] bg-brand-blue text-white font-semibold disabled:opacity-60">{busy ? 'Saving…' : 'Save changes'}</button>
      </form>
    </Modal>
  );
}

// ── Inline Reports section ──

function effColor(e) { return e >= 95 ? '#22C55E' : e >= 85 ? '#F59E0B' : '#EF4444'; }

function LineChart({ data }) {
  const W = 320, H = 130, P = 20;
  const max = Math.max(...data.map(d => d.value), 1);
  const step = (W - P * 2) / Math.max(data.length - 1, 1);
  const pts = data.map((d, i) => [P + i * step, H - P - (d.value / max) * (H - P * 2)]);
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]).join(' ');
  const area = path + ` L${pts[pts.length - 1][0]},${H - P} L${pts[0][0]},${H - P} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36">
      {[0,1,2,3].map(i => <line key={i} x1={P} y1={P + i*((H-P*2)/3)} x2={W-P} y2={P + i*((H-P*2)/3)} stroke="#F3F4F6" />)}
      <path d={area} fill="rgba(74,108,247,0.08)" />
      <path d={path} stroke="#4A6CF7" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p,i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="#4A6CF7" />)}
      {data.map((d,i) => <text key={i} x={P + i*step} y={H - 4} textAnchor="middle" fontSize="9" fill="#9CA3AF">{d.day}</text>)}
    </svg>
  );
}

function ReportsSection() {
  const [r, setR] = useState(null);
  const [period, setPeriod] = useState('Weekly');
  const [scope, setScope] = useState('me');
  const [insights, setInsights] = useState([]);
  useEffect(() => { api.reportSummary({ period: period.toLowerCase(), scope }).then(setR); }, [period, scope]);
  useEffect(() => { api.insights().then(setInsights).catch(() => setInsights([])); }, []);

  if (!r) return <div className="py-4 text-center text-ink-300 text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      {/* Scope + download */}
      <div className="flex items-center gap-2">
        <Pill active={scope === 'me'} onClick={() => setScope('me')}>Me</Pill>
        <Pill active={scope === 'all'} onClick={() => setScope('all')}>Company</Pill>
        <div className="flex-1" />
        {r && <button onClick={() => {
          const rows = [['Metric','Value'],['Done',r.done],['Overdue',r.overdue],['On-time',r.onTimeRate+'%']];
          (r.departments||[]).forEach(d => rows.push([d.name, d.done, d.overdue, d.efficiency+'%']));
          const blob = new Blob([rows.map(r=>r.join(',')).join('\n')], {type:'text/csv'});
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = `nexo-report-${scope}-${new Date().toISOString().slice(0,10)}.csv`; a.click();
        }} className="w-9 h-9 rounded-full border border-line-light flex items-center justify-center text-ink-500 hover:bg-ink-100/60" title="Download CSV">📄</button>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-3">
          <p className="text-[22px] font-bold text-ink-900 leading-none">{r.done}</p>
          <p className="text-[10px] text-ink-500 mt-1">Done</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-[22px] font-bold text-danger leading-none">{r.overdue}</p>
          <p className="text-[10px] text-ink-500 mt-1">Overdue</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-[22px] font-bold text-success leading-none">{r.onTimeRate}%</p>
          <p className="text-[10px] text-ink-500 mt-1">On-time</p>
        </div>
      </div>

      {/* Period */}
      <div className="flex gap-4 border-b border-line-light">
        {['Daily','Weekly','Monthly','Quarterly'].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={'pb-2 text-[13px] ' + (period === p ? 'font-semibold text-ink-900 border-b-2 border-brand-blue' : 'text-ink-300')}>
            {p}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="card !p-2"><LineChart data={r.chart} /></div>

      {/* Departments */}
      <div className="card !p-0 overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] text-[11px] text-ink-300 px-3 py-2 border-b border-line-light">
          <span>Dept</span><span className="text-center">Done</span><span className="text-center">Late</span><span className="text-right">Eff</span>
        </div>
        {r.departments.map((d,i) => (
          <div key={d.name} className={'grid grid-cols-[2fr_1fr_1fr_1fr] items-center px-3 py-2 text-[13px] ' + (i < r.departments.length-1 ? 'border-b border-line-light' : '')}>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} /><span className="text-ink-900">{d.name}</span></div>
            <span className="text-center text-ink-900">{d.done}</span>
            <span className="text-center text-ink-900">{d.overdue}</span>
            <span className="text-right font-semibold" style={{ color: effColor(d.efficiency) }}>{d.efficiency}%</span>
          </div>
        ))}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((ins,i) => (
            <div key={i} className="card !p-3 flex items-start gap-2.5">
              <span className="text-lg">{ins.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-ink-900">{ins.title}</p>
                <p className="text-[11px] text-ink-500 mt-0.5">{ins.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Profile ──

export default function Profile({ me, unreadCount, onOpenNotifications }) {
  const showToast = useToast();
  const { refreshUser } = useAuth();
  const [streaks, setStreaks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetToast, setResetToast] = useState(null);
  const [digest, setDigest] = useState(null);
  const [localUser, setLocalUser] = useState(me);
  const [section, setSection] = useState('profile'); // 'profile' | 'reports'

  useEffect(() => { setLocalUser(me); }, [me]);

  useEffect(() => {
    api.streaks().then(setStreaks);
    api.reportSummary().then(setSummary);
    api.preferences().then(setPrefs).catch(() => setPrefs({ theme: 'light', notifications: true, calendarSync: 'Google', moodTime: '09:00' }));
  }, []);

  useEffect(() => {
    if (!prefs) return;
    document.documentElement.classList.toggle('dark-theme', prefs.theme === 'dark');
  }, [prefs?.theme]);

  const update = async (patch) => {
    setPrefs(p => ({ ...p, ...patch })); setSaving(true);
    try { const next = await api.updatePreferences(patch); setPrefs(next); }
    catch (err) { showToast(err.message || 'Failed to save preferences', 'error'); }
    finally { setSaving(false); }
  };

  const doReset = async () => {
    if (!confirm('Reset the demo database? This will wipe your changes and restore the seed data.')) return;
    setResetBusy(true);
    try { await api.resetSeed(); setResetToast('Database reseeded — reloading…'); setTimeout(() => location.reload(), 900); }
    catch (e) { setResetToast('Reset failed: ' + (e.message || e)); setResetBusy(false); setTimeout(() => setResetToast(null), 3000); }
  };

  const role = localUser?.role || 'member';
  const rc = roleColor(role);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-[26px] font-bold text-ink-900">Profile</h1>
        <HeaderActions me={localUser} unreadCount={unreadCount} onOpenNotifications={onOpenNotifications} onOpenProfile={() => setEditOpen(true)} />
      </div>

      {/* Identity card — tap to edit */}
      {localUser && (
        <button onClick={() => setEditOpen(true)} className="card card-hover flex items-center gap-4 w-full text-left">
          <div className="relative group">
            <Avatar user={localUser} size={64} />
            <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition">
              <span className="text-white text-sm">📷</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[18px] font-bold text-ink-900">{localUser.name}</p>
              <span className="tag" style={{ color: rc.fg, backgroundColor: rc.bg }}>{role.toUpperCase()}</span>
            </div>
            <p className="text-[13px] text-ink-500">{localUser.department}</p>
            <p className="text-[12px] text-ink-300">{localUser.email}</p>
          </div>
          <span className="text-ink-300 text-lg">›</span>
        </button>
      )}

      {/* Stats row */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center py-3">
            <p className="text-[22px] font-bold text-ink-900 leading-none">{summary.done}</p>
            <p className="text-[10px] text-ink-500 mt-1">Tasks Done</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-[22px] font-bold text-success leading-none">{streaks.reduce((m, s) => Math.max(m, s.current_count), 0)}</p>
            <p className="text-[10px] text-ink-500 mt-1">Top Streak</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-[22px] font-bold text-brand-blue leading-none">{summary.onTimeRate}%</p>
            <p className="text-[10px] text-ink-500 mt-1">On-time</p>
          </div>
        </div>
      )}

      {/* Section toggle: Profile / Reports */}
      <div className="flex gap-1 bg-ink-100 rounded-full p-0.5">
        <button onClick={() => setSection('profile')}
          className={'flex-1 h-9 rounded-full text-sm font-semibold transition ' + (section === 'profile' ? 'card text-ink-900 shadow-sm !p-0 !border-0' : 'text-ink-500')}>
          Settings
        </button>
        <button onClick={() => setSection('reports')}
          className={'flex-1 h-9 rounded-full text-sm font-semibold transition ' + (section === 'reports' ? 'card text-ink-900 shadow-sm !p-0 !border-0' : 'text-ink-500')}>
          Reports & Stats
        </button>
      </div>

      {section === 'reports' ? (
        <ReportsSection />
      ) : (
        <>
          {/* Preferences */}
          <div>
            <p className="section-label mb-2">Preferences {saving && <span className="text-ink-300 normal-case font-normal">· saving…</span>}</p>
            <div className="card !p-0 overflow-hidden divide-y divide-line-light">
              <Row icon="moon" label="Dark mode" right={<Toggle on={prefs?.theme === 'dark'} onChange={v => update({ theme: v ? 'dark' : 'light' })} />} />
              <Row icon="bell" label="Notifications" right={<Toggle on={!!prefs?.notifications} onChange={v => update({ notifications: v })} />} />
              <Row icon="calendar" label="Calendar sync"
                right={<select value={prefs?.calendarSync || 'Google'} onChange={e => update({ calendarSync: e.target.value })} className="inline-control text-[13px] text-ink-500 outline-none"><option>Google</option><option>Outlook</option><option>None</option></select>} />
              <Row icon="clock" label="Mood check-in time"
                right={<input type="time" value={prefs?.moodTime || '09:00'} onChange={e => update({ moodTime: e.target.value })} className="inline-control text-[13px] text-ink-500 outline-none" />} />
            </div>
          </div>

          {/* Account */}
          <div>
            <p className="section-label mb-2">Account</p>
            <div className="card !p-0 overflow-hidden divide-y divide-line-light">
              <Row icon="lock" label="Privacy" onClick={() => setPrivacyOpen(true)} right={<span className="text-ink-300">›</span>} />
              <Row icon="help" label="Help & feedback" onClick={() => setHelpOpen(true)} right={<span className="text-ink-300">›</span>} />
              <Row icon="play" label="Replay welcome tour" onClick={() => { resetOnboarding(); location.reload(); }} right={<span className="text-ink-300">›</span>} />
            </div>
          </div>

          {/* Dev tools */}
          <div>
            <p className="section-label mb-2">Developer</p>
            <div className="card !p-0 overflow-hidden divide-y divide-line-light">
              <Row icon="refresh" label={resetBusy ? 'Resetting…' : 'Reset demo data'} onClick={resetBusy ? undefined : doReset}
                right={<span className="text-ink-300 text-[11px]">restores seed</span>} />
              <Row icon="mail" label="Preview email digest" onClick={async () => setDigest(await api.digestPreview())}
                right={<span className="text-ink-300 text-[11px]">no SMTP</span>} />
            </div>
            {digest && (
              <div className="mt-2 card !p-3 space-y-1">
                <p className="text-[11px] text-ink-300">To: {digest.to}</p>
                <p className="text-[12px] font-semibold text-ink-900">{digest.subject}</p>
                <pre className="text-[11px] text-ink-500 whitespace-pre-wrap font-sans">{digest.body}</pre>
                <button onClick={() => setDigest(null)} className="text-[11px] text-brand-blue mt-1">Close</button>
              </div>
            )}
            {resetToast && <p className="mt-2 text-[12px] text-brand-blue">{resetToast}</p>}
          </div>
        </>
      )}

      <div className="text-center pb-2">
        <img src="/logo.png" alt="Nexo" className="w-6 h-6 mx-auto mb-1 object-contain opacity-40" />
        <p className="text-[11px] text-ink-300">Nexo · v0.1.0</p>
        <p className="text-[9px] text-ink-300">Know What's Next to Do</p>
      </div>

      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <EditProfileModal open={editOpen} onClose={() => setEditOpen(false)} user={localUser} onSaved={(u) => setLocalUser(u)} refreshUser={refreshUser} />
    </div>
  );
}
