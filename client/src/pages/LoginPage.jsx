import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as loginApi } from '../services/api';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const { login }               = useAuth();
  const navigate                = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await loginApi(email, password);
      const { token, user } = res.data.data;
      login(token, user);
      toast.success(`Selamat datang, ${user.role === 'admin' ? 'Admin' : 'Dr. ' + user.email.split('@')[0]}!`);
      navigate(user.role === 'admin' ? '/admin' : '/doctor');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Email atau password salah.');
    } finally {
      setLoading(false);
    }
  };

  /* ── shared micro-styles ── */
  const labelCls = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#71717a',
    marginBottom: 6,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1f30 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 400, animation: 'fadeInUp 0.4s ease' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: 14,
            background: '#18181b',
            border: '1px solid #3f3f46',
            marginBottom: 14,
            fontSize: 26,
          }}>🏥</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fafafa', letterSpacing: '-0.02em' }}>Klinikita</h1>
          <p style={{ color: '#71717a', marginTop: 4, fontSize: 13 }}>Portal Staf Klinik</p>
        </div>

        {/* Card */}
        <div className="glass" style={{ padding: '32px 28px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={labelCls}>Email</label>
              <input
                id="login-email"
                type="email"
                className="input-field"
                placeholder="email@klinikita.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label style={labelCls}>Password</label>
              <input
                id="login-password"
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '11px', fontSize: 14, marginTop: 4 }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ width: 15, height: 15, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#09090b', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                  Masuk...
                </span>
              ) : 'Masuk'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20 }}>
          <a href="/" style={{ color: '#52525b', fontSize: 13, textDecoration: 'none' }}>← Kembali ke Beranda</a>
        </p>
      </div>
    </div>
  );
}
