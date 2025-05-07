document.addEventListener('DOMContentLoaded', function() {
  const extractBtn = document.getElementById('extractBtn');
  const addToExpenseBtn = document.getElementById('addToExpenseBtn');
  const transactionsBody = document.getElementById('transactionsBody');

  let currentTransactions = [];
  let expenseOptions = [];

  // Load saved state when popup opens
  chrome.storage.local.get(['transactions', 'expenseOptions'], function(result) {
    if (result.transactions) {
      currentTransactions = result.transactions;
      displayTransactions(result.transactions);
      addToExpenseBtn.disabled = false;
    }
    if (result.expenseOptions) {
      expenseOptions = result.expenseOptions;
    } else {
      // Initialize with default options if none exist
      expenseOptions = [
        { value: 'team-meals', label: 'Team Meals' },
        { value: 'travel-meals-individual', label: 'Travel Meals - Individual' },
        { value: 'travel-meals-group', label: 'Travel Meals - Group' }
      ];
      saveExpenseOptions(expenseOptions);
    }
  });

  // Save expense options to storage
  function saveExpenseOptions(options) {
    chrome.storage.local.set({ expenseOptions: options });
  }

  // Add new expense option
  function addExpenseOption(label) {
    const value = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newOption = { value, label };
    expenseOptions.push(newOption);
    saveExpenseOptions(expenseOptions);
    return newOption;
  }

  function displayTransactions(transactions) {
    const transactionsContainer = document.querySelector('.transactions-container');
    
    if (!transactions || transactions.length === 0) {
      transactionsContainer.innerHTML = `
        <div class="empty-state">
          <h2>Add transactions to expense</h2>
          <p>Go to <a href="#" class="rocket-money-link">Rocket Money transactions</a> and filter to the ones you want to expense, then click <strong>Get transactions</strong>.</p>
        </div>`;

      document.querySelector('.rocket-money-link').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.update({ url: 'https://app.rocketmoney.com/transactions' });
        window.close();
      });
      
      return;
    }

    transactionsContainer.innerHTML = `
      <div class="transactions-table">
        <div class="table-header">
          <div class="date-col">Date</div>
          <div class="memo-col">Memo</div>
          <div class="expense-col">Expense Item</div>
          <div class="amount-col">Amount</div>
          <div class="delete-col"></div>
        </div>
        <div class="table-body" id="transactionsBody"></div>
      </div>
    `;

    const transactionsBody = document.getElementById('transactionsBody');

    const transactionsHTML = transactions.map(transaction => {
      const date = new Date(transaction.date);
      const formattedDate = date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
      
      return `
        <div class="transaction-row" data-transaction-id="${transaction.id}">
          <div class="date-col">
            <input type="text" class="date-input" value="${formattedDate}" data-transaction-id="${transaction.id}" data-date="${date.toISOString()}" readonly>
          </div>
          <div class="memo-col">
            <input type="text" class="memo-input" value="${transaction.description}" data-transaction-id="${transaction.id}">
          </div>
          <div class="expense-col">
            <div class="expense-input-container">
              <input type="text" class="expense-input" data-transaction-id="${transaction.id}" value="${transaction.expenseLabel || ''}" placeholder="Select or type to create...">
              <div class="expense-dropdown"></div>
            </div>
          </div>
          <div class="amount-col">${transaction.amount}</div>
          <div class="delete-col">
            <button class="delete-btn" title="Delete transaction">
              <img src="icons/trash.svg" alt="Delete" class="delete-icon">
            </button>
          </div>
        </div>
      `;
    }).join('');

    transactionsBody.innerHTML = transactionsHTML;

    // Initialize datepickers
    document.querySelectorAll('.date-input').forEach(input => {
      const datepicker = new Datepicker(input, {
        format: 'D, M d',
        autohide: true,
        startDate: new Date(input.dataset.date),
        nextArrow: '<img src="icons/chevron-right.svg" alt="Next" class="datepicker-nav-icon">',
        prevArrow: '<img src="icons/chevron-left.svg" alt="Previous" class="datepicker-nav-icon">',
      });

      input.addEventListener('changeDate', (e) => {
        const date = e.detail.date;
        const transactionId = input.dataset.transactionId;
        const transaction = transactions.find(t => t.id === transactionId);
        if (transaction) {
          transaction.date = date.toISOString();
          input.dataset.date = date.toISOString();
          saveState(transactions);
        }
      });
    });

    // Initialize autocomplete for expense inputs
    document.querySelectorAll('.expense-input').forEach(input => {
      const dropdown = input.nextElementSibling;
      
      input.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const matchingOptions = expenseOptions
          .filter(option => option.label.toLowerCase().includes(searchTerm))
          .sort((a, b) => a.label.localeCompare(b.label));
        
        let dropdownHTML = '';
        
        // Add matching options
        if (matchingOptions.length > 0) {
          dropdownHTML = matchingOptions.map(option => `
            <div class="expense-option" data-value="${option.value}" data-label="${option.label}">
              <span class="option-label">${option.label}</span>
              <button class="delete-option-btn" title="Delete option">
                <img src="icons/trash.svg" alt="Delete" class="delete-icon">
              </button>
            </div>
          `).join('');
        }
        
        // Add Create option if there's text in the input and no exact match
        if (searchTerm && !expenseOptions.some(option => 
          option.label.toLowerCase() === searchTerm.toLowerCase()
        )) {
          dropdownHTML += `
            <div class="expense-option create-new" data-label="${input.value.trim()}">
              Create "${input.value.trim()}"
            </div>
          `;
        }
        
        dropdown.innerHTML = dropdownHTML;
        dropdown.style.display = dropdownHTML ? 'block' : 'none';
      });

      // Add keydown event listener for Enter key
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const searchTerm = input.value.trim();
          if (!searchTerm) return;

          const matchingOptions = expenseOptions.filter(option => 
            option.label.toLowerCase().includes(searchTerm.toLowerCase())
          );

          const transactionId = input.dataset.transactionId;
          const transaction = transactions.find(t => t.id === transactionId);

          if (matchingOptions.length > 0) {
            // Select the first matching option
            const firstOption = matchingOptions[0];
            if (transaction) {
              transaction.expenseType = firstOption.value;
              transaction.expenseLabel = firstOption.label;
              input.value = firstOption.label;
            }
          } else {
            // Create new option
            const newOption = addExpenseOption(searchTerm);
            if (transaction) {
              transaction.expenseType = newOption.value;
              transaction.expenseLabel = newOption.label;
              input.value = newOption.label;
            }
          }

          saveState(transactions);
          dropdown.style.display = 'none';
        }
      });
      
      input.addEventListener('focus', () => {
        // Store the current value to restore on blur
        input.dataset.selectedValue = input.value;
        // Clear the input to show all options
        input.value = '';
        
        const matchingOptions = expenseOptions
          .filter(option => option.label.toLowerCase().includes(''))
          .sort((a, b) => a.label.localeCompare(b.label));
        
        let dropdownHTML = '';
        
        // Add all options since search is empty
        if (matchingOptions.length > 0) {
          dropdownHTML = matchingOptions.map(option => `
            <div class="expense-option" data-value="${option.value}" data-label="${option.label}">
              <span class="option-label">${option.label}</span>
              <button class="delete-option-btn" title="Delete option">
                <img src="icons/trash.svg" alt="Delete" class="delete-icon">
              </button>
            </div>
          `).join('');
        }
        
        dropdown.innerHTML = dropdownHTML;
        dropdown.style.display = dropdownHTML ? 'block' : 'none';
      });
      
      input.addEventListener('blur', () => {
        // Delay hiding the dropdown to allow for option selection
        setTimeout(() => {
          dropdown.style.display = 'none';
          // Restore the selected value if no new option was selected
          if (input.dataset.selectedValue && !input.value) {
            input.value = input.dataset.selectedValue;
          }
          // Clear the stored value
          delete input.dataset.selectedValue;
        }, 200);
      });
      
      dropdown.addEventListener('click', (e) => {
        // Handle delete button clicks
        if (e.target.closest('.delete-option-btn')) {
          e.stopPropagation(); // Prevent the option click handler from firing
          const option = e.target.closest('.expense-option');
          const value = option.dataset.value;
          
          // Remove the option from expenseOptions
          expenseOptions = expenseOptions.filter(opt => opt.value !== value);
          saveExpenseOptions(expenseOptions);
          
          // Update the dropdown
          input.dispatchEvent(new Event('input'));
          return;
        }
        
        const option = e.target.closest('.expense-option');
        if (!option) return;
        
        const transactionId = input.dataset.transactionId;
        const transaction = transactions.find(t => t.id === transactionId);
        
        if (option.classList.contains('create-new')) {
          const newOption = addExpenseOption(option.dataset.label);
          if (transaction) {
            transaction.expenseType = newOption.value;
            transaction.expenseLabel = newOption.label;
            input.value = newOption.label;
          }
        } else {
          if (transaction) {
            transaction.expenseType = option.dataset.value;
            transaction.expenseLabel = option.dataset.label;
            input.value = option.dataset.label;
          }
        }
        
        saveState(transactions);
        dropdown.style.display = 'none';
      });
    });

    // Add change event listeners to all memo inputs
    document.querySelectorAll('.memo-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const transactionId = e.target.dataset.transactionId;
        const newDescription = e.target.value;
        
        const transaction = transactions.find(t => t.id === transactionId);
        if (transaction) {
          transaction.description = newDescription;
          saveState(transactions);
        }
      });
    });

    // Add click event listeners to all delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const row = e.target.closest('.transaction-row');
        const transactionId = row.dataset.transactionId;
        
        currentTransactions = currentTransactions.filter(t => t.id !== transactionId);
        saveState(currentTransactions);
        
        if (currentTransactions.length === 0) {
          displayTransactions([]);
          addToExpenseBtn.disabled = true;
        } else {
          row.remove();
        }
      });
    });
  }

  // Helper function to save state
  function saveState(transactions) {
    chrome.storage.local.set({
      transactions: transactions
    });
  }

  // Helper function to generate a UUID
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Extract transactions from Rocket Money
  async function extractTransactions() {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractTransactions'
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // Get default expense option
      const defaultOption = expenseOptions[0];

      // Add default expense type and label to each transaction
      const transactions = response.transactions.map(transaction => ({
        ...transaction,
        id: generateUUID(), // Add unique ID to each transaction
        expenseType: defaultOption.value,
        expenseLabel: defaultOption.label
      }));

      // Save and display transactions
      currentTransactions = transactions;
      saveState(transactions);
      displayTransactions(transactions);
      addToExpenseBtn.disabled = false;
    } catch (error) {
      transactionsBody.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    } finally {
      extractBtn.disabled = false;
    }
  }

  // Extract button click handler
  extractBtn.addEventListener('click', async () => {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('app.rocketmoney.com/transactions')) {
        alert('Go to Rocket Money transactions and filter to the ones you want to expense, then click Get transactions.');
        return;
      }

      extractBtn.disabled = true;
      transactionsBody.innerHTML = '<div class="loading">Extracting transactions...</div>';

      await extractTransactions();
    } catch (error) {
      transactionsBody.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    } finally {
      extractBtn.disabled = false;
    }
  });

  // Add To Expense Report button handler
  addToExpenseBtn.addEventListener('click', async () => {
    try {
      // Get the current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('Could not get current tab');
      }

      if (!tab.url.includes('myworkday.com')) {
        throw new Error('Please navigate to a Workday expense report page');
      }

      // Check if processing is already running
      const isProcessing = await chrome.tabs.sendMessage(tab.id, {
        action: 'checkProcessing'
      });

      if (isProcessing) {
        console.log('Transaction processing is already in progress');
        return;
      }

      // Store the transactions in chrome.storage so the content script can access them
      await chrome.storage.local.set({ pendingTransactions: currentTransactions });

      // Close the popup window before sending the message
      window.close();

      // Send message to content script after closing the popup
      chrome.tabs.sendMessage(tab.id, {
        action: 'addToWorkday',
        transactions: currentTransactions
      });
    } catch (error) {
      console.error('Error adding transactions to Workday:', error);
      
      // Check if the error is due to content script not being loaded
      if (error.message.includes('Receiving end does not exist')) {
        alert('Please refresh the Workday page and try again. The extension needs to be reloaded.');
      } else {
        alert('Error adding transactions to expense report: ' + error.message);
      }
    }
  });
}); 