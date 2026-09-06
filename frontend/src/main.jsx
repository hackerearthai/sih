import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import {
  login, logout, getDocuments, getDocument, getDocumentHistory,
  verifyDocument, uploadDocument
} from "./api";

const fmt = v => v ? new Date(v).toLocaleString() : "—";
const status = s => s === "tampered" ? "Tampered" : s === "pending" ? "Pending" : "Verified";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const r = await login(username, password);
      localStorage.setItem("sentinel-token", r.token);
      localStorage.setItem("sentinel-user", JSON.stringify({
        userId: r.userId, role: r.role, username
      }));
      onLogin();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return <main className="login-page"><section className="login-card">
    <h1>Sentinel</h1><p>Secure digital evidence integrity platform</p>
    <form onSubmit={submit}>
      <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />
      <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" />
      {error && <div className="error">{error}</div>}
      <button disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
    </form>
  </section></main>;
}

function App() {
  const [page, setPage] = useState("dashboard");
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const user = JSON.parse(localStorage.getItem("sentinel-user") || "null");

  async function reload() {
    setLoading(true); setError("");
    try { setDocs(await getDocuments()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { reload(); }, []);

  async function upload() {
    if (!file) return;
    setLoading(true); setError(""); setMessage("");
    try {
      const r = await uploadDocument(file, user.userId);
      setMessage(`Uploaded successfully. Blockchain tx: ${r.txHash}`);
      setFile(null); await reload();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function openDoc(id) {
    setError("");
    try { setSelected(id); setDetail(await getDocument(id)); }
    catch (e) { setError(e.message); }
  }

  async function verify(id) {
    setLoading(true); setError(""); setMessage("");
    try {
      const r = await verifyDocument(id);
      setMessage(`${status(r.status)} — current hash: ${r.currentHash}`);
      await reload();
      if (selected === id) setDetail(await getDocument(id));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function signOut() { logout(); window.location.reload(); }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><h2>Sentinel</h2><span>Evidence Integrity</span></div>
      <nav>
        <button className={page==="dashboard"?"active":""} onClick={()=>setPage("dashboard")}>Dashboard</button>
        <button className={page==="documents"?"active":""} onClick={()=>setPage("documents")}>Documents</button>
        <button className={page==="chain"?"active":""} onClick={()=>setPage("chain")}>Chain Explorer</button>
      </nav>
      <div className="sidebar-user">
        <strong>{user?.username || user?.userId}</strong><small>{user?.role}</small>
        <button onClick={signOut}>Logout</button>
      </div>
    </aside>

    <main className="main-content">
      {error && <div className="global-error">{error}</div>}
      {loading && <div className="loading-bar">Working…</div>}

      {page === "dashboard" && <section className="page">
        <div className="page-header"><div><h1>Dashboard</h1><p>Live backend data.</p></div></div>
        <div className="stats-grid">
          <div className="stat-card"><span>Total</span><strong>{docs.length}</strong></div>
          <div className="stat-card"><span>Verified</span><strong>{docs.filter(d=>d.status==="verified").length}</strong></div>
          <div className="stat-card"><span>Tampered</span><strong>{docs.filter(d=>d.status==="tampered").length}</strong></div>
          <div className="stat-card"><span>AI review</span><strong>{docs.filter(d=>d.aiRiskFlag==="review_recommended").length}</strong></div>
        </div>
      </section>}

      {page === "documents" && <section className="page">
        <div className="page-header"><div><h1>Documents</h1><p>Upload and verify through the backend.</p></div></div>
        <div className="panel upload-panel">
          <h2>Upload document</h2>
          <input type="file" onChange={e=>setFile(e.target.files?.[0] || null)} />
          <button onClick={upload} disabled={!file || loading}>Upload & register</button>
          {message && <div className="success">{message}</div>}
        </div>
        <div className="panel"><h2>Registered documents</h2>
          {docs.length === 0 ? <p>No documents returned by backend.</p> :
          <div className="table-wrap"><table><thead><tr>
            <th>Filename</th><th>Status</th><th>AI</th><th>Uploader</th><th>Timestamp</th><th>Actions</th>
          </tr></thead><tbody>
            {docs.map(d=><tr key={d.docId}>
              <td>{d.filename}</td><td>{status(d.status)}</td><td>{d.aiRiskFlag || "—"}</td>
              <td>{d.uploaderId}</td><td>{fmt(d.timestamp)}</td>
              <td><button onClick={()=>openDoc(d.docId)}>Details</button>
              <button onClick={()=>verify(d.docId)} disabled={loading}>Verify</button></td>
            </tr>)}
          </tbody></table></div>}
        </div>
      </section>}

      {page === "chain" && <Chain docs={docs} />}

      {detail && <div className="modal-backdrop"><div className="modal">
        <div className="page-header"><div><h2>{detail.filename}</h2><p>{detail.docId}</p></div>
        <button onClick={()=>{setDetail(null);setSelected(null)}}>Close</button></div>
        <div className="detail-grid">
          <div><span>Status</span><strong>{status(detail.status)}</strong></div>
          <div><span>Uploader</span><strong>{detail.uploaderId}</strong></div>
          <div><span>Hash</span><strong className="hash">{detail.docHash}</strong></div>
          <div><span>AI flag</span><strong>{detail.aiRiskFlag || "—"}</strong></div>
        </div>
        <h3>Blockchain / access history</h3>
        {(detail.history || []).map((h,i)=><div className="history-item" key={i}>
          <strong>{h.action}</strong><span>{h.userId || "—"}</span><time>{fmt(h.timestamp)}</time>
        </div>)}
      </div></div>}
    </main>
  </div>;
}

function Chain({ docs }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    const all = [];
    for (const d of docs.slice(0,20)) {
      try {
        const h = await getDocumentHistory(d.docId);
        all.push(...h.map(x=>({...x,docId:d.docId,filename:d.filename})));
      } catch {}
    }
    all.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
    setEvents(all); setLoading(false);
  }
  useEffect(()=>{ load(); }, [docs.length]);
  return <section className="page"><div className="page-header">
    <div><h1>Chain Explorer</h1><p>Blockchain history via backend API.</p></div>
    <button onClick={load}>{loading?"Loading...":"Refresh"}</button>
  </div><div className="panel"><div className="table-wrap"><table>
    <thead><tr><th>Action</th><th>Document</th><th>Actor</th><th>Version</th><th>Timestamp</th></tr></thead>
    <tbody>{events.map((e,i)=><tr key={i}><td>{e.action}</td><td>{e.filename}</td><td>{e.userId||"—"}</td><td>{e.version||"—"}</td><td>{fmt(e.timestamp)}</td></tr>)}</tbody>
  </table></div></div></section>;
}

function Root() {
  const [loggedIn, setLoggedIn] = useState(Boolean(localStorage.getItem("sentinel-token")));
  return loggedIn ? <App /> : <Login onLogin={()=>setLoggedIn(true)} />;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><Root /></React.StrictMode>);
