async function waitForTextToAppear(text, elementType = 'div') {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const element = Array.from(document.querySelectorAll(elementType))
                    .find(el => el.textContent === text);
      if (element) {
        clearInterval(interval);
        resolve();
        return;
      }
    }, 100);
  });
}

async function waitForTextToDisappear(text, elementType = 'div') {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const element = Array.from(document.querySelectorAll(elementType))
                    .find(el => el.textContent === text);
      if (!element) {
        clearInterval(interval);
        resolve();
        return;
      }
    }, 100);
  });
}

async function delay(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

function clickSaveButton() {
  const saveButton = document.querySelector('[data-value*="Save"]');
  if (!saveButton) {
    console.log('Save button not found');
    return;
  }

  console.log('Found save button:', saveButton);

  saveButton.click();
  console.log('Clicked save button');
}

async function processRestaurant(restaurant) {
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

  const wantToGoElement = Array.from(document.querySelectorAll('[aria-checked="true"] div'))
                    .find(el => el.textContent === 'Want to go');
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

    const targetElement = Array.from(document.querySelectorAll('[aria-checked="false"] div'))
                      .find(el => el.textContent === targetCategory);
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

async function processRestaurants() {
  const restaurants = document.querySelectorAll('[aria-label="Add note"]');
  console.log('Found restaurants:', restaurants.length);

  for (const restaurant of restaurants) {
    const isBroken = Array.from(restaurant.parentElement.parentElement.previousSibling.querySelectorAll('img'))
    .some(img => img.src === 'https://maps.gstatic.com/tactile/pane/result-no-thumbnail-2x.png');

    if (isBroken) {
      continue;
    } else {
      await processRestaurant(restaurant);
      break;
    }
  }

  processRestaurants();
}

processRestaurants();
