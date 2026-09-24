import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import LeadsMeetingsPage from './pages/LeadsMeetingsPage';
import MasterReportPage from './pages/MasterReportPage';
import LoginLeads from './pages/LoginLeads';
import LoginMasterReport from './pages/LoginMasterReport';
import { authLeads, authMasterReport } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Each tool authenticates against its own, separate Firebase project (see
// firebase.js). That separation IS the access control now — Leads &
// Meetings' project only has manually-created accounts and no sign-up, so
// anyone who can log into it is by definition allowed; there's no shared
// session and no email-allowlist check needed on top of it.
// `loginPath` sends an unauthenticated visitor to that tool's own dedicated
// login page, baked into the URL so it survives a refresh or a bookmark.
const ProtectedRoute = ({ children, user, loading, loginPath }) => {
  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid var(--primary-glow)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={loginPath} replace />;
  }

  return children;
};

const App = () => {
  const [userLeads, setUserLeads] = useState(null);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [userMasterReport, setUserMasterReport] = useState(null);
  const [loadingMasterReport, setLoadingMasterReport] = useState(true);
  const [isGreeting, setIsGreeting] = useState(false);
  const [currentGreeting, setCurrentGreeting] = useState('');

  useEffect(() => {
    const unsubscribeLeads = onAuthStateChanged(authLeads, (currentUser) => {
      setUserLeads(currentUser);
      setLoadingLeads(false);
    });
    const unsubscribeMasterReport = onAuthStateChanged(authMasterReport, (currentUser) => {
      setUserMasterReport(currentUser);
      setLoadingMasterReport(false);
    });

    return () => {
      unsubscribeLeads();
      unsubscribeMasterReport();
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route
          path="/leads-meetings/login"
          element={
            <LoginLeads
              isGreeting={isGreeting}
              setIsGreeting={setIsGreeting}
              currentGreeting={currentGreeting}
              setCurrentGreeting={setCurrentGreeting}
            />
          }
        />
        <Route
          path="/master-report/login"
          element={
            <LoginMasterReport
              isGreeting={isGreeting}
              setIsGreeting={setIsGreeting}
              currentGreeting={currentGreeting}
              setCurrentGreeting={setCurrentGreeting}
            />
          }
        />
        <Route
          path="/"
          element={<Home />}
        />
        <Route
          path="/leads-meetings"
          element={
            <ProtectedRoute user={userLeads} loading={loadingLeads || isGreeting} loginPath="/leads-meetings/login">
              <LeadsMeetingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/master-report"
          element={
            <ProtectedRoute user={userMasterReport} loading={loadingMasterReport || isGreeting} loginPath="/master-report/login">
              <MasterReportPage />
            </ProtectedRoute>
          }
        />
        {/* Redirect any other path, including the old shared /login, to / */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Router>
  );
};

export default App;
