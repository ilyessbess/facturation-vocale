import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage();
await p.goto("https://facturation-vocale.vercel.app", { waitUntil: "networkidle" });
await p.waitForTimeout(3500);
await b.close();
console.log("visite ok");
