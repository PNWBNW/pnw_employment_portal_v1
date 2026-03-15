"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/src/lib/utils"

const toastVariants = cva(
  "pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 pr-6 shadow-lg transition-all",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
        success: "border-green-500 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  title?: string
  description?: string
  onClose?: () => void
}

function Toast({ className, variant, title, description, onClose, ...props }: ToastProps) {
  return (
    <div className={cn(toastVariants({ variant }), className)} {...props}>
      <div className="grid gap-1">
        {title && <div className="text-sm font-semibold">{title}</div>}
        {description && <div className="text-sm opacity-90">{description}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-1 top-1 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none group-hover:opacity-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

// Toast state management
interface ToastItem {
  id: string
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success"
  duration?: number
}

type ToastAction =
  | { type: "ADD"; toast: ToastItem }
  | { type: "REMOVE"; id: string }

const toastListeners: Array<(toasts: ToastItem[]) => void> = []
let toastState: ToastItem[] = []
let toastCounter = 0

function dispatch(action: ToastAction) {
  switch (action.type) {
    case "ADD":
      toastState = [...toastState, action.toast]
      break
    case "REMOVE":
      toastState = toastState.filter((t) => t.id !== action.id)
      break
  }
  toastListeners.forEach((listener) => listener(toastState))
}

function toast({
  title,
  description,
  variant = "default",
  duration = 4000,
}: {
  title?: string
  description?: string
  variant?: "default" | "destructive" | "success"
  duration?: number
}) {
  const id = `toast-${++toastCounter}`
  dispatch({ type: "ADD", toast: { id, title, description, variant, duration } })

  if (duration > 0) {
    setTimeout(() => {
      dispatch({ type: "REMOVE", id })
    }, duration)
  }

  return id
}

function useToast() {
  const [toasts, setToasts] = React.useState<ToastItem[]>(toastState)

  React.useEffect(() => {
    toastListeners.push(setToasts)
    return () => {
      const index = toastListeners.indexOf(setToasts)
      if (index > -1) toastListeners.splice(index, 1)
    }
  }, [])

  return {
    toasts,
    toast,
    dismiss: (id: string) => dispatch({ type: "REMOVE", id }),
  }
}

function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]">
      {toasts.map((t) => (
        <Toast
          key={t.id}
          title={t.title}
          description={t.description}
          variant={t.variant}
          onClose={() => dismiss(t.id)}
        />
      ))}
    </div>
  )
}

export { Toast as default, toast, useToast, Toaster, toastVariants }
