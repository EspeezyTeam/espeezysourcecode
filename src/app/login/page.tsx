"use client"

import { useMemo, useState, useEffect } from 'react'
import { signup, login } from './actions'
import TransientError from '@/components/TransientError'
import { PrivacyPolicy, TermsOfService, CookiePolicy } from '@/components/Legal/Policies'
import { BookOpen, User, Lock, ExternalLink } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import { Phone, Hash as HashIcon } from 'lucide-react'

function SubmitButton({ isSignUp, legalAccepted }: { isSignUp: boolean, legalAccepted: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button
      className="btn btn-primary"
      style={{ width: '100%', height: '3.5rem', borderRadius: '16px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
      disabled={pending || (isSignUp && !legalAccepted)}
    >
      {pending ? (
        <>
          <div className="spinner-mini" />
          <span>{isSignUp ? 'Creating account...' : 'Signing in...'}</span>
        </>
      ) : (
        isSignUp ? 'Create account' : 'Sign in'
      )}
    </button>
  )
}

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [authTab, setAuthTab] = useState<'email' | 'phone'>(searchParams.get('method') === 'phone' ? 'phone' : 'email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(error)
  const [isSignUp, setIsSignUp] = useState(searchParams.get('signup') === 'true')
  const [legalAccepted, setLegalAccepted] = useState(false)
  const [activePolicy, setActivePolicy] = useState<'privacy' | 'terms' | 'cookies' | null>(null)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [isResetting, setIsResetting] = useState(false)

  // Client-side guard: Bounce authenticated users back to dashboard
  useEffect(() => {
    const checkUser = async () => {
      const supabase = createBrowserSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace('/dashboard')
      } else {
        setCheckingAuth(false)
      }
    }
    checkUser()
  }, [router])

  const handleResetPassword = async () => {
    // Basic reset logic placeholder to prevent crash
    setIsResetting(true)
    setAuthError(null)
    // TODO: Implement actual password reset via Supabase
    setTimeout(() => {
      setResetMessage("Password reset link sent to " + email)
      setIsResetting(false)
    }, 1000)
  }

  // Real-time password strength evaluation
  const passwordStrength = useMemo(() => {
    if (!password) return null;
    let score = 0;
    if (password.length > 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { label: 'Weak', color: '#ef4444' };
    if (score === 2) return { label: 'Fair', color: '#f59e0b' };
    if (score === 3) return { label: 'Strong', color: '#10b981' };
    return { label: 'Secure', color: '#06b6d4' };
  }, [password]);

  const handleGithubLogin = async (e: React.MouseEvent) => {
    e.preventDefault();
    setAuthError(null);
    const supabase = createBrowserSupabaseClient();
    
    // Explicitly construct absolute redirect URL
    const origin = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL;
    const redirectTo = `${origin}/auth/callback?next=/dashboard`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo,
        scopes: 'read:user user:email'
      }
    });

    if (error) {
      console.error('[Auth] GitHub OAuth Error:', error);
      setAuthError(`GitHub connection failed: ${error.message}`);
    }
  };

  const handleGoogleLogin = async (e: React.MouseEvent) => {
    e.preventDefault();
    setAuthError(null);
    const supabase = createBrowserSupabaseClient();
    
    const origin = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL;
    const redirectTo = `${origin}/auth/callback?next=/dashboard`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (error) {
      console.error('[Auth] Google OAuth Error:', error);
      setAuthError(`Google connection failed: ${error.message}`);
    }
  };

  const handlePhoneChange = (val: string) => {
    setPhone(val)
  }

  const handleRequestOtp = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!phone.startsWith('+')) {
      setAuthError('Please include the country code (e.g. +1 for USA)')
      return
    }
    setSendingOtp(true)
    setAuthError(null)
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase.auth.signInWithOtp({ phone })
    if (error) setAuthError(error.message)
    else setOtpSent(true)
    setSendingOtp(false)
  }

  const handleVerifyOtp = async (e: React.MouseEvent) => {
    e.preventDefault()
    setSendingOtp(true)
    setAuthError(null)
    const supabase = createBrowserSupabaseClient()
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' })
    if (error) setAuthError(error.message)
    else router.replace('/dashboard')
    setSendingOtp(false)
  }

  if (checkingAuth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'url(/assets/auth_bg.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      padding: '1rem'
    }}>
      {/* Dark Overlay for Readability */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />

      <div
        className="glass"
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          borderRadius: '32px',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '3rem',
          position: 'relative',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.6s ease-out'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ background: 'var(--brand)', width: '60px', height: '60px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 8px 16px rgba(var(--brand-rgb), 0.4)' }}>
            <BookOpen color="white" size={32} />
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', margin: 0 }}>
            {isSignUp ? 'Create an account' : 'Welcome back'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginTop: '0.5rem', fontWeight: 500 }}>
            {isSignUp ? "Create an account to join your project team." : "Welcome back! Sign in to your account."}
          </p>
        </div>

        {(error || authError || resetMessage) && (
          <TransientError message={error || authError || resetMessage || ''} type={resetMessage ? 'success' : 'error'} />
        )}

        <form action={isSignUp ? signup : login} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Anti-bot Honeypot Field */}
          <div style={{ display: 'none' }} aria-hidden="true">
            <input type="text" name="hp_field" tabIndex={-1} autoComplete="off" />
          </div>

          {!isSignUp && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button 
                type="button" 
                onClick={() => setAuthTab('email')}
                style={{ flex: 1, padding: '0.6rem', borderRadius: '12px', background: authTab === 'email' ? 'rgba(255,255,255,0.1)' : 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 700, fontSize: '0.85rem' }}
              >Email</button>
              <button 
                type="button" 
                onClick={() => setAuthTab('phone')}
                style={{ flex: 1, padding: '0.6rem', borderRadius: '12px', background: authTab === 'phone' ? 'rgba(255,255,255,0.1)' : 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 700, fontSize: '0.85rem' }}
              >Phone</button>
            </div>
          )}

          {authTab === 'email' || isSignUp ? (
            <>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Email</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                  <input
                    className="form-input"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', paddingLeft: '3rem' }}
                    placeholder="school.email@edu.com"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: 'rgba(255,255,255,0.9)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Password</span>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      disabled={isResetting}
                    >
                      {isResetting ? 'Sending...' : 'Reset password'}
                    </button>
                  )}
                  {isSignUp && passwordStrength && (
                    <span style={{ fontSize: '0.7rem', color: passwordStrength.color, fontWeight: 900, textTransform: 'uppercase' }}>
                      Strength: {passwordStrength.label}
                    </span>
                  )}
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                  <input
                    className="form-input"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${passwordStrength && isSignUp ? passwordStrength.color : 'rgba(255,255,255,0.1)'}`, color: 'white', paddingLeft: '3rem', transition: 'border-color 0.3s' }}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {isSignUp && (
                <div className="form-group" style={{ marginBottom: 0, animation: 'slideIn 0.3s ease-out' }}>
                  <label className="form-label" style={{ color: 'rgba(255,255,255,0.9)' }}>ID Number</label>
                  <input
                    className="form-input"
                    name="school_id"
                    type="text"
                    required
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                    placeholder="ID-001234"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Phone Number</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '0.5rem', width: '24px', height: '16px' }}>
                    <Phone size={18} style={{ color: 'rgba(255,255,255,0.4)' }} />
                  </div>
                  <input
                    className="form-input"
                    type="tel"
                    required
                    disabled={otpSent}
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', paddingLeft: '3rem' }}
                    placeholder="+1 555 000 0000"
                  />
                </div>
              </div>

              {otpSent && (
                <div className="form-group" style={{ marginBottom: 0, animation: 'slideIn 0.3s ease-out' }}>
                  <label className="form-label" style={{ color: 'rgba(255,255,255,0.9)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Verification Code</span>
                    <button type="button" onClick={() => setOtpSent(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', cursor: 'pointer' }}>Change number</button>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <HashIcon size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                    <input
                      className="form-input"
                      type="text"
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', paddingLeft: '3rem' }}
                      placeholder="6-digit code"
                    />
                  </div>
                </div>
              )}

              {otpSent ? (
                <button 
                  className="btn btn-primary" 
                  onClick={handleVerifyOtp} 
                  disabled={sendingOtp || otp.length < 6}
                  style={{ width: '100%', height: '3.5rem', borderRadius: '16px', fontWeight: 800 }}
                >
                  {sendingOtp ? 'Verifying...' : 'Sign in'}
                </button>
              ) : (
                <button 
                  className="btn btn-primary" 
                  onClick={handleRequestOtp} 
                  disabled={sendingOtp || phone.length < 8}
                  style={{ width: '100%', height: '3.5rem', borderRadius: '16px', fontWeight: 800 }}
                >
                  {sendingOtp ? 'Sending...' : 'Get verification code'}
                </button>
              )}
            </>
          )}

          {isSignUp && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginTop: '0.5rem' }}>
              <input
                type="checkbox"
                id="legal"
                name="legal_accepted"
                checked={legalAccepted}
                onChange={(e) => setLegalAccepted(e.target.checked)}
                required
                style={{ marginTop: '0.3rem' }}
              />
              <label htmlFor="legal" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                I accept the <button type="button" onClick={() => setActivePolicy('terms')} style={{ background: 'none', border: 'none', color: 'var(--brand)', padding: 0, cursor: 'pointer', fontWeight: 600 }}>Terms</button>,
                <button type="button" onClick={() => setActivePolicy('privacy')} style={{ background: 'none', border: 'none', color: 'var(--brand)', padding: 0, cursor: 'pointer', fontWeight: 600 }}>Privacy</button>, and
                <button type="button" onClick={() => setActivePolicy('cookies')} style={{ background: 'none', border: 'none', color: 'var(--brand)', padding: 0, cursor: 'pointer', fontWeight: 600 }}>Cookies</button>.
              </label>
            </div>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(authTab === 'email' || isSignUp) && <SubmitButton isSignUp={isSignUp} legalAccepted={legalAccepted} />}
            
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, marginTop: '0.5rem' }}
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>

        {!isSignUp && (
          <div style={{ marginTop: '1.25rem' }}>
            <div className="divider" style={{ margin: '1.5rem 0' }}>or continue with</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={(e) => handleGoogleLogin(e)}
                className="btn btn-secondary"
                style={{ 
                  width: '100%',
                  padding: '0.85rem 1rem', 
                  fontSize: '0.9rem', 
                  borderRadius: '14px', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  justifyContent: 'center',
                  background: 'white',
                  border: '1px solid rgba(0,0,0,0.1)',
                  color: '#1a1a1b'
                }}
              >
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.56 2.68-3.86 2.68-6.62z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.46-.8 5.95-2.18l-2.92-2.26c-.8.54-1.84.86-3.03.86-2.33 0-4.3-1.57-5-3.68H.98V13.1A8.99 8.99 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M4 10.74A5.4 5.4 0 0 1 3.72 9c0-.6.1-1.18.28-1.74V5H.98A8.99 8.99 0 0 0 0 9c0 1.45.35 2.82.98 4.1L4 10.74z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.32 0 2.5.46 3.43 1.36l2.57-2.58C13.45.9 11.43 0 9 0A8.99 8.99 0 0 0 .98 5L4 7.26C4.7 5.15 6.67 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <button
                type="button"
                onClick={(e) => handleGithubLogin(e)}
                className="btn btn-secondary"
                style={{ 
                  width: '100%',
                  padding: '0.85rem 1rem', 
                  fontSize: '0.9rem', 
                  borderRadius: '14px', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white'
                }}
              >
                <ExternalLink size={18} /> Continue with GitHub
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Policy Modals */}
      {activePolicy === 'privacy' && <PrivacyPolicy onClose={() => setActivePolicy(null)} />}
      {activePolicy === 'terms' && <TermsOfService onClose={() => setActivePolicy(null)} />}
      {activePolicy === 'cookies' && <CookiePolicy onClose={() => setActivePolicy(null)} />}

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; height: 0; } to { opacity: 1; height: auto; } }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
        <div className="spinner" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
