import { useEffect, useState } from "react";
import { Activity, Archive, BookOpen, Check, ChevronRight, ClipboardList, Database, FileQuestion, Plus, Users } from "lucide-react";
import { api } from "../api.js";
import { Button, EmptyState, Field, MetricCard, PageHeading, Panel, StatusMessage } from "../components.jsx";
import { formatDate, useRemote } from "../useRemote.js";

// Keep the editable content types aligned with the administrator API catalog.
const catalogTypes = {
  roles: { title: "Career roles", path: "/admin/catalog/roles", key: "roles", addPath: "/admin/catalog/roles", itemPath: (item) => `/admin/catalog/roles/${item.id}`, fields: [["name", "Role name"], ["description", "Description", "textarea"]], payload: (form) => ({ name: form.get("name"), description: form.get("description") }) },
  skills: { title: "Skills", path: "/admin/catalog/skills", key: "skills", addPath: "/admin/catalog/skills", itemPath: (item) => `/admin/catalog/skills/${item.id}`, fields: [["name", "Skill name"], ["category", "Category"]], payload: (form) => ({ name: form.get("name"), category: form.get("category") }) },
  resources: { title: "Learning resources", path: "/admin/catalog/resources", key: "resources", addPath: "/admin/catalog/resources", itemPath: (item) => `/admin/catalog/resources/${item.id}`, fields: [["title", "Title"], ["description", "Description", "textarea"], ["url", "Secure resource URL"], ["resourceType", "Resource type"], ["difficulty", "Difficulty"]], payload: (form) => ({ title: form.get("title"), description: form.get("description"), url: form.get("url"), resourceType: form.get("resourceType"), difficulty: form.get("difficulty") }) },
  questions: { title: "Interview questions", path: "/admin/catalog/interview-questions", key: "questions", addPath: "/admin/catalog/interview-questions", itemPath: (item) => `/admin/catalog/interview-questions/${item.id}`, fields: [["question", "Question", "textarea"], ["category", "Category"], ["difficulty", "Difficulty"]], payload: (form) => ({ question: form.get("question"), category: form.get("category"), difficulty: form.get("difficulty") }) },
  coding: { title: "Coding practice", path: "/admin/catalog/coding-problems", key: "problems", addPath: "/admin/catalog/coding-problems", itemPath: (item) => `/admin/catalog/coding-problems/${item.id}`, fields: [["title", "Problem title"], ["prompt", "Problem instructions", "textarea"], ["difficulty", "Difficulty"], ["problemType", "Answer style"], ["options", "Answer choices (one per line)", "textarea"], ["correctOptionIndex", "Correct choice number (starting at 0)"], ["expectedAnswer", "Expected answer"], ["explanation", "Explanation", "textarea"]], payload: (form) => ({ title: form.get("title"), prompt: form.get("prompt"), difficulty: form.get("difficulty"), problemType: form.get("problemType"), options: String(form.get("options") || "").split("\n").map((option) => option.trim()).filter(Boolean), correctOptionIndex: Number(form.get("correctOptionIndex") || 0), expectedAnswer: form.get("expectedAnswer"), explanation: form.get("explanation") }) },
  aptitude: { title: "Aptitude tests", path: "/admin/catalog/aptitude-tests", key: "tests", addPath: "/admin/catalog/aptitude-tests", itemPath: (item) => `/admin/catalog/aptitude-tests/${item.id}`, fields: [["title", "Test title"], ["description", "Description", "textarea"], ["companyName", "Company name"]], payload: (form) => ({ title: form.get("title"), description: form.get("description"), companyName: form.get("companyName") }) },
};

