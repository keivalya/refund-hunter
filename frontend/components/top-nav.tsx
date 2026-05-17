export function TopNav() {
  return (
    <header className="border-b border-border px-6 py-3">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <a href="/" className="text-[15px] font-semibold tracking-tight">
          refund hunter
        </a>
        <span className="text-xs text-muted-foreground font-mono">
          demo mode &middot; v0.2
        </span>
      </div>
    </header>
  );
}
