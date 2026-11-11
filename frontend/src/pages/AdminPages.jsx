import { useEffect, useState } from "react";
import { Activity, Archive, ArrowRight, Bell, BookOpen, Check, ChevronRight, ClipboardList, Database, FileQuestion, Layers, Plus, Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import { api } from "../api.js";
import { Button, EmptyState, Field, MetricCard, PageHeading, Panel, StatusMessage } from "../components.jsx";
import { Link } from "react-router-dom";
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

// Bring the key administrative totals and latest system events together.
export function AdminOverviewPage() {
  const { data: dashboard, loading: statsLoading, error: statsError } = useRemote("/officer/dashboard");
  const { data: reportData, error: reportError } = useRemote("/officer/reports/summary");
  const { data: staffData, error: staffError } = useRemote("/officer/users");
  const { data: auditData, error: auditError } = useRemote("/admin/audit?limit=5");
  const { data: formulaData } = useRemote("/admin/readiness-formulas");
  const { data: noticeData } = useRemote("/officer/notifications");
  const { data: roleData } = useRemote("/admin/catalog/roles");
  const cohorts = dashboard?.cohorts || [];
  const totalStudents = Number(reportData?.summary?.students || 0);
  const averageReadiness = reportData?.summary?.averageReadiness ?? null;
  const activeFormula = (formulaData?.formulas || []).find((formula) => formula.isActive);
  const staff = staffData?.users || [];
  const recentActivity = auditData?.events || [];

  return <>
    <PageHeading eyebrow="ADMIN OVERVIEW" title="Welcome back, Admin" subtitle="A clear view of cohorts, learning content, and platform activity." art="results"/>
    <StatusMessage tone="error">{statsError || reportError || staffError || auditError}</StatusMessage>
    <div className="metric-grid admin-metrics">
      <MetricCard label="Cohorts" value={statsLoading ? "…" : cohorts.length} caption="managed groups" icon={Layers} color="violet"/>
      <MetricCard label="Students" value={reportData ? totalStudents.toLocaleString() : "…"} caption="across all cohorts" icon={Users} color="orange"/>
      <MetricCard label="Average readiness" value={averageReadiness == null ? "—" : `${averageReadiness}%`} caption="based on recorded scores" icon={Activity} color="green"/>
      <MetricCard label="Recent activity" value={recentActivity.length} caption="latest audit events" icon={ShieldCheck} color="blue"/>
    </div>
    <Panel title="Quick actions" subtitle="Jump straight to common administration tasks.">
      <div className="admin-quick-actions">
        <Link to="/app/admin/cohorts"><Users size={21}/>Create or manage cohorts<ArrowRight size={17}/></Link>
        <Link to="/app/admin/staff"><UserPlus size={21}/>Create staff account<ArrowRight size={17}/></Link>
        <Link to="/app/admin/content"><BookOpen size={21}/>Add learning content<ArrowRight size={17}/></Link>
        <Link to="/app/admin/readiness"><Activity size={21}/>Update readiness formula<ArrowRight size={17}/></Link>
      </div>
    </Panel>
    <div className="two-column-layout admin-overview-lower">
      <Panel title="Recent administrative activity" subtitle="Recent actions recorded by CareerPilot." action={<Link className="text-link" to="/app/admin/audit">View all <ArrowRight size={15}/></Link>}>
        {recentActivity.length ? <div className="admin-activity-list">{recentActivity.slice(0, 5).map((item) => <article key={item.id}><span className="feature-icon tone-violet"><Activity size={18}/></span><div><strong>{item.action.replace(/[._]/g, " ")}</strong><small>{item.entityType || "System"} · {formatDate(item.createdAt)}</small></div></article>)}</div> : <EmptyState icon={ClipboardList} title="No recent activity">Administrative actions will appear here when recorded.</EmptyState>}
      </Panel>
      <Panel title="System at a glance" subtitle="Current state of the main administration areas.">
        <div className="admin-glance-list">
          <Link to="/app/admin/content"><BookOpen size={20}/><span><strong>Content library</strong><small>{roleData?.roles?.length ?? 0} career roles available</small></span><span className="status-chip badge-green">Ready</span></Link>
          <Link to="/app/admin/readiness"><Activity size={20}/><span><strong>Readiness formula</strong><small>Active version {activeFormula?.version || "not set"}</small></span><span className="status-chip badge-green">{activeFormula ? "Active" : "Review"}</span></Link>
          <Link to="/app/staff/notifications"><Bell size={20}/><span><strong>Notifications</strong><small>{(noticeData?.notifications || []).filter((item) => item.isPublished && !item.archivedAt).length} published updates</small></span><ArrowRight size={16}/></Link>
          <div><Users size={20}/><span><strong>Staff access</strong><small>{staff.length} administrator and officer accounts</small></span><span className="status-chip badge-green">Managed</span></div>
        </div>
      </Panel>
    </div>
  </>;
}

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
  const [editingItem, setEditingItem] = useState(null);
  const config = catalogTypes[type];

  // Fetch the selected catalog after switching its tab or saving a change.
  async function loadItems() {
    setError("");
    try { const result = await api(config.path); setItems(result[config.key] || []); }
    catch (reason) { setError(reason.message); }
  }
  useEffect(() => { loadItems(); setSelectedTest(""); setTestQuestions([]); setEditingItem(null); }, [type]);

  // Add a new role, resource, or practice item using its matching backend route.
  async function addItem(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await api(editingItem ? config.itemPath(editingItem) : config.addPath, { method: editingItem ? "PATCH" : "POST", body: config.payload(form) });
      event.currentTarget.reset(); setMessage(editingItem ? "Catalog item updated." : `${config.title.slice(0, -1)} added.`); setEditingItem(null); await loadItems();
    }
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

  // Load an item's current values into the editor so administrators can revise it.
  function editItem(item) {
    setEditingItem(item);
    if (type === "coding") setCodingProblemType(item.problemType || "short_answer");
    window.requestAnimationFrame(() => document.getElementById("admin-catalog-form")?.scrollIntoView({ behavior: "smooth", block: "center" }));
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
    <PageHeading eyebrow="CONTENT LIBRARY" title="Manage learning content" subtitle="Create, edit, and organize roles, skills, resources, and practice content." art="study"/>
    <StatusMessage tone="error">{error}</StatusMessage><StatusMessage tone="success">{message}</StatusMessage>
    <Panel title="Choose a catalog" subtitle="These lists are provided by the administrator content API."><div className="admin-tabs">{Object.entries(catalogTypes).map(([key, item]) => <button key={key} className={type === key ? "filter-chip active" : "filter-chip"} onClick={() => setType(key)}>{item.title}</button>)}</div></Panel>
    <div className="two-column-layout"><Panel title={editingItem ? `Edit ${config.title.toLowerCase()}` : `Add ${config.title.toLowerCase()}`} subtitle="Changes are saved to the connected student content catalog."><form id="admin-catalog-form" key={`${type}-${editingItem?.id || "new"}`} onSubmit={addItem} className="admin-form">{config.fields.map(([name, label, kind]) => { const optional = ["description", "companyName", "expectedAnswer", "explanation", "correctOptionIndex", "options"].includes(name); const required = !optional || (type === "coding" && name === "expectedAnswer" && codingProblemType === "short_answer") || (type === "coding" && ["options", "correctOptionIndex"].includes(name) && codingProblemType === "multiple_choice"); const value = name === "options" && Array.isArray(editingItem?.options) ? editingItem.options.join("\n") : editingItem?.[name]; return <Field label={label} key={name} className={kind === "textarea" ? "wide" : ""}>{kind === "textarea" ? <textarea name={name} rows="3" required={required} defaultValue={value}/> : name === "problemType" ? <select name={name} value={codingProblemType} onChange={(event) => setCodingProblemType(event.target.value)}><option value="short_answer">Short answer</option><option value="multiple_choice">Multiple choice</option></select> : <input name={name} required={required} type={name === "url" ? "url" : name === "correctOptionIndex" ? "number" : "text"} min={name === "correctOptionIndex" ? "0" : undefined} placeholder={name === "url" ? "https://…" : ""} defaultValue={value}/>}</Field>; })}<div className="admin-form-actions"><Button type="submit" disabled={busy}><Plus size={17}/>{busy ? "Saving…" : editingItem ? "Save changes" : "Add to catalog"}</Button>{editingItem && <Button variant="outline" type="button" onClick={() => setEditingItem(null)}>Cancel edit</Button>}</div></form></Panel>
      <Panel title={`${config.title} (${items.length})`} subtitle="Edit, hide, or restore catalog content without deleting its history.">{items.length ? <div className="admin-item-list">{items.map((item) => <article className="admin-item" key={item.id}><span className="feature-icon tone-violet"><Database size={19}/></span><div><strong>{item.title || item.name || item.question}</strong><small>{item.category || item.difficulty || item.description || item.prompt || "Catalog item"}</small></div><span className={item.isActive ? "status-chip badge-green" : "status-chip badge-red"}>{item.isActive ? "Available" : "Hidden"}</span><Button variant="outline" className="button-small" disabled={busy} onClick={() => editItem(item)}>Edit</Button><Button variant="outline" className="button-small" disabled={busy} onClick={() => toggleItem(item)}>{item.isActive ? "Hide" : "Restore"}</Button></article>)}</div> : <EmptyState icon={Database} title="This catalog is empty">Add its first item with the form.</EmptyState>}</Panel></div>
    {type === "aptitude" && <Panel title="Test questions" subtitle="Questions are saved on the selected aptitude test."><Field label="Aptitude test"><select value={selectedTest} onChange={(event) => loadTestQuestions(event.target.value)}><option value="">Choose a test</option>{items.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></Field>{selectedTest && <div className="two-column-layout"><form onSubmit={addTestQuestion} className="admin-form"><Field label="Question"><textarea name="question" rows="3" required/></Field><Field label="Answer options (one per line)"><textarea name="options" rows="4" required/></Field><Field label="Correct option number (starting at 0)"><input name="correctOptionIndex" type="number" min="0" required/></Field><Field label="Explanation"><textarea name="explanation" rows="2"/></Field><Field label="Display order"><input name="displayOrder" type="number" min="1" placeholder={String(testQuestions.length + 1)}/></Field><Button type="submit" disabled={busy}><Plus size={16}/>Add question</Button></form><div className="admin-item-list">{testQuestions.map((question) => <article className="admin-item" key={question.id}><span className="feature-icon tone-orange"><FileQuestion size={19}/></span><div><strong>{question.question}</strong><small>{question.options?.length || 0} options · answer {Number(question.correctOptionIndex) + 1}</small></div><span className={question.isActive ? "status-chip badge-green" : "status-chip badge-red"}>{question.isActive ? "Available" : "Hidden"}</span><Button className="button-small" variant="outline" disabled={busy} onClick={() => toggleTestQuestion(question)}>{question.isActive ? "Hide" : "Restore"}</Button></article>)}</div></div>}</Panel>}
  </>;
}

// Let administrators manage cohorts and view the students returned by the API.
export function AdminCohortsPage() {
  const { data, loading, error, refresh } = useRemote("/officer/cohorts");
  const { data: overviewData } = useRemote("/officer/dashboard");
  const { data: staffData } = useRemote("/officer/users");
  const cohorts = data?.cohorts || [];
  const cohortStats = overviewData?.cohorts || [];
  const [selected, setSelected] = useState("");
  const [students, setStudents] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("students");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCohort, setEditingCohort] = useState(false);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  // Load only the selected cohort's student list from the officer API.
  useEffect(() => {
    if (!selected) { setStudents([]); setOfficers([]); return; }
    Promise.all([api(`/officer/cohorts/${selected}/students`), api(`/officer/cohorts/${selected}/officers`)]).then(([studentResult, officerResult]) => {
      setStudents(studentResult.students || []); setOfficers(officerResult.officers || []);
    }).catch((reason) => setProblem(reason.message));
  }, [selected]);

  // Create a cohort with the backend-supported name and academic-year fields.
  async function createCohort(event) {
    event.preventDefault(); setBusy(true); setProblem("");
    const form = new FormData(event.currentTarget);
    try { await api("/officer/cohorts", { method: "POST", body: { name: form.get("name"), academicYear: form.get("academicYear") } }); event.currentTarget.reset(); setShowCreateForm(false); setMessage("Cohort created."); await refresh(); }
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

  // Save edited cohort details while retaining its existing active status.
  async function updateCohort(event) {
    event.preventDefault(); setBusy(true); setProblem("");
    const form = new FormData(event.currentTarget);
    try {
      const current = cohorts.find((item) => item.id === selected);
      await api(`/officer/cohorts/${selected}`, { method: "PATCH", body: { name: form.get("name"), academicYear: form.get("academicYear"), isActive: current?.isActive !== false } });
      setMessage("Cohort details saved."); setEditingCohort(false); await refresh();
    } catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  // Assign an existing placement officer to this cohort.
  async function assignOfficer(event) {
    event.preventDefault(); setBusy(true); setProblem("");
    const officerId = new FormData(event.currentTarget).get("officerId");
    try {
      await api(`/officer/officers/${officerId}/cohorts`, { method: "POST", body: { cohortId: selected } });
      const result = await api(`/officer/cohorts/${selected}/officers`); setOfficers(result.officers || []); setMessage("Placement officer assigned."); event.currentTarget.reset();
    } catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  // Remove a placement officer's access to this cohort.
  async function removeOfficer(officerId) {
    setBusy(true); setProblem("");
    try {
      await api(`/officer/cohorts/${selected}/officers/${officerId}`, { method: "DELETE" });
      setOfficers((current) => current.filter((officer) => officer.id !== officerId)); setMessage("Officer assignment removed.");
    } catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  const selectedCohort = cohorts.find((item) => item.id === selected);
  const visibleCohorts = cohorts.filter((item) => `${item.name} ${item.academicYear || ""}`.toLowerCase().includes(query.toLowerCase()));

  return <>
    <PageHeading eyebrow="COHORTS" title="Manage cohorts" subtitle="Create, review, and manage student cohorts and officer assignments." art="study"/>
    <StatusMessage tone="error">{error || problem}</StatusMessage><StatusMessage tone="success">{message}</StatusMessage>
    {showCreateForm && <Panel title="Create a cohort" subtitle="Add a student group and academic year."><form className="admin-inline-form" onSubmit={createCohort}><Field label="Cohort name"><input name="name" required maxLength="120" placeholder="B.Tech 2027"/></Field><Field label="Academic year"><input name="academicYear" maxLength="20" placeholder="2027–2028"/></Field><Button type="submit" disabled={busy}><Plus size={16}/>{busy ? "Creating…" : "Create cohort"}</Button><Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button></form></Panel>}
    <Panel title="Cohort directory" subtitle={loading ? "Loading cohorts…" : `${cohorts.length} cohorts · ${cohortStats.reduce((sum, item) => sum + Number(item.students || 0), 0)} students`} action={<div className="admin-header-actions"><label className="search-field admin-directory-search"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cohorts…"/></label><Button className="button-small" onClick={() => setShowCreateForm((value) => !value)}><Plus size={16}/>Create cohort</Button></div>}>
      {visibleCohorts.length ? <div className="table-wrap"><table><thead><tr><th>Cohort name</th><th>Academic year</th><th>Students</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleCohorts.map((cohort) => <tr key={cohort.id}><td><button className="plain-select" onClick={() => { setSelected(cohort.id); setActiveTab("students"); }}><strong>{cohort.name}</strong></button></td><td>{cohort.academicYear || "—"}</td><td>{cohortStats.find((item) => item.cohortId === cohort.id)?.students || 0}</td><td><span className={`status-chip ${cohort.isActive === false ? "badge-orange" : "badge-green"}`}>{cohort.isActive === false ? "Paused" : "Active"}</span></td><td><div className="table-actions"><Button className="button-small" variant="outline" onClick={() => { setSelected(cohort.id); setEditingCohort(true); }}>Edit</Button><Button className="button-small" variant="outline" onClick={() => changeStatus(cohort)}>{cohort.isActive === false ? "Activate" : "Pause"}</Button></div></td></tr>)}</tbody></table></div> : <EmptyState icon={Users} title="No cohorts found">Change your search or create a cohort below.</EmptyState>}
    </Panel>
    {selected && <>
      <Panel title={selectedCohort?.name || "Cohort details"} subtitle={`Academic year ${selectedCohort?.academicYear || "not set"} · ${selectedCohort?.isActive === false ? "Paused" : "Active"}`} action={<Button variant="outline" className="button-small" onClick={() => setEditingCohort((value) => !value)}>{editingCohort ? "Close editor" : "Edit cohort"}</Button>}>
        {editingCohort && <form className="admin-inline-form" onSubmit={updateCohort}><Field label="Cohort name"><input key={`${selected}-name`} name="name" required maxLength="120" defaultValue={selectedCohort?.name}/></Field><Field label="Academic year"><input key={`${selected}-year`} name="academicYear" maxLength="20" defaultValue={selectedCohort?.academicYear || ""}/></Field><Button type="submit" disabled={busy}>Save cohort</Button></form>}
        <div className="admin-tabs admin-detail-tabs"><button className={activeTab === "students" ? "filter-chip active" : "filter-chip"} onClick={() => setActiveTab("students")}><Users size={16}/>Students ({students.length})</button><button className={activeTab === "officers" ? "filter-chip active" : "filter-chip"} onClick={() => setActiveTab("officers")}><ShieldCheck size={16}/>Assignments ({officers.length})</button></div>
        {activeTab === "students" && (students.length ? <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Course</th><th>Target role</th><th>Readiness</th><th>Move cohort</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><strong>{student.fullName}</strong></td><td>{student.email}</td><td>{student.course || "—"}</td><td>{student.targetRole || "—"}</td><td>{student.readinessScore ?? "—"}{student.readinessScore == null ? "" : "%"}</td><td><select value={selected} onChange={(event) => changeStudentCohort(student.id, event.target.value)}><option value={selected}>Keep here</option><option value="">Unassign</option>{cohorts.filter((item) => item.id !== selected).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></td></tr>)}</tbody></table></div> : <EmptyState icon={Users} title="No students in this cohort">Students will appear here after they are assigned.</EmptyState>)}
        {activeTab === "officers" && <><form className="admin-inline-form" onSubmit={assignOfficer}><Field label="Assign placement officer"><select name="officerId" required defaultValue=""><option value="" disabled>Choose an officer</option>{(staffData?.users || []).filter((person) => person.role === "placement_officer" && !officers.some((assigned) => assigned.id === person.id)).map((person) => <option value={person.id} key={person.id}>{person.fullName} · {person.email}</option>)}</select></Field><Button type="submit" disabled={busy}><Plus size={16}/>Assign officer</Button></form>{officers.length ? <div className="admin-item-list">{officers.map((officer) => <article className="admin-item" key={officer.id}><span className="feature-icon tone-violet"><ShieldCheck size={18}/></span><div><strong>{officer.fullName}</strong><small>{officer.email}</small></div><Button variant="outline" className="button-small" disabled={busy} onClick={() => removeOfficer(officer.id)}>Remove assignment</Button></article>)}</div> : <EmptyState icon={ShieldCheck} title="No officers assigned">Assign an officer to let them review this cohort.</EmptyState>}</>}
      </Panel>
    </>}
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
  const [draftWeights, setDraftWeights] = useState(null);

  // Start the editable sliders from the active saved version.
  useEffect(() => {
    if (active) setDraftWeights(Object.fromEntries(["resume", "skills", "interview", "coding", "aptitude"].map((key) => [key, Math.round(Number(active.weights?.[key] || 0) * 100)])));
  }, [active?.version]);

  const weightValues = draftWeights || Object.fromEntries(["resume", "skills", "interview", "coding", "aptitude"].map((key) => [key, Math.round(Number(active?.weights?.[key] || 0) * 100)]));
  const weightTotal = Object.values(weightValues).reduce((sum, value) => sum + Number(value || 0), 0);

  // Store five category weights as percentages and send the API's decimal values.
  async function saveFormula(event) {
    event.preventDefault(); setBusy(true); setProblem(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const keys = ["resume", "skills", "interview", "coding", "aptitude"];
    if (weightTotal !== 100) { setProblem("The component weights must total exactly 100%."); setBusy(false); return; }
    const weights = Object.fromEntries(keys.map((key) => [key, Number(weightValues[key]) / 100]));
    const versionNumber = Math.max(0, ...formulas.map((item) => Number(String(item.version).match(/\d+/)?.[0]) || 0)) + 1;
    try { await api(`/admin/readiness-formulas/v${versionNumber}`, { method: "PUT", body: { weights, minimumEvidence: { count: Number(form.get("minimumEvidence")) } } }); setMessage("A new readiness formula is now active."); await refresh(); }
    catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeading eyebrow="READINESS" title="Readiness configuration" subtitle="Configure the formula used to calculate student readiness scores." art="results"/>
    <StatusMessage tone="error">{error || problem}</StatusMessage><StatusMessage tone="success">{message}</StatusMessage>
    {loading ? <p>Loading formula history…</p> : <div className="two-column-layout"><Panel title={`Active formula · ${active?.version || "Not configured"}`} subtitle="Currently used to calculate student readiness scores.">{active ? <div className="formula-weight-list">{Object.entries(active.weights || {}).map(([key, value]) => <div key={key}><span>{key}</span><strong>{Math.round(Number(value) * 100)}%</strong><i><b style={{ width: `${Number(value) * 100}%` }}/></i></div>)}<p>Minimum categories with evidence: {active.minimumEvidence?.count ?? "—"}</p></div> : <EmptyState icon={Activity} title="No formula found">The backend has no configured readiness formula yet.</EmptyState>}</Panel><Panel title="Configure next version" subtitle="Adjust component weights. Their total must remain exactly 100%."><form onSubmit={saveFormula} className="admin-weight-form">{[["resume","Resume"],["skills","Skills"],["interview","Interview"],["coding","Coding"],["aptitude","Aptitude"]].map(([key,label]) => <label className="weight-slider" key={key}><span>{label}</span><input aria-label={`${label} weight`} name={key} type="range" min="0" max="100" step="1" value={weightValues[key]} onChange={(event) => setDraftWeights((current) => ({ ...(current || weightValues), [key]: Number(event.target.value) }))}/><strong>{weightValues[key]}%</strong></label>)}<p className={weightTotal === 100 ? "weight-total valid" : "weight-total"}>Total weights: <strong>{weightTotal}%</strong> {weightTotal === 100 ? "· ready to save" : "· adjust to exactly 100%"}</p><Field label="Minimum evidence categories"><input name="minimumEvidence" type="number" min="1" max="5" defaultValue={active?.minimumEvidence?.count || 3} required/></Field><Button type="submit" disabled={busy || weightTotal !== 100} className="wide">{busy ? "Saving…" : "Save & activate"}</Button></form></Panel></div>}
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
    <PageHeading eyebrow="AUDIT LOGS" title="System activity" subtitle="Track important administrative actions across the platform." art="study"/>
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
  const { data: staffData, error: staffLoadError, refresh: refreshStaff } = useRemote("/officer/users");
  const cohorts = data?.cohorts || [];
  const staff = staffData?.users || [];
  const [createdUser, setCreatedUser] = useState(null);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  // Create an administrator or placement officer account through the supported route.
  async function createStaff(event) {
    event.preventDefault(); setBusy(true); setProblem(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try { const result = await api("/officer/users", { method: "POST", body: { fullName: form.get("fullName"), email: form.get("email"), role: form.get("role"), temporaryPassword: form.get("temporaryPassword") } }); setCreatedUser(result.user); setMessage("Staff account created. Share the temporary password through a private channel."); event.currentTarget.reset(); await refreshStaff(); }
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

  // Enable or disable a staff account using the reversible account status API.
  async function changeStaffStatus(account) {
    setBusyId(account.id); setProblem(""); setMessage("");
    try {
      await api(`/officer/users/${account.id}/status`, { method: "PATCH", body: { status: account.status === "active" ? "disabled" : "active" } });
      setMessage(`${account.fullName}'s account is now ${account.status === "active" ? "disabled" : "active"}.`);
      await refreshStaff();
    } catch (reason) { setProblem(reason.message); }
    finally { setBusyId(""); }
  }

  // Issue a single-use password reset token for the selected staff member.
  async function resetStaffPassword(account) {
    setBusyId(account.id); setProblem(""); setMessage("");
    try {
      const result = await api(`/officer/users/${account.id}/password-reset`, { method: "POST", body: {} });
      window.prompt(`Copy this one-time token for ${account.email}. It expires in 30 minutes.`, result.resetToken);
      setMessage(`A one-time reset token was created for ${account.fullName}.`);
    } catch (reason) { setProblem(reason.message); }
    finally { setBusyId(""); }
  }

  const visibleStaff = staff.filter((account) => `${account.fullName} ${account.email} ${account.role} ${(account.cohorts || []).join(" ")}`.toLowerCase().includes(search.toLowerCase()));

  return <>
    <PageHeading eyebrow="STAFF ACCOUNTS" title="Staff accounts" subtitle="Create and manage administrator and placement officer access." art="study"/>
    <StatusMessage tone="error">{staffLoadError || problem}</StatusMessage><StatusMessage tone="success">{message}</StatusMessage>
    <Panel title="All staff" subtitle={`${staff.length} administrator and placement officer accounts.`} action={<label className="search-field admin-directory-search"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff…"/></label>}>
      {visibleStaff.length ? <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Assigned cohorts</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visibleStaff.map((account) => <tr key={account.id}><td><strong>{account.fullName}</strong></td><td>{account.email}</td><td>{account.role === "administrator" ? "Administrator" : "Placement Officer"}</td><td>{account.cohorts?.length ? account.cohorts.join(", ") : "—"}</td><td><span className={`status-chip ${account.status === "active" ? "badge-green" : "badge-orange"}`}>{account.status === "active" ? "Active" : "Inactive"}</span></td><td><div className="table-actions"><Button variant="outline" className="button-small" disabled={busyId === account.id || account.status !== "active"} onClick={() => resetStaffPassword(account)}>Reset password</Button>{account.id !== staffData?.currentUserId && <Button variant="outline" className="button-small" disabled={busyId === account.id} onClick={() => changeStaffStatus(account)}>{account.status === "active" ? "Disable" : "Enable"}</Button>}</div></td></tr>)}</tbody></table></div> : <EmptyState icon={Users} title="No matching staff">Try a different search or create a staff account below.</EmptyState>}
    </Panel>
    <div className="two-column-layout"><Panel title="Create staff account" subtitle="Create a placement officer or another administrator."><form onSubmit={createStaff}><Field label="Full name"><input name="fullName" required maxLength="120"/></Field><Field label="Email"><input name="email" type="email" required/></Field><Field label="Account type"><select name="role"><option value="placement_officer">Placement officer</option><option value="administrator">Administrator</option></select></Field><Field label="Temporary password" help="Use at least 12 characters and share it privately."><input name="temporaryPassword" type="password" minLength="12" required/></Field><Button type="submit" disabled={busy}><Plus size={17}/>{busy ? "Creating…" : "Create account"}</Button></form></Panel>
      <Panel title="Account actions" subtitle={createdUser ? `${createdUser.fullName} · ${createdUser.email}` : "Create an account to see supported follow-up actions."}>{createdUser ? <div className="admin-followups">{createdUser.role === "placement_officer" && <form onSubmit={assignCohort}><Field label="Assign to a cohort"><select name="cohortId" required><option value="">Choose cohort</option>{cohorts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Button type="submit">Assign cohort</Button></form>}<Button variant="outline" onClick={createResetToken}>Create reset token</Button><p className="muted small-note">Reset tokens expire after 30 minutes and can only be used once.</p></div> : <EmptyState icon={Users} title="No new account yet">Create a staff account to enable its cohort and reset actions.</EmptyState>}</Panel></div>
  </>;
}
