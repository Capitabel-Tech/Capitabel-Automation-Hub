import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Mail, Lock, ArrowRight, ArrowLeft, ShieldCheck, Cpu, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authLeads as auth } from '../firebase';
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { logEvent } from '../activityLog';

const GREETINGS = [
  "Hello Capital Solution",
  "Welcome Back, Team!",
  "Initializing Intelligence...",
  "Ready for Growth?",
  "Syncing with Excellence",
  "Your Pipeline is Ready",
  "Systems Online",
  "Intelligence Optimized",
  "Capital Solution Hub Active",
  "Data Stream Connected"
];

// Sign-in only — no sign-up exists for this tool at all. Leads & Meetings
// writes directly to production Zoho, so access is limited to one
// pre-created account (enforced in App.jsx's ProtectedRoute), not open
// self-registration.
const LoginLeads = ({ isGreeting, setIsGreeting, currentGreeting, setCurrentGreeting }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (auth.currentUser && !isGreeting) {
      navigate('/leads-meetings');
    }
  }, [isGreeting, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await setPersistence(auth, browserSessionPersistence);
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      logEvent({ tool: 'leads_meetings', action: 'LOGIN', status: 'success', idToken });

      const randomIndex = Math.floor(Math.random() * GREETINGS.length);
      setCurrentGreeting(GREETINGS[randomIndex]);
      setIsGreeting(true);
      setTimeout(() => { setIsGreeting(false); navigate('/leads-meetings'); }, 2000);
    } catch (err) {
      console.error("Login error:", err);
      let msg = err.message.replace('Firebase: ', '');
      if (msg.includes('auth/invalid-credential')) msg = "Invalid email or password.";
      logEvent({
        tool: 'leads_meetings', action: 'LOGIN', status: 'failure',
        attemptedEmail: email, details: { error: msg },
      });
      setError(msg);
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <button
        onClick={() => navigate('/')}
        style={{
          position: 'absolute', top: '2rem', left: '2rem', zIndex: 10,
          display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'transparent',
          border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem',
          fontWeight: 600, padding: '8px 0', transition: 'color 0.2s'
        }}
        onMouseEnter={(e) => e.target.style.color = 'var(--accent)'}
        onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
      >
        <ArrowLeft size={16} style={{ pointerEvents: 'none' }} /> Back to Hub
      </button>

      <AnimatePresence>
        {isGreeting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', inset: 0, background: 'var(--primary)', zIndex: 1000,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white'
            }}
          >
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: 'spring' }}>
              <Sparkles size={80} style={{ marginBottom: '2rem' }} />
            </motion.div>
            <motion.h1
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
              style={{ fontSize: 'clamp(2rem, 8vw, 3.5rem)', fontWeight: 800, textAlign: 'center', maxWidth: '800px', padding: '0 2rem' }}
            >
              {currentGreeting}
            </motion.h1>
            <motion.div
              initial={{ width: 0 }} animate={{ width: '200px' }} transition={{ delay: 0.6, duration: 0.8 }}
              style={{ height: '4px', background: 'white', marginTop: '2rem', borderRadius: '2px', opacity: 0.5 }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{
        position: 'absolute', top: '-10%', right: '-5%', width: '400px', height: '400px',
        background: 'radial-gradient(circle, var(--primary-glow) 0%, transparent 70%)',
        opacity: 0.4, filter: 'blur(60px)', zIndex: 0
      }}></div>
      <div style={{
        position: 'absolute', bottom: '-10%', left: '-5%', width: '500px', height: '500px',
        background: 'radial-gradient(circle, #cbd5e1 0%, transparent 70%)',
        opacity: 0.3, filter: 'blur(80px)', zIndex: 0
      }}></div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(0.75rem, 4vw, 2rem)', zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="glass-card"
          style={{ maxWidth: '640px', width: '100%', padding: 'clamp(1.25rem, 5vw, 3.5rem)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08)', border: '1px solid rgba(255,255,255,0.8)' }}
        >
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              style={{
                background: 'var(--primary)', width: '64px', height: '64px', borderRadius: '18px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
                boxShadow: '0 8px 20px var(--primary-glow)'
              }}
            >
              <Cpu color="white" size={32} />
            </motion.div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem', letterSpacing: '-1px' }}>
              Welcome Back
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Secure access to Leads & Meetings
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              style={{
                background: '#fee2e2', color: '#b91c1c', padding: '10px 15px', borderRadius: '8px',
                fontSize: '0.85rem', marginBottom: '1.5rem', border: '1px solid #fecaca'
              }}
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required
                style={{
                  width: '100%', padding: '14px 14px 14px 48px', borderRadius: '12px', border: '1px solid var(--border)',
                  background: '#f8fafc', fontSize: '1rem', outline: 'none', transition: 'all 0.2s ease'
                }}
              />
            </div>

            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required
                style={{
                  width: '100%', padding: '14px 48px 14px 48px', borderRadius: '12px', border: '1px solid var(--border)',
                  background: '#f8fafc', fontSize: '1rem', outline: 'none', transition: 'all 0.2s ease'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginTop: '0.5rem', padding: '12px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '12px' }}>
              <input
                type="checkbox" id="terms" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)}
                style={{ marginTop: '4px', cursor: 'pointer', minWidth: '16px', height: '16px', accentColor: '#B91C1C' }}
              />
              <label htmlFor="terms" style={{ fontSize: '0.85rem', color: '#991B1B', lineHeight: 1.5, cursor: 'pointer' }}>
                <strong>Important:</strong> I understand that this tool is highly sensitive and data processed here syncs <strong>directly to the production Zoho CRM</strong>. I agree to verify all records before syncing.
              </label>
            </div>

            <button
              type="submit" disabled={isLoading || !termsAccepted} className="btn-premium"
              style={{
                marginTop: '1rem', padding: '14px', borderRadius: '12px', fontSize: '1rem',
                justifyContent: 'center', gap: '10px',
                opacity: (isLoading || !termsAccepted) ? 0.6 : 1,
                cursor: (isLoading || !termsAccepted) ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? (
                <div className="spinner" style={{ width: '20px', height: '20px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
              ) : (
                <>Sign In <ArrowRight size={18} /></>
              )}
            </button>
          </form>

          <div style={{
            marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '0.85rem'
          }}>
            <ShieldCheck size={16} /> Enterprise Grade Security Enabled
          </div>
        </motion.div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0% { transform: scale(1); opacity: 0.1; } 50% { transform: scale(1.1); opacity: 0.2; } 100% { transform: scale(1); opacity: 0.1; } }
      `}</style>
    </div>
  );
};

export default LoginLeads;
