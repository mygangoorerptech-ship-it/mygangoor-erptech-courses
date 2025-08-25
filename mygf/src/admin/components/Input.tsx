// mygf/src/admin/components/Input.tsx
import React from 'react'; import { cn } from './cn'
export function Input(p:React.InputHTMLAttributes<HTMLInputElement>){ return <input {...p} className={cn('w-full rounded-md border px-3 py-2 text-sm', p.className)} /> }
export function Select(p:React.SelectHTMLAttributes<HTMLSelectElement>){ return <select {...p} className={cn('w-full rounded-md border px-3 py-2 text-sm', p.className)} /> }
export function Label({children}:{children:React.ReactNode}){ return <label className="text-sm text-slate-700">{children}</label> }