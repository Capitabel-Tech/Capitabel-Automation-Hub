import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, CheckCircle, FileText, Database,
  Trash2, ArrowRight, RefreshCcw, Sparkles, ChevronRight,
  User, DollarSign, Activity, Calendar, FileType,
  LayoutDashboard, Loader2, Sparkle, LogOut, ArrowLeft,
  Pencil, Check, MapPin, Phone, AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authLeads as auth } from '../firebase';
import { API_BASE } from '../apiBase';
import { logEvent } from '../activityLog';
import { leadSections, visibleKeys } from '../leadSchema';

// Tool 1 has no sign-up form, so Firebase never learns a real name for its
// account(s) — only the email. Map known accounts to a display name here
// instead; update this if more Tool 1 accounts are added later.
const DISPLAY_NAME_OVERRIDES = {
  'csm@capitabel.com': 'Mounika',
};

const fieldBoxStyle = {
  width: '100%', background: '#f8fafc', border: '2px solid #94a3b8',
  borderRadius: '10px', padding: '0.7rem 0.9rem', color: 'var(--text-main)',
  fontSize: '0.95rem', outline: 'none'
};

const compactInputStyle = {
  width: '100%', background: '#f8fafc', border: '1.5px solid #94a3b8',
  borderRadius: '8px', padding: '0.4rem 0.6rem', color: 'var(--text-main)',
  fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box'
};

// A meeting's "from"/"to" is set to midnight by the extractor when the source
// sheet had no Time From/To column for that row (see meeting_extraction.py's
// "TimeFrom/TimeTo not found" rule) — not a real midnight meeting, so flag it.
const isPlaceholderTime = (iso) => !!iso && /T00:00:00$/.test(iso);

// datetime-local inputs want "YYYY-MM-DDTHH:MM" with no seconds; keep the
// stored value in full ISO-with-seconds form so the sync payload is unchanged.
const toDatetimeLocalValue = (iso) => (iso ? iso.slice(0, 16) : '');
const fromDatetimeLocalValue = (local) => (local ? `${local}:00` : local);

// Indian numbering: last 3 digits, then groups of 2 (e.g. ₹1,20,000 not ₹120,000)
const formatINR = (raw) => {
  const digits = String(raw ?? '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  const lastThree = digits.slice(-3);
  const otherDigits = digits.slice(0, -3);
  const formattedOther = otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const combined = otherDigits ? `${formattedOther},${lastThree}` : lastThree;
  return `₹${combined}`;
};

const labelStyle = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' };

// Every backend call in this tool requires a signed-in user - attach the
// current Firebase ID token so the backend can verify it's really them,
// rather than trusting whatever the browser claims.
const authHeaders = async () => {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Lead Owner, Assigned To, Referred By and Campaign Source: a dropdown of
// every record currently in that field's Zoho module (Users, Field Sales
// Operators, Vendors, Campaigns respectively) - loaded fresh whenever the
// review screen opens, so it reflects whoever/whatever exists in Zoho right
// now, no code change needed if someone is added or removed there.
const RecordSelectInput = ({ field, value, onChange }) => {
  const [names, setNames] = useState(null);
  // A name (e.g. from the AI reading a referrer off the transcript) that
  // didn't match any real Zoho record - kept only to warn staff in the UI,
  // never sent anywhere; the actual field value is cleared to '' instead.
  const [unmatchedGuess, setUnmatchedGuess] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/zoho-lookup?field=${field}&q=`, { headers: await authHeaders() });
        const data = await res.json();
        if (!cancelled) setNames(data.available ? data.names || [] : []);
      } catch {
        if (!cancelled) setNames([]);
      }
    })();
    return () => { cancelled = true; };
  }, [field]);

  // A value that predates the dropdown loading (e.g. a name the AI guessed
  // from the transcript) isn't a real Zoho record unless it happens to match
  // one exactly - clear it rather than showing a selection that doesn't
  // actually match any option, but keep the original guess to warn staff with.
  useEffect(() => {
    if (names && value && !names.includes(value)) {
      setUnmatchedGuess(value);
      onChange('');
    }
  }, [names, value, onChange]);

  if (names === null) {
    return <div style={{ ...fieldBoxStyle, color: 'var(--text-muted)' }}>Loading from Zoho…</div>;
  }
  if (names.length === 0) {
    return <div style={{ ...fieldBoxStyle, color: 'var(--text-muted)' }}>Can't load from Zoho right now.</div>;
  }
  return (
    <>
      <SelectBox
        value={value}
        onChange={(v) => { setUnmatchedGuess(null); onChange(v); }}
        options={names}
        style={fieldBoxStyle}
      />
      {unmatchedGuess && (
        <div style={{
          marginTop: '6px', padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FCA5A5',
          borderRadius: '8px', color: '#B91C1C', fontSize: '0.78rem', fontWeight: 600, lineHeight: 1.4
        }}>
          ⚠️ Heard "{unmatchedGuess}" in the audio, but that's not in Zoho. Please check and select the right one above.
        </div>
      )}
    </>
  );
};

const SelectBox = ({ value, onChange, options, blank = true, style }) => (
  <select value={value || ''} onChange={(e) => onChange(e.target.value)} style={style}>
    {blank && <option value="">-None-</option>}
    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
  </select>
);

const LeadField = ({ field, values, onChange }) => {
  const { key, label, kind, options, required, blank, titleKey, titleOptions } = field;
  const value = values[key];
  return (
    <div style={field.wide ? { gridColumn: '1 / -1' } : undefined}>
      <label style={labelStyle}>
        {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      {kind === 'select' ? (
        <SelectBox value={value} onChange={(v) => onChange(key, v)} options={options} blank={blank !== false} style={fieldBoxStyle} />
      ) : kind === 'record_select' ? (
        <RecordSelectInput field={key} value={value} onChange={(v) => onChange(key, v)} />
      ) : kind === 'textarea' ? (
        <textarea value={value || ''} onChange={(e) => onChange(key, e.target.value)} rows={3} style={{ ...fieldBoxStyle, resize: 'vertical' }} />
      ) : kind === 'amount' ? (
        <input
          type="text"
          inputMode="numeric"
          value={formatINR(value)}
          onChange={(e) => onChange(key, e.target.value.replace(/[^0-9]/g, ''))}
          style={fieldBoxStyle}
        />
      ) : kind === 'date' ? (
        <input type="date" value={value || ''} onChange={(e) => onChange(key, e.target.value)} style={fieldBoxStyle} />
      ) : kind === 'name' ? (
        <div style={{ display: 'flex', gap: '8px' }}>
          <SelectBox value={values[titleKey]} onChange={(v) => onChange(titleKey, v)} options={titleOptions} style={{ ...fieldBoxStyle, width: '110px', flexShrink: 0 }} />
          <input type="text" value={value || ''} onChange={(e) => onChange(key, e.target.value)} style={fieldBoxStyle} />
        </div>
      ) : (
        <input type="text" value={value || ''} onChange={(e) => onChange(key, e.target.value)} style={fieldBoxStyle} />
      )}
    </div>
  );
};

// Blank out fields that belong to the section not shown for this customer type
// (e.g. company details on an Individual lead) so they never reach Zoho.
const fieldsForSubmit = (fields) => {
  const keep = visibleKeys(fields.Type_of_Customer);
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) =>
      k === 'Confidence_Score' || k === 'Needs_Review' || keep.has(k) ? [k, v] : [k, ''])
  );
};

const LeadsMeetingsPage = () => {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mode, setMode] = useState('LEADS'); // 'LEADS' or 'MEETINGS'
  const [meetingResults, setMeetingResults] = useState(null);
  const [leadSyncResult, setLeadSyncResult] = useState(null);
  const [showEmailPopover, setShowEmailPopover] = useState(false);
  const [editingMeetingIndices, setEditingMeetingIndices] = useState(() => new Set());
  const [syncProgress, setSyncProgress] = useState(null); // { current, total, name }
  const [processProgress, setProcessProgress] = useState(null); // { percent, msg }


  const navigate = useNavigate();


  const handleLogout = async () => {
    try {
      // Log while still authenticated - the token becomes invalid the
      // moment signOut() completes, so this must happen just before it.
      if (auth.currentUser) {
        const idToken = await auth.currentUser.getIdToken();
        await logEvent({ tool: 'leads_meetings', action: 'LOGOUT', status: 'success', idToken });
      }
      await auth.signOut();
      navigate('/'); // Home is public now — land there, not back on the login screen.
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const formatTime12h = (isoStr) => {
    if (!isoStr) return "";
    try {
      const timePart = isoStr.split('T')[1]?.substring(0, 5);
      if (!timePart) return "";
      let [hours, minutes] = timePart.split(':');
      hours = parseInt(hours);
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      return `${hours}:${minutes} ${ampm}`;
    } catch (e) { return isoStr; }
  };

  const resetAll = () => {
    setFile(null);
    setReviewData(null);
    setIsProcessing(false);
    setSuccess(false);
    setMeetingResults(null);
    setLeadSyncResult(null);
    setEditingMeetingIndices(new Set());
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    if (mode === 'MEETINGS') {
      const ext = selected.name.split('.').pop().toLowerCase();
      if (ext !== 'xlsx' && ext !== 'xls') {
        alert('Meetings only accepts Excel files (.xlsx or .xls). Please select an Excel file.');
        e.target.value = '';
        return;
      }
    }

    setFile(selected);
  };

  // Reads a newline-delimited JSON progress stream (used by both the audio
  // and meeting processing endpoints), calling onProgress for each tick and
  // returning whichever of {result, streamError} the stream ended with.
  const readProgressStream = async (response, onProgress) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = null;
    let streamError = null;
    let buffer = '';

    const handleLine = (line) => {
      if (!line.trim()) return;
      try {
        const data = JSON.parse(line);
        if (data.type === 'progress') onProgress({ percent: data.percent, msg: data.msg });
        else if (data.type === 'result') result = data;
        else if (data.type === 'error') streamError = data;
      } catch (e) { console.error("Stream parse error", e); }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.trim()) handleLine(buffer);
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) handleLine(line);

      if (streamError) break;
    }

    return { result, streamError };
  };

  const startTranscription = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProcessProgress({ percent: 5, msg: "Initializing..." });
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`${API_BASE}/process-audio`, {
        method: 'POST',
        headers: await authHeaders(),
        body: formData
      });

      const { result, streamError } = await readProgressStream(response, setProcessProgress);

      if (streamError) {
        const err = new Error(streamError.msg);
        err.code = streamError.code;
        throw err;
      }

      if (result) {
        setReviewData({
          transcript: result.transcript,
          filename: result.filename,
          staff: result.fields.Staff || result.staff || "",
          fields: result.fields
        });
      }
    } catch (err) {
      if (err.code === "AI_KEY_EXPIRED") {
        alert("⚠️ " + err.message);
      } else if (err.code === "TRANSCRIPTION_FAILED") {
        alert("⚠️ " + err.message);
      } else if (err.code === "DUPLICATE_FILE") {
        alert("⚠️ " + err.message);
      } else {
        alert("AI Brain Error: " + err.message);
      }
    } finally {
      setIsProcessing(false);
      setProcessProgress(null);
    }
  };

  const updateLeadField = (key, value) => {
    setReviewData(prev => ({ ...prev, fields: { ...prev.fields, [key]: value } }));
  };

  const updateMeetingField = (idx, key, value) => {
    setReviewData(prev => {
      const meetings = [...prev.meetings];
      meetings[idx] = { ...meetings[idx], [key]: value };
      return { ...prev, meetings };
    });
  };

  const toggleMeetingEdit = (idx) => {
    setEditingMeetingIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const processFile = async () => {
    if (!file) return;
    if (mode === 'LEADS') {
      await startTranscription();
    } else {
      await startMeetingProcessing();
    }
  };

  const startMeetingProcessing = async () => {
    setIsProcessing(true);
    setProcessProgress({ percent: 5, msg: "Initializing..." });
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`${API_BASE}/process-meeting`, {
        method: 'POST',
        headers: await authHeaders(),
        body: formData
      });

      const { result, streamError } = await readProgressStream(response, setProcessProgress);

      if (streamError) {
        const err = new Error(streamError.msg);
        err.code = streamError.code;
        throw err;
      }

      if (result) {
        setReviewData({
          meetings: result.meetings,
          filename: result.filename,
          staff: result.staff || "",
          totalRows: result.total_rows_detected || result.meetings.length
        });
      }
    } catch (err) {
      if (err.code === "AI_KEY_EXPIRED") {
        alert("⚠️ " + err.message);
      } else {
        alert("Meeting Brain Error: " + err.message);
      }
    } finally {
      setIsProcessing(false);
      setProcessProgress(null);
    }
  };


  const confirmAndPush = async (confirmDuplicate = false) => {
    setIsSubmitting(true);
    try {
      const response = await axios.post(`${API_BASE}/submit-to-zoho`, {
        transcript: reviewData.transcript,
        filename: reviewData.filename,
        staff: reviewData.staff,
        fields: fieldsForSubmit(reviewData.fields),
        confirm_duplicate: confirmDuplicate
      }, { headers: await authHeaders() });

      if (response.data.status === 'duplicate') {
        setIsSubmitting(false);
        const wantsNew = window.confirm(
          `${response.data.msg}\n\nCreate a new lead anyway?`
        );
        if (wantsNew) {
          await confirmAndPush(true);
        }
        return;
      }

      if (response.data.status !== 'success') {
        throw new Error(response.data.msg || 'Zoho push failed.');
      }
      const name = [reviewData.fields.First_Name, reviewData.fields.Last_Name].filter(Boolean).join(' ') || 'This lead';
      setLeadSyncResult({ name });
      setSuccess(true);
      setReviewData(null);
    } catch (err) {
      alert("Zoho Push Failed: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const syncMeetings = async () => {
    setIsSubmitting(true);
    setSyncProgress({ current: 0, total: reviewData.meetings.length, name: "Initializing..." });
    try {
      const response = await fetch(`${API_BASE}/sync-meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          meetings: reviewData.meetings,
          filename: reviewData.filename,
          staff: reviewData.staff
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let finalResults = [];
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            try {
              const data = JSON.parse(buffer);
              if (data.type === 'progress') setSyncProgress({ current: data.current, total: data.total, name: data.name });
              else if (data.type === 'result') finalResults = data.results;
              else if (data.type === 'error') throw new Error(data.msg);
            } catch(e) {}
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'progress') {
              setSyncProgress({ current: data.current, total: data.total, name: data.name });
            } else if (data.type === 'result') {
              finalResults = data.results;
            } else if (data.type === 'error') {
              throw new Error(data.msg);
            }
          } catch (e) { console.error("Stream parse error", e); }
        }
      }

      setMeetingResults(finalResults);
      setSuccess(true);
      setReviewData(null);
    } catch (err) {
      alert("Meeting Sync Failed: " + err.message);
    } finally {
      setIsSubmitting(false);
      setSyncProgress(null);
    }
  };


  const StepIndicator = ({ step, label, active, done }) => (
    <div className={`stepper-item ${active ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div className="step-circle" style={{
        background: done ? 'var(--accent)' : (active ? 'var(--primary)' : '#f1f5f9'),
        color: done || active ? 'white' : 'var(--text-muted)'
      }}>
        {done ? <CheckCircle size={20} /> : step}
      </div>
      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: active ? 'var(--text-main)' : 'var(--text-muted)' }}>{label}</span>
    </div>
  );

  return (
    <div className="tool-page">
      {/* FIXED HEADER SECTION */}
      <header className="tool-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button
            onClick={() => navigate('/')}
            title="Back to Hub"
            style={{
              background: 'white', border: '1px solid var(--border)', padding: '8px 14px', borderRadius: '10px',
              color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600,
              boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
            }}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-1px', color: 'var(--text-main)' }}>
              Leads & Meetings <span style={{ fontWeight: 300, color: 'var(--text-muted)' }}>Sync</span>
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => { setMode('LEADS'); resetAll(); }}
            style={{
              padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--border)',
              background: mode === 'LEADS' ? 'var(--primary)' : 'white',
              color: mode === 'LEADS' ? 'white' : 'var(--text-main)',
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600
            }}
          >
            <Sparkles size={16} /> LEADS
          </button>
          <button
            onClick={() => { setMode('MEETINGS'); resetAll(); }}
            style={{
              padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--border)',
              background: mode === 'MEETINGS' ? 'var(--primary)' : 'white',
              color: mode === 'MEETINGS' ? 'white' : 'var(--text-main)',
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600
            }}
          >
            <Calendar size={16} /> MEETINGS
          </button>
        </div>

        <div className="tool-header-right">
          <nav className="stepper-nav">
            <StepIndicator step={1} label="UPLOAD" active={!reviewData && !success} done={!!reviewData || success} />
            <ChevronRight size={14} color="var(--border)" />
            <StepIndicator step={2} label="REFINE" active={!!reviewData} done={success} />
            <ChevronRight size={14} color="var(--border)" />
            <StepIndicator step={3} label="SYNC" active={success} done={success} />
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', position: 'relative' }}
              onClick={() => setShowEmailPopover(prev => !prev)}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#E87A22', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.9rem' }}>
                {(DISPLAY_NAME_OVERRIDES[auth.currentUser?.email])?.charAt(0).toUpperCase() || auth.currentUser?.displayName?.charAt(0).toUpperCase() || auth.currentUser?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="user-name" style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                {DISPLAY_NAME_OVERRIDES[auth.currentUser?.email] || auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'User'}
              </span>
              {showEmailPopover && (
                <div style={{
                  position: 'absolute', top: '40px', right: 0, background: 'white', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '10px 14px', boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                  fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', zIndex: 200
                }}>
                  {auth.currentUser?.email}
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                fontSize: '0.85rem', fontWeight: 600, padding: '6px 8px', borderRadius: '6px'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#B91C1C'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* SCROLLABLE MAIN CONTENT */}
      <main className="tool-main">
        <AnimatePresence mode="wait">

          {!reviewData && !success && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key="upload-step" style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
              <div className="glass-card" style={{ width: '100%', padding: '6rem 2rem', textAlign: 'center' }}>
                <div style={{ maxWidth: '450px', margin: '0 auto' }}>
                  {!file ? (
                    <label style={{ cursor: 'pointer' }}>
                      <div style={{ background: '#f8fafc', padding: '3rem', borderRadius: '40px', border: '2px dashed var(--border)', marginBottom: '1.5rem' }}>
                        <Upload size={48} color="var(--primary)" />
                      </div>
                      <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem', textTransform: 'uppercase' }}>
                        UPLOAD {mode === 'LEADS' ? 'AUDIO FILE' : 'DOCUMENT'}
                      </h3>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
                        {mode === 'LEADS'
                          ? ['MP3', 'WAV', 'M4A', 'OGG', 'FLAC', 'WEBM', 'MP4'].map(ext => (
                            <span key={ext} style={{ fontSize: '0.65rem', fontWeight: 800, padding: '4px 10px', background: '#f1f5f9', color: 'var(--text-muted)', borderRadius: '6px', border: '1px solid var(--border)' }}>{ext}</span>
                          ))
                          : ['XLSX', 'XLS'].map(ext => (
                            <span key={ext} style={{ fontSize: '0.65rem', fontWeight: 800, padding: '4px 10px', background: '#f1f5f9', color: 'var(--text-muted)', borderRadius: '6px', border: '1px solid var(--border)' }}>{ext}</span>
                          ))
                        }
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        {mode === 'LEADS' ? 'Select CRM audio for High-Fidelity AI Transcription' : 'Select Meetings Excel File for Intelligent Extraction'}
                      </p>

                      <input
                        type="file"
                        accept={mode === 'MEETINGS' ? '.xlsx,.xls' : 'audio/*'}
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                    </label>
                  ) : (
                    <div style={{ background: '#f8fafc', padding: '2.5rem', borderRadius: '40px', border: '1.5px solid var(--primary)', textAlign: 'center' }}>
                      <FileText size={40} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                      <h4 style={{ wordBreak: 'break-all', marginBottom: '1.5rem', color: 'var(--text-main)' }}>{file.name}</h4>

                      {processProgress && (
                        <div style={{ width: '100%', maxWidth: '300px', margin: '0 auto 1.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                            <span>{processProgress.msg}</span>
                            <span>{processProgress.percent}%</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${processProgress.percent}%` }}
                              style={{ height: '100%', background: 'var(--primary)', boxShadow: '0 0 10px var(--primary-glow)' }}
                            />
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                        <button className="btn-premium" onClick={processFile} disabled={isProcessing}>
                          {isProcessing ? 'PROCESSING...' : 'INITIALIZE'}
                        </button>
                        <button className="btn-outline" onClick={() => setFile(null)}><Trash2 size={20} /></button>
                      </div>
                      {isProcessing && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '15px', fontWeight: 600 }}>
                          Please wait, this may take a minute...
                        </p>
                      )}
                    </div>

                  )}
                </div>
              </div>
            </motion.div>
          )}

          {reviewData && !success && mode === 'LEADS' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="refine-step">
              <div className="glass-card review-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileText color="var(--primary)" size={20} />
                    <h2 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>Review Lead Details</h2>
                  </div>
                  {reviewData.fields?.Needs_Review && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '4px 10px', background: '#fef3c7', color: '#92400e', borderRadius: '6px' }}>
                      NEEDS REVIEW
                    </span>
                  )}
                </div>

                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>
                  Full Transcript
                </label>
                <textarea
                  value={reviewData.transcript}
                  onChange={(e) => setReviewData({ ...reviewData, transcript: e.target.value })}
                  style={{
                    width: '100%', height: '220px', background: '#f8fafc', border: '2px solid #94a3b8',
                    borderRadius: '16px', padding: '1.5rem', color: 'var(--text-main)', fontSize: '1rem', lineHeight: '1.7',
                    outline: 'none', resize: 'vertical', marginBottom: '1.5rem'
                  }}
                />

                <div style={{ borderTop: '3px solid #94a3b8', paddingTop: '1.8rem', marginTop: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '14px' }}>
                    Extracted Values From The Above Transcript
                  </h3>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700,
                    color: '#92400e', background: '#fef3c7', padding: '10px 14px', borderRadius: '8px', marginBottom: '2rem'
                  }}>
                    ⚠️ AI-extracted — please verify every field carefully. 100% pre-checking is strongly advised before syncing to Zoho CRM.
                  </div>
                </div>

                {leadSections(reviewData.fields.Type_of_Customer).map((section) => (
                  <div key={section.title} style={{ marginBottom: '1.8rem' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #e2e8f0' }}>
                      {section.title}
                    </h4>
                    <div className="lead-grid">
                      {section.fields.map((field) => (
                        <LeadField key={field.key} field={field} values={reviewData.fields} onChange={updateLeadField} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {reviewData && !success && mode === 'MEETINGS' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="meeting-refine-step">
              <div className="glass-card review-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Calendar color="var(--primary)" size={20} />
                    <h2 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>
                      Detected Meetings ({reviewData.meetings.length} / {reviewData.totalRows || reviewData.meetings.length})
                    </h2>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                  {reviewData.meetings.map((m, idx) => {
                    const isEditing = editingMeetingIndices.has(idx);
                    const timeMissing = isPlaceholderTime(m.Start_DateTime) && isPlaceholderTime(m.End_DateTime);
                    return (
                      <div key={idx} style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={m.Meeting_Title || ''}
                              onChange={(e) => updateMeetingField(idx, 'Meeting_Title', e.target.value)}
                              style={{ ...compactInputStyle, fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', maxWidth: '65%' }}
                            />
                          ) : (
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>{m.Meeting_Title}</span>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m.Start_DateTime?.split('T')[0]}</span>
                            <button
                              onClick={() => toggleMeetingEdit(idx)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px',
                                borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700,
                                border: isEditing ? '1px solid #10b981' : '1px solid var(--border)',
                                background: isEditing ? '#ecfdf5' : 'white',
                                color: isEditing ? '#10b981' : 'var(--text-main)'
                              }}
                            >
                              {isEditing ? <Check size={13} /> : <Pencil size={12} />}
                              {isEditing ? 'Save' : 'Edit'}
                            </button>
                          </div>
                        </div>

                        {isEditing ? (
                          <input
                            type="text"
                            value={m.Contact_Name || ''}
                            onChange={(e) => updateMeetingField(idx, 'Contact_Name', e.target.value)}
                            style={{ ...compactInputStyle, fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}
                          />
                        ) : (
                          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>{m.Contact_Name}</h3>
                        )}

                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
                            <User size={12} color="var(--primary)" style={{ flexShrink: 0 }} />
                            <input
                              type="text"
                              placeholder="Staff"
                              value={m.Staff || m.staff || ''}
                              onChange={(e) => updateMeetingField(idx, 'Staff', e.target.value)}
                              style={compactInputStyle}
                            />
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '0.5rem' }}>
                            <User size={12} /> Staff: {m.staff || m.Staff || 'Not Assigned'}
                          </div>
                        )}

                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
                            <Phone size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                            <input
                              type="text"
                              placeholder="Phone"
                              value={m.phone || m.Phone || ''}
                              onChange={(e) => updateMeetingField(idx, 'phone', e.target.value)}
                              style={compactInputStyle}
                            />
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                            <Phone size={12} /> {m.phone || m.Phone || 'Not provided'}
                          </div>
                        )}

                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.7rem' }}>
                            <MapPin size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                            <input
                              type="text"
                              placeholder="Location"
                              value={m.Location || m.location || ''}
                              onChange={(e) => updateMeetingField(idx, 'Location', e.target.value)}
                              style={compactInputStyle}
                            />
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-main)', marginBottom: '0.7rem' }}>
                            <MapPin size={12} /> {m.Location || m.location || 'Not provided'}
                          </div>
                        )}

                        {isEditing ? (
                          <textarea
                            value={m.Description || ''}
                            onChange={(e) => updateMeetingField(idx, 'Description', e.target.value)}
                            rows={2}
                            style={{ ...compactInputStyle, resize: 'vertical', marginBottom: '0.7rem' }}
                          />
                        ) : (
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.7rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.Description}</p>
                        )}

                        {isEditing ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="datetime-local"
                              value={toDatetimeLocalValue(m.Start_DateTime)}
                              onChange={(e) => updateMeetingField(idx, 'Start_DateTime', fromDatetimeLocalValue(e.target.value))}
                              style={{ ...compactInputStyle, fontSize: '0.75rem' }}
                            />
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>to</span>
                            <input
                              type="datetime-local"
                              value={toDatetimeLocalValue(m.End_DateTime)}
                              onChange={(e) => updateMeetingField(idx, 'End_DateTime', fromDatetimeLocalValue(e.target.value))}
                              style={{ ...compactInputStyle, fontSize: '0.75rem' }}
                            />
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-main)' }}>
                            <Activity size={12} /> {formatTime12h(m.Start_DateTime)} - {formatTime12h(m.End_DateTime)}
                          </div>
                        )}

                        {timeMissing && (
                          <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.7rem', fontWeight: 700,
                            color: '#92400e', background: '#fef3c7', padding: '8px 10px', borderRadius: '8px', marginTop: '0.7rem'
                          }}>
                            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
                            <span>No time was found in the input file for this meeting — please verify and edit the time before syncing.</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {success && mode === 'LEADS' && (
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} key="lead-success-step" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="glass-card" style={{ width: '100%', padding: '3rem 2rem', textAlign: 'center' }}>
                <div style={{ background: '#ecfdf5', color: '#10b981', width: '60px', height: '60px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.2rem' }}>
                  <CheckCircle size={30} />
                </div>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '1.8rem', color: 'var(--text-main)' }}>
                  Your lead <span style={{ color: 'var(--primary)' }}>{leadSyncResult?.name}</span> has been synced to your Zoho CRM successfully!
                </h1>
                <button className="btn-premium" onClick={resetAll} style={{ width: '250px', padding: '14px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                  CONTINUE TO NEXT UPLOAD
                </button>
              </div>
            </motion.div>
          )}

          {success && mode === 'MEETINGS' && (
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} key="success-step" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="glass-card" style={{ width: '100%', padding: '3rem 2rem', textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', marginBottom: '2.5rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ background: '#ecfdf5', color: '#10b981', width: '60px', height: '60px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                      <CheckCircle size={30} />
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{meetingResults?.filter(r => r.success).length || 0} / {meetingResults?.length || 0}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>SUCCESSFUL</div>
                  </div>

                  {meetingResults?.some(r => !r.success) && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ background: '#fef2f2', color: '#ef4444', width: '60px', height: '60px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                        <Activity size={30} />
                      </div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{meetingResults.filter(r => !r.success).length}</div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>FAILED</div>
                    </div>
                  )}
                </div>

                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--text-main)', letterSpacing: '1px' }}>Hey Team, it's all done! 🚀</h1>

                {meetingResults && (
                  <div style={{ maxWidth: '800px', margin: '0 auto 2.5rem', maxHeight: '40vh', overflowY: 'auto', paddingRight: '12px' }}>
                    {meetingResults.map((r, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 20px', background: '#f8fafc', borderRadius: '15px',
                        marginBottom: '8px', border: '1px solid var(--border)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <div style={{ background: r.success ? '#10b981' : '#ef4444', width: '8px', height: '8px', borderRadius: '50%' }} />
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.subject}{r.name ? ` : ${r.name}` : ''}</div>
                            {!r.success && <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>Error: {r.error}</div>}
                          </div>

                        </div>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 800,
                          color: r.success ? '#10b981' : '#ef4444',
                          background: r.success ? '#ecfdf5' : '#fef2f2',
                          padding: '4px 10px', borderRadius: '6px'
                        }}>
                          {r.success ? 'SYNCED' : 'FAILED'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button className="btn-premium" onClick={resetAll} style={{ width: '250px', padding: '14px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    NEW UPLOAD
                  </button>
                </div>

              </div>
            </motion.div>
          )}


        </AnimatePresence>
      </main>

      {/* FIXED BOTTOM ACTION DOCK */}
      {reviewData && !success && (
        <div className="tool-dock">
          {/* AI ADVISORY ALERT */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', background: '#fffbeb',
            border: '1px solid #fde68a', padding: '6px 15px', borderRadius: '30px',
            color: '#b45309', fontSize: '0.75rem', fontWeight: 600
          }}>
            <Sparkles size={12} /> AI ADVISORY: VERIFY FOR 100% LITERAL TRUTH BEFORE FINAL SYNC.
          </div>

          {syncProgress && (
            <div style={{ width: '400px', maxWidth: '100%', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '5px' }}>
                <span>{syncProgress.name === "Initializing..." ? "WAKING UP AI..." : `SYNCING: ${syncProgress.name}`}</span>
                <span>{syncProgress.current} / {syncProgress.total}</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                  style={{ height: '100%', background: 'var(--primary)', boxShadow: '0 0 10px var(--primary-glow)' }}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
            <button
              className="btn-premium"
              onClick={mode === 'LEADS' ? () => confirmAndPush() : syncMeetings}
              disabled={isSubmitting}
              style={{ width: '300px', maxWidth: '100%', justifyContent: 'center', padding: '12px', borderRadius: '12px', fontSize: '1rem' }}
            >
              <Database size={18} />
              {isSubmitting ? (syncProgress ? 'IN PROGRESS...' : 'SYNCING...') : `FINAL SYNC TO ZOHO ${mode === 'MEETINGS' ? 'EVENTS' : 'LEADS'}`}
            </button>

            <button className="btn-outline" onClick={resetAll} style={{ width: '120px', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '12px' }}>
              <Trash2 size={16} /> CANCEL
            </button>
          </div>
          <footer style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            &copy; 2026 CRM PIPELINE // HIGH-INTELLIGENCE DATA AUTOMATION
          </footer>
        </div>
      )}

      {!reviewData && !success && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
          <p style={{ fontSize: '0.75rem' }}>&copy; 2026 CRM PIPELINE</p>
        </div>
      )}
    </div>
  );
};

export default LeadsMeetingsPage;
