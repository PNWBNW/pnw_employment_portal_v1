"use client"

import * as React from "react"

import { cn } from "@/src/lib/utils"

interface SelectContextValue {
  value: string
  onValueChange: (value: string) => void
}

const SelectContext = React.createContext<SelectContextValue>({
  value: "",
  onValueChange: () => {},
})

function Select({
  children,
  value: controlledValue,
  onValueChange,
  defaultValue = "",
}: {
  children: React.ReactNode
  value?: string
  onValueChange?: (value: string) => void
  defaultValue?: string
}) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : uncontrolledValue

  const handleChange = React.useCallback(
    (newValue: string) => {
      if (!isControlled) setUncontrolledValue(newValue)
      onValueChange?.(newValue)
    },
    [isControlled, onValueChange]
  )

  return (
    <SelectContext.Provider value={{ value, onValueChange: handleChange }}>
      {children}
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className
      )}
      {...props}
    >
      {children}
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
        className="ml-2 opacity-50"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  )
})
SelectTrigger.displayName = "SelectTrigger"

function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value } = React.useContext(SelectContext)
  return <span>{value || placeholder}</span>
}

function SelectContent({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  const { value, onValueChange } = React.useContext(SelectContext)

  return (
    <select
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)}
    >
      {children}
    </select>
  )
}

function SelectItem({
  children,
  value,
  className,
  ...props
}: React.OptionHTMLAttributes<HTMLOptionElement> & { value: string }) {
  return (
    <option value={value} className={className} {...props}>
      {children}
    </option>
  )
}

export { Select, SelectTrigger, SelectContent, SelectItem, SelectValue }
