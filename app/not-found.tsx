import Link from "next/link"
import { Nav } from "@/components/site/Nav"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="mx-auto flex min-h-[70dvh] max-w-[640px] flex-col items-start justify-center gap-4 px-6">
        <p className="text-[15px] text-muted-foreground">404</p>
        <h1 className="text-section leading-[1.05] font-semibold">This page folded itself away.</h1>
        <p className="text-[19px] text-muted-foreground">The address may be old, or the model isn’t in the library yet.</p>
        <Button size="lg" render={<Link href="/models" />} nativeButton={false}>
          Go to the library
        </Button>
      </main>
    </>
  )
}
