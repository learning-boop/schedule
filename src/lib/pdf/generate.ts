import puppeteer from "puppeteer-core";

let chromiumPath: string | undefined;

async function getBrowser() {
  // In production/serverless, use @sparticuz/chromium
  // Locally, fall back to a system Chrome/Chromium
  if (!chromiumPath) {
    try {
      const chromium = await import("@sparticuz/chromium");
      chromiumPath = await chromium.default.executablePath();
    } catch {
      // Fallback: common local Chrome paths
      const paths = [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      ];
      const fs = await import("fs");
      chromiumPath = paths.find((p) => fs.existsSync(p));
    }
  }

  if (!chromiumPath) {
    throw new Error(
      "No Chrome/Chromium found. Install Chrome locally or deploy with @sparticuz/chromium.",
    );
  }

  return puppeteer.launch({
    executablePath: chromiumPath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
