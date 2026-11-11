import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api.js";

const AuthContext = createContext(null);

// Share sign-in state and account actions with all pages in the app.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!localStorage.getItem("careerpilot-token")) {
      setLoading(false);
      return () => { active = false; };
    }
    api("/auth/me").then((result) => {
      if (active) setUser(result.user);
    }).catch(() => {
      localStorage.removeItem("careerpilot-token");
      if (active) setUser(null);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const expire = () => {
      localStorage.removeItem("careerpilot-token");
      setUser(null);
    };
    window.addEventListener("careerpilot:session-expired", expire);
    return () => window.removeEventListener("careerpilot:session-expired", expire);
  }, []);

  // Sign in and store the short-lived bearer token for protected API calls.
  async function signIn(email, password, loginType = "user") {
    const result = await api("/auth/login", { method: "POST", body: { email, password } });
    const isAdminAccount = result.user.role === "administrator";
    if ((loginType === "admin") !== isAdminAccount) {
      // Revoke the newly created server session if the selected account type is wrong.
      localStorage.setItem("careerpilot-token", result.accessToken);
      try { await api("/auth/logout", { method: "POST" }); } catch {}
      localStorage.removeItem("careerpilot-token");
      throw new Error(loginType === "admin"
        ? "This account is not an administrator. Choose Login as user instead."
        : "This is an administrator account. Choose Login as admin instead.");
    }
    localStorage.setItem("careerpilot-token", result.accessToken);
    setUser(result.user);
    return result.user;
  }

  // Register a student account and immediately sign it in.
  async function signUp(details) {
    const result = await api("/auth/register", { method: "POST", body: details });
    localStorage.setItem("careerpilot-token", result.accessToken);
    setUser(result.user);
    return result.user;
  }

  // Revoke the server session and clear local sign-in state.
  async function signOut() {
    try { await api("/auth/logout", { method: "POST" }); } catch {}
    localStorage.removeItem("careerpilot-token");
    setUser(null);
  }

  // Refresh the account after a profile update or account action.
  async function refreshUser() {
    const result = await api("/auth/me");
    setUser(result.user);
    return result.user;
  }

  return <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refreshUser }}>{children}</AuthContext.Provider>;
}

// Read the signed-in account and its actions from any child component.
export function useAuth() {
  return useContext(AuthContext);
}
