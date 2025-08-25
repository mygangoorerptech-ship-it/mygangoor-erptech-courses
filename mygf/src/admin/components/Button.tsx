// mygf/src/components/Button.tsx
import React from 'react'
import { cn } from './cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
}

export default function Button({
  variant = 'primary',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm',
        // variants
        variant === 'primary'   && 'bg-brand-600 hover:bg-brand-700 bg-indigo-600 hover:bg-indigo-700 text-white',
        variant === 'secondary' && 'border bg-white text-slate-700 hover:bg-slate-50',
        variant === 'ghost'     && 'text-slate-700 hover:bg-slate-50',
        variant === 'danger'    && 'bg-red-600 text-white hover:bg-red-700',
        className
      )}
    />
  )
}
