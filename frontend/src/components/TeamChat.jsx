import React, { useEffect, useRef, useState } from 'react';
import { api, ASSET_ORIGIN } from '../api.js';
import { Avatar } from './ui.jsx';
import useLiveUpdates from '../hooks/useLiveUpdates.js';

function renderBody(text) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((p, i) =>
    p.startsWith('@')
      ? <span key={i} className="text-brand-blue font-semibold">{p}</span>
      : <span key={i}>{p}</span>
  );
}

function relTime(iso) {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  const diffMs = Date.now() - d.getTime();
  const m = Math.round(diffMs / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export default function TeamChat({ me }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const load = () => api.chatMessages(50).then(setMessages).catch(() => {});

  useEffect(() => { if (open) { load(); setTimeout(() => inputRef.current?.focus(), 100); } }, [open]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useLiveUpdates({
    'chat-message': (msg) => {
      setMessages(prev => [...prev, msg]);
    },
  });

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await api.sendChat(text.trim());
      setText('');
      load();
    } finally { setSending(false); }
  };

  return (
    <>
      {/* Floating chat button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 md:bottom-6 right-5 w-12 h-12 rounded-full bg-brand-blue text-white shadow-lg flex items-center justify-center z-40 hover:shadow-xl transition"
          title="Team Chat"
        >
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-0 right-0 md:bottom-4 md:right-5 w-full md:w-[380px] h-[70vh] md:h-[520px] bg-white md:rounded-[16px] shadow-2xl border border-line-light flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 h-14 border-b border-line-light flex-shrink-0">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-brand-blue">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span className="font-semibold text-[15px] text-ink-900 flex-1">Team Chat</span>
            <button onClick={() => setOpen(false)} className="text-ink-300 hover:text-ink-500">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-10">
                <p className="text-ink-300 text-[13px]">No messages yet.</p>
                <p className="text-ink-300 text-[11px] mt-1">Say hi to your team!</p>
              </div>
            )}
            {messages.map(msg => {
              const isMe = msg.user_id === me?.id;
              return (
                <div key={msg.id} className={'flex gap-2.5 ' + (isMe ? 'flex-row-reverse' : '')}>
                  <Avatar user={{ initials: msg.initials, avatar_color: msg.avatar_color, avatar_url: msg.avatar_url, name: msg.name }} size={28} />
                  <div className={'max-w-[75%] ' + (isMe ? 'text-right' : '')}>
                    <div className="flex items-baseline gap-2" style={{ flexDirection: isMe ? 'row-reverse' : 'row' }}>
                      <span className="text-[11px] font-semibold text-ink-900">{msg.name?.split(' ')[0]}</span>
                      <span className="text-[10px] text-ink-300">{relTime(msg.created_at)}</span>
                    </div>
                    <div className={'mt-0.5 inline-block rounded-[12px] px-3 py-2 text-[13px] leading-relaxed ' +
                      (isMe ? 'bg-brand-blue text-white rounded-tr-sm' : 'bg-[#F3F4F6] text-ink-900 rounded-tl-sm')}>
                      {isMe ? msg.body : renderBody(msg.body)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={send} className="flex items-center gap-2 px-4 py-3 border-t border-line-light flex-shrink-0">
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Type a message… use @Name to mention"
              className="flex-1 h-10 px-3 rounded-full border border-line-light bg-[#F9FAFB] text-[13px] outline-none focus:border-brand-blue"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              className="w-10 h-10 rounded-full bg-brand-blue text-white flex items-center justify-center disabled:opacity-40"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
