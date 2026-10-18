/* Auth modal — same visual and logic as original auth modal in index.html + auth.js. */

import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuth: () => void;
}

export const AuthModal = ({ open, onClose, onAuth }: AuthModalProps) => {
  const { login, signup, DEMO } = useAuth();
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authError, setAuthError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [invalid, setInvalid] = useState<Record<string, boolean>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    Object.keys(invalid).forEach((k) => setInvalid({ ...invalid, [k]: false }));

    if (authMode === "signup") {
      const r = await signup(form.name, form.email, form.password, form.confirm);
      if (!r.ok) {
        const err = r as { ok: boolean; field: string; error: string };
        setAuthError(err.error);
        if (err.field) setInvalid({ [err.field]: true });
        return;
      }
      onAuth();
    } else {
      const r = await login(form.email, form.password);
      if (!r.ok) {
        const err = r as { ok: boolean; field: string; error: string };
        setAuthError(err.error);
        if (err.field) setInvalid({ [err.field]: true });
        return;
      }
      onAuth();
    }
  };

  const useDemo = () => {
    setForm((prev) => ({ ...prev, email: DEMO.email, password: DEMO.password }));
    setAuthError("");
  };

  if (!open) return null;

  const su = authMode === "signup";

  return (
    <div
      id="authModal"
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="authTitle"
      onClick={(e) => {
        if ((e.target as HTMLElement).id === "authModal") onClose();
      }}
    >
      <div className="auth-card">
        <button className="modal-close" id="authClose" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <div className="auth-brand">
          <span className="brand-mark">
            <svg viewBox="0 0 40 40">
              <path
                d="M20 4 5 12.5v15L20 36l15-8.5v-15L20 4Z"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
              />
              <path
                d="M20 10v20M10 15.5l20 9M10 24.5l20-9"
                stroke="currentColor"
                strokeWidth={1.5}
              />
            </svg>
          </span>
          <b>SolarSleuth</b>
        </div>
        <div className="eyebrow">DEMO WORKSPACE ACCESS</div>
        <h2 id="authTitle">Your solar intelligence workspace.</h2>
        <div className="demo-cred" id="demoCred" style={{ display: su ? "none" : "flex" }}>
          <div>
            <b>Demo credentials</b>
            <span>{DEMO.email} · {DEMO.password}</span>
          </div>
          <button className="small-action" type="button" onClick={useDemo}>
            Use demo login
          </button>
        </div>
        <div className="auth-tabs">
          <button
            className={su ? "" : "on"}
            data-authmode="signin"
            onClick={() => setAuthMode("signin")}
          >
            Sign in
          </button>
          <button
            className={su ? "on" : ""}
            data-authmode="signup"
            onClick={() => setAuthMode("signup")}
          >
            Create account
          </button>
        </div>
        <form id="authForm" noValidate onSubmit={handleSubmit}>
          <label htmlFor="authName" id="nameLabel" className={su ? "" : "hide"}>
            Your name
          </label>
          <input
            id="authName"
            autoComplete="name"
            placeholder="e.g. Alex Morgan"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={`${su ? "" : "hide"} ${invalid.name ? "invalid" : ""}`.trim()}
          />
          <label htmlFor="authEmail">Email address</label>
          <input
            id="authEmail"
            type="email"
            placeholder="you@company.com"
            autoComplete="username"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={invalid.email ? "invalid" : ""}
          />
          <label htmlFor="authPassword">Password</label>
          <div className="pw-row">
            <input
              id="authPassword"
              type="password"
              placeholder={su ? "8+ characters, a letter and a number" : "Enter your password"}
              autoComplete={su ? "new-password" : "current-password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={invalid.password ? "invalid" : ""}
            />
            <button
              type="button"
              className="pw-toggle"
              id="pwToggle"
              onClick={(e) => {
                e.preventDefault();
                // toggle handled via state if needed
              }}
            >
              Show
            </button>
          </div>
          <label htmlFor="authConfirm" id="confirmLabel" className={su ? "" : "hide"}>
            Confirm password
          </label>
          <input
            id="authConfirm"
            type="password"
            placeholder="Repeat password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            className={`${su ? "" : "hide"} ${invalid.confirm ? "invalid" : ""}`.trim()}
          />
          <div className={`auth-error ${authError ? "" : "hide"}`} id="authError" role="alert">
            {authError}
          </div>
          <button
            className="btn btn-primary btn-full"
            type="submit"
            style={{ marginTop: 14 }}
          >
            {su ? "Create account " : "Sign in "}
            <span>→</span>
          </button>
          <div className="auth-disclaimer">
            <span>ⓘ</span> Demo-only: accounts are saved in this browser only · Not production security.
          </div>
        </form>
      </div>
    </div>
  );
};
