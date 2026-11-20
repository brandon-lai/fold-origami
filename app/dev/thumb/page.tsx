import { notFound } from "next/navigation"
import { ThumbStudio } from "./studio"

// Authoring tool: renders a finished model for the library thumbnail capture.
export default function ThumbPage() {
  if (process.env.NODE_ENV !== "development") notFound()
  return <ThumbStudio />
}
