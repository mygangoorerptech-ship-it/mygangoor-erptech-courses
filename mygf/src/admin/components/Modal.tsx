// mygf/src/admin/components/Modal.tsx
import React from 'react'
export default function Modal({open,onClose,title,children}:{open:boolean,onClose:()=>void,title:string,children:React.ReactNode}){
  if(!open) return null; return (<div className="fixed inset-0 z-50">
    <div className="absolute inset-0 bg-black/30" onClick={onClose}/>
    <div className="absolute inset-0 grid place-items-center p-4">
      <div className="w-full max-w-lg rounded-xl border bg-white shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  </div>)
}