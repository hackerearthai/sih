import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

import {
  login,
  logout,
  getDocuments,
  getDocument,
  getDocumentHistory,
  verifyDocument,
  uploadDocument,
} from "./api";

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Blocks,
  Check,
  ChevronDown,
  Clock3,
  FileCheck2,
  FileText,
  FolderOpen,
  Link2,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  UploadCloud,
  Users,
  X,
} from "lucide-react";

const fmt = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
};

const shortId = (value, length = 18) => {
  if (!value) return "—";
  if (value.length <= length) return value;

  return `${value.slice(0, length)}…`;
};

const getStatus = (status) => {
  if (status === "tampered") return "tampered";
  if (status === "pending") return "pending";
  return "verified";
};

const getStatusLabel = (status) => {
  if (status === "tampered") return "Integrity issue";
  if (status === "pending") return "Pending";
  return "Verified";
};

/* -------------------------------------------------------------------------- */
/* LOGIN                                                                      */
/* -------------------------------------------------------------------------- */

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(
    localStorage.getItem("sentinel-theme") || "dark"
  );

  async function submit(event) {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await login(username.trim(), password);

      localStorage.setItem("sentinel-token", result.token);

      localStorage.setItem(
        "sentinel-user",
        JSON.stringify({
          userId: result.userId,
          role: result.role,
          username: username.trim(),
        })
      );

      onLogin();
    } catch (error) {
      setError(error.message || "Unable to sign in.");
      setPassword("");
    } finally {
      setLoading(false);
    }
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("sentinel-theme", next);
  }

  return (
    <div className={`auth-shell ${theme}`}>
      <section
        className="auth-visual"
        aria-label="Sentinel Records evidence integrity pipeline"
      >
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
            <span className="stage-icon">
              <FileText size={18} />
            </span>
            <b>EVIDENCE</b>
            <small>Record captured</small>
          </div>

          <div className="pipeline-stage">
            <span className="stage-icon hash-icon">#</span>
            <b>HASH</b>
            <small>Integrity fingerprint</small>
            <em>SHA-256</em>
          </div>

          <div className="pipeline-stage">
            <span className="stage-icon chain-icon">
              <Blocks size={18} />
            </span>
            <b>CHAIN ANCHORED</b>
            <small>Immutable record</small>
          </div>

          <div className="pipeline-stage verified-stage">
            <span className="stage-icon verified-icon">
              <Check size={18} />
            </span>
            <b>VERIFIED</b>
            <small>Integrity confirmed</small>
          </div>
        </div>

        <div className="pipeline-meta">
          <span>SHA-256</span>
          <span>PERMISSIONED REGISTRY</span>
        </div>

        <div className="evidence-caption">SECURE RECORDS / 2026</div>
      </section>

      <main className="auth-content">
        <button
          className="auth-theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${
            theme === "dark" ? "light" : "dark"
          } mode`}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="auth-card">
          <div className="auth-mark">
            <ShieldCheck size={25} />
          </div>

          <h1>Sign in to Sentinel Records</h1>

          <p>Secure access to your investigation workspace.</p>

          <form onSubmit={submit} noValidate>
            <label>
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
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
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            {error && (
              <div className="auth-error" role="alert">
                <AlertTriangle size={15} />
                {error}
              </div>
            )}

            <button className="auth-submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="auth-security">
            <LockKeyhole size={14} />

            <span>
              <b>Secure authentication</b>
              <small>Your investigation workspace is protected.</small>
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SMALL UI COMPONENTS                                                        */
/* -------------------------------------------------------------------------- */

function PanelHead({ title, subtitle, children }) {
  return (
    <div className="panel-head">
      <div>
        <h2>{title}</h2>

        {subtitle && <p>{subtitle}</p>}
      </div>

      {children}
    </div>
  );
}

function ErrorText({ error }) {
  if (!error) return null;

  return (
    <p className="form-error" role="alert">
      <AlertTriangle size={15} />
      {error}
    </p>
  );
}

function StatusBadge({ status }) {
  const normalized = getStatus(status);

  const icon =
    normalized === "tampered" ? (
      <X size={13} />
    ) : normalized === "pending" ? (
      <Clock3 size={13} />
    ) : (
      <BadgeCheck size={13} />
    );

  const tone =
    normalized === "tampered"
      ? "red"
      : normalized === "pending"
      ? "amber"
      : "green";

  return (
    <span className={`status-badge ${tone}`}>
      {icon}
      {getStatusLabel(normalized)}
    </span>
  );
}

function Metric({ label, value, icon: Icon, tone = "", onClick }) {
  return (
    <button
      className={`metric metric-button ${tone}`}
      onClick={onClick}
      type="button"
    >
      <Icon size={18} />

      <span>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>View records</em>
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* DOCUMENT TABLE                                                             */
/* -------------------------------------------------------------------------- */

function DocumentTable({ docs, onSelect, onVerify, busy }) {
  if (!docs.length) {
    return (
      <div className="empty-state">
        <FolderOpen size={28} />
        <b>No documents found</b>
        <span>No registered records match the current view.</span>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="records-table">
        <colgroup>
          <col style={{ width: "36%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "14%" }} />
        </colgroup>

        <thead>
          <tr>
            <th>Document</th>
            <th>Status</th>
            <th>AI screening</th>
            <th>Uploader</th>
            <th>Timestamp</th>
          </tr>
        </thead>

        <tbody>
          {docs.map((doc) => (
            <tr key={doc.docId}>
              <td>
                <button
                  type="button"
                  className="document-link"
                  onClick={() => onSelect(doc)}
                >
                  <span className="file-icon">
                    <FileText size={16} />
                  </span>

                  <span className="file-cell-text">
                    <b title={doc.filename}>{doc.filename}</b>

                    <small title={doc.docId}>
                      {shortId(doc.docId, 20)}
                    </small>
                  </span>
                </button>
              </td>

              <td>
                <StatusBadge status={doc.status} />
              </td>

              <td>
                {doc.aiRiskFlag === "review_recommended" ? (
                  <span className="status-badge amber">
                    <AlertTriangle size={13} />
                    Review
                  </span>
                ) : (
                  <span className="status-badge green">
                    <Check size={13} />
                    Clean
                  </span>
                )}
              </td>

              <td>
                <span
                  className="muted uploader-cell"
                  title={doc.uploaderId}
                >
                  {shortId(doc.uploaderId, 16)}
                </span>
              </td>

              <td>
                <div className="timestamp-cell">
                  <span>{fmt(doc.timestamp)}</span>

                  <button
                    type="button"
                    className="text-button verify-action"
                    disabled={busy === doc.docId}
                    onClick={() => onVerify(doc)}
                  >
                    {busy === doc.docId ? "Checking..." : "Verify"}
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* RECENT DOCUMENTS                                                           */
/* -------------------------------------------------------------------------- */

function Records({
  docs,
  onSelect,
  onVerify,
  busy,
  title = "Recent documents",
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) return docs;

    return docs.filter((doc) => {
      return (
        String(doc.filename || "")
          .toLowerCase()
          .includes(value) ||
        String(doc.docId || "")
          .toLowerCase()
          .includes(value) ||
        String(doc.uploaderId || "")
          .toLowerCase()
          .includes(value) ||
        String(doc.docHash || "")
          .toLowerCase()
          .includes(value)
      );
    });
  }, [docs, query]);

  return (
    <section className="panel document-panel">
      <div className="panel-head document-panel-head">
        <div>
          <h2>{title}</h2>
          <p>
            {filtered.length}{" "}
            {filtered.length === 1 ? "registered record" : "registered records"}
          </p>
        </div>

        <button
          className="text-button"
          onClick={() => setQuery("")}
          type="button"
        >
          View all
          <ArrowUpRight size={13} />
        </button>
      </div>

      <div className="toolbar records-toolbar">
        <label className="table-search">
          <Search size={15} />

          <input
            aria-label="Search documents"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents or hashes..."
          />
        </label>
      </div>

      <DocumentTable
        docs={filtered}
        onSelect={onSelect}
        onVerify={onVerify}
        busy={busy}
      />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* REGISTRY HEALTH                                                            */
/* -------------------------------------------------------------------------- */

function RegistryHealth({ docs }) {
  /*
   * IMPORTANT:
   *
   * These bars are NOT pretending to be blockchain block numbers,
   * validator counts, or fabricated historical blockchain statistics.
   *
   * They are a visual health/activity indicator derived from the
   * records currently loaded from the backend.
   */

  const verified = docs.filter(
    (doc) => getStatus(doc.status) === "verified"
  ).length;

  const review = docs.filter(
    (doc) => doc.aiRiskFlag === "review_recommended"
  ).length;

  const tampered = docs.filter(
    (doc) => getStatus(doc.status) === "tampered"
  ).length;

  const total = docs.length;

  const bars = useMemo(() => {
    if (!total) {
      return Array.from({ length: 12 }, () => 0);
    }

    const healthyRatio = verified / total;

    const base = Math.max(0.2, healthyRatio);

    return Array.from({ length: 12 }, (_, index) => {
      const variation = [0.68, 0.82, 0.74, 0.94, 0.86, 1, 0.9, 1.04, 0.92, 1.08, 0.98, 1.12][
        index
      ];

      return Math.min(1, base * variation);
    });
  }, [total, verified]);

  const healthLabel =
    tampered > 0
      ? "Attention required"
      : review > 0
      ? "Review recommended"
      : "Integrity healthy";

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Registry health</h2>
          <p>Current integrity activity across the workspace.</p>
        </div>

        <span className="live-pill">LIVE</span>
      </div>

      <div className="health-chart" aria-label="Registry health activity">
        {bars.map((height, index) => (
          <i
            key={index}
            style={{
              height: `${Math.max(4, height * 100)}%`,
            }}
            title={`Activity indicator ${index + 1}`}
          />
        ))}
      </div>

      <div className="legend">
        <span>
          <i className="dot" />
          Verified <b>{verified}</b>
        </span>

        <span>
          <i className="dot amber" />
          Review <b>{review}</b>
        </span>

        <span className="muted">{healthLabel}</span>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* SYSTEM STATUS                                                              */
/* -------------------------------------------------------------------------- */

function SystemStatus() {
  return (
    <section className="panel">
      <PanelHead
        title="System status"
        subtitle="Integrity services currently connected."
      >
        <Activity size={18} />
      </PanelHead>

      <div className="system-status-list">
        <div className="system-status-row">
          <span className="system-status-icon">
            <Check size={12} />
          </span>

          <span>
            <b>Blockchain registry</b>
            <small>Document hashes available for verification</small>
          </span>

          <strong>ONLINE</strong>
        </div>

        <div className="system-status-row">
          <span className="system-status-icon">
            <Check size={12} />
          </span>

          <span>
            <b>Evidence database</b>
            <small>Metadata and access history available</small>
          </span>

          <strong>ONLINE</strong>
        </div>

        <div className="system-status-row">
          <span className="system-status-icon">
            <Check size={12} />
          </span>

          <span>
            <b>AI screening service</b>
            <small>Pre-upload risk analysis enabled</small>
          </span>

          <strong>ONLINE</strong>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* ACTIVITY                                                                   */
/* -------------------------------------------------------------------------- */

function ActivityList({ rows, docs, onSelect }) {
  if (!rows.length) {
    return <p className="empty-state">No recorded activity.</p>;
  }

  return (
    <>
      {rows.map((row, index) => {
        const doc = docs.find((item) => item.docId === row.docId);

        return (
          <button
            type="button"
            className="activity-row activity-button"
            key={`${row.action}-${row.timestamp}-${index}`}
            onClick={() => doc && onSelect(doc)}
          >
            <Activity size={16} />

            <span>
              <b>
                {row.action}
                {row.filename ? ` · ${row.filename}` : ""}
              </b>

              <small>{row.userId || "System event"}</small>
            </span>

            <time>{fmt(row.timestamp)}</time>
          </button>
        );
      })}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* DASHBOARD                                                                  */
/* -------------------------------------------------------------------------- */

function Dashboard({
  docs,
  activity,
  onSelect,
  onVerify,
  busy,
  navigate,
  filterRecords,
}) {
  const verifiedCount = docs.filter(
    (doc) => getStatus(doc.status) === "verified"
  ).length;

  const reviewCount = docs.filter(
    (doc) => doc.aiRiskFlag === "review_recommended"
  ).length;

  const tamperedCount = docs.filter(
    (doc) => getStatus(doc.status) === "tampered"
  ).length;

  return (
    <div className="page-body dashboard-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SENTINEL RECORDS</span>

          <h1>Dashboard</h1>

          <p>
            Secure digital evidence storage, integrity verification and audit
            history.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => navigate("upload")}
          type="button"
        >
          <Plus size={16} />
          Upload document
        </button>
      </div>

      <div className="quick-actions">
        <button type="button" onClick={() => navigate("upload")}>
          <UploadCloud size={15} />
          Upload document
        </button>

        <button type="button" onClick={() => navigate("records")}>
          <FolderOpen size={15} />
          View records
        </button>

        <button type="button" onClick={() => navigate("chain")}>
          <Blocks size={15} />
          Chain Explorer
        </button>

        <button type="button" onClick={() => navigate("activity")}>
          <Clock3 size={15} />
          Audit activity
        </button>
      </div>

      <div className="summary-grid">
        <Metric
          label="Total documents"
          value={docs.length}
          icon={FolderOpen}
          onClick={() => filterRecords("all")}
        />

        <Metric
          label="Verified records"
          value={verifiedCount}
          icon={ShieldCheck}
          onClick={() => filterRecords("verified")}
        />

        <Metric
          label="AI review recommended"
          value={reviewCount}
          icon={AlertTriangle}
          tone="amber"
          onClick={() => navigate("review")}
        />

        <Metric
          label="Integrity issues"
          value={tamperedCount}
          icon={Blocks}
          tone={tamperedCount > 0 ? "red" : ""}
          onClick={() => filterRecords("tampered")}
        />
      </div>

      <div className="lower-grid">
        <RegistryHealth docs={docs} />

        <SystemStatus />
      </div>

      <Records
        title="Recent documents"
        docs={docs.slice(0, 10)}
        onSelect={onSelect}
        onVerify={onVerify}
        busy={busy}
      />

      <section className="panel">
        <PanelHead
          title="Recent activity"
          subtitle="Latest events recorded by the system."
        >
          <button
            className="text-button"
            type="button"
            onClick={() => navigate("activity")}
          >
            View all
            <ArrowUpRight size={13} />
          </button>
        </PanelHead>

        <ActivityList
          rows={activity.slice(0, 5)}
          docs={docs}
          onSelect={onSelect}
        />
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* UPLOAD                                                                     */
/* -------------------------------------------------------------------------- */

function UploadPage({ user, onBack, onSaved }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef(null);

  function choose(candidate) {
    if (!candidate || busy) return;

    if (candidate.size > 50 * 1024 * 1024) {
      setError("Files must be 50 MB or smaller.");
      return;
    }

    if (!/\.(pdf|docx|jpg|jpeg|png|zip|txt)$/i.test(candidate.name)) {
      setError("Use PDF, DOCX, JPG, PNG, ZIP or TXT.");
      return;
    }

    setFile(candidate);
    setError("");
  }

  async function submit() {
    if (!file || busy) return;

    setBusy(true);
    setError("");

    try {
      const result = await uploadDocument(file, user.userId);

      setFile(null);

      onSaved(
        result.aiRiskFlag === "review_recommended"
          ? "Document registered. AI recommends human review."
          : "Document uploaded and registered on-chain."
      );
    } catch (error) {
      setError(error.message || "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-body narrow">
      <button className="back-link" onClick={onBack} type="button">
        ← Back to dashboard
      </button>

      <div className="page-heading">
        <div>
          <span className="eyebrow">EVIDENCE REGISTRATION</span>
          <h1>Upload a document</h1>
          <p>
            The file is screened before its SHA-256 fingerprint is registered
            on the blockchain.
          </p>
        </div>
      </div>

      <input
        ref={input}
        type="file"
        hidden
        accept=".pdf,.docx,.jpg,.jpeg,.png,.zip,.txt"
        onChange={(event) => choose(event.target.files?.[0])}
      />

      <button
        type="button"
        className={`dropzone ${file ? "done" : ""}`}
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          choose(event.dataTransfer.files?.[0]);
        }}
      >
        <UploadCloud size={30} />

        <b>{file ? file.name : "Choose a file or drop it here"}</b>

        <small>
          PDF, DOCX, JPG, PNG, ZIP or TXT · Maximum 50 MB
        </small>
      </button>

      <ErrorText error={error} />

      {file && (
        <div className="upload-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => {
              setFile(null);

              if (input.current) {
                input.current.value = "";
              }
            }}
          >
            Remove file
          </button>

          <button
            type="button"
            className="primary-button"
            disabled={busy}
            onClick={submit}
          >
            {busy ? "Registering..." : "Upload and register"}
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* DETAIL                                                                     */
/* -------------------------------------------------------------------------- */

function DetailPage({
  doc,
  onBack,
  onVerify,
  busy,
  notify,
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verifyResult, setVerifyResult] = useState(null);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const result = await getDocument(doc.docId);
      setDetail(result);
    } catch (error) {
      setError(error.message || "Unable to load document.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [doc.docId]);

  async function verify() {
    setError("");
    setVerifyResult(null);

    try {
      const result = await onVerify(doc, true);

      setVerifyResult(result);

      await load();

      notify(
        result.status === "verified"
          ? "Blockchain verification passed."
          : "Hash mismatch detected."
      );
    } catch (error) {
      setError(error.message || "Verification failed.");
    }
  }

  return (
    <div className="page-body records-page">
      <button className="back-link" onClick={onBack} type="button">
        ← Back to records
      </button>

      <div className="detail-top">
        <div>
          <span className="eyebrow">DOCUMENT RECORD</span>

          <h1>{doc.filename}</h1>

          <p>{doc.docId}</p>

          <p>
            Uploaded by {shortId(doc.uploaderId, 28)} ·{" "}
            {fmt(doc.timestamp)}
          </p>
        </div>

        <div className="action-group">
          <button
            className="primary-button"
            disabled={busy === doc.docId}
            onClick={verify}
            type="button"
          >
            <ShieldCheck size={15} />

            {busy === doc.docId ? "Checking..." : "Verify integrity"}
          </button>
        </div>
      </div>

      <ErrorText error={error} />

      {verifyResult && (
        <div
          className={`verification-result ${
            verifyResult.status === "tampered" ? "bad" : ""
          }`}
        >
          {verifyResult.status === "verified" ? (
            <BadgeCheck size={22} />
          ) : (
            <AlertTriangle size={22} />
          )}

          <span>
            <b>
              {verifyResult.status === "verified"
                ? "Fingerprint matched"
                : "Fingerprint mismatch detected"}
            </b>

            <small>
              Current SHA-256:
              <br />
              {verifyResult.currentHash}
            </small>
          </span>
        </div>
      )}

      {loading ? (
        <p role="status">Loading document...</p>
      ) : (
        detail && (
          <>
            <div className="detail-grid">
              <section className="panel">
                <PanelHead
                  title="Integrity status"
                  subtitle="Current verification state"
                />

                <div style={{ marginTop: 15 }}>
                  <StatusBadge status={doc.status} />
                </div>
              </section>

              <section className="panel">
                <PanelHead
                  title="AI screening"
                  subtitle="Pre-upload risk assessment"
                />

                <div style={{ marginTop: 15 }}>
                  {doc.aiRiskFlag === "review_recommended" ? (
                    <span className="status-badge amber">
                      <AlertTriangle size={13} />
                      Review recommended
                    </span>
                  ) : (
                    <span className="status-badge green">
                      <Check size={13} />
                      Clean
                    </span>
                  )}
                </div>
              </section>
            </div>

            <section className="panel">
              <PanelHead
                title="Saved SHA-256 fingerprint"
                subtitle="Blockchain verification anchor"
              />

              <p className="hash-value">{detail.docHash}</p>
            </section>

            <section className="panel">
              <PanelHead
                title="Version history"
                subtitle={`${detail.versions?.length || 0} registered version(s)`}
              />

              {(detail.versions || []).map((version) => (
                <div className="version-row" key={version.version}>
                  <b>v{version.version}</b>

                  <span>
                    {version.reason || "Version registered"}

                    <small>
                      {fmt(version.timestamp)}
                      <br />
                      SHA-256: {shortId(version.docHash, 28)}
                    </small>
                  </span>
                </div>
              ))}
            </section>

            <section className="panel">
              <PanelHead
                title="Access & blockchain history"
                subtitle="Recorded system events"
              />

              {(detail.accessLog || []).map((event, index) => (
                <div className="activity-row" key={`${event.timestamp}-${index}`}>
                  <Activity size={16} />

                  <span>
                    <b>{event.action}</b>
                    <small>{event.userId || "System"}</small>
                  </span>

                  <time>{fmt(event.timestamp)}</time>
                </div>
              ))}

              {!detail.accessLog?.length && (
                <p className="empty-state">No access events recorded.</p>
              )}
            </section>
          </>
        )
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* CHAIN EXPLORER                                                             */
/* -------------------------------------------------------------------------- */

function ChainPage({ docs }) {
  const [selectedId, setSelectedId] = useState(docs[0]?.docId || "");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const selectedDoc = docs.find((doc) => doc.docId === selectedId);

  async function load() {
    if (!selectedId) {
      setEvents([]);
      return;
    }

    setLoading(true);

    try {
      const result = await getDocumentHistory(selectedId);

      setEvents(result || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedId && docs.length) {
      setSelectedId(docs[0].docId);
    }
  }, [docs]);

  useEffect(() => {
    load();
  }, [selectedId]);

  return (
    <div className="page-body records-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">BLOCKCHAIN</span>

          <h1>Chain Explorer</h1>

          <p>
            Inspect immutable document registration and version history.
          </p>
        </div>

        <button
          className="secondary-button"
          onClick={load}
          type="button"
          disabled={loading}
        >
          <Blocks size={15} />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <section className="panel">
        <label>
          <span className="muted">Document</span>

          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            style={{
              width: "100%",
              marginTop: 8,
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              borderRadius: 7,
              padding: "10px",
            }}
          >
            <option value="">Select a document</option>

            {docs.map((doc) => (
              <option key={doc.docId} value={doc.docId}>
                {doc.filename}
              </option>
            ))}
          </select>
        </label>
      </section>

      {selectedDoc && (
        <section className="panel">
          <PanelHead
            title={selectedDoc.filename}
            subtitle={selectedDoc.docId}
          />

          <div style={{ marginTop: 8 }}>
            <StatusBadge status={selectedDoc.status} />
          </div>

          <div className="chain-event" style={{ marginTop: 15 }}>
            <Blocks size={16} />

            <div>
              <b>Blockchain registry</b>
              <small>Current document hash anchored on-chain</small>
            </div>
          </div>

          {events.length ? (
            events.map((event, index) => (
              <div
                className="chain-event"
                key={`${event.timestamp}-${index}`}
              >
                <Link2 size={16} />

                <div>
                  <b>{event.action}</b>

                  <small>{event.userId || "System"}</small>

                  <time>{fmt(event.timestamp)}</time>
                </div>
              </div>
            ))
          ) : (
            <p className="empty-state">
              No blockchain history returned for this document.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* RECORDS PAGE                                                               */
/* -------------------------------------------------------------------------- */

function RecordsPage({ docs, onSelect, onVerify, busy }) {
  const [filter, setFilter] = useState("all");

  const filtered = docs.filter((doc) => {
    if (filter === "verified") {
      return getStatus(doc.status) === "verified";
    }

    if (filter === "tampered") {
      return getStatus(doc.status) === "tampered";
    }

    if (filter === "review") {
      return doc.aiRiskFlag === "review_recommended";
    }

    return true;
  });

  return (
    <div className="page-body records-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">EVIDENCE REGISTRY</span>
          <h1>All records</h1>
          <p>Documents registered through the Sentinel backend.</p>
        </div>
      </div>

      <div className="toolbar records-toolbar">
        <button
          className="secondary-button"
          type="button"
          onClick={() => setFilter("all")}
        >
          <FolderOpen size={14} />
          All
        </button>

        <button
          className="secondary-button"
          type="button"
          onClick={() => setFilter("verified")}
        >
          <BadgeCheck size={14} />
          Verified
        </button>

        <button
          className="secondary-button"
          type="button"
          onClick={() => setFilter("review")}
        >
          <AlertTriangle size={14} />
          Review
        </button>

        <button
          className="secondary-button"
          type="button"
          onClick={() => setFilter("tampered")}
        >
          <Blocks size={14} />
          Integrity issues
        </button>
      </div>

      <Records
        title={`${filtered.length} matching records`}
        docs={filtered}
        onSelect={onSelect}
        onVerify={onVerify}
        busy={busy}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SIDEBAR                                                                    */
/* -------------------------------------------------------------------------- */

function Sidebar({
  active,
  navigate,
  docs,
  profile,
  onProfileMenu,
  mobile,
}) {
  const verified = docs.filter(
    (doc) => getStatus(doc.status) === "verified"
  ).length;

  const review = docs.filter(
    (doc) => doc.aiRiskFlag === "review_recommended"
  ).length;

  return (
    <div className={`sidebar-wrap ${mobile ? "open" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <ShieldCheck size={21} />
          </div>

          <div>
            <strong>Sentinel Records</strong>
            <small>Evidence integrity</small>
          </div>
        </div>

        <div className="workspace-switcher">
          <span className="workspace-icon">SR</span>

          <span>
            <small>WORKSPACE</small>
            <b>Evidence Registry</b>
          </span>

          <ChevronDown size={14} />
        </div>

        <nav>
          <small className="nav-label">WORKSPACE</small>

          {[
            ["dashboard", "Dashboard", Activity],
            ["records", "All records", FolderOpen],
            ["upload", "Upload document", UploadCloud],
            ["activity", "Audit activity", Clock3],
            ["review", "Review Queue", FileCheck2],
            ["chain", "Chain Explorer", Blocks],
          ].map(([page, label, Icon]) => (
            <button
              key={page}
              type="button"
              className={`nav-item ${active === page ? "active" : ""}`}
              onClick={() => navigate(page)}
            >
              <Icon size={16} />
              {label}

              {page === "review" && review > 0 && (
                <span className="nav-count">{review}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <section className="integrity-monitor">
            <small className="nav-label">INTEGRITY MONITOR</small>

            <button
              className="integrity-row"
              type="button"
              onClick={() => navigate("records")}
            >
              <BadgeCheck size={14} />

              <span>Verified</span>

              <b className="monitor-good">{verified}</b>
            </button>

            <button
              className="integrity-row"
              type="button"
              onClick={() => navigate("review")}
            >
              <AlertTriangle size={14} />

              <span>Needs review</span>

              <b>{review}</b>
            </button>
          </section>

          <button
            className="user-card"
            type="button"
            onClick={onProfileMenu}
            aria-label="Open user menu"
          >
            <span className="avatar">
              {profile.username?.slice(0, 2).toUpperCase() || "IN"}
            </span>

            <span>
              <b>{profile.username || "User"}</b>
              <small>{profile.role || "investigator"}</small>
            </span>

            <MoreHorizontal size={17} />
          </button>
        </div>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TOPBAR                                                                     */
/* -------------------------------------------------------------------------- */

function Topbar({
  title,
  navigate,
  profile,
  logoutUser,
  mobileMenu,
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function close(event) {
      if (!ref.current?.contains(event.target)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", close);

    return () => {
      document.removeEventListener("mousedown", close);
    };
  }, []);

  function openProfile() {
    setProfileOpen((value) => !value);
  }

  return (
    <header className="topbar">
      <button
        className="icon-button menu-button"
        type="button"
        aria-label="Open navigation"
        onClick={mobileMenu}
      >
        <Menu size={20} />
      </button>

      <div className="topbar-brand">
        <ShieldCheck size={22} />

        <strong>Sentinel Records</strong>

        <span>/</span>

        <b>{title}</b>
      </div>

      <form
        className="global-search"
        onSubmit={(event) => {
          event.preventDefault();
          navigate("records");
        }}
      >
        <Search size={15} />

        <input
          placeholder="Search records or hashes"
          aria-label="Search records"
        />

        <kbd>/</kbd>
      </form>

      <div className="top-actions" ref={ref}>
        <button
          className="icon-button"
          type="button"
          aria-label="Open chain explorer"
          onClick={() => navigate("chain")}
        >
          <Blocks size={17} />
        </button>

        <button
          className="icon-button notification"
          type="button"
          aria-label="Notifications"
          onClick={() => navigate("review")}
        >
          <Bell size={18} />
        </button>

        <button
          className="icon-button"
          type="button"
          aria-label="Toggle theme"
          onClick={() => {
            const current =
              localStorage.getItem("sentinel-theme") || "dark";

            const next = current === "dark" ? "light" : "dark";

            localStorage.setItem("sentinel-theme", next);

            window.location.reload();
          }}
        >
          {(localStorage.getItem("sentinel-theme") || "dark") ===
          "dark" ? (
            <Sun size={18} />
          ) : (
            <Moon size={18} />
          )}
        </button>

        <div className="menu-anchor">
          <button
            className="avatar profile-avatar"
            type="button"
            aria-label="Open profile menu"
            aria-expanded={profileOpen}
            onClick={openProfile}
          >
            {profile.username?.slice(0, 2).toUpperCase() || "IN"}
          </button>

          {profileOpen && (
            <div className="menu-popover right">
              <b>{profile.username || "User"}</b>

              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  navigate("profile");
                }}
              >
                Profile
              </button>

              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  navigate("settings");
                }}
              >
                Settings
              </button>

              <button
                type="button"
                onClick={logoutUser}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* APP                                                                        */
/* -------------------------------------------------------------------------- */

function App({ onLogout }) {
  const [page, setPage] = useState("dashboard");
  const [docs, setDocs] = useState([]);
  const [activity, setActivity] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobile, setMobile] = useState(false);

  const user = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem("sentinel-user") || "null"
      );
    } catch {
      return null;
    }
  }, []);

  const noticeTimer = useRef(null);

  function notify(message) {
    setNotice(message);

    clearTimeout(noticeTimer.current);

    noticeTimer.current = setTimeout(() => {
      setNotice("");
    }, 5000);
  }

  useEffect(() => {
    return () => clearTimeout(noticeTimer.current);
  }, []);

  async function reload() {
    setLoading(true);
    setError("");

    try {
      const documents = await getDocuments();

      setDocs(documents || []);

      const historyRows = [];

      for (const document of (documents || []).slice(0, 20)) {
        try {
          const history = await getDocumentHistory(document.docId);

          for (const event of history || []) {
            historyRows.push({
              ...event,
              docId: document.docId,
              filename: document.filename,
            });
          }
        } catch {
          // Keep the dashboard usable if one history request fails.
        }
      }

      historyRows.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() -
          new Date(a.timestamp).getTime()
      );

      setActivity(historyRows);
    } catch (error) {
      setError(error.message || "Unable to load backend data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  function navigate(nextPage) {
    setPage(nextPage);
    setMobile(false);

    if (nextPage !== "detail") {
      setSelectedId(null);
    }
  }

  function selectDocument(document) {
    setSelectedId(document.docId);
    setPage("detail");
  }

  async function verify(document, throwError = false) {
    if (busy) return;

    setBusy(document.docId);
    setError("");

    try {
      const result = await verifyDocument(document.docId);

      setDocs((current) =>
        current.map((item) =>
          item.docId === document.docId
            ? {
                ...item,
                status: result.status,
              }
            : item
        )
      );

      notify(
        result.status === "verified"
          ? "Blockchain verification passed."
          : "Integrity mismatch detected."
      );

      await reload();

      return result;
    } catch (error) {
      if (throwError) throw error;

      notify(error.message || "Verification failed.");
    } finally {
      setBusy("");
    }
  }

  function logoutUser() {
    logout();

    setDocs([]);
    setActivity([]);
    setSelectedId(null);
    setPage("dashboard");
    setError("");

    onLogout();
  }

  function filterRecords(value) {
    if (value === "tampered") {
      setPage("records");
      return;
    }

    if (value === "verified") {
      setPage("records");
      return;
    }

    setPage("records");
  }

  const selected = docs.find((doc) => doc.docId === selectedId);

  const titles = {
    dashboard: "Dashboard",
    records: "All records",
    upload: "Upload document",
    activity: "Audit activity",
    review: "Review Queue",
    chain: "Chain Explorer",
    detail: "Document detail",
    settings: "Settings",
    profile: "Profile",
  };

  return (
    <div className="app-shell connected-app dark">
      <Topbar
        title={titles[page] || "Dashboard"}
        navigate={navigate}
        profile={user || {}}
        logoutUser={logoutUser}
        mobileMenu={() => setMobile((value) => !value)}
      />

      <div className="app-body">
        <Sidebar
          active={page}
          navigate={navigate}
          docs={docs}
          profile={user || {}}
          onProfileMenu={() => navigate("profile")}
          mobile={mobile}
        />

        <main>
          {loading ? (
            <div className="page-body">
              <p role="status">Loading saved records...</p>
            </div>
          ) : error ? (
            <div className="page-body">
              <ErrorText error={error} />

              <button
                className="primary-button"
                type="button"
                onClick={reload}
              >
                <Activity size={15} />
                Retry connection
              </button>
            </div>
          ) : (
            <>
              {page === "dashboard" && (
                <Dashboard
                  docs={docs}
                  activity={activity}
                  onSelect={selectDocument}
                  onVerify={verify}
                  busy={busy}
                  navigate={navigate}
                  filterRecords={filterRecords}
                />
              )}

              {page === "records" && (
                <RecordsPage
                  docs={docs}
                  onSelect={selectDocument}
                  onVerify={verify}
                  busy={busy}
                />
              )}

              {page === "review" && (
                <RecordsPage
                  docs={docs.filter(
                    (doc) =>
                      doc.aiRiskFlag === "review_recommended" ||
                      getStatus(doc.status) === "tampered"
                  )}
                  onSelect={selectDocument}
                  onVerify={verify}
                  busy={busy}
                />
              )}

              {page === "upload" && (
                <UploadPage
                  user={user}
                  onBack={() => navigate("dashboard")}
                  onSaved={(message) => {
                    notify(message);
                    reload();
                    navigate("dashboard");
                  }}
                />
              )}

              {page === "detail" && selected && (
                <DetailPage
                  doc={selected}
                  onBack={() => navigate("records")}
                  onVerify={verify}
                  busy={busy}
                  notify={notify}
                />
              )}

              {page === "chain" && <ChainPage docs={docs} />}

              {page === "activity" && (
                <div className="page-body records-page">
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">AUDIT TRAIL</span>
                      <h1>Audit activity</h1>
                      <p>
                        Blockchain and document access events returned by the
                        backend.
                      </p>
                    </div>

                    <button
                      className="secondary-button"
                      type="button"
                      onClick={reload}
                    >
                      <Clock3 size={15} />
                      Refresh
                    </button>
                  </div>

                  <section className="panel">
                    <ActivityList
                      rows={activity}
                      docs={docs}
                      onSelect={selectDocument}
                    />
                  </section>
                </div>
              )}

              {page === "settings" && (
                <div className="page-body narrow">
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">ACCOUNT</span>
                      <h1>Settings</h1>
                      <p>Current Sentinel Records session.</p>
                    </div>
                  </div>

                  <section className="panel">
                    <PanelHead
                      title="Account"
                      subtitle="Authenticated backend user"
                    />

                    <div className="info-row">
                      <span>Username</span>
                      <b>{user?.username || "—"}</b>
                    </div>

                    <div className="info-row">
                      <span>Role</span>
                      <b>{user?.role || "—"}</b>
                    </div>

                    <div className="info-row">
                      <span>User ID</span>
                      <b>{user?.userId || "—"}</b>
                    </div>
                  </section>
                </div>
              )}

              {page === "profile" && (
                <div className="page-body narrow">
                  <div className="page-heading">
                    <div>
                      <span className="eyebrow">ACCOUNT</span>
                      <h1>Profile</h1>
                      <p>Your authenticated Sentinel Records identity.</p>
                    </div>
                  </div>

                  <section className="panel">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        marginBottom: 20,
                      }}
                    >
                      <span className="avatar profile-avatar">
                        {user?.username?.slice(0, 2).toUpperCase() || "IN"}
                      </span>

                      <div>
                        <h2 style={{ margin: 0 }}>
                          {user?.username || "User"}
                        </h2>

                        <p
                          style={{
                            margin: "4px 0 0",
                            color: "var(--muted)",
                            fontSize: 11,
                          }}
                        >
                          {user?.role || "investigator"}
                        </p>
                      </div>
                    </div>

                    <div className="info-row">
                      <span>Username</span>
                      <b>{user?.username || "—"}</b>
                    </div>

                    <div className="info-row">
                      <span>Role</span>
                      <b>{user?.role || "—"}</b>
                    </div>

                    <div className="info-row">
                      <span>User ID</span>
                      <b>{shortId(user?.userId, 30)}</b>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {notice && (
        <div className="toast" role="status">
          <Check size={15} />
          <span>{notice}</span>

          <button
            className="icon-button"
            type="button"
            aria-label="Dismiss"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ROOT                                                                       */
/* -------------------------------------------------------------------------- */

function Root() {
  const [loggedIn, setLoggedIn] = useState(
    Boolean(localStorage.getItem("sentinel-token"))
  );

  if (!loggedIn) {
    return <Login onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <App
      onLogout={() => {
        setLoggedIn(false);
      }}
    />
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);