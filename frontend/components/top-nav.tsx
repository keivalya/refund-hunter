import Link from "next/link";
import { Logo } from "@/components/logo";

export function TopNav() {
  return (
    <header className="px-6 py-5">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center hover:opacity-90 transition-opacity"
          aria-label="Refund Hunter — home"
        >
          <Logo wordmark size={32} />
        </Link>
      </div>
    </header>
  );
}
