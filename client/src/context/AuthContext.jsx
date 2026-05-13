import { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('klinikita_jwt');
    if (!token) { setLoading(false); return; }
    getMe()
      .then(res => setUser(res.data.data))
      .catch(() => localStorage.removeItem('klinikita_jwt'))
      .finally(() => setLoading(false));
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('klinikita_jwt', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('klinikita_jwt');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
