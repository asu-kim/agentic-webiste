import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import './App.css'

const TRUST_LEVELS = ["high", "medium", "low"];
const SCOPES = [
  { key: "email", label: "Email" },
  { key: "address", label: "Address" },
  { key: "cardNumber", label: "Card Number" },
  { key: "phone", label: "Phone Number" },
];

const API_BASE = 'http://127.0.0.1:5000';

function loadPolicy(username) {
  try {
    const raw = localStorage.getItem(`policy:${username}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function savePolicy(username, policy) {
  localStorage.setItem(`policy:${username}`, JSON.stringify(policy));
}

export default function AccessControl({ username }) {
  const effectiveUser = username || localStorage.getItem("username") || "Guest";

  const [policy, setPolicy] = useState(() => {
    const existing = loadPolicy(effectiveUser);
    if (existing) return existing;
    // default: conservative (no access) for all
    const base = {};
    TRUST_LEVELS.forEach((lvl) => {
      base[lvl] = {};
      SCOPES.forEach(({ key }) => (base[lvl][key] = false));
    });
    return base;
  });

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");


  const navigate = useNavigate();
  const handleLogout = () => {
    try {
      // localStorage.removeItem("username");    //// TODO: solve it with multi users environment
      localStorage.removeItem("agent_trust");
    } finally {
      setSaving(false);
      setStatus("");
      navigate("/");
    }
  };

  useEffect(() => {
    savePolicy(effectiveUser, policy);
  }, [effectiveUser, policy]);

  const totals = useMemo(() => {
    const t = {};
    TRUST_LEVELS.forEach((lvl) => {
      t[lvl] = SCOPES.reduce((acc, { key }) => acc + (policy?.[lvl]?.[key] ? 1 : 0), 0);
    });
    return t;
  }, [policy]);

  const toggle = (level, scopeKey) => {
    setPolicy((p) => ({
      ...p,
      [level]: {
        ...p[level],
        [scopeKey]: !p[level][scopeKey],
      },
    }));
  };

  const setAllForLevel = (level, value) => {
    setPolicy((p) => ({
      ...p,
      [level]: SCOPES.reduce((acc, { key }) => ({ ...p[level], ...acc, [key]: value }), {}),
    }));
  };

  const handleSaveServer = async () => {
    setSaving(true);
    setStatus("");
    try {
      if (!API_BASE) {
        setStatus("Saved locally (no API base configured).");
        return;
      }
      const token = localStorage.getItem("token");
      const resp = await fetch(`${API_BASE}/api/policy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ username: effectiveUser, policy }),
      });
      if (!resp.ok) throw new Error(`Server responded ${resp.status}`);
      setStatus("Saved to server.");
    } catch (e) {
      setStatus(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="access-wrap">
      <h2 className="title">Agent Access Control</h2>
      <p className="subtle">User: <span className="mono">{effectiveUser}</span></p>
      

      <div className="bar">
        <button className="btn" onClick={() => setAllForLevel("high", true)}>High: Allow All</button>
        <button className="btn" onClick={() => setAllForLevel("high", false)}>High: Revoke All</button>
        <span className="spacer" />
        <button className="btn" onClick={() => setAllForLevel("medium", true)}>Medium: Allow All</button>
        <button className="btn" onClick={() => setAllForLevel("medium", false)}>Medium: Revoke All</button>
        <span className="spacer" />
        <button className="btn" onClick={() => setAllForLevel("low", true)}>Low: Allow All</button>
        <button className="btn" onClick={() => setAllForLevel("low", false)}>Low: Revoke All</button>
    
      </div>

      <div className="table-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th>Data Scope</th>
              {TRUST_LEVELS.map((lvl) => (
                <th key={lvl} className="th-center">{lvl.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCOPES.map(({ key, label }) => (
              <tr key={key}>
                <td><strong>{label}</strong></td>
                {TRUST_LEVELS.map((lvl) => (
                  <td key={lvl} className="td-center">
                    <input
                      type="checkbox"
                      checked={!!policy?.[lvl]?.[key]}
                      onChange={() => toggle(lvl, key)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total Allowed</td>
              {TRUST_LEVELS.map((lvl) => (
                <td key={lvl} className="td-center"><span className="badge">{totals[lvl]}</span></td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="bar">
        <button className="btn primary" onClick={handleSaveServer} disabled={saving}>
          {saving ? "Saving…" : "Save Policy"}
        </button>
        {status && <span className="status">{status}</span>}
      </div>

      <span className="spacer" />
        <button className="btn" onClick={handleLogout}>Log out</button>

      <details className="mt">
        <summary>JSON Preview</summary>
        <pre className="code-block">{JSON.stringify(policy, null, 2)}</pre>
      </details>
    </div>
  );
}