document.addEventListener('DOMContentLoaded', function() {
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const extractBtn = document.getElementById('extractBtn');
  const addToExpenseBtn = document.getElementById('addToExpenseBtn');
  const transactionsDiv = document.getElementById('transactions');
  const lastWeekBtn = document.getElementById('lastWeekBtn');
  const thisWeekBtn = document.getElementById('thisWeekBtn');
  const todayBtn = document.getElementById('todayBtn');
  const yesterdayBtn = document.getElementById('yesterdayBtn');

  let currentTransactions = [];

  // Load saved state when popup opens
  chrome.storage.local.get(['startDate', 'endDate', 'transactions'], function(result) {
    if (result.startDate && result.endDate) {
      startDateInput.value = result.startDate;
      endDateInput.value = result.endDate;
    } else {
      // Set default date range (last 30 days) if no saved state
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);

      startDateInput.value = thirtyDaysAgo.toISOString().split('T')[0];
      endDateInput.value = today.toISOString().split('T')[0];
    }

    // Display saved transactions if they exist
    if (result.transactions) {
      currentTransactions = result.transactions;
      displayTransactions(result.transactions);
      addToExpenseBtn.disabled = false;
    }
  });

  // Helper function to format date as YYYY-MM-DD
  function formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  // Helper function to get start of week
  function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d;
  }

  // Helper function to get end of week
  function getEndOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (6 - day));
    return d;
  }

  // Helper function to save state
  function saveState(startDate, endDate, transactions) {
    chrome.storage.local.set({
      startDate: startDate,
      endDate: endDate,
      transactions: transactions
    });
  }

  // Last Week button handler
  lastWeekBtn.addEventListener('click', () => {
    const today = new Date();
    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(today.getDate() - 7);
    const lastWeekEnd = new Date(today);
    lastWeekEnd.setDate(today.getDate() - 1);

    const startDate = formatDate(lastWeekStart);
    const endDate = formatDate(lastWeekEnd);
    
    startDateInput.value = startDate;
    endDateInput.value = endDate;
    saveState(startDate, endDate, null);
    currentTransactions = [];
    addToExpenseBtn.disabled = true;
  });

  // This Week button handler
  thisWeekBtn.addEventListener('click', () => {
    const today = new Date();
    const startOfWeek = getStartOfWeek(today);
    const endOfWeek = getEndOfWeek(today);

    const startDate = formatDate(startOfWeek);
    const endDate = formatDate(endOfWeek);
    
    startDateInput.value = startDate;
    endDateInput.value = endDate;
    saveState(startDate, endDate, null);
    currentTransactions = [];
    addToExpenseBtn.disabled = true;
  });

  // Today button handler
  todayBtn.addEventListener('click', () => {
    const today = new Date();
    const date = formatDate(today);
    
    startDateInput.value = date;
    endDateInput.value = date;
    saveState(date, date, null);
    currentTransactions = [];
    addToExpenseBtn.disabled = true;
  });

  // Yesterday button handler
  yesterdayBtn.addEventListener('click', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const date = formatDate(yesterday);
    startDateInput.value = date;
    endDateInput.value = date;
    saveState(date, date, null);
    currentTransactions = [];
    addToExpenseBtn.disabled = true;
  });

  extractBtn.addEventListener('click', async () => {
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);

    if (startDate > endDate) {
      alert('Start date must be before end date');
      return;
    }

    extractBtn.disabled = true;
    transactionsDiv.innerHTML = '<div class="loading">Extracting transactions...</div>';

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('rocketmoney.com')) {
        throw new Error('Please navigate to RocketMoney.com first');
      }

      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractTransactions',
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // Save the state after successful extraction
      currentTransactions = response.transactions;
      saveState(
        formatDate(startDate),
        formatDate(endDate),
        response.transactions
      );

      displayTransactions(response.transactions);
      addToExpenseBtn.disabled = false;
    } catch (error) {
      transactionsDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
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

      // Log the attempt
      console.log('Attempting to add transactions to Workday:', {
        url: tab.url,
        transactionCount: currentTransactions.length
      });

      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'addToWorkday',
        transactions: currentTransactions
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // Show success message
      alert('Transactions added to expense report successfully!');
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

  function displayTransactions(transactions) {
    if (!transactions || transactions.length === 0) {
      transactionsDiv.innerHTML = '<div class="no-transactions">No transactions found in the selected date range.</div>';
      return;
    }

    const transactionsHTML = transactions.map(transaction => `
      <div class="transaction-item">
        <div class="transaction-date">${new Date(transaction.date).toLocaleDateString()}</div>
        <div class="transaction-amount">${transaction.amount}</div>
        <div class="transaction-description">${transaction.description}</div>
      </div>
    `).join('');

    transactionsDiv.innerHTML = transactionsHTML;
  }
}); 