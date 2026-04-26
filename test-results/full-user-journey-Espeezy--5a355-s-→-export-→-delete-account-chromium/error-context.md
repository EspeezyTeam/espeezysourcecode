# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-user-journey.spec.ts >> Espeezy — Full User Journey >> sign up → team → tasks → analytics → export → delete account
- Location: tests\full-user-journey.spec.ts:319:7

# Error details

```
Test timeout of 300000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator: locator('h1:has-text("Settings")')
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 20000ms
  - waiting for locator('h1:has-text("Settings")')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic:
    - generic [ref=e8]:
      - img [ref=e10]
      - heading "Welcome to Espeezy" [level=1] [ref=e13]
      - paragraph [ref=e14]: Lets set up your profile. What name should we show in the dashboard?
      - generic [ref=e15]:
        - generic [ref=e16]: YOUR FULL NAME
        - textbox "e.g. Alan Turing" [active] [ref=e17]
      - button "Continue" [disabled] [ref=e18]:
        - text: Continue
        - img [ref=e19]
    - generic [ref=e21]:
      - main [ref=e22]:
        - generic [ref=e24]: Loading settings...
      - generic [ref=e26] [cursor=pointer]:
        - img [ref=e27]
        - generic [ref=e31]: Connect Spotify
      - button "Open support chat" [ref=e32] [cursor=pointer]:
        - img [ref=e33]
  - img
```

# Test source

