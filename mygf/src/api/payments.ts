// src/api/payments.ts
import { api } from './client';
import type { Payment } from '../types/payment';

export async function listPayments(params?: { q?: string; status?: string; type?: string }): Promise<Payment[]> {
  const r = await api.get('/payments', { params });
  return r.data || [];
}

export async function createOfflinePayment(payload: {
  studentId: string;
  courseId: string;
  amount: number; // paise
  receiptNo?: string;
  referenceId?: string;
  notes?: string;
}): Promise<Payment> {
  const r = await api.post('/payments/offline', payload);
  return r.data;
}

export async function verifyPayment(id: string): Promise<Payment> {
  const r = await api.post(`/payments/${id}/verify`, {});
  return r.data;
}

export async function rejectPayment(id: string): Promise<Payment> {
  const r = await api.post(`/payments/${id}/reject`, {});
  return r.data;
}

// ✅ add refund support (your UI already calls this)
export async function refundPayment(id: string): Promise<Payment> {
  const r = await api.post(`/payments/${id}/refund`, {});
  return r.data;
}

// student self-claim
export async function claimReceipt(payload: {
  orgId: string;
  courseId: string;
  amount: number; // paise
  receiptNo?: string;
  referenceId?: string;
  notes?: string;
}): Promise<Payment> {
  const r = await api.post('/student/payments/claim', payload);
  return r.data;
}

export async function listSaPayments(params?: { q?: string; status?: string; type?: string }){
  const r = await api.get('/sa/payments', { params })
  return r.data || []
}
