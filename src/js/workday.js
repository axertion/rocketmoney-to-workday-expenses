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

  if (request.action === 'checkProcessing') {
    sendResponse(window.isProcessingTransactions || false);
    return false; // Synchronous response
  }
});

// Function to process all transactions
async function processTransactions(transactions) {
  // Check if processing is already running
  if (window.isProcessingTransactions) {
    console.log('Transaction processing is already in progress');
    return;
  }

  // Set the flag to indicate processing has started
  window.isProcessingTransactions = true;

  console.log(`Processing ${transactions.length} transactions`);

  // Create and show the overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background-color: white;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    font-size: 16px;
    color: #333;
    min-width: 300px;
  `;

  const message = document.createElement('div');
  message.textContent = 'Adding transactions to expense report...';
  message.style.marginBottom = '16px';

  const progressContainer = document.createElement('div');
  progressContainer.style.cssText = `
    width: 100%;
    height: 4px;
    background-color: #e0e0e0;
    border-radius: 2px;
    margin-bottom: 8px;
    overflow: hidden;
  `;

  const progressBar = document.createElement('div');
  progressBar.style.cssText = `
    width: 0%;
    height: 100%;
    background-color: #4CAF50;
    transition: width 0.3s ease;
  `;

  const progressText = document.createElement('div');
  progressText.style.cssText = `
    font-size: 14px;
    color: #666;
    text-align: center;
  `;
  progressText.textContent = `0 of ${transactions.length} completed`;

  const doneButton = document.createElement('button');
  doneButton.style.cssText = `
    display: none;
    padding: 8px 24px;
    border-radius: 24px;
    font-size: 14px;
    font-weight: 500;
    height: 40px;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    background-color: #000;
    color: white;
    width: 100%;
  `;
  doneButton.textContent = 'Done';
  doneButton.onclick = () => {
    overlay.remove();
    window.isProcessingTransactions = false;
  };

  const cancelButton = document.createElement('button');
  cancelButton.style.cssText = `
    padding: 8px 24px;
    border-radius: 24px;
    font-size: 14px;
    font-weight: 500;
    height: 40px;
    border: 1px solid #e0e0e0;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    background-color: white;
    color: #333;
    width: 100%;
    margin-top: 8px;
  `;
  cancelButton.textContent = 'Cancel';
  cancelButton.onclick = () => {
    overlay.remove();
    window.isProcessingTransactions = false;
    // Throw an error to stop the processing
    throw new Error('Processing cancelled by user');
  };

  progressContainer.appendChild(progressBar);
  modal.appendChild(message);
  modal.appendChild(progressContainer);
  modal.appendChild(progressText);
  modal.appendChild(cancelButton);
  modal.appendChild(doneButton);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  try {
    await clickEditExpenseReportButton();
    
    for (let i = 0; i < transactions.length; i++) {
      // Check if processing was cancelled
      if (!window.isProcessingTransactions) {
        console.log('Transaction processing was cancelled');
        throw new Error('Processing cancelled by user');
      }

      const transaction = transactions[i];
      console.log(`Processing transaction ${i + 1} of ${transactions.length}:`, transaction);
      
      try {
        // First, click the Add button to add a new expense line
        await clickAddButton();
        
        // Check if processing was cancelled before filling form
        if (!window.isProcessingTransactions) {
          throw new Error('Processing cancelled by user');
        }
        
        // Then fill in the transaction form
        await fillTransactionForm(transaction);
        
        console.log(`Successfully processed transaction ${i + 1}`);
        
        // Update progress
        const progress = ((i + 1) / transactions.length) * 100;
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${i + 1} of ${transactions.length} completed`;
        
        // Add a delay between transactions to allow the UI to update
        if (i < transactions.length - 1) {
          console.log('Waiting before processing next transaction...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`Error processing transaction ${i + 1}:`, error);
        throw error; // Re-throw to stop processing
      }
    }
    
    // Show success state
    message.textContent = `${transactions.length} transactions successfully added`;
    message.style.cssText = `
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 8px;
      color: #333;
    `;
    
    const successMessage = document.createElement('div');
    successMessage.style.cssText = `
      font-size: 14px;
      color: #666;
      margin-bottom: 16px;
      text-align: center;
    `;
    successMessage.textContent = 'Review everything to make sure it looks good, then submit your expense report.';
    
    // Hide progress elements and cancel button
    progressContainer.style.display = 'none';
    progressText.style.display = 'none';
    cancelButton.style.display = 'none';
    
    // Show done button
    doneButton.style.display = 'block';
    
    // Insert success message before the done button
    modal.insertBefore(successMessage, doneButton);
    
    return true;
  } catch (error) {
    // Remove the overlay in case of error
    overlay.remove();
    window.isProcessingTransactions = false;
    throw error;
  }
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

