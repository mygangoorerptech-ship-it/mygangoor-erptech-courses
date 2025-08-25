// src/pages/admin/Overview.tsx
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAdminOverview } from '../../api/overview'
import { useAuth } from '../../auth/store'
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

export default function ADOverview(){
  const { user } = useAuth()
  const orgId = (user as any)?.orgId
  const q = useQuery({ queryKey:['admin-overview', orgId], queryFn: ()=> getAdminOverview(orgId) })
  const data = q.data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Overview</h1>
        <div className="flex gap-2">
          <Link to="/admin/courses"><Button variant="ghost">Manage courses</Button></Link>
          <Link to="/admin/students"><Button variant="ghost">Manage students</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Courses" value={data?.totals.courses ?? '—'}/>
        <Stat label="Students" value={data?.totals.students ?? '—'}/>
        <Stat label="Active subs" value={data?.totals.activeSubs ?? '—'}/>
        <Stat label="MRR (₹)" value={((data?.totals.mrr ?? 0)/100).toFixed(2)}/>
        <Stat label="Revenue 30d (₹)" value={((data?.totals.revenue30d ?? 0)/100).toFixed(2)}/>
        <Stat label="Assignments due (7d)" value={data?.totals.assignmentsDue7d ?? '—'}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent students */}
        <div className="rounded-xl border bg-white">
          <div className="px-4 py-2 border-b font-medium">Recent students</div>
          <div className="p-2">
            <table className="w-full text-sm">
              <thead className="text-slate-600">
                <tr><th className="text-left p-2">Name</th><th className="text-left p-2">Email</th></tr>
              </thead>
              <tbody>
                {(data?.recent.newStudents || []).map((s:any)=>(
                  <tr key={s.id} className="border-t">
                    <td className="p-2">{s.name || s.username}</td>
                    <td className="p-2">{s.email}</td>
                  </tr>
                ))}
                {(!data || (data.recent.newStudents||[]).length===0) && (
                  <tr><td className="p-4 text-center text-slate-500" colSpan={2}>No recent students</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent subscriptions */}
        <div className="rounded-xl border bg-white">
          <div className="px-4 py-2 border-b font-medium">Recent subscriptions</div>
          <div className="p-2">
            <table className="w-full text-sm">
              <thead className="text-slate-600">
                <tr><th className="text-left p-2">Student</th><th className="text-left p-2">Course</th><th className="text-right p-2">Amount</th></tr>
              </thead>
              <tbody>
                {(data?.recent.subscriptions || []).map((s:any)=>(
                  <tr key={s.id} className="border-t">
                    <td className="p-2">{s.studentEmail || s.studentName || '—'}</td>
                    <td className="p-2">{s.courseTitle || s.courseId || '—'}</td>
                    <td className="p-2 text-right">₹{((s.amount ?? s.price ?? 0)/100).toFixed(2)}</td>
                  </tr>
                ))}
                {(!data || (data.recent.subscriptions||[]).length===0) && (
                  <tr><td className="p-4 text-center text-slate-500" colSpan={3}>No subscriptions</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent audit */}
        <div className="rounded-xl border bg-white">
          <div className="px-4 py-2 border-b font-medium">Recent activity</div>
          <div className="p-2">
            <ul className="text-sm divide-y">
              {(data?.recent.audit || []).map((a:any)=>(
                <li key={a.id} className="p-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{a.action}</div>
                    <div className="text-xs text-slate-500">{new Date(a.createdAt || a.time || Date.now()).toLocaleString()}</div>
                  </div>
                  <div className="text-xs text-slate-600">{a.message || a.path}</div>
                </li>
              ))}
              {(!data || (data.recent.audit||[]).length===0) && (
                <li className="p-3 text-center text-slate-500">No recent activity</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
