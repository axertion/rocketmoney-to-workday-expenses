document.addEventListener('DOMContentLoaded', function() {
  const extractBtn = document.getElementById('extractBtn');
  const addToExpenseBtn = document.getElementById('addToExpenseBtn');
  const transactionsBody = document.getElementById('transactionsBody');

  let currentTransactions = [];

  // Load saved state when popup opens
  chrome.storage.local.get(['transactions'], function(result) {
    if (result.transactions) {
      currentTransactions = result.transactions;
      displayTransactions(result.transactions);
      addToExpenseBtn.disabled = false;
    }
  });

  // Get expense type options
  function getExpenseOptions() {
    return [
      {
        value: 'team-meals',
        label: 'Team Meals'
      },
      {
        value: 'travel-meals-individual',
        label: 'Travel Meals - Individual'
      },
      {
        value: 'travel-meals-group',
        label: 'Travel Meals - Group'
      },
    ];
  }

  function displayTransactions(transactions) {
    const transactionsContainer = document.querySelector('.transactions-container');
    
    if (!transactions || transactions.length === 0) {
      transactionsContainer.innerHTML = `
        <div class="empty-state">
          <h2>Add transactions to expense</h2>
          <p>Go to <a href="#" class="rocket-money-link">Rocket Money transactions</a> and filter to the ones you want to expense, then click <strong>Get transactions</strong>.</p>
        </div>`;

      // Add click handler for the Rocket Money link
      document.querySelector('.rocket-money-link').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.update({ url: 'https://app.rocketmoney.com/transactions' });
        window.close(); // Close the popup after navigation
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
    const expenseOptions = getExpenseOptions();
    const optionsHtml = expenseOptions
      .map(option => `<option value="${option.value}">${option.label}</option>`)
      .join('');

    const transactionsHTML = transactions.map(transaction => {
      const date = new Date(transaction.date);
      const formattedDate = date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
      
      // Create options HTML with selected state
      const optionsWithSelection = expenseOptions
        .map(option => `<option value="${option.value}" ${transaction.expenseType === option.value ? 'selected' : ''}>${option.label}</option>`)
        .join('');
      
      return `
        <div class="transaction-row" data-transaction-id="${transaction.id}">
          <div class="date-col">
            <input type="text" class="date-input" value="${formattedDate}" data-transaction-id="${transaction.id}" data-date="${date.toISOString()}" readonly>
          </div>
          <div class="memo-col">
            <input type="text" class="memo-input" value="${transaction.description}" data-transaction-id="${transaction.id}">
          </div>
          <div class="expense-col">
            <select class="expense-select" data-transaction-id="${transaction.id}">
              ${optionsWithSelection}
            </select>
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

    // Add change event listeners to all memo inputs
    document.querySelectorAll('.memo-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const transactionId = e.target.dataset.transactionId;
        const newDescription = e.target.value;
        
        // Find and update the transaction in our dataset
        const transaction = transactions.find(t => t.id === transactionId);
        if (transaction) {
          transaction.description = newDescription;
          
          // Save the updated transactions to storage
          saveState(transactions);
        }
      });
    });

    // Add change event listeners to all expense select dropdowns
    document.querySelectorAll('.expense-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const transactionId = e.target.dataset.transactionId;
        const selectedValue = e.target.value;
        const selectedOption = e.target.options[e.target.selectedIndex];
        const selectedLabel = selectedOption.text;
        
        // Find and update the transaction in our dataset
        const transaction = transactions.find(t => t.id === transactionId);
        if (transaction) {
          transaction.expenseType = selectedValue;
          transaction.expenseLabel = selectedLabel;
          
          // Save the updated transactions to storage
          saveState(transactions);
        }
      });
    });

    // Add click event listeners to all delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const row = e.target.closest('.transaction-row');
        const transactionId = row.dataset.transactionId;
        
        // Remove the transaction from our dataset
        currentTransactions = currentTransactions.filter(t => t.id !== transactionId);
        
        // Save the updated transactions to storage
        saveState(currentTransactions);
        
        // Check if this was the last transaction
        if (currentTransactions.length === 0) {
          displayTransactions([]); // Show empty state
          addToExpenseBtn.disabled = true;
        } else {
          // Just remove the row
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
      const defaultOption = getExpenseOptions()[0];

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