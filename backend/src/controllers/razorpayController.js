// backend/src/controllers/razorpayController.js
import crypto from "crypto";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Enrollment from "../models/Enrollment.js";
import Course from "../models/Course.js";
import User from "../models/User.js";

const isOid = (v) => mongoose.isValidObjectId(v);

const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const RZP_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";

function rzpAuthHeader() { 
  const auth = Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString("base64"); 
  return { Authorization: `Basic ${auth}` }; 
} 
 
async function rzpGetPayment(paymentId) { 
  try { 
    const r = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, { 
      method: "GET", 
      headers: { ...rzpAuthHeader() }, 
    }); 
    if (!r.ok) return null; 
    return await r.json(); 
  } catch { 
    return null; 
  } 
}

async function rzpGetOrder(orderId) { 
  try { 
    const r = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, { 
      method: "GET", 
      headers: { ...rzpAuthHeader() }, 
    }); 
    if (!r.ok) return null; 
    return await r.json(); 
  } catch { 
    return null; 
  } 
}

async function resolveManagerId(orgId) {
  try {
    const u = await User.findOne({
      orgId,
      role: { $in: ["orgadmin", "admin"] },
      status: "active",
    }).select("_id").lean();
    return u?._id || null;
  } catch {
    return null;
  }
}

function calcDiscountPaise(kind, code, basePaise) {
  if (!basePaise) return 0;
  if (kind === "coupon" && String(code || "").trim().toLowerCase() === "welcome10") {
    return Math.floor(basePaise * 0.10);
  }
  if (kind === "refer") return Math.floor(basePaise * 0.05);
  return 0;
}

const { ObjectId } = mongoose.Types;
const toId = (v) => (isOid(v) ? new ObjectId(String(v)) : null);

async function ensureEnrollment({ studentId, courseId, orgId, paymentId, source, managerId }) {
  // Validate ids; don’t crash the request, but do log
  if (!isOid(studentId) || !isOid(courseId) || !isOid(orgId)) {
    console.warn("[enrollment] skipped: bad ids", { studentId, courseId, orgId });
    return;
  }

  const filter = { studentId, courseId, orgId };

  // IMPORTANT: do NOT include paymentId here to avoid $set/$setOnInsert conflict
  const update = {
    $setOnInsert: {
      studentId, courseId, orgId,
      status: "premium",
      source: source || "online",
      ...(managerId ? { managerId } : {}),
    },
  };

  // Always set/refresh latest paymentId via $set (safe for both insert & update)
  if (paymentId) update.$set = { paymentId };

  try {
    await Enrollment.updateOne(filter, update, { upsert: true, setDefaultsOnInsert: true });

    // Backfill managerId only if it was absent
    if (managerId) {
      await Enrollment.updateOne(
        { ...filter, $or: [{ managerId: null }, { managerId: { $exists: false } }] },
        { $set: { managerId } }
      );
    }
  } catch (e) {
    // If verify() and webhook race, a dup-key can happen; ignore that one.
    if (e?.code === 11000) return;
    console.error("[enrollment] upsert failed:", e?.message);
  }
}

