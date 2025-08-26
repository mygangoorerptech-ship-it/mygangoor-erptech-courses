
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPayout } from '../../api/payouts'
import { formatINR } from '../../utils/format'
import { downloadCSV } from '../../utils/csv'

export default function PayoutDetail(){
  const { id } = useParams()
  const q = useQuery({ queryKey:['payout', id], queryFn: ()=> getPayout(id as string), enabled: !!id })
  const p = q.data
  if (q.isLoading) return <div>Loading...</div>
  if (!p) return <div>Not found</div>

  const exportLines = () => {
    const rows = (p.lines || []).map(l => ({
      order: l.orderNumber, course: l.course,
      gross: (l.gross/100).toFixed(2), fee: (l.fee/100).toFixed(2),
      tax: (l.tax/100).toFixed(2), net: (l.net/100).toFixed(2)
    }))
    downloadCSV(`payout-${p.id}-lines.csv`, rows as any)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{p.orgName}</h1>
          <div className="text-sm text-slate-600">{new Date(p.periodStart).toLocaleDateString()} → {new Date(p.periodEnd).toLocaleDateString()}</div>
        </div>
        <button className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" onClick={exportLines}>Export CSV</button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Gross" value={formatINR(p.gross)} />
        <Stat label="Fees" value={formatINR(p.fees)} />
        <Stat label="Tax" value={formatINR(p.tax)} />
        <Stat label="Net" value={formatINR(p.net)} />
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2 font-medium">Order</th>
              <th className="text-left p-2 font-medium">Course</th>
              <th className="text-right p-2 font-medium">Gross</th>
              <th className="text-right p-2 font-medium">Fee</th>
              <th className="text-right p-2 font-medium">Tax</th>
              <th className="text-right p-2 font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {(p.lines || []).map(l => (
              <tr key={l.id} className="border-b">
                <td className="p-2">{l.orderNumber}</td>
                <td className="p-2">{l.course}</td>
                <td className="p-2 text-right">{formatINR(l.gross)}</td>
                <td className="p-2 text-right">{formatINR(l.fee)}</td>
                <td className="p-2 text-right">{formatINR(l.tax)}</td>
                <td className="p-2 text-right">{formatINR(l.net)}</td>
              </tr>
            ))}
            {(!p.lines || p.lines.length===0) && <tr><td className="p-6 text-center text-slate-500" colSpan={6}>No payout lines</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value }:{ label:string, value:string }){
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  )
}
