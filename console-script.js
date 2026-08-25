const TIMEOUT = 15000;

// Resolves true when the text shows up, false if it never does. Without the
// timeout a single missed transient ("Saving…" can come and go inside one
// polling tick) leaves the script waiting forever with no output.
async function waitForTextToAppear(text, elementType = 'div', timeout = TIMEOUT) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const element = Array.from(document.querySelectorAll(elementType))
                    .find(el => el.textContent === text);
      if (element) {
        clearInterval(interval);
        resolve(true);
        return;
      }
      if (Date.now() - startedAt > timeout) {
        clearInterval(interval);
        console.warn(`Timed out waiting for "${text}" to appear`);
        resolve(false);
      }
    }, 100);
  });
}

async function waitForTextToDisappear(text, elementType = 'div', timeout = TIMEOUT) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const element = Array.from(document.querySelectorAll(elementType))
                    .find(el => el.textContent === text);
      if (!element) {
        clearInterval(interval);
        resolve(true);
        return;
      }
      if (Date.now() - startedAt > timeout) {
        clearInterval(interval);
        console.warn(`Timed out waiting for "${text}" to disappear`);
        resolve(false);
      }
    }, 100);
  });
}

// Google Maps stops building the place panel while the tab is in the
// background: the Save button is not hidden, it is absent from the DOM. Every
// place then fails and the log gives no hint why, so pause instead.
async function waitForForeground() {
  if (!document.hidden) return;
  console.log('Tab is in the background — paused. Switch back to Maps to resume.');
  while (document.hidden) await delay(1000);
  await delay(2500);
  console.log('Resuming');
}

async function delay(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

function clickSaveButton() {
  // data-value is not always present on the Save button; fall back to the
  // accessible name before giving up.
  const saveButton = document.querySelector('[data-value*="Save"]')
    || Array.from(document.querySelectorAll('button,[role="button"]'))
        .find(b => b.getClientRects().length > 0
                && /^save$|^saved$/i.test((b.getAttribute('aria-label') || b.textContent || '').trim()));
  if (!saveButton) {
    console.log('Save button not found');
    return false;
  }

  console.log('Found save button:', saveButton);

  saveButton.click();
  console.log('Clicked save button');
  return true;
}

// A list entry reads "Want to go" on its own, but can also carry its sharing
// state and place count in the same text node ("Want to goShared·128 places"),
// so an equality check silently finds nothing.
function findListEntry(listName, checked) {
  return Array.from(document.querySelectorAll(`[aria-checked="${checked}"] div`))
    .find(el => (el.textContent || '').trim().startsWith(listName));
}

async function processRestaurant(restaurant) {
  await waitForForeground();
  console.log('Processing restaurant:', restaurant);

  const button = restaurant.parentElement.parentElement.previousSibling;
  if (!button) {
    console.log('Button not found');
    return;
  }

  console.log('Found button:', button);

  const categorySpan = button.querySelector('.fontBodyMedium > div:last-child > div:last-child span:last-child');
  if (!categorySpan) {
    console.log('Category span not found');
    return;
  }

  console.log('Found category span:', categorySpan);

  const restaurantNameElement = button.querySelector('.fontHeadlineSmall');
  if (!restaurantNameElement) {
    console.log('Restaurant name element not found');
    return;
  }

  console.log('Found restaurant name element:', restaurantNameElement);

  button.click();
  console.log('Clicked button');
  await delay(250);

  const restaurantName = restaurantNameElement.textContent;
  console.log('Restaurant name:', restaurantName);

  await waitForTextToAppear(restaurantName, 'h1');
  console.log('H1 element found');
  await delay(250);

  clickSaveButton();
  await delay(250);

  const wantToGoElement = findListEntry('Want to go', 'true');
  if (wantToGoElement) {
    console.log('Found "Want to go" element:', wantToGoElement);

    wantToGoElement.parentElement.click();
    console.log('Clicked "Want to go" element');
    await delay(250);

    await waitForTextToAppear('Removing…');
    console.log('Removing…');
    await delay(250);

    await waitForTextToDisappear('Removing…');
    console.log('Removed from Want to go');
    await delay(250);
  }

  const category = categorySpan.textContent.trim().replace('· ', '');
  console.log('Category:', category);

  const targetCategories = {
    'Cafe': 'Coffee',
    'Coffee shop': 'Coffee', 
    'Coffee': 'Coffee',
    'Espresso bar': 'Coffee',
    'Tea house': 'Tea',
    'Tea shop': 'Tea',
    'Tea store': 'Tea',
    'Chinese tea house': 'Tea',
    'Bakery': 'Bakery',
    'Pastry shop': 'Bakery',
    'Dessert': 'Dessert',
    'Dessert shop': 'Dessert',
    'Dessert restaurant': 'Dessert',
    'Japanese sweets restaurant': 'Dessert',
  };

  const targetCategory = targetCategories[category] || 'Food';
  console.log('Target category:', targetCategory);

  if(!category.includes('closed')) {
    clickSaveButton();
    await delay(250);

    const targetElement = findListEntry(targetCategory, 'false');
    if (!targetElement) {
      console.log('Target element not found');
      return;
    }

    console.log('Found target element:', targetElement);

    targetElement.parentElement.click();
    console.log(`Clicked ${targetCategory}`);
    await delay(250);

    await waitForTextToAppear('Saving…');
    console.log('Saving…');
    await delay(250);

    await waitForTextToDisappear('Saving…');
    console.log(`Saved to ${targetCategory}`);
  }
  await delay(250);
}

// Run stopRpa() in the console to stop after the current place.
window.stopRpa = () => { window.__stopRpa = true; console.log('Stopping after the current place'); };

async function processRestaurants() {
  window.__stopRpa = false;

  while (!window.__stopRpa) {
    await waitForForeground();

    const restaurants = document.querySelectorAll('[aria-label="Add note"]');
    console.log('Found restaurants:', restaurants.length);

    const next = Array.from(restaurants).find(restaurant => {
      const card = restaurant.parentElement.parentElement.previousSibling;
      if (!card) return false;
      const isBroken = Array.from(card.querySelectorAll('img'))
        .some(img => img.src === 'https://maps.gstatic.com/tactile/pane/result-no-thumbnail-2x.png');
      return !isBroken;
    });

    // Previously this function called itself unconditionally, so an empty or
    // fully-broken list recursed forever and the run never ended.
    if (!next) {
      console.log('Nothing left to process');
      return;
    }

    await processRestaurant(next);
  }
}

processRestaurants();
