import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import pb from '@/lib/pocketbaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(pb.authStore.record || null);
  const [ready, setReady] = useState(true);

  useEffect(() => {
    const unsub = pb.authStore.onChange((_token, record) => {
      setUser(record || null);
    });
    // Refresh session on mount if a token exists.
    if (pb.authStore.isValid) {
      pb.collection('users')
        .authRefresh()
        .catch(() => pb.authStore.clear())
        .finally(() => setReady(true));
    }
    return () => unsub();
  }, []);

  const login = useCallback(async (email, password) => {
    return pb.collection('users').authWithPassword(email, password);
  }, []);

  const register = useCallback(async (email, password, name) => {
    await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      name: name || email.split('@')[0],
    });
    return pb.collection('users').authWithPassword(email, password);
  }, []);

  const requestPasswordReset = useCallback(async (email) => {
    return pb.collection('users').requestPasswordReset(email);
  }, []);

  const updateProfile = useCallback(async (data) => {
    if (!pb.authStore.record) throw new Error('Oturum yok');
    return pb.collection('users').update(pb.authStore.record.id, data);
  }, []);

  const logout = useCallback(() => {
    pb.authStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      isAuthed: pb.authStore.isValid && !!user,
      login,
      register,
      requestPasswordReset,
      updateProfile,
      logout,
    }),
    [user, ready, login, register, requestPasswordReset, updateProfile, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
