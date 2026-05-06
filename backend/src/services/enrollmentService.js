//backend/src/services/enrollmentService.js
import mongoose from "mongoose";
import Enrollment from "../models/Enrollment.js";

const isOid = (v) => mongoose.isValidObjectId(v);

const toId = (v) =>
  (v &&
   typeof v === "object" &&
   v._id)
    ? v._id
    : v;

async function ensureEnrollment({
  studentId,
  courseId,
  orgId,
  paymentId,
  source,
  managerId
}) {
  const sid = toId(studentId);
  const cid = toId(courseId);
  const oid = toId(orgId);
  const pid = paymentId ? toId(paymentId) : null;

  if (!isOid(sid) || !isOid(cid)) {
    console.warn("[ensureEnrollment] skipped: invalid ids", {
      studentId: !!sid,
      courseId: !!cid,
      orgId: !!oid,
    });
    return false;
  }

  const filter = {
    studentId: sid,
    courseId: cid,
    orgId: oid || null,
  };

  const update = {
    $setOnInsert: {
      studentId: sid,
      courseId: cid,
      orgId: oid || null,
      status: "premium",
      source: source || "offline",
      ...(managerId ? { managerId: toId(managerId) } : {}),
    },
  };

  if (pid) {
    update.$set = {
      paymentId: pid,
      updatedAt: new Date(),
    };
  }

  try {
    const result = await Enrollment.updateOne(
      filter,
      update,
      {
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    if (process.env.NODE_ENV === "development") {
      console.log("[ENROLLMENT RESULT]", {
        student: String(sid),
        course: String(cid),
        org: String(oid),
        upserted: result.upsertedCount,
      });
    }

    if (managerId) {
      await Enrollment.updateOne(
        {
          ...filter,
          $or: [
            { managerId: null },
            { managerId: { $exists: false } }
          ]
        },
        {
          $set: {
            managerId: toId(managerId)
          }
        }
      );
    }

    return true;

  } catch (e) {

    if (e?.code === 11000) {
      if (process.env.NODE_ENV === "development") {
        console.log("[ENROLLMENT RESULT]", {
          student: String(sid),
          course: String(cid),
          duplicate: true,
        });
      }

      return true;
    }

    console.error("[ensureEnrollment] upsert failed:", e?.message, {
      studentId: sid,
      courseId: cid,
      orgId: oid,
    });

    return false;
  }
}

export { ensureEnrollment };