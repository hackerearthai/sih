const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

async function request(path, options = {}) {
  const token = localStorage.getItem("sentinel-token");
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Do not set Content-Type for FormData. The browser must add the boundary.
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("sentinel-token");
      localStorage.removeItem("sentinel-user-id");
      localStorage.removeItem("sentinel-role");
    }

    throw new Error(data.message || data.error || "Request failed");
  }

  return data;
}

export function login(username, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function getDocuments() {
  return request("/documents");
}

export function getDocument(docId) {
  return request(`/documents/${encodeURIComponent(docId)}`);
}

export function verifyDocument(docId) {
  return request(`/documents/${encodeURIComponent(docId)}/verify`, {
    method: "POST",
  });
}

export function getDocumentHistory(docId) {
  return request(`/documents/${encodeURIComponent(docId)}/history`);
}

export function uploadDocument(file, uploaderId) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("uploaderId", uploaderId);

  return request("/documents/upload", {
    method: "POST",
    body: formData,
  });
}

export function addDocumentVersion(docId, file, reason, updatedBy) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("reason", reason);
  formData.append("updatedBy", updatedBy);

  return request(`/documents/${encodeURIComponent(docId)}/version`, {
    method: "POST",
    body: formData,
  });
}

export function logout() {
  localStorage.removeItem("sentinel-token");
  localStorage.removeItem("sentinel-user-id");
  localStorage.removeItem("sentinel-role");
}
