// Keep the API address configurable so the same frontend can run locally or on a host.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:4000/api";

// Add the saved login token to requests and turn server errors into readable messages.
export async function api(path, options = {}) {
  const { body, headers = {}, ...settings } = options;
  const isForm = body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...settings,
    headers: {
      ...(body && !isForm ? { "Content-Type": "application/json" } : {}),
      ...(localStorage.getItem("careerpilot-token") ? { Authorization: `Bearer ${localStorage.getItem("careerpilot-token")}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: isForm ? body : JSON.stringify(body) }),
  });

  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event("careerpilot:session-expired"));
    throw new Error(data?.error || data?.detail || "The request could not be completed.");
  }
  return data;
}

// Download a private resume file while keeping its bearer token out of the browser URL.
export async function downloadPrivateFile(path, suggestedName) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("careerpilot-token") || ""}` },
  });
  if (!response.ok) throw new Error("The file could not be downloaded.");
  const fileUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = fileUrl;
  link.download = suggestedName;
  link.click();
  URL.revokeObjectURL(fileUrl);
}
