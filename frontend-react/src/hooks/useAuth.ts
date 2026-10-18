/* Demo-only authentication — ported exactly from frontend/auth.js.
   Client-side localStorage only; not production security. */

import { useState, useCallback, useEffect } from "react";

const USERS = "solarsleuth_users";
const SESSION = "solarsleuth_demo_session";
const DEMO = { email: "demo@solarsleuth.app", password: "Demo@1234", name: "Demo Analyst" };

const get = (k: string, d: any) => {
  try {
    const v = localStorage.getItem(k);
    return v == null ? d : JSON.parse(v);
  } catch {
    return d;
  }
};

const set = (k: string, v: any) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
};

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

async function hash(pw: string, salt: string) {
  const text = salt + ":" + pw;
  if (typeof window !== "undefined" && window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 5381;
  for (const c of text) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
  return "x" + h;
}

interface User { name: string; email: string }

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(current());
  }, []);

  const current = (): User | null => {
    const s = get(SESSION, null);
    return s && s.email ? { name: s.label || s.email.split("@")[0], email: s.email } : null;
  };

  const logout = useCallback(() => {
    try { localStorage.removeItem(SESSION); } catch {}
    setUser(null);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      email = (email || "").trim().toLowerCase();
      if (!email) return { ok: false, field: "email", error: "Enter your email address." };
      if (!isEmail(email)) return { ok: false, field: "email", error: "That email address doesn't look right." };
      if (!password) return { ok: false, field: "password", error: "Enter your password." };
      if (email === DEMO.email) {
        return password === DEMO.password
          ? start(DEMO.name, DEMO.email)
          : { ok: false, field: "password", error: "Incorrect email or password." };
      }
      const u = get(USERS, {})[email];
      if (!u || (await hash(password, u.salt)) !== u.hash) {
        return { ok: false, field: "password", error: "Incorrect email or password." };
      }
      return start(u.name, email);
    },
    []
  );

  const signup = useCallback(
    async (name: string, email: string, password: string, confirm: string) => {
      name = (name || "").trim();
      email = (email || "").trim().toLowerCase();
      if (name.length < 2)
        return { ok: false, field: "name", error: "Enter your name (at least 2 characters)." };
      if (!isEmail(email))
        return { ok: false, field: "email", error: "Enter a valid email address." };
      if (email === DEMO.email)
        return {
          ok: false,
          field: "email",
          error: "That address is reserved for the demo account. Use another, or sign in with the demo login.",
        };
      if (
        (password || "").length < 8 ||
        !/[A-Za-z]/.test(password) ||
        !/\d/.test(password)
      )
        return {
          ok: false,
          field: "password",
          error: "Use at least 8 characters with a letter and a number.",
        };
      if (password !== confirm)
        return { ok: false, field: "confirm", error: "The two passwords don't match." };
      const users = get(USERS, {});
      if (users[email])
        return { ok: false, field: "email", error: "An account with this email already exists. Try signing in." };
      const s = Math.random().toString(36).slice(2) + Date.now().toString(36);
      users[email] = { name, salt: s, hash: await hash(password, s), created: Date.now() };
      if (!set(USERS, users))
        return {
          ok: false,
          field: "email",
          error: "This browser blocked local storage, so the account can't be saved. Use the demo login instead.",
        };
      return start(name, email);
    },
    []
  );

  const start = (name: string, email: string) => {
    set(SESSION, { label: name, email, at: Date.now() });
    const u = { name, email };
    setUser(u);
    return { ok: true, user: u };
  };

  return { user, current, logout, login, signup, DEMO, isAuthed: () => !!user };
};
