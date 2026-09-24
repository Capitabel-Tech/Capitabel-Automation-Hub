import { useState } from 'react'
import TemplatePanel from '../features/master-report/components/TemplatePanel'
import MasterReportPanel from '../features/master-report/components/MasterReportPanel'
import '../features/master-report/styles.css'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut } from 'lucide-react'
import { authMasterReport as auth } from '../firebase'
import { logEvent } from '../activityLog'

export default function MasterReportPage() {
  const navigate = useNavigate()
  const [showEmailPopover, setShowEmailPopover] = useState(false)

  const handleLogout = async () => {
    // Log while still authenticated - the token becomes invalid the moment
    // signOut() completes, so this must happen just before it.
    if (auth.currentUser) {
      const idToken = await auth.currentUser.getIdToken()
      await logEvent({ tool: 'master_report', action: 'LOGOUT', status: 'success', idToken })
    }
    await auth.signOut()
    navigate('/')
  }
  return (
    <div className="app-dashboard">


      <main className="main-workspace" style={{ padding: '48px var(--gutter)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
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
                Master Report <span style={{ fontWeight: 300, color: 'var(--text-muted)' }}>Processor</span>
              </h1>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', position: 'relative' }}
              onClick={() => setShowEmailPopover(prev => !prev)}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#E87A22', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.9rem' }}>
                {auth.currentUser?.displayName?.charAt(0).toUpperCase() || auth.currentUser?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                {auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'User'}
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
        <section>
          <h3 className="section-label">Process the Master Report</h3>
          <MasterReportPanel />
        </section>

        <div style={{ margin: '4rem 0', borderTop: '2px solid var(--border)' }}></div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          <section>
            <h3 className="section-label">1. Manage Deals template</h3>
            <TemplatePanel reportType="deals" reportLabel="Deals" />
          </section>

          <section>
            <h3 className="section-label">2. Manage Pipeline template</h3>
            <TemplatePanel reportType="pipeline_high" reportLabel="Pipeline" />
          </section>

          <section>
            <h3 className="section-label">3. Manage Pipeline (&lt;20%) template</h3>
            <TemplatePanel reportType="pipeline_low" reportLabel="Pipeline (<20%)" />
          </section>

          <section>
            <h3 className="section-label">4. Manage Leads template</h3>
            <TemplatePanel reportType="leads" reportLabel="Leads" />
          </section>

          <section>
            <h3 className="section-label">5. Manage Meetings template</h3>
            <TemplatePanel reportType="meetings" reportLabel="Meetings" />
          </section>
        </div>
      </main>
    </div>
  )
}
