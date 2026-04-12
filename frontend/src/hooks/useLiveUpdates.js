import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

// Subscribe to Supabase Realtime postgres_changes.
// handlers: { 'subtask-updated': fn, 'comment-created': fn, 'leave-added': fn, ... }
export default function useLiveUpdates(handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const channel = supabase
      .channel('nexo-live')
      .on('postgres_changes', { event: '*', schema: 'nexo', table: 'subtasks' }, (payload) => {
        handlersRef.current?.['subtask-updated']?.({
          id: payload.new?.id, projectId: payload.new?.project_id, status: payload.new?.status,
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'nexo', table: 'comments' }, (payload) => {
        handlersRef.current?.['comment-created']?.({
          projectId: payload.new?.project_id, commentId: payload.new?.id,
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'nexo', table: 'notifications' }, (payload) => {
        handlersRef.current?.['notification']?.(payload.new);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'nexo', table: 'chat_messages' }, (payload) => {
        handlersRef.current?.['chat-message']?.(payload.new);
      })
      .on('postgres_changes', { event: '*', schema: 'nexo', table: 'leaves' }, (payload) => {
        handlersRef.current?.['leave-added']?.({
          id: payload.new?.id, userId: payload.new?.user_id,
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'nexo', table: 'projects' }, (payload) => {
        handlersRef.current?.['project-created']?.({
          id: payload.new?.id, title: payload.new?.title,
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
}
