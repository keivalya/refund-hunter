import { CallPanel } from "@/components/call-panel";

const CASE_DATA = {
  case_id: "case_planet_fitness_001",
  merchant: "Planet Fitness",
  plan: "Classic Membership",
  monthly_cost: 24.99,
  member_name: "Keivalya Pandya",
  member_id: "PF-20240315-7842",
  home_club: "Planet Fitness - Downtown",
  billing_date: "15th of each month",
  member_since: "March 2024",
};

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Refund Hunter</h1>
            <p className="text-xs text-muted-foreground">
              AI-powered subscription cancellation
            </p>
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            Tier 0 — Live Demo
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <CallPanel caseData={CASE_DATA} />
        </div>
      </div>
    </main>
  );
}
