import { Course } from "../models/index.js";
import {
  Skill,
  Information,
  BlogPost,
  Business,
  Certification,
  Assessment,
  Partner,
  HomeSlide,
  CentrePresentation,
  PlatformSetting,
} from "../models/platform.models.js";
import { courses } from "../data/catalogue.js";
import { initialPresentations } from "../data/centrePresentations.js";
import { initialBlogExamples } from "../data/blogExamples.js";
import { PortalPublication } from "../models/portal.models.js";
import { publicationsFor } from "./portal.service.js";
import { initialPortalBanners } from "../data/portalBanners.js";
import {
  initialSkills,
  initialBusinesses,
  initialCertifications,
  initialAssessments,
  initialPartners,
  initialInformation,
  initialSlides,
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
  slides: HomeSlide,
  presentations: CentrePresentation,
  publications: PortalPublication,
};
export async function getPublicPortal() {
  const entries = await Promise.all(
    Object.entries(resourceModels)
      .filter(([key]) => !["courses", "publications"].includes(key))
      .map(async ([key, model]) => {
        const records = await model
          .find({ published: true })
          // Le diaporama suit l’ordre choisi ; le reste, du plus récent au plus ancien.
          .sort(["slides", "presentations"].includes(key) ? { order: 1, createdAt: 1 } : { createdAt: -1 })
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
  return { ...Object.fromEntries(entries), publications: await publicationsFor("public") };
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
    blog: addIds(initialBlogExamples, "blog"),
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
    slides: addIds(initialSlides, "slides"),
    presentations: addIds(initialPresentations, "presentations"),
    publications: addIds(initialPortalBanners,"publications"),
  };
}
// Champs ajoutés aux formations après leur création : on les complète (vides)
// dans les documents existants pour que toutes les formations aient la même
// structure. Sans effet une fois fait.
async function completeCourseFields() {
  for (const field of ["imageUrl", "videoUrl", "audience", "prerequisites"])
    await Course.updateMany(
      { [field]: { $exists: false } },
      { $set: { [field]: "" } },
      // Ne pas changer la date de modification : le contenu n’a pas changé.
      { timestamps: false },
    );
}

export async function seedPlatform() {
  if (!(await PlatformSetting.exists({_id:"portal-welcome-v1"}))) {
    if (!(await PortalPublication.exists({title:initialPortalBanners[0].title}))) await PortalPublication.insertMany(initialPortalBanners);
    await PlatformSetting.updateOne({_id:"portal-welcome-v1"},{$setOnInsert:{initializedAt:new Date()}},{upsert:true});
  }
  if (!(await PlatformSetting.exists({ _id: "blog-examples-v1" }))) {
    for (const article of initialBlogExamples)
      if (!(await BlogPost.exists({ title: article.title }))) await BlogPost.create(article);
    await PlatformSetting.updateOne({ _id: "blog-examples-v1" },
      { $setOnInsert: { initializedAt: new Date() } }, { upsert: true });
  }
  if (!(await PlatformSetting.exists({ _id: "centre-presentations" }))) {
    if ((await CentrePresentation.countDocuments()) === 0)
      await CentrePresentation.insertMany(initialPresentations);
    await PlatformSetting.updateOne({ _id: "centre-presentations" },
      { $setOnInsert: { initializedAt: new Date() } }, { upsert: true });
  }
  await completeCourseFields();
  // Le diaporama est arrivé après la première installation : il a son propre
  // repère, pour ne pas recréer les diapositives que l’administration supprime.
  if (!(await PlatformSetting.exists({ _id: "home-slides" }))) {
    if ((await HomeSlide.countDocuments()) === 0)
      await HomeSlide.insertMany(initialSlides);
    await PlatformSetting.updateOne(
      { _id: "home-slides" },
      { $setOnInsert: { initializedAt: new Date() } },
      { upsert: true },
    );
  }
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
