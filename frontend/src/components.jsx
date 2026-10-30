import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Activity, Bell, BookOpen, BriefcaseBusiness, ChartNoAxesColumnIncreasing,
  ChevronDown, Code2, Database, FileQuestion, GraduationCap, House, Lightbulb, LogOut, Menu,
  Mic2, NotebookTabs, Search, Settings, ShieldCheck, UserRound, Users, X,
} from "lucide-react";
import { useAuth } from "./AuthContext.jsx";

// Render the shared CareerPilot graduation-cap mark and wordmark.
export function Brand({ compact = false, light = false }) {
  return (
    <Link className={`brand ${light ? "brand-light" : ""} ${compact ? "brand-compact" : ""}`} to="/" aria-label="CareerPilot AI home">
      <span className="brand-mark"><GraduationCap size={34} strokeWidth={2.4} /></span>
      <span className="brand-copy"><strong>CareerPilot <em>AI</em></strong><small>Plan. Learn. Practise. Get Placed.</small></span>
    </Link>
  );
}

// Create a friendly illustrated student scene using inline SVG so it scales cleanly.
export function MascotArt({ variant = "study", className = "" }) {
  const isPhone = variant === "phone";
  const isResults = variant === "results";
  return (
    <svg className={`mascot-art ${className}`} viewBox="0 0 520 340" role="img" aria-label="Student learning with a laptop">
      <defs>
        <linearGradient id={`hood-${variant}`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#cf8a72"/><stop offset="1" stopColor="#762e4c"/></linearGradient>
        <linearGradient id={`laptop-${variant}`} x1="0" x2="1"><stop stopColor="#f4e8dd"/><stop offset="1" stopColor="#d8c9ca"/></linearGradient>
      </defs>
      <ellipse cx="260" cy="307" rx="218" ry="20" fill="#ead8d2" opacity=".72"/>
      <g fill="#fff" opacity=".9"><ellipse cx="91" cy="100" rx="55" ry="22"/><ellipse cx="120" cy="87" rx="31" ry="26"/><ellipse cx="151" cy="101" rx="38" ry="18"/><ellipse cx="397" cy="92" rx="51" ry="20"/><ellipse cx="423" cy="79" rx="30" ry="25"/><ellipse cx="453" cy="95" rx="36" ry="17"/></g>
      <g fill="#b6c4a2" opacity=".8"><path d="M47 306c9-74 30-135 48-146 19 43 23 91 11 146z"/><path d="M84 306c8-93 35-163 55-175 20 53 18 112 3 175z"/><path d="M427 306c-8-85-33-153-53-165-19 47-19 106-4 165z"/><path d="M465 306c-10-70-30-126-48-136-16 39-18 89-6 136z"/></g>
      <g fill="#d8aa87" opacity=".8"><path d="M59 307c0-63-8-104-22-124-17 41-20 82-12 124z"/><path d="M451 307c1-54 12-96 28-115 13 36 14 75 5 115z"/></g>
      <path d="M158 302c1-75 18-129 52-148l64-19 74 24c38 12 57 66 61 143z" fill={`url(#hood-${variant})`}/>
      <path d="M202 163c-24 14-52 48-63 90l-26 45c-5 10 2 18 12 13l78-49 26-78z" fill="#4a2439"/>
      <path d="M181 269c-18 15-33 27-47 34-12 6-28 9-42 3-8-4-7-13 2-16l56-19 14-31z" fill="#f6ad91"/>
      <path d="M199 151c1-54 34-91 79-91 49 0 83 36 83 91 0 47-34 76-79 76-44 0-83-29-83-76z" fill="#ffc09c"/>
      <path d="M197 151c-8-44 14-89 54-103 46-17 95 2 112 35 13 25 4 54-5 62-5-26-24-34-40-37-32-4-49-24-55-39-17 29-35 41-66 46z" fill="#392431"/>
      <path d="M211 100c15-40 45-56 80-50 21 3 38 12 53 31-31-13-48 2-71 0-19-1-40 11-62 19z" fill="#573346"/>
      <ellipse cx="250" cy="151" rx="5" ry="8" fill="#152052"/><ellipse cx="313" cy="151" rx="5" ry="8" fill="#152052"/>
      <path d="M264 177c12 12 27 12 38-1" fill="none" stroke="#cf5361" strokeWidth="4" strokeLinecap="round"/>
      <path d="M228 140c8-8 18-9 27-4M300 135c8-5 18-4 25 3" fill="none" stroke="#392431" strokeWidth="5" strokeLinecap="round"/>
      <path d="M211 202c14 14 29 22 46 25l-19 39-58-42zM335 201c-13 14-26 21-42 26l18 42 56-43z" fill="#d9d4ff"/>
      <path d="M267 224h19v59h-19z" fill="#fff" opacity=".9"/><path d="M273 230h7v47h-7z" fill="#9a4b61"/>
      <path d="M347 217 457 232l-16 72-121-8z" fill={`url(#laptop-${variant})`} stroke="#cbbfc3" strokeWidth="4"/>
      <path d="m319 296 123 8 19 9c4 2 3 7-3 8H304c-9 0-11-5-4-8z" fill="#cbbfc3"/>
      <path d="m386 268 18-8 17 9-17 8z" fill="#81536b"/><path d="m396 277 8 4v11l-8-3z" fill="#92627a"/>
      <path d="M474 136 489 121l9 17 19 5-16 10-2 18-12-14-18 1z" fill="#b76b56" opacity=".8"/>
      <circle cx="109" cy="151" r="8" fill="#fff"/><circle cx="109" cy="151" r="4" fill="#7e2b4a"/>
      {isPhone && <g transform="translate(404 100) rotate(12)"><rect width="38" height="65" rx="8" fill="#25205f"/><rect x="4" y="7" width="30" height="48" rx="4" fill="#9b536b"/><circle cx="19" cy="60" r="2" fill="#fff"/></g>}
      {isResults && <g transform="translate(397 74)"><rect width="62" height="53" rx="9" fill="#fff"/><path d="M13 39V28h9v11m7 0V20h9v19m7 0V13h9v26" fill="#8a405b"/></g>}
    </svg>
  );
}

// Show a compact student avatar that works without a separately hosted profile image.
export function Avatar({ name = "Student", size = "normal" }) {
  return <span className={`avatar avatar-${size}`} aria-label={`${name} profile`}>{name.trim().charAt(0).toUpperCase() || "S"}</span>;
}

const studentLinks = [
  ["Dashboard", "/app/dashboard", House], ["Resume", "/app/resume", NotebookTabs],
  ["Skill Gap", "/app/skills", ChartNoAxesColumnIncreasing], ["Learning", "/app/learning", BookOpen],
  ["Mock Interview", "/app/interview", Mic2], ["Coding Practice", "/app/coding", Code2],
  ["Aptitude Tests", "/app/aptitude", NotebookTabs], ["Readiness", "/app/readiness", Activity],
  ["Career Guidance", "/app/career", Lightbulb], ["Notifications", "/app/notifications", Bell],
  ["Profile", "/app/profile", UserRound], ["Settings", "/app/settings", Settings],
];

// Display the role-aware navigation menu; officers see only staff workspace links.
function Sidebar({ user, closeMenu }) {
  const isStaff = user?.role === "placement_officer" || user?.role === "administrator";
  const links = user?.role === "administrator"
    ? [["Admin dashboard", "/app/staff", BriefcaseBusiness], ["Cohorts", "/app/admin/cohorts", Users], ["Staff accounts", "/app/admin/staff", UserRound], ["Content & questions", "/app/admin/content", Database], ["Readiness formula", "/app/admin/readiness", Activity], ["Audit log", "/app/admin/audit", FileQuestion], ["Placement updates", "/app/staff/notifications", Bell]]
    : isStaff
      ? [["Placement dashboard", "/app/staff", BriefcaseBusiness], ["Cohorts & students", "/app/staff", Users], ["Reports & readiness", "/app/staff/reports", Activity], ["Placement updates", "/app/staff/notifications", Bell]]
      : studentLinks;
  return (
    <aside className="sidebar">
      <div className="sidebar-brand"><Brand compact /></div>
      <nav className="side-nav" aria-label="Main navigation">
        {links.map(([label, path, Icon]) => <NavLink key={path} to={path} onClick={closeMenu} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}><Icon size={22} /><span>{label}</span></NavLink>)}
      </nav>
      <div className="sidebar-promo"><span className="promo-plane">➤</span><p>Plan Today.<br />Build Tomorrow.</p><MascotArt className="promo-mascot" /></div>
      <div className="sidebar-caption">Your next step starts here.</div>
    </aside>
  );
}