// Let administrators add, review, and retire content that already has API support.
export function AdminContentPage() {
  const [type, setType] = useState("roles");
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedTest, setSelectedTest] = useState("");
  const [testQuestions, setTestQuestions] = useState([]);
  const [codingProblemType, setCodingProblemType] = useState("short_answer");
  const config = catalogTypes[type];

  // Fetch the selected catalog after switching its tab or saving a change.
  async function loadItems() {
    setError("");
    try { const result = await api(config.path); setItems(result[config.key] || []); }
    catch (reason) { setError(reason.message); }
  }
  useEffect(() => { loadItems(); setSelectedTest(""); setTestQuestions([]); }, [type]);

  // Add a new role, resource, or practice item using its matching backend route.
  async function addItem(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try { await api(config.addPath, { method: "POST", body: config.payload(form) }); event.currentTarget.reset(); setMessage(`${config.title.slice(0, -1)} added.`); await loadItems(); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  // Retire or reactivate content without removing its history from student records.
  async function toggleItem(item) {
    setBusy(true); setError(""); setMessage("");
    try {
      const payload = type === "roles" ? { name: item.name, description: item.description || "", isActive: !item.isActive }
        : type === "skills" ? { name: item.name, category: item.category || "general", isActive: !item.isActive }
        : type === "resources" ? { title: item.title, description: item.description || "", url: item.url, skillId: item.skillId || null, resourceType: item.resourceType || "article", difficulty: item.difficulty || "beginner", isActive: !item.isActive }
        : type === "questions" ? { question: item.question, category: item.category || "general", difficulty: item.difficulty || "beginner", isActive: !item.isActive }
        : type === "aptitude" ? { title: item.title, description: item.description || "", companyName: item.companyName || "", isActive: !item.isActive }
        : { isActive: !item.isActive };
      await api(config.itemPath(item), { method: "PATCH", body: payload });
      setMessage("Catalog status updated."); await loadItems();
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  // Load questions for a selected aptitude test when the question route exists.
  async function loadTestQuestions(testId) {
    setSelectedTest(testId); setTestQuestions([]);
    if (!testId) return;
    try { const result = await api(`/admin/catalog/aptitude-tests/${testId}/questions`); setTestQuestions(result.questions || []); }
    catch (reason) { setError(reason.message); }
  }

  // Add a multiple-choice question through the administrator question endpoint.
  async function addTestQuestion(event) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api(`/admin/catalog/aptitude-tests/${selectedTest}/questions`, { method: "POST", body: { question: form.get("question"), options: String(form.get("options")).split("\n").map((value) => value.trim()).filter(Boolean), correctOptionIndex: Number(form.get("correctOptionIndex")), explanation: form.get("explanation"), displayOrder: Number(form.get("displayOrder") || testQuestions.length + 1) } });
      event.currentTarget.reset(); await loadTestQuestions(selectedTest); setMessage("Question added to the test.");
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  // Retire or restore an aptitude question while preserving prior attempts.
  async function toggleTestQuestion(question) {
    setBusy(true); setError("");
    try { await api(`/admin/catalog/aptitude-questions/${question.id}`, { method: "PATCH", body: { isActive: !question.isActive } }); await loadTestQuestions(selectedTest); setMessage("Question status updated."); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeading title="Content & question management" subtitle="Manage the learning and practice material students can access." art="study"/>
    <StatusMessage tone="error">{error}</StatusMessage><StatusMessage tone="success">{message}</StatusMessage>
    <Panel title="Choose a catalog" subtitle="These lists are provided by the administrator content API."><div className="admin-tabs">{Object.entries(catalogTypes).map(([key, item]) => <button key={key} className={type === key ? "filter-chip active" : "filter-chip"} onClick={() => setType(key)}>{item.title}</button>)}</div></Panel>
    <div className="two-column-layout"><Panel title={`Add ${config.title.toLowerCase()}`} subtitle="New items become available in the connected student screens."><form onSubmit={addItem} className="admin-form">{config.fields.map(([name, label, kind]) => { const optional = ["description", "companyName", "expectedAnswer", "explanation", "correctOptionIndex", "options"].includes(name); const required = !optional || (type === "coding" && name === "expectedAnswer" && codingProblemType === "short_answer") || (type === "coding" && ["options", "correctOptionIndex"].includes(name) && codingProblemType === "multiple_choice"); return <Field label={label} key={name} className={kind === "textarea" ? "wide" : ""}>{kind === "textarea" ? <textarea name={name} rows="3" required={required}/> : name === "problemType" ? <select name={name} value={codingProblemType} onChange={(event) => setCodingProblemType(event.target.value)}><option value="short_answer">Short answer</option><option value="multiple_choice">Multiple choice</option></select> : <input name={name} required={required} type={name === "url" ? "url" : name === "correctOptionIndex" ? "number" : "text"} min={name === "correctOptionIndex" ? "0" : undefined} placeholder={name === "url" ? "https://…" : ""}/>}</Field>; })}<Button type="submit" disabled={busy}><Plus size={17}/>{busy ? "Saving…" : "Add to catalog"}</Button></form></Panel>
      <Panel title={`${config.title} (${items.length})`} subtitle="Existing items can be hidden or restored without deleting their history.">{items.length ? <div className="admin-item-list">{items.map((item) => <article className="admin-item" key={item.id}><span className="feature-icon tone-violet"><Database size={19}/></span><div><strong>{item.title || item.name || item.question}</strong><small>{item.category || item.difficulty || item.description || item.prompt || "Catalog item"}</small></div><span className={item.isActive ? "status-chip badge-green" : "status-chip badge-red"}>{item.isActive ? "Available" : "Hidden"}</span><Button variant="outline" className="button-small" disabled={busy} onClick={() => toggleItem(item)}>{item.isActive ? "Hide" : "Restore"}</Button></article>)}</div> : <EmptyState icon={Database} title="This catalog is empty">Add its first item with the form.</EmptyState>}</Panel></div>
    {type === "aptitude" && <Panel title="Test questions" subtitle="Questions are saved on the selected aptitude test."><Field label="Aptitude test"><select value={selectedTest} onChange={(event) => loadTestQuestions(event.target.value)}><option value="">Choose a test</option>{items.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></Field>{selectedTest && <div className="two-column-layout"><form onSubmit={addTestQuestion} className="admin-form"><Field label="Question"><textarea name="question" rows="3" required/></Field><Field label="Answer options (one per line)"><textarea name="options" rows="4" required/></Field><Field label="Correct option number (starting at 0)"><input name="correctOptionIndex" type="number" min="0" required/></Field><Field label="Explanation"><textarea name="explanation" rows="2"/></Field><Field label="Display order"><input name="displayOrder" type="number" min="1" placeholder={String(testQuestions.length + 1)}/></Field><Button type="submit" disabled={busy}><Plus size={16}/>Add question</Button></form><div className="admin-item-list">{testQuestions.map((question) => <article className="admin-item" key={question.id}><span className="feature-icon tone-orange"><FileQuestion size={19}/></span><div><strong>{question.question}</strong><small>{question.options?.length || 0} options · answer {Number(question.correctOptionIndex) + 1}</small></div><span className={question.isActive ? "status-chip badge-green" : "status-chip badge-red"}>{question.isActive ? "Available" : "Hidden"}</span><Button className="button-small" variant="outline" disabled={busy} onClick={() => toggleTestQuestion(question)}>{question.isActive ? "Hide" : "Restore"}</Button></article>)}</div></div>}</Panel>}
  </>;
}

// Let administrators manage cohorts and view the students returned by the API.
export function AdminCohortsPage() {
  const { data, loading, error, refresh } = useRemote("/officer/cohorts");
  const cohorts = data?.cohorts || [];
  const [selected, setSelected] = useState("");
  const [students, setStudents] = useState([]);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  // Load only the selected cohort's student list from the officer API.
  useEffect(() => { if (selected) api(`/officer/cohorts/${selected}/students`).then((result) => setStudents(result.students || [])).catch((reason) => setProblem(reason.message)); else setStudents([]); }, [selected]);

  // Create a cohort with the backend-supported name and academic-year fields.
  async function createCohort(event) {
    event.preventDefault(); setBusy(true); setProblem("");
    const form = new FormData(event.currentTarget);
    try { await api("/officer/cohorts", { method: "POST", body: { name: form.get("name"), academicYear: form.get("academicYear") } }); event.currentTarget.reset(); setMessage("Cohort created."); await refresh(); }
    catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  // Change a cohort's active status using the administrator update route.
  async function changeStatus(cohort) {
    setProblem("");
    try { await api(`/officer/cohorts/${cohort.id}`, { method: "PATCH", body: { name: cohort.name, academicYear: cohort.academicYear || "", isActive: !cohort.isActive } }); setMessage("Cohort status updated."); await refresh(); }
    catch (reason) { setProblem(reason.message); }
  }

  // Assign or remove a student's cohort using the existing staff assignment route.
  async function changeStudentCohort(studentId, cohortId) {
    try { await api(`/officer/students/${studentId}/cohort`, { method: "PATCH", body: { cohortId: cohortId || null } }); setMessage("Student cohort updated."); const result = await api(`/officer/cohorts/${selected}/students`); setStudents(result.students || []); }
    catch (reason) { setProblem(reason.message); }
  }

  return <>
    <PageHeading title="Cohort management" subtitle="Create cohorts, review students, and keep group assignments up to date." art="study"/>
    <StatusMessage tone="error">{error || problem}</StatusMessage><StatusMessage tone="success">{message}</StatusMessage>
    <div className="two-column-layout"><Panel title="Create cohort" subtitle="Cohorts help placement staff share updates with the right students."><form onSubmit={createCohort}><Field label="Cohort name"><input name="name" required maxLength="120" placeholder="2027 Computer Science"/></Field><Field label="Academic year"><input name="academicYear" maxLength="20" placeholder="2026–2027"/></Field><Button type="submit" disabled={busy}><Plus size={17}/>Create cohort</Button></form></Panel><Panel title="Cohort list" subtitle={loading ? "Loading cohorts…" : `${cohorts.length} cohorts in your workspace.`}>{cohorts.length ? <div className="admin-item-list">{cohorts.map((cohort) => <article className="admin-item" key={cohort.id}><span className="feature-icon tone-violet"><Users size={19}/></span><button className="plain-select" onClick={() => setSelected(cohort.id)}><strong>{cohort.name}</strong><small>{cohort.academicYear || "No academic year"}</small></button><span className={cohort.isActive === false ? "status-chip badge-red" : "status-chip badge-green"}>{cohort.isActive === false ? "Inactive" : "Active"}</span><Button className="button-small" variant="outline" onClick={() => changeStatus(cohort)}>{cohort.isActive === false ? "Activate" : "Pause"}</Button></article>)}</div> : <EmptyState icon={Users} title="No cohorts yet">Create a cohort to start managing student groups.</EmptyState>}</Panel></div>
    {selected && <Panel title={`${cohorts.find((item) => item.id === selected)?.name || "Cohort"} students`} subtitle="Student details shown here come from the cohort roster endpoint.">{students.length ? <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Course</th><th>Target role</th><th>Readiness</th><th>Move cohort</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td>{student.fullName}</td><td>{student.email}</td><td>{student.course || "—"}</td><td>{student.targetRole || "—"}</td><td>{student.readinessScore ?? "—"}{student.readinessScore == null ? "" : "%"}</td><td><select value={selected} onChange={(event) => changeStudentCohort(student.id, event.target.value)}><option value={selected}>Keep here</option><option value="">Unassign</option>{cohorts.filter((item) => item.id !== selected).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></td></tr>)}</tbody></table></div> : <EmptyState icon={Users} title="No students in this cohort">Students will appear here after they are assigned.</EmptyState>}</Panel>}
  </>;
}

// Display readiness formula history and let an administrator activate a new version.
export function AdminReadinessFormulaPage() {
  const { data, loading, error, refresh } = useRemote("/admin/readiness-formulas");
  const formulas = data?.formulas || [];
  const active = formulas.find((item) => item.isActive) || formulas[0];
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  // Store five category weights as percentages and send the API's decimal values.
  async function saveFormula(event) {
    event.preventDefault(); setBusy(true); setProblem(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const keys = ["resume", "skills", "interview", "coding", "aptitude"];
    const weights = Object.fromEntries(keys.map((key) => [key, Number(form.get(key)) / 100]));
    const versionNumber = Math.max(0, ...formulas.map((item) => Number(String(item.version).replace(/\D/g, "")) || 0)) + 1;
    try { await api(`/admin/readiness-formulas/v${versionNumber}`, { method: "PUT", body: { weights, minimumEvidence: { count: Number(form.get("minimumEvidence")) } } }); setMessage("A new readiness formula is now active."); await refresh(); }
    catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeading title="Readiness formula" subtitle="Review the active preparation score and create a versioned formula when needed." art="results"/>
    <StatusMessage tone="error">{error || problem}</StatusMessage><StatusMessage tone="success">{message}</StatusMessage>
    {loading ? <p>Loading formula history…</p> : <div className="two-column-layout"><Panel title={`Active formula · ${active?.version || "Not configured"}`} subtitle="The values below are read-only until a new version is saved.">{active ? <div className="formula-weight-list">{Object.entries(active.weights || {}).map(([key, value]) => <div key={key}><span>{key}</span><strong>{Math.round(Number(value) * 100)}%</strong><i><b style={{ width: `${Number(value) * 100}%` }}/></i></div>)}<p>Minimum categories with evidence: {active.minimumEvidence?.count ?? "—"}</p></div> : <EmptyState icon={Activity} title="No formula found">The backend has no configured readiness formula yet.</EmptyState>}</Panel><Panel title="Create next version" subtitle="Weights must total 100%. Older formula versions remain in the history."><form onSubmit={saveFormula} className="form-grid">{[["resume","Resume"],["skills","Skills"],["interview","Interview"],["coding","Coding"],["aptitude","Aptitude"]].map(([key,label]) => <Field label={`${label} weight (%)`} key={key}><input name={key} type="number" min="0" max="100" defaultValue={Math.round(Number(active?.weights?.[key] || 0) * 100)} required/></Field>)}<Field label="Minimum evidence categories"><input name="minimumEvidence" type="number" min="1" max="5" defaultValue={active?.minimumEvidence?.count || 3} required/></Field><Button type="submit" disabled={busy} className="wide">{busy ? "Saving…" : "Activate next version"}</Button></form></Panel></div>}
    <Panel title="Formula history" subtitle="Previously published versions are kept for transparent reporting.">{formulas.length ? <div className="admin-item-list">{formulas.map((item) => <article className="admin-item" key={item.version}><span className="feature-icon tone-green"><Activity size={18}/></span><div><strong>{item.version} {item.isActive && "· Active"}</strong><small>Evidence minimum: {item.minimumEvidence?.count ?? "—"} · {formatDate(item.createdAt)}</small></div>{item.isActive && <Check size={18}/>}</article>)}</div> : <EmptyState icon={Activity} title="No formula history">Formula versions will appear here when available.</EmptyState>}</Panel>
  </>;
}

// Show the administrator audit endpoint as a searchable recent activity table.
export function AdminAuditPage() {
  const { data, loading, error, refresh } = useRemote("/admin/audit?limit=100");
  const events = data?.events || [];
  const [query, setQuery] = useState("");
  const visible = events.filter((item) => `${item.action} ${item.entityType} ${item.actorId}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageHeading title="Audit log" subtitle="Review account, cohort, content, and readiness changes recorded by the system." art="study"/>
    <StatusMessage tone="error">{error}</StatusMessage>
    <Panel title="Recent system activity" subtitle={`${events.length} recent events returned by the administrator API.`} action={<Button variant="outline" className="button-small" onClick={refresh}><Activity size={16}/>Refresh</Button>}>
      <label className="search-field"><ClipboardList size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search action or record type"/></label>
      {loading ? <p>Loading audit events…</p> : visible.length ? <div className="table-wrap"><table><thead><tr><th>Action</th><th>Record type</th><th>Record ID</th><th>Details</th><th>When</th></tr></thead><tbody>{visible.map((event) => <tr key={event.id}><td><strong>{event.action}</strong></td><td>{event.entityType || "—"}</td><td className="audit-id">{event.entityId || "—"}</td><td>{JSON.stringify(event.details || {})}</td><td>{formatDate(event.createdAt)}</td></tr>)}</tbody></table></div> : <EmptyState icon={ClipboardList} title="No matching activity">Try a shorter search term or refresh the list.</EmptyState>}
    </Panel>
  </>;
}

// Let administrators create staff accounts using the API instead of a local mock.
export function AdminStaffPage() {
  const { data } = useRemote("/officer/cohorts");
  const cohorts = data?.cohorts || [];
  const [createdUser, setCreatedUser] = useState(null);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  // Create an administrator or placement officer account through the supported route.
  async function createStaff(event) {
    event.preventDefault(); setBusy(true); setProblem(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try { const result = await api("/officer/users", { method: "POST", body: { fullName: form.get("fullName"), email: form.get("email"), role: form.get("role"), temporaryPassword: form.get("temporaryPassword") } }); setCreatedUser(result.user); setMessage("Staff account created. Share the temporary password through a private channel."); event.currentTarget.reset(); }
    catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  // Give the newly created officer access to a cohort through its assignment route.
  async function assignCohort(event) {
    event.preventDefault(); setProblem("");
    const form = new FormData(event.currentTarget);
    try { await api(`/officer/officers/${createdUser.id}/cohorts`, { method: "POST", body: { cohortId: form.get("cohortId") } }); setMessage("The placement officer can now access this cohort."); }
    catch (reason) { setProblem(reason.message); }
  }

  // Request a one-time password reset token for the account created in this session.
  async function createResetToken() {
    setProblem("");
    try { const result = await api(`/officer/users/${createdUser.id}/password-reset`, { method: "POST", body: {} }); window.prompt("Copy this one-time token and share it privately. It expires in 30 minutes.", result.resetToken); }
    catch (reason) { setProblem(reason.message); }
  }

  return <>
    <PageHeading title="Staff accounts" subtitle="Create staff access and link a placement officer to a cohort." art="study"/>
    <StatusMessage tone="error">{problem}</StatusMessage><StatusMessage tone="success">{message}</StatusMessage>
    <div className="two-column-layout"><Panel title="Create staff account" subtitle="The backend supports account creation but does not provide a staff directory endpoint."><form onSubmit={createStaff}><Field label="Full name"><input name="fullName" required maxLength="120"/></Field><Field label="Email"><input name="email" type="email" required/></Field><Field label="Account type"><select name="role"><option value="placement_officer">Placement officer</option><option value="administrator">Administrator</option></select></Field><Field label="Temporary password" help="Use at least 12 characters and share it privately."><input name="temporaryPassword" type="password" minLength="12" required/></Field><Button type="submit" disabled={busy}><Plus size={17}/>{busy ? "Creating…" : "Create account"}</Button></form></Panel>
      <Panel title="Account actions" subtitle={createdUser ? `${createdUser.fullName} · ${createdUser.email}` : "Create an account to see supported follow-up actions."}>{createdUser ? <div className="admin-followups">{createdUser.role === "placement_officer" && <form onSubmit={assignCohort}><Field label="Assign to a cohort"><select name="cohortId" required><option value="">Choose cohort</option>{cohorts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Button type="submit">Assign cohort</Button></form>}<Button variant="outline" onClick={createResetToken}>Create reset token</Button><p className="muted small-note">Staff records cannot be searched or edited here because the backend has no staff-list endpoint.</p></div> : <EmptyState icon={Users} title="No new account yet">Create a staff account to enable its cohort and reset actions.</EmptyState>}</Panel></div>
  </>;
}
