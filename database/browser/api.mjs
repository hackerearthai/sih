// Browser-safe API client. Database credentials stay in the server process.
const base = (import.meta.env?.VITE_API_URL || '/api').replace(/\/$/, '');
const sessionKey = 'sentinel-session';
export function getSession() {
  try { return JSON.parse(sessionStorage.getItem(sessionKey)) || null; }
  catch { return null; }
}
export function clearSession() {
  sessionStorage.removeItem(sessionKey);
  localStorage.removeItem('sentinel-auth');
}
async function request(route, options = {}) {
  const session = getSession();
  const headers = { ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}), ...options.headers };
  let response;
  try { response = await fetch(`${base}${route}`, { ...options, headers }); }
  catch { throw new Error('Cannot reach the server. Start the app from the database folder.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && route !== '/auth/login') {
      clearSession();
      window.dispatchEvent(new Event('sentinel-session-expired'));
    }
    throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  }
  if (data === null) throw new Error('The API did not return data. Check the API URL or development proxy.');
  return data;
}
export async function login(username, password) {
  const data = await request('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  sessionStorage.setItem(sessionKey, JSON.stringify({ ...data, username }));
  return data;
}
export const currentUser = () => request('/auth/me');
export function toDocument(row) {
  return {
    ...row, id: row.docId, name: row.filename,
    type: row.filename?.split('.').pop()?.toUpperCase() || 'Document',
    size: row.sizeBytes == null ? 'Size unavailable' : row.sizeBytes < 1024 ? `${row.sizeBytes} B` : row.sizeBytes < 1024 * 1024 ? `${(row.sizeBytes / 1024).toFixed(1)} KB` : `${(row.sizeBytes / 1024 / 1024).toFixed(1)} MB`,
    status: row.status === 'tampered' ? 'tampered' : row.status === 'verified' && row.aiRiskFlag !== 'review_recommended' ? 'clean' : 'review',
    uploader: row.uploader || row.uploaderId,
    modified: row.timestamp ? new Date(row.timestamp).toLocaleString() : 'Unknown',
    hash: row.docHash || 'Unavailable',
    flagReason: row.status === 'tampered' ? `File differs from its ${row.isDemo ? 'saved demo fingerprint' : 'blockchain record'}` : row.aiRiskFlag === 'review_recommended' ? 'Review recommended' : row.status === 'verified' ? (row.isDemo ? 'Demo fingerprint matches (not blockchain verified)' : 'Hash matches anchored record') : 'Awaiting integrity verification',
  };
}
export async function listDocuments() {
  return (await request('/workspace/records')).map(toDocument);
}
export const documentDetails = (id) => request(`/workspace/records/${encodeURIComponent(id)}`);
export const verifyDocument = (id) => request(`/workspace/records/${encodeURIComponent(id)}/verify`, { method: 'POST' });
export const documentHistory = (id) => request(`/workspace/records/${encodeURIComponent(id)}/history`);
export function uploadDocument(file, { demo = false, workspace = 'Central Investigations' } = {}) {
  const body = new FormData();
  body.append('file', file);
  body.append('workspace', workspace);
  return request(demo ? '/workspace/demo/upload' : '/documents/upload', { method: 'POST', body });
}
const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const members = () => request('/workspace/members');
export const addMember = (body) => request('/workspace/members', json('POST', body));
export const preferences = () => request('/workspace/preferences');
export const savePreferences = (body) => request('/workspace/preferences', json('PUT', body));
export const activity = () => request('/workspace/activity');
export const notifications = () => request('/workspace/notifications');
export const markRead = (ids) => request('/workspace/notifications/read', json('POST', { ids }));
export const updateDocument = (id, body) => request(`/workspace/records/${encodeURIComponent(id)}`, json('PATCH', body));
export function addVersion(doc, file, reason) {
  const body = new FormData(); body.append('file', file); body.append('reason', reason);
  return request(doc.isDemo ? `/workspace/records/${encodeURIComponent(doc.id)}/demo-version` : `/documents/${encodeURIComponent(doc.id)}/version`, { method: 'POST', body });
}
export async function downloadDocument(doc, version) {
  const response = await fetch(`${base}/workspace/records/${encodeURIComponent(doc.id)}/download${version ? `?version=${version}` : ''}`, {
    headers: { Authorization: `Bearer ${getSession()?.token || ''}` },
  });
  if (!response.ok) {
    if (response.status === 401) { clearSession(); window.dispatchEvent(new Event('sentinel-session-expired')); }
    throw new Error((await response.json().catch(() => ({}))).error || 'Download failed');
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a'); link.href = url; link.download = doc.name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const workspaces = ['Central Investigations', 'Digital Evidence Unit', 'Regional Forensics'];
export const defaultPreferences = { displayName: '', workspace: 'All workspaces', theme: 'dark', defaultFilter: 'all', notifications: true };
export function searchRecords(docs, query, { status = 'all', assignee = '', workspace = '' } = {}) {
  const needle = query.trim().toLowerCase();
  return docs.filter((doc) => (!workspace || doc.workspace === workspace) && (status === 'all' || doc.status === status) && (!assignee || doc.assignedTo === assignee) &&
    `${doc.name} ${doc.hash} ${doc.caseReference} ${doc.uploader} ${doc.assignee || ''} ${doc.workspace}`.toLowerCase().includes(needle));
}
export function answerRecords(docs, query) {
  const normalized = query.toLowerCase();
  const scope = /review|attention|flagged/.test(normalized) ? docs.filter((doc) => doc.status !== 'clean') : /tamper|mismatch/.test(normalized) ? docs.filter((doc) => doc.status === 'tampered') : /verified|matched/.test(normalized) ? docs.filter((doc) => doc.status === 'clean') : /count|how many|summary|summari[sz]e|total|all documents/.test(normalized) ? docs : searchRecords(docs, query);
  return { text: `${scope.length} matching record${scope.length === 1 ? '' : 's'} in the selected workspace/context. ${scope.filter((doc) => doc.isDemo).length} are demo records.`, docs: scope };
}
