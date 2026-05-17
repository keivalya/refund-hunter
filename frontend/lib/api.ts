const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function getGmailAuthUrl(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/auth/gmail/start`);
  if (!res.ok) throw new Error("Failed to start Gmail auth");
  const data = await res.json();
  return data.auth_url;
}

export async function getSubscriptions() {
  const res = await fetch(`${API_BASE}/api/subscriptions`);
  if (!res.ok) {
    if (res.status === 401) throw new Error("Gmail not connected");
    throw new Error("Failed to fetch subscriptions");
  }
  return res.json();
}

export async function getCase() {
  const res = await fetch(`${API_BASE}/api/case`);
  if (!res.ok) throw new Error("Failed to fetch case");
  return res.json();
}

export async function startCall(phoneNumber: string) {
  const res = await fetch(`${API_BASE}/api/calls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone_number: phoneNumber }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to start call");
  }
  return res.json();
}

export async function getCall(callId: string) {
  const res = await fetch(`${API_BASE}/api/calls/${callId}`);
  if (!res.ok) throw new Error("Failed to fetch call");
  return res.json();
}

export function streamTranscriptUrl(callId: string) {
  return `${API_BASE}/api/calls/${callId}/stream`;
}
