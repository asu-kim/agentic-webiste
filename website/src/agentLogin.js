import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
function genHexNonce32() {
  if (window?.crypto?.getRandomValues) {
    const arr = new Uint8Array(16); // 16 bytes -> 32 hex
    window.crypto.getRandomValues(arr);
    return bytesToHex(arr);
  }
  let out = ''; for (let i = 0; i < 16; i++) out += Math.floor(Math.random()*256).toString(16).padStart(2,'0');
  return out;
}

export default function AgentLogin() {
  const navigate = useNavigate();
  const [nonce, setNonce] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [hmacHex, setHmacHex] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const API_BASE = 'http://127.0.0.1:5000';

  useEffect(() => { setNonce(genHexNonce32()); }, []);

  const handleRegen = () => {
    setNonce(genHexNonce32());
    setHmacHex('');
    setErr('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);

    try {   
      const resp = await fetch(`${API_BASE}/api/agent/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_id: tokenId,
          nonce_hex: nonce,
          user_hmac_hex: hmacHex
        })
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) {
        throw new Error(data?.error || `Verification failed (${resp.status})`);
      }

      const trust = data.trust_level || "low";
      localStorage.setItem("agent_trust", trust);

      const ttlMs = Number(data.session_validity || 0);
      if (ttlMs > 0) {
        const expiresAtMs = Date.now() + ttlMs;
        localStorage.setItem("agent_session_expires_at", String(expiresAtMs));
      } else {
        localStorage.removeItem("agent_session_expires_at");
      }

      const agentName = trust + "Trust" + "Agent";
      localStorage.setItem("agentname", agentName);
      navigate('/dashboard');
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="card">
        <h2>AI Agent Login</h2>
        <form onSubmit={handleSubmit} className="form">
          <label className="label">Random Nonce (32-digit hex)</label>
          <div className="row">
            <input className="input monospace" id="nonceHex" type="text" value={nonce} readOnly />
          </div>
          <div className="row gap">
            <button type="button" className="btn secondary" onClick={() => navigator.clipboard.writeText(nonce)}>Copy</button>
            <button type="button" className="btn" onClick={handleRegen}>Regenerate</button>
          </div>

          <label className="label">Token ID</label>
          <input
            className="input"
            type="text"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="00000000"
            required
          />

          <label className="label">HMAC-SHA256(nonce, key=session key)</label>
          <input
            className="input monospace"
            type="text"
            id="hmac"
            value={hmacHex}
            onChange={(e) => setHmacHex(e.target.value.trim())}
            placeholder="64-digit hex"
            required
            pattern="^[0-9a-fA-F]{64}$"
            title="64 digit"
          />

          <button className="btn primary" type="submit" disabled={!nonce || !tokenId || !hmacHex || loading}>
            {loading ? 'Verifying…' : 'Verify'}
          </button>
          {err && <div className="error">{err}</div>}
        </form>
      </div>
    </div>
  );
}