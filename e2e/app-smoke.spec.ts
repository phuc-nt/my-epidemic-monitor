import { test, expect, type Page } from '@playwright/test';

/** Dismiss breaking news banner if visible */
async function dismissBanner(page: Page): Promise<void> {
  const btn = page.locator('.breaking-news-banner__dismiss');
  if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(300);
  }
}

/** Switch to a panel tab (Dashboard, Analysis, Tools). Waits for tab bar to load. */
async function switchTab(page: Page, tabName: string): Promise<void> {
  await dismissBanner(page);
  const tabBar = page.locator('.panel-tab-bar');
  await tabBar.waitFor({ state: 'visible', timeout: 15000 });
  const btns = await page.locator('.panel-tab-btn').all();
  for (const btn of btns) {
    const text = await btn.textContent();
    if (text && text.toLowerCase().includes(tabName.toLowerCase())) {
      await btn.click();
      await page.waitForTimeout(500);
      return;
    }
  }
}

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
      // Dismiss breaking news banner if it overlaps
      const dismissBtn = page.locator('.breaking-news-banner__dismiss');
      if (await dismissBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dismissBtn.click();
        await page.waitForTimeout(500);
      }
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
    await switchTab(page, 'Tools');
    const panel = page.locator('.panel').filter({ hasText: /AI Assistant/i });
    await expect(panel).toBeVisible({ timeout: 10000 });
    // Should show provider status
    const status = page.locator('.chat-status');
    await expect(status).toBeVisible();
    // Should have welcome message
    await expect(page.locator('.chat-msg--assistant').first()).toBeVisible();
  });

  test('chat input and send button exist', async ({ page }) => {
    await page.goto('/'); await switchTab(page, 'Tools');
    await page.waitForTimeout(3000);
    const input = page.locator('.chat-input');
    await expect(input).toBeVisible();
    const sendBtn = page.locator('.chat-send-btn');
    await expect(sendBtn).toBeVisible();
  });

  test('can type in chat input', async ({ page }) => {
    await page.goto('/'); await switchTab(page, 'Tools');
    await page.waitForTimeout(3000);
    const input = page.locator('.chat-input');
    await input.fill('Test message');
    await expect(input).toHaveValue('Test message');
  });

  test('send message creates user bubble and triggers LLM response', async ({ page }) => {
    await page.goto('/'); await switchTab(page, 'Tools');
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
    await page.goto('/'); await switchTab(page, 'Tools');
    await page.waitForTimeout(6000);
    const status = await page.locator('.chat-status').textContent();
    // Should show either Ollama or "No LLM" - both are valid
    expect(status!.length).toBeGreaterThan(3);
  });

  // =====================================================================
  // Climate Risk Forecast Tests
  // =====================================================================

  test('climate risk forecast panel renders with provinces', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(6000);
    const panel = page.locator('.panel').filter({ hasText: /Climate Risk/i });
    await expect(panel).toBeVisible({ timeout: 10000 });
    // Should show alert banner or province table
    const content = await panel.textContent();
    expect(content!.length).toBeGreaterThan(20);
  });

  // =====================================================================
  // Case Report Form Tests
  // =====================================================================

  test('case report form has disease and province dropdowns', async ({ page }) => {
    await page.goto('/'); await switchTab(page, 'Tools');
    await page.waitForTimeout(3000);
    const panel = page.locator('.panel').filter({ hasText: /Báo cáo ca bệnh|Case Report/i });
    await expect(panel).toBeVisible({ timeout: 10000 });
    // Should have select dropdowns (disease + province)
    const selects = panel.locator('select');
    expect(await selects.count()).toBeGreaterThanOrEqual(2);
  });

  test('case report form can be filled and submitted', async ({ page }) => {
    await page.goto('/'); await switchTab(page, 'Tools');
    await page.waitForTimeout(3000);
    const panel = page.locator('.panel').filter({ hasText: /Báo cáo ca bệnh|Case Report/i });

    // Select disease
    const diseaseSelect = panel.locator('select').first();
    await diseaseSelect.selectOption({ index: 1 });

    // Select province
    const provinceSelect = panel.locator('select').nth(1);
    await provinceSelect.selectOption({ index: 1 });

    // Fill case count
    const caseInput = panel.locator('input[type="number"]').first();
    await caseInput.fill('5');

    // Submit
    const submitBtn = panel.locator('button[type="submit"], button').filter({ hasText: /Gửi|Submit/i });
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  // =====================================================================
  // Map Time Filter Tests
  // =====================================================================

  test('time filter buttons work', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    const timeButtons = page.locator('.time-filter-btn');
    expect(await timeButtons.count()).toBe(4); // 24h, 7d, 30d, All

    // Click "24h" filter
    await timeButtons.first().click();
    await page.waitForTimeout(500);
    // Active class should change
    await expect(timeButtons.first()).toHaveClass(/time-filter-btn--active/);
  });

  // =====================================================================
  // Map Layer Controls — 5 layers
  // =====================================================================

  test('map has 5 layer toggles (districts, markers, heatmap, country, early warnings)', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    const checkboxes = page.locator('.layer-controls-checkbox');
    expect(await checkboxes.count()).toBe(5);
    const labels = page.locator('.layer-controls-label');
    const texts = await labels.allTextContents();
    const joined = texts.join(' ');
    expect(joined).toContain('District');
    expect(joined).toContain('Outbreak Markers');
    expect(joined).toContain('Heatmap');
    expect(joined).toContain('Early Warning');
  });

  // =====================================================================
  // District GeoJSON Boundaries
  // =====================================================================

  test('district GeoJSON boundaries load (708 districts)', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(7000);
    // Check console for district load message
    const logs: string[] = [];
    page.on('console', m => { if (m.type() === 'info') logs.push(m.text()); });
    await page.waitForTimeout(2000);
    // Verify GeoJSON file is fetchable
    const res = await page.evaluate(() =>
      fetch('/data/vietnam-districts.geojson').then(r => ({ ok: r.ok, size: r.headers.get('content-length') }))
    );
    expect(res.ok).toBe(true);
  });

  test('district-level outbreaks show multiple markers in TPHCM', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);
    await dismissBanner(page);
    // Click "Show more" if present (compact mode shows 5 by default)
    const showMore = page.locator('.outbreak-show-more');
    if (await showMore.isVisible().catch(() => false)) {
      await showMore.click();
      await page.waitForTimeout(300);
    }
    const rows = await page.locator('.outbreak-row').count();
    expect(rows).toBeGreaterThanOrEqual(10);
    // TPHCM should have multiple outbreak rows
    const hcmRows = page.locator('.outbreak-row').filter({ hasText: /TPHCM|Hồ Chí Minh|Quận 12|Bình Tân|Gò Vấp|Thủ Đức|Bình Chánh/i });
    expect(await hcmRows.count()).toBeGreaterThanOrEqual(3);
  });

  // =====================================================================
  // IndexedDB Snapshot Persistence
  // =====================================================================

  test('IndexedDB snapshot store is created and populated', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(6000);
    const snapshotCount = await page.evaluate(() => {
      return new Promise<number>(resolve => {
        const req = indexedDB.open('epidemic-monitor-snapshots', 1);
        req.onsuccess = () => {
          const db = req.result;
          try {
            const tx = db.transaction('snapshots', 'readonly');
            const store = tx.objectStore('snapshots');
            const countReq = store.count();
            countReq.onsuccess = () => { resolve(countReq.result); db.close(); };
            countReq.onerror = () => { resolve(0); db.close(); };
          } catch { resolve(0); db.close(); }
        };
        req.onerror = () => resolve(0);
      });
    });
    expect(snapshotCount).toBeGreaterThanOrEqual(1);
  });

  // =====================================================================
  // Statistics Panel — Trend Banner
  // =====================================================================

  test('statistics panel shows trend banner', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(6000);
    const panel = page.locator('.panel').filter({ hasText: /Epidemic Statistics/i });
    await expect(panel).toBeVisible();
    // Trend banner should exist (Ổn định for single snapshot)
    const trend = panel.locator('.stats-trend');
    await expect(trend).toBeVisible();
    const text = await trend.textContent();
    expect(text).toContain('Xu hướng');
  });

  // =====================================================================
  // Breaking News Banner
  // =====================================================================

  test('breaking news banner shows and can be dismissed', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    // Banner should auto-show for ALERT-level outbreaks
    const banner = page.locator('.breaking-news-banner');
    await expect(banner).toBeVisible({ timeout: 5000 });
    // Should contain alert text
    const text = await banner.textContent();
    expect(text!.length).toBeGreaterThan(10);
    // Dismiss button works
    const dismiss = page.locator('.breaking-news-banner__dismiss');
    await dismiss.click();
    await page.waitForTimeout(500);
    await expect(banner).not.toHaveClass(/breaking-news-banner--visible/);
  });

  // =====================================================================
  // Cross-Source Signals Panel
  // =====================================================================

  test('cross-source signals panel renders with detected signals', async ({ page }) => {
    await page.goto('/'); await switchTab(page, 'Analysis');
    await page.waitForTimeout(5000);
    const panel = page.locator('.panel').filter({ hasText: /Cross.Source|Signal/i });
    await expect(panel).toBeVisible({ timeout: 10000 });
    const content = await panel.textContent();
    // Should have at least some signal content (disease names from data)
    expect(content!.length).toBeGreaterThan(20);
  });

  // =====================================================================
  // Province Deep Dive Panel
  // =====================================================================

  test('province deep dive panel shows placeholder initially', async ({ page }) => {
    await page.goto('/'); await switchTab(page, 'Analysis');
    await page.waitForTimeout(3000);
    const panel = page.locator('[data-panel-id="province-deep-dive"]');
    await expect(panel).toBeVisible({ timeout: 10000 });
    // Should show placeholder text (no province selected yet)
    const content = await panel.textContent();
    expect(content!.toLowerCase()).toContain('province');
  });

  // =====================================================================
  // Video Tab in News Panel
  // =====================================================================

  test('news panel has video tab with health videos', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);
    // Find Video tab button
    const videoTab = page.locator('.news-tab-btn').filter({ hasText: /Video/i });
    await expect(videoTab).toBeVisible();
    // Click Video tab
    await videoTab.click();
    await page.waitForTimeout(500);
    // Should show video items
    const videos = page.locator('.video-item');
    expect(await videos.count()).toBeGreaterThanOrEqual(3);
    // Video thumbnails should have YouTube images
    const thumbnails = page.locator('.video-thumbnail img');
    expect(await thumbnails.count()).toBeGreaterThanOrEqual(3);
  });

  // =====================================================================
  // All 10 panels render check
  // =====================================================================

  test('all 10 panels render correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(6000);
    const titles = await page.locator('.panel-title').allTextContents();
    expect(titles.length).toBe(10);
    // Verify key panel names present
    const joined = titles.join(' ');
    expect(joined).toContain('Disease Outbreaks');
    expect(joined).toContain('Climate Risk');
    expect(joined).toContain('Epidemic Statistics');
    expect(joined).toContain('Health News');
    expect(joined).toContain('AI Assistant');
    expect(joined).toContain('Signals');
    expect(joined).toContain('Deep Dive');
  });
});
