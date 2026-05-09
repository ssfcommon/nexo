import React, { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { Avatar } from './ui.jsx';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { CloseIcon } from './Icons.jsx';

// Manage who's on a project after it's been created. Only the project
// owner can add/remove — non-owners get a read-only roster.
//
// Props:
//   open       — boolean
//   project    — full project payload (must include owner_id, members)
//   meId       — current user's id, used for the owner check + to hide
//                "remove yourself" affordances on non-owner members
//   onChanged  — () => void   called after add/remove so the parent
//                reloads the project payload
export default function ManageMembersModal({ open, project, meId, onChanged, onClose }) {
  const showToast = useToast();
  const [allUsers, setAllUsers] = useState([]);
  const [busyId, setBusyId] = useState(null);     // user id currently being added/removed
  const [search, setSearch] = useState('');

  const isOwner = !!project && project.owner_id === meId;
  const members = project?.members || [];
  const memberIds = new Set(members.map(m => String(m.id)));

  useEffect(() => {
    if (!open) return;
    setSearch('');
    api.users().then(setAllUsers).catch(() => {});
  }, [open]);

  const candidates = allUsers
    .filter(u => !memberIds.has(String(u.id)))
    .filter(u => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return u.name?.toLowerCase().includes(q);
    });

  const handleAdd = async (user) => {
    setBusyId(user.id);
    try {
      await api.addProjectMember(project.id, user.id);
      showToast(`${user.name.split(' ')[0]} added`);
      onChanged?.();
    } catch (e) {
      showToast(e.message || "Couldn't add member", 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (user) => {
    setBusyId(user.id);
    try {
      await api.removeProjectMember(project.id, user.id);
      showToast(`${user.name.split(' ')[0]} removed`);
      onChanged?.();
    } catch (e) {
      showToast(e.message || "Couldn't remove member", 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Members">
      <p className="text-[11px] uppercase tracking-wide font-semibold text-ink-400 mb-2">
        On this project · {members.length}
      </p>
      <div className="space-y-1.5 mb-5">
        {members.map(u => {
          const isProjOwner = String(project?.owner_id) === String(u.id);
          const canRemove = isOwner && !isProjOwner;
          return (
            <div
              key={u.id}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-[10px]"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <Avatar user={u} size={28} />
              <span className="text-[13px] font-medium text-ink-900 flex-1 truncate">
                {u.name}
                {String(u.id) === String(meId) && (
                  <span className="text-ink-500 font-normal"> · you</span>
                )}
              </span>
              {isProjOwner && (
                <span
                  className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                  style={{ color: '#FFB547', background: 'rgba(255,181,71,0.10)', border: '1px solid rgba(255,181,71,0.22)' }}
                >
                  Owner
                </span>
              )}
              {canRemove && (
                <button
                  type="button"
                  disabled={busyId === u.id}
                  onClick={() => handleRemove(u)}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
                  style={{ color: '#9CA3AF' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#F87171'; e.currentTarget.style.background = 'rgba(239,68,68,0.10)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'transparent'; }}
                  aria-label={`Remove ${u.name}`}
                  title="Remove from project"
                >
                  <CloseIcon width="14" height="14" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {isOwner ? (
        <>
          <p className="text-[11px] uppercase tracking-wide font-semibold text-ink-400 mb-2">Add someone</p>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search team…"
            className="w-full h-10 px-3 rounded-[10px] text-[13px] bg-white/5 border border-white/10 text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-blue/50 mb-2"
          />
          <div
            className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1"
            style={{ scrollbarWidth: 'thin' }}
          >
            {candidates.length === 0 ? (
              <p className="text-[12px] text-ink-500 text-center py-3">
                {allUsers.length === members.length
                  ? "Everyone's already on board."
                  : 'No matches.'}
              </p>
            ) : candidates.map(u => (
              <button
                key={u.id}
                type="button"
                disabled={busyId === u.id}
                onClick={() => handleAdd(u)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-left transition-colors disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(91,140,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(91,140,255,0.22)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
              >
                <Avatar user={u} size={28} />
                <span className="text-[13px] font-medium text-ink-900 flex-1 truncate">{u.name}</span>
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: '#A8C4FF' }}
                >
                  {busyId === u.id ? 'Adding…' : '+ Add'}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-[12px] text-ink-500 text-center py-2">
          Only the project owner can add or remove members.
        </p>
      )}
    </Modal>
  );
}
