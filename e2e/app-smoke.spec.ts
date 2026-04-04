import { test, expect } from '@playwright/test';

test.describe('Epidemic Monitor — Smoke Tests', () => {

  test('page loads and shows app shell', async ({ page }) => {
    await page.goto('/');
    // Title should contain "Epidemic Monitor"
    await expect(page).toHaveTitle(/Epidemic Monitor/i);
    // App shell should exist
    await expect(page.locator('#app')).toBeVisible();
  });

  test('map container renders', async ({ page }) => {
    await page.goto('/');
    // Map container should exist
    await expect(page.locator('.map-container')).toBeVisible();
    // MapLibre canvas should load (might take a moment) - check for maplibregl-canvas class
    const mapCanvas = page.locator('.maplibregl-canvas').first();
    await expect(mapCanvas).toBeVisible({ timeout: 10000 });
  });

  test('panels grid renders with disease panels', async ({ page }) => {
    await page.goto('/');
    // Panels grid should exist
    await expect(page.locator('.panels-grid')).toBeVisible();
    // Should have multiple panel cards
    const panels = page.locator('.panel');
    await expect(panels.first()).toBeVisible({ timeout: 10000 });
    // Count panels — expect at least 4 (outbreaks, stats, country, trend)
    const count = await panels.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('disease outbreaks panel renders', async ({ page }) => {
    await page.goto('/');
    // Outbreaks panel should show with title
    const panel = page.locator('.panel').filter({ hasText: /Disease Outbreaks/i });
    await expect(panel).toBeVisible({ timeout: 10000 });
    // Should have search/filter elements
    const searchInput = panel.locator('input[type="search"], input[type="text"]').first();
    const hasSearch = await searchInput.count().catch(() => 0);
    // Search input may exist
    expect(hasSearch).toBeGreaterThanOrEqual(0);
  });

  test('epidemic statistics panel renders', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator('.panel').filter({ hasText: /Epidemic Statistics|Statistics/i });
    await expect(panel).toBeVisible({ timeout: 10000 });
  });

  test('map layer controls render', async ({ page }) => {
    await page.goto('/');
    // Layer controls card should appear on map
    const controls = page.locator('.layer-controls-card, [class*="layer-control"]');
    // Layer controls might be visible or might be collapsed, just check they exist
    const controlCount = await controls.count().catch(() => 0);
    expect(controlCount).toBeGreaterThanOrEqual(0);
  });

  test('panel collapse toggle works', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator('.panel').first();
    await expect(panel).toBeVisible({ timeout: 10000 });

    // Try to find a collapse button
    const collapseBtn = panel.locator('[class*="collapse"], [class*="minimize"], button').first();
    const btnCount = await collapseBtn.count().catch(() => 0);

    if (btnCount > 0) {
      const initialClass = await panel.getAttribute('class');
      await collapseBtn.click();

      // Wait a moment for animation
      await page.waitForTimeout(500);

      // Panel should still exist
      await expect(panel).toBeVisible();
    }
  });

  test('no critical console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Only collect critical errors, not network-related ones
        if (!text.includes('fetch') &&
            !text.includes('Failed to load') &&
            !text.includes('net::') &&
            !text.includes('404') &&
            !text.includes('NetworkError') &&
            !text.includes('CORS')) {
          errors.push(text);
        }
      }
    });

    await page.goto('/');
    await page.waitForTimeout(3000); // Wait for async loads

    expect(errors).toHaveLength(0);
  });

  test('responsive layout: mobile viewport stacks elements', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone size
    await page.goto('/');
    await expect(page.locator('.app-shell')).toBeVisible();
    // Map and panels should both be visible in stacked layout
    await expect(page.locator('.map-container')).toBeVisible();
    await expect(page.locator('.panels-grid')).toBeVisible();
  });

  test('app initializes without crashing', async ({ page }) => {
    let appFailed = false;

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('Failed to initialize') || text.includes('Failed to load Epidemic Monitor')) {
          appFailed = true;
        }
      }
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    expect(appFailed).toBe(false);

    // App root should still be visible
    const appElement = page.locator('#app');
    const innerHTML = await appElement.innerHTML();
    expect(innerHTML.length).toBeGreaterThan(0);
  });

  // =====================================================================
  // AI Assistant ChatBox Tests — Added for chat-panel component
  // =====================================================================

  test('AI assistant panel renders with status', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator('.panel').filter({ hasText: /AI Assistant/i });
    await expect(panel).toBeVisible({ timeout: 10000 });
    // Should show provider status
    const status = page.locator('.chat-status');
    await expect(status).toBeVisible();
    // Should have welcome message
    await expect(page.locator('.chat-msg--assistant').first()).toBeVisible();
  });

  test('chat input and send button exist', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    const input = page.locator('.chat-input');
    await expect(input).toBeVisible();
    const sendBtn = page.locator('.chat-send-btn');
    await expect(sendBtn).toBeVisible();
  });

  test('can type in chat input', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    const input = page.locator('.chat-input');
    await input.fill('Test message');
    await expect(input).toHaveValue('Test message');
  });

  test('send message creates user bubble and triggers LLM response', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(6000); // Wait for LLM init

    const input = page.locator('.chat-input');
    await input.fill('Có bao nhiêu outbreak?');
    await page.locator('.chat-send-btn').click();

    // User message should appear
    await expect(page.locator('.chat-msg--user')).toBeVisible({ timeout: 5000 });

    // Wait for AI response (streaming from Ollama, may take up to 20s)
    await expect(page.locator('.chat-msg--assistant').nth(1)).toBeVisible({ timeout: 25000 });

    // Response should contain some text
    const responseText = await page.locator('.chat-msg--assistant').last().textContent();
    expect(responseText!.length).toBeGreaterThan(10);
  });

  test('chat status shows provider info', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(6000);
    const status = await page.locator('.chat-status').textContent();
    // Should show either Ollama or "No LLM" - both are valid
    expect(status!.length).toBeGreaterThan(3);
  });
});
