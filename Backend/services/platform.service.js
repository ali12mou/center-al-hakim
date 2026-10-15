import { Course } from "../models/index.js";
import {
  Skill,
  Information,
  BlogPost,
  Business,
  Certification,
  Assessment,
  Partner,
  PlatformSetting,
} from "../models/platform.models.js";
import { courses } from "../data/catalogue.js";
import {
  initialSkills,
  initialBusinesses,
  initialCertifications,
  initialAssessments,
  initialPartners,
  initialInformation,
} from "../data/platformContent.js";

export const resourceModels = {
  competences: Skill,
  informations: Information,
  blog: BlogPost,
  courses: Course,
  businesses: Business,
  certifications: Certification,
  assessments: Assessment,
  partners: Partner,
};
export async function getPublicPortal() {
  const entries = await Promise.all(
    Object.entries(resourceModels)
      .filter(([key]) => key !== "courses")
      .map(async ([key, model]) => {
        const records = await model
          .find({ published: true })
          .sort({ createdAt: -1 })
          .limit(100)
          .select("-__v")
          .lean();
        if (key === "assessments")
          for (const record of records)
            record.questions = record.questions.map(({ prompt, choices }) => ({
              prompt,
              choices,
            }));
        return [key, records];
      }),
  );
  return Object.fromEntries(entries);
}
export function getStaticPortal() {
  const addIds = (data, key) =>
    data.map((item, index) => ({
      ...item,
      _id: `preview-${key}-${index}`,
      createdAt: null,
    }));
  return {
    competences: addIds(initialSkills, "skills"),
    informations: addIds(initialInformation, "information"),
    blog: [],
    businesses: addIds(initialBusinesses, "businesses"),
    certifications: addIds(initialCertifications, "certifications"),
    assessments: addIds(initialAssessments, "assessments").map((item) => ({
      ...item,
      questions: item.questions.map(({ prompt, choices }) => ({
        prompt,
        choices,
      })),
    })),
    partners: addIds(initialPartners, "partners"),
  };
}
export async function seedPlatform() {
  if (await PlatformSetting.exists({ _id: "initial-content" })) return;
  const seeds = [
    [Skill, initialSkills],
    [Information, initialInformation],
    [Business, initialBusinesses],
    [Certification, initialCertifications],
    [Assessment, initialAssessments],
    [Partner, initialPartners],
  ];
  for (const [model, data] of seeds) {
    if ((await model.countDocuments()) === 0) await model.insertMany(data);
  }
  if ((await Course.countDocuments()) === 0)
    await Course.insertMany(
      courses.map((course) => ({ ...course, published: true })),
    );
  await PlatformSetting.updateOne(
    { _id: "initial-content" },
    { $setOnInsert: { initializedAt: new Date() } },
    { upsert: true },
  );
}
