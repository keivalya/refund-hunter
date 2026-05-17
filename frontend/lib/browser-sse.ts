const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface BrowserStartResponse {
  session_id: string;
  live_url: string;
  status: string;
}

export async function startBrowserSession(
  caseId: string
): Promise<BrowserStartResponse> {
  const res = await fetch(`${API_BASE}/api/browser/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ case_id: caseId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to start browser session");
  }
  return res.json();
}

export function browserStreamUrl(sessionId: string): string {
  return `${API_BASE}/api/browser/${sessionId}/stream`;
}

export async function getBrowserSession(sessionId: string) {
  const res = await fetch(`${API_BASE}/api/browser/${sessionId}`);
  if (!res.ok) throw new Error("Failed to fetch session state");
  return res.json();
}
