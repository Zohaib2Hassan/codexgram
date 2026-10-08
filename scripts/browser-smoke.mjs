import { chromium } from "@playwright/test";
import fs from "node:fs";
const browser = await chromium.launch({ channel: "msedge", headless: true });
fs.mkdirSync("test-results", { recursive: true });
const results = [];
try {
  for (const setting of [
    {
      name: "mobile-light",
      width: 390,
      height: 844,
      locale: "en-US",
      colorScheme: "light",
    },
    {
      name: "desktop-dark",
      width: 1280,
      height: 900,
      locale: "en-US",
      colorScheme: "dark",
    },
    {
      name: "mobile-urdu",
      width: 390,
      height: 844,
      locale: "ur-PK",
      colorScheme: "light",
    },
  ]) {
    const context = await browser.newContext({
      viewport: { width: setting.width, height: setting.height },
      locale: setting.locale,
      colorScheme: setting.colorScheme,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:8083/", { waitUntil: "networkidle" });
    const initial = await page.locator("body").innerText();
    if (
      !initial.includes("Development setup required") &&
      !initial.includes("ڈیولپمنٹ")
    )
      throw new Error("Unexpected unconfigured entry screen");
    if (setting.locale === "ur-PK") {
      if (!initial.includes("ڈیولپمنٹ"))
        throw new Error("Urdu locale was not applied");
      const heading = page.getByText("آپ کا حلقہ یہاں سے شروع ہوتا ہے۔", {
        exact: true,
      });
      const readable = await heading.evaluate((element) => {
        const style = getComputedStyle(element);
        return (
          style.textAlign === "right" &&
          parseFloat(style.lineHeight) >= parseFloat(style.fontSize) * 1.4
        );
      });
      if (!readable)
        throw new Error(
          "Urdu heading needs right alignment and sufficient line spacing",
        );
    }
    await page.screenshot({
      path: `test-results/${setting.name}.png`,
      fullPage: true,
    });
    await page
      .getByRole("link")
      .filter({
        hasText:
          /Privacy and community information|رازداری اور کمیونٹی کی معلومات/,
      })
      .click();
    await page.waitForURL("**/policy");
    await page
      .getByText(/Pre-release policy draft|اجرا سے پہلے پالیسی کا مسودہ/)
      .waitFor();
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      )
    )
      throw new Error("Horizontal overflow");
    await page.screenshot({
      path: `test-results/${setting.name}-policy.png`,
      fullPage: true,
    });
    if (errors.length) throw new Error(errors.join("\n"));
    results.push({
      name: setting.name,
      result: "passed",
      coverage: "unconfigured shell, policy navigation, hydration, overflow",
    });
    await context.close();
  }
  console.log(JSON.stringify(results, null, 2));
  fs.writeFileSync(
    "test-results/browser-smoke.json",
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser.close();
}
