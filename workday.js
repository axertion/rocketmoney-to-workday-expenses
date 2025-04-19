// Log when the content script is loaded
console.log('Workday content script loaded');

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message in Workday content script:', request);
  
  if (request.action === 'addToWorkday') {
    console.log('Starting to process transactions:', request.transactions);
    
    // Process each transaction one by one
    processTransactions(request.transactions)
      .then(() => {
        console.log('Successfully processed all transactions');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Error processing transactions:', error);
        sendResponse({ error: error.message });
      });
    return true; // Will respond asynchronously
  }
});

// Function to process all transactions
async function processTransactions(transactions) {
  console.log(`Processing ${transactions.length} transactions`);
  
  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i];
    console.log(`Processing transaction ${i + 1} of ${transactions.length}:`, transaction);
    
    try {
      // First, click the Add button to add a new expense line
      await clickAddButton();
      
      // Then fill in the transaction form
      await fillTransactionForm(transaction);
      
      console.log(`Successfully processed transaction ${i + 1}`);
      
      // Add a delay between transactions to allow the UI to update
      if (i < transactions.length - 1) {
        console.log('Waiting before processing next transaction...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`Error processing transaction ${i + 1}:`, error);
      throw new Error(`Failed to process transaction ${i + 1}: ${error.message}`);
    }
  }
  
  return true;
}

async function setNativeValue(element, value) {
  const lastValue = element.value;

  console.log('lastValue', lastValue);
  console.log('Setting native value', value);
  element.value = value;

  const event = new Event('input', { bubbles: true });
  // Hack React into noticing the change
  const tracker = element._valueTracker;
  if (tracker) {
    console.log('Setting value tracker');
    tracker.setValue(lastValue);
  }
  element.dispatchEvent(event);
}


// Function to click the Add button
async function clickAddButton() {
  try {
    console.log('Looking for Add button...');
    
    // Wait for the Add button to appear
    const addButton = await waitForElement('[data-automation-id="multiViewContainerAddButton"]');
    
    if (addButton) {
      console.log('Found Add button, clicking it...');
      addButton.click();
      console.log('Clicked Add button');
      
      // Wait for the form to appear
      console.log('Waiting for expense form to appear...');
      const formContainer = await waitForElement('[data-automation-id="inlineRowEditPage"]');
      console.log('Expense form appeared');
      
      // Wait for key form fields to be present
      console.log('Waiting for form fields to appear...');
      await waitForElement('[data-automation-id="dateSectionMonth-input"]');
      await waitForElement('[data-automation-id="monikerListSuggestionsInput"] input');
      await waitForElement('[data-automation-id="numericInput"]');
      console.log('All form fields appeared');
      
      // Add a small delay to ensure everything is fully loaded
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return true;
    } else {
      throw new Error('Could not find Add button');
    }
  } catch (error) {
    console.error('Error clicking Add button:', error);
    throw new Error(`Failed to click Add button: ${error.message}`);
  }
}

// Function to simulate typing in an input field
async function simulateTyping(input, value) {
  input.focus();
  input.select(); // highlight existing value
  for (let char of value) {
    const keyEvent = new KeyboardEvent('keydown', {
      key: char,
      bubbles: true,
    });
    input.dispatchEvent(keyEvent);

    input.value += char;

    const inputEvent = new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: char,
    });
    input.dispatchEvent(inputEvent);

    await new Promise(r => setTimeout(r, 50)); // slight delay between keystrokes
  }

  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
}

async function clickSelectedMenuItemToSave() {
  console.log('Looking for element with data-automation-id="multiViewListDetailItem" and data-automation-selected="true"');
  const selectedItem = document.querySelector('[data-automation-id="multiViewListDetailItem"][data-automation-selected="true"]');
  
  if (selectedItem) {
    console.log('Found selected item element');
    selectedItem.click();
    console.log('Clicked on selected item element');
  } else {
    console.log('Could not find selected item element');
    
    // Try to find the element with just the data-automation-id
    const listItem = document.querySelector('[data-automation-id="multiViewListDetailItem"]');
    if (listItem) {
      console.log('Found list item element without selected attribute');
      listItem.click();
      console.log('Clicked on list item element');
    } else {
      console.log('Could not find any list item elements');
    }
  }
}

