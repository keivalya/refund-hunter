const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface RetentionPattern {
  offer: string;
  freq: number;
  label: string;
}

export interface MerchantPlaybook {
  call_count: number;
  success_rate: number;
  avg_duration_seconds: number | null;
  avg_reply_hours: number | null;
  outcomes: Record<string, number>;
  retention_patterns: RetentionPattern[];
  confirmation_examples: string[];
  error?: string;
}

export type InsightsResponse = Record<string, MerchantPlaybook>;

export async function getAllInsights(): Promise<InsightsResponse> {
  const res = await fetch(`${API_BASE}/api/insights`);
  if (!res.ok) throw new Error("Failed to fetch insights");
  return res.json();
}

export async function getMerchantInsights(
  merchantId: string
): Promise<MerchantPlaybook> {
  const res = await fetch(`${API_BASE}/api/insights/${merchantId}`);
  if (!res.ok) throw new Error("Failed to fetch insights");
  return res.json();
}
