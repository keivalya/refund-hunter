const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface EmailMessage {
  message_id?: string;
  from: string;
  to?: string;
  subject?: string;
  preview?: string;
  body?: string;
  sent_at?: string;
  received_at?: string;
  source?: string;
}

export interface EmailStartResponse {
  thread_id: string;
  case_id: string;
  status: string;
  sent: EmailMessage;
  received: EmailMessage | null;
  confirmation_number: string | null;
}

export async function startEmailThread(
  caseId: string
): Promise<EmailStartResponse> {
  const res = await fetch(`${API_BASE}/api/email/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ case_id: caseId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to start email thread");
  }
  return res.json();
}

export function emailStreamUrl(threadId: string): string {
  return `${API_BASE}/api/email/${threadId}/stream`;
}
