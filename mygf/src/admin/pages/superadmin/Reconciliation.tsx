import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listSettlements } from '../../api/settlements'
import { listPayouts } from '../../api/payouts'
import type { Settlement } from '../../types/settlement'
import { Input, Label, Select } from '../../components/Input'
import { formatINR } from '../../utils/format'
import { downloadCSV } from '../../utils/csv'

type Filters = { dateFrom?: string; dateTo?: string; gateway: 'all'|'razorpay'|'stripe'|'paypal' }

export default function Reconciliation(){
  const [filters, setFilters] = useState<Filters>({ gateway:'all' })

  const stlQ = useQuery({ queryKey:['settlements', filters], queryFn: ()=> listSettlements(filters) })
  const pQ = useQuery({ queryKey:['payouts-for-recon', filters], queryFn: ()=> listPayouts({ dateFrom: filters.dateFrom, dateTo: filters.dateTo, status: 'all' }) })

  const settlements = stlQ.data ?? []
  const payouts = pQ.data ?? []

  const settlementTotals = useMemo(()=> {
    const g = settlements.reduce((acc, s)=>{
      const key = s.gateway
      if(!acc[key]) acc[key] = { gross:0, fee:0, tax:0, net:0 }
      acc[key].gross += s.gross; acc[key].fee += s.fee; acc[key].tax += s.tax; acc[key].net += s.net
      acc['all'] = acc['all'] || { gross:0, fee:0, tax:0, net:0 }
      acc['all'].gross += s.gross; acc['all'].fee += s.fee; acc['all'].tax += s.tax; acc['all'].net += s.net
      return acc
    }, {} as Record<string,{gross:number,fee:number,tax:number,net:number}>)
    return g
  }, [settlements])

  const computedPayouts = useMemo(()=> {
    // Compute totals from payout lines (gross/fee/tax/net)
    const totals = payouts.reduce((acc, p)=>{
      const key = 'all'
      acc.gross += p.gross; acc.fee += p.fees; acc.tax += p.tax; acc.net += p.net
      return acc
    }, { gross:0, fee:0, tax:0, net:0 })
    return totals
  }, [payouts])

  const exportSummary = ()=> {
    const rows = [
      { type:'Settlements (all gateways)', gross:(settlementTotals['all']?.gross||0)/100, fee:(settlementTotals['all']?.fee||0)/100, tax:(settlementTotals['all']?.tax||0)/100, net:(settlementTotals['all']?.net||0)/100 },
      { type:'Computed payouts', gross:computedPayouts.gross/100, fee:computedPayouts.fee/100, tax:computedPayouts.tax/100, net:computedPayouts.net/100 },
      { type:'Delta (settlements - payouts)', gross:((settlementTotals['all']?.gross||0)-computedPayouts.gross)/100, fee:((settlementTotals['all']?.fee||0)-computedPayouts.fee)/100, tax:((settlementTotals['all']?.tax||0)-computedPayouts.tax)/100, net:((settlementTotals['all']?.net||0)-computedPayouts.net)/100 },
    ]
    downloadCSV('reconciliation-summary.csv', rows as any)
  }

  const exportSettlements = ()=> {
    const rows = settlements.map(s=> ({ gateway:s.gateway, reference:s.reference, settledAt:s.settledAt, gross:(s.gross/100).toFixed(2), fee:(s.fee/100).toFixed(2), tax:(s.tax/100).toFixed(2), net:(s.net/100).toFixed(2) }))
    downloadCSV('settlements.csv', rows as any)
  }

  return (
    <div className="space-y-6">
      <header className="grid gap-3 md:grid-cols-4">
        <div className="space-y-2 md:col-span-2">
          <Label>Date range</Label>
          <div className="flex gap-2">
            <Input type="date" value={filters.dateFrom||''} onChange={(e)=> setFilters(f=> ({...f, dateFrom: e.target.value || undefined}))} />
            <Input type="date" value={filters.dateTo||''} onChange={(e)=> setFilters(f=> ({...f, dateTo: e.target.value || undefined}))} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Gateway</Label>
          <Select value={filters.gateway} onChange={(e)=> setFilters(f=> ({...f, gateway: e.target.value as Filters['gateway']}))}>
            <option value="all">All</option>
            <option value="razorpay">Razorpay</option>
            <option value="stripe">Stripe</option>
            <option value="paypal">PayPal</option>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <button className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" onClick={exportSummary}>Export summary</button>
          <button className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" onClick={exportSettlements}>Export settlements</button>
        </div>
      </header>

      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card label="Settlements gross" value={formatINR(settlementTotals['all']?.gross || 0)} />
        <Card label="Settlements net" value={formatINR(settlementTotals['all']?.net || 0)} />
        <Card label="Payouts gross" value={formatINR(computedPayouts.gross)} />
        <Card label="Payouts net" value={formatINR(computedPayouts.net)} />
      </section>

      <div className="rounded-xl border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-2 font-medium">Gateway</th>
              <th className="text-left p-2 font-medium">Reference</th>
              <th className="text-left p-2 font-medium">Settled at</th>
              <th className="text-right p-2 font-medium">Gross</th>
              <th className="text-right p-2 font-medium">Fee</th>
              <th className="text-right p-2 font-medium">Tax</th>
              <th className="text-right p-2 font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {settlements.map(s=> (
              <tr key={s.id} className="border-b">
                <td className="p-2 capitalize">{s.gateway}</td>
                <td className="p-2">{s.reference}</td>
                <td className="p-2">{new Date(s.settledAt).toLocaleString()}</td>
                <td className="p-2 text-right">{formatINR(s.gross)}</td>
                <td className="p-2 text-right">{formatINR(s.fee)}</td>
                <td className="p-2 text-right">{formatINR(s.tax)}</td>
                <td className="p-2 text-right">{formatINR(s.net)}</td>
              </tr>
            ))}
            {settlements.length===0 && <tr><td className="p-6 text-center text-slate-500" colSpan={7}>No settlements in range</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Card({label, value}:{label:string, value:string}){
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  )
}