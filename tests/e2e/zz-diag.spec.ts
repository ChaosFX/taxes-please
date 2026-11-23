import { test } from '@playwright/test';
import { key, startAtDay } from './helpers';

// Temporary diagnosis for WebKit: what lies under the newspaper's centre?
test('diag newspaper hit test', async ({ page }) => {
  await startAtDay(page, 4);
  await key(page, 'begin').click();
  const paper = page.locator('.stage .paper.newspaper');
  await paper.waitFor();
  await page.waitForTimeout(1000);
  const info = await paper.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const name = (n: Element | null) => (n ? `${n.tagName}.${[...n.classList].join('.')}` : 'null');
    const pts: Record<string, string> = {};
    for (const [fx, fy] of [[0.5, 0.5], [0.5, 0.1], [0.25, 0.5], [0.75, 0.5], [0.5, 0.9]] as const) {
      const x = r.left + r.width * fx;
      const y = r.top + r.height * fy;
      pts[`${fx},${fy}`] = name(document.elementFromPoint(x, y));
    }
    const m = el.querySelector('.masthead')!.getBoundingClientRect();
    return { rect: [r.left, r.top, r.width, r.height], client: [...el.getClientRects()].map((q) => [q.left, q.top, q.width, q.height]), offset: [el.offsetWidth, el.offsetHeight], masthead: [m.left, m.top, m.width, m.height], pts, stage: getComputedStyle(document.querySelector('.stage')!).transform, vp: [innerWidth, innerHeight] };
  });
  console.log('DIAG', JSON.stringify(info));
  console.log('DIAG box', JSON.stringify(await paper.boundingBox()));
  const scrolls = () =>
    page.evaluate(() => {
      const out: string[] = [`win ${scrollX},${scrollY}`];
      for (const n of document.querySelectorAll('*')) if (n.scrollTop || n.scrollLeft) out.push(`${n.tagName}.${[...n.classList].join('.')} ${n.scrollLeft},${n.scrollTop}`);
      return out;
    });
  console.log('DIAG scroll before', JSON.stringify(await scrolls()));
  await paper.scrollIntoViewIfNeeded();
  console.log('DIAG scroll after', JSON.stringify(await scrolls()));
  console.log('DIAG box after', JSON.stringify(await paper.boundingBox()));
  const b = (await paper.boundingBox())!;
  console.log('DIAG hit after', await page.evaluate(([x, y]) => { const n = document.elementFromPoint(x!, y!); return n ? n.tagName + '.' + n.className : 'null'; }, [b.x + b.width / 2, b.y + b.height / 2]));
  try {
    await paper.dblclick({ trial: true, timeout: 5000 });
    console.log('DIAG trial ok');
  } catch (e) {
    console.log('DIAG trial failed', String(e).split('\n').slice(0, 12).join(' | '));
  }
});
