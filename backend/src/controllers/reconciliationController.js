// backend/src/controllers/reconciliationController.js
//
// Controller for reconciliation and settlement of payments. This module
// exposes endpoints for superadmin users to view aggregated payment
// information per organisation and mark captured online payments as
// settled. Settling a payment indicates that funds have been
// reconciled with the organisation and the payment should no longer be
// included in further payouts.

import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Organization from "../models/Organization.js";

// Guard helpers
const isOid = (v) => mongoose.isValidObjectId(v);

/**
 * Build a summary of payments grouped by organisation. Only online
 * payments with status "captured" are considered for settlement. The
 * summary includes total captured amount, total amount already
 * settled, and the outstanding amount still to be settled. Amounts
 * are returned in paise. The response list is sorted alphabetically
 * by organisation name for easier viewing in the UI.
 */
export async function list(req, res) {
  try {
    const actor = req.user;
    if (!actor || actor.role !== "superadmin") {
      return res.status(403).json({ ok: false });
    }

    // Optional query params for date range filtering (ISO dates)
    const { dateFrom, dateTo } = req.query || {};
    const match = { type: "online", status: "captured" };

    // Apply date filters on createdAt if provided
    if (dateFrom || dateTo) {
      const gte = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : new Date(0);
      const lte = dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : new Date();
      match.createdAt = { $gte: gte, $lte: lte };
    }

    const pipe = [
      { $match: match },
      {
        $group: {
          _id: { orgId: "$orgId", settled: "$settled" },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ];
    const groups = await Payment.aggregate(pipe);

    // Aggregate per organisation across settled/unsettled buckets
    const summary = {};
    for (const g of groups) {
      const oid = g._id.orgId ? String(g._id.orgId) : null;
      if (!oid) continue;
      if (!summary[oid]) {
        summary[oid] = {
          orgId: oid,
          totalCaptured: 0,
          settledAmount: 0,
          unsettledAmount: 0,
          unsettledCount: 0,
        };
      }
      summary[oid].totalCaptured += g.total;
      if (g._id.settled) {
        summary[oid].settledAmount += g.total;
      } else {
        summary[oid].unsettledAmount += g.total;
        summary[oid].unsettledCount += g.count;
      }
    }

    const orgIds = Object.keys(summary);
    const orgDocs = await Organization.find({ _id: { $in: orgIds } }).select(
      "_id name code"
    ).lean();
    const orgById = Object.fromEntries(orgDocs.map((o) => [String(o._id), o]));
    const out = Object.values(summary).map((s) => {
      const o = orgById[s.orgId] || {};
      return {
        orgId: s.orgId,
        orgName: o.name || s.orgId,
        orgCode: o.code || null,
        totalCaptured: s.totalCaptured,
        settledAmount: s.settledAmount,
        unsettledAmount: s.unsettledAmount,
        unsettledCount: s.unsettledCount,
      };
    });
    // Sort alphabetically
    out.sort((a, b) => (a.orgName || "").localeCompare(b.orgName || ""));
    return res.json(out);
  } catch (e) {
    console.error("[reconciliation.list]", e);
    return res.status(500).json({ ok: false, message: "reconciliation list failed" });
  }
}

/**
 * Mark a set of captured payments as settled for a given organisation.
 * Accepts an array of paymentIds in the request body. Only payments
 * belonging to the specified organisation, with type "online",
 * status "captured" and not already settled will be updated. Returns
 * the updated summary for that organisation. If paymentIds are not
 * provided, all unsettled captured payments for the organisation
 * within the optional date range will be settled.
 */
export async function settleOrg(req, res) {
  try {
    const actor = req.user;
    if (!actor || actor.role !== "superadmin") {
      return res.status(403).json({ ok: false });
    }
    const orgId = req.params?.orgId;
    if (!orgId || !isOid(orgId)) {
      return res.status(400).json({ ok: false, message: "invalid orgId" });
    }

    const { paymentIds, dateFrom, dateTo } = req.body || {};
    const filter = { orgId, type: "online", status: "captured", settled: false };
    // If specific payments provided, restrict to those
    if (Array.isArray(paymentIds) && paymentIds.length > 0) {
      const ids = paymentIds.filter((id) => isOid(id));
      filter._id = { $in: ids };
    }
    // Optional date range filter on createdAt
    if (dateFrom || dateTo) {
      const gte = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : new Date(0);
      const lte = dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : new Date();
      filter.createdAt = { $gte: gte, $lte: lte };
    }
    const result = await Payment.updateMany(filter, { $set: { settled: true } });
    // Return updated summary (for all orgs) without mutating req.query.  Mutating
    // req.query can throw because Express defines it as a getter-only property.
    return await list(req, res);
  } catch (e) {
    console.error("[reconciliation.settleOrg]", e);
    return res.status(500).json({ ok: false, message: "reconciliation settle failed" });
  }
}