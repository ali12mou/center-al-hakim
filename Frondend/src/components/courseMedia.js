// Image d’une formation : celle importée dans l’administration, sinon
// l’illustration de son pôle livrée avec le site.
export const courseImage = (course) =>
  course.imageUrl || `/images/${course.image || course.department}.jpg`;

export const departmentShortName = (department) =>
  ({
    management: "Management",
    informatique: "Informatique",
    finance: "Comptabilité & finance",
  })[department.id] || department.name;
