import React from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getOrder } from '../../api/orders'
import { formatINR } from '../../utils/format'

export default function OrderInvoice(){
  const { id } = useParams()
  const q = useQuery({ queryKey:['order', id], queryFn: ()=> getOrder(id as string), enabled: !!id })
  const o = q.data
  const onPrint = () => window.print()
  if (q.isLoading) return <div>Loading...</div>
  if (!o) return <div>Not found</div>
  const refunded = o.refunds.reduce((s,r)=> s+r.amount, 0)
  return (
    <div className="max-w-3xl mx-auto bg-white print:bg-white p-6 print:p-0">
      <div className="flex items-start justify-between border-b pb-4">
        <div><h1 className="text-2xl font-semibold">Invoice</h1><div className="text-sm text-slate-600">{o.number}</div></div>
        <button onClick={onPrint} className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50 print:hidden">Print / Save PDF</button>
      </div>
      <section className="grid sm:grid-cols-2 gap-6 mt-6">
        <div><div className="text-xs text-slate-500">Billed To</div><div className="font-medium">{o.userName}</div><div className="text-sm text-slate-600">{o.userEmail}</div></div>
        <div className="sm:text-right"><div className="text-xs text-slate-500">Issued</div><div>{new Date(o.createdAt).toLocaleString()}</div><div className="text-xs text-slate-500 mt-2">Payment Method</div><div className="capitalize">{o.paymentMethod}</div></div>
      </section>
      <section className="mt-6">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="text-left p-2 font-medium">Item</th><th className="text-right p-2 font-medium">Qty</th><th className="text-right p-2 font-medium">Price</th><th className="text-right p-2 font-medium">Amount</th></tr></thead>
          <tbody>{o.items.map(it=> (<tr key={it.id} className="border-b"><td className="p-2"><div className="font-medium">{it.name}</div><div className="text-xs text-slate-500">{it.sku}</div></td><td className="p-2 text-right">{it.quantity}</td><td className="p-2 text-right">{formatINR(it.amount)}</td><td className="p-2 text-right">{formatINR(it.amount*it.quantity)}</td></tr>))}</tbody>
          <tfoot>
            <tr><td colSpan={3} className="p-2 text-right">Subtotal</td><td className="p-2 text-right">{formatINR(o.subtotal)}</td></tr>
            <tr><td colSpan={3} className="p-2 text-right">Tax</td><td className="p-2 text-right">{formatINR(o.tax)}</td></tr>
            <tr><td colSpan={3} className="p-2 text-right font-semibold">Total</td><td className="p-2 text-right font-semibold">{formatINR(o.total)}</td></tr>
            {refunded>0 && <tr><td colSpan={3} className="p-2 text-right text-red-700">Refunded</td><td className="p-2 text-right text-red-700">- {formatINR(refunded)}</td></tr>}
          </tfoot>
        </table>
      </section>
      {o.refunds.length>0 && (<section className="mt-6"><div className="font-semibold mb-2">Refunds</div><div className="rounded-lg border">{o.refunds.map(r=> (<div key={r.id} className="flex justify-between p-2 border-b last:border-b-0"><div className="text-sm text-slate-700">{r.reason || 'Refund'}</div><div className="text-sm">{formatINR(r.amount)} • {new Date(r.createdAt).toLocaleString()}</div></div>))}</div></section>)}
      <style>{`@media print { .print\:hidden { display:none!important } body { background:white } }`}</style>
    </div>
  )
}