export async function createOrder(req, res) {
  try {
    const actor = req.user;
    if (!actor) return res.status(401).json({ ok: false });

    const { courseId, orgId, discountKind, couponCode, mode, partAmount } = req.body || {};
    if (!isOid(courseId) || !isOid(orgId)) return res.status(400).json({ ok: false, message: "invalid ids" });
    const managerId = await resolveManagerId(orgId);

    // robust student id for notes (dashboard display) 
    const studentIdForNotes = actor._id || actor.id || actor.sub || null;

    const course = await Course.findOne({ _id: courseId, $or: [{ orgId }, { orgId: null }] }).lean();
    if (!course) return res.status(404).json({ ok: false, message: "course not found" });

       // If Course.price is in rupees, convert to paise for Razorpay: 
const basePaise = Math.max(0, Math.round(Number(course.price)));
const discountPaise = calcDiscountPaise(discountKind, couponCode, basePaise);
const totalPaise = Math.max(0, basePaise - discountPaise);

    let payablePaise = totalPaise;
    let partial = false;
    let firstPaymentMin = undefined;
    if (mode === "part") {
      partial = true;
      const amt = Math.floor(Number(partAmount) * 100) || 0; // rupees → paise from client hint
      // guard on server: between 20% and 100% of total
      const min = Math.ceil(totalPaise * 0.2);
      payablePaise = Math.min(totalPaise, Math.max(min, amt));
      firstPaymentMin = payablePaise;
    }

    // Create a pending Payment doc first (idempotency safety around webhooks)
    const doc = await Payment.create({
      type: "online",
      method: "razorpay",
      status: "pending",
      amount: payablePaise,
      currency: "INR",
      orgId,
      courseId,
      // be defensive: some auth middlewares expose sub/id instead of _id 
      studentId: actor._id || actor.sub || actor.id,
      provider: "razorpay",
      managerId: managerId || null,
      notes: JSON.stringify({ discountKind: discountKind || "none", couponCode: couponCode || null }),
    });

    // Create Razorpay order via basic auth fetch (no extra deps)
    const auth = Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString("base64");
    const r = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: payablePaise,
        currency: "INR",
        receipt: `pay_${doc._id}`,
        partial_payment: !!partial,
        ...(partial && firstPaymentMin ? { first_payment_min_amount: firstPaymentMin } : {}),
        notes: {
          courseId: String(courseId),
          orgId: String(orgId),
          ...(studentIdForNotes ? { studentId: String(studentIdForNotes) } : {}),
          paymentId: String(doc._id),
        },
      }),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(502).json({ ok: false, message: "razorpay order failed", detail: text.slice(0, 500) });
    }
    const order = await r.json();

    await Payment.updateOne({ _id: doc._id }, { $set: { providerOrderId: order.id } });

    return res.json({ ok: true, key: RZP_KEY_ID, orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (e) {
    console.error("[rzp.createOrder]", e);
    return res.status(500).json({ ok: false, message: "create order error" });
  }
}

export async function verifyPayment(req, res) {
  try {
    const actor = req.user;
    if (!actor) return res.status(401).json({ ok: false });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courseId, orgId, joinForm } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ ok: false, message: "missing fields" });
    }

    // Signature check
    const hmac = crypto.createHmac("sha256", RZP_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const expected = hmac.digest("hex");
    if (expected !== razorpay_signature) {
      return res.status(400).json({ ok: false, message: "signature mismatch" });
    }

    // Find by order only, then authorize ownership (avoids brittle 404s)
    const doc0 = await Payment.findOne({ providerOrderId: razorpay_order_id }).lean();
    if (!doc0) return res.status(404).json({ ok: false, message: "order not found" });
    const actorId = String(actor._id || actor.sub || actor.id || "");
    if (String(doc0.studentId) !== actorId) {
      return res.status(403).json({ ok: false, message: "not your order" });
    }
    await Payment.updateOne(
      { _id: doc0._id },
      { $set: {
          status: "captured",
          providerPaymentId: razorpay_payment_id,
          providerSignature: razorpay_signature,
          notes: JSON.stringify(joinForm || {}),
        } }
    );
    const doc = { ...doc0, providerPaymentId: razorpay_payment_id };

  // 🔒 TRUSTED path: verify with provider if webhook hasn't arrived yet 
  let trusted = false; 
  const pay = await rzpGetPayment(razorpay_payment_id); 
  if (pay && pay.status === "captured" && pay.order_id === razorpay_order_id) { 
    trusted = true; 
    await Payment.updateOne( 
      { _id: doc._id }, 
      { $set: { providerVerified: true, providerMethod: pay.method || undefined } } 
    ); 
      // managerId: prefer Payment.managerId, else resolve once
  const mId = doc.managerId || (await resolveManagerId(doc.orgId));
  if (mId && !doc.managerId) {
    await Payment.updateOne({ _id: doc._id }, { $set: { managerId: mId } });
  }
      // normalize IDs (in case any are strings)
      const sId = toId(doc.studentId || actor._id);
      const cId = toId(doc.courseId);
      const oId = toId(doc.orgId);
      await ensureEnrollment({
        studentId: sId, courseId: cId, orgId: oId,
    paymentId: doc._id,
    source: "online",
    managerId: mId || null,
  });
  } 
 
  return res.json({ ok: true, trusted });
  } catch (e) {
    console.error("[rzp.verify]", e);
    return res.status(500).json({ ok: false, message: "verify error" });
  }
}

