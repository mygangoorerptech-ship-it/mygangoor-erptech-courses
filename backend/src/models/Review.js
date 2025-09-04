// backend/src/models/Review.js
import mongoose from 'mongoose';

/**
 * Review model
 *
 * Stores ratings and comments for a course from a student. Each review
 * references the courseId and the studentId (user). The `rating`
 * field should be an integer from 0 to 5. The `comment` stores the
 * student's written feedback. `name` allows the student to provide
 * a display name; if left empty the frontend may substitute
 * "Anonymous".
 */
const ReviewSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, trim: true, default: '' },
  rating: { type: Number, min: 0, max: 5, required: true },
  comment: { type: String, trim: true, required: true },
}, { timestamps: true });

export default mongoose.models.Review ?? mongoose.model('Review', ReviewSchema);