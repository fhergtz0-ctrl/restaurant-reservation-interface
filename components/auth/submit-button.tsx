"use client"

import { useFormStatus } from "react-dom"
import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Submit button that reflects the parent form's pending state. */
export function SubmitButton({
  children,
  pendingText,
}: {
  children: React.ReactNode
  pendingText: string
}) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" className="w-full gap-2" disabled={pending}>
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  )
}
