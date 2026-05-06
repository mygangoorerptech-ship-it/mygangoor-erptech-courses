// backend/src/controllers/payoutsController.js
//
// Controller handling payout creation and listing for superadmin. Payouts
// represent the movement of funds from the platform to an organisation.
// Only superadmins may view and create payouts. Creating a payout will
// automatically mark the referenced Payment records as settled.

import mongoose from "mongoose";
import Payout from "../models/Payout.js";
import Payment from "../models/Payment.js";
import Organization from "../models/Organization.js";

const isOid = (v) => mongoose.isValidObjectId(v);

/**
 * List payouts. Supports optional filtering by organisation and date range.
 * Query params: orgId, dateFrom, dateTo.
 */
export async function list(req, res) {
  try {
    const actor = req.user;
    if (!actor || actor.role !== "superadmin") {
      return res.status(403).json({ ok: false });
    }
    const { orgId, dateFrom, dateTo } = req.query || {};
    const filter = {};
    if (orgId && isOid(orgId)) filter.orgId = orgId;
    // optional date filtering on createdAt
    if (dateFrom || dateTo) {
      const gte = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : new Date(0);
      const lte = dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : new Date();
      filter.createdAt = { $gte: gte, $lte: lte };
    }
    const payouts = await Payout.find(filter).sort({ createdAt: -1 }).lean();
    // attach organisation info
    const orgIds = [...new Set(payouts.map((p) => String(p.orgId)))]
      .filter((id) => isOid(id));
    const orgDocs = await Organization.find({ _id: { $in: orgIds } }).select(
      "_id name code"
    ).lean();
    const orgById = Object.fromEntries(orgDocs.map((o) => [String(o._id), o]));
    const out = payouts.map((p) => {
      const o = orgById[String(p.orgId)] || {};
      return {
        id: String(p._id),
        orgId: String(p.orgId),
        orgName: o.name || p.orgId,
        orgCode: o.code || null,
        totalAmount: p.totalAmount,
        status: p.status,
        method: p.method,
        reference: p.reference || null,
        note: p.note || null,
        paymentCount: p.paymentIds?.length || 0,
        createdAt: p.createdAt,
      };
    });
    return res.json(out);
  } catch (e) {
    console.error("[payouts.list]", e);
    return res.status(500).json({ ok: false, message: "payout list failed" });
  }
}

/**
 * Create a payout for an organisation. Body should contain orgId and optional
 * paymentIds array. If paymentIds omitted, all unsettled captured payments for
 * the org are included. Optional fields: method, reference, note.
 */
export async function create(req, res) {
  const session = await mongoose.startSession();

  try {
    const actor = req.user || {};
    if (!actor || actor.role !== "superadmin") {
      return res.status(403).json({ ok: false });
    }

    // 🔧 robust actor id extraction
    const actorId = actor.sub || actor._id || actor.id || actor.uid || null;
    if (!actorId) {
      console.error("[payouts.create] Missing actor id on token", actor);
      return res.status(401).json({ ok: false, message: "Unauthenticated" });
    }

    const {
      orgId,
      paymentIds,
      method,
      reference,
      note,
      includeSettled,
      dateFrom,
      dateTo
    } = req.body || {};

    // ✅ validate orgId
    if (!orgId || !mongoose.isValidObjectId(orgId)) {
      return res.status(400).json({ ok: false, message: "invalid orgId" });
    }

    // ✅ ensure org exists (CRITICAL)
    const org = await Organization.findById(orgId).lean();
    if (!org) {
      return res.status(404).json({ ok: false, message: "organization not found" });
    }

    // ✅ base filter
    const filter = {
      orgId,
      type: "online",
      status: "captured",
      ...(includeSettled ? {} : { settled: false }),
    };

    // ✅ explicit paymentIds handling (SECURE)
    if (Array.isArray(paymentIds) && paymentIds.length > 0) {
      const ids = paymentIds.filter((id) => mongoose.isValidObjectId(id));

      if (!ids.length) {
        return res.status(400).json({ ok: false, message: "no valid paymentIds" });
      }

      filter._id = { $in: ids };
      filter.orgId = orgId; // 🔒 enforce org scope
    }

    // ✅ date filter
    if (dateFrom || dateTo) {
      const gte = dateFrom
        ? new Date(`${dateFrom}T00:00:00.000Z`)
        : new Date(0);

      const lte = dateTo
        ? new Date(`${dateTo}T23:59:59.999Z`)
        : new Date();

      filter.createdAt = { $gte: gte, $lte: lte };
    }

    let payoutDoc;

    await session.withTransaction(async () => {
      const payments = await Payment.find(filter).session(session).lean();

      if (!payments.length) {
        throw new Error("no payments to payout");
      }

      const total = payments.reduce((sum, p) => sum + p.amount, 0);
      const payIds = payments.map((p) => p._id);

      // ✅ race-safe update
      if (!includeSettled) {
        await Payment.updateMany(
          { _id: { $in: payIds }, settled: false },
          { $set: { settled: true } },
          { session }
        );
      }

      const payout = await Payout.create(
        [
          {
            orgId,
            paymentIds: payIds,
            totalAmount: total,
            status: "completed",
            method: method || "manual",
            reference: reference || null,
            note: note || null,
            createdBy: actorId,
          },
        ],
        { session }
      );

      payoutDoc = payout[0];
    });

    return res.json({
      ok: true,
      id: payoutDoc._id,
      totalAmount: payoutDoc.totalAmount,
      paymentCount: payoutDoc.paymentIds.length,
    });

  } catch (e) {
    console.error("[payouts.create]", e);

    return res.status(400).json({
      ok: false,
      message: e.message || "payout create failed",
    });

  } finally {
    // ✅ always clean session
    session.endSession();
  }
}

/**
 * Get a payout by id. Expands paymentIds to include basic payment info.
 */
export async function getOne(req, res) {
  try {
    const actor = req.user;
    if (!actor || actor.role !== "superadmin") {
      return res.status(403).json({ ok: false });
    }
    const id = req.params?.id;
    if (!id || !isOid(id)) {
      return res.status(400).json({ ok: false, message: "invalid id" });
    }
    const payout = await Payout.findById(id).lean();
    if (!payout) {
      return res.status(404).json({ ok: false, message: "not found" });
    }
    // gather payment details
    const payDocs = await Payment.find({ _id: { $in: payout.paymentIds } }).select(
      "_id amount courseId orgId studentId createdAt settled"
    ).lean();
    // compile details; convert amounts to paise
    const details = payDocs.map((p) => ({
      id: String(p._id),
      amount: p.amount,
      courseId: p.courseId ? String(p.courseId) : null,
      studentId: p.studentId ? String(p.studentId) : null,
      createdAt: p.createdAt,
    }));
    return res.json({
      id: String(payout._id),
      orgId: String(payout.orgId),
      paymentCount: payout.paymentIds.length,
      totalAmount: payout.totalAmount,
      status: payout.status,
      method: payout.method,
      reference: payout.reference || null,
      note: payout.note || null,
      createdAt: payout.createdAt,
      payments: details,
    });
  } catch (e) {
    console.error("[payouts.getOne]", e);
    return res.status(500).json({ ok: false, message: "payout fetch failed" });
  }
}