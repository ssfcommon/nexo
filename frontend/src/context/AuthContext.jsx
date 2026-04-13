import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { setCurrentUserId } from '../lib/supabaseService.js';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);     // nexo.users row
  const [userId, setUserId] = useState(null); // nexo.users.id (UUID)
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Fetch the nexo.users row for a given Supabase auth user
  const resolveNexoUser = useCallback(async (authUser) => {
    if (!authUser) {
      setUser(null);
      setUserId(null);
      return null;
    }
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, initials, department, avatar_color, avatar_url, role, preferences')
      .eq('auth_id', authUser.id)
      .maybeSingle();

    if (error) { console.error('resolveNexoUser:', error); return null; }

    if (data) {
      setUser(data);
      setUserId(data.id);
      setCurrentUserId(data.id);
      return data;
    }

    // First login — create nexo.users row linked to auth user
    const meta = authUser.user_metadata || {};
    const name = meta.full_name || meta.name || authUser.email?.split('@')[0] || 'User';
    const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    const colors = ['#4A6CF7', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const { data: newUser, error: insertErr } = await supabase
      .from('users')
      .insert({
        auth_id: authUser.id,
        name,
        email: authUser.email,
        initials,
        department: 'Common',
        avatar_color: color,
        role: 'member',
        preferences: {},
      })
      .select('id, name, email, initials, department, avatar_color, avatar_url, role, preferences')
      .single();

    if (insertErr) { console.error('create nexo user:', insertErr); return null; }
    setUser(newUser);
    setUserId(newUser.id);
    setCurrentUserId(newUser.id);
    return newUser;
  }, []);

  // Restore session on mount + listen for auth changes
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        resolveNexoUser(session.user).finally(() => mounted && setIsAuthLoading(false));
      } else {
        setIsAuthLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        resolveNexoUser(session.user);
      } else {
        setUser(null);
        setUserId(null);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [resolveNexoUser]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserId(null);
    setCurrentUserId(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('users')
      .select('id, name, email, initials, department, avatar_color, avatar_url, role, preferences')
      .eq('id', userId)
      .single();
    if (data) setUser(data);
    return data;
  }, [userId]);

  const value = {
    user,
    userId,
    isAuthenticated: !!user,
    isAuthLoading,
    signIn,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