// Provide search, notification access, account menu, and mobile navigation controls.
function Topbar({ user, openMenu, signOut }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const isStaff = user?.role === "placement_officer" || user?.role === "administrator";
  const searchRoutes = user?.role === "administrator" ? [["Admin dashboard", "/app/staff"], ["Cohorts", "/app/admin/cohorts"], ["Content & questions", "/app/admin/content"], ["Readiness formula", "/app/admin/readiness"], ["Audit log", "/app/admin/audit"]] : isStaff ? [["Placement dashboard", "/app/staff"], ["Reports & readiness", "/app/staff/reports"], ["Placement updates", "/app/staff/notifications"]] : [["Resume", "/app/resume"], ["Skills", "/app/skills"], ["Learning resources", "/app/learning"], ["Aptitude tests", "/app/aptitude"], ["Career guidance", "/app/career"]];
  const matches = query.trim() ? searchRoutes.filter(([label]) => label.toLowerCase().includes(query.toLowerCase())) : [];
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={openMenu}><Menu size={22} /></button>
      <div className="top-search"><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses, practice tests, or topics..." aria-label="Search the app" />
        {matches.length > 0 && <div className="search-results">{matches.map(([label, path]) => <button key={path} onClick={() => { navigate(path); setQuery(""); }}>{label}</button>)}</div>}
      </div>
      <Link className="icon-button notification-shortcut" to={isStaff ? "/app/staff/notifications" : "/app/notifications"} aria-label={isStaff ? "Open placement notifications" : "View notifications"}><Bell size={21} /><i /></Link>
      <div className="user-menu-wrap">
        <button className="user-menu-button" onClick={() => setShowUserMenu((value) => !value)} aria-expanded={showUserMenu}>
          <Avatar name={user?.fullName || user?.email || "Student"} /><span>{user?.fullName || "Student"}</span><ChevronDown size={17} />
        </button>
        {showUserMenu && <div className="user-dropdown"><Link to={isStaff ? "/app/staff" : "/app/profile"} onClick={() => setShowUserMenu(false)}><UserRound size={17} /> {isStaff ? "Placement workspace" : "My profile"}</Link><button onClick={() => { setShowUserMenu(false); signOut(); }}><LogOut size={17} /> Sign out</button></div>}
      </div>
    </header>
  );
}

