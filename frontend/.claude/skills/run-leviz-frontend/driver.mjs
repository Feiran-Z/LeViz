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

  --flow load|lesson|classes|teach|print
                        Smoke flow to run (default: load)
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
  if (!['load', 'lesson', 'classes', 'teach', 'print'].includes(opts.flow)) {
    console.error(`--flow must be "load", "lesson", "classes", "teach", or "print"`);
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
 * Reset the canvas to fit-to-view (zoom 1, no pan). `canvasPoint` models only
 * that transform, so call this before mapping a point — otherwise a wheel zoom
 * or a panning drag leaves the computed screen position wrong.
 */
async function resetCanvasView(page) {
  const fit = page.getByRole('button', { name: 'Fit to view' });
  if ((await fit.count()) > 0) {
    await fit.click();
    await page.waitForTimeout(120);
  }
}

/**
 * Map a point in canvas world units (1000×700) to the screen. The editor fits
 * the canvas into the surface, so hard-coded screen pixels break whenever the
 * chrome above the canvas changes height. Assumes fit-to-view: call
 * `resetCanvasView` first, and recompute the point before each interaction
 * rather than caching it.
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

  // The list is only visible before the editor opens; check its footer here.
  const footer = page.locator('footer').first();
  await footer.waitFor({ timeout: 10000 });
  const footerText = await footer.innerText();
  check(
    'footer shows copyright and MIT license',
    /© \d{4} Feiran Zhang/.test(footerText) && footerText.includes('MIT License'),
    footerText,
  );
  const noticesLink = page.getByRole('link', { name: 'Third-party notices' }).first();
  const noticesHref = await noticesLink.getAttribute('href');
  check(
    'footer notices link is base-aware',
    Boolean(noticesHref && noticesHref.endsWith('/licenses/THIRD_PARTY_NOTICES.txt')),
    noticesHref ?? '',
  );
  const noticesResponse = await page.request.get(new URL(noticesHref ?? '', page.url()).toString());
  check('footer notices link resolves', noticesResponse.status() === 200, String(noticesResponse.status()));
  const footerBox = await footer.boundingBox();
  check(
    'footer is pinned to the bottom on an empty list',
    Boolean(footerBox && footerBox.y + footerBox.height >= 890),
    JSON.stringify(footerBox),
  );

  await page.getByRole('button', { name: 'New lesson' }).first().click();
  await page.waitForURL(/\/lessons\//, { timeout: 10000 });
  await page.waitForTimeout(900);
  await shoot('01-lesson-start');
  check('lesson editor opened', /\/lessons\//.test(page.url()), page.url());
  check('editor has no footer', (await page.locator('footer').count()) === 0);

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
    await resetCanvasView(page);
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

  // Recompute Seat 1 before every interaction: the viewport can move, and a
  // cached screen point would silently miss the node.
  const seat1Point = async () => {
    await resetCanvasView(page);
    return canvasPoint(page, 500, 110);
  };
  let seat1 = await seat1Point();

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
  seat1 = await seat1Point();
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
  seat1 = await seat1Point();
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
  seat1 = await seat1Point();
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
  const overviewFooter = page.locator('footer').first();
  check('overview shows the footer', (await overviewFooter.innerText()).includes('MIT License'));
  await shoot('13-overview');
  await page.emulateMedia({ media: 'print' });
  check('print includes the footer', await overviewFooter.isVisible());
  await page.emulateMedia({ media: 'screen' });
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

async function runClassesFlow(page, opts, shoot, checks) {
  const check = (name, condition, detail) => {
    checks.push({ name, ok: Boolean(condition), ...(detail ? { detail } : {}) });
    if (!condition) throw new Error(`Check failed: ${name}${detail ? ` (${detail})` : ''}`);
  };

  await page.goto(opts.url, { waitUntil: 'load', timeout: opts.timeout });
  await page.getByRole('button', { name: 'New lesson' }).first().click();
  await page.waitForURL(/\/lessons\//);
  await page.waitForTimeout(700);

  for (const name of ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson']) {
    const input = page.getByLabel('Add a student by name');
    await input.fill(name);
    await input.press('Enter');
    await page.waitForTimeout(100);
  }

  // Tags and constraints travel with the class.
  await page.getByRole('button', { name: /^Ada Lovelace/ }).click();
  const tagInput = page.getByPlaceholder('Add tag');
  await tagInput.fill('reader');
  await tagInput.press('Enter');
  await page.getByLabel('Pair Ada Lovelace with another student').selectOption({ label: 'Grace Hopper' });
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: /Save as class/ }).click();
  await page.getByLabel('Class name').fill('Period 3');
  await page.getByRole('button', { name: 'Save class' }).click();
  await page.waitForTimeout(600);
  let right = page.locator('aside').last();
  check('class is saved and linked', (await right.innerText()).includes('Period 3'), await right.innerText());
  await shoot('01-class-saved');

  // Use the class in a lesson that already has students and a seat assignment.
  await page.getByRole('link', { name: 'Back to all lessons' }).click();
  await page.getByRole('button', { name: 'New lesson' }).first().waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'New lesson' }).first().click();
  await page.waitForURL(/\/lessons\//);
  await page.waitForTimeout(600);
  await page.getByRole('tab', { name: 'Roster' }).click();

  const legacyInput = page.getByLabel('Add a student by name');
  for (const name of ['Legacy One', 'Legacy Two']) {
    await legacyInput.fill(name);
    await legacyInput.press('Enter');
    await page.waitForTimeout(100);
  }
  await page.getByRole('button', { name: 'Add layout segment' }).first().click();
  await page.getByRole('button', { name: /Harkness discussion/ }).first().click();
  await page.waitForTimeout(700);

  await resetCanvasView(page);
  const seat = await canvasPoint(page, 500, 70);
  const avatar = page
    .locator('li', { hasText: 'Legacy One' })
    .first()
    .getByRole('button', { name: /Drag Legacy One/ });
  const avatarBox = await avatar.boundingBox();
  if (!avatarBox) throw new Error('Legacy One avatar not found');
  const dragStart = { x: avatarBox.x + avatarBox.width / 2, y: avatarBox.y + avatarBox.height / 2 };
  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(
      dragStart.x + ((seat.x - dragStart.x) * step) / 12,
      dragStart.y + ((seat.y - dragStart.y) * step) / 12,
    );
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
  check(
    'legacy student is seated before applying the class',
    /Legacy One → Seat/.test(await page.locator('body').innerText()),
  );

  await page.getByLabel('Choose a class').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Use class' }).click();
  const applyDialog = page.getByRole('dialog');
  const applyCopy = await applyDialog.innerText();
  check(
    'apply confirmation names the assignment loss',
    applyCopy.includes('1 seat assignment will be removed'),
    applyCopy,
  );
  await applyDialog.getByRole('button', { name: 'Use class' }).click();
  await page.waitForTimeout(600);
  right = page.locator('aside').last();
  const applied = await right.innerText();
  check('class roster is applied', applied.includes('4 students') && applied.includes('Period 3'), applied);
  check('class constraints are applied', applied.includes('with Grace Hopper'), applied);
  check('dropped legacy students are gone', !applied.includes('Legacy One'), applied);
  await page.getByRole('button', { name: /^Ada Lovelace/ }).click();
  check('class tags are applied', (await right.getByText('reader').count()) >= 1);
  await shoot('02-class-applied');

  // Refresh replaces a lesson-only student with the class snapshot.
  const add = page.getByLabel('Add a student by name');
  await add.fill('Temporary Student');
  await add.press('Enter');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Refresh from class' }).click();
  const refreshDialog = page.getByRole('dialog');
  await refreshDialog.getByRole('button', { name: 'Refresh class' }).click();
  await page.waitForTimeout(600);
  const refreshed = await page.locator('aside').last().innerText();
  check('refresh restores the class roster', refreshed.includes('4 students') && !refreshed.includes('Temporary Student'), refreshed);

  // Save a new student back to the class, then unlink and keep the snapshot.
  await add.fill('Student 5');
  await add.press('Enter');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Save changes to class' }).click();
  await page.getByRole('button', { name: 'Save to class' }).click();
  await page.waitForTimeout(600);
  check('class update reports five students', (await page.locator('aside').last().innerText()).includes('5 students'));

  await page.getByRole('button', { name: 'Unlink' }).click();
  await page.waitForTimeout(400);
  right = page.locator('aside').last();
  check(
    'unlink keeps the roster',
    (await right.getByLabel('Choose a class').count()) === 1 && (await right.innerText()).includes('5 students'),
    await right.innerText(),
  );

  await page.getByRole('link', { name: 'Back to all lessons' }).click();
  await page.getByRole('button', { name: 'New lesson' }).first().waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'New lesson' }).first().click();
  await page.waitForURL(/\/lessons\//);
  await page.waitForTimeout(600);
  await page.getByRole('tab', { name: 'Roster' }).click();
  await page.getByLabel('Choose a class').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Use class' }).click();
  await page.waitForTimeout(600);
  check(
    'updated class is reusable',
    (await page.locator('aside').last().innerText()).includes('5 students'),
    await page.locator('aside').last().innerText(),
  );
  await shoot('03-class-updated');

  // Manager: rename and delete; a deleted class keeps the lesson snapshot.
  await page.getByRole('link', { name: 'Back to all lessons' }).click();
  await page.getByRole('button', { name: 'Classes' }).first().waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'Classes' }).first().click();
  await page.getByRole('button', { name: 'Rename Period 3' }).click();
  await page.getByLabel('Class name').fill('Period 3A');
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.waitForTimeout(500);
  check(
    'class rename is reflected in the manager',
    (await page.getByRole('dialog').first().innerText()).includes('Period 3A'),
  );
  await page.getByRole('button', { name: 'Close classes' }).click();
  await page.waitForTimeout(300);

  await page.getByRole('link', { name: 'Untitled lesson' }).first().click();
  await page.waitForURL(/\/lessons\//);
  await page.waitForTimeout(700);
  await page.getByRole('tab', { name: 'Roster' }).click();
  check(
    'renamed class appears on the linked lesson',
    (await page.locator('aside').last().innerText()).includes('Period 3A'),
  );

  await page.getByRole('button', { name: 'Manage classes' }).click();
  await page.getByRole('button', { name: 'Delete Period 3A' }).click();
  await page.getByRole('button', { name: 'Delete class' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Close classes' }).click();
  const unavailable = await page.locator('aside').last().innerText();
  check(
    'deleted class keeps the roster snapshot',
    unavailable.includes('Class unavailable') && unavailable.includes('5 students'),
    unavailable,
  );
  await shoot('04-class-unavailable');
}

async function runTeachFlow(page, opts, shoot, checks) {
  const check = (name, condition, detail) => {
    checks.push({ name, ok: Boolean(condition), ...(detail ? { detail } : {}) });
    if (!condition) throw new Error(`Check failed: ${name}${detail ? ` (${detail})` : ''}`);
  };

  await page.clock.install({ time: new Date('2026-11-28T09:00:00') });
  await page.goto(opts.url, { waitUntil: 'load', timeout: opts.timeout });
  await page.getByRole('button', { name: 'New lesson' }).first().click();
  await page.waitForURL(/\/lessons\//);
  await page.waitForTimeout(700);

  await page.getByRole('button', { name: 'Add text segment' }).first().click();
  await page.getByRole('button', { name: /Do Now/ }).first().click();
  await page.waitForTimeout(500);
  const firstDuration = page.getByLabel('Segment duration in minutes');
  await firstDuration.fill('1');
  await firstDuration.press('Enter');
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: 'Add text segment' }).first().click();
  await page.getByRole('button', { name: /Debrief/ }).first().click();
  await page.waitForTimeout(500);
  const secondDuration = page.getByLabel('Segment duration in minutes');
  await secondDuration.fill('5');
  await secondDuration.press('Enter');
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: 'Add layout segment' }).first().click();
  await page.getByRole('button', { name: /Station rotation/ }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole('tab', { name: 'Roster' }).click();
  for (let index = 1; index <= 8; index += 1) {
    const input = page.getByLabel('Add a student by name');
    await input.fill(`Student ${index}`);
    await input.press('Enter');
    await page.waitForTimeout(60);
  }
  await page.getByRole('tab', { name: 'Groups' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Generate' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Apply to canvas' }).click();
  await page.waitForTimeout(500);
  check(
    'station rotation groups are applied',
    /Placed 8 students across 4 seats/.test(await page.locator('body').innerText()),
  );

  await page.getByRole('button', { name: 'Add layout segment' }).first().click();
  await page.getByRole('button', { name: /Gallery walk/ }).first().click();
  await page.waitForTimeout(700);
  await resetCanvasView(page);
  const galleryStop = await canvasPoint(page, 205, 66);
  await page.mouse.dblclick(galleryStop.x, galleryStop.y);
  await page.waitForTimeout(400);
  await page.getByLabel('Title', { exact: true }).fill('Stop A prompt');
  await page.getByLabel('Body', { exact: true }).fill('What do you notice?');
  await page.getByRole('button', { name: 'Save note' }).click();
  await page.waitForTimeout(500);

  const lessonId = new URL(page.url()).hash.match(/lessons\/([^/?#]+)/)?.[1];
  check('lesson created for teach', Boolean(lessonId), page.url());
  await page.getByRole('link', { name: 'Back to all lessons' }).click();
  await page.getByRole('button', { name: 'New lesson' }).first().waitFor({ timeout: 10000 });
  await page.getByRole('link', { name: /^Teach / }).first().click();
  await page.waitForURL(/\/teach/);
  await page.waitForTimeout(800);

  const timer = page.getByRole('timer');
  const timerText = async () => timer.innerText();
  check('teach route opens', /\/teach/.test(page.url()), page.url());
  check('text segment timer starts at one minute', (await timerText()).includes('01:00'), await timerText());
  check('text content is rendered', (await page.locator('body').innerText()).includes('Students begin immediately'));
  const teachText = await page.locator('body').innerText();
  check('keyboard shortcuts are visible', teachText.includes('Space start/pause'));
  check(
    'timer state is announced',
    (await page.locator('[role="status"][aria-live="polite"]').filter({ hasText: 'Paused' }).count()) >= 1,
  );
  const plannedBefore = await page.getByText(/Planned end ~/).first().innerText();
  await page.clock.fastForward(60_000);
  await page.waitForTimeout(300);
  const plannedAfter = await page.getByText(/Planned end ~/).first().innerText();
  check('planned end advances while paused', plannedBefore !== plannedAfter, `${plannedBefore} -> ${plannedAfter}`);
  await shoot('01-text-timer');

  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.fastForward(10_000);
  await page.waitForTimeout(200);
  check('timer counts down', (await timerText()).includes('00:50'), await timerText());

  await page.getByRole('button', { name: 'Pause' }).click();
  await page.clock.fastForward(5_000);
  await page.waitForTimeout(150);
  check('pause freezes the timer', (await timerText()).includes('00:50'), await timerText());

  await page.getByRole('button', { name: /\+1:00/ }).click();
  await page.waitForTimeout(150);
  check('add a minute', (await timerText()).includes('01:50'), await timerText());

  await page.getByRole('button', { name: 'Reset' }).click();
  await page.waitForTimeout(150);
  check('reset restores the planned duration', (await timerText()).includes('01:00'), await timerText());

  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.fastForward(61_000);
  await page.waitForTimeout(200);
  check('time-up pauses at zero', (await timerText()).includes('00:00') && (await page.locator('body').innerText()).includes("Time's up"), await timerText());
  check('time-up does not auto-advance', (await page.locator('body').innerText()).includes('Do Now'));
  await shoot('02-time-up');

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForTimeout(200);
  check('next advances to the debrief', (await timerText()).includes('05:00') && (await page.locator('body').innerText()).includes('Debrief'), await timerText());
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.waitForTimeout(200);
  check('previous returns to the do now', (await page.locator('body').innerText()).includes('Do Now'));

  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.fastForward(10_000);
  await page.waitForTimeout(150);
  const beforeReload = await timerText();
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
  const afterReload = await timerText();
  check(
    'reload restores paused at the same segment',
    (await page.locator('body').innerText()).includes('Paused') &&
      (await page.locator('body').innerText()).includes('Do Now') &&
      afterReload !== '01:00',
    `${beforeReload} -> ${afterReload}`,
  );
  await shoot('03-reloaded');

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForTimeout(300);
  const stationBody = await page.locator('body').innerText();
  check(
    'station rotation timer is shown',
    (await timerText()).includes('15:00') && stationBody.includes('Station 1 of 4'),
    stationBody,
  );
  check('station groups are shown in the cards', stationBody.includes('Group: Student'), stationBody);
  await page.getByRole('button', { name: 'Next station' }).click();
  await page.waitForTimeout(200);
  check('next station advances the guide', (await page.locator('body').innerText()).includes('Station 2 of 4'));
  await page.getByRole('button', { name: 'Rotation guide' }).click();
  await page.waitForTimeout(200);
  check('rotation guide can be turned off', !(await page.locator('body').innerText()).includes('Station 2 of 4'));
  await page.getByRole('button', { name: 'Rotation guide' }).click();
  await page.waitForTimeout(200);
  check('rotation guide can be turned back on', (await page.locator('body').innerText()).includes('Station 1 of 4'));
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.clock.fastForward(10_000);
  await page.waitForTimeout(150);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
  const stationReload = await page.locator('body').innerText();
  check(
    'reload restores the station guide paused',
    stationReload.includes('Paused') &&
      stationReload.includes('Station 1 of 4') &&
      stationReload.includes('14:50'),
    stationReload,
  );
  await shoot('04-station-rotation');

  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForTimeout(300);
  const galleryBody = await page.locator('body').innerText();
  check(
    'gallery walk guide is shown',
    galleryBody.includes('Stop 1 of 6') && galleryBody.includes('Stop A prompt'),
    galleryBody,
  );
  check('unannotated gallery stops do not render empty cards', !galleryBody.includes('Not a seat'));
  await page.getByRole('button', { name: 'Next stop' }).click();
  await page.waitForTimeout(200);
  check('next stop advances the gallery guide', (await page.locator('body').innerText()).includes('Stop 2 of 6'));
  await shoot('05-gallery-walk');

  await page.getByRole('button', { name: 'Start over' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start over' }).click();
  await page.waitForTimeout(300);
  check(
    'start over returns to the first segment',
    (await timerText()).includes('01:00') && (await page.locator('body').innerText()).includes('Do Now'),
    await timerText(),
  );

  await page.getByRole('button', { name: /Exit/ }).click();
  await page.waitForURL(/\/lessons\/[^/]+$/);
  await page.waitForTimeout(900);
  check('exit returns to the editor', (await page.getByRole('tab', { name: 'Roster' }).count()) > 0);

  await page.getByRole('link', { name: 'Teach this lesson' }).click();
  await page.waitForURL(/\/teach/);
  await page.waitForTimeout(700);
  check('editor opens teach mode', /\/teach/.test(page.url()));
  await page.getByRole('button', { name: /Exit/ }).click();
  await page.waitForURL(/\/lessons\/[^/]+$/);
  await page.waitForTimeout(700);

  await page.getByRole('button', { name: 'Open lesson overview' }).click();
  await page.waitForTimeout(700);
  await page.getByRole('link', { name: 'Teach', exact: true }).click();
  await page.waitForURL(/\/teach/);
  await page.waitForTimeout(700);
  check('overview opens teach mode', /\/teach/.test(page.url()));
  await page.getByRole('button', { name: /Exit/ }).click();
  await page.waitForURL(/\/lessons\/[^/]+$/);
  await page.waitForTimeout(700);
  check('teach links return to the editor', (await page.getByRole('tab', { name: 'Roster' }).count()) > 0);
}

async function runPrintFlow(page, opts, shoot, checks) {
  const check = (name, condition, detail) => {
    checks.push({ name, ok: Boolean(condition), ...(detail ? { detail } : {}) });
    if (!condition) throw new Error(`Check failed: ${name}${detail ? ` (${detail})` : ''}`);
  };

  await page.addInitScript(() => {
    window.__levizPrintCalls = 0;
    window.print = () => { window.__levizPrintCalls += 1; };
  });
  await page.goto(opts.url, { waitUntil: 'load', timeout: opts.timeout });
  await page.getByRole('button', { name: 'New lesson' }).first().click();
  await page.waitForURL(/\/lessons\//);
  await page.waitForTimeout(700);

  await page.getByRole('button', { name: 'Add layout segment' }).first().click();
  await page.getByRole('button', { name: /Station rotation/ }).first().click();
  await page.waitForTimeout(700);

  await page.getByRole('tab', { name: 'Roster' }).click();
  for (let index = 1; index <= 8; index += 1) {
    const input = page.getByLabel('Add a student by name');
    await input.fill(`Student ${index}`);
    await input.press('Enter');
    await page.waitForTimeout(60);
  }
  await page.getByRole('tab', { name: 'Groups' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Generate' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Apply to canvas' }).click();
  await page.waitForTimeout(600);
  check(
    'station rotation groups are applied',
    /Placed 8 students across 4 seats/.test(await page.locator('body').innerText()),
  );

  await resetCanvasView(page);
  const station1 = await canvasPoint(page, 215, 145);
  await page.mouse.dblclick(station1.x, station1.y);
  await page.waitForTimeout(500);
  await page.getByLabel('Title', { exact: true }).fill('Station 1 prompt');
  await page
    .getByLabel('Body', { exact: true })
    .fill('Discuss the opening question with your group.\n\nChoose one sentence to share.');
  await page.getByRole('button', { name: 'Save note' }).click();
  await page.waitForTimeout(500);

  await page.getByRole('link', { name: 'Print materials' }).click();
  await page.waitForURL(/\/print\//, { timeout: 10000 });
  await page.waitForTimeout(700);
  const printBody = await page.locator('body').innerText();
  check('print route opens', /\/print\//.test(page.url()), page.url());
  check(
    'seating sheet is included',
    printBody.toLowerCase().includes('seating sheet') &&
      printBody.includes('Seats and assignments'),
  );
  check(
    'station card shows the prompt',
    printBody.includes('Station 1 prompt') && printBody.includes('Choose one sentence to share.'),
  );
  check('station card shows the group', /Group: Student \d/.test(printBody));
  check(
    'seating sheet shows engagement',
    printBody.includes('Cognitive') && printBody.includes('Medium'),
  );
  const stationCardText = await page.locator('.print-card').first().innerText();
  check(
    'station card is student-facing',
    !/(Station card|Seats:|Engagement|Untitled lesson)/.test(stationCardText),
    stationCardText.replace(/\n/g, ' | '),
  );
  check(
    'one card per station',
    (await page.locator('.print-card').count()) === 4,
    String(await page.locator('.print-card').count()),
  );
  check(
    'print page has no editor chrome',
    (await page.getByRole('tab', { name: 'Roster' }).count()) === 0,
  );
  check(
    'Print button is present',
    (await page.getByRole('button', { name: 'Print', exact: true }).count()) === 1,
  );
  await shoot('01-print-preview');

  await page.setViewportSize({ width: 720, height: 960 });
  await page.emulateMedia({ media: 'print' });
  check('screen toolbar is hidden in print', !(await page.locator('.print-toolbar').isVisible()));
  const sheetHeight = await page
    .locator('.print-sheet')
    .evaluate((element) => element.getBoundingClientRect().height);
  check(
    'seating sheet fits one printed page',
    sheetHeight > 0 && sheetHeight <= 960,
    String(Math.round(sheetHeight)),
  );
  await shoot('02-print-media');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ media: 'screen' });

  await page.getByRole('button', { name: 'Print', exact: true }).click();
  await page.waitForTimeout(200);
  const printCalls = await page.evaluate(() => window.__levizPrintCalls);
  check('Print calls window.print', printCalls === 1, String(printCalls));

  await page.getByRole('link', { name: 'Back to editor' }).click();
  await page.waitForURL(/\/lessons\/[^/]+$/, { timeout: 10000 });
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Open lesson overview' }).click();
  await page.waitForTimeout(700);
  await page.getByRole('link', { name: 'Print materials' }).first().click();
  await page.waitForURL(/\/print\//, { timeout: 10000 });
  await page.waitForTimeout(700);
  check(
    'overview opens print materials',
    /\/print\//.test(page.url()) &&
      (await page.locator('body').innerText()).toLowerCase().includes('seating sheet'),
  );
  await shoot('03-overview-entry');
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
    else if (opts.flow === 'classes') await runClassesFlow(page, opts, shoot, checks);
    else if (opts.flow === 'teach') await runTeachFlow(page, opts, shoot, checks);
    else if (opts.flow === 'print') await runPrintFlow(page, opts, shoot, checks);
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
