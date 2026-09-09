/**
 * Playwright is an OPTIONAL dependency. It is only loaded when a scrape
 * is actually requested, and the browser binary must be installed once:
 *
 *     npm --workspace server exec playwright install chromium
 *
 * Proxy settings come from the environment (see .env.example). Running
 * without a residential proxy against DDproperty / Kaidee / Baania will
 * almost always be blocked — that is expected.
 */
export interface BrowserHandle {
  // deliberately loose typing so we do not need @types for an optional dep
  newContext(opts?: unknown): Promise<any>;
  close(): Promise<void>;
}

export function proxyFromEnv() {
  const server = process.env.SCRAPER_PROXY_URL?.trim();
  if (!server) return undefined;
  return {
    server,
    username: process.env.SCRAPER_PROXY_USER || undefined,
    password: process.env.SCRAPER_PROXY_PASS || undefined,
  };
}

export async function launchBrowser(): Promise<BrowserHandle> {
  let chromium: any;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error(
      'Playwright is not installed. Run:  npm --workspace server exec playwright install chromium',
    );
  }
  const proxy = proxyFromEnv();
  return chromium.launch({
    headless: true,
    proxy,
    args: ['--disable-blink-features=AutomationControlled'],
  });
}

export async function newPage(browser: BrowserHandle) {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    locale: 'th-TH',
    viewport: { width: 1366, height: 900 },
  });
  return context.newPage();
}

export function looksBlocked(html: string): boolean {
  return /captcha|cf-browser-verification|Just a moment|Access Denied|are you a human|ตรวจสอบว่าคุณไม่ใช่บอท/i.test(
    html,
  );
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
