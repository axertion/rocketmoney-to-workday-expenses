document.addEventListener('DOMContentLoaded', function() {
  const extractBtn = document.getElementById('extractBtn');
  const addToExpenseBtn = document.getElementById('addToExpenseBtn');
  const transactionsContainer = document.getElementById('transactions');

  let currentTransactions = [];
  let expenseOptions = [];

  // Add confirmation modal HTML to the document
  const modalHTML = `
    <div id="deleteAllModal" class="modal" style="display: none;">
      <div class="modal-content">
        <h2>Delete all transactions</h2>
        <p>Are you sure you want to delete all transactions? This action cannot be undone.</p>
        <div class="modal-buttons">
          <button id="cancelDeleteAll" class="button secondary">Cancel</button>
          <button id="confirmDeleteAll" class="button danger">Delete All</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Get modal elements
  const modal = document.getElementById('deleteAllModal');
  const confirmDeleteBtn = document.getElementById('confirmDeleteAll');
  const cancelDeleteBtn = document.getElementById('cancelDeleteAll');

  // Modal event handlers
  confirmDeleteBtn.addEventListener('click', () => {
    currentTransactions = [];
    saveState(currentTransactions);
    displayTransactions([]);
    addToExpenseBtn.disabled = true;
    modal.style.display = 'none';
  });

  cancelDeleteBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  // Load saved state when popup opens
  chrome.storage.local.get(['transactions', 'expenseOptions'], function(result) {
    if (result.transactions && result.transactions.length > 0) {
      currentTransactions = result.transactions;
      displayTransactions(result.transactions);
      addToExpenseBtn.disabled = false;
    } else {
      displayTransactions([]);
      addToExpenseBtn.disabled = true;
    }
    if (result.expenseOptions) {
      expenseOptions = result.expenseOptions;
    } else {
      // Initialize with default options if none exist
      expenseOptions = [
        { value: 'travel-meals-individual', label: 'Travel Meals - Individual' },
        { value: 'travel-meals-group', label: 'Travel Meals - Group' },
        { value: 'travel-meals-group', label: 'Taxi/Uber/Train/Etc' }
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
          <div class="delete-col">
            <button class="delete-btn delete-all-btn" title="Delete all transactions">
              <img src="src/images/trash.svg" alt="Delete All" class="delete-icon">
            </button>
          </div>
        </div>
        <div class="table-body" id="transactionsBody"></div>
      </div>
    `;

    const transactionsBody = document.getElementById('transactionsBody');
    const transactionsTable = document.querySelector('.transactions-table');

    // Function to check if element has scrollbar
    function hasScrollbar(element) {
      return element.scrollHeight > element.clientHeight;
    }

    // Function to update scrollbar class
    function updateScrollbarClass() {
      if (hasScrollbar(transactionsBody)) {
        transactionsTable.classList.add('scrollbar-visible');
      } else {
        transactionsTable.classList.remove('scrollbar-visible');
      }
    }

    // Check initially
    updateScrollbarClass();

    // Check on window resize
    window.addEventListener('resize', updateScrollbarClass);

    // Check when content changes
    const observer = new ResizeObserver(updateScrollbarClass);
    observer.observe(transactionsBody);

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
              <img src="src/images/trash.svg" alt="Delete" class="delete-icon">
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
        nextArrow: '<img src="src/images/chevron-right.svg" alt="Next" class="datepicker-nav-icon">',
        prevArrow: '<img src="src/images/chevron-left.svg" alt="Previous" class="datepicker-nav-icon">',
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
      const dropdownPortal = document.getElementById('dropdownPortal');
      let dropdown = null;
      
      function createDropdown() {
        dropdown = document.createElement('div');
        dropdown.className = 'expense-dropdown';
        dropdownPortal.appendChild(dropdown);

        // Add click handler to dropdown
        dropdown.addEventListener('click', (e) => {
          // Handle delete button clicks
          if (e.target.closest('.delete-option-btn')) {
            e.stopPropagation();
            const option = e.target.closest('.expense-option');
            const value = option.dataset.value;
            
            expenseOptions = expenseOptions.filter(opt => opt.value !== value);
            saveExpenseOptions(expenseOptions);
            
            updateDropdownContent();
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
          hideDropdown();
        });

        return dropdown;
      }

      function updateDropdownPosition() {
        if (!dropdown) return;
        
        const inputRect = input.getBoundingClientRect();
        const portalRect = dropdownPortal.getBoundingClientRect();
        
        dropdown.style.position = 'fixed';
        dropdown.style.top = `${inputRect.bottom + 4}px`;
        dropdown.style.left = `${inputRect.left}px`;
        dropdown.style.width = `${inputRect.width}px`;
      }

      function showDropdown() {
        if (!dropdown) {
          dropdown = createDropdown();
        }
        updateDropdownPosition();
        dropdown.style.display = 'block';
      }

      function hideDropdown() {
        if (dropdown) {
          dropdown.style.display = 'none';
        }
      }

      function updateDropdownContent() {
        if (!dropdown) return;
        
        const searchTerm = input.value.toLowerCase();
        const matchingOptions = expenseOptions
          .filter(option => option.label.toLowerCase().includes(searchTerm))
          .sort((a, b) => a.label.localeCompare(b.label));
        
        let dropdownHTML = '';
        
        if (matchingOptions.length > 0) {
          dropdownHTML = matchingOptions.map(option => `
            <div class="expense-option" data-value="${option.value}" data-label="${option.label}">
              <span class="option-label">${option.label}</span>
              <button class="delete-option-btn" title="Delete option">
                <img src="src/images/trash.svg" alt="Delete" class="delete-icon">
              </button>
            </div>
          `).join('');
        }
        
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
      }
      
      input.addEventListener('input', (e) => {
        updateDropdownContent();
        showDropdown();
      });

      // Add keydown event listener for Enter key
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const searchTerm = input.value.trim();
          if (!searchTerm) return;

          // Get the first option from the dropdown
          const firstOption = dropdown?.querySelector('.expense-option');
          if (firstOption) {
            const transactionId = input.dataset.transactionId;
            const transaction = transactions.find(t => t.id === transactionId);

            if (firstOption.classList.contains('create-new')) {
              const newOption = addExpenseOption(firstOption.dataset.label);
              if (transaction) {
                transaction.expenseType = newOption.value;
                transaction.expenseLabel = newOption.label;
                input.value = newOption.label;
              }
            } else {
              if (transaction) {
                transaction.expenseType = firstOption.dataset.value;
                transaction.expenseLabel = firstOption.dataset.label;
                input.value = firstOption.dataset.label;
              }
            }
            
            saveState(transactions);
            hideDropdown();
          }
        }
      });

      input.addEventListener('focus', () => {
        // Store the current value to restore on blur
        input.dataset.selectedValue = input.value;
        // Clear the input to show all options
        input.value = '';
        // Create and show dropdown if it doesn't exist
        if (!dropdown) {
          dropdown = createDropdown();
        }
        // Show all options
        const matchingOptions = expenseOptions
          .filter(option => option.label.toLowerCase().includes(''))
          .sort((a, b) => a.label.localeCompare(b.label));
        
        let dropdownHTML = '';
        
        if (matchingOptions.length > 0) {
          dropdownHTML = matchingOptions.map(option => `
            <div class="expense-option" data-value="${option.value}" data-label="${option.label}">
              <span class="option-label">${option.label}</span>
              <button class="delete-option-btn" title="Delete option">
                <img src="src/images/trash.svg" alt="Delete" class="delete-icon">
              </button>
            </div>
          `).join('');
        }
        
        dropdown.innerHTML = dropdownHTML;
        showDropdown();
      });
      
      input.addEventListener('blur', () => {
        setTimeout(() => {
          hideDropdown();
          if (input.dataset.selectedValue && !input.value) {
            input.value = input.dataset.selectedValue;
          }
          delete input.dataset.selectedValue;
        }, 200);
      });

      // Update dropdown position on scroll
      const tableBody = document.querySelector('.table-body');
      if (tableBody) {
        tableBody.addEventListener('scroll', () => {
          if (dropdown && dropdown.style.display === 'block') {
            updateDropdownPosition();
          }
        });
      }
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

    // Add delete all button event listener
    const deleteAllBtn = document.querySelector('.delete-all-btn');
    deleteAllBtn.addEventListener('click', () => {
      modal.style.display = 'block';
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
      transactionsContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
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
      transactionsContainer.innerHTML = '<div class="loading">Extracting transactions...</div>';

      await extractTransactions();
    } catch (error) {
      transactionsContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
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