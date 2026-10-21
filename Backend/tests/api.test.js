import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../app.js";

const valid = {
  name: "Apprenant Test",
  email: "test@example.com",
  phone: "+253 77 75 66 38",
  kind: "registration",
  courseId: "anglais",
  schedule: "soir",
  message: "Je souhaite connaître les dates de cette formation.",
  consent: true,
  website: "",
};

async function withApi(options, callback) {
  const server = createApp(options).listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    await callback(origin);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
const post = (origin, body) =>
  fetch(`${origin}/api/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test("catalogue disponible sans MongoDB et filtrable par département", async () => {
  await withApi({ isDatabaseReady: () => false }, async (origin) => {
    const response = await fetch(`${origin}/api/courses?department=langues`);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.total, 4);
    assert.ok(data.courses.every((course) => course.department === "langues"));
  });
});
test("coordonnées et contenu des pages servis par le Backend", async () => {
  await withApi({}, async (origin) => {
    const { centre } = await (await fetch(`${origin}/api/centre`)).json();
    const content = await (await fetch(`${origin}/api/content`)).json();
    assert.equal(centre.phoneLink, "+25377701392");
    assert.equal(content.navigation.length, 5);
  });
});
test("aucun succès annoncé quand MongoDB est indisponible", async () => {
  await withApi({ isDatabaseReady: () => false }, async (origin) => {
    assert.equal((await post(origin, valid)).status, 503);
    const health = await (await fetch(`${origin}/api/health`)).json();
    assert.equal(health.registrationsAvailable, false);
  });
});
test("demande valide persistée avant de renvoyer une référence", async () => {
  let persisted;
  await withApi(
    {
      isDatabaseReady: () => true,
      saveRequest: async (data) => {
        persisted = data;
      },
    },
    async (origin) => {
      const response = await post(origin, valid);
      const data = await response.json();
      assert.equal(response.status, 201);
      assert.match(data.reference, /^AH-[A-F0-9]{12}$/);
      assert.equal(persisted.reference, data.reference);
      assert.equal(persisted.courseId, "anglais");
      assert.equal(persisted.website, undefined);
    },
  );
});
for (const [name, change] of [
  ["consentement absent", { consent: false }],
  ["e-mail invalide", { email: "invalide" }],
  ["formation inconnue", { courseId: "faux-programme" }],
  ["champ imprévu", { status: "closed" }],
  ["tentative d’injection MongoDB", { name: { $ne: "" } }],
  ["piège antispam rempli", { website: "https://spam.example" }],
])
  test(`validation : ${name} rejeté`, async () => {
    let wrote = false;
    await withApi(
      {
        isDatabaseReady: () => true,
        saveRequest: async () => {
          wrote = true;
        },
      },
      async (origin) => {
        assert.equal((await post(origin, { ...valid, ...change })).status, 400);
        assert.equal(wrote, false);
      },
    );
  });
test("une erreur d’enregistrement ne produit pas de confirmation", async () => {
  await withApi(
    {
      isDatabaseReady: () => true,
      saveRequest: async () => {
        throw new Error("Test storage failure");
      },
    },
    async (origin) => {
      const response = await post(origin, valid);
      assert.equal(response.status, 503);
      assert.equal((await response.json()).reference, undefined);
    },
  );
});
test("demande entreprise acceptée sans programme imposé", async () => {
  await withApi(
    { isDatabaseReady: () => true, saveRequest: async () => {} },
    async (origin) => {
      assert.equal(
        (await post(origin, { ...valid, kind: "enterprise", courseId: "" }))
          .status,
        201,
      );
    },
  );
});
test("JSON malformé et formation inconnue renvoient une erreur claire", async () => {
  await withApi({}, async (origin) => {
    const response = await fetch(`${origin}/api/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{broken",
    });
    assert.equal(response.status, 400);
    assert.equal((await fetch(`${origin}/api/courses/inconnu`)).status, 404);
  });
});