async function fillTransactionForm(transaction) {
  try {
    console.log('Processing transaction:', transaction);
    
    // The form container should already be available from clickAddButton
    const formContainer = document.querySelector('[data-automation-id="inlineRowEditPage"]');
    if (!formContainer) {
      throw new Error('Expense form not found');
    }
    console.log('Using existing expense form');

    // Fill in the expense details
    const date = new Date(transaction.date);
    
    // Set the date (month, day, year)
    const monthInput = formContainer.querySelector('[data-automation-id="dateSectionMonth-input"]');
    const dayInput = formContainer.querySelector('[data-automation-id="dateSectionDay-input"]');
    const yearInput = formContainer.querySelector('[data-automation-id="dateSectionYear-input"]');

    if (!monthInput || !dayInput || !yearInput) {
      throw new Error('Could not find date input fields');
    }

    // Clear the inputs first
    monthInput.value = '';
    dayInput.value = '';
    yearInput.value = '';

    // Format the date values
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear().toString();

    // Simulate typing in each field
    console.log('Setting month:', month);
    await simulateTyping(monthInput, month);
    
    console.log('Setting day:', day);
    await simulateTyping(dayInput, day);
    
    console.log('Setting year:', year);
    await simulateTyping(yearInput, year);


    monthInput.dispatchEvent(new Event('blur', { bubbles: true }));
    dayInput.dispatchEvent(new Event('blur', { bubbles: true }));
    yearInput.dispatchEvent(new Event('blur', { bubbles: true }));


    
    console.log('Set date:', date.toISOString());

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Optionally click the calendar icon to trigger re-evaluation
    const calendarBtn = document.querySelector('[data-automation-id="datePickerButton"]');
    if (calendarBtn) {
      console.log('Clicking calendar button');
      calendarBtn.click();

    await new Promise(resolve => setTimeout(resolve, 1000));

    const selectedDay = await waitForElement('[data-automation-id="datePickerSelectedDay"]');
    if (selectedDay) {
      console.log('Found selected day element');
      selectedDay.click();
      console.log('Clicked on selected day element');
    }
    else {
        throw new Error('Could not find selected day element');
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    // Set the expense item (description)
    const expenseItemInput = formContainer.querySelector('[data-automation-id="monikerListSuggestionsInput"] input');
    if (!expenseItemInput) {
      throw new Error('Could not find expense item input');
    }
    
    // Add debugging event listeners to log key events
    const logKeyEvent = (event) => {
      console.log(`Key event on expense item input: ${event.type}`, {
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
        which: event.which,
        bubbles: event.bubbles,
        cancelable: event.cancelable
      });
    };

    expenseItemInput.addEventListener('keydown', logKeyEvent);
    expenseItemInput.addEventListener('keypress', logKeyEvent);
    expenseItemInput.addEventListener('keyup', logKeyEvent);
    
    // Try to find and select the "Travel - Other" option with retries
    let maxRetries = 3;
    let retryCount = 0;
    let travelOtherContainer = null;
    
    while (retryCount < maxRetries && !travelOtherContainer) {
      try {
        // Input "Travel" and trigger the search
        await inputExpenseItemAndSearch(expenseItemInput);
        
        // Wait for the "Travel - Other" radio button to appear
        travelOtherContainer = await waitForElement('[aria-label="Travel - Other radio button  unselected"]');
        console.log('Found "Travel - Other" container');
      } catch (error) {
        retryCount++;
        console.log(`Could not find "Travel - Other" container, retry ${retryCount} of ${maxRetries}`);
        
        if (retryCount < maxRetries) {
          console.log('Retrying expense item input operation...');
          // Wait a moment before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.log('Max retries reached, continuing without "Travel - Other" container');
        }
      }
    }
    
    // Find and select the radio button if the container was found
    if (travelOtherContainer) {
      const radioButton = travelOtherContainer.querySelector('[data-automation-id="radioBtn"]');
      if (radioButton) {
        radioButton.click();
        console.log('Selected "Travel - Other" radio button');
      } else {
        console.log('Could not find radio button inside "Travel - Other" container');
      }
    }


    // Set the amount (remove the $ symbol and convert to number)
    const amountInput = formContainer.querySelector('[data-automation-id="numericInput"]');
    if (!amountInput) {
      throw new Error('Could not find amount input');
    }
    const amount = transaction.amount.replace('$', '').trim();
    
    // Focus the input first
    amountInput.focus();
    
    // Set the value and trigger multiple events
    amountInput.value = amount;
    amountInput.dispatchEvent(new Event('input', { bubbles: true }));
    amountInput.dispatchEvent(new Event('change', { bubbles: true }));
    amountInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    console.log('Set amount:', amount);

    // Set the memo (optional)
    const memoLabel = Array.from(formContainer.querySelectorAll('[data-automation-id="formLabel"]'))
      .find(label => label.textContent.trim() === 'Memo');
    
    if (memoLabel) {
      console.log('Found memo label');
      console.log(memoLabel);
      
      const memoInputId = memoLabel.getAttribute('for');
      console.log('memoInputId', memoInputId);

      const memoInput = formContainer.querySelector(`[id="${memoInputId}"]`);
      console.log('memoInput', memoInput);
      
      if (memoInput) {
        // Focus the input first
        memoInput.focus();
        
        // Set the value and trigger multiple events
        memoInput.value = transaction.description;
        memoInput.dispatchEvent(new Event('input', { bubbles: true }));
        memoInput.dispatchEvent(new Event('change', { bubbles: true }));
        memoInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        console.log('Set memo:', transaction.description);
      } else {
        console.log(`Could not find memo input with ID ${memoInputId}`);
      }
    } else {
      console.log('Could not find memo label');
    }

    // Add a delay before looking for the selected item
    console.log('Waiting 2 seconds before looking for selected item...');
    await new Promise(resolve => setTimeout(resolve, 2000));


    // Click the selected menu item on the left to save
    clickSelectedMenuItemToSave();

    console.log('Form filled in successfully');
  } catch (error) {
    console.error('Error filling in transaction form:', error);
    throw new Error(`Failed to fill in transaction form: ${error.message}`);
  }
}

// Helper function to wait for an element to appear in the DOM
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkElement = () => {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`Found element: ${selector}`);
        resolve(element);
        return;
      }

      if (Date.now() - startTime >= timeout) {
        console.error(`Timeout waiting for element: ${selector}`);
        reject(new Error(`Timeout waiting for element: ${selector}`));
        return;
      }

      requestAnimationFrame(checkElement);
    };

    checkElement();
  });
}

