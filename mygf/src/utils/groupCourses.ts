//src/utils/groupCourses.ts
export const groupCoursesByTitle = (courses: any[]) => {
  const map = new Map();

  courses.forEach((course) => {
    const key = course.title?.trim().toLowerCase();

    if (!map.has(key)) {
      map.set(key, {
        title: course.title,
        courses: [],
      });
    }

    map.get(key).courses.push(course);
  });

  return Array.from(map.values());
};