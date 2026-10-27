import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/client';

const AuthContext = createContext(null);

export const DEMO_ACCOUNTS = {
  student: {
    email: 'student@gearflow.edu',
    password: 'Password123!',
    roleLabel: 'Borrower (Marcus Chen - Film Student)'
  },
  sophia: {
    email: 'sophia@gearflow.edu',
    password: 'Password123!',
    roleLabel: 'Borrower (Sophia Martinez - Robotics)'
  },
  custodian: {
    email: 'custodian@gearflow.edu',
    password: 'Password123!',
    roleLabel: 'Lab Custodian (Alex Rivers)'
  },
  admin: {
    email: 'admin@gearflow.edu',
    password: 'Password123!',
    roleLabel: 'Department Admin (Dr. Elena Vance)'
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('gearflow_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await authApi.getProfile();
        setUser(data.user);
      } catch (err) {
        console.warn('Session expired or invalid token:', err);
        logout();
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    localStorage.setItem('gearflow_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const data = await authApi.register(payload);
    localStorage.setItem('gearflow_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const quickDemoLogin = async (key) => {
    const account = DEMO_ACCOUNTS[key];
    if (account) {
      return await login(account.email, account.password);
    }
  };

  const refreshUser = async () => {
    try {
      const data = await authApi.getProfile();
      setUser(data.user);
    } catch (_) {}
  };

  const logout = () => {
    localStorage.removeItem('gearflow_token');
    setToken(null);
    setUser(null);
  };

  const isCustodianOrAdmin = user && (user.role === 'custodian' || user.role === 'admin');

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        quickDemoLogin,
        refreshUser,
        logout,
        isCustodianOrAdmin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