// Function to input "Travel" and trigger the search
async function inputExpenseItemAndSearch(expenseItemInput) {
  // Step 1: Click on the search field input
  expenseItemInput.focus();
  expenseItemInput.click();
  console.log('Clicked on expense item search field');
  
  // Step 2: Input the value "Travel" and hit enter
  expenseItemInput.value = "Travel";
  expenseItemInput.dispatchEvent(new Event('input', { bubbles: true }));
  
  // Add a delay to allow the input to register
  console.log('Waiting before triggering Enter key...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Ensure the input is focused before hitting Enter
  expenseItemInput.focus();
  console.log('Ensured expense item input is focused');
  
  // Simulate a complete key press sequence for Enter/Return
  // This is a more comprehensive approach that mimics a real user interaction
  
  // 1. First, dispatch a keydown event
  const keydownEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  });
  expenseItemInput.dispatchEvent(keydownEvent);
  console.log('Dispatched keydown event for Enter');
  
  // 2. Then, dispatch a keypress event
  const keypressEvent = new KeyboardEvent('keypress', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  });
  expenseItemInput.dispatchEvent(keypressEvent);
  console.log('Dispatched keypress event for Enter');
  
  // 3. Finally, dispatch a keyup event
  const keyupEvent = new KeyboardEvent('keyup', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  });
  expenseItemInput.dispatchEvent(keyupEvent);
  console.log('Dispatched keyup event for Enter');
  
  // 4. Also try the Return key sequence (for Mac)
  const returnKeydownEvent = new KeyboardEvent('keydown', {
    key: 'Return',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  });
  expenseItemInput.dispatchEvent(returnKeydownEvent);
  console.log('Dispatched keydown event for Return');
  
  const returnKeypressEvent = new KeyboardEvent('keypress', {
    key: 'Return',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  });
  expenseItemInput.dispatchEvent(returnKeypressEvent);
  console.log('Dispatched keypress event for Return');
  
  const returnKeyupEvent = new KeyboardEvent('keyup', {
    key: 'Return',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true
  });
  expenseItemInput.dispatchEvent(returnKeyupEvent);
  console.log('Dispatched keyup event for Return');
  
  // 5. Try to find and click a search button if it exists
  const searchButton = expenseItemInput.closest('[data-automation-id="inlineRowEditPage"]').querySelector('[data-automation-id="searchButton"]');
  if (searchButton) {
    searchButton.click();
    console.log('Clicked search button');
  }
  
  console.log('Entered "Travel" and attempted to trigger Enter/Return key sequence');
  
  // Add a longer delay to allow the UI to respond
  await new Promise(resolve => setTimeout(resolve, 2000));
} 