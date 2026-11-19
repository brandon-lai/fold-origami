import Link from "next/link"

export function Nav({ overlay = false }: { overlay?: boolean }) {
  return (
    <header
      className={
        overlay
          ? "pointer-events-none fixed inset-x-0 top-0 z-[300]"
          : "sticky top-0 z-[300] bg-[color-mix(in_oklch,var(--background)_80%,transparent)] backdrop-blur-xl"
      }
    >
      <nav aria-label="Main" className="pointer-events-auto mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="-mx-2 rounded-full px-2 py-2 text-[17px] font-semibold tracking-[-0.02em]">
          Fold
        </Link>
        <Link href="/models" className="-mx-2 rounded-full px-3 py-2 text-[15px] text-muted-foreground transition-colors duration-(--dur-press) hover:text-foreground">
          Library
        </Link>
      </nav>
    </header>
  )
}
