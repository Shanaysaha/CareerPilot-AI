import { useState } from "react";
import { ArrowRight, ArrowUpRight, BarChart3, BookOpen, CheckCircle2, Code2, FileText, Lightbulb, Mail, Mic2, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import { api } from "../api.js";
import { Brand, Button, Field, FormIntro, MascotArt, Panel, PublicHeader, StatusMessage } from "../components.jsx";

const featureCards = [
  ["AI Resume Analyzer", "Get clear feedback and improve your resume for better opportunities.", FileText, "violet"],
  ["Skill Gap Analysis", "Compare your skills with the requirements for your target role.", BarChart3, "green"],
  ["Learning Resources", "Find curated material to build your skills and strengthen concepts.", BookOpen, "blue"],
  ["Mock Interviews", "Practise common questions and review helpful feedback.", Mic2, "blue"],
  ["Coding Practice", "Build problem-solving confidence with guided exercises.", Code2, "violet"],
  ["Aptitude Tests", "Practise numerical and logical reasoning questions.", Target, "orange"],
  ["Career Guidance", "Explore roles and learning priorities that fit your goals.", Lightbulb, "orange"],
  ["Readiness Tracking", "See preparation evidence and understand what to work on next.", CheckCircle2, "green"],
];

// Introduce CareerPilot with the same pale lavender, illustration-led style as the references.
export function LandingPage() {
  return <div className="public-page"><PublicHeader /><main>
    <section className="landing-hero"><div className="landing-copy"><span className="eyebrow">YOUR CAREER JOURNEY STARTS HERE</span><h1>Plan. Learn.<br /><em>Practise. Get Placed.</em></h1><p>One welcoming place to prepare for your next opportunity, build useful skills, and track your progress.</p><div className="hero-actions"><Link className="button button-primary button-large" to="/register">Create a free account <ArrowRight size={19} /></Link><Link className="button button-outline button-large" to="/features">Explore features</Link></div><div className="trust-points"><span><CheckCircle2 /> Your progress, in one place</span><span><ShieldCheck /> Designed around your privacy</span></div></div><div className="landing-art"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><MascotArt /><div className="floating-note">Small steps today,<br /> brighter opportunities tomorrow.</div><div className="float-card"><Sparkles size={20}/><span>Keep moving forward</span></div></div></section>
    <section className="feature-section"><div className="section-heading"><span className="eyebrow">A PRACTICAL TOOLKIT</span><h2>Everything you need for placement preparation</h2><p>Build skills, practise with purpose, and keep your progress together.</p></div><div className="feature-grid">{featureCards.map(([title, description, Icon, color]) => <article className="feature-card" key={title}><span className={`feature-icon tone-${color}`}><Icon size={25}/></span><div><h3>{title}</h3><p>{description}</p><Link to="/features">Learn more <ArrowRight size={16}/></Link></div><ArrowUpRight className="feature-arrow" size={19}/></article>)}</div></section>
    <section className="how-section"><div><span className="eyebrow">MADE FOR YOUR NEXT STEP</span><h2>Make your preparation feel manageable.</h2><p>CareerPilot brings your goals, practice, and progress into one responsive workspace you can use on a laptop or phone.</p><Link className="button button-outline" to="/features">See how it works <ArrowRight size={17}/></Link></div><div className="how-steps"><article><span>01</span><div><h3>Set your direction</h3><p>Choose a target role and tell us what you want to work toward.</p></div></article><article><span>02</span><div><h3>Build your evidence</h3><p>Improve your resume, practise, and track your learning activity.</p></div></article><article><span>03</span><div><h3>See your progress</h3><p>Use clear readiness guidance to decide what to practise next.</p></div></article></div></section>
    <section className="closing-banner"><div><span className="eyebrow">YOUR NEXT STEP STARTS HERE</span><h2>Start building a stronger career plan.</h2><p>Create an account and take your preparation one step at a time.</p></div><Link className="button button-white" to="/register">Get started <ArrowRight size={18}/></Link></section>
  </main><footer className="public-footer"><Brand compact/><span>CareerPilot AI · A student career preparation project</span><div><Link to="/features">Features</Link><Link to="/contact">Contact</Link></div></footer></div>;
}

// Explain the product features and the boundaries of readiness and AI feedback.
export function FeaturesPage() {
  return <div className="public-page"><PublicHeader/><main className="public-content"><section className="feature-hero"><div><span className="eyebrow">OUR FEATURES</span><h1>Everything you need for placement preparation</h1><p>Build skills, practise with purpose, and keep your progress in one place.</p></div><MascotArt/></section><div className="feature-grid feature-grid-public">{featureCards.map(([title, description, Icon, color])=><article className="feature-card" key={title}><span className={`feature-icon tone-${color}`}><Icon size={25}/></span><div><h3>{title}</h3><p>{description}</p><Link to="/register">Get started <ArrowRight size={16}/></Link></div></article>)}</div><div className="feature-notes"><Panel title="Clear, supportive guidance" subtitle="Scores help you see preparation evidence. They are not a prediction of placement or a promise of a job offer."><div className="feature-note"><ShieldCheck/><p>CareerPilot is designed to support practice and planning. Review AI suggestions carefully and keep your information accurate.</p></div></Panel></div></main><footer className="public-footer"><Brand compact/><span>Plan. Learn. Practise. Get Placed.</span></footer></div>;
}

// Provide a contact page that opens a prefilled email without pretending to store messages.
export function ContactPage() {
  const [sent, setSent] = useState(false);
  function sendMessage(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const subject = encodeURIComponent(form.get("subject"));
    const body = encodeURIComponent(`${form.get("name")} (${form.get("email")})\n\n${form.get("message")}`);
    window.location.href = `mailto:support@careerpilot.ai?subject=${subject}&body=${body}`;
    setSent(true);
  }
  return <div className="public-page"><PublicHeader/><main className="contact-layout"><div className="contact-copy"><span className="eyebrow">CONTACT</span><h1>We’d love to<br/><em>hear from you.</em></h1><p>Questions or feedback? Send us a message and help us improve CareerPilot.</p><div className="contact-art"><MascotArt variant="phone"/><div className="floating-note">Your ideas<br/>help us grow.</div></div></div><Panel className="contact-form-panel"><form onSubmit={sendMessage}><FormIntro title="Send a message" subtitle="Fill in the details and your email app will open."/><Field label="Name"><input name="name" required placeholder="Your name"/></Field><Field label="Email address"><input name="email" required type="email" placeholder="you@example.com"/></Field><Field label="Subject"><input name="subject" required placeholder="How can we help?"/></Field><Field label="Message"><textarea name="message" required rows="5" placeholder="Write your message..."/></Field><Button type="submit">Send message <ArrowRight size={18}/></Button><StatusMessage tone="success">{sent ? "Your email draft is ready to send." : ""}</StatusMessage></form></Panel></main><footer className="public-footer"><Brand compact/><span>CareerPilot AI</span><Link to="/">Back to home</Link></footer></div>;
}

// Authenticate an existing student, placement officer, or administrator.
export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try { await signIn(form.get("email"), form.get("password")); navigate("/app"); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  return <div className="auth-page"><PublicHeader/><main className="auth-layout"><div className="auth-welcome"><Brand/><h1>Welcome back <span>👋</span></h1><p>Sign in to continue your career journey.</p><div className="auth-art"><MascotArt/><div className="floating-note">Small steps today,<br/> bigger opportunities tomorrow.</div></div></div><section className="auth-card"><FormIntro title="Sign in" subtitle="Continue your career journey."/><form onSubmit={submit}><Field label="Email address"><input type="email" name="email" autoComplete="email" placeholder="you@example.com" required/></Field><Field label="Password"><input type="password" name="password" autoComplete="current-password" placeholder="Your password" required/></Field><div className="auth-options"><label className="check-label"><input type="checkbox"/> Keep me signed in</label><Link to="/reset-password">Forgot password?</Link></div><StatusMessage tone="error">{error}</StatusMessage><Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"} <ArrowRight size={18}/></Button></form><div className="auth-divider"><span>or</span></div><div className="auth-register"><p>New to CareerPilot?</p><Link to="/register">Create an account <ArrowRight size={17}/></Link></div></section></main></div>;
}

// Register a new student using the public registration endpoint.
export function RegisterPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await signUp({ fullName: form.get("fullName"), email: form.get("email"), password: form.get("password"), course: form.get("course") || "", graduationYear: form.get("graduationYear") ? Number(form.get("graduationYear")) : null });
      navigate("/app/profile");
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  return <div className="auth-page"><PublicHeader/><main className="auth-layout"><div className="auth-welcome"><Brand/><h1>Your career journey <em>starts here.</em></h1><p>Create a student account and start making a plan that works for you.</p><div className="auth-art"><MascotArt/><div className="float-card"><CheckCircle2/><span>Your next step starts today</span></div></div></div><section className="auth-card"><FormIntro title="Create your account" subtitle="Start with a few basic details."/><form onSubmit={submit}><Field label="Full name"><input name="fullName" autoComplete="name" placeholder="Your name" required maxLength="120"/></Field><Field label="Email address"><input type="email" name="email" autoComplete="email" placeholder="you@example.com" required/></Field><Field label="Password" help="Use at least 10 characters."><input type="password" name="password" autoComplete="new-password" minLength="10" required/></Field><Field label="Course (optional)"><input name="course" placeholder="e.g. BCA" maxLength="120"/></Field><Field label="Graduation year (optional)"><input name="graduationYear" type="number" min="2000" max="2100" placeholder="2027"/></Field><StatusMessage tone="error">{error}</StatusMessage><Button type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"} <ArrowRight size={18}/></Button></form><div className="auth-register"><p>Already have an account?</p><Link to="/login">Sign in <ArrowRight size={17}/></Link></div></section></main></div>;
}

// Let users submit a one-time administrator-issued password reset token.
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault(); setMessage(""); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/auth/password-reset", { method: "POST", body: { token: form.get("token"), newPassword: form.get("password") } });
      setMessage("Password reset. You can sign in with your new password.");
      event.currentTarget.reset();
    } catch (reason) { setError(reason.message); }
  }
  return <div className="auth-page"><PublicHeader/><main className="single-auth"><section className="auth-card"><FormIntro title="Reset password" subtitle="Enter the one-time token provided by your placement team."/><form onSubmit={submit}><Field label="Reset token"><input name="token" required minLength="40" placeholder="Paste your reset token"/></Field><Field label="New password"><input name="password" type="password" required minLength="10" autoComplete="new-password"/></Field><StatusMessage tone="error">{error}</StatusMessage><StatusMessage tone="success">{message}</StatusMessage><Button type="submit">Reset password <ArrowRight size={18}/></Button></form><Link className="back-link" to="/login">Back to sign in</Link></section></main></div>;
}
