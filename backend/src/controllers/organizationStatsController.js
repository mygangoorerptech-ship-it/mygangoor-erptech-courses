//src/controllers/organizationStatsController.js
import Organization from "../models/Organization.js";
import Course from "../models/Course.js";
import User from "../models/User.js";
import CourseAssignment from "../models/CourseAssignment.js";

export async function stats(req, res) {
    try {
        // ✅ TOTAL CENTERS
        const totalCenters = await Organization.countDocuments({
            deletedAt: null,
        });

        // ✅ COURSES AGG
        const courseAgg = await CourseAssignment.aggregate([
            {
                $match: {
                    isActive: true
                }
            },
            {
                $lookup: {
                    from: "courses",
                    localField: "courseId",
                    foreignField: "_id",
                    as: "course"
                }
            },
            { $unwind: "$course" },

            {
                $match: {
                    "course.status": { $ne: "archived" }
                }
            },

            {
                $group: {
                    _id: "$centerId",
                    totalCourses: { $sum: 1 },
                    categories: { $addToSet: "$course.category" }
                }
            }
        ]);

        const totalCatalogCourses = await Course.countDocuments({
            status: { $ne: "archived" }
        });

        // ✅ TOTAL COURSES
        const totalCourses = courseAgg.reduce(
            (sum, c) => sum + c.totalCourses,
            0
        );

        // ✅ TOTAL UNIQUE CATEGORIES
        const totalCategories = await Course.distinct("category", {
            category: { $ne: null },
            status: { $ne: "archived" }
        }).then(arr => arr.length);

        // ✅ STUDENTS AGG
        const studentAgg = await User.aggregate([
            {
                $match: {
                    role: { $in: ["student", "orguser"] },
                    status: "active",
                },
            },
            {
                $group: {
                    _id: "$orgId",
                    totalStudents: { $sum: 1 },
                },
            },
        ]);

        // ✅ TOTAL STUDENTS
        const totalStudents = studentAgg.reduce(
            (sum, s) => sum + s.totalStudents,
            0
        );

        // 🔗 MAP PER ORG
        const courseMap = new Map();
        courseAgg.forEach((c) => {
            courseMap.set(String(c._id), {
                courses: c.totalCourses,
                categories: c.categories.filter(Boolean).length,
            });
        });

        const studentMap = new Map();
        studentAgg.forEach((s) => {
            studentMap.set(String(s._id), s.totalStudents);
        });

        // ✅ FINAL PER CENTER DATA
        const centers = await Organization.find({
            deletedAt: null,
        }).select("_id").lean();

        const centerStats = centers.map((org) => {
            const id = String(org._id);

            return {
                orgId: id,
                courses: courseMap.get(id)?.courses || 0,
                categories: courseMap.get(id)?.categories || 0,
                students: studentMap.get(id) || 0,
            };
        });

        return res.json({
            ok: true,
            totalCenters,
            totalCourses,
            totalCategories,
            totalCatalogCourses,
            totalStudents,
            centers: centerStats,
        });
    } catch (err) {
        console.error("ORG STATS ERROR:", err);
        res.status(500).json({ ok: false, message: "Failed to fetch stats" });
    }
}