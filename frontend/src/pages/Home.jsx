import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, ShieldCheck, Zap, BarChart2, LayoutGrid, User, FileText, Settings, 
  ArrowRight, FileSpreadsheet, Activity, Database
} from 'lucide-react';
import { motion } from 'framer-motion';

const Home = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('All Tools');
  const [showLeadsInfo, setShowLeadsInfo] = useState(false);
  const [showReportsInfo, setShowReportsInfo] = useState(false);
  const leadsCardRef = useRef(null);
  const reportsCardRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (leadsCardRef.current && !leadsCardRef.current.contains(event.target)) {
        setShowLeadsInfo(false);
      }
      if (reportsCardRef.current && !reportsCardRef.current.contains(event.target)) {
        setShowReportsInfo(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // FORCE HMR UPDATE: Removed abstract background art

  // handleLogout removed since this page is public

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      position: 'relative',
      overflowX: 'hidden',
      backgroundColor: 'var(--bg-main)',
      backgroundImage: `linear-gradient(to right, rgba(15, 23, 42, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(15, 23, 42, 0.08) 1px, transparent 1px)`,
      backgroundSize: '60px 60px'
    }}>
      


      {/* Header */}
      <header style={{
        padding: '1.2rem var(--gutter)', 
        background: 'transparent', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        position: 'relative',
        zIndex: 50,
        borderBottom: '1px solid rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '48px', height: '48px', 
            background: 'var(--accent)', borderRadius: '12px'
          }}>
            <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '2rem', fontFamily: 'serif' }}>C</span>
          </div>
          <div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 5vw, 2rem)', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--accent)', lineHeight: 1 }}>
              CAPITABEL
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--primary)', letterSpacing: '1.5px', fontWeight: 700, marginTop: '2px', textTransform: 'uppercase' }}>
              Automation Hub
            </p>
          </div>
        </div>

        <div>
          {/* Top right space reserved for potential future use */}
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '4rem 0 2rem', position: 'relative', zIndex: 10 }}>
        
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'left', maxWidth: '850px', marginLeft: 'var(--gutter)', marginRight: 'var(--gutter)', marginBottom: '6rem' }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(232, 122, 34, 0.08)', color: 'var(--primary)', padding: '6px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, marginBottom: '2rem', border: '1px solid rgba(232, 122, 34, 0.2)' }}>
            <ShieldCheck size={14} /> Internal Operations Portal
          </div>
          
          <h2 style={{ fontSize: 'clamp(2.4rem, 9vw, 4.5rem)', fontWeight: 800, fontFamily: "'Poppins', sans-serif", color: 'var(--accent)', lineHeight: 1.05, letterSpacing: '-2px', marginBottom: '1.5rem' }}>
            Hours of manual work. <br />
            <span style={{ color: 'var(--primary)', fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 900, letterSpacing: 0 }}>Now, under a few minutes.</span>
          </h2>

          <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '600px', marginBottom: '2.5rem' }}>
            One platform built to end the busywork, so the team can focus on the work that matters.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-start', gap: '1rem 3rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Zap size={16} color="var(--primary)" /> Faster Operations</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldCheck size={16} color="var(--primary)" /> Higher Accuracy</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart2 size={16} color="var(--primary)" /> Smarter Insights</span>
          </div>
        </motion.div>

        {/* Tools Section */}
        <div style={{ padding: '0 var(--gutter)' }}>
          
          {/* Section Header */}
          <div style={{ marginBottom: '5rem' }}>
            <h3 style={{ fontSize: 'clamp(1.7rem, 6vw, 2.5rem)', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-1px', marginBottom: '0.5rem' }}>
              Operations &amp; Automation Tools
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', lineHeight: 1.7, maxWidth: '750px' }}>
              Discover our suite of intelligent tools designed specifically for modern teams. From seamless CRM synchronization to automated master report generation, these powerful modules eliminate repetitive manual tasks and empower you to scale operations with unprecedented speed and precision.
            </p>
          </div>

          {/* Cards List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
            
            {/* Card 1: Leads & Meetings */}
            <motion.div 
              ref={leadsCardRef}
              whileHover={{ y: -4, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.08)' }}
              className="glass-card home-card"
              style={{
                background: 'white', borderRadius: '24px', 
                borderLeft: '6px solid var(--primary)', position: 'relative', overflow: 'hidden',
                display: 'flex', justifyContent: 'space-between'
              }}
            >
              <div style={{ maxWidth: '600px', position: 'relative', zIndex: 2 }}>
                <div style={{ background: 'var(--primary)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', boxShadow: '0 4px 15px rgba(232, 122, 34, 0.3)' }}>
                  <Zap color="white" size={24} />
                </div>
                <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)', marginBottom: '0.75rem', letterSpacing: '-0.5px' }}><span style={{ color: 'var(--primary)', fontWeight: 900, marginRight: '12px' }}>01.</span>Leads &amp; Meetings Sync</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '2rem' }}>
                  Turn field call audio into Zoho CRM leads in minutes. Turn daily visit Excel sheets into structured Zoho meetings — reviewed before anything syncs.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <button onClick={() => navigate('/leads-meetings')} className="btn-premium" style={{ padding: '10px 20px', fontSize: '0.9rem' }}>
                    Access Tool <ArrowRight size={16} />
                  </button>
                  <span onClick={() => setShowLeadsInfo(!showLeadsInfo)} style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Learn More <ArrowRight size={14} style={{ transform: showLeadsInfo ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                  </span>
                </div>
                
                {showLeadsInfo && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div>
                        <h5 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Zap size={14} color="var(--primary)" /> Leads
                        </h5>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                          Upload a call recording — AI transcribes, translates, and extracts lead details: name, phone, loan type, amount, status. Review every field, then sync a clean lead into Zoho CRM, with the original audio attached.
                        </p>
                      </div>
                      <div>
                        <h5 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileSpreadsheet size={14} color="var(--primary)" /> Meetings
                        </h5>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                          Upload the day's field-visit Excel sheet — AI reads every row and extracts meeting details: name, phone, time, location, notes. Review the full list, then sync the entire batch into Zoho CRM as meetings.
                        </p>
                      </div>
                    </div>
                    <div style={{ background: '#FEF2F2', color: '#B91C1C', padding: '12px 16px', borderRadius: '8px', fontSize: '0.85rem', marginTop: '1.5rem', border: '1px solid #FCA5A5', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                      <p style={{ margin: 0, lineHeight: 1.5 }}><strong>Warning:</strong> Make sure you are 100% sure before syncing. Approvals reflect directly and immediately in the production Zoho CRM.</p>
                    </div>
                  </motion.div>
                )}
              </div>
              
              {/* Decorative Graphic for Leads */}
              <div className="home-card-art" style={{ position: 'relative', width: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#FFF3E0', color: 'var(--primary)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '1px' }}>
                  CRM &middot; LEADS
                </div>
                
                <div style={{ position: 'relative' }}>
                  {/* Fake waveform block */}
                  <div style={{ position: 'absolute', left: '-40px', top: '20px', background: 'white', padding: '12px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <Activity size={20} color="var(--accent)" />
                  </div>
                  {/* Fake Zoho app block */}
                  <div style={{ background: 'white', padding: '20px', borderRadius: '24px', boxShadow: '0 15px 35px rgba(232, 122, 34, 0.1)', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', border: '1px solid rgba(232, 122, 34, 0.1)' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#10b981' }} />
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'var(--primary)' }} />
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#3b82f6' }} />
                    </div>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '1px' }}>ZOHO</span>
                  </div>
                </div>
                {/* Dotted curve connecting them */}
                <div style={{ position: 'absolute', bottom: '50px', left: '30px', width: '100px', height: '50px', borderBottom: '2px dashed rgba(232, 122, 34, 0.3)', borderLeft: '2px dashed rgba(232, 122, 34, 0.3)', borderBottomLeftRadius: '20px' }} />
              </div>
            </motion.div>

            {/* Card 2: Master Report Processor */}
            <motion.div 
              ref={reportsCardRef}
              whileHover={{ y: -4, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.08)' }}
              className="glass-card home-card"
              style={{
                background: 'white', borderRadius: '24px', 
                borderLeft: '6px solid var(--accent)', position: 'relative', overflow: 'hidden',
                display: 'flex', justifyContent: 'space-between'
              }}
            >
              <div style={{ maxWidth: '600px', position: 'relative', zIndex: 2 }}>
                <div style={{ background: 'var(--accent)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', boxShadow: '0 4px 15px rgba(30, 41, 59, 0.3)' }}>
                  <Database color="white" size={24} />
                </div>
                <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)', marginBottom: '0.75rem', letterSpacing: '-0.5px' }}><span style={{ color: 'var(--primary)', fontWeight: 900, marginRight: '12px' }}>02.</span>Master Report Processor</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '2rem' }}>
                  Automate your quarterly MIS reporting. Upload raw Zoho CRM exports and instantly generate finished, formula-complete Excel workbooks.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <button onClick={() => navigate('/master-report')} className="btn-premium" style={{ background: 'var(--accent)', padding: '10px 20px', fontSize: '0.9rem', boxShadow: '0 4px 15px rgba(30, 41, 59, 0.3)' }}>
                    Access Tool <ArrowRight size={16} />
                  </button>
                  <span onClick={() => setShowReportsInfo(!showReportsInfo)} style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Learn More <ArrowRight size={14} style={{ transform: showReportsInfo ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                  </span>
                </div>

                {showReportsInfo && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div>
                        <h5 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Database size={14} color="var(--accent)" /> Data Extraction
                        </h5>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                          Upload raw exports from Zoho CRM (Leads, Meetings, Deals). The system automatically cleans, maps, and standardizes all the unstructured data points required for your reporting periods.
                        </p>
                      </div>
                      <div>
                        <h5 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={14} color="var(--accent)" /> Automated Generation
                        </h5>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                          Instantly generate finished, formula-complete Excel workbooks including calculated metrics, conversion rates, and executive summary dashboards. Ready for distribution without manual manipulation.
                        </p>
                      </div>
                    </div>
                    <div style={{ background: '#F0FDF4', color: '#166534', padding: '12px 16px', borderRadius: '8px', fontSize: '0.85rem', marginTop: '1.5rem', border: '1px solid #86EFAC', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '1.2rem' }}>💡</span>
                      <p style={{ margin: 0, lineHeight: 1.5 }}><strong>Time Saved:</strong> This tool replaces hours of manual Excel work (VLOOKUPs, Pivot Tables) with a single click, ensuring 100% accurate, boardroom-ready reports.</p>
                    </div>
                  </motion.div>
                )}
              </div>
              
              {/* Decorative Graphic for Reports */}
              <div className="home-card-art" style={{ position: 'relative', width: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#F1F5F9', color: 'var(--accent)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '1px' }}>
                  REPORTING
                </div>
                
                <div style={{ position: 'relative' }}>
                   {/* Fake Excel block */}
                   <div style={{ position: 'absolute', right: '10px', top: '-10px', background: '#f8fafc', width: '60px', height: '70px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                   <div style={{ position: 'absolute', right: '5px', top: '-5px', background: '#f1f5f9', width: '60px', height: '70px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                   
                   <div style={{ position: 'relative', background: 'white', padding: '24px', borderRadius: '24px', boxShadow: '0 15px 35px rgba(30, 41, 59, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(30, 41, 59, 0.05)' }}>
                     <div style={{ background: '#10b981', borderRadius: '8px', padding: '10px' }}>
                        <span style={{ color: 'white', fontWeight: 900, fontSize: '1.2rem', fontFamily: 'sans-serif' }}>X</span>
                     </div>
                   </div>
                   
                   {/* Fake Chart block */}
                   <div style={{ position: 'absolute', right: '-25px', bottom: '10px', background: 'white', padding: '12px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', display: 'flex', gap: '4px', alignItems: 'flex-end', height: '40px' }}>
                     <div style={{ width: '6px', height: '12px', background: 'var(--primary)', borderRadius: '2px' }} />
                     <div style={{ width: '6px', height: '24px', background: 'var(--primary)', borderRadius: '2px' }} />
                     <div style={{ width: '6px', height: '18px', background: 'var(--primary)', borderRadius: '2px' }} />
                   </div>
                </div>
                {/* Dotted curve connecting them */}
                <div style={{ position: 'absolute', bottom: '40px', right: '10px', width: '80px', height: '60px', borderBottom: '2px dashed rgba(30, 41, 59, 0.2)', borderRight: '2px dashed rgba(30, 41, 59, 0.2)', borderBottomRightRadius: '20px' }} />
              </div>
            </motion.div>

          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer style={{ 
        marginTop: 'auto', padding: '2rem var(--gutter)', 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
        borderTop: '1px solid var(--border)', background: 'transparent'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
           <div style={{ width: '30px', height: '2px', background: 'var(--primary)' }} />
           <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '2px' }}>CAPITABEL AUTOMATION HUB</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '16px', height: '2px', background: 'var(--text-muted)' }} />
          <div style={{ width: '8px', height: '2px', background: 'var(--primary)' }} />
        </div>
      </footer>
    </div>
  );
};

export default Home;