```ts
  321 |     if (SUPABASE_URL === 'https://mock.supabase.co') {
  322 |       await page.route('**/auth/v1/**', async (route) => {
  323 |         const url = route.request().url()
  324 |         if (url.includes('/user')) {
  325 |           await route.fulfill({
  326 |             status: 200,
  327 |             contentType: 'application/json',
  328 |             body: JSON.stringify({ id: 'mock-user-uuid', email: EMAIL, user_metadata: { full_name: 'Mock User' } })
  329 |           })
  330 |         } else if (url.includes('/token')) {
  331 |           await route.fulfill({
  332 |             status: 200,
  333 |             contentType: 'application/json',
  334 |             body: JSON.stringify({ access_token: 'mock-token', user: { id: 'mock-user-uuid' } })
  335 |           })
  336 |         } else {
  337 |           await route.fulfill({ status: 200, body: '{}' })
  338 |         }
  339 |       })
  340 | 
  341 |       await page.route('**/rest/v1/**', async (route) => {
  342 |         const method = route.request().method()
  343 |         if (method === 'GET') {
  344 |           await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  345 |         } else {
  346 |           await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' })
  347 |         }
  348 |       })
  349 |     }
  350 |     test.skip(!SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL is not defined. Please ensure .env.local exists.')
  351 | 
  352 | 
  353 |     // ── 1. CREATE USER (Admin API) + SIGN IN ───────────────────────
  354 |     console.log(`[1/10] Creating confirmed user via Supabase admin API: ${EMAIL}`)
  355 |     let createdUserId: string | null = null
  356 |     try {
  357 |       createdUserId = await adminCreateUser(EMAIL, PASSWORD, SCHOOL_ID)
  358 |       console.log(`      ✓ User created (id: ${createdUserId})`)
  359 |     } catch (err) {
  360 |       console.error(`      Admin API failed: ${err}`)
  361 |       console.log(`      Falling back to UI signup flow...`)
  362 |     }
  363 | 
  364 |     // Inject session cookies directly — bypasses Next.js Server Action (which hangs)
  365 |     const sessionData = await injectSession(context, EMAIL, PASSWORD)
  366 |     const userId = sessionData.user.id as string
  367 |     console.log(`      ✓ Session cookies injected (userId: ${userId})`)
  368 | 
  369 |     // ── Mock GET /auth/v1/user to avoid browser-side cold-start hang ─
  370 |     // The settings page (and others) call supabase.auth.getUser() which makes a
  371 |     // network request. On Supabase free tier this can hang for 30+ seconds.
  372 |     // We return the cached user object from our token response immediately.
  373 |     await page.route(`${SUPABASE_URL}/auth/v1/user`, async (route) => {
  374 |       if (route.request().method() === 'GET') {
  375 |         await route.fulfill({
  376 |           status: 200,
  377 |           contentType: 'application/json',
  378 |           body: JSON.stringify(sessionData.user),
  379 |         })
  380 |       } else {
  381 |         await route.continue()
  382 |       }
  383 |     })
  384 | 
  385 |     // ── Pre-populate profile to skip the onboarding modal ────────────
  386 |     // OnboardingWrapper shows the modal when avatar_url is null (trigger only sets full_name).
  387 |     // By setting both fields via Service Role API, the server-rendered page already has
  388 |     // a complete profile and the modal is never shown.
  389 |     const PRESET_AVATAR = 'https://api.dicebear.com/7.x/shapes/svg?seed=Avatar1&backgroundColor=1a73e8'
  390 |     const profilePatchRes = await safeFetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
  391 |       method: 'PATCH',
  392 |       headers: {
  393 |         'Content-Type': 'application/json',
  394 |         'apikey': SERVICE_ROLE_KEY,
  395 |         'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  396 |         'Prefer': 'return=minimal',
  397 |       },
  398 |       body: JSON.stringify({ full_name: FULL_NAME, avatar_url: PRESET_AVATAR }),
  399 |     })
  400 |     if (profilePatchRes.ok) {
  401 |       console.log(`      ✓ Profile pre-populated (full_name + avatar_url set to skip onboarding)`)
  402 |     } else {
  403 |       console.warn(`      Profile pre-populate failed: ${profilePatchRes.status} — ${await profilePatchRes.text()}`)
  404 |     }
  405 | 
  406 |     await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 45_000 })
  407 |     console.log(`      post-goto URL: ${page.url()}`)
  408 |     await waitForDashboard(page)
  409 |     await dismissDevOverlay(page)
  410 |     console.log(`[1/10] ✓ Signed in successfully (session injection)`)
  411 | 
  412 |     // ── 2. UPDATE PROFILE ───────────────────────────────────────────
  413 |     console.log(`[2/10] Updating profile settings`)
  414 |     await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' })
  415 |     await dismissDevOverlay(page)
  416 | 
  417 |     // Wait for settings URL in case there was a redirect
  418 |     await expect(page).toHaveURL(/\/dashboard\/settings/, { timeout: 10_000 })
  419 | 
  420 |     // Confirm Settings page loaded (profile pre-populated → no onboarding modal)
> 421 |     await expect(page.locator('h1:has-text("Settings")')).toBeVisible({ timeout: 20_000 })
      |                                                           ^ Error: expect(locator).toBeVisible() failed
  422 | 
  423 |     // Fill in Full Name
  424 |     const fullNameInput = page.locator('input[placeholder="Full Name"]')
  425 |     await fullNameInput.clear()
  426 |     await fullNameInput.fill(FULL_NAME)
  427 | 
  428 |     // Click Save / Update Settings
  429 |     await page.click('button:has-text("Update Settings")')
  430 |     await expect(page.locator('text=Profile Synchronized')).toBeVisible({ timeout: 10_000 })
  431 |     console.log(`[2/10] ✓ Profile updated`)
  432 | 
  433 |     // ── 3. CREATE TEAM ──────────────────────────────────────────────
  434 |     console.log(`[3/10] Creating team: ${TEAM_NAME}`)
  435 |     await page.goto('/dashboard/join', { waitUntil: 'domcontentloaded' })
  436 |     await dismissDevOverlay(page)
  437 |     await expect(page.locator('h2:has-text("Create Team")')).toBeVisible({ timeout: 15_000 })
  438 | 
  439 |     await page.fill('input[id="name"]', TEAM_NAME)
  440 |     await page.fill('input[id="module_code"]', MODULE_CODE)
  441 |     await page.fill('input[id="create_join_password"]', JOIN_PASSWORD)
  442 | 
  443 |     // Default capacity is 5 — accept it
  444 |     await page.click('button:has-text("Create Workspace")')
  445 | 
  446 |     // After creating the team, the user should be redirected to dashboard with the Kanban board
  447 |     await waitForDashboard(page)
  448 |     // Verify the team name appears in the header / sidebar
  449 |     await expect(page.locator(`text=${TEAM_NAME}`).first()).toBeVisible({ timeout: 15_000 })
  450 |     console.log(`[3/10] ✓ Team created: ${TEAM_NAME}`)
  451 | 
  452 |     // ── 4. CREATE 3 TASKS ───────────────────────────────────────────
  453 |     console.log(`[4/10] Creating ${TASKS.length} tasks on the Kanban board`)
  454 | 
  455 |     // Wait for Kanban to be ready (Liveblocks hydration)
  456 |     await expect(page.locator('[aria-label="Create a new task"]')).toBeVisible({ timeout: 20_000 })
  457 | 
  458 |     for (const task of TASKS) {
  459 |       console.log(`      Creating task: "${task.title}"`)
  460 |       await createTask(page, task.title, task.category, task.initialStatus)
  461 |       await page.waitForTimeout(800) // brief stabilisation between task creations
  462 |     }
  463 | 
  464 |     // Verify all 3 task titles visible on board
  465 |     for (const task of TASKS) {
  466 |       await expect(page.locator(`text=${task.title}`).first()).toBeVisible({ timeout: 15_000 })
  467 |     }
  468 |     console.log(`[4/10] ✓ All 3 tasks created`)
  469 | 
  470 |     // ── 5. MOVE TASKS THROUGH STATUSES ──────────────────────────────
  471 |     console.log(`[5/10] Updating task statuses`)
  472 | 
  473 |     // Move Alpha task → In Progress (click it, change status in modal, save)
  474 |     await page.click(`text=${TASKS[0].title}`)
  475 |     await expect(page.locator('.modal-content')).toBeVisible({ timeout: 8_000 })
  476 |     await page.locator('.modal-content select').nth(0).selectOption('In Progress')
  477 |     await page.click('button:has-text("Save Task")')
  478 |     await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 10_000 })
  479 |     console.log(`      ✓ Alpha Task → In Progress`)
  480 | 
  481 |     // Move Gamma task → Done
  482 |     await page.click(`text=${TASKS[2].title}`)
  483 |     await expect(page.locator('.modal-content')).toBeVisible({ timeout: 8_000 })
  484 |     await page.locator('.modal-content select').nth(0).selectOption('Done')
  485 |     await page.click('button:has-text("Save Task")')
  486 |     await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 10_000 })
  487 |     console.log(`      ✓ Gamma Task → Done`)
  488 |     console.log(`[5/10] ✓ Task statuses updated`)
  489 | 
  490 |     // ── 6. VIEW ANALYTICS PAGE & VERIFY KPIs ────────────────────────
  491 |     console.log(`[6/10] Navigating to analytics page`)
  492 |     await page.goto('/dashboard/analytics', { waitUntil: 'domcontentloaded' })
  493 |     await dismissDevOverlay(page)
  494 | 
  495 |     // Should redirect to /dashboard/analytics/<groupId>
  496 |     await expect(page).toHaveURL(/\/dashboard\/analytics\/[a-f0-9-]+/, { timeout: 15_000 })
  497 |     const analyticsUrl = page.url()
  498 |     console.log(`      Analytics URL: ${analyticsUrl}`)
  499 | 
  500 |     // Wait for page to finish loading (spinner disappears)
  501 |     await expect(page.locator('text=Retrieving project intelligence...')).not.toBeVisible({ timeout: 25_000 })
  502 | 
  503 |     // Verify KPI cards are visible
  504 |     await expect(page.locator('text=Project Progress')).toBeVisible({ timeout: 15_000 })
  505 |     await expect(page.locator('text=Completed Tasks')).toBeVisible({ timeout: 5_000 })
  506 | 
  507 |     // ── Verify task counts match what we created/moved ──
  508 |     // Expected: 1 Done (Gamma), 1 In Progress (Alpha), 1 To Do (Beta) = 3 total
  509 |     // KPI "Completed Tasks" shows `${doneTasks}/${tasks.length}` → "1/3"
  510 |     // Use getByText for exact matching of the value cell
  511 |     await expect(page.getByText('1/3')).toBeVisible({ timeout: 10_000 })
  512 |     console.log(`[6/10] ✓ Analytics KPIs verified: 1/3 tasks done`)
  513 | 
  514 |     // ── 7. EXPORT ANALYTICS CSV ─────────────────────────────────────
  515 |     console.log(`[7/10] Exporting analytics CSV`)
  516 | 
  517 |     // Set up download listener before clicking
  518 |     const downloadPromise = page.waitForEvent('download', { timeout: 20_000 })
  519 |     await page.click('button:has-text("CSV")')
  520 |     const download = await downloadPromise
  521 | 
```