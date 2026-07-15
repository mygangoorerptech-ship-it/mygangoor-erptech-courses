
export default function Placeholder({title,description}:{title:string,description?:string}){
  return (<div className="space-y-4">
    <h1 className="text-2xl font-semibold">{title}</h1>
    {description && <p className="text-black">{description}</p>}
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="rounded-xl border bg-white p-4"><div className="text-sm text-black">Sample metric</div><div className="text-2xl font-semibold mt-1">—</div></div>
      <div className="rounded-xl border bg-white p-4"><div className="text-sm text-black">Recent activity</div><div className="text-black mt-1 text-sm">No data yet.</div></div>
      <div className="rounded-xl border bg-white p-4"><div className="text-sm text-black">Shortcuts</div><ul className="mt-2 text-sm list-disc pl-4 text-black"><li>Create new</li><li>Import CSV</li><li>View settings</li></ul></div>
    </div></div>)
}