import React, { useEffect, useState } from 'react';
import { api, ASSET_ORIGIN } from '../api.js';
import HeaderActions from '../components/HeaderActions.jsx';
import { Pill } from '../components/ui.jsx';

function effColor(e) {
  if (e >= 95) return '#22C55E';
  if (e >= 85) return '#F59E0B';
  return '#EF4444';
}

function LineChart({ data }) {
  const W = 320, H = 140, P = 20;
  const max = Math.max(...data.map(d => d.value), 1);
  const step = (W - P * 2) / (data.length - 1);
  const pts = data.map((d, i) => [P + i * step, H - P - (d.value / max) * (H - P * 2)]);
  const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]).join(' ');
  const area = path + ` L${pts[pts.length - 1][0]},${H - P} L${pts[0][0]},${H - P} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40">
      {[0, 1, 2, 3].map(i => (
        <line key={i} x1={P} y1={P + i * ((H - P * 2) / 3)} x2={W - P} y2={P + i * ((H - P * 2) / 3)} stroke="#F3F4F6" />
      ))}
      <path d={area} fill="rgba(74,108,247,0.08)" />
      <path d={path} stroke="#4A6CF7" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#4A6CF7" />)}
      {data.map((d, i) => (
        <text key={i} x={P + i * step} y={H - 4} textAnchor="middle" fontSize="10" fill="#9CA3AF">{d.day}</text>
      ))}
    </svg>
  );
}

function downloadCSV(r, scope) {
  const rows = [['Metric', 'Value']];
  rows.push(['Done', r.done], ['Overdue', r.overdue], ['On-time Rate', r.onTimeRate + '%'], ['Score', r.score]);
  rows.push([]);
  rows.push(['Department', 'Done', 'Overdue', 'Efficiency']);
  (r.departments || []).forEach(d => rows.push([d.name, d.done, d.overdue, d.efficiency + '%']));
  rows.push([]);
  rows.push(['Period', 'Completed']);
  (r.chart || []).forEach(c => rows.push([c.day, c.value]));
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `nexo-report-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function downloadPDF() {
  window.print();
}

export default function Reports({ me, unreadCount, onOpenNotifications }) {
  const [r, setR] = useState(null);
  const [period, setPeriod] = useState('Weekly');
  const [scope, setScope] = useState('me');
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    api.reportSummary({ period: period.toLowerCase(), scope }).then(setR);
  }, [period, scope]);

  useEffect(() => {
    api.insights().then(setInsights).catch(() => setInsights([]));
  }, []);

  if (!r) return <div className="p-6 text-ink-300">Loading…</div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <button className="text-ink-900 text-xl">←</button>
          <h1 className="text-[22px] font-bold text-ink-900">Reports</h1>
        </div>
        <HeaderActions me={me} unreadCount={unreadCount} onOpenNotifications={onOpenNotifications} />
      </div>

      {/* Scope toggle */}
      <div className="flex gap-2">
        <Pill active={scope === 'me'} onClick={() => setScope('me')}>My Stats</Pill>
        <Pill active={scope === 'all'} onClick={() => setScope('all')}>Company</Pill>
      </div>

      {/* Score banner */}
      <div className="rounded-card bg-brand-blue text-white px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>✅</span>
          <span className="font-semibold text-[15px]">Tasks Complete</span>
        </div>
        <div className="text-right">
          <span className="text-[12px] opacity-80 mr-1">Score:</span>
          <span className="font-bold text-[22px]">{r.score}</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-4">
          <p className="text-[28px] font-bold text-ink-900 leading-none">{r.done}</p>
          <p className="text-[11px] text-ink-500 mt-1">Tasks Done</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-[28px] font-bold text-danger leading-none">{r.overdue}</p>
          <p className="text-[11px] text-ink-500 mt-1">Overdue</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-[28px] font-bold text-success leading-none">{r.onTimeRate}%</p>
          <p className="text-[11px] text-ink-500 mt-1">On-time Rate</p>
        </div>
      </div>

      {/* Period tabs */}
      <div className="flex gap-6 border-b border-line-light">
        {['Daily', 'Weekly', 'Monthly', 'Quarterly'].map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={'pb-2 text-[14px] ' + (period === p ? 'font-semibold text-ink-900 border-b-2 border-brand-blue' : 'text-ink-300')}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="md:grid md:grid-cols-2 md:gap-5 space-y-5 md:space-y-0">
      {/* Chart */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-[16px]">Task Completion</h3>
          <span className="text-[13px] text-ink-500">{period} ▾</span>
        </div>
        <div className="card !p-3"><LineChart data={r.chart} /></div>
      </div>

      {/* Department stats */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-[16px]">Department Stats</h3>
          <span className="text-ink-300">···</span>
        </div>
        <div className="card !p-0 overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] text-[12px] text-ink-300 px-4 py-2 border-b border-line-light">
            <span>Department</span>
            <span className="text-center">Done</span>
            <span className="text-center">Overdue</span>
            <span className="text-right">Efficiency</span>
          </div>
          {r.departments.map((d, i) => (
            <div key={d.name} className={'grid grid-cols-[2fr_1fr_1fr_1fr] items-center px-4 py-3 text-[14px] ' + (i < r.departments.length - 1 ? 'border-b border-[#F3F4F6]' : '')}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-ink-900">{d.name}</span>
              </div>
              <span className="text-center text-ink-900">{d.done}</span>
              <span className="text-center text-ink-900">{d.overdue}</span>
              <span className="text-right font-semibold" style={{ color: effColor(d.efficiency) }}>{d.efficiency}%</span>
            </div>
          ))}
        </div>
      </div>
      </div>

      {/* AI Insights */}
      {insights.length > 0 && (
        <div>
          <h3 className="font-semibold text-[16px] mb-2">✨ Insights</h3>
          <div className="space-y-2">
            {insights.map((i, idx) => (
              <div key={idx} className="card !p-3 flex items-start gap-3">
                <span className="text-xl">{i.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-ink-900">{i.title}</p>
                  <p className="text-[12px] text-ink-500 mt-0.5">{i.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exports */}
      {r && (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => downloadCSV(r, scope)}
            className="h-12 rounded-card bg-brand-blue text-white font-semibold text-[15px] flex items-center justify-center gap-2">
            ↓ CSV
          </button>
          <button onClick={downloadPDF}
            className="h-12 rounded-card bg-ink-900 text-white font-semibold text-[15px] flex items-center justify-center gap-2">
            ↓ PDF
          </button>
        </div>
      )}
    </div>
  );
}
