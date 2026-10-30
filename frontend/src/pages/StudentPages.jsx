import { useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Bell, BookOpen, Check, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Clock3, Code2, FileText, KeyRound, Lightbulb, LockKeyhole, Mail, Mic2, Pencil, Plus, Save, Search, ShieldCheck, Sparkles, Target, Trash2, UploadCloud, UserRound, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api, downloadPrivateFile } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { Button, EmptyState, Field, MascotArt, PageHeading, Panel, ScoreRing, StatusMessage } from "../components.jsx";
import { formatDate, useRemote } from "../useRemote.js";

// Show a shared loading message while an authenticated page waits for its API.
function Loading({ label = "Loading your information…" }) { return <div className="loading-state"><span className="spinner"/><p>{label}</p></div>; }

// Keep page-level API failures visible and let students retry the request.
function PageError({ error, retry }) { return error ? <StatusMessage tone="error"><span>{error}</span>{retry && <button className="inline-action" onClick={retry}>Try again</button>}</StatusMessage> : null; }

// Display a metric in the same compact card style as the supplied dashboard.
function MetricCard({ label, value, caption, icon: Icon, color = "violet" }) {
  return <article className="metric-card"><span className={`metric-icon tone-${color}`}><Icon size={22}/></span><div><strong>{value ?? "—"}</strong><span>{label}</span><small>{caption}</small></div></article>;
}

// Give students a quick view of their latest preparation scores and next steps.
export function DashboardPage() {
  const { data, loading, error, refresh } = useRemote("/dashboard/student");
  const { data: readiness } = useRemote("/readiness/me");
  const { data: skills } = useRemote("/skills/me");
  if (loading) return <Loading/>;
  const name = data?.profile?.fullName?.split(" ")[0] || "there";
  const stats = data?.stats || {};
  const recentNotices = data?.notifications || [];
  const skillItems = (skills?.skills || []).slice(0, 4);
  return <>
    <PageHeading title={`Good morning, ${name} 👋`} subtitle="Your next step toward your career starts here." art="study"><span className="role-chip">{data?.profile?.targetRole || "Set a target role in your profile"}</span></PageHeading>
    <PageError error={error} retry={refresh}/>
    <div className="metric-grid dashboard-metrics"><article className="readiness-card"><div><h2>Readiness overview</h2><p>{readiness?.complete ? "Your preparation has a useful foundation. Keep practising." : "Start adding preparation evidence to see your guidance score."}</p><Link to="/app/readiness">View breakdown <ArrowRight size={16}/></Link></div><ScoreRing score={readiness?.score} label="readiness" size="large"/></article><MetricCard label="Resume" value={stats.resumes || 0} caption="saved versions" icon={FileText} color="green"/><MetricCard label="Skills" value={skillItems.length} caption="in your profile" icon={Sparkles} color="blue"/><MetricCard label="Practice" value={Number(stats.interviews || 0) + Number(stats.coding || 0) + Number(stats.aptitude || 0)} caption="completed activities" icon={Code2} color="orange"/></div>
    <Panel title="Recommended for you" subtitle="Small actions that can help you move forward." action={<Link className="text-link" to="/app/career">View guidance <ArrowRight size={16}/></Link>}>
      <div className="recommendation-grid"><article className="recommendation-card card-lilac"><span className="feature-icon tone-violet"><FileText/></span><div><h3>Improve your resume</h3><p>Build or upload your resume and review feedback.</p><Link className="button button-primary button-small" to="/app/resume">Start now <ArrowRight size={15}/></Link></div></article><article className="recommendation-card card-blue"><span className="feature-icon tone-blue"><Mic2/></span><div><h3>Practice an interview</h3><p>Answer questions and receive clear practice feedback.</p><Link className="button button-primary button-small" to="/app/interview">Start now <ArrowRight size={15}/></Link></div></article><article className="recommendation-card card-green"><span className="feature-icon tone-green"><ChartNoAxesColumnIncreasingIcon/></span><div><h3>Review skill gaps</h3><p>Find the skills to focus on for your target role.</p><Link className="button button-primary button-small" to="/app/skills">Review skills <ArrowRight size={15}/></Link></div></article></div>
    </Panel>
    <div className="three-column-panels"><Panel title="Your skill progress" action={<Link className="text-link" to="/app/skills">View all <ArrowRight size={15}/></Link>}>{skillItems.length ? <div className="skill-progress-list">{skillItems.map((skill) => <div className="skill-progress-row" key={skill.id}><span>{skill.name}</span><div className="progress-track"><i style={{ width: `${Number(skill.proficiency) * 20}%` }}/></div><b>{Number(skill.proficiency) * 20}%</b></div>)}</div> : <EmptyState icon={Sparkles} title="Add your skills">Save your current skills from the skill gap page.</EmptyState>}</Panel><Panel title="Your practice" action={<Link className="text-link" to="/app/aptitude">Explore <ArrowRight size={15}/></Link>}><div className="practice-shortcuts"><Link to="/app/interview"><Mic2/> Mock interview <ArrowRight size={15}/></Link><Link to="/app/coding"><Code2/> Coding practice <ArrowRight size={15}/></Link><Link to="/app/aptitude"><BookOpen/> Aptitude tests <ArrowRight size={15}/></Link></div></Panel><Panel title="Recent updates" action={<Link className="text-link" to="/app/notifications">View all <ArrowRight size={15}/></Link>}>{recentNotices.length ? <div className="notice-list compact">{recentNotices.slice(0, 3).map((notice) => <div className="notice-row" key={notice.id}><span className="feature-icon tone-blue"><Bell size={19}/></span><div><strong>{notice.title}</strong><small>{notice.body}</small></div></div>)}</div> : <EmptyState icon={Bell} title="You're all caught up">Placement updates will appear here when available.</EmptyState>}</Panel></div>
  </>;
}

