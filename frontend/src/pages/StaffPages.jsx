import { useEffect, useState } from "react";
import { ArrowRight, Bell, BriefcaseBusiness, CheckCircle2, Plus, Send, Users } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { Button, EmptyState, Field, MetricCard, PageHeading, Panel, StatusMessage } from "../components.jsx";
import { formatDate, useRemote } from "../useRemote.js";

// Display cohort-level placement progress for an officer or administrator.
export function StaffDashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "administrator";
  const { data, loading, error, refresh } = useRemote("/officer/cohorts");
  const [dashboard, setDashboard] = useState([]);
  const [summary, setSummary] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [notices, setNotices] = useState([]);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const cohorts = data?.cohorts || [];

  // Load cohort totals and current notice list for this user's permitted scope.
  useEffect(() => {
    Promise.all([api("/officer/dashboard"), api("/officer/notifications")]).then(([stats, noticeData]) => {
      setDashboard(stats.cohorts || []); setNotices(noticeData.notifications || []);
    }).catch((reason) => setProblem(reason.message));
  }, []);

  // Load the selected cohort's student list and summary counts.
  useEffect(() => {
    if (!selectedId) { setStudents([]); setSummary(null); return; }
    Promise.all([api(`/officer/cohorts/${selectedId}/students`), api(`/officer/reports/summary?cohortId=${selectedId}`)])
      .then(([studentData, reportData]) => { setStudents(studentData.students || []); setSummary(reportData.summary); })
      .catch((reason) => setProblem(reason.message));
  }, [selectedId]);

  // Publish a notice to the selected cohort, or globally for administrators.
  async function publishNotice(event) {
    event.preventDefault(); setBusy(true); setProblem(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const cohortId = form.get("cohortId") || selectedId || null;
    try {
      await api("/officer/notifications", { method: "POST", body: { title: form.get("title"), body: form.get("body"), cohortId } });
      setMessage("Notification published."); event.currentTarget.reset();
      const updated = await api("/officer/notifications"); setNotices(updated.notifications || []);
    } catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  // Administrators can assign an existing student to a managed cohort.
  async function updateStudentCohort(studentId, cohortId) {
    setProblem("");
    try { await api(`/officer/students/${studentId}/cohort`, { method: "PATCH", body: { cohortId: cohortId || null } }); setMessage("Student cohort assignment updated."); }
    catch (reason) { setProblem(reason.message); }
  }

  return <>
    <PageHeading title={isAdmin ? "Placement administration" : "Placement workspace"} subtitle="Review cohort progress and share relevant placement updates." art="phone"/>
    <StatusMessage tone="error">{error || problem}</StatusMessage><StatusMessage tone="success">{message}</StatusMessage>
    <div className="metric-grid"><MetricCard label="Your cohorts" value={cohorts.length} caption="assigned and active" icon={BriefcaseBusiness} color="violet"/><MetricCard label="Students" value={dashboard.reduce((sum, cohort) => sum + Number(cohort.students || 0), 0)} caption="in your cohort scope" icon={Users} color="blue"/><MetricCard label="Ready evidence" value={dashboard.reduce((sum, cohort) => sum + Number(cohort.studentsWithReadiness || 0), 0)} caption="students with a readiness snapshot" icon={CheckCircle2} color="green"/><MetricCard label="Published notices" value={notices.filter((item) => item.isPublished).length} caption="visible in your scope" icon={Bell} color="orange"/></div>
    <div className="staff-grid"><Panel title="Cohort overview" subtitle="Select a cohort to review its student list and summary report."><div className="field"><span>Choose cohort</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Select a cohort</option>{cohorts.map((cohort) => <option value={cohort.id} key={cohort.id}>{cohort.name} {cohort.academicYear ? `· ${cohort.academicYear}` : ""}</option>)}</select></div>{loading ? <p>Loading cohorts…</p> : dashboard.length ? <div className="staff-cohort-list">{dashboard.map((cohort) => <button className={selectedId === cohort.cohortId ? "staff-cohort active" : "staff-cohort"} onClick={() => setSelectedId(cohort.cohortId)} key={cohort.cohortId}><span><strong>{cohort.cohort}</strong><small>{cohort.students} students · {cohort.studentsWithReadiness} readiness summaries</small></span><ArrowRight size={17}/></button>)}</div> : <EmptyState icon={BriefcaseBusiness} title="No cohorts in this scope">An administrator can create a cohort and assign an officer.</EmptyState>}</Panel><Panel title="Cohort summary" subtitle={selectedId ? "Readiness information for the selected cohort." : "Select a cohort to show its summary."}>{summary ? <div className="summary-stats"><div><strong>{summary.students}</strong><span>Students</span></div><div><strong>{summary.completeReadiness}</strong><span>Complete readiness</span></div><div><strong>{summary.averageReadiness ?? "—"}{summary.averageReadiness === null ? "" : "%"}</strong><span>Average readiness</span></div><div><strong>{summary.studentsWithResume}</strong><span>With resume activity</span></div></div> : <EmptyState icon={Users} title="No cohort selected">Choose one above to review summary metrics.</EmptyState>}</Panel></div>
    {selectedId && <Panel title="Students in this cohort" subtitle="Placement officers can review cohort-level data. Resume files remain private to students.">{students.length ? <div className="table-wrap"><table><thead><tr><th>Student</th><th>Email</th><th>Course</th><th>Target role</th><th>Readiness</th>{isAdmin && <th>Cohort assignment</th>}</tr></thead><tbody>{students.map((student) => <tr key={student.id}><td>{student.fullName}</td><td>{student.email}</td><td>{student.course || "—"}</td><td>{student.targetRole || "—"}</td><td>{student.readinessScore ?? "—"}{student.readinessScore === null ? "" : "%"}</td>{isAdmin && <td><select defaultValue={selectedId} onChange={(event) => updateStudentCohort(student.id, event.target.value)}><option value={selectedId}>{cohorts.find((item) => item.id === selectedId)?.name}</option><option value="">Unassign</option></select></td>}</tr>)}</tbody></table></div> : <EmptyState icon={Users} title="No students assigned yet">Students appear after the administrator assigns them to this cohort.</EmptyState>}</Panel>}
    <div className="staff-grid"><Panel title="Publish a notification" subtitle={isAdmin ? "Choose a cohort or leave it blank to send institution-wide." : "This notice will be delivered to your selected cohort."}><form onSubmit={publishNotice}><Field label="Title"><input name="title" maxLength="160" required placeholder="Placement update"/></Field>{isAdmin && <Field label="Delivery group"><select name="cohortId" defaultValue=""><option value="">All students (administrator only)</option>{cohorts.map((cohort) => <option value={cohort.id} key={cohort.id}>{cohort.name}</option>)}</select></Field>}<Field label="Message"><textarea name="body" rows="4" required maxLength="5000" placeholder="Share an update with students…"/></Field><Button type="submit" disabled={busy}><Send size={17}/>{busy ? "Publishing…" : "Publish notification"}</Button></form></Panel><Panel title="Recent notifications" subtitle="Notices you have created or that belong to assigned cohorts.">{notices.slice(0, 5).length ? <div className="notice-list">{notices.slice(0, 5).map((notice) => <article className="notice-row" key={notice.id}><span className="feature-icon tone-violet"><Bell size={19}/></span><div><strong>{notice.title}</strong><small>{notice.cohort || "Institution-wide"} · {formatDate(notice.publishedAt)}</small></div></article>)}</div> : <EmptyState icon={Bell} title="No notices yet">Publish a cohort update when you are ready.</EmptyState>}</Panel></div>
    {isAdmin && <AdminTools cohorts={cohorts} onCreated={refresh} setMessage={setMessage} setProblem={setProblem}/>}
  </>;
}

// Let administrators create cohorts and staff accounts, then assign officers.
function AdminTools({ cohorts, onCreated, setMessage, setProblem }) {
  const [busy, setBusy] = useState(false);
  const [officers, setOfficers] = useState([]);
  const [cohortId, setCohortId] = useState("");
  // Read officers assigned to cohorts, because the backend exposes them through each cohort.
  useEffect(() => {
    if (!cohorts.length) return;
    Promise.all(cohorts.map((cohort) => api(`/officer/cohorts/${cohort.id}/officers`)))
      .then((results) => {
        const unique = new Map();
        results.forEach((result) => (result.officers || []).forEach((officer) => unique.set(officer.id, officer)));
        setOfficers([...unique.values()]);
      })
      .catch(() => {});
  }, [cohorts]);

  // Create a new cohort from the name and optional academic year.
  async function createCohort(event) {
    event.preventDefault(); setBusy(true); setProblem(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try { await api("/officer/cohorts", { method: "POST", body: { name: form.get("name"), academicYear: form.get("academicYear") } }); event.currentTarget.reset(); setMessage("Cohort created."); await onCreated(); }
    catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  // Create a placement officer account using a temporary password for first sign-in.
  async function createOfficer(event) {
    event.preventDefault(); setBusy(true); setProblem(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try { const result = await api("/officer/users", { method: "POST", body: { fullName: form.get("fullName"), email: form.get("email"), role: "placement_officer", temporaryPassword: form.get("temporaryPassword") } }); setOfficers((items) => [...items, result.user]); event.currentTarget.reset(); setMessage("Placement officer account created."); }
    catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  // Give an active placement officer access to the currently selected cohort.
  async function assignOfficer(event) {
    event.preventDefault(); setBusy(true); setProblem(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await api(`/officer/officers/${form.get("officerId")}/cohorts`, { method: "POST", body: { cohortId: form.get("cohortId") } });
      setMessage("Officer assigned to the cohort.");
      const results = await Promise.all(cohorts.map((item) => api(`/officer/cohorts/${item.id}/officers`)));
      const unique = new Map();
      results.forEach((result) => (result.officers || []).forEach((officer) => unique.set(officer.id, officer)));
      setOfficers([...unique.values()]);
    }
    catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  return <Panel title="Administrator tools" subtitle="Set up cohorts and placement officer access."><div className="admin-tools-grid"><form onSubmit={createCohort}><h3><Plus size={18}/> Create cohort</h3><Field label="Cohort name"><input name="name" required maxLength="120" placeholder="2027 Computer Science"/></Field><Field label="Academic year"><input name="academicYear" maxLength="20" placeholder="2026–2027"/></Field><Button type="submit" disabled={busy}>Create cohort</Button></form><form onSubmit={createOfficer}><h3><Users size={18}/> Create placement officer</h3><Field label="Full name"><input name="fullName" required maxLength="120"/></Field><Field label="Email"><input name="email" type="email" required/></Field><Field label="Temporary password"><input name="temporaryPassword" type="password" minLength="12" required/><small>Share it with the officer through a private channel.</small></Field><Button type="submit" disabled={busy}>Create officer</Button></form><form onSubmit={assignOfficer}><h3><BriefcaseBusiness size={18}/> Assign officer</h3><Field label="Officer"><select name="officerId" required defaultValue=""><option value="" disabled>Choose an officer</option>{officers.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.email}</option>)}</select></Field><Field label="Cohort"><select name="cohortId" required value={cohortId} onChange={(event) => setCohortId(event.target.value)}><option value="" disabled>Choose a cohort</option>{cohorts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Button type="submit" disabled={busy}>Assign access</Button></form></div></Panel>;
}
