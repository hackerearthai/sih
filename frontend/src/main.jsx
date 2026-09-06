import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
<<<<<<< HEAD
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
=======
import "../../database/browser/workspace.css";
import * as api from "../../database/browser/api.mjs";

function LoginPage({ theme, onLogin, onTheme }) {
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [showPassword, setShowPassword] = useState(false); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError("");
    if (!username.trim() || !password) { setError("Enter your username and password."); return; }
    setLoading(true);
    try { await api.login(username.trim(), password); onLogin(); }
    catch (error) { setError(error.message); setPassword(""); }
    finally { setLoading(false); }
  };

  return <div className={`auth-shell ${theme}`}><section className="auth-visual" aria-label="Sentinel Records evidence integrity pipeline"><div className="evidence-grid" /><div className="evidence-signal signal-one" /><div className="evidence-signal signal-two" /><div className="pipeline" aria-label="Evidence to hash to chain anchored to verified"><div className="pipeline-line line-one" /><div className="pipeline-line line-two" /><div className="pipeline-line line-three" /><i className="pipeline-pulse pulse-one" /><i className="pipeline-pulse pulse-two" /><i className="pipeline-pulse pulse-three" /><div className="pipeline-stage"><span className="stage-icon document-icon"><FileText size={18} /></span><b>EVIDENCE</b><small>Record captured</small></div><div className="pipeline-stage"><span className="stage-icon hash-icon">#</span><b>HASH</b><small>Integrity fingerprint</small><em>8F3A...C921</em></div><div className="pipeline-stage"><span className="stage-icon chain-icon"><Blocks size={18} /></span><b>CHAIN ANCHORED</b><small>Immutable record</small></div><div className="pipeline-stage verified-stage"><span className="stage-icon verified-icon"><Check size={18} /></span><b>VERIFIED</b><small>Integrity confirmed</small></div></div><div className="pipeline-meta"><span>SHA-256</span><span>BLOCK #1,284,921</span></div><div className="evidence-caption">SECURE RECORDS / 2026</div></section><main className="auth-content"><button className="auth-theme-toggle" onClick={onTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button><div className="auth-card"><div className="auth-mark"><ShieldCheck size={25} /></div><h1>Sign in to Sentinel Records</h1><p>Secure access to your investigation workspace.</p><form onSubmit={submit} noValidate><label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" autoComplete="username" /></label><label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" /> <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></div></label>{error && <div className="auth-error" role="alert"><AlertTriangle size={15} />{error}</div>}<button className="auth-submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button></form><div className="auth-security"><LockKeyhole size={14} /><span><b>Secure authentication</b><small>Your investigation workspace is protected.</small></span></div></div></main></div>;
}



const WORKSPACES = api.workspaces;
const FILTERS = [["all", "All statuses"], ["clean", "Matched"], ["review", "Needs review"], ["tampered", "Integrity issue"]];
function StatusBadge({ doc }) {
  const values = { clean: [doc.isDemo ? "Matched (demo)" : "Verified", BadgeCheck, "green"], review: ["Review recommended", AlertTriangle, "amber"], tampered: ["Integrity issue", X, "red"] };
  const [label, Icon, tone] = values[doc.status] || values.review;
  return <span className={"status-badge " + tone}><Icon size={13} />{label}</span>;
}
function PanelHead({ title, subtitle, children }) {
  return <div className="panel-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{children}</div>;
}
function BackButton({ onClick }) { return <button className="back-link" onClick={onClick}>← Back to records</button>; }
function ErrorText({ error }) { return error && <p className="form-error" role="alert"><AlertTriangle size={15} />{error}</p>; }
function DemoTag({ doc }) { return doc.isDemo && <span className="demo-tag">DEMO</span>; }
function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const prior = document.activeElement;
    const focusables = () => [...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')];
    focusables()[0]?.focus();
    const key = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = focusables(), first = items[0], last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); prior?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section ref={ref} className="modal-card" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>{children}</section></div>;
}
function useResource(load, dependencies) {
  const [state, setState] = useState({ data: null, error: "", loading: true });
  useEffect(() => {
    let alive = true;
    setState({ data: null, error: "", loading: true });
    load().then((data) => alive && setState({ data, error: "", loading: false })).catch((error) => alive && setState({ data: null, error: error.message, loading: false }));
    return () => { alive = false; };
  }, dependencies);
  return state;
}
function DocumentTable({ docs, onSelect, onVerify, busy }) {
  return <div className="table-wrap"><table><thead><tr><th>Document</th><th>Status</th><th>Assigned to</th><th>Last modified</th><th>Actions</th></tr></thead><tbody>{docs.map((doc) => <tr key={doc.id}><td><button className="document-link" onClick={() => onSelect(doc)}><span className="file-icon"><FileText size={16} /></span><span><b>{doc.name}</b> <DemoTag doc={doc} /><small>{doc.caseReference || "No case reference"} · {doc.size} · {doc.workspace}</small></span></button></td><td><StatusBadge doc={doc} /></td><td>{doc.assignee || "Unassigned"}</td><td className="muted">{doc.modified}</td><td><button className="text-button" disabled={busy === doc.id} onClick={() => onVerify(doc)}>{busy === doc.id ? "Checking..." : "Verify now"} <ArrowUpRight size={14} /></button></td></tr>)}</tbody></table>{!docs.length && <div className="empty-state"><FolderOpen size={28} /><b>No matching records</b><span>Try another workspace, search, or filter.</span></div>}</div>;
}
function exportCsv(docs) {
  const escape = (value) => {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows = [["Filename","Case","Workspace","Status","Demo","Uploader","Assignee","SHA-256"], ...docs.map((d) => [d.name,d.caseReference,d.workspace,d.status,d.isDemo,d.uploader,d.assignee,d.hash])];
  const url = URL.createObjectURL(new Blob([rows.map((row) => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "sentinel-records.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Records({ docs, members, onSelect, onVerify, busy, initialQuery = "", initialFilter = "all", review = false, title = "All records" }) {
  const [query, setQuery] = useState(initialQuery); const [filter, setFilter] = useState(initialFilter); const [assignee, setAssignee] = useState(""); const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => { setQuery(initialQuery); }, [initialQuery]);
  useEffect(() => { setFilter(initialFilter); }, [initialFilter]);
  const rows = api.searchRecords(review ? docs.filter((d) => d.status !== "clean") : docs, query, { status: filter, assignee });
  return <section className="panel document-panel"><PanelHead title={title} subtitle={rows.length + " matching records"}><button className="icon-button" aria-label="Export matching records" onClick={() => exportCsv(rows)}><ArrowUpRight size={17} />Export</button></PanelHead><div className="toolbar records-toolbar"><label className="table-search"><Search size={15} /><input aria-label="Search document table" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filename, case, hash or assignee" /></label><button className="secondary-button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={14} />Filter</button><select aria-label="Document status" value={filter} onChange={(e) => setFilter(e.target.value)}>{FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>{filtersOpen && <div className="filter-panel"><label>Assigned to<select value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">Anyone</option>{members.map((m) => <option key={m.userId} value={m.userId}>{m.displayName || m.username}</option>)}</select></label><button className="secondary-button" onClick={() => { setQuery(""); setFilter("all"); setAssignee(""); }}>Clear filters</button><button className="primary-button" onClick={() => setFiltersOpen(false)}>Apply filters</button></div>}<DocumentTable docs={rows} onSelect={onSelect} onVerify={onVerify} busy={busy} /></section>;
}
function AskPanel({ docs, members, onSelect }) {
  const [query, setQuery] = useState(""); const [scope, setScope] = useState("all"); const [assignee, setAssignee] = useState(""); const [contextOpen, setContextOpen] = useState(false); const [assigneeOpen, setAssigneeOpen] = useState(false); const [result, setResult] = useState(null); const [error, setError] = useState("");
  const submit = () => {
    if (!query.trim()) { setError("Enter a question or a filename."); return; }
    const scoped = api.searchRecords(scope === "review" ? docs.filter((doc) => doc.status !== "clean") : docs, "", { assignee });
    setResult(api.answerRecords(scoped, query)); setError("");
  };
  return <><div className="command-panel"><textarea value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} placeholder="Search records or ask: how many need review?" aria-label="Ask about records" /><div className="command-footer"><button className="secondary-button" onClick={submit}><Search size={15} />Ask records</button><button className="secondary-button" onClick={() => setContextOpen(!contextOpen)}><FolderOpen size={14} />{scope === "all" ? "All records" : "Review queue"}<ChevronDown size={13} /></button><button className="icon-button" aria-label="Add context" onClick={() => setContextOpen(!contextOpen)}><Plus size={16} /></button><span /><button className="icon-button" aria-label="Select assignee" onClick={() => setAssigneeOpen(!assigneeOpen)}><Users size={16} /></button><button className="icon-button" aria-label="Send prompt" onClick={submit}><ArrowUpRight size={16} /></button></div>{contextOpen && <div className="filter-panel"><label>Record context<select value={scope} onChange={(e) => setScope(e.target.value)}><option value="all">All records</option><option value="review">Review queue</option></select></label><button className="secondary-button" onClick={() => setContextOpen(false)}>Done</button></div>}{assigneeOpen && <div className="filter-panel"><label>Assignee context<select value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">Anyone</option>{members.map((m) => <option key={m.userId} value={m.userId}>{m.username}</option>)}</select></label><button className="secondary-button" onClick={() => setAssigneeOpen(false)}>Done</button></div>}</div><ErrorText error={error} />{result && <section className="panel answer-panel"><PanelHead title="Record search result" subtitle="Based on saved metadata; document contents are not analyzed by AI."><button className="icon-button" aria-label="Close search result" onClick={() => setResult(null)}><X size={16} /></button></PanelHead><p>{result.text}</p>{result.docs.slice(0, 8).map((doc) => <button className="result-link" key={doc.id} onClick={() => onSelect(doc)}><FileText size={15} />{doc.name}<DemoTag doc={doc} /></button>)}</section>}</>;
}
function Metric({ label, value, icon: Icon, onClick }) { return <button className="metric metric-button" onClick={onClick}><Icon size={18} /><span><small>{label}</small><strong>{value}</strong><em>View records</em></span></button>; }
function ActivityList({ rows, onSelect, docs }) {
  return <>{rows.map((row) => <button key={row.id} className="activity-row activity-button" onClick={() => { const doc = docs.find((d) => d.id === row.docId); if (doc) onSelect(doc); }}><Activity size={16} /><span><b>{row.action} · {row.filename}</b><small>{row.detail || row.username}</small></span><time>{new Date(row.timestamp).toLocaleString()}</time></button>)}{!rows.length && <p className="empty-state">No recorded activity.</p>}</>;
}
function Dashboard({ docs, members, activity, onSelect, onVerify, busy, navigate, filter, defaultFilter }) {
  return <div className="page-body"><div className="page-heading"><div><span className="eyebrow">SENTINEL RECORDS</span><h1>Home</h1><p>Saved records, document checks, and team activity.</p></div><button className="primary-button" onClick={() => navigate("upload")}><Plus size={16} />Upload document</button></div>{docs.some((d) => d.isDemo) && <div className="demo-banner">Demo records are fictional. Their checks use local fingerprints, not blockchain verification.</div>}<AskPanel docs={docs} members={members} onSelect={onSelect} /><div className="quick-actions">{[["Upload document",UploadCloud,"upload"],["Audit activity",Clock3,"activity"],["Review Queue",FileCheck2,"review"],["Chain Explorer",Link2,"chain"]].map(([label,Icon,page]) => <button key={page} onClick={() => navigate(page)}><Icon size={15} />{label}</button>)}</div><div className="summary-grid"><Metric label="Total documents" value={docs.length} icon={FolderOpen} onClick={() => filter("all")} /><Metric label="Matched fingerprints" value={docs.filter((d) => d.status === "clean").length} icon={BadgeCheck} onClick={() => filter("clean")} /><Metric label="Needs attention" value={docs.filter((d) => d.status !== "clean").length} icon={AlertTriangle} onClick={() => navigate("review")} /><Metric label="Integrity issues" value={docs.filter((d) => d.status === "tampered").length} icon={Blocks} onClick={() => filter("tampered")} /></div><section className="panel"><PanelHead title="Recent activity" subtitle="Events saved in the database"><button className="text-button" onClick={() => navigate("activity")}>View all</button></PanelHead><ActivityList rows={activity.slice(0, 3)} docs={docs} onSelect={onSelect} /></section><Records title="Recent documents" docs={docs} members={members} onSelect={onSelect} onVerify={onVerify} busy={busy} initialFilter={defaultFilter} /></div>;
}
function UploadPage({ workspace, onSaved, onBack }) {
  const [file, setFile] = useState(null); const [demo, setDemo] = useState(true); const [target, setTarget] = useState(WORKSPACES.includes(workspace) ? workspace : WORKSPACES[0]); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const input = useRef(null);
  const choose = (candidate) => {
    if (!candidate || busy) return;
    if (candidate.size > 50 * 1024 * 1024) { setError("Files must be 50 MB or smaller."); return; }
    if (!/\.(pdf|docx|jpg|jpeg|png|zip|txt)$/i.test(candidate.name)) { setError("Use PDF, DOCX, JPG, PNG, ZIP or TXT."); return; }
    setFile(candidate); setError("");
  };
  const submit = async () => {
    if (!file || busy) return;
    setBusy(true); setError("");
    try {
      const result = await api.uploadDocument(file, { demo, workspace: target });
      if (!demo) {
        try { await api.updateDocument(result.docId, { workspace: target, caseReference: "", assignedTo: null }); }
        catch { onSaved("Document saved, but workspace update failed. Edit its details to retry."); return; }
      }
      onSaved(demo ? "Demo document saved. No blockchain registration was performed." : "Document saved and registered on-chain.");
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  };
  return <div className="page-body narrow"><BackButton onClick={onBack} /><h1>Upload a document</h1><div className="settings-form"><label>Destination workspace<select value={target} disabled={busy} onChange={(e) => setTarget(e.target.value)}>{WORKSPACES.map((w) => <option key={w}>{w}</option>)}</select></label><label className="check-label"><input type="checkbox" checked={demo} disabled={busy} onChange={(e) => setDemo(e.target.checked)} />Save as demo data (local fingerprint only)</label></div><p>{demo ? "This file will be clearly labeled as a demo. No blockchain or AI result is claimed." : "Requires your blockchain connection. The file is saved only after successful registration."}</p><input ref={input} type="file" hidden accept=".pdf,.docx,.jpg,.jpeg,.png,.zip,.txt" onChange={(e) => choose(e.target.files[0])} /><button className={"dropzone " + (file ? "done" : "")} disabled={busy} onClick={() => input.current.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files[0]); }}><UploadCloud size={30} /><b>{file ? file.name : "Choose a file or drop it here"}</b><small>PDF, DOCX, JPG, PNG, ZIP or TXT · Maximum 50 MB</small></button><ErrorText error={error} />{file && <div className="upload-actions"><button className="secondary-button" disabled={busy} onClick={() => { setFile(null); input.current.value = ""; }}>Remove file</button><button className="primary-button" disabled={busy} onClick={submit}>{busy ? "Saving..." : demo ? "Save demo document" : "Upload and register"}</button></div>}</div>;
}
function EditRecord({ doc, members, onClose, onSaved }) {
  const [form, setForm] = useState({ workspace: doc.workspace, caseReference: doc.caseReference || "", assignedTo: doc.assignedTo || "" }); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await api.updateDocument(doc.id, { ...form, assignedTo: form.assignedTo || null }); onSaved(); } catch (error) { setError(error.message); } finally { setBusy(false); } };
  return <Modal title="Edit document details" onClose={onClose}><form className="settings-form" onSubmit={submit}><label>Workspace<select value={form.workspace} onChange={(e) => setForm({ ...form, workspace: e.target.value })}>{WORKSPACES.map((w) => <option key={w}>{w}</option>)}</select></label><label>Case reference<input maxLength={80} value={form.caseReference} onChange={(e) => setForm({ ...form, caseReference: e.target.value })} /></label><label>Assigned to<select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}><option value="">Unassigned</option>{members.map((m) => <option key={m.userId} value={m.userId}>{m.displayName || m.username}</option>)}</select></label><ErrorText error={error} /><button className="primary-button" disabled={busy}>{busy ? "Saving..." : "Save document details"}</button></form></Modal>;
}
function VersionForm({ doc, onClose, onSaved }) {
  const [file, setFile] = useState(null); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async (e) => { e.preventDefault(); if (!file || !reason.trim()) { setError("Choose a file and explain this revision."); return; } if (file.size > 50 * 1024 * 1024) { setError("Files must be 50 MB or smaller."); return; } setBusy(true); try { await api.addVersion(doc, file, reason); onSaved(); } catch (error) { setError(error.message); } finally { setBusy(false); } };
  return <Modal title="Add document version" onClose={onClose}><form className="settings-form" onSubmit={submit}><p>{doc.isDemo ? "This is a demo revision; earlier versions remain available." : "A blockchain connection is required. Earlier versions remain available."}</p><label>New version file<input type="file" required onChange={(e) => setFile(e.target.files[0])} /></label><label>Reason for revision<textarea required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></label><ErrorText error={error} /><button className="primary-button" disabled={busy}>{busy ? "Saving..." : "Save new version"}</button></form></Modal>;
}
function DetailPage({ doc, members, revision, onChanged, onBack, onVerify, busy, notify }) {
  const detail = useResource(() => api.documentDetails(doc.id), [doc.id, revision]); const [modal, setModal] = useState(""); const [downloadBusy, setDownloadBusy] = useState(false); const [error, setError] = useState(""); const [result, setResult] = useState(null);
  useEffect(() => { setError(""); setResult(null); }, [doc.id]);
  const verify = async () => { setError(""); try { setResult(await onVerify(doc, true)); } catch (error) { setError(error.message); } };
  const download = async (version) => { setDownloadBusy(true); setError(""); try { await api.downloadDocument(doc, version); notify("Download started"); } catch (error) { setError(error.message); } finally { setDownloadBusy(false); } };
  const saved = () => { setModal(""); onChanged(); notify("Document updated"); };
  return <div className="page-body records-page"><BackButton onClick={onBack} /><div className="detail-top"><div><span className="eyebrow">DOCUMENT RECORD <DemoTag doc={doc} /></span><h1>{doc.name}</h1><p>{doc.caseReference || "No case reference"} · {doc.workspace} · {doc.size}</p><p>Uploaded by {doc.uploader} · Assigned to {doc.assignee || "no one"}</p></div><div className="action-group"><button className="secondary-button" disabled={downloadBusy} onClick={() => download()}>Download</button><button className="secondary-button" onClick={() => setModal("edit")}>Edit details</button><button className="primary-button" disabled={busy === doc.id} onClick={verify}>{busy === doc.id ? "Checking..." : "Verify integrity"}</button></div></div>{doc.isDemo && <div className="demo-banner">Fictional demo record. Verification compares the file to its saved local fingerprint.</div>}<ErrorText error={error || detail.error} />{result && <div className={"verification-result " + (result.status === "tampered" ? "bad" : "")}><BadgeCheck size={22} /><span><b>{result.status === "tampered" ? "Fingerprint mismatch detected" : "Fingerprint matched"}</b><small>{result.source === "local-demo" ? "Local demo check only. This is not blockchain verification." : "Checked against the on-chain record."}</small></span></div>}{detail.loading && <p role="status">Loading document...</p>}{detail.data && <><section className="panel"><PanelHead title="Saved fingerprint" subtitle="SHA-256" /><p className="hash-value">{detail.data.docHash}</p><p className="panel-copy">{doc.flagReason}</p></section><section className="panel"><PanelHead title="Version history" subtitle={detail.data.versions.length + " saved versions"}><button className="secondary-button" onClick={() => setModal("version")}><Plus size={15} />Add version</button></PanelHead>{detail.data.versions.map((v) => <div className="version-row" key={v.version}><b>v{v.version}</b><span>{v.reason}<small>{new Date(v.timestamp).toLocaleString()}</small></span><button className="text-button" disabled={downloadBusy} onClick={() => download(v.version)}>Download v{v.version}</button></div>)}</section><History doc={doc} revision={revision} /></>}{modal === "edit" && <EditRecord doc={doc} members={members} onClose={() => setModal("")} onSaved={saved} />}{modal === "version" && <VersionForm doc={doc} onClose={() => setModal("")} onSaved={saved} />}</div>;
}
function History({ doc, revision = 0 }) {
  const [retry, setRetry] = useState(0);
  const { data, error, loading } = useResource(() => api.documentHistory(doc.id), [doc.id, revision, retry]);
  return <section className="panel"><PanelHead title={doc.isDemo ? "Demo audit history" : "Blockchain history"} subtitle={doc.isDemo ? "Events saved locally; no blockchain transactions" : "Events from the deployed contract"}><button className="icon-button" aria-label="Refresh history" onClick={() => setRetry((v) => v + 1)}><Clock3 size={16} />Refresh</button></PanelHead>{loading && <p className="panel-copy">Loading history...</p>}<ErrorText error={error} />{data?.rows.map((row, i) => <div className="activity-row" key={i}><Activity size={16} /><span><b>{row.action} · {row.userId}</b><small>{row.detail || (data.source === "local-demo" ? "Local demo event" : "Blockchain event")}</small></span><time>{new Date(row.timestamp).toLocaleString()}</time></div>)}{data && !data.rows.length && <p className="empty-state">No history recorded.</p>}</section>;
}
function ChainPage({ docs, onSelect }) {
  const [id, setId] = useState(docs[0]?.id || ""); const doc = docs.find((d) => d.id === id);
  return <div className="page-body records-page"><h1>Chain Explorer</h1><p>Inspect blockchain history for real records and local audit history for demo records.</p><div className="filter-panel"><label>Document<select value={id} onChange={(e) => setId(e.target.value)}><option value="">Select a document</option>{docs.map((d) => <option key={d.id} value={d.id}>{d.name}{d.isDemo ? " (demo)" : ""}</option>)}</select></label>{doc && <button className="secondary-button" onClick={() => onSelect(doc)}>Open document</button>}</div>{doc ? <History key={doc.id} doc={doc} /> : <p className="empty-state">Select a saved record.</p>}</div>;
}
function ActivityPage({ docs, rows, onSelect, onRefresh }) {
  const [query, setQuery] = useState(""); const [action, setAction] = useState("all");
  const filtered = rows.filter((row) => (action === "all" || action === row.action) && (row.filename + " " + row.username + " " + row.detail).toLowerCase().includes(query.toLowerCase()));
  return <div className="page-body records-page"><div className="page-heading"><div><h1>Audit activity</h1><p>Actions recorded in the database.</p></div><button className="secondary-button" onClick={onRefresh}>Refresh activity</button></div><div className="toolbar"><label className="table-search"><Search size={16} /><input aria-label="Search activity" placeholder="Document, person or event" value={query} onChange={(e) => setQuery(e.target.value)} /></label><select aria-label="Activity action" value={action} onChange={(e) => setAction(e.target.value)}>{["all","view","download","upload","verify","share"].map((value) => <option key={value} value={value}>{value === "all" ? "All actions" : value}</option>)}</select></div><section className="panel"><ActivityList rows={filtered} docs={docs} onSelect={onSelect} /></section></div>;
}
function TeamPage({ members, role, onChanged, notify }) {
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(""); const [form, setForm] = useState({ username: "", displayName: "", password: "", role: "investigator" }); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async (e) => { e.preventDefault(); setBusy(true); setError(""); try { await api.addMember(form); setOpen(false); setForm({ username: "", displayName: "", password: "", role: "investigator" }); onChanged(); notify("Local account created. No invitation message was sent."); } catch (error) { setError(error.message); } finally { setBusy(false); } };
  return <div className="page-body records-page"><div className="page-heading"><div><h1>Team access</h1><p>Accounts stored in this workspace database.</p></div>{role === "admin" && <button className="primary-button" onClick={() => setOpen(true)}><Plus size={16} />Add member</button>}</div>{role !== "admin" && <p>Only administrators can create accounts.</p>}<label className="table-search"><Search size={15} /><input aria-label="Search team" placeholder="Search members" value={query} onChange={(e) => setQuery(e.target.value)} /></label><section className="panel table-wrap"><table><thead><tr><th>Name</th><th>Username</th><th>Role</th></tr></thead><tbody>{members.filter((m) => (m.username + " " + m.displayName).toLowerCase().includes(query.toLowerCase())).map((m) => <tr key={m.userId}><td>{m.displayName || m.username}</td><td>{m.username}</td><td>{m.role.replace("_", " ")}</td></tr>)}</tbody></table></section>{open && <Modal title="Add local team member" onClose={() => setOpen(false)}><form className="settings-form" onSubmit={submit}><p>Creates a local sign-in account. No email or invitation is sent.</p><label>Display name<input value={form.displayName} maxLength={100} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label><label>Username<input required minLength={3} maxLength={40} autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label><label>Password<input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label><label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="investigator">Investigator</option><option value="court_clerk">Court clerk</option><option value="admin">Administrator</option></select></label><ErrorText error={error} /><button className="primary-button" disabled={busy}>{busy ? "Creating..." : "Create account"}</button></form></Modal>}</div>;
}
function SettingsPage({ preferences, onSave, profile = false }) {
  const [form, setForm] = useState(preferences); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState(false);
  useEffect(() => setForm(preferences), [preferences]);
  const submit = async (e) => { e.preventDefault(); setBusy(true); setError(""); setSaved(false); try { await onSave(form); setSaved(true); } catch (error) { setError(error.message); } finally { setBusy(false); } };
  return <div className="page-body narrow"><h1>{profile ? "My profile" : "Settings"}</h1><p>Preferences are saved to your database account.</p><form className="settings-form panel form-panel" onSubmit={submit}><label>Display name<input value={form.displayName} maxLength={100} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label><label>Default workspace<select value={form.workspace} onChange={(e) => setForm({ ...form, workspace: e.target.value })}><option>All workspaces</option>{WORKSPACES.map((w) => <option key={w}>{w}</option>)}</select></label><label>Theme<select value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })}><option value="dark">Dark</option><option value="light">Light</option></select></label><label>Default document filter<select value={form.defaultFilter} onChange={(e) => setForm({ ...form, defaultFilter: e.target.value })}>{FILTERS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="check-label"><input type="checkbox" checked={form.notifications} onChange={(e) => setForm({ ...form, notifications: e.target.checked })} />Show notification indicator</label><ErrorText error={error} />{saved && <p role="status">Preferences saved.</p>}<button className="primary-button" disabled={busy}>{busy ? "Saving..." : "Save preferences"}</button></form></div>;
}
function Sidebar({ active, navigate, docs, prefs, onPreferences, profile, filter, mobile }) {
  return <div className={"sidebar-wrap " + (mobile ? "open" : "")}><aside className="sidebar"><div className="brand"><div className="brand-mark"><ShieldCheck size={21} /></div><div><strong>Sentinel Records</strong><small>Document workspace</small></div></div><label className="workspace-control">Workspace<select aria-label="Workspace" value={prefs.workspace} onChange={(e) => onPreferences({ ...prefs, workspace: e.target.value })}><option>All workspaces</option>{WORKSPACES.map((w) => <option key={w}>{w}</option>)}</select></label><nav><small className="nav-label">WORKSPACE</small>{[["dashboard","Dashboard",Activity],["records","All records",FolderOpen],["upload","Upload document",UploadCloud],["activity","Audit activity",Clock3],["review","Review Queue",FileCheck2],["chain","Chain Explorer",Blocks],["team","Team access",Users],["settings","Settings",Settings]].map(([page,label,Icon]) => <button key={page} className={"nav-item " + (active === page ? "active" : "")} onClick={() => navigate(page)}><Icon size={16} />{label}</button>)}</nav><div className="sidebar-bottom"><section className="integrity-monitor"><small className="nav-label">INTEGRITY MONITOR</small><button className="integrity-row" onClick={() => filter("clean")}><BadgeCheck size={14} /><span>Matched</span><b>{docs.filter((d) => d.status === "clean").length} / {docs.length}</b></button><button className="integrity-row" onClick={() => navigate("review")}><AlertTriangle size={14} /><span>Needs review</span><b>{docs.filter((d) => d.status !== "clean").length}</b></button></section><button className="user-card" onClick={() => navigate("profile")}><span className="avatar">{profile.username?.slice(0,2).toUpperCase()}</span><span><b>{prefs.displayName || profile.username}</b><small>{profile.role?.replace("_", " ")}</small></span><MoreHorizontal size={17} /></button></div></aside></div>;
}
function Topbar({ title, navigate, prefs, onPreferences, profile, notifications, onRead, onSelect, docs, logout, toggleMenu, onSearch }) {
  const [query, setQuery] = useState(""); const [open, setOpen] = useState(""); const ref = useRef(null); const input = useRef(null);
  useEffect(() => {
    const outside = (e) => { if (!ref.current?.contains(e.target)) setOpen(""); };
    const key = (e) => { if (e.key === "Escape") setOpen(""); if (e.key === "/" && !["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName) && !e.target.isContentEditable) { e.preventDefault(); input.current.focus(); } };
    document.addEventListener("mousedown", outside); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", key); };
  }, []);
  const unread = notifications.filter((n) => !n.read);
  return <header className="topbar"><button className="icon-button menu-button" aria-label="Open navigation" onClick={toggleMenu}><Menu size={20} /></button><div className="topbar-brand"><ShieldCheck size={22} /><strong>Sentinel Records</strong><span>/</span><b>{title}</b></div><form className="global-search" onSubmit={(e) => { e.preventDefault(); onSearch(query); }}><Search size={16} /><input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search records, cases or hashes" aria-label="Search records" /><button className="icon-button" aria-label="Run global search" type="submit"><ArrowUpRight size={14} /></button><kbd>/</kbd></form><div className="top-actions" ref={ref}><button className="icon-button" aria-label="Team access" onClick={() => navigate("team")}><Users size={17} /></button><div className="menu-anchor"><button className="icon-button notification" aria-label="Notifications" onClick={() => setOpen(open === "notifications" ? "" : "notifications")}><Bell size={18} />{prefs.notifications && unread.length > 0 && <i />}</button>{open === "notifications" && <div className="menu-popover right notification-menu"><b>Notifications · {unread.length} unread</b>{notifications.length ? <>{notifications.slice(0,20).map((n) => <button className={n.read ? "read-notification" : ""} key={n.docId} onClick={() => { onRead([n.docId]); const doc = docs.find((d) => d.id === n.docId); if (doc) onSelect(doc); setOpen(""); }}><AlertTriangle size={14} /><span>{n.filename}<small>{n.isDemo ? "Demo record needs review" : "Record needs review"}</small></span></button>)}<button onClick={() => onRead(unread.map((n) => n.docId))}>Mark all as read</button></> : <p>No notifications.</p>}</div>}</div><button className="icon-button" aria-label={"Switch to " + (prefs.theme === "dark" ? "light" : "dark") + " mode"} onClick={() => onPreferences({ ...prefs, theme: prefs.theme === "dark" ? "light" : "dark" })}>{prefs.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button><div className="menu-anchor"><button className="avatar profile-avatar" aria-label="Open profile menu" onClick={() => setOpen(open === "profile" ? "" : "profile")}>{profile.username?.slice(0,2).toUpperCase()}</button>{open === "profile" && <div className="menu-popover right"><b>{prefs.displayName || profile.username}</b><button onClick={() => { setOpen(""); navigate("profile"); }}>Profile settings</button><button onClick={logout}>Log out</button></div>}</div></div></header>;
}
const routePages = new Set(["dashboard","records","upload","activity","review","chain","detail","team","settings","profile"]);
function pageFromLocation() { const page = location.pathname.split("/").filter(Boolean)[0] || "dashboard"; return routePages.has(page) ? page : "dashboard"; }
function App() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(api.getSession()?.token)); const [active, setActive] = useState(pageFromLocation); const [allDocs, setDocs] = useState([]); const [members, setMembers] = useState([]); const [events, setEvents] = useState([]); const [notifications, setNotifications] = useState([]); const [profile, setProfile] = useState(api.getSession() || {}); const [prefs, setPrefs] = useState({ ...api.defaultPreferences, theme: localStorage.getItem("sentinel-theme") || "dark" }); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [revision, setRevision] = useState(0); const [selectedId, setSelectedId] = useState(new URLSearchParams(location.search).get("document")); const [mobile, setMobile] = useState(false); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(""); const [search, setSearch] = useState(new URLSearchParams(location.search).get("q") || ""); const [filter, setFilter] = useState("all"); const noticeTimer = useRef(null);
  const notify = (message) => { setNotice(message); clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(""), 6000); };
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  const logout = () => { api.clearSession(); setAuthenticated(false); setDocs([]); setEvents([]); setMembers([]); setNotifications([]); setSelectedId(null); setActive("dashboard"); setError(""); history.replaceState({}, "", "/"); };
  useEffect(() => { window.addEventListener("sentinel-session-expired", logout); return () => window.removeEventListener("sentinel-session-expired", logout); }, []);
  useEffect(() => {
    if (!authenticated) return;
    let alive = true; setLoading(true); setError("");
    Promise.all([api.currentUser(),api.listDocuments(),api.members(),api.activity(),api.notifications(),api.preferences()]).then(([user, docs, team, activity, alerts, preferences]) => {
      if (!alive) return; setProfile(user); setDocs(docs); setMembers(team); setEvents(activity); setNotifications(alerts); setPrefs({ ...api.defaultPreferences, ...preferences });
    }).catch((error) => alive && setError(error.message)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [authenticated]);
  const refresh = async () => {
    const [docs, team, activity, alerts] = await Promise.all([api.listDocuments(),api.members(),api.activity(),api.notifications()]);
    setDocs(docs); setMembers(team); setEvents(activity); setNotifications(alerts); setRevision((v) => v + 1);
  };
  const changed = () => refresh().catch((error) => notify(error.message));
  const navigate = (page, params = "") => { history.pushState({}, "", (page === "dashboard" ? "/" : "/" + page) + params); setActive(page); setMobile(false); };
  const select = (doc) => { setSelectedId(doc.id); navigate("detail", "?document=" + encodeURIComponent(doc.id)); };
  const filterRecords = (value) => { setFilter(value); setSearch(""); navigate("records"); };
  const globalSearch = (query) => { setSearch(query); setFilter("all"); navigate("records", "?q=" + encodeURIComponent(query)); };
  useEffect(() => {
    const pop = () => { setActive(pageFromLocation()); setSelectedId(new URLSearchParams(location.search).get("document")); setSearch(new URLSearchParams(location.search).get("q") || ""); setMobile(false); };
    const escape = (e) => { if (e.key === "Escape") setMobile(false); };
    window.addEventListener("popstate", pop); window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("popstate", pop); window.removeEventListener("keydown", escape); };
  }, []);
  const savePrefs = async (form) => { const saved = await api.savePreferences(form); setPrefs({ ...api.defaultPreferences, ...saved }); localStorage.setItem("sentinel-theme", saved.theme); };
  const quickPrefs = (form) => savePrefs(form).catch((error) => notify(error.message));
  const onRead = async (ids) => { try { await api.markRead(ids); setNotifications(await api.notifications()); } catch (error) { notify(error.message); } };
  const verify = async (doc, throwError = false) => {
    if (busy) return;
    setBusy(doc.id);
    try {
      const result = await api.verifyDocument(doc.id);
      const updated = api.toDocument({ ...doc, filename: doc.name, status: result.status });
      setDocs((rows) => rows.map((d) => d.id === doc.id ? updated : d));
      notify((doc.isDemo ? "Demo fingerprint: " : "Blockchain check: ") + (result.status === "verified" ? "matched" : "mismatch detected"));
      const [activity, alerts] = await Promise.all([api.activity(),api.notifications()]); setEvents(activity); setNotifications(alerts); setRevision((v) => v + 1);
      return result;
    } catch (error) { if (throwError) throw error; notify(error.message); } finally { setBusy(""); }
  };
  const docs = prefs.workspace === "All workspaces" ? allDocs : allDocs.filter((d) => d.workspace === prefs.workspace);
  const scopedEvents = prefs.workspace === "All workspaces" ? events : events.filter((e) => e.workspace === prefs.workspace);
  const selected = allDocs.find((d) => d.id === selectedId);
  if (!authenticated) return <LoginPage theme={prefs.theme} onTheme={() => setPrefs({ ...prefs, theme: prefs.theme === "dark" ? "light" : "dark" })} onLogin={() => { setAuthenticated(true); navigate("dashboard"); }} />;
  const title = { dashboard:"Dashboard", records:"All records",upload:"Upload document",activity:"Audit activity",review:"Review Queue",chain:"Chain Explorer",detail:"Document detail",team:"Team access",settings:"Settings",profile:"My profile" }[active];
  return <div className={"app-shell connected-app " + prefs.theme} data-theme={prefs.theme}><Topbar title={title} navigate={navigate} prefs={prefs} onPreferences={quickPrefs} profile={profile} notifications={notifications} onRead={onRead} onSelect={select} docs={allDocs} logout={logout} toggleMenu={() => setMobile(!mobile)} onSearch={globalSearch} /><div className="app-body"><Sidebar active={active} navigate={navigate} docs={docs} prefs={prefs} onPreferences={quickPrefs} profile={profile} filter={filterRecords} mobile={mobile} /><main>{loading ? <div className="page-body" role="status">Loading saved records...</div> : error ? <div className="page-body"><ErrorText error={error} /><button className="primary-button" onClick={() => { setLoading(true); refresh().then(() => setError("")).catch((e) => setError(e.message)).finally(() => setLoading(false)); }}>Retry connection</button></div> : <>{active === "dashboard" && <Dashboard docs={docs} members={members} activity={scopedEvents} onSelect={select} onVerify={verify} busy={busy} navigate={navigate} filter={filterRecords} defaultFilter={prefs.defaultFilter} />}{active === "records" && <div className="page-body records-page"><h1>All records</h1><Records docs={docs} members={members} onSelect={select} onVerify={verify} busy={busy} initialQuery={search} initialFilter={filter} /></div>}{active === "review" && <div className="page-body records-page"><h1>Review Queue</h1><Records review docs={docs} members={members} onSelect={select} onVerify={verify} busy={busy} title="Records requiring review" /></div>}{active === "upload" && <UploadPage workspace={prefs.workspace} onBack={() => navigate("dashboard")} onSaved={(message) => { notify(message); changed(); navigate("records"); }} />}{active === "activity" && <ActivityPage docs={allDocs} rows={scopedEvents} onSelect={select} onRefresh={changed} />}{active === "detail" && (selected ? <DetailPage key={selected.id} doc={selected} members={members} revision={revision} onChanged={changed} onBack={() => navigate("records")} onVerify={verify} busy={busy} notify={notify} /> : <div className="page-body"><BackButton onClick={() => navigate("records")} /><p>Document not found.</p></div>)}{active === "chain" && <ChainPage key={prefs.workspace} docs={docs} onSelect={select} />}{active === "team" && <TeamPage members={members} role={profile.role} onChanged={changed} notify={notify} />}{["settings","profile"].includes(active) && <SettingsPage key={active} preferences={prefs} onSave={savePrefs} profile={active === "profile"} />}</>}</main></div>{notice && <div className="toast" role="status">{notice}<button aria-label="Dismiss notification" className="icon-button" onClick={() => setNotice("")}><X size={15} /></button></div>}</div>;
}
createRoot(document.getElementById("root")).render(<App />);

>>>>>>> 58ce6d1 (Updated Database)
