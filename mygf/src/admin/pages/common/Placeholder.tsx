import React from 'react'
export default function Placeholder({title,description}:{title:string,description?:string}){
  return (<div className="space-y-4">
    <h1 className="text-2xl font-semibold">{title}</h1>
    {description && <p className="text-slate-600">{description}</p>}
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="rounded-xl border bg-white p-4"><div className="text-sm text-slate-500">Sample metric</div><div className="text-2xl font-semibold mt-1">—</div></div>
      <div className="rounded-xl border bg-white p-4"><div className="text-sm text-slate-500">Recent activity</div><div className="text-slate-600 mt-1 text-sm">No data yet.</div></div>
      <div className="rounded-xl border bg-white p-4"><div className="text-sm text-slate-500">Shortcuts</div><ul className="mt-2 text-sm list-disc pl-4 text-slate-600"><li>Create new</li><li>Import CSV</li><li>View settings</li></ul></div>
    </div></div>)
}