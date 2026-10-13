import { courses } from "../data/catalogue.js";
import { Course } from "../models/index.js";

export function createCoursesController({ isDatabaseReady, loadCourses }) {
  async function getCatalogue() {
    if (!isDatabaseReady()) return courses;
    const saved = loadCourses
      ? await loadCourses()
      : await Course.find({}).select("-_id -__v -createdAt -updatedAt").lean();
    return saved.length ? saved : courses;
  }
  return {
    async list(req, res, next) {
      try {
        const catalogue = await getCatalogue();
        const department =
          typeof req.query.department === "string" ? req.query.department : "";
        const search =
          typeof req.query.q === "string"
            ? req.query.q.slice(0, 100).toLocaleLowerCase("fr")
            : "";
        const filtered = catalogue.filter(
          (course) =>
            (!department || course.department === department) &&
            (!search ||
              `${course.title} ${course.description}`
                .toLocaleLowerCase("fr")
                .includes(search)),
        );
        res.json({ courses: filtered, total: filtered.length });
      } catch (error) {
        next(error);
      }
    },
    async detail(req, res, next) {
      try {
        const catalogue = await getCatalogue();
        const course = catalogue.find((item) => item.id === req.params.id);
        if (!course)
          return res.status(404).json({ error: "Formation introuvable." });
        res.json({ course });
      } catch (error) {
        next(error);
      }
    },
  };
}
