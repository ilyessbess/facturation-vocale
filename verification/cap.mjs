import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.goto("https://facturation-vocale.vercel.app/?fresh=" + Date.now(), { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
await p.screenshot({ path: "/tmp/vierge.png", fullPage: true });
await b.close();
console.log("ok");
