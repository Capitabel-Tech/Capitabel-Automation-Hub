import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Mail, Lock, ArrowRight, ArrowLeft, ShieldCheck, Cpu, User, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authMasterReport as auth } from '../firebase';
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
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

// Sign-in AND sign-up — Master Report Processor never touches live Zoho
// data (it only processes files a user uploads), so open self-registration
// is acceptable here in a way it isn't for Leads & Meetings.
const LoginMasterReport = ({ isGreeting, setIsGreeting, currentGreeting, setCurrentGreeting }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();

  React.useEffect(() => {
    if (auth.currentUser && !isGreeting) {
      navigate('/master-report');
    }
  }, [isGreeting, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    if (isSignUp) {
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        setIsLoading(false);
        return;
      }
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });

        // Still authenticated at this point (Firebase auto-signs-in a new
        // account) - get the token and log while it's still valid, before
        // the deliberate signOut() below invalidates it.
        const idToken = await userCredential.user.getIdToken();
        logEvent({ tool: 'master_report', action: 'SIGNUP', status: 'success', idToken });

        // Firebase signs the new account in immediately on creation — sign
        // back out so the user has to explicitly sign in themselves, rather
        // than being dropped straight into the tool.
        await auth.signOut();

        setPassword('');
        setConfirmPassword('');
        setSuccessMessage('Account created successfully! Redirecting you to sign in...');
        setTimeout(() => {
          setSuccessMessage('');
          setIsSignUp(false);
          setIsLoading(false);
        }, 2000);
      } catch (err) {
        console.error("Signup error:", err);
        let msg = err.message.replace('Firebase: ', '');
        logEvent({
          tool: 'master_report', action: 'SIGNUP', status: 'failure',
          attemptedEmail: email, details: { error: msg },
        });
        setError(msg);
        setIsLoading(false);
      }
    } else {
      try {
        await setPersistence(auth, browserSessionPersistence);
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await credential.user.getIdToken();
        logEvent({ tool: 'master_report', action: 'LOGIN', status: 'success', idToken });

        const randomIndex = Math.floor(Math.random() * GREETINGS.length);
        setCurrentGreeting(GREETINGS[randomIndex]);
        setIsGreeting(true);
        setTimeout(() => { setIsGreeting(false); navigate('/master-report'); }, 2000);
      } catch (err) {
        console.error("Login error:", err);
        let msg = err.message.replace('Firebase: ', '');
        if (msg.includes('auth/invalid-credential')) msg = "Invalid email or password.";
        logEvent({
          tool: 'master_report', action: 'LOGIN', status: 'failure',
          attemptedEmail: email, details: { error: msg },
        });
        setError(msg);
        setIsLoading(false);
      }
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
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              {isSignUp ? 'Join Master Report Processor' : 'Secure access to Master Report Processor'}
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

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              style={{
                background: '#dcfce7', color: '#15803d', padding: '10px 15px', borderRadius: '8px',
                fontSize: '0.85rem', marginBottom: '1.5rem', border: '1px solid #bbf7d0'
              }}
            >
              {successMessage}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <AnimatePresence mode="popLayout">
              {isSignUp && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{ position: 'relative' }}
                >
                  <User size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required={isSignUp}
                    style={{
                      width: '100%', padding: '14px 14px 14px 48px', borderRadius: '12px', border: '1px solid var(--border)',
                      background: '#f8fafc', fontSize: '1rem', outline: 'none', transition: 'all 0.2s ease'
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="email" placeholder={isSignUp ? "Business or Company Domain Mail" : "Email address"} value={email} onChange={(e) => setEmail(e.target.value)} required
                style={{
                  width: '100%', padding: '14px 14px 14px 48px', borderRadius: '12px', border: '1px solid var(--border)',
                  background: '#f8fafc', fontSize: '1rem', outline: 'none', transition: 'all 0.2s ease'
                }}
              />
            </div>

            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type={showPassword ? 'text' : 'password'} placeholder={isSignUp ? "New Password" : "Password"} value={password} onChange={(e) => setPassword(e.target.value)} required
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

            <AnimatePresence mode="popLayout">
              {isSignUp && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{ position: 'relative' }}
                >
                  <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required={isSignUp}
                    style={{
                      width: '100%', padding: '14px 48px 14px 48px', borderRadius: '12px', border: '1px solid var(--border)',
                      background: '#f8fafc', fontSize: '1rem', outline: 'none', transition: 'all 0.2s ease'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center'
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit" disabled={isLoading} className="btn-premium"
              style={{
                marginTop: '1rem', padding: '14px', borderRadius: '12px', fontSize: '1rem',
                justifyContent: 'center', gap: '10px',
                opacity: isLoading ? 0.6 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? (
                <div className="spinner" style={{ width: '20px', height: '20px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
              ) : (
                <>{isSignUp ? 'Create Account' : 'Sign In'} <ArrowRight size={18} /></>
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                {isSignUp ? "Already have an account?" : "Don't have an account?"}
              </span>
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccessMessage(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, marginLeft: '6px', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                {isSignUp ? "Sign In" : "Sign Up"}
              </button>
            </div>
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

export default LoginMasterReport;
