// Demo-only authentication (client side). Accounts live in THIS browser's localStorage, passwords are
// salted + SHA-256 hashed. This is NOT production auth: there is no server, no recovery, no real security.
const Auth = (() => {
  const USERS = "solarsleuth_users", SESSION = "solarsleuth_demo_session";
  const DEMO = { email: "demo@solarsleuth.app", password: "Demo@1234", name: "Demo Analyst" };
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  async function hash(pw, salt) {
    const text = salt + ":" + pw;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
    }
    let h = 5381; for (const c of text) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return "x" + h;   // fallback if SubtleCrypto is unavailable
  }
  const salt = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const start = (name, email) => { set(SESSION, { label: name, email, at: Date.now() }); return { ok: true, user: { name, email } }; };
  return {
    DEMO,
    current() { const s = get(SESSION, null); return s && s.email ? { name: s.label || s.email.split("@")[0], email: s.email } : null; },
    logout() { try { localStorage.removeItem(SESSION); } catch (e) {} },
    async login(email, password) {
      email = (email || "").trim().toLowerCase();
      if (!email) return { ok: false, field: "email", error: "Enter your email address." };
      if (!isEmail(email)) return { ok: false, field: "email", error: "That email address doesn't look right." };
      if (!password) return { ok: false, field: "password", error: "Enter your password." };
      if (email === DEMO.email) return password === DEMO.password ? start(DEMO.name, DEMO.email) : { ok: false, field: "password", error: "Incorrect email or password." };
      const u = get(USERS, {})[email];
      if (!u || (await hash(password, u.salt)) !== u.hash) return { ok: false, field: "password", error: "Incorrect email or password." };
      return start(u.name, email);
    },
    async signup(name, email, password, confirm) {
      name = (name || "").trim(); email = (email || "").trim().toLowerCase();
      if (name.length < 2) return { ok: false, field: "name", error: "Enter your name (at least 2 characters)." };
      if (!isEmail(email)) return { ok: false, field: "email", error: "Enter a valid email address." };
      if (email === DEMO.email) return { ok: false, field: "email", error: "That address is reserved for the demo account. Use another, or sign in with the demo login." };
      if ((password || "").length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return { ok: false, field: "password", error: "Use at least 8 characters with a letter and a number." };
      if (password !== confirm) return { ok: false, field: "confirm", error: "The two passwords don't match." };
      const users = get(USERS, {});
      if (users[email]) return { ok: false, field: "email", error: "An account with this email already exists. Try signing in." };
      const s = salt(); users[email] = { name, salt: s, hash: await hash(password, s), created: Date.now() };
      if (!set(USERS, users)) return { ok: false, field: "email", error: "This browser blocked local storage, so the account can't be saved. Use the demo login instead." };
      return start(name, email);
    },
  };
})();
