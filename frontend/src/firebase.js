import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Leads & Meetings — its own dedicated Firebase project, under a separate
// account. No sign-up exists anywhere for this tool; accounts are created
// manually in this project's own Firebase Console, which is the entire
// access-control mechanism (a separate project's user list, not a
// same-project email allowlist).
const leadsConfig = {
  apiKey: "AIzaSyD-AoR7WT1AK2T7VYeAdgbb-pA-uwNXULU",
  authDomain: "capitabel--leads-meetings-sync.firebaseapp.com",
  projectId: "capitabel--leads-meetings-sync",
  storageBucket: "capitabel--leads-meetings-sync.firebasestorage.app",
  messagingSenderId: "137598849037",
  appId: "1:137598849037:web:4e3d795519673047dac544",
  measurementId: "G-VBKRK31NP3"
};

// Master Report Processor — its own dedicated Firebase project, fully
// separate from Leads & Meetings' project. Open sign-up is fine here since
// this tool never touches live Zoho data.
const masterReportConfig = {
  apiKey: "AIzaSyAbouqGgPTBgshdi2ZiDe5DnrpnOMwd4S4",
  authDomain: "capitabel-automation-hub-c8031.firebaseapp.com",
  projectId: "capitabel-automation-hub-c8031",
  storageBucket: "capitabel-automation-hub-c8031.firebasestorage.app",
  messagingSenderId: "155565151271",
  appId: "1:155565151271:web:84c6fc12ce6ca1e6002a02",
  measurementId: "G-8N2X4HPWZ7"
};

// Firebase requires a unique name for each app instance beyond the first.
const leadsApp = initializeApp(leadsConfig, "leads");
const masterReportApp = initializeApp(masterReportConfig, "masterReport");

const authLeads = getAuth(leadsApp);
const authMasterReport = getAuth(masterReportApp);

const analyticsLeads = typeof window !== 'undefined' ? getAnalytics(leadsApp) : null;

export { leadsApp, masterReportApp, authLeads, authMasterReport, analyticsLeads };
