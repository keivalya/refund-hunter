import Link from "next/link";

export function TopNav() {
  return (
    <header className="px-6 py-4">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/"
          className="text-[15px] font-semibold tracking-tight hover:opacity-90 transition-opacity"
        >
          refund hunter
        </Link>
      </div>
    </header>
  );
}
