#!/usr/bin/env node
// Playwright smoke driver for the LeViz frontend.
//
// Two flows:
//   load   — open the URL, wait for the SPA to render, screenshot. (default)
//   lesson — create a lesson, apply a Harkness template, add a roster, drag a
//            student onto a seat, save a node note, move + undo a node,
//            generate and apply groups, write a text segment, reload to prove
//            persistence, export, and import the JSON file again.
//
// The lesson flow assumes a 1440x900 viewport (the driver creates its own
// context) and uses canvas coordinates derived from the Harkness template.
//
// Usage:
//   node .claude/skills/run-leviz-frontend/driver.mjs [--flow load|lesson]
//        [--url URL] [--out DIR] [--headed] [--timeout MS]
//        [--no-fail-on-console]
//
// Exit codes: 0 = clean run, 1 = failure or console/page error,
//             2 = bad usage.

import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

function usage() {
  return `Usage: node driver.mjs [options]

  --flow load|lesson    Smoke flow to run (default: load)
  --url URL             Page to open (default: http://localhost:5173)
  --out DIR             Screenshot directory (default: screenshots)
  --headed              Show a real window instead of headless
  --timeout MS          Navigation timeout in ms (default: 30000)
  --no-fail-on-console  Exit 0 even when console.error() fired
  --help                Show this message`;
}