// Wrap authenticated pages in the responsive dashboard navigation and top bar.
export function AppShell({ user, signOut, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="app-shell">
      {menuOpen && <button aria-label="Close menu backdrop" className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />}
      <Sidebar user={user} closeMenu={() => setMenuOpen(false)} />
      <div className="app-main"><Topbar user={user} openMenu={() => setMenuOpen(true)} signOut={signOut} /><main className="page-content">{children}</main></div>
    </div>
  );
}

// Standardize the illustrated heading band shared by dashboard sections.
export function PageHeading({ title, subtitle, eyebrow, art = "study", children }) {
  return <section className="page-heading"><div><span className="eyebrow">{eyebrow || "CAREERPILOT AI"}</span><h1>{title}</h1><p>{subtitle}</p>{children}</div><div className="heading-art"><MascotArt variant={art} /><span className="handwritten">Small steps today,<br /> bigger opportunities tomorrow.</span></div></section>;
}

// Provide the same white rounded surface used for most dashboard content groups.
export function Panel({ title, subtitle, action, className = "", children }) {
  return <section className={`panel ${className}`}><div className="panel-heading">{(title || subtitle) && <div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>}{action}</div>{children}</section>;
}

// Show a label, number, and small icon together in a dashboard metric card.
export function MetricCard({ label, value, caption, icon: Icon, color = "violet" }) {
  return <article className="metric-card"><span className={`metric-icon tone-${color}`}><Icon size={22}/></span><div><strong>{value ?? "—"}</strong><span>{label}</span><small>{caption}</small></div></article>;
}

// Render a reusable action button with primary, secondary, and danger treatments.
export function Button({ children, variant = "primary", className = "", ...props }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}

// Show a labeled form control with accessible helper text and optional children.
export function Field({ label, help, children, className = "" }) {
  return <label className={`field ${className}`}><span>{label}</span>{children}{help && <small>{help}</small>}</label>;
}

// Display an inline message for loading, errors, or successful actions.
export function StatusMessage({ children, tone = "info" }) {
  if (!children) return null;
  return <div className={`status-message status-${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}

// Draw a circular metric using a native progress ring that scales with its label.
export function ScoreRing({ score, label = "Score", color = "purple", size = "normal" }) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  return <div className={`score-ring score-${color} ring-${size}`} style={{ "--score": `${safeScore * 3.6}deg` }}><div><strong>{score === null || score === undefined ? "—" : `${safeScore}%`}</strong><span>{label}</span></div></div>;
}

// Render an empty state so pages explain what to do before user data exists.
export function EmptyState({ icon: Icon = ShieldCheck, title, children }) {
  return <div className="empty-state"><span><Icon size={25} /></span><h3>{title}</h3><p>{children}</p></div>;
}

// Provide the public site navigation used before a user signs in.
export function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className="public-header"><Brand /><button className="icon-button mobile-menu public-mobile-menu" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle navigation">{menuOpen ? <X /> : <Menu />}</button><nav className={menuOpen ? "public-links open" : "public-links"}><NavLink to="/">Home</NavLink><NavLink to="/features">Features</NavLink><NavLink to="/contact">Contact</NavLink><Link className="button button-primary" to="/login">Sign in</Link></nav></header>;
}

// Present a compact title and text for forms and sign-in side panels.
export function FormIntro({ title, subtitle }) {
  return <div className="form-intro"><h1>{title}</h1><p>{subtitle}</p></div>;
}
