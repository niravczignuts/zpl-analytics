'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Lock, Eye, EyeOff } from 'lucide-react';

function LoginForm() {
  const [password, setPassword]   = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [logoError, setLogoError] = useState(false);
  // hydrated guards the fallback — never render it during SSR or initial hydration
  const [hydrated, setHydrated]   = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  const router                    = useRouter();
  const searchParams              = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const from = searchParams.get('from') || '/';
        router.push(from);
        router.refresh();
      } else {
        setError('Incorrect password. Please try again.');
        setPassword('');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(27,58,140,0.35) 0%, #030712 65%)',
      }}
    >
      {/* Ambient cricket field lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.04]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] rounded-full border border-white" />
      </div>

      <div className="relative w-full max-w-[360px] mx-6">
        {/* Card */}
        <div
          className="rounded-2xl p-8 space-y-8"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,215,0,0.15)',
            boxShadow: '0 0 60px rgba(27,58,140,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Logo */}
          <div className="text-center space-y-3">
            <div className="relative w-20 h-20 mx-auto">
              {/* Glow ring behind logo */}
              <div className="absolute inset-0 rounded-full animate-ping opacity-15"
                style={{ background: 'rgba(255,215,0,0.4)', animationDuration: '3s' }} />
              <div
                className="relative w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden"
                style={{ background: 'linear-gradient(135deg,#1B3A8C,#0a1f5c)', border: '1px solid rgba(255,215,0,0.3)', boxShadow: '0 0 30px rgba(255,215,0,0.15)' }}
              >
                {hydrated && logoError ? (
                  <span className="text-3xl">🏏</span>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src="/zpl-logo.png"
                    alt="ZPL"
                    className="w-14 h-14 object-contain"
                    onError={() => setLogoError(true)}
                  />
                )}
              </div>
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-wide">ZPL Analytics</h1>
              <p className="text-xs text-white/35 mt-0.5">Zignuts Premier League · Season 2026</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                autoComplete="current-password"
                className="w-full pl-10 pr-10 py-3 rounded-xl text-sm text-white placeholder-white/25 focus:outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}`,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,215,0,0.4)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'; }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-xs text-center bg-red-500/10 py-2 rounded-lg border border-red-500/20">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 rounded-xl font-bold text-sm text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg,#FFD700,#D4AA00)' }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                'Access Dashboard'
              )}
            </button>
          </form>

          <p className="text-center text-[10px] text-white/15">
            Protected · ZPL 2026
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
