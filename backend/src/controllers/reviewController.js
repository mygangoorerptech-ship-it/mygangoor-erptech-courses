// backend/src/controllers/reviewController.js
import Review from '../models/Review.js';
import Course from '../models/Course.js';

/**
 * Fetch all reviews for a given course. Returns an array of
 * { name, rating, comment, date } objects plus aggregate stats. The
 * date field is returned as ISO string; the frontend may format
 * relative time. No authentication is required to view reviews.
 */
export async function getCourseReviews(req, res) {
  try {
    const { courseId } = req.params;
    if (!courseId) {
      return res.status(400).json({ ok: false, message: 'courseId is required' });
    }
    // Fetch reviews sorted by newest first
    const reviews = await Review.find({ courseId }).sort({ createdAt: -1 }).lean();
    const formatted = reviews.map((r) => ({
      name: r.name?.trim() || 'Anonymous',
      rating: Number(r.rating) || 0,
      comment: r.comment || '',
      date: r.createdAt ? r.createdAt.toISOString() : null,
    }));
    // Calculate aggregate rating and count
    const ratingCount = formatted.length;
    const ratingSum = formatted.reduce((sum, r) => sum + (Number(r.rating) || 0), 0);
    const ratingAvg = ratingCount > 0 ? ratingSum / ratingCount : 0;
    return res.json({ reviews: formatted, ratingAvg, ratingCount });
  } catch (e) {
    console.error('[getCourseReviews] error', e);
    return res.status(500).json({ ok: false, message: 'Internal error' });
  }
}

/**
 * Create a new review for a course. Requires authentication and
 * appropriate student role (enforced in routes). Accepts name,
 * rating (0–5) and comment in the request body. Returns the created
 * review and updates the course's ratingAvg and ratingCount fields.
 */
export async function createCourseReview(req, res) {
  try {
    const { courseId } = req.params;
    const actor = req.user;
    if (!actor) {
      return res.status(401).json({ ok: false, message: 'unauthenticated' });
    }
    if (!courseId) {
      return res.status(400).json({ ok: false, message: 'courseId is required' });
    }
    const { name, rating, comment } = req.body || {};
    const ratingNum = Number(rating);
    if (!Number.isFinite(ratingNum) || ratingNum < 0 || ratingNum > 5) {
      return res.status(400).json({ ok: false, message: 'Rating must be between 0 and 5' });
    }
    if (!comment || typeof comment !== 'string' || !comment.trim()) {
      return res.status(400).json({ ok: false, message: 'Comment is required' });
    }
    // Determine studentId from JWT; _id preferred
    const studentId = actor._id || actor.id || actor.sub;
    if (!studentId) {
      return res.status(401).json({ ok: false, message: 'unauthenticated' });
    }
    // Create and save new review
    const review = new Review({
      courseId,
      studentId,
      name: name?.trim() || '',
      rating: ratingNum,
      comment: comment.trim(),
    });
    await review.save();
    // Update aggregate rating on Course. Use a transaction to avoid
    // inconsistent state, but this simple implementation re-fetches
    // existing values and updates atomically.
    try {
      const c = await Course.findById(courseId).select('ratingAvg ratingCount').lean();
      let ratingAvg = 0;
      let ratingCount = 0;
      if (c && Number.isFinite(c.ratingAvg) && Number.isFinite(c.ratingCount)) {
        ratingCount = Number(c.ratingCount) + 1;
        ratingAvg = ((Number(c.ratingAvg) * Number(c.ratingCount)) + ratingNum) / ratingCount;
      } else {
        ratingCount = 1;
        ratingAvg = ratingNum;
      }
      await Course.findByIdAndUpdate(courseId, { ratingAvg, ratingCount });
    } catch (err) {
      console.warn('[createCourseReview] failed to update course rating', err);
      // ignore; not critical
    }
    return res.json({ ok: true, review: {
      name: review.name || 'Anonymous',
      rating: review.rating,
      comment: review.comment,
      date: review.createdAt ? review.createdAt.toISOString() : null,
    } });
  } catch (e) {
    console.error('[createCourseReview] error', e);
    return res.status(500).json({ ok: false, message: 'Internal error' });
  }
}