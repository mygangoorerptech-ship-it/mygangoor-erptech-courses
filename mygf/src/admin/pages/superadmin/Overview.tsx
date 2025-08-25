// src/pages/superadmin/Overview.tsx
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSuperadminOverview } from '../../api/overview'
import { Link } from 'react-router-dom'
import Button from '../../components/Button'

function Stat({label, value, hint}:{label:string; value:string|number; hint?:string}){
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  )
}

export default function SAOverview(){
  const q = useQuery({ queryKey:['superadmin-overview'], queryFn: getSuperadminOverview })
  const data = q.data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Platform Overview</h1>
        <div className="flex gap-2">
          <Link to="/superadmin/organizations"><Button variant="ghost">Organizations</Button></Link>
          <Link to="/superadmin/users"><Button variant="ghost">Users</Button></Link>
          <Link to="/superadmin/payouts"><Button variant="ghost">Payouts</Button></Link>
          <Link to="/superadmin/reconciliation"><Button variant="ghost">Reconciliation</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <Stat label="Organizations" value={data?.totals.orgs ?? '—'}/>
        <Stat label="Admins" value={data?.totals.admins ?? '—'}/>
        <Stat label="Courses" value={data?.totals.courses ?? '—'}/>
        <Stat label="Students" value={data?.totals.students ?? '—'}/>
        <Stat label="Active subs" value={data?.totals.activeSubs ?? '—'}/>
        <Stat label="GMV 30d (₹)" value={((data?.totals.gmv30d ?? 0)/100).toFixed(2)}/>
        <Stat label="Payouts 30d (₹)" value={((data?.totals.payouts30d ?? 0)/100).toFixed(2)}/>
        <Stat label="Outstanding payouts (₹)" value={((data?.totals.outstandingPayouts ?? 0)/100).toFixed(2)}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top orgs */}
        <div className="rounded-xl border bg-white lg:col-span-2">
          <div className="px-4 py-2 border-b font-medium">Top organizations (30d revenue)</div>
          <div className="p-2 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-slate-600">
                <tr>
                  <th className="text-left p-2">Organization</th>
                  <th className="text-left p-2">Students</th>
                  <th className="text-left p-2">Courses</th>
                  <th className="text-right p-2">Revenue 30d</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topOrgs || []).map((o)=>(
                  <tr key={o.orgId || o.orgName || Math.random()} className="border-t">
                    <td className="p-2">{o.orgName || o.orgId || 'Unassigned'}</td>
                    <td className="p-2">{o.students}</td>
                    <td className="p-2">{o.courses}</td>
                    <td className="p-2 text-right">₹{(o.revenue30d/100).toFixed(2)}</td>
                  </tr>
                ))}
                {(!data || (data.topOrgs||[]).length===0) && (
                  <tr><td className="p-4 text-center text-slate-500" colSpan={4}>No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent audit */}
        <div className="rounded-xl border bg-white">
          <div className="px-4 py-2 border-b font-medium">Recent audit logs</div>
          <div className="p-2">
            <ul className="text-sm divide-y">
              {(data?.recentAudit || []).map((a:any)=>(
                <li key={a.id} className="p-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{a.action}</div>
                    <div className="text-xs text-slate-500">{new Date(a.createdAt || a.time || Date.now()).toLocaleString()}</div>
                  </div>
                  <div className="text-xs text-slate-600">{a.message || a.path}</div>
                  {a.actorEmail && <div className="text-xs text-slate-500">by {a.actorEmail}</div>}
                </li>
              ))}
              {(!data || (data.recentAudit||[]).length===0) && (
                <li className="p-3 text-center text-slate-500">No recent audit logs</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
