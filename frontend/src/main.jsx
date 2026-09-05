import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, AlertTriangle, ArrowUpRight, BadgeCheck, Bell, Blocks, Check,
  ChevronDown, Clock3, FileCheck2, FileText, Fingerprint, FolderOpen,
  Link2, LockKeyhole, Menu, MoreHorizontal, Moon, Plus, Search, Settings,
  ShieldCheck, SlidersHorizontal, Sun, UploadCloud, Users, X,
} from "lucide-react";
import "./styles.css";
import {
  getDocument,
  getDocumentHistory,
  getDocuments,
  login,
  logout,
  uploadDocument,
  verifyDocument,
} from "./api";

function LoginPage({ theme, onLogin, onTheme }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }

    setLoading(true);

    try {
      const result = await login(username.trim(), password);

      localStorage.setItem("sentinel-token", result.token);
      localStorage.setItem("sentinel-user-id", result.userId);
      localStorage.setItem("sentinel-role", result.role);

      onLogin(result);
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`auth-shell ${theme}`}>
      <section className="auth-visual" aria-label="Sentinel Records evidence integrity pipeline">
        <div className="evidence-grid" />
        <div className="evidence-signal signal-one" />
        <div className="evidence-signal signal-two" />
        <div className="pipeline">
          <div className="pipeline-line line-one" />
          <div className="pipeline-line line-two" />
          <div className="pipeline-line line-three" />
          <i className="pipeline-pulse pulse-one" />
          <i className="pipeline-pulse pulse-two" />
          <i className="pipeline-pulse pulse-three" />
          <div className="pipeline-stage">
            <span className="stage-icon document-icon"><FileText size={18} /></span>
            <b>EVIDENCE</b><small>Record captured</small>
          </div>
          <div className="pipeline-stage">
            <span className="stage-icon hash-icon">#</span>
            <b>HASH</b><small>Integrity fingerprint</small><em>SHA-256</em>
          </div>
          <div className="pipeline-stage">
            <span className="stage-icon chain-icon"><Blocks size={18} /></span>
            <b>CHAIN ANCHORED</b><small>Immutable record</small>
          </div>
          <div className="pipeline-stage verified-stage">
            <span className="stage-icon verified-icon"><Check size={18} /></span>
            <b>VERIFIED</b><small>Integrity confirmed</small>
          </div>
        </div>
        <div className="pipeline-meta"><span>SHA-256</span><span>HARDHAT / 31337</span></div>
        <div className="evidence-caption">SECURE RECORDS / 2026</div>
      </section>

      <main className="auth-content">
        <button
          className="auth-theme-toggle"
          onClick={onTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="auth-card">
          <div className="auth-mark"><ShieldCheck size={25} /></div>
          <h1>Sign in to Sentinel Records</h1>
          <p>Secure access to your investigation workspace.</p>

          <form onSubmit={submit} noValidate>
            <label>
              Username
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
              />
            </label>

            <label>
              Password
              <div className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            {error && (
              <div className="auth-error" role="alert">
                <AlertTriangle size={15} />{error}
              </div>
            )}

            <button className="auth-submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="auth-security">
            <LockKeyhole size={14} />
            <span><b>Secure authentication</b><small>Authentication is handled by the backend API.</small></span>
          </div>
        </div>
      </main>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatSize(bytes) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function uiStatus(status) {
  if (status === "verified") return "clean";
  if (status === "tampered") return "tampered";
  return "review";
}

function normalizeDocument(doc) {
  return {
    ...doc,
    name: doc.filename || doc.name,
    type: (doc.filename || doc.name || "").split(".").pop()?.toUpperCase() || "FILE",
    uploader: doc.uploaderId || doc.uploader || "Unknown",
    modified: formatDate(doc.timestamp || doc.modified),
    hash: doc.docHash || doc.hash || "—",
    status: uiStatus(doc.status),
    flagReason:
      doc.status === "tampered"
        ? "Current file hash differs from the blockchain record"
        : doc.status === "verified"
          ? "Hash matches anchored blockchain record"
          : "Awaiting integrity verification",
  };
}

function StatusBadge({ status }) {
  const values = {
    clean: ["Verified", BadgeCheck, "green"],
    review: ["Review recommended", AlertTriangle, "amber"],
    tampered: ["Integrity issue", X, "red"],
  };
  const [label, Icon, tone] = values[status] || values.review;
  return <span className={`status-badge ${tone}`}><Icon size={13} />{label}</span>;
}

function Toast({ message }) {
  return message && <div className="toast"><Check size={15} />{message}</div>;
}

function BackButton({ label = "Back", onBack }) {
  return (
    <button className="back-link" type="button" onClick={onBack}>
      ← {label}
    </button>
  );
}

function IntegrityMonitor({ docs, setActive, onFilter, active }) {
  const verified = docs.filter((doc) => doc.status === "clean").length;
  const review = docs.filter((doc) => doc.status !== "clean").length;

  return (
    <section className="integrity-monitor" aria-label="Integrity monitor">
      <small className="nav-label">INTEGRITY MONITOR</small>
      <button className={`integrity-row ${active === "chain" ? "monitor-active" : ""}`} onClick={() => setActive("chain")}>
        <Blocks size={14} /><span>Blockchain</span><b className="monitor-good">Active</b>
      </button>
      <button className="integrity-row" onClick={() => onFilter("clean")}>
        <BadgeCheck size={14} /><span>Verified</span><b>{verified} / {docs.length}</b>
      </button>
      <button className="integrity-row" onClick={() => setActive("review")}>
        <AlertTriangle size={14} /><span>Needs review</span><b>{review}</b>
      </button>
    </section>
  );
}

function Sidebar({ active, setActive, onNotice, docs, onFilter, user }) {
  const items = [
    ["dashboard", "Dashboard", Activity],
    ["upload", "Upload document", UploadCloud],
    ["activity", "Audit activity", Clock3],
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><ShieldCheck size={21} /></div>
        <div><strong>Sentinel Records</strong><small>Central Investigations - Secure workspace</small></div>
      </div>

      <Workspace onNotice={onNotice} />

      <nav>
        <small className="nav-label">WORKSPACE</small>
        {items.map(([id, label, Icon]) => (
          <button className={`nav-item ${active === id ? "active" : ""}`} key={id} onClick={() => setActive(id)}>
            <Icon size={16} />{label}
          </button>
        ))}

        <small className="nav-label">ADMINISTRATION</small>
        <button className={`nav-item ${active === "team" ? "active" : ""}`} onClick={() => setActive("team")}>
          <Users size={16} />Team access
        </button>
        <button className={`nav-item ${active === "settings" ? "active" : ""}`} onClick={() => setActive("settings")}>
          <Settings size={16} />Settings
        </button>
      </nav>

      <div className="sidebar-bottom">
        <IntegrityMonitor docs={docs} setActive={setActive} onFilter={onFilter} active={active} />

        <div className="secure-note">
          <LockKeyhole size={15} />
          <span><b>Vault protected</b><small>Backend + blockchain integrity</small></span>
        </div>

        <button className="user-card" onClick={() => onNotice("Profile menu opened")}>
          <span className="avatar">{(user?.userId || "US").slice(0, 2).toUpperCase()}</span>
          <span><b>{user?.userId || "User"}</b><small>{user?.role || "Investigator"}</small></span>
          <MoreHorizontal size={17} />
        </button>
      </div>
    </aside>
  );
}

function Workspace({ onNotice }) {
  const [open, setOpen] = useState(false);
  const [workspace, setWorkspace] = useState("Central Investigations");
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="workspace-menu" ref={ref}>
      <button className="workspace-switcher" onClick={() => setOpen(!open)}>
        <span className="workspace-icon">CI</span>
        <span><small>Workspace</small><b>{workspace}</b></span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="menu-popover">
          {["Central Investigations", "Digital Evidence Unit", "Regional Forensics"].map((item) => (
            <button key={item} onClick={() => {
              setWorkspace(item);
              setOpen(false);
              onNotice(`Workspace changed to ${item}`);
            }}>{item}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Topbar({ title, theme, onTheme, onNotice, onMenu, onLogout, user }) {
  const [notifications, setNotifications] = useState(false);
  const [profile, setProfile] = useState(false);
  const [query, setQuery] = useState("");

  return (
    <header className="topbar">
      <button className="icon-button menu-button" onClick={onMenu} aria-label="Open navigation"><Menu size={20} /></button>
      <div className="topbar-brand"><ShieldCheck size={22} /><strong>Sentinel Records</strong><span>/</span><b>{title}</b></div>

      <label className="global-search">
        <Search size={16} />
        <input
          value={query}
          placeholder="Search records, cases or hashes"
          aria-label="Search records"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onNotice(query ? `Use the document search below for "${query}"` : "Enter a record, case or hash");
            if (e.key === "Escape") setQuery("");
          }}
        />
        <kbd>/</kbd>
      </label>

      <div className="top-actions">
        <button className="icon-button" onClick={() => onNotice("Team access is available in the sidebar")} aria-label="Team access"><Users size={17} /></button>

        <div className="menu-anchor">
          <button className="icon-button notification" onClick={() => setNotifications(!notifications)} aria-label="Notifications">
            <Bell size={18} /><i />
          </button>
          {notifications && (
            <div className="menu-popover right">
              <b>Notifications</b>
              <button onClick={() => { setNotifications(false); onNotice("No new security alerts"); }}>No new security alerts</button>
            </div>
          )}
        </div>

        <button className="icon-button theme-toggle" onClick={onTheme}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="menu-anchor">
          <button className="avatar profile-avatar" onClick={() => setProfile(!profile)}>
            {(user?.userId || "US").slice(0, 2).toUpperCase()}
          </button>
          {profile && (
            <div className="menu-popover right">
              <b>{user?.userId || "User"}</b>
              <button onClick={() => { setProfile(false); onLogout(); }}>Log out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Metric({ label, value, detail, icon: Icon, tone }) {
  return <div className={`metric ${tone || ""}`}><Icon size={18} /><span><small>{label}</small><strong>{value}</strong><em>{detail}</em></span></div>;
}

function PanelHead({ title, subtitle }) {
  return <div className="panel-head"><div><h2>{title}</h2><p>{subtitle}</p></div><MoreHorizontal size={17} /></div>;
}

function ActivityRow({ title, detail, time, amber }) {
  return <div className={`activity-row ${amber ? "amber" : ""}`}><Check size={16} /><span><b>{title}</b><small>{detail}</small></span><time>{time}</time></div>;
}

function Dashboard({ docs, activities, setActive, onSelectDoc, onNotice, onUpload }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => docs.filter((d) => {
    const haystack = `${d.name} ${d.type} ${d.hash} ${d.uploader}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (filter === "all" || d.status === filter);
  }), [docs, query, filter]);

  return (
    <div className="page-body">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CENTRAL INVESTIGATIONS</span>
          <h1>Home</h1>
          <p>Integrity, activity, and document control in one view.</p>
        </div>
        <button className="primary-button" onClick={onUpload}><Plus size={16} />Upload document</button>
      </div>

      <div className="quick-actions">
        {[
          ["Upload document", UploadCloud, "upload"],
          ["Audit activity", Clock3, "activity"],
          ["Review Queue", FileCheck2, "review"],
          ["Chain Explorer", Link2, "chain"],
        ].map(([label, Icon, id]) => (
          <button key={label} onClick={() => setActive(id)}><Icon size={15} />{label}</button>
        ))}
      </div>

      <div className="summary-grid">
        <Metric label="Total documents" value={docs.length} detail="Live backend records" icon={FolderOpen} />
        <Metric label="Verified integrity" value={docs.filter((d) => d.status === "clean").length} detail="Blockchain hash match" icon={BadgeCheck} />
        <Metric label="Needs attention" value={docs.filter((d) => d.status !== "clean").length} detail="Review queue" icon={AlertTriangle} tone="amber" />
        <Metric label="Chain activity" value={activities.length} detail="Live session activity" icon={Blocks} />
      </div>

      <div className="lower-grid">
        <section className="panel">
          <PanelHead title="Integrity health" subtitle="Current backend document state" />
          <div className="health-chart">
            {Array.from({ length: 12 }, (_, i) => {
              const verifiedRatio = docs.length ? docs.filter((d) => d.status === "clean").length / docs.length : 0;
              const height = Math.max(18, Math.round((verifiedRatio * 70) + i * 2));
              return <i key={i} style={{ height: `${Math.min(height, 95)}%` }} />;
            })}
          </div>
          <div className="legend">
            <span><i className="dot green" />Verified documents <b>{docs.filter((d) => d.status === "clean").length}</b></span>
            <span><i className="dot amber" />Flagged/pending <b>{docs.filter((d) => d.status !== "clean").length}</b></span>
          </div>
        </section>

        <section className="panel">
          <PanelHead title="Recent activity" subtitle="Activity from this browser session" />
          {activities.length ? activities.slice(0, 4).map((item, index) => (
            <ActivityRow key={`${item.title}-${item.detail}-${index}`} {...item} amber={item.tone === "amber"} />
          )) : <div className="empty-state">No activity yet.</div>}
        </section>
      </div>

      <section className="panel document-panel">
        <PanelHead title="Recent documents" subtitle="Records loaded from the backend database" />
        <div className="toolbar">
          <label className="table-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by filename, uploader or hash" /></label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All documents</option>
            <option value="clean">Verified</option>
            <option value="review">Needs review</option>
            <option value="tampered">Integrity issue</option>
          </select>
          <button className="secondary-button" onClick={() => onNotice("Filters are controlled by the status selector")}><SlidersHorizontal size={14} />Filter</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Document</th><th>Status</th><th>Uploaded by</th><th>Timestamp</th><th /></tr></thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.docId} onClick={() => onSelectDoc(doc)}>
                  <td><div className="file-cell"><span className="file-icon"><FileText size={16} /></span><b>{doc.name}<small>{doc.type}</small></b></div></td>
                  <td><StatusBadge status={doc.status} /></td>
                  <td>{doc.uploader}</td>
                  <td className="muted">{doc.modified}</td>
                  <td><button className="text-button" onClick={(e) => { e.stopPropagation(); onSelectDoc(doc); }}>Open <ArrowUpRight size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filtered.length && <div className="empty-state"><FolderOpen size={28} />No documents found</div>}
      </section>
    </div>
  );
}

function UploadPage({ onUploaded, onNotice, onBack, user }) {
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const choose = (candidate) => {
    if (!candidate) return;
    if (candidate.size > 50 * 1024 * 1024) {
      setError("Files must be smaller than 50 MB (backend limit).");
      return;
    }
    if (!/\.(pdf|docx|jpg|jpeg|png|zip)$/i.test(candidate.name)) {
      setError("Use PDF, DOCX, JPG, PNG, or ZIP files.");
      return;
    }
    setError("");
    setFile(candidate);
  };

  const submit = async () => {
    if (!file) {
      setError("Choose a document before uploading.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const result = await uploadDocument(file, user.userId);
      onUploaded({
        result,
        fileName: file.name,
      });
      setFile(null);
      onNotice(`Uploaded and anchored: ${file.name}`);
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page-body narrow">
      <button className="back-link" onClick={onBack}>← Back to Dashboard</button>
      <span className="eyebrow">SECURE INGESTION</span>
      <h1>Upload a case document</h1>
      <p>File → SHA-256 → AI review → blockchain anchor → database record.</p>

      <input ref={input} type="file" hidden accept=".pdf,.docx,.jpg,.jpeg,.png,.zip" onChange={(e) => choose(e.target.files[0])} />

      <button
        className={`dropzone ${file ? "done" : ""}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files[0]); }}
      >
        {file ? (
          <><Check size={30} /><b>{file.name}</b><small>{formatSize(file.size)} - ready to upload</small></>
        ) : (
          <><UploadCloud size={30} /><b>Drop your document here</b><small>or browse from your computer</small><em>PDF, DOCX, JPG, PNG or ZIP - Maximum 50 MB</em></>
        )}
      </button>

      {error && <div className="form-error"><AlertTriangle size={15} />{error}</div>}

      {file && (
        <div className="upload-actions">
          <button className="secondary-button" onClick={() => setFile(null)}>Remove file</button>
          <button className="primary-button" disabled={uploading} onClick={submit}>
            {uploading ? "Anchoring..." : "Upload and anchor"}
          </button>
        </div>
      )}
    </div>
  );
}

function RecordsPage({ mode, docs, onSelectDoc }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const rows = docs.filter((doc) => {
    const haystack = `${doc.name} ${doc.type} ${doc.hash} ${doc.uploader}`.toLowerCase();
    return haystack.includes(query.toLowerCase())
      && (filter === "all" || doc.status === filter)
      && (mode !== "review" || doc.status !== "clean");
  });

  return (
    <div className="page-body records-page">
      <span className="eyebrow">SECURE WORKSPACE</span>
      <div className="page-heading">
        <div>
          <h1>{mode === "review" ? "Review Queue" : "Audit activity"}</h1>
          <p>{mode === "review" ? "Documents requiring integrity review" : "Documents and integrity states loaded from the backend"}</p>
        </div>
        <span className="live-pill">{rows.length} records</span>
      </div>

      <section className="panel document-panel">
        <div className="toolbar records-toolbar">
          <label className="table-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search records" /></label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="clean">Verified</option>
            <option value="review">Needs review</option>
            <option value="tampered">Integrity issue</option>
          </select>
        </div>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Document</th><th>Status</th><th>{mode === "review" ? "Flag reason" : "Uploaded by"}</th><th>Timestamp</th><th /></tr></thead>
            <tbody>
              {rows.map((doc) => (
                <tr key={doc.docId} onClick={() => onSelectDoc(doc)}>
                  <td><div className="file-cell"><span className="file-icon"><FileText size={16} /></span><b>{doc.name}<small>{doc.type}</small></b></div></td>
                  <td><StatusBadge status={doc.status} /></td>
                  <td>{mode === "review" ? doc.flagReason : doc.uploader}</td>
                  <td className="muted">{doc.modified}</td>
                  <td><button className="text-button" onClick={(e) => { e.stopPropagation(); onSelectDoc(doc); }}>Open <ArrowUpRight size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!rows.length && <div className="empty-state"><FolderOpen size={28} /><b>No records found</b></div>}
      </section>
    </div>
  );
}

function ChainPage({ docs, onSelectDoc }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const results = await Promise.all(
          docs.slice(0, 20).map(async (doc) => {
            const history = await getDocumentHistory(doc.docId);
            return history.map((event) => ({
              ...event,
              docId: doc.docId,
              document: doc.name,
            }));
          })
        );

        if (!cancelled) {
          setEvents(results.flat().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load blockchain history.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (docs.length) load();
    else setLoading(false);

    return () => { cancelled = true; };
  }, [docs]);

  return (
    <div className="page-body records-page">
      <span className="eyebrow">IMMUTABLE LEDGER</span>
      <div className="page-heading">
        <div><h1>Chain Explorer</h1><p>History read from the backend's blockchain adapter</p></div>
        <span className="live-pill">READ ONLY</span>
      </div>

      <section className="panel document-panel">
        {loading && <div className="empty-state">Reading blockchain history...</div>}
        {error && <div className="form-error"><AlertTriangle size={15} />{error}</div>}

        {!loading && !error && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Action</th><th>Document</th><th>Actor</th><th>Timestamp</th><th /></tr></thead>
              <tbody>
                {events.map((event, index) => (
                  <tr key={`${event.docId}-${event.action}-${event.timestamp}-${index}`} onClick={() => {
                    const doc = docs.find((item) => item.docId === event.docId);
                    if (doc) onSelectDoc(doc);
                  }}>
                    <td><span className={`action-label ${event.action}`}>{event.action}</span></td>
                    <td>{event.document}</td>
                    <td>{event.userId || "—"}</td>
                    <td className="muted">{formatDate(event.timestamp)}</td>
                    <td><ArrowUpRight size={15} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && !events.length && <div className="empty-state"><Blocks size={28} />No on-chain history yet.</div>}
      </section>
    </div>
  );
}

function DetailPage({ doc, onNotice, onVerify, onBack, backLabel = "documents" }) {
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [detailResult, historyResult] = await Promise.all([
          getDocument(doc.docId),
          getDocumentHistory(doc.docId),
        ]);

        if (!cancelled) {
          setDetail(detailResult);
          setHistory(historyResult);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load document details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [doc.docId]);

  const handleVerify = async () => {
    setVerifying(true);
    setError("");

    try {
      const result = await verifyDocument(doc.docId);
      onVerify(doc.docId, result);
      onNotice(result.status === "verified" ? "Blockchain verification passed" : "Integrity mismatch detected");
    } catch (err) {
      setError(err.message || "Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return <div className="page-body records-page"><BackButton label={backLabel} onBack={onBack} /><div className="empty-state">Loading document from backend...</div></div>;
  }

  const currentStatus = detail?.status ? uiStatus(detail.status) : doc.status;
  const currentHash = detail?.docHash || doc.hash;

  return (
    <div className="page-body records-page">
      <BackButton label={backLabel} onBack={onBack} />

      {error && <div className="form-error"><AlertTriangle size={15} />{error}</div>}

      <div className="detail-top">
        <div>
          <span className="eyebrow">DOCUMENT RECORD</span>
          <h1>{detail?.filename || doc.name}</h1>
          <p>Uploaded by {detail?.uploaderId || doc.uploader} · Current hash {currentHash}</p>
        </div>
        <div>
          <button className="secondary-button" onClick={() => onNotice("Download endpoint is not exposed by the current backend.")}>Download</button>
          <button className="primary-button" disabled={verifying} onClick={handleVerify}>
            {verifying ? "Verifying..." : "Verify integrity"}
          </button>
        </div>
      </div>

      <div className={`verification-result ${currentStatus === "tampered" ? "bad" : ""}`}>
        {currentStatus === "tampered" ? <X size={22} /> : <BadgeCheck size={22} />}
        <span>
          <b>{currentStatus === "tampered" ? "Integrity mismatch detected" : currentStatus === "clean" ? "Blockchain integrity verified" : "Verification pending"}</b>
          <small>
            {currentStatus === "tampered"
              ? "The current file hash differs from the blockchain-anchored fingerprint."
              : currentStatus === "clean"
                ? "The current file fingerprint matches the immutable blockchain record."
                : "Run verification to compare the current file against the blockchain record."}
          </small>
        </span>
      </div>

      <div className="detail-grid">
        <section className="panel">
          <PanelHead title="Chain of custody" subtitle="Events returned by the blockchain adapter" />
          {history.map((event, index) => (
            <ActivityRow
              key={`${event.action}-${event.timestamp}-${index}`}
              title={event.action}
              detail={`Actor: ${event.userId || "—"}`}
              time={formatDate(event.timestamp)}
              amber={event.action === "version_added"}
            />
          ))}
          {!history.length && <div className="empty-state">No blockchain events found.</div>}
        </section>

        <section className="panel">
          <PanelHead title="Version history" subtitle={`${detail?.versions?.length || 0} database versions`} />
          {(detail?.versions || []).map((version) => (
            <div className="version-row" key={version.version}>
              <b>v{version.version}</b>
              <span>{version.reason || "Version"}<small>{formatDate(version.timestamp)} · {version.updatedBy}</small></span>
            </div>
          ))}
          <div className="anchor-note">
            <Fingerprint size={18} />
            <span><b>Anchored on blockchain</b><small>Current hash: {currentHash}</small></span>
          </div>
        </section>
      </div>
    </div>
  );
}

function BlockchainAside({ setActive, docs }) {
  const verified = docs.filter((d) => d.status === "clean").length;
  const flagged = docs.filter((d) => d.status !== "clean").length;

  return (
    <aside className="right-sidebar">
      <section className="monitor-card">
        <h2><Blocks size={17} />Blockchain status</h2>
        <Info label="Network" value="Backend connected" good />
        <Info label="Chain" value="Hardhat / 31337" good />
        <button className="info-link" onClick={() => setActive("chain")}><Info label="Explorer" value="Open history" /></button>
        <Info label="Verified records" value={String(verified)} good />
      </section>

      <section className="monitor-card">
        <h2><Activity size={17} />Integrity overview</h2>
        <div className="integrity-score">{docs.length ? `${Math.round((verified / docs.length) * 100)}%` : "—"}<small>Current hash matches</small></div>
        <Info label="Verified" value={String(verified)} />
        <Info label="Pending / flagged" value={String(flagged)} />
      </section>
    </aside>
  );
}

function Info({ label, value, good }) {
  return <div className="info-row"><span>{label}</span><b className={good ? "good" : ""}>{value}</b></div>;
}

const routePages = new Set(["dashboard", "upload", "activity", "review", "chain", "detail", "team", "settings"]);

function pageFromLocation() {
  const page = window.location.pathname.split("/").filter(Boolean)[0] || "dashboard";
  return routePages.has(page) ? page : "dashboard";
}

function App() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(localStorage.getItem("sentinel-token")));
  const [user, setUser] = useState(() => ({
    userId: localStorage.getItem("sentinel-user-id") || "",
    role: localStorage.getItem("sentinel-role") || "",
  }));
  const [active, setActive] = useState(pageFromLocation());
  const [docs, setDocs] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState("");
  const [mobile, setMobile] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("sentinel-theme") || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
  const [activityFilter, setActivityFilter] = useState("");

  const notify = (message) => {
    setNotice(message);
    window.clearTimeout(window.sentinelNotice);
    if (message) window.sentinelNotice = window.setTimeout(() => setNotice(""), 3000);
  };

  const loadDocuments = async () => {
    try {
      const result = await getDocuments();
      setDocs(result.map(normalizeDocument));
    } catch (err) {
      notify(err.message || "Unable to load documents.");
    }
  };

  useEffect(() => {
    if (!authenticated) return;
    loadDocuments();
  }, [authenticated]);

  const setPage = (page) => {
    history.pushState({ sentinel: true, page, from: active }, "", page === "dashboard" ? "/" : `/${page}`);
    setActive(page);
    setMobile(false);
  };

  const selectDoc = (doc) => {
    setSelected(doc);
    history.pushState({ sentinel: true, page: "detail", from: active, document: doc.docId }, "", `/detail?document=${encodeURIComponent(doc.docId)}`);
    setActive("detail");
    setMobile(false);
  };

  useEffect(() => {
    const onPopState = () => {
      const page = pageFromLocation();
      setActive(page);
      setMobile(false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const addUpload = ({ result, fileName }) => {
    setActivities((current) => [
      {
        title: "Document anchored",
        detail: `${fileName} · tx ${result.txHash ? `${result.txHash.slice(0, 10)}...` : "confirmed"}`,
        time: "Just now",
        tone: result.aiRiskFlag === "review_recommended" ? "amber" : "green",
      },
      ...current,
    ]);

    loadDocuments();
    setPage("dashboard");
  };

  const updateVerified = (docId, result) => {
    setDocs((current) => current.map((item) =>
      item.docId === docId
        ? { ...item, status: uiStatus(result.status), hash: result.currentHash }
        : item
    ));

    setActivities((current) => [
      {
        title: result.status === "verified" ? "Integrity verified" : "Integrity mismatch detected",
        detail: docId,
        time: "Just now",
        tone: result.status === "verified" ? "green" : "amber",
      },
      ...current,
    ]);
  };

  const logoutUser = () => {
    logout();
    setAuthenticated(false);
    setUser({ userId: "", role: "" });
    setDocs([]);
    setSelected(null);
    history.replaceState({ sentinel: true, page: "dashboard" }, "", "/");
    setActive("dashboard");
  };

  const onLogin = (result) => {
    setUser({ userId: result.userId, role: result.role });
    setAuthenticated(true);
    history.replaceState({ sentinel: true, page: "dashboard" }, "", "/");
    setActive("dashboard");
  };

  const filterActivity = (filter) => {
    setActivityFilter(filter);
    setPage("activity");
  };

  const title = {
    dashboard: "Dashboard",
    upload: "Upload document",
    activity: "Audit activity",
    review: "Review Queue",
    chain: "Chain Explorer",
    detail: "Document detail",
    team: "Team access",
    settings: "Settings",
  }[active];

  if (!authenticated) {
    return (
      <LoginPage
        theme={theme}
        onLogin={onLogin}
        onTheme={() => {
          const next = theme === "dark" ? "light" : "dark";
          setTheme(next);
          localStorage.setItem("sentinel-theme", next);
        }}
      />
    );
  }

  return (
    <div className={`app-shell ${theme}`} data-theme={theme}>
      <Topbar
        title={title}
        theme={theme}
        user={user}
        onTheme={() => {
          const next = theme === "dark" ? "light" : "dark";
          setTheme(next);
          localStorage.setItem("sentinel-theme", next);
        }}
        onNotice={notify}
        onLogout={logoutUser}
        onMenu={() => setMobile(!mobile)}
      />

      <div className="app-body">
        <div className={`sidebar-wrap ${mobile ? "open" : ""}`}>
          <Sidebar
            active={active}
            setActive={setPage}
            onNotice={notify}
            docs={docs}
            onFilter={filterActivity}
            user={user}
          />
        </div>

        <main>
          {active === "dashboard" && (
            <Dashboard
              docs={docs}
              activities={activities}
              setActive={setPage}
              onSelectDoc={selectDoc}
              onNotice={notify}
              onUpload={() => setPage("upload")}
            />
          )}

          {active === "upload" && (
            <UploadPage
              user={user}
              onUploaded={addUpload}
              onNotice={notify}
              onBack={() => setPage("dashboard")}
            />
          )}

          {active === "activity" && (
            <RecordsPage
              mode="activity"
              docs={activityFilter ? docs.filter((doc) => doc.status === activityFilter) : docs}
              onSelectDoc={selectDoc}
            />
          )}

          {active === "review" && <RecordsPage mode="review" docs={docs} onSelectDoc={selectDoc} />}

          {active === "chain" && <ChainPage docs={docs} onSelectDoc={selectDoc} />}

          {active === "detail" && selected && (
            <DetailPage
              doc={selected}
              onNotice={notify}
              onVerify={updateVerified}
              onBack={() => setPage("dashboard")}
              backLabel="Dashboard"
            />
          )}

          {active === "team" && (
            <div className="page-body placeholder">
              <Users size={30} /><h1>Team access</h1>
              <p>Team management is controlled by the backend authentication layer.</p>
            </div>
          )}

          {active === "settings" && (
            <div className="page-body placeholder">
              <Settings size={30} /><h1>Settings</h1>
              <p>Workspace security and access settings.</p>
            </div>
          )}
        </main>

        {active === "dashboard" && <BlockchainAside setActive={setPage} docs={docs} />}
      </div>

      <Toast message={notice} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
