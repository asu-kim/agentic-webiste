import React, { useEffect, useState} from "react";
import './App.css';


export default function Dashboard(){
  const [user, setUser] = useState("Guest");
  const [trust, setTrust] = useState(() => localStorage.getItem("agent_trust") || "low");
  const [results, setResults] = useState({});
  const [remainingMs, setRemainingMs] = useState(() => {
    const exp = parseInt(localStorage.getItem("agent_session_expires_at") || "0", 10);
    return exp > 0 ? Math.max(0, exp - Date.now()) : 0;
  });
  const API_BASE = 'http://127.0.0.1:5000';

  useEffect(() => {
    const u = localStorage.getItem("username") || "Guest";
    setUser(u);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const exp = parseInt(localStorage.getItem("agent_session_expires_at") || "0", 10);
      if (!exp) { setRemainingMs(0); return; }
      const rem = Math.max(0, exp - Date.now());
      setRemainingMs(rem);
      if (rem <= 0) {
        localStorage.removeItem("agent_session_expires_at");
        localStorage.removeItem("agent_trust");
        window.location.replace("/agent-login");
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const formatRemaining = (ms) => {
    if (!ms || ms <= 0) return "expired";
    const s = Math.floor(ms / 1000);
    const hh = Math.floor(s / 3600).toString().padStart(2, "0");
    const mm = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const ss = Math.floor(s % 60).toString().padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  };

  const callScope = async (scope) => {
    const headers = {
      "X-User": localStorage.getItem("username") || user,
      "X-Trust-Level": trust,
    };
    try {
      const res = await fetch(`${API_BASE}/api/resource/${scope}`, { headers });
      const text = await res.text();
      let body; try { body = JSON.parse(text); } catch { body = text; }
      setResults((r) => ({
        ...r,
        [scope]: { status: res.status, body }
      }));
    } catch (e) {
      setResults((r) => ({
        ...r,
        [scope]: { status: "network-error", body: String(e) }
      }));
    }
  };

  const scopes = [
    { key: "email", label: "Email" },
    { key: "address", label: "Address" },
    { key: "cardNumber", label: "Card Number" },
    { key: "phone", label: "Phone Number" },
  ];

  const handleTrustChange = (e) => {
    const val = e.target.value;
    setTrust(val);
    localStorage.setItem("agent_trust", val);
  };

  return (
    <div className="access-wrap">
      <h1 className="title">Dashboard</h1>
      <p className="subtle">Hello, <span className="mono">{user}</span></p>
      <p className="subtle">Session remaining: <span className="mono">{formatRemaining(remainingMs)}</span></p>

      <div className="bar">
        <a className="btn" href="/access-control">Open Agent Access Control</a>
        <span className="spacer" />
        <label>
          Trust level:&nbsp;
          <select value={trust} onChange={handleTrustChange}>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
        </label>
      </div>

      <div className="grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:'12px'}}>
        {scopes.map(({key, label}) => {
          const r = results[key];
          return (
            <div key={key} className="card" style={{border:'1px solid #eee', borderRadius:12, padding:12}}>
              <h3 style={{marginTop:0}}>{label}</h3>
              <button className="btn primary" onClick={() => callScope(key)}>Request {label}</button>
              {r && (
                <div style={{marginTop:8}}>
                  <div className="subtle">Status: <span className="mono">{String(r.status)}</span></div>
                  <pre className="code-block" style={{marginTop:6}}>{JSON.stringify(r.body, null, 2)}</pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <details className="mt">
        <summary>How this test works</summary>
        <ol>
          <li>Set trust level (high/medium/low). This is sent as <code>X-Trust-Level</code>.</li>
          <li>Click a scope card to call <code>/api/resource/&lt;scope&gt;</code> with headers <code>X-User</code> and <code>X-Trust-Level</code>.</li>
          <li>If the policy allows it → 200 JSON; otherwise → 403 forbidden.</li>
        </ol>
      </details>
    </div>
  );
}
