// backend/src/routes/courseReviews.js
import { Router } from 'express';
import { getCourseReviews, createCourseReview } from '../controllers/reviewController.js';
import { requireAuth, requireRole } from '../middleware/authz.js';

/**
 * Routes for course reviews. Provides endpoints to read and create
 * reviews for a course. GET requests are public (no auth) while
 * POST requests require the user to be authenticated and have a
 * student-like role (student, orguser, orgadmin).
 *
 * This router is mounted under `/api/courses` so the full paths are:
 *   GET  /api/courses/:courseId/reviews    → list reviews for a course
 *   POST /api/courses/:courseId/reviews    → submit a new review
 */
const r = Router();

// List all reviews for a course
r.get('/:courseId/reviews', getCourseReviews);

// Submit a new review for a course (students/org users/org admins)
r.post(
  '/:courseId/reviews',
  requireAuth,
  requireRole({ anyOf: ['student', 'orguser', 'orgadmin'] }),
  createCourseReview
);

export default r;