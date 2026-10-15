import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Exécuter avec le site déjà lancé via npm run dev.
const baseUrl = process.env.TEST_SITE_URL || "http://127.0.0.1:5173";
const directory = fileURLToPath(new URL("../../artifacts/", import.meta.url));
mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1050 },
  deviceScaleFactor: 1,
});
await page.emulateMedia({ reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(baseUrl);
  // L’animation du logo couvre la page tant que celle-ci se charge.
  await page.locator(".intro").waitFor({ state: "detached" });
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${directory}/desktop.png`, fullPage: true });
  assert.equal(await page.locator(".course-card").count(), 4);
  await page
    .locator(".department")
    .filter({ hasText: "Comptabilité & finance" })
    .click();
  assert.equal(
    await page.locator(".filter.active").innerText(),
    "Comptabilité & finance",
  );
  assert.equal(await page.locator(".course-card").count(), 4);
  await page.getByRole("button", { name: "Langues", exact: true }).click();
  assert.equal(await page.locator(".course-card").count(), 4);
  await page.getByRole("searchbox").fill("chinois");
  assert.equal(await page.locator(".course-card").count(), 1);
  await page.getByRole("searchbox").fill("aucun résultat attendu");
  assert.equal(await page.locator(".course-card").count(), 0);
  await page
    .getByRole("button", { name: "Voir toutes les formations", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Voir le programme Anglais général & professionnel",
    })
    .click();
  await page.getByRole("dialog").waitFor();
  await page
    .getByRole("button", { name: "Cette formation m’intéresse" })
    .click();
  assert.equal(
    await page.locator('select[name="courseId"]').inputValue(),
    "anglais",
  );
  await page.locator('input[name="name"]').fill("Apprenant Test");
  await page.locator('input[name="phone"]').fill("+253 77 75 66 38");
  await page.locator('input[name="email"]').fill("test@example.com");
  await page
    .locator('textarea[name="message"]')
    .fill("Je souhaite connaître les dates et les tarifs de votre programme.");
  await page.locator('input[name="consent"]').check();
  await page
    .getByRole("button", { name: "Préparer ma demande WhatsApp" })
    .click();
  await page.getByRole("link", { name: "Continuer sur WhatsApp" }).waitFor();
  const whatsapp = await page
    .getByRole("link", { name: "Continuer sur WhatsApp" })
    .getAttribute("href");
  assert.ok(whatsapp.startsWith("https://wa.me/25377756638?text="));
  assert.ok(
    decodeURIComponent(whatsapp).includes("Anglais général & professionnel"),
  );
  await page
    .getByRole("button", { name: "Confidentialité", exact: true })
    .first()
    .click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.locator(".faq-list summary").first().click();
  assert.ok(
    (await page.locator(".faq-list details").first().getAttribute("open")) !==
      null,
  );
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `Débordement horizontal à ${width}px`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Nos formations" })
    .click();
  assert.equal(
    await page.getByRole("button", { name: "Ouvrir le menu" }).count(),
    1,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${directory}/mobile.png`, fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "Vérification navigateur réussie : catalogue, recherche, fiche, préinscription WhatsApp, confidentialité, FAQ et affichage mobile/tablette/desktop.",
  );
} finally {
  await browser.close();
}
