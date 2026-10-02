import { test, expect } from "@playwright/test";

const ready = async (page, url = "/") => {
  await page.goto(url);
  await expect(page.locator("#comparison-body tr")).toHaveCount(7);
  await expect(page.locator("#main-view")).toHaveAttribute("aria-busy", "false");
};

test("startup, mode changes, score stability, sorting and reset", async ({ page }) => {
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await ready(page);
  await expect(page.locator("#chart-data-table tbody tr")).toHaveCount(134);
  const score = await page.locator("#comparison-body tr").filter({ hasText: "Serie A" }).locator(".score-value").textContent();
  await page.getByRole("button", { name: "Top gap", exact: true }).click();
  await expect(page.getByRole("button", { name: "Top gap", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#takeaway-text")).toContainText("1st-to-4th");
  await expect(page.locator("#chart-data-table tbody tr")).toHaveCount(7);
  await page.getByRole("button", { name: "Mid-table gap", exact: true }).click();
  await expect(page.locator("#takeaway-text")).toContainText("4th-to-10th");
  await page.locator('[data-league="Bundesliga"]').click();
  await expect(page.locator('[data-league="Bundesliga"]')).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#comparison-body tr")).toHaveCount(6);
  await expect(page.locator("#comparison-body tr").filter({ hasText: "Serie A" }).locator(".score-value")).toHaveText(score);
  await page.locator('[data-sort="avg_ppg_sd"]').click();
  await expect(page.locator('[data-sort="avg_ppg_sd"]').locator("..")).toHaveAttribute("aria-sort", "ascending");
  await page.locator('[data-reset]').first().click();
  await expect(page.locator("#comparison-body tr")).toHaveCount(7);
  await expect(page.getByRole("button", { name: "Table shape", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});

test("legend and row highlighting preserve keyboard focus and clear safely", async ({ page }) => {
  await ready(page);
  const legend = page.locator('#chart-legend [data-focus="La Liga"]');
  await legend.focus(); await page.keyboard.press("Enter");
  await expect(legend).toBeFocused(); await expect(legend).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('#comparison-body [data-focus="La Liga"]')).toHaveAttribute("aria-pressed", "true");
  const strokes = await page.evaluate(() => Chart.getChart(document.getElementById("parity-chart")).data.datasets.map((row) => row.borderDash.join(",")));
  expect(new Set(strokes).size).toBe(7);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.locator("#chart-empty")).toBeVisible();
  await expect(page.locator("#comparison-body")).toContainText("No data selected");
  await page.locator("#chart-empty").getByRole("button", { name: "Reset view" }).click();
  await expect(page.locator("#comparison-body tr")).toHaveCount(7);
});

test("mobile dialog applies changes live, traps focus, closes and relocates on resize", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 }); await ready(page);
  const opener = page.getByRole("button", { name: /^Filters/ }); await opener.click();
  await expect(page.locator("#close-filters")).toBeFocused();
  await page.locator('#filter-dialog [data-league="Bundesliga"]').click();
  await expect(page.locator("#comparison-body tr")).toHaveCount(6);
  await page.getByRole("button", { name: "Done", exact: true }).focus(); await page.keyboard.press("Tab");
  await expect(page.locator("#close-filters")).toBeFocused();
  await page.keyboard.press("Escape"); await expect(opener).toBeFocused();
  await expect(page.locator("#filter-dialog")).not.toBeVisible();
  await opener.click(); await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.locator("#filter-dialog")).not.toBeVisible();
  await expect(page.locator("#desktop-filters #filters-panel")).toBeVisible();
});

test("shared selection survives reload, including completed-season filtering", async ({ page }) => {
  await page.goto("/?leagues=la-liga,serie-a&from=2018%2F19&to=2023%2F24&view=gap_top&focus=serie-a&complete=1&sort=avg_ppg_sd:asc");
  await expect(page.locator("#comparison-body tr")).toHaveCount(2);
  await expect(page.locator("#season-range-count")).toHaveText("5 of 6 seasons");
  await expect(page.locator('#comparison-body [data-focus="Serie A"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#season-context")).toContainText("Completed seasons only");
  await page.reload(); await expect(page.locator("#comparison-body tr")).toHaveCount(2);
  await expect(page.locator("#season-range-count")).toHaveText("5 of 6 seasons");
  await page.goto("/?from=2019%2F20&to=2019%2F20&complete=1");
  await expect(page.locator("#chart-empty")).toBeVisible();
  await expect(page.locator("#chart-empty strong")).toHaveText("No completed seasons selected");
  await expect(page.locator("#season-range-count")).toHaveText("0 of 1 seasons");
  await expect(page.locator("#chart-data-table tbody tr")).toHaveCount(0);
  await page.getByText("More options", { exact: true }).click();
  await page.getByLabel("Use completed seasons only").uncheck();
  await expect(page.locator("#comparison-body tr")).toHaveCount(7);
  await expect(page.locator("#chart-empty")).not.toBeVisible();
});

test("rank coverage copy and sensitivity follow the selected seasons", async ({ page }) => {
  await ready(page); await expect(page.locator("#chart-explainer")).toContainText("cover fewer");
  await page.locator("#season-end-select").selectOption("2022/23");
  await expect(page.locator("#chart-explainer")).not.toContainText("cover fewer");
  await page.locator(".sensitivity-panel summary").click();
  await expect(page.locator("#sensitivity-body tr")).toHaveCount(7);
  await expect(page.locator("#sensitivity-note")).toContainText("not a confidence interval");
  await page.setViewportSize({ width: 375, height: 900 });
  expect(await page.locator(".sensitivity-panel .data-scroll").evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(true);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.getByText("More options", { exact: true }).click();
  await page.getByLabel("Use completed seasons only").check();
  await expect(page.locator("#season-range-count")).toHaveText("7 of 8 seasons");
});

test("loading makes the comparison inert until validation finishes", async ({ page }) => {
  let release; const held = new Promise((resolve) => { release = resolve; });
  await page.route("**/data/league_team_season_master_7leagues_10seasons.csv", async (route) => { await held; await route.continue(); });
  await page.goto("/");
  await expect(page.locator("#data-loading")).toBeVisible();
  expect(await page.locator("#main-view").evaluate((element) => element.inert)).toBe(true);
  release(); await expect(page.locator("#comparison-body tr")).toHaveCount(7);
  await expect(page.locator("#data-loading")).not.toBeVisible();
});

test("empty or failed CSV loads show a recoverable data error", async ({ page }) => {
  await page.route("**/data/league_season_gaps.csv", (route) => route.fulfill({ status: 200, contentType: "text/csv", body: "" }));
  await page.goto("/"); await expect(page.locator("#data-error")).toBeVisible();
  await expect(page.locator(".comparison-section")).not.toBeVisible();
  await page.unroute("**/data/league_season_gaps.csv");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator("#comparison-body tr")).toHaveCount(7);
  await expect(page.locator("#data-error")).not.toBeVisible();
  await page.route("**/data/league_season_gaps.csv", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.reload(); await expect(page.locator("#data-error")).toBeVisible();
});

test("missing chart library preserves values and supports chart retry", async ({ page }) => {
  await page.route("**/assets/vendor/chart.umd.js*", (route) => route.abort());
  await ready(page); await expect(page.locator("#chart-error")).toBeVisible();
  await expect(page.locator("#chart-data-table")).toBeVisible();
  await page.getByRole("button", { name: "Top gap", exact: true }).click();
  await expect(page.locator("#chart-data-table tbody tr")).toHaveCount(7);
  await expect(page.locator("#comparison-body tr")).toHaveCount(7);
  await page.unroute("**/assets/vendor/chart.umd.js*");
  await page.getByRole("button", { name: "Retry chart", exact: true }).click();
  await expect(page.locator("#chart-error")).not.toBeVisible();
  await expect(page.locator("#parity-chart")).toBeVisible();
});

test("narrow layouts and increased text spacing avoid page overflow", async ({ page }) => {
  await ready(page);
  for (const width of [320, 375, 720, 721, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addStyleTag({ content: "* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("method and downloads remain usable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage(); await page.goto("http://127.0.0.1:8000/");
  await expect(page.locator("noscript .error-panel")).toBeVisible();
  await expect(page.locator("noscript .error-panel")).toContainText("Enable JavaScript to explore the comparison.");
  await expect(page.locator("#data-loading")).not.toBeVisible();
  await expect(page.getByRole("link", { name: /^Download data/ })).toBeVisible();
  await context.close();
});