function parseArgs(argv) {
  const opts = {
    flow: 'load',
    url: 'http://localhost:5173',
    out: 'screenshots',
    headed: false,
    timeout: 30000,
    failOnConsole: true,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--flow') opts.flow = argv[++i];
    else if (arg === '--url') opts.url = argv[++i];
    else if (arg === '--out') opts.out = argv[++i];
    else if (arg === '--headed') opts.headed = true;
    else if (arg === '--timeout') opts.timeout = Number(argv[++i]);
    else if (arg === '--no-fail-on-console') opts.failOnConsole = false;
    else if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}\n\n${usage()}`);
      process.exit(2);
    }
  }
  if (!['load', 'lesson'].includes(opts.flow)) {
    console.error(`--flow must be "load" or "lesson"`);
    process.exit(2);
  }
  if (!Number.isFinite(opts.timeout) || opts.timeout <= 0) {
    console.error('--timeout must be a positive number');
    process.exit(2);
  }
  return opts;
}

// Prefer the installed Google Chrome (channel: 'chrome') so no browser
// download is required; fall back to Playwright's bundled Chromium.
async function launchBrowser(headed) {
  const attempts = [
    { channel: 'chrome', label: 'system Chrome' },
    { channel: undefined, label: 'bundled Chromium' },
  ];
  let lastError;
  for (const attempt of attempts) {
    try {
      const options = { headless: !headed };
      if (attempt.channel) options.channel = attempt.channel;
      const browser = await chromium.launch(options);
      return { browser, label: attempt.label };
    } catch (err) {
      lastError = err;
      console.warn(`[driver] ${attempt.label} launch failed: ${err.message.split('\n')[0]}`);
    }
  }
  throw lastError;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Map a point in canvas world units (1000×700) to the screen. The editor fits
 * the canvas into the surface, so hard-coded screen pixels break whenever the
 * chrome above the canvas changes height.
 */
async function canvasPoint(page, x, y) {
  const map = await page.evaluate(() => {
    const surface = document.querySelector('[data-canvas-surface="true"]');
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    const PADDING = 28;
    const canvasWidth = 1000;
    const canvasHeight = 700;
    const fit = Math.min(
      (rect.width - PADDING * 2) / canvasWidth,
      (rect.height - PADDING * 2) / canvasHeight,
      1.5,
    );
    const scale = Math.max(0.15, fit);
    return {
      left: rect.left,
      top: rect.top,
      scale,
      offsetX: (rect.width - canvasWidth * scale) / 2,
      offsetY: (rect.height - canvasHeight * scale) / 2,
    };
  });
  if (!map) throw new Error('canvas surface not found');
  return { x: map.left + map.offsetX + x * map.scale, y: map.top + map.offsetY + y * map.scale };
}

async function runLoadFlow(page, opts, shoot) {
  await page.goto(opts.url, { waitUntil: 'load', timeout: opts.timeout });
  await page.waitForTimeout(750);
  await shoot('page');
  return { checks: [] };
}

async function runLessonFlow(page, opts, shoot, checks) {
  const check = (name, condition, detail) => {
    checks.push({ name, ok: Boolean(condition), ...(detail ? { detail } : {}) });
    if (!condition) throw new Error(`Check failed: ${name}${detail ? ` (${detail})` : ''}`);
  };

  await page.goto(opts.url, { waitUntil: 'load', timeout: opts.timeout });
  await page.getByRole('button', { name: 'New lesson' }).first().click();
  await page.waitForURL(/\/lessons\//, { timeout: 10000 });
  await page.waitForTimeout(900);
  await shoot('01-lesson-start');
  check('lesson editor opened', /\/lessons\//.test(page.url()), page.url());

  // Class size drives template geometry (12 seats + teacher = 13 nodes).
  const classSizeInput = page.getByLabel('Class size in students');
  await classSizeInput.fill('12');
  await classSizeInput.press('Enter');
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: /Harkness discussion/ }).first().click();
  await page.waitForTimeout(900);
  await shoot('02-harkness-template');
  check('layout segment created', (await page.getByRole('button', { name: 'Add text segment' }).count()) > 0);
  check('class size drives template seating', (await page.locator('body').innerText()).includes('13 nodes'));

  await page.getByRole('button', { name: 'Activity instructions' }).click();
  await page.waitForTimeout(250);
  const guidelineText = await page.getByLabel('Activity instructions').inputValue();
  check(
    'activity instructions prefilled with sample guidance',
    guidelineText.includes('PREPARATION') && guidelineText.includes('DISCUSSION NORMS'),
  );
  await page.getByRole('button', { name: 'Activity instructions' }).click();
  await page.waitForTimeout(250);

  const rosterInput = page.getByLabel('Add a student by name');
  for (const name of ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson']) {
    await rosterInput.fill(name);
    await rosterInput.press('Enter');
    await page.waitForTimeout(120);
  }
  check('roster has four students', (await page.locator('aside').last().innerText()).includes('4 students'));

  // Drag Ada's roster avatar onto Seat 5 on the canvas (coords for 1440x900).
  const avatar = page
    .locator('li', { hasText: 'Ada Lovelace' })
    .first()
    .getByRole('button', { name: /Drag Ada Lovelace/ });
  const avatarBox = await avatar.boundingBox();
  check('roster avatar is visible', Boolean(avatarBox));
  if (avatarBox) {
    const start = { x: avatarBox.x + avatarBox.width / 2, y: avatarBox.y + avatarBox.height / 2 };
    // Seat 5 of the 12-seat Harkness circle, in canvas world units.
    const target = await canvasPoint(page, 673, 410);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let i = 1; i <= 12; i += 1) {
      await page.mouse.move(
        start.x + ((target.x - start.x) * i) / 12,
        start.y + ((target.y - start.y) * i) / 12,
      );
      await page.waitForTimeout(20);
    }
    await page.mouse.up();
  }
  await page.waitForTimeout(600);
  await shoot('03-student-dropped');
  check('student assigned via drag', (await page.locator('body').innerText()).includes('Ada Lovelace → Seat 5'));

  // Same canvas-chrome height for every later interaction with Seat 1.
  const seat1 = await canvasPoint(page, 500, 110);

  // Double-click Seat 1 to annotate it.
  await page.mouse.dblclick(seat1.x, seat1.y);
  await page.waitForTimeout(500);
  const dialogOpen = (await page.getByRole('dialog').count()) > 0;
  check('double-click opens the note dialog', dialogOpen);
  if (dialogOpen) {
    await page.getByLabel('Title', { exact: true }).fill('Harkness prompt');
    await page.getByLabel('Body', { exact: true }).fill('What makes a discussion move?');
    await page.getByRole('button', { name: 'Save note' }).click();
    await page.waitForTimeout(600);
  }
  await shoot('04-node-note');

  // Hovering a noted seat previews its note at the cursor.
  await page.mouse.move(seat1.x, seat1.y);
  await page.waitForTimeout(500);
  const tooltip = page.getByRole('tooltip');
  check(
    'hovering a noted seat shows its note',
    (await tooltip.count()) === 1 && (await tooltip.innerText()).includes('Harkness prompt'),
  );
  await shoot('04a-note-tooltip');
  await page.mouse.move(450, 650);
  await page.waitForTimeout(250);
  check('note tooltip hides when the cursor leaves', (await page.getByRole('tooltip').count()) === 0);

  // Move Seat 1, then undo the move. The inspector's Position row proves both.
  const inspectorText = async () => page.locator('aside').last().innerText().catch(() => '');
  const positionOf = (text) => text.match(/Position\s+(-?\d+),\s*(-?\d+)/)?.[0] ?? '';
  const positionBefore = positionOf(await inspectorText());
  await page.mouse.move(seat1.x, seat1.y);
  await page.mouse.down();
  await page.mouse.move(seat1.x + 45, seat1.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await shoot('05-node-dragged');
  const positionAfterDrag = positionOf(await inspectorText());
  check('node drag moved the seat', positionBefore !== '' && positionAfterDrag !== positionBefore, `${positionBefore} -> ${positionAfterDrag}`);
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(500);
  await shoot('06-node-undo');
  const positionAfterUndo = positionOf(await inspectorText());
  check('undo restores the seat position', positionAfterUndo === positionBefore, `${positionAfterDrag} -> ${positionAfterUndo}`);

  // Generate groups and apply them.
  await page.getByRole('tab', { name: 'Groups' }).click();
  await page.getByRole('button', { name: 'Generate' }).click();
  await page.waitForTimeout(400);
  await shoot('07-groups-generated');

  // The preview must survive canvas interaction and tab switches.
  const previewVisible = async () => (await page.locator('aside').last().innerText()).includes('Group 1');
  await page.mouse.click(seat1.x, seat1.y);
  await page.waitForTimeout(300);
  const groupsTabActive =
    (await page.getByRole('tab', { name: 'Groups' }).getAttribute('aria-selected')) === 'true';
  check('canvas click keeps the group preview', groupsTabActive && (await previewVisible()));
  await page.getByRole('tab', { name: 'Roster' }).click();
  await page.getByRole('tab', { name: 'Groups' }).click();
  await page.waitForTimeout(300);
  check('group preview survives tab switches', await previewVisible());

  await page.getByRole('button', { name: 'Apply to canvas' }).click();
  await page.waitForTimeout(700);
  await shoot('08-groups-applied');
  check(
    'groups placed students',
    (await page.locator('body').innerText()).match(/Placed \d+ students? across \d+ seats?/),
  );

  // Add a text segment through the template menu, then type into it.
  await page.getByRole('button', { name: 'Add text segment' }).first().click();
  await page.waitForTimeout(250);
  await shoot('09a-text-templates');
  check(
    'text template menu lists routines',
    (await page.locator('body').innerText()).includes('Think-Pair-Share'),
  );
  await page.getByRole('button', { name: /Blank text segment/ }).click();
  await page.waitForTimeout(600);
  check('blank text segment added', (await page.locator('.lesson-editor').count()) > 0);
  const editor = page.locator('.lesson-editor').first();
  await editor.click();
  await page.keyboard.type('Today we practise a Harkness discussion.');
  await page.waitForTimeout(1800);
  await shoot('09-text-segment');

  // Reload and prove the document persisted.
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1400);
  await page.getByRole('button', { name: /^Text segment 2/ }).first().click();
  await page.waitForTimeout(600);
  const persistedText = await page.locator('.lesson-editor').first().innerText();
  check('text survives reload', persistedText.includes('Harkness discussion'), persistedText);
  await shoot('10-reloaded');

  // Export on the list page, then import the same file.
  await page.getByRole('link', { name: 'Back to all lessons' }).click();
  await page.waitForTimeout(700);
  await shoot('11-lesson-list');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
    page.getByRole('button', { name: /^Export/ }).first().click(),
  ]);
  check('lesson downloads as JSON', Boolean(download) && /\.leviz\.json$/.test(download.suggestedFilename()));
  if (!download) return;
  const exportPath = `${opts.out.replace(/\/$/, '')}/exported-${stamp()}.leviz.json`;
  await download.saveAs(exportPath);

  await page.locator('input[type="file"]').setInputFiles(exportPath);
  await page.waitForURL(/\/lessons\//, { timeout: 10000 });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /^Text segment 2/ }).first().click();
  await page.waitForTimeout(600);
  const importedText = await page.locator('.lesson-editor').first().innerText();
  check('import restores the text', importedText.includes('Harkness discussion'), importedText);
  await shoot('12-imported');

  // Read-only overview: every segment in order, rendered text and notes.
  await page.getByRole('button', { name: 'Open lesson overview' }).click();
  await page.waitForTimeout(600);
  const overviewText = await page.locator('body').innerText();
  check(
    'overview lists every segment',
    overviewText.includes('Harkness discussion') && overviewText.includes('Text segment 2'),
  );
  check(
    'overview renders lesson text and node notes',
    overviewText.includes('Today we practise a Harkness discussion.') &&
      overviewText.includes('Harkness prompt'),
  );
  check(
    'overview lists station assignments for unannotated seats',
    ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson'].every((name) =>
      overviewText.includes(name),
    ),
  );
  check(
    'overview plots the engagement timeline',
    (await page.locator('svg[role="img"][aria-label^="Designed engagement timeline"]').count()) === 1,
  );
  await shoot('13-overview');
  await page.getByRole('button', { name: 'Back to editor' }).click();
  await page.waitForTimeout(400);
  check('overview returns to the editor', (await page.getByRole('tab', { name: 'Roster' }).count()) > 0);

  // Both themes render.
  await page.getByRole('link', { name: 'Back to all lessons' }).click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /^Theme:/ }).click();
  await page.getByRole('button', { name: /^Theme:/ }).click();
  await page.waitForTimeout(500);
  await shoot('14-dark-theme');
}

async function main() {
  const opts = parseArgs(process.argv);
  await mkdir(opts.out, { recursive: true });

  const consoleErrors = [];
  const pageErrors = [];
  const checks = [];
  const screenshots = [];
  let browser;
  let label = 'unknown';

  const shoot = async (name) => {
    const file = `${opts.out.replace(/\/$/, '')}/leviz-${opts.flow}-${name}-${stamp()}.png`;
    await page.screenshot({ path: file, fullPage: true });
    screenshots.push(file);
  };

  let page;
  try {
    ({ browser, label } = await launchBrowser(opts.headed));
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    if (opts.flow === 'lesson') await runLessonFlow(page, opts, shoot, checks);
    else await runLoadFlow(page, opts, shoot);

    const title = await page.title();
    const failed = pageErrors.length > 0 || (opts.failOnConsole && consoleErrors.length > 0);
    console.log(
      JSON.stringify(
        {
          ok: !failed,
          flow: opts.flow,
          browser: label,
          url: opts.url,
          title,
          screenshots,
          checks,
          consoleErrors,
          pageErrors,
        },
        null,
        2,
      ),
    );
    await context.close();
    process.exitCode = failed ? 1 : 0;
  } catch (err) {
    const failureShot = `${opts.out.replace(/\/$/, '')}/leviz-${opts.flow}-failure-${stamp()}.png`;
    if (page) await page.screenshot({ path: failureShot, fullPage: true }).catch(() => {});
    console.log(
      JSON.stringify(
        {
          ok: false,
          flow: opts.flow,
          browser: label,
          url: opts.url,
          error: err.message,
          screenshots: [...screenshots, failureShot],
          checks,
          consoleErrors,
          pageErrors,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

main();