// Local icon wrapper avoids an extra long icon import in the dashboard markup.
function ChartNoAxesColumnIncreasingIcon() { return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20V10M10 20V4m6 16v-7m6 7H2"/></svg>; }

// Build and manage resume versions using the builder, upload, analyze, and file APIs.
export function ResumePage() {
  const { data, loading, error, refresh } = useRemote("/resume/me");
  const [versions, setVersions] = useState([]);
  const [title, setTitle] = useState("My Resume");
  const [content, setContent] = useState({ summary: "", education: "", experience: "", skills: "", projects: "" });
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data?.resume?.content) setContent((current) => ({ ...current, ...data.resume.content }));
    if (data?.resume?.title) setTitle(data.resume.title);
    api("/resume/me/versions").then((result) => setVersions(result.versions || [])).catch((reason) => setProblem(reason.message));
  }, [data]);
  const analysis = data?.analyses?.[0];
  const setField = (key) => (event) => setContent((current) => ({ ...current, [key]: event.target.value }));

  // Save structured builder fields as a version and request its analysis.
  async function saveBuilder(event) {
    event.preventDefault(); setBusy(true); setProblem(""); setMessage("");
    try { await api("/resume/me/builder", { method: "PUT", body: { title, content } }); setMessage("Your resume was saved and analyzed."); await refresh(); }
    catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  // Upload the selected PDF or DOCX through the private resume endpoint.
  async function uploadResume(event) {
    event.preventDefault(); setBusy(true); setProblem(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try { await api("/resume/me/upload", { method: "POST", body: form }); setMessage("The uploaded resume was saved and analyzed."); event.currentTarget.reset(); await refresh(); const result = await api("/resume/me/versions"); setVersions(result.versions || []); }
    catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  // Retry analysis for the selected version without creating another copy.
  async function analyzeCurrent() {
    const versionId = data?.resume?.versionId;
    if (!versionId) return setProblem("Save or upload a resume before analyzing it.");
    setBusy(true); setProblem("");
    try { await api("/resume/me/analyze", { method: "POST", body: { versionId } }); setMessage("Resume analysis completed."); await refresh(); }
    catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  // Delete one version and ask the API to select the next most recent version.
  async function deleteVersion(id) {
    if (!window.confirm("Delete this resume version?")) return;
    try { await api(`/resume/me/versions/${id}`, { method: "DELETE" }); setVersions((items) => items.filter((item) => item.id !== id)); setMessage("Resume version deleted."); await refresh(); }
    catch (reason) { setProblem(reason.message); }
  }

  if (loading) return <Loading label="Loading your resume…"/>;
  return <>
    <PageHeading title="AI Resume Analyzer" subtitle="Build a resume, upload an existing file, and review helpful feedback." art="results"/>
    <PageError error={error || problem} retry={refresh}/><StatusMessage tone="success">{message}</StatusMessage>
    <div className="resume-options"><Panel title="Upload resume" subtitle="Use a text-based PDF or DOCX file for analysis."><form onSubmit={uploadResume} className="upload-form"><Field label="Resume title"><input name="title" placeholder="My Resume" defaultValue="Uploaded Resume" maxLength="160"/></Field><Field label="Choose a file"><input name="resume" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required/></Field><Button type="submit" disabled={busy}><UploadCloud size={18}/>{busy ? "Uploading…" : "Upload resume"}</Button></form></Panel><Panel title="Build a resume" subtitle="Add the sections you want feedback on."><form className="builder-form" onSubmit={saveBuilder}><Field label="Resume title"><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength="160" required/></Field><div className="builder-fields"><Field label="Summary"><textarea value={content.summary} onChange={setField("summary")} rows="3" placeholder="Write a short professional summary…"/></Field><Field label="Education"><textarea value={content.education} onChange={setField("education")} rows="3" placeholder="Course, institution, and graduation year…"/></Field><Field label="Experience"><textarea value={content.experience} onChange={setField("experience")} rows="3" placeholder="Internships, work, or volunteering…"/></Field><Field label="Skills"><textarea value={content.skills} onChange={setField("skills")} rows="3" placeholder="Skills you can demonstrate…"/></Field><Field label="Projects"><textarea value={content.projects} onChange={setField("projects")} rows="3" placeholder="Projects and what you contributed…"/></Field></div><Button type="submit" disabled={busy}><Save size={17}/>{busy ? "Saving…" : "Save and analyze"}</Button></form></Panel></div>
    <Panel title="Your current resume" subtitle="Your saved versions stay private to your account." action={<Button variant="outline" onClick={analyzeCurrent} disabled={busy}><Sparkles size={17}/> Analyze again</Button>}>
      {data?.resume ? <div className="resume-current"><span className="feature-icon tone-violet"><FileText/></span><div><strong>{data.resume.title}</strong><small>{data.resume.originalFilename || "Resume builder"} · Version {data.resume.versionNumber || "—"}</small></div><span className="badge badge-purple">{analysis?.status || "Saved"}</span></div> : <EmptyState icon={FileText} title="Your resume will appear here">Build a resume or upload a PDF/DOCX to get started.</EmptyState>}
    </Panel>
    {analysis?.result && <Panel title="Resume analysis" subtitle="Use the suggestions as a guide and keep every claim accurate."><div className="analysis-layout"><ScoreRing score={analysis.score} label="overall score" size="large"/><div className="analysis-details"><StatusMessage tone="success">Analysis {analysis.status} · {formatDate(analysis.createdAt)}</StatusMessage><p>{analysis.result.summary || "Your analysis is ready."}</p><div className="analysis-columns"><div><h3>Detected skills</h3><div className="chip-list">{(analysis.result.detectedSkills || []).map((skill) => <span className="chip" key={skill}>{skill}</span>)}</div></div><div><h3>Suggestions</h3><ul>{(analysis.result.suggestions || []).map((suggestion) => <li key={suggestion}>{suggestion}</li>)}</ul></div></div></div></div></Panel>}
    <Panel title="Resume history" subtitle="Download or remove any saved version.">{versions.length ? <div className="table-wrap"><table><thead><tr><th>Version</th><th>File</th><th>Saved</th><th>State</th><th>Actions</th></tr></thead><tbody>{versions.map((version) => <tr key={version.id}><td>{version.versionNumber}</td><td>{version.originalFilename || "Resume builder"}</td><td>{formatDate(version.createdAt)}</td><td>{version.isCurrent ? <span className="badge badge-green">Current</span> : "Previous"}</td><td className="table-actions">{version.originalFilename && <button className="icon-button" onClick={() => downloadPrivateFile(`/resume/me/versions/${version.id}/file`, version.originalFilename).catch((reason) => setProblem(reason.message))} aria-label="Download resume"><ArrowDownToLine size={17}/></button>}<button className="icon-button danger-icon" onClick={() => deleteVersion(version.id)} aria-label="Delete resume version"><Trash2 size={17}/></button></td></tr>)}</tbody></table></div> : <EmptyState icon={FileText} title="No saved versions yet">Your resume versions will be listed here.</EmptyState>}</Panel>
  </>;
}

// Load role requirements and let a student save proficiency levels for their skills.
export function SkillGapPage() {
  const { data: catalog } = useRemote("/skills");
  const { data: gapData, loading, error, refresh } = useRemote("/skills/gaps");
  const [profile, setProfile] = useState(null);
  const [skillValues, setSkillValues] = useState({});
  const [roles, setRoles] = useState([]);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    Promise.all([api("/profile/me"), api("/skills/me"), api("/roles")]).then(([p, s, r]) => {
      setProfile(p.profile); setRoles(r.roles || []);
      setSkillValues(Object.fromEntries((s.skills || []).map((skill) => [skill.id, Number(skill.proficiency)])));
    }).catch((reason) => setProblem(reason.message));
  }, []);
  const gaps = gapData?.gaps || [];
  const strengths = gaps.filter((gap) => Number(gap.levelGap) === 0);
  const toBuild = gaps.filter((gap) => Number(gap.levelGap) > 0);

  // Save the selected role and current skill levels to the student's profile.
  async function saveSkills() {
    setBusy(true); setProblem(""); setMessage("");
    try {
      await api("/profile/me", { method: "PUT", body: { ...profile, fullName: profile.fullName, targetRoleId: profile.targetRoleId || null } });
      await api("/skills/me", { method: "PUT", body: { skills: Object.entries(skillValues).filter(([, level]) => level > 0).map(([id, proficiency]) => ({ id, proficiency })) } });
      setMessage("Your role and skills have been saved."); await refresh();
    } catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeading title="Skill Gap Analysis" subtitle="Compare your skills with the requirements for your target role." art="study"/>
    <PageError error={error || problem} retry={refresh}/><StatusMessage tone="success">{message}</StatusMessage>
    <Panel className="role-picker-panel"><div className="role-picker-icon"><BriefcaseIcon/></div><Field label="Target role"><select value={profile?.targetRoleId || ""} onChange={(event) => setProfile((current) => current && ({ ...current, targetRoleId: event.target.value || null }))}><option value="">Choose a career role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></Field><p>We compare your saved skills with typical requirements for your selected role.</p><Button onClick={saveSkills} disabled={busy || !profile}><ArrowRight size={17}/>{busy ? "Saving…" : "Update my skills"}</Button></Panel>
    <div className="metric-grid"><MetricCard label="Skills that match" value={strengths.length} caption="at or above role level" icon={CheckCircle2} color="green"/><MetricCard label="Skills to develop" value={toBuild.length} caption="focus areas" icon={ChartNoAxesColumnIncreasingIcon} color="violet"/><MetricCard label="Skills analyzed" value={gaps.length} caption="for this role" icon={BookOpen} color="blue"/><MetricCard label="Overall skill match" value={gaps.length ? `${Math.round(strengths.length / gaps.length * 100)}%` : "—"} caption="based on proficiency" icon={Target} color="orange"/></div>
    <div className="two-column-layout"><Panel title="Your strengths" subtitle="Skills that meet or exceed the selected role's expected level.">{strengths.length ? <SkillTable items={strengths} strong/> : <EmptyState icon={Sparkles} title="No matched skills yet">Choose a role and add your current skills to see matches.</EmptyState>}</Panel><Panel title="Skills to build" subtitle="These skills need more practice to meet role requirements.">{toBuild.length ? <SkillTable items={toBuild}/> : <EmptyState icon={CheckCircle2} title="No skill gaps to show">Choose a target role or add your skill levels.</EmptyState>}</Panel></div>
    <Panel title="Manage your skills" subtitle="Choose a level from 1 (starting) to 5 (confident)."><div className="skill-editor">{(catalog?.skills || []).map((skill) => <label className="skill-editor-row" key={skill.id}><span>{skill.name}<small>{skill.category}</small></span><select value={skillValues[skill.id] || 0} onChange={(event) => setSkillValues((values) => ({ ...values, [skill.id]: Number(event.target.value) }))}><option value="0">Not added</option>{[1,2,3,4,5].map((level) => <option key={level} value={level}>{level} · {["","Starting","Learning","Practising","Confident","Advanced"][level]}</option>)}</select></label>)}</div><Button onClick={saveSkills} disabled={busy || !profile}><Save size={17}/> Save role and skills</Button></Panel>
  </>;
}

// Show matched skills and role requirements as simple bars and gap values.
function SkillTable({ items, strong = false }) {
  return <div className="skill-table">{items.map((item) => <div className="skill-table-row" key={item.id}><span>{item.name}</span><div className="progress-track"><i className={strong ? "progress-green" : ""} style={{ width: `${Number(item.currentLevel) * 20}%` }}/></div><span>{Number(item.currentLevel) * 20}%</span><small>needs {Number(item.requiredLevel) * 20}%</small>{!strong && <b className="gap-badge">-{Number(item.levelGap) * 20}%</b>}</div>)}</div>;
}

function BriefcaseIcon() { return <span className="feature-icon tone-violet"><Lightbulb size={22}/></span>; }

// Browse learning materials and save progress changes to the student's account.
export function LearningPage() {
  const { data, loading, error, refresh } = useRemote("/resources");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const resources = data?.resources || [];
  const categories = ["All", ...new Set(resources.map((resource) => resource.skill).filter(Boolean))];
  const visible = resources.filter((resource) => (filter === "All" || resource.skill === filter) && `${resource.title} ${resource.description} ${resource.skill || ""}`.toLowerCase().includes(search.toLowerCase()));

  // Mark a resource saved, in progress, or completed through the learning API.
  async function updateProgress(resource, status) {
    setProblem("");
    try { await api(`/resources/${resource.id}/progress`, { method: "PUT", body: { status } }); setMessage(`“${resource.title}” marked ${status.replace("_", " ")}.`); await refresh(); }
    catch (reason) { setProblem(reason.message); }
  }

  return <>
    <PageHeading title="Learning resources" subtitle="Curated materials to help you build your skills." art="study"/>
    <PageError error={error || problem} retry={refresh}/><StatusMessage tone="success">{message}</StatusMessage>
    <Panel className="resource-toolbar"><div className="search-field"><Search size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search learning resources…" aria-label="Search learning resources"/></div><div className="filter-chips">{categories.map((category) => <button key={category} className={filter === category ? "filter-chip active" : "filter-chip"} onClick={() => setFilter(category)}>{category}</button>)}</div></Panel>
    <div className="metric-grid resource-metrics"><MetricCard label="Total resources" value={resources.length} caption="curated for your goals" icon={BookOpen} color="violet"/><MetricCard label="Completed" value={resources.filter((item) => item.myStatus === "completed").length} caption="great progress" icon={CheckCircle2} color="green"/><MetricCard label="In progress" value={resources.filter((item) => item.myStatus === "in_progress").length} caption="keep going" icon={Clock3} color="blue"/><MetricCard label="Not started" value={resources.filter((item) => !item.myStatus || item.myStatus === "saved").length} caption="explore new topics" icon={Lightbulb} color="orange"/></div>
    <Panel title="All learning resources" subtitle="Choose a resource to open it and save your progress." className="resource-panel">{loading ? <Loading/> : visible.length ? <div className="resource-grid">{visible.map((resource) => <article className="resource-card" key={resource.id}><span className="feature-icon tone-blue"><BookOpen size={22}/></span><h3>{resource.title}</h3><p>{resource.description || `A learning resource${resource.skill ? ` for ${resource.skill}` : ""}.`}</p><div className="resource-meta"><span>{resource.skill || resource.resourceType || "Resource"}</span><span className={`badge ${resource.myStatus === "completed" ? "badge-green" : "badge-purple"}`}>{(resource.myStatus || "not started").replace("_", " ")}</span></div><a className="button button-outline button-small" href={resource.url} target="_blank" rel="noreferrer">Open resource <ArrowUpRight size={15}/></a><select aria-label={`Update progress for ${resource.title}`} value={resource.myStatus || "saved"} onChange={(event) => updateProgress(resource, event.target.value)}><option value="saved">Save for later</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></article>)}</div> : <EmptyState icon={BookOpen} title="No resources found">Try a different search or filter.</EmptyState>}</Panel>
  </>;
}

// Practise interview questions, save feedback, and complete a reviewable session.
export function InterviewPage() {
  const { data: qData, loading, error, refresh } = useRemote("/interviews/questions");
  const [history, setHistory] = useState([]);
  const [session, setSession] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const questions = qData?.questions || [];
  useEffect(() => { api("/interviews/history").then((result) => setHistory(result.sessions || [])).catch(() => {}); }, []);

  // Create a new practice session before the student starts answering questions.
  async function startSession(type) {
    setProblem(""); setMessage(""); setFeedback(null); setQuestionIndex(0); setAnswer("");
    try { const result = await api("/interviews", { method: "POST", body: { type } }); setSession(result.session); }
    catch (reason) { setProblem(reason.message); }
  }

  // Save the answer and show the server's feedback before moving to another question.
  async function submitAnswer(event) {
    event.preventDefault();
    if (!session || !questions[questionIndex]) return;
    setBusy(true); setProblem("");
    try { const result = await api(`/interviews/${session.id}/responses`, { method: "POST", body: { questionId: questions[questionIndex].id, answer } }); setFeedback(result.response.feedback); }
    catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  // Finish the session so its average feedback score appears in history and readiness.
  async function completeSession() {
    setBusy(true);
    try { const result = await api(`/interviews/${session.id}/complete`, { method: "POST", body: {} }); setMessage(`Practice completed with an average score of ${result.session.score ?? "—"}.`); setSession(null); const updated = await api("/interviews/history"); setHistory(updated.sessions || []); }
    catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  const current = questions[questionIndex];
  return <>
    <PageHeading title="Mock interview" subtitle="Practise common questions and reflect on your answers." art="phone"/>
    <PageError error={error || problem} retry={refresh}/><StatusMessage tone="success">{message}</StatusMessage>
    {!session ? <Panel title="Start a practice session" subtitle="Choose an interview style. Your answers are saved to your account."><div className="practice-start-grid"><button onClick={() => startSession("technical")}><Code2/><strong>Technical</strong><small>Explain your technical thinking.</small></button><button onClick={() => startSession("behavioral")}><UserRound/><strong>Behavioral</strong><small>Practise examples from your experience.</small></button><button onClick={() => startSession("mixed")}><Mic2/><strong>Mixed practice</strong><small>Try a mix of question types.</small></button></div></Panel> : <div className="interview-layout"><Panel title={`Question ${questionIndex + 1} of ${questions.length}`} subtitle={current?.category || session.type || "Practice"}><div className="interview-question">{loading ? <Loading/> : <><p>{current?.question || "No questions are available right now."}</p>{current && <form onSubmit={submitAnswer}><Field label="Your answer"><textarea rows="7" maxLength="10000" required value={answer} onChange={(event) => { setAnswer(event.target.value); setFeedback(null); }} placeholder="Use a clear example and explain what you learned…"/></Field><Button type="submit" disabled={busy || !answer.trim()}>{busy ? "Saving…" : "Save answer"} <ArrowRight size={17}/></Button></form>}{feedback && <div className="feedback-card"><div><strong>Practice feedback</strong><span className="badge badge-purple">Score {feedback.score ?? "—"}</span></div><p>{feedback.feedback}</p>{(feedback.strengths || []).map((item) => <small key={item}>✓ {item}</small>)}{(feedback.improvements || []).map((item) => <small key={item}>→ {item}</small>)}</div>}<div className="question-controls"><Button variant="outline" onClick={() => { setQuestionIndex((index) => Math.max(0, index - 1)); setAnswer(""); setFeedback(null); }} disabled={questionIndex === 0}><ChevronLeft size={17}/> Previous</Button><Button variant="outline" onClick={() => { setQuestionIndex((index) => Math.min(questions.length - 1, index + 1)); setAnswer(""); setFeedback(null); }} disabled={questionIndex >= questions.length - 1}>Next question <ChevronRight size={17}/></Button><Button variant="danger" onClick={completeSession} disabled={busy}>Finish session</Button></div></>}</div></Panel><Panel title="Interview tips" subtitle="Take your time and explain your reasoning."><div className="tips-list"><p><CheckCircle2/> Start with a direct answer.</p><p><CheckCircle2/> Share a real example where you can.</p><p><CheckCircle2/> Explain the result or what you learned.</p></div></Panel></div>}
    <Panel title="Your interview history" subtitle="Review completed practice sessions.">{history.length ? <div className="table-wrap"><table><thead><tr><th>Type</th><th>Status</th><th>Score</th><th>Started</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td>{item.type}</td><td>{item.status}</td><td>{item.score ?? "—"}</td><td>{formatDate(item.startedAt)}</td></tr>)}</tbody></table></div> : <EmptyState icon={Mic2} title="No interview sessions yet">Start a session when you are ready to practise.</EmptyState>}</Panel>
  </>;
}

// Practise backend-provided coding questions without executing student code.
export function CodingPage() {
  const { data, loading, error, refresh } = useRemote("/coding/problems");
  const [submissions, setSubmissions] = useState([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const problems = data?.problems || [];
  const current = problems[index];
  useEffect(() => { api("/coding/submissions").then((value) => setSubmissions(value.submissions || [])).catch(() => {}); }, []);

  // Submit an option index or short text answer for backend grading.
  async function checkAnswer() {
    if (!current || !answer) return;
    setBusy(true); setProblem("");
    try { const value = await api(`/coding/problems/${current.id}/submissions`, { method: "POST", body: { answer } }); setResult(value); const history = await api("/coding/submissions"); setSubmissions(history.submissions || []); }
    catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  // Move between available questions and clear feedback from the previous answer.
  function move(step) { setIndex((value) => Math.min(Math.max(0, value + step), problems.length - 1)); setAnswer(""); setResult(null); }

  return <>
    <PageHeading title="Coding Practice" subtitle="Solve short questions, strengthen problem-solving, and improve your logic." art="study"/>
    <PageError error={error || problem} retry={refresh}/>
    {loading ? <Loading/> : current ? <div className="practice-layout"><Panel className="coding-question-panel"><div className="question-toolbar"><span>Problem {index + 1} of {problems.length}</span><div><button className="icon-button" onClick={() => move(-1)} disabled={index === 0} aria-label="Previous problem"><ChevronLeft/></button><button className="icon-button" onClick={() => move(1)} disabled={index >= problems.length - 1} aria-label="Next problem"><ChevronRight/></button></div></div><h2>{current.title}</h2><div className="question-tags"><span>{current.difficulty}</span><span>{current.problemType === "multiple_choice" ? "Multiple choice" : "Short answer"}</span></div><h3>Problem statement</h3><p className="question-prompt">{current.prompt}</p>{current.problemType === "multiple_choice" ? <div className="answer-options">{(current.options || []).map((option, optionIndex) => <label className={answer === String(optionIndex) ? "answer-option selected" : "answer-option"} key={`${current.id}-${optionIndex}`}><input type="radio" name="coding-answer" value={optionIndex} checked={answer === String(optionIndex)} onChange={() => { setAnswer(String(optionIndex)); setResult(null); }}/><span>{option}</span></label>)}</div> : <Field label="Your answer"><textarea rows="4" maxLength="5000" value={answer} onChange={(event) => { setAnswer(event.target.value); setResult(null); }} placeholder="Type your short answer…"/></Field>}{result && <div className={result.submission.correct ? "result-callout success" : "result-callout error"}><strong>{result.submission.correct ? "Correct answer" : "Not quite yet"}</strong><p>{result.explanation}</p></div>}<div className="question-controls"><Button variant="outline" onClick={() => move(-1)} disabled={index === 0}><ChevronLeft/> Previous</Button><Button onClick={checkAnswer} disabled={!answer || busy}>{busy ? "Checking…" : "Check answer"} <CheckCircle2 size={17}/></Button><Button variant="outline" onClick={() => move(1)} disabled={index >= problems.length - 1}>Next problem <ArrowRight size={17}/></Button></div></Panel><Panel title="Your recent attempts" subtitle="Practice answers are reviewed without running submitted code.">{submissions.length ? <div className="notice-list">{submissions.slice(0, 6).map((item) => <div className="notice-row" key={item.id}><span className={`feature-icon ${item.correct ? "tone-green" : "tone-orange"}`}>{item.correct ? <CheckCircle2/> : <X/>}</span><div><strong>{item.title}</strong><small>{item.correct ? "Correct" : "Review this topic"} · {formatDate(item.createdAt)}</small></div></div>)}</div> : <EmptyState icon={Code2} title="No attempts yet">Choose an answer and check it to record a practice attempt.</EmptyState>}</Panel></div> : <EmptyState icon={Code2} title="No practice questions available">Your placement team can add questions to the practice catalog.</EmptyState>}
  </>;
}

// Start an aptitude attempt, navigate its questions, and show the final score.
export function AptitudePage() {
  const { data, loading, error, refresh } = useRemote("/aptitude/tests");
  const [history, setHistory] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const tests = data?.tests || [];
  useEffect(() => { api("/aptitude/history").then((value) => setHistory(value.attempts || [])).catch(() => {}); }, []);

  // Create an attempt and load its questions without revealing correct answers.
  async function startTest(test) {
    setProblem(""); setResult(null); setAnswers({}); setIndex(0);
    try {
      const started = await api(`/aptitude/tests/${test.id}/attempts`, { method: "POST", body: {} });
      const questionList = await api(`/aptitude/attempts/${started.attempt.id}/questions`);
      setAttempt({ ...started.attempt, title: test.title }); setQuestions(questionList.questions || []);
    } catch (reason) { setProblem(reason.message); }
  }

  // Submit all chosen answers and store the returned result for review.
  async function submitTest() {
    setBusy(true); setProblem("");
    try { const value = await api(`/aptitude/attempts/${attempt.id}/submit`, { method: "POST", body: { answers: Object.entries(answers).map(([questionId, selectedOptionIndex]) => ({ questionId, selectedOptionIndex })) } }); setResult(value); setAttempt(null); const past = await api("/aptitude/history"); setHistory(past.attempts || []); }
    catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  const current = questions[index];
  return <>
    <PageHeading title={result ? "Test results" : "Aptitude Tests"} subtitle={result ? result.attempt?.title || "Your performance summary and answer review." : "Practise numerical and reasoning skills at your own pace."} art={result ? "results" : "phone"}/>
    <PageError error={error || problem} retry={refresh}/>
    {result ? <Panel title="Your result" subtitle="Review each answer and use the explanations to learn."><div className="aptitude-result-summary"><ScoreRing score={result.attempt.score} label="test score" color="green" size="large"/><div><h2>{result.correct} of {result.total} questions correct</h2><p>Completed · {formatDate(result.attempt.completedAt)}</p><Button variant="outline" onClick={() => setResult(null)}>Try another test <ArrowRight size={17}/></Button></div></div><div className="answer-review-list">{result.results.map((item, i) => { const question = questions.find((entry) => entry.id === item.questionId); return <article key={item.questionId}><div className="review-question-title"><span>Q{i + 1}</span><strong>{question?.question || "Question"}</strong><b className={item.isCorrect ? "text-green" : "text-red"}>{item.isCorrect ? "Correct" : "Review"}</b></div><p>Your answer: {item.selectedOptionIndex === null ? "Not answered" : question?.options?.[item.selectedOptionIndex] || "Selected option"}</p><p>Correct answer: {question?.options?.[item.correctOptionIndex] || "Option"}</p><small>{item.explanation}</small></article>; })}</div></Panel> : attempt ? <div className="aptitude-workspace"><Panel className="aptitude-question-panel"><div className="attempt-progress"><div><strong>Question {index + 1} of {questions.length}</strong><small>{Math.round(((index + 1) / Math.max(questions.length, 1)) * 100)}% complete</small></div><div className="progress-track"><i style={{ width: `${((index + 1) / Math.max(questions.length, 1)) * 100}%` }}/></div></div>{current ? <><span className="question-label">Q{index + 1}</span><h2>{current.question}</h2><div className="answer-options">{(current.options || []).map((option, optionIndex) => <label className={answers[current.id] === optionIndex ? "answer-option selected" : "answer-option"} key={current.id + optionIndex}><input type="radio" name={`question-${current.id}`} checked={answers[current.id] === optionIndex} onChange={() => setAnswers((value) => ({ ...value, [current.id]: optionIndex }))}/><span>{option}</span></label>)}</div></> : <EmptyState icon={CircleHelp} title="No questions in this test">Choose another test or ask your placement team to add questions.</EmptyState>}<div className="question-controls"><Button variant="outline" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}><ChevronLeft/> Previous</Button><Button variant="outline" onClick={() => setAnswers((value) => { if (current) { const updated = { ...value }; delete updated[current.id]; return updated; } return value; })}>Clear answer</Button>{index < questions.length - 1 ? <Button onClick={() => setIndex((value) => value + 1)}>Save and next <ArrowRight size={17}/></Button> : <Button variant="danger" onClick={submitTest} disabled={busy}>{busy ? "Submitting…" : "Submit test"}</Button>}</div></Panel><Panel title="Question navigator" subtitle="Choose a question to review it."><div className="question-navigator">{questions.map((question, qIndex) => <button key={question.id} className={`${qIndex === index ? "current" : ""} ${answers[question.id] !== undefined ? "answered" : ""}`} onClick={() => setIndex(qIndex)}>{qIndex + 1}</button>)}</div><StatusMessage>Answers are saved in this browser while you work and submitted when you finish.</StatusMessage></Panel></div> : <><div className="test-grid">{loading ? <Loading/> : tests.map((test) => <Panel key={test.id} title={test.title} subtitle={test.description}><div className="test-card-meta"><span><BookOpen size={16}/>{test.companyName || "Practice test"}</span><span>{history.filter((item) => item.title === test.title).length} completed attempts</span></div><Button onClick={() => startTest(test)}>Start test <ArrowRight size={17}/></Button></Panel>)}</div>{!tests.length && !loading && <EmptyState icon={BookOpen} title="No tests available">Your placement team can add aptitude tests to the catalog.</EmptyState>}<Panel title="Your test history" subtitle="Completed attempts and scores.">{history.length ? <div className="table-wrap"><table><thead><tr><th>Test</th><th>Status</th><th>Score</th><th>Completed</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td>{item.title}</td><td>{item.status}</td><td>{item.score ?? "—"}</td><td>{formatDate(item.completedAt || item.startedAt)}</td></tr>)}</tbody></table></div> : <EmptyState icon={Clock3} title="No attempts yet">Completed tests will appear here.</EmptyState>}</Panel></>}
  </>;
}

// Show career suggestions based on skill gaps from the saved target role.
export function CareerPage() {
  const { data, loading, error, refresh } = useRemote("/career/recommendations");
  const recommendations = data?.recommendations || [];
  return <>
    <PageHeading title="Career Recommendations" subtitle="Explore learning priorities that support your career goals." art="results"/>
    <PageError error={error} retry={refresh}/>
    <Panel title="Your recommended next steps" subtitle={data?.provider === "local" ? "Suggestions are based on the skill gaps saved in your profile." : "Suggestions are based on the role and skills in your profile."}>
      {loading ? <Loading/> : recommendations.length ? <div className="career-card-grid">{recommendations.map((item, index) => <article className="career-card" key={`${item.skill}-${index}`}><span className="feature-icon tone-violet"><Lightbulb/></span><div><small>SKILL TO DEVELOP</small><h3>{item.skill}</h3><p>{item.reason}</p><Link className="button button-outline button-small" to="/app/learning">Find learning resources <ArrowRight size={15}/></Link></div></article>)}</div> : <EmptyState icon={Sparkles} title="No skill-gap suggestions yet">Choose a target role and add skills on the skill gap page to get recommendations.</EmptyState>}
    </Panel><div className="guidance-note"><Sparkles/><p>Career recommendations are guidance to help you explore options. They are not guarantees of a job offer or a specific outcome.</p></div>
  </>;
}

// Display delivered notices and let students mark each notification as read.
export function NotificationsPage() {
  const { data, loading, error, refresh } = useRemote("/notifications");
  const [filter, setFilter] = useState("all");
  const [problem, setProblem] = useState("");
  const notices = data?.notifications || [];
  const visible = notices.filter((notice) => filter === "all" || !notice.isRead);
  const unreadCount = notices.filter((notice) => !notice.isRead).length;

  // Mark one notification read and refresh the unread total from the server.
  async function markRead(id) {
    try { await api(`/notifications/${id}/read`, { method: "PATCH", body: {} }); await refresh(); }
    catch (reason) { setProblem(reason.message); }
  }

  return <>
    <PageHeading title="Notifications" subtitle="Updates from your placement preparation and cohort." art="phone"/>
    <PageError error={error || problem} retry={refresh}/>
    <Panel className="notification-toolbar"><div className="filter-chips"><button className={filter === "all" ? "filter-chip active" : "filter-chip"} onClick={() => setFilter("all")}>All ({notices.length})</button><button className={filter === "unread" ? "filter-chip active" : "filter-chip"} onClick={() => setFilter("unread")}>Unread ({unreadCount})</button></div><span className="muted">{unreadCount ? `${unreadCount} unread updates` : "You're all caught up"}</span></Panel>
    <Panel className="notification-panel">{loading ? <Loading/> : visible.length ? <div className="notice-list full">{visible.map((notice) => <article className={notice.isRead ? "notice-card" : "notice-card unread"} key={notice.id}><span className="feature-icon tone-violet"><Bell size={23}/></span><div className="notice-main"><span className="badge badge-purple">Placement update</span><h3>{notice.title}</h3><p>{notice.body}</p><small>{formatDate(notice.publishedAt)}</small></div><div className="notice-state">{notice.isRead ? <span className="badge">Read</span> : <><span className="badge badge-blue">Unread</span><button className="text-link" onClick={() => markRead(notice.id)}>Mark read <Check size={15}/></button></>}</div></article>)}</div> : <EmptyState icon={Bell} title={filter === "unread" ? "No unread notifications" : "You're all caught up"}>New cohort and placement updates will appear here.</EmptyState>}</Panel>
  </>;
}

// Edit profile and education details while leaving cohort assignment read-only.
export function ProfilePage() {
  const { data, loading, error, refresh } = useRemote("/profile/me");
  const [roles, setRoles] = useState([]);
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api("/roles").then((result) => setRoles(result.roles || [])).catch(() => {}); }, []);
  useEffect(() => { if (data?.profile) setProfile(data.profile); }, [data]);
  const update = (field) => (event) => setProfile((current) => ({ ...current, [field]: event.target.value }));

  // Save editable profile fields and keep the server-managed cohort unchanged.
  async function save(event) {
    event.preventDefault(); setBusy(true); setProblem(""); setMessage("");
    try { await api("/profile/me", { method: "PUT", body: { ...profile, graduationYear: profile.graduationYear ? Number(profile.graduationYear) : null, targetRoleId: profile.targetRoleId || null } }); setMessage("Your profile has been updated."); await refresh(); }
    catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeading title="My Profile" subtitle="Keep your career goals and education details up to date." art="study"/>
    <PageError error={error || problem} retry={refresh}/><StatusMessage tone="success">{message}</StatusMessage>
    {loading || !profile ? <Loading/> : <><Panel className="profile-summary"><span className="profile-avatar"><UserRound size={42}/></span><div><h2>{profile.fullName}</h2><span className="badge badge-purple">Student</span><p><Mail size={16}/> {profile.email}</p></div><span className="profile-summary-role">{profile.targetRole || "Choose a target role"}</span></Panel><form onSubmit={save} className="profile-grid"><Panel title="Basic information" subtitle="Tell us about your education and career goals."><div className="form-grid"><Field label="Full name"><input value={profile.fullName || ""} onChange={update("fullName")} required maxLength="120"/></Field><Field label="Course"><input value={profile.course || ""} onChange={update("course")} maxLength="120" placeholder="e.g. BCA"/></Field><Field label="Graduation year"><input type="number" min="2000" max="2100" value={profile.graduationYear || ""} onChange={update("graduationYear")} placeholder="2027"/></Field><Field label="Target role"><select value={profile.targetRoleId || ""} onChange={update("targetRoleId")}><option value="">Choose a role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></Field></div><Field label="Career interests and preferences" help="Enter interests as a short comma-separated list."><input value={Array.isArray(profile.preferences?.interests) ? profile.preferences.interests.join(", ") : profile.preferences?.interests || ""} onChange={(event) => setProfile((current) => ({ ...current, preferences: { ...(current.preferences || {}), interests: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) } }))} placeholder="Software development, data analysis…"/></Field></Panel><div className="profile-side"><Panel title="Assigned cohort" subtitle="Your placement team manages your cohort."><div className="readonly-info"><strong>{profile.cohortId ? "Assigned cohort" : "Not assigned yet"}</strong><p>{profile.cohortId ? "Cohort assignment is managed by your placement team." : "Your placement officer can assign your cohort when ready."}</p><LockKeyhole size={18}/></div></Panel><Panel title="Skills" subtitle="Keep your skills current to improve guidance." action={<Link className="text-link" to="/app/skills">Manage skills <ArrowRight size={15}/></Link>}><div className="chip-list"><span className="chip">Update proficiency</span><span className="chip">See role gaps</span></div></Panel></div><div className="form-footer"><Button variant="outline" type="button" onClick={() => refresh()}>Cancel</Button><Button type="submit" disabled={busy}><Save size={17}/>{busy ? "Saving…" : "Save changes"}</Button></div></form></>}
  </>;
}

// Display the transparent formula, evidence status, and missing activities.
export function ReadinessPage() {
  const { data, loading, error, refresh } = useRemote("/readiness/me");
  const labels = { resume: "Resume", skills: "Skill match", interview: "Interview", coding: "Coding practice", aptitude: "Aptitude tests" };
  const weights = { resume: 25, skills: 25, interview: 20, coding: 15, aptitude: 15 };
  const breakdown = data?.breakdown || {};
  const included = Object.entries(breakdown).filter(([, value]) => value !== null);
  const missing = Object.entries(breakdown).filter(([, value]) => value === null);
  return <>
    <PageHeading title="Your preparation readiness" subtitle="A guidance summary based on your recent activity — not a prediction of placement." art="results"/>
    <PageError error={error} retry={refresh}/>
    {loading ? <Loading/> : <><div className="readiness-overview"><Panel title="Overall readiness" subtitle={data?.complete ? "Your score uses the evidence available from your recent preparation." : `Complete more activities to meet the ${data?.requiredEvidence ?? 3}-category evidence minimum.`}><div className="readiness-score-layout"><ScoreRing score={data?.score} label="readiness score" color="purple" size="large"/><div><h2>{data?.complete ? "Good progress!" : "Your journey is underway"}</h2><p>This guidance score uses the active formula version {data?.formulaVersion || "v1"}.</p><div className="guidance-note"><Lightbulb/><span>Missing evidence is excluded until you complete the related activity.</span></div></div></div></Panel><Panel title="Evidence status" subtitle={`${included.length} of ${Object.keys(labels).length} categories have evidence.`}><div className="evidence-row">{Object.entries(labels).map(([key, label]) => <div key={key}><span className={breakdown[key] === null || breakdown[key] === undefined ? "evidence-dot missing" : "evidence-dot complete"}>{breakdown[key] === null || breakdown[key] === undefined ? "!" : <Check size={17}/>}</span><small>{label}</small></div>)}</div></Panel></div><div className="readiness-lower"><Panel title="Readiness breakdown" subtitle="Each contribution shows the latest available evidence and its configured weight."><div className="breakdown-table">{Object.entries(labels).map(([key, label]) => <div className="breakdown-row" key={key}><span>{label}</span><b>{weights[key]}%</b><div className="progress-track"><i style={{ width: `${breakdown[key] ?? 0}%` }}/></div><span>{breakdown[key] === null || breakdown[key] === undefined ? "Not enough evidence" : `${breakdown[key]}%`}</span></div>)}</div></Panel><Panel title="Evidence needed" subtitle="Add evidence to include more categories in your score."><div className="next-steps">{(missing.length ? missing : Object.entries(labels)).map(([key]) => <Link to={({ resume: "/app/resume", skills: "/app/skills", interview: "/app/interview", coding: "/app/coding", aptitude: "/app/aptitude" })[key]} key={key}><span>{labels[key]}</span><small>{weights[key]}% of the formula</small><ArrowRight size={16}/></Link>)}</div></Panel></div><div className="formula-note"><ShieldCheck/><p>Your readiness score is a weighted combination of the categories above. It is a preparation guide, not a prediction of placement.</p></div></>}
  </>;
}

// Manage the user's password, AI feedback consent, and account deletion.
export function SettingsPage() {
  const { refreshUser, signOut } = useAuth();
  const { data, loading, error, refresh } = useRemote("/profile/me");
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data?.profile) setProfile(data.profile); }, [data]);

  // Change the password after confirmation; the backend revokes old sessions.
  async function changePassword(event) {
    event.preventDefault(); setBusy(true); setProblem(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try { await api("/auth/change-password", { method: "POST", body: { currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") } }); setMessage("Password changed. Please sign in again with your new password."); event.currentTarget.reset(); await signOut(); }
    catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  // Save explicit consent for external AI analysis through the student profile API.
  async function savePrivacy(event) {
    event.preventDefault(); setBusy(true); setProblem(""); setMessage("");
    try { await api("/profile/me", { method: "PUT", body: { ...profile, fullName: profile.fullName, aiDataConsent: Boolean(profile.aiDataConsent) } }); await refreshUser(); setMessage("Your AI feedback privacy setting was saved."); await refresh(); }
    catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  // Delete the signed-in student account only after they re-enter their password.
  async function deleteAccount(event) {
    event.preventDefault();
    if (!window.confirm("Permanently delete your account and associated student data? This cannot be undone.")) return;
    setBusy(true); setProblem("");
    const form = new FormData(event.currentTarget);
    try { await api("/auth/account", { method: "DELETE", body: { password: form.get("deletePassword") } }); await signOut(); }
    catch (reason) { setProblem(reason.message); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeading title="Settings" subtitle="Manage your account, security, and privacy." art="study"/>
    <PageError error={error || problem} retry={refresh}/><StatusMessage tone="success">{message}</StatusMessage>
    {loading || !profile ? <Loading/> : <div className="settings-stack"><Panel title="Account security" subtitle="Keep your account safe with a strong password."><form className="settings-row" onSubmit={changePassword}><span className="feature-icon tone-violet"><KeyRound/></span><div><strong>Change password</strong><small>Use a new password with at least 10 characters.</small></div><input name="currentPassword" type="password" required placeholder="Current password" autoComplete="current-password"/><input name="newPassword" type="password" required minLength="10" placeholder="New password" autoComplete="new-password"/><Button type="submit" variant="outline" disabled={busy}>Update password <ArrowRight size={17}/></Button></form></Panel><Panel title="AI feedback privacy" subtitle="Control whether resume and interview text may be sent to an external AI provider."><div className="privacy-info"><ShieldCheck/><p>External providers process your data only to return the feedback you request. Local practice and mock feedback remain available when consent is off.</p></div><form className="settings-row consent-row" onSubmit={savePrivacy}><label className="toggle-control"><input type="checkbox" checked={Boolean(profile.aiDataConsent)} onChange={(event) => setProfile((current) => ({ ...current, aiDataConsent: event.target.checked }))}/><span className="toggle-track"/></label><div><strong>Allow external AI feedback</strong><small>{profile.aiDataConsent ? "Enabled: selected content may be sent to the configured provider." : "Disabled: use local mock feedback and basic practice features."}</small></div><Button type="submit" variant="outline" disabled={busy}>Save privacy choice</Button></form><p className="muted small-note">Current profile setting: {profile.aiDataConsent ? "External feedback allowed" : "External feedback disabled"}</p></Panel><Panel title="Account management" subtitle="Manage your account data and permanent deletion." className="danger-panel"><form className="settings-row danger-row" onSubmit={deleteAccount}><span className="feature-icon tone-red"><Trash2/></span><div><strong>Delete my account</strong><small>This permanently deletes your account and preparation data. This action cannot be undone.</small></div><input name="deletePassword" type="password" required placeholder="Confirm your password" autoComplete="current-password"/><Button type="submit" variant="danger" disabled={busy}>Delete account <ArrowRight size={17}/></Button></form></Panel></div>}
  </>;
}