async function clickEditExpenseReportButton() {
  try {
    console.log('Looking for Edit Expense Report button...');
    
    // Wait for the Add button to appear
    const editButton = await waitForElement('[title="Edit Expense Report"]');
    
    if (editButton) {
      console.log('Found Edit Expense Report button, clicking it...');
      editButton.click();
      console.log('Clicked Edit button');
      
      // Add a small delay to ensure everything is fully loaded
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return true;
    } else {

    }
  } catch (error) {
    console.error('Error clicking Edit button:', error);
    throw new Error(`Failed to click Edit button: ${error.message}`);
  }
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


async function fillExpenseDateInput(formContainer, transaction) {
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
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Wait for either the selected day or selected today element
  try {
    console.log('Looking for selected day element...');
    const selectedDay = await waitForElement(
      '[data-automation-id="datePickerSelectedDay"]',
      10000,
      '[data-automation-id="datePickerSelectedToday"]'
    );
    
    if (selectedDay) {
      console.log('Found selected day element:', selectedDay.getAttribute('data-automation-id'));
      selectedDay.click();
      console.log('Clicked selected day');
    } else {
      console.log('Could not find selected day element');
    }
  } catch (error) {
    console.error('Error handling date selection:', error);
    // Continue even if we can't find the element, as the date might still be set correctly
  }
}

async function fillExpenseItemInput(formContainer, transaction) {
  // Set the expense item (description)
  const expenseItemInput = formContainer.querySelector('[data-automation-id="monikerListSuggestionsInput"] input');
  if (!expenseItemInput) {
    throw new Error('Could not find expense item input');
  }

  // Try to find and select the expense item with retries
  let maxRetries = 3;
  let retryCount = 0;
  let expenseItemContainer = null;

  while (retryCount < maxRetries && !expenseItemContainer) {
    try {
      // Input the expense label and trigger the search
      await inputExpenseItemAndSearch(expenseItemInput, transaction.expenseLabel);
      
      // Check if "No matches found" message exists
      const noMatchesElement = document.querySelector('[data-automation-id="promptTitle"][title="No matches found"]');
      if (noMatchesElement) {
        console.log(`No matches found for "${transaction.expenseLabel}", skipping expense item selection`);
        return; // Skip expense item selection and continue with next field
      }
      
      // Wait for the specific expense item radio button to appear
      expenseItemContainer = await waitForElement(
        `[data-automation-label="${transaction.expenseLabel}"]`,
        5000
      );
      
      console.log(`Found expense item container for "${transaction.expenseLabel}"`);
    } catch (error) {
      retryCount++;
      console.log(`Could not find expense item container, retry ${retryCount} of ${maxRetries}`);
      
      if (retryCount < maxRetries) {
        console.log('Retrying expense item input operation...');
        // Wait a moment before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        throw new Error(`Failed to find expense item radio button for "${transaction.expenseLabel}" after ${maxRetries} attempts`);
      }
    }
  }

  // Click the radio button if found
  if (expenseItemContainer) {
    expenseItemContainer.click();
    console.log(`Selected "${transaction.expenseLabel}" radio button`);

    console.log('Waiting for 1 second before selecting radio button');
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      await waitForElement(
        `[data-automation-label="${transaction.expenseLabel}"]`,
        5000
      );
    } catch (error) {
      console.error(`Error waiting for selected option: [data-automation-label="${transaction.expenseLabel}"]`);
    }
  }
}

async function fillAmountInput(formContainer, transaction) {
  console.log('Filling amount input');

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
}

async function fillMemoInput(formContainer, transaction) {
  console.log('Filling memo input');

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
    await fillExpenseDateInput(formContainer, transaction);
    await fillExpenseItemInput(formContainer, transaction);
    await fillAmountInput(formContainer, transaction);
    await fillMemoInput(formContainer, transaction);

    console.log('Waiting 1 second before clicking save');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Click the selected menu item on the left to save
    clickSelectedMenuItemToSave();

    console.log('Form filled in successfully');
  } catch (error) {
    console.error('Error filling in transaction form:', error);
    throw new Error(`Failed to fill in transaction form: ${error.message}`);
  }
}

// Helper function to wait for an element to appear in the DOM
function waitForElement(selector, timeout = 10000, alternateSelector = null) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkElement = () => {
      // Check for primary selector
      const element = document.querySelector(selector);
      if (element) {
        console.log(`Found element: ${selector}`);
        resolve(element);
        return;
      }

      // If alternate selector is provided, check for it
      if (alternateSelector) {
        const alternateElement = document.querySelector(alternateSelector);
        if (alternateElement) {
          console.log(`Found alternate element: ${alternateSelector}`);
          resolve(alternateElement);
          return;
        }
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

// Function to input expense item and trigger the search
async function inputExpenseItemAndSearch(expenseItemInput, searchText) {
  // Step 1: Click on the search field input
  expenseItemInput.focus();
  expenseItemInput.click();
  console.log('Clicked on expense item search field');
  
  // Step 2: Input the search text and hit enter
  console.log('Inputting search text:', searchText);
  expenseItemInput.value = searchText;
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
  
  // // 2. Then, dispatch a keypress event
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
  
  // // 3. Finally, dispatch a keyup event
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
  
  // // 4. Also try the Return key sequence (for Mac)
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
  
  console.log(`Entered "${searchText}" and attempted to trigger Enter/Return key sequence`);
  
  // Add a longer delay to allow the UI to respond
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function addToWorkday(transactions) {
  try {
    // Wait for the expense report page to load
    await waitForExpenseReportPage();

    // Click the "Add Expense" button
    const addExpenseButton = await waitForElement('button[data-automation-id="addExpenseButton"]');
    addExpenseButton.click();

    // Process each transaction
    for (const transaction of transactions) {
      // Wait for the expense form to load
      await waitForElement('div[data-automation-id="expenseForm"]');

      // Fill in the expense form
      await fillExpenseForm(transaction);

      // Click the Save button
      const saveButton = await waitForElement('button[data-automation-id="saveButton"]');
      saveButton.click();

      // Wait for the save to complete
      await waitForElement('div[data-automation-id="expenseItem"]');
    }

    return { success: true };
  } catch (error) {
    throw error;
  }
} 