export async function webhook(req, res) {
  try {
    // raw body required
    const signature = req.get("x-razorpay-signature") || req.get("X-Razorpay-Signature") || "";
    const eventId = req.get("x-razorpay-event-id") || "";

    const raw = req.body instanceof Buffer ? req.body : Buffer.from(req.body || "");
    const hmac = crypto.createHmac("sha256", RZP_WEBHOOK_SECRET);
    hmac.update(raw);
    const expected = hmac.digest("hex");
    if (!signature || expected !== signature) {
      return res.status(400).json({ ok: false, message: "webhook signature invalid" });
    }

    const payload = JSON.parse(raw.toString("utf8"));
    const et = payload?.event || payload?.type || "";
    // helpful log 
    console.log(`[rzp.webhook] ${et} id=${eventId}`); 

    // idempotency guard using event id 
    if (eventId) { 
      const dup = await Payment.exists({ webhookEventId: eventId }); 
      if (dup) return res.json({ ok: true }); 
    }

    if (et === "payment.captured" || et === "order.paid") {
      const pay = payload?.payload?.payment?.entity || payload?.payload?.order?.entity || {};
      const orderId = pay.order_id || payload?.payload?.order?.entity?.id;
      const paymentId = pay.id || payload?.payload?.payment?.entity?.id;

      const doc = await Payment.findOneAndUpdate(
        { providerOrderId: orderId },
    { $set: { 
        status: "captured", 
        providerPaymentId: paymentId, 
        webhookEventId: eventId, 
        providerVerified: true, 
        providerMethod: pay.method || undefined,   // 'upi', 'card', ... 
      } },
        { new: true }
      ).lean();

    if (doc) {
      // Try to recover IDs if missing
      let sId = doc.studentId, cId = doc.courseId, oId = doc.orgId;

      // 1) from webhook order payload notes (when present)
      const pNotes = payload?.payload?.order?.entity?.notes || {};
      sId ||= pNotes.studentId || pNotes.student_id;
      cId ||= pNotes.courseId  || pNotes.course_id;
      oId ||= pNotes.orgId     || pNotes.org_id;

      // 2) from live Order API (always has our notes)
      if (!sId || !cId || !oId) {
        const ord = await rzpGetOrder(orderId);
        const oNotes = ord?.notes || {};
        sId ||= oNotes.studentId || oNotes.student_id;
        cId ||= oNotes.courseId  || oNotes.course_id;
        oId ||= oNotes.orgId     || oNotes.org_id;
      }

        // Normalize to ObjectId (and also prefer what’s in Payment if valid)
        sId = toId(sId) || toId(doc.studentId);
        cId = toId(cId) || toId(doc.courseId);
        oId = toId(oId) || toId(doc.orgId);

      // persist any recovered IDs to Payment
      if (sId || cId || oId) {
        await Payment.updateOne(
          { _id: doc._id },
          { $set: {
            ...(sId ? { studentId: sId } : {}),
            ...(cId ? { courseId:  cId } : {}),
            ...(oId ? { orgId:    oId } : {}),
          }}
        );
      }

  if (!(sId && cId && oId)) {
    console.warn("[rzp.webhook] missing IDs; enrollment skipped", { orderId, sId: !!sId, cId: !!cId, oId: !!oId });
  } else {
    const mId = doc.managerId || (await resolveManagerId(oId));
    if (mId && !doc.managerId) {
      await Payment.updateOne({ _id: doc._id }, { $set: { managerId: mId } });
    }
await ensureEnrollment({ studentId: sId, courseId: cId, orgId: oId, paymentId: doc._id, source: "online", managerId: mId || null });
  }
    }
    }

    // idempotent 200
    return res.json({ ok: true });
  } catch (e) {
    console.error("[rzp.webhook]", e);
    return res.status(500).json({ ok: false });
  }
}

export async function receipt(req, res) {
  try {
    const actor = req.user;
    if (!actor) return res.status(401).json({ ok: false });

    const { orderId } = req.params || {};
    if (!orderId) return res.status(400).json({ ok: false, message: "missing order id" });

    const pay = await Payment.findOne({ providerOrderId: orderId }).lean();
    if (!pay) return res.status(404).json({ ok: false, message: "order not found" });

   // ensure the order belongs to the logged-in student (support _id/sub/id)
   const actorId = String(actor._id || actor.sub || actor.id || "");
   if (!actorId || String(pay.studentId) !== actorId) {
     return res.status(403).json({ ok: false, message: "not your order" });
   }

    const [course, enrollment] = await Promise.all([
      Course.findById(pay.courseId).select("_id title").lean(),
      Enrollment.findOne({ studentId: pay.studentId, courseId: pay.courseId, orgId: pay.orgId })
        .select("_id status createdAt updatedAt")
        .lean(),
    ]);

    const receipt = {
      orderId: pay.providerOrderId,
      paymentId: pay.providerPaymentId || null,
      status: pay.status,                  // "captured", "pending", etc
      verified: !!pay.providerVerified,    // provider-verified (payment.captured/order.paid)
      method: pay.providerMethod || pay.method,
      currency: pay.currency,
      amount: pay.amount,                  // paise
      dateISO: (pay.updatedAt || pay.createdAt)?.toISOString(),
      student: { id: pay.studentId, name: actor.name || actor.email },
      course: { id: course?._id, title: course?.title || "Course" },
      enrollment: {
        present: !!enrollment,
        status: enrollment?.status || null,
      },
    };

    return res.json({ ok: true, receipt });
  } catch (e) {
    console.error("[rzp.receipt]", e);
    return res.status(500).json({ ok: false, message: "receipt error" });
  }
}

