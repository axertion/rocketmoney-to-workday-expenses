document.addEventListener('DOMContentLoaded', function() {
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const extractBtn = document.getElementById('extractBtn');
  const addToExpenseBtn = document.getElementById('addToExpenseBtn');
  const transactionsDiv = document.getElementById('transactions');
  const transactionsBody = document.getElementById('transactionsBody');
  const dateRangeBtn = document.getElementById('dateRangeBtn');
  const datePickerDropdown = document.getElementById('datePickerDropdown');
  const dateRangeSummary = document.getElementById('dateRangeSummary');
  const setDatesBtn = document.getElementById('setDatesBtn');
  const prevMonthBtn = document.getElementById('prevMonthBtn');
  const nextMonthBtn = document.getElementById('nextMonthBtn');
  const currentMonthYearEl = document.getElementById('currentMonthYear');
  const calendarDaysEl = document.getElementById('calendarDays');

  let currentTransactions = [];
  let isDatePickerOpen = false;
  let currentDate = new Date();
  let selectedStartDate = null;
  let selectedEndDate = null;

  // Load saved state when popup opens
  chrome.storage.local.get(['startDate', 'endDate', 'transactions', 'dateRangeSummary'], function(result) {
    if (result.startDate && result.endDate) {
      startDateInput.value = result.startDate;
      endDateInput.value = result.endDate;
      selectedStartDate = new Date(result.startDate);
      selectedEndDate = new Date(result.endDate);
      dateRangeSummary.textContent = result.dateRangeSummary || formatDateRange(result.startDate, result.endDate);
    } else {
      // Set default to Last Week
      setPresetDates('last-week');
    }

    // Display saved transactions if they exist
    if (result.transactions) {
      currentTransactions = result.transactions;
      displayTransactions(result.transactions);
      addToExpenseBtn.disabled = false;
    }

    // Initialize calendar
    renderCalendar();
  });

  // Calendar navigation
  prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });

  nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  // Calendar day click handler
  function handleDayClick(date) {
    // Create dates at start of day in local timezone
    const clickedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      // Start new selection
      selectedStartDate = clickedDate;
      selectedEndDate = null;
    } else {
      // Complete the selection
      if (clickedDate < selectedStartDate) {
        selectedEndDate = selectedStartDate;
        selectedStartDate = clickedDate;
      } else {
        selectedEndDate = clickedDate;
      }
    }

    startDateInput.value = formatDate(selectedStartDate);
    if (selectedEndDate) {
      endDateInput.value = formatDate(selectedEndDate);
      updateDateSummary();
    }

    renderCalendar();
  }

  // Render calendar
  function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Update header
    currentMonthYearEl.textContent = new Date(year, month).toLocaleString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });

    // Get first day of month and total days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    // Get days from previous month
    const prevMonthDays = new Date(year, month, 0).getDate();

    // Generate calendar HTML
    let calendarHTML = '';

    // Previous month days
    for (let i = startingDay - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      calendarHTML += `<button class="calendar-day other-month" disabled>${day}</button>`;
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      // Create date at start of day in local timezone
      const date = new Date(year, month, day);
      const isToday = isDateEqual(date, new Date());
      const isSelected = isDateEqual(date, selectedStartDate) || isDateEqual(date, selectedEndDate);
      const isInRange = selectedStartDate && selectedEndDate && 
                       date >= selectedStartDate && date <= selectedEndDate;

      const classes = [
        'calendar-day',
        isToday ? 'today' : '',
        isSelected ? 'selected' : '',
        isInRange ? 'in-range' : ''
      ].filter(Boolean).join(' ');

      // Store year, month, day as data attributes
      calendarHTML += `
        <button class="${classes}" 
          data-year="${year}" 
          data-month="${month}" 
          data-day="${day}">${day}</button>
      `;
    }

    // Next month days
    const remainingDays = 42 - (startingDay + daysInMonth);
    for (let day = 1; day <= remainingDays; day++) {
      calendarHTML += `<button class="calendar-day other-month" disabled>${day}</button>`;
    }

    calendarDaysEl.innerHTML = calendarHTML;

    // Add click handlers to calendar days
    document.querySelectorAll('.calendar-day:not(.other-month)').forEach(dayEl => {
      dayEl.addEventListener('click', () => {
        const year = parseInt(dayEl.dataset.year);
        const month = parseInt(dayEl.dataset.month);
        const day = parseInt(dayEl.dataset.day);
        const date = new Date(year, month, day);
        handleDayClick(date);
      });
    });
  }

  // Helper function to check if two dates are equal
  function isDateEqual(date1, date2) {
    if (!date1 || !date2) return false;
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  // Helper function to format date as YYYY-MM-DD
  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Helper function to format date range for display
  function formatDateRange(startDate, endDate) {
    // Create dates using local components to avoid timezone issues
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return `${formatDateForDisplay(start)} - ${formatDateForDisplay(end)}`;
  }

  // Helper function to format a date for display
  function formatDateForDisplay(date) {
    return date.toLocaleDateString('en-US', { 
      month: 'short',
      day: 'numeric'
    });
  }

  // Helper function to close date picker
  function closeDatePicker() {
    isDatePickerOpen = false;
    datePickerDropdown.style.display = 'none';
    dateRangeBtn.setAttribute('data-open', 'false');
  }

  // Toggle date picker dropdown
  dateRangeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isDatePickerOpen = !isDatePickerOpen;
    datePickerDropdown.style.display = isDatePickerOpen ? 'block' : 'none';
    dateRangeBtn.setAttribute('data-open', isDatePickerOpen ? 'true' : 'false');
  });

  // Close date picker when clicking outside
  document.addEventListener('click', () => {
    if (isDatePickerOpen) {
      closeDatePicker();
    }
  });

  // Prevent clicks inside dropdown from closing it
  datePickerDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Handle preset option clicks
  document.querySelectorAll('.preset-option').forEach(button => {
    button.addEventListener('click', async (e) => {
      // Prevent event from bubbling up to document click handler
      e.stopPropagation();
      
      const preset = button.dataset.preset;
      setPresetDates(preset);
      
      // Update selected state
      document.querySelectorAll('.preset-option').forEach(btn => {
        btn.classList.remove('selected');
      });
      button.classList.add('selected');

      // Update calendar view
      renderCalendar();

      // Close the date picker
      closeDatePicker();

      // Trigger transaction extraction like the Get Transactions button
      const startDate = new Date(startDateInput.value);
      const endDate = new Date(endDateInput.value);

      if (startDate > endDate) {
        alert('Start date must be before end date');
        return;
      }

      extractBtn.disabled = true;
      transactionsBody.innerHTML = '<div class="loading">Extracting transactions...</div>';

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

        await handleTransactionResponse(response, startDate, endDate);
      } catch (error) {
        transactionsBody.innerHTML = `<div class="error">Error: ${error.message}</div>`;
      } finally {
        extractBtn.disabled = false;
      }
    });
  });

  // Set dates based on preset
  function setPresetDates(preset) {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let start = new Date();
    let end = new Date();
    let summary = '';

    switch (preset) {
      case 'today':
        start = todayStart;
        end = todayStart;
        summary = 'Today';
        break;
      case 'yesterday':
        start = new Date(todayStart);
        start.setDate(todayStart.getDate() - 1);
        end = start;
        summary = 'Yesterday';
        break;
      case 'this-week':
        start = getStartOfWeek(todayStart);
        end = getEndOfWeek(todayStart);
        summary = 'This Week';
        break;
      case 'last-week':
        end = new Date(getStartOfWeek(todayStart));
        end.setDate(end.getDate() - 1);
        start = new Date(end);
        start.setDate(start.getDate() - 6);
        summary = 'Last Week';
        break;
      case 'last-2-weeks':
        end = new Date(getStartOfWeek(todayStart));
        end.setDate(end.getDate() - 1);
        start = new Date(end);
        start.setDate(start.getDate() - 13);
        summary = 'Last 2 Weeks';
        break;
      case 'this-month':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        summary = 'This Month';
        break;
      case 'last-month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        summary = 'Last Month';
        break;
    }

    selectedStartDate = start;
    selectedEndDate = end;
    startDateInput.value = formatDate(start);
    endDateInput.value = formatDate(end);
    dateRangeSummary.textContent = summary;

    // Save the state with the preset summary
    saveState(formatDate(start), formatDate(end), null, summary);
  }

  // Helper function to get start of week (Sunday)
  function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d;
  }

  // Helper function to get end of week (Saturday)
  function getEndOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (6 - day));
    return d;
  }

  // Helper function to update date summary
  function updateDateSummary() {
    // Check if dates are equal
    if (selectedStartDate && selectedEndDate && isDateEqual(selectedStartDate, selectedEndDate)) {
      // Single day selection
      dateRangeSummary.textContent = formatDateForDisplay(selectedStartDate);
    } else {
      // Date range selection
      dateRangeSummary.textContent = `${formatDateForDisplay(selectedStartDate)} - ${formatDateForDisplay(selectedEndDate)}`;
    }
  }

  // Set dates button handler
  setDatesBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    updateDateSummary();
    closeDatePicker();
    
    // Save the state
    saveState(startDateInput.value, endDateInput.value, null, dateRangeSummary.textContent);

    // Trigger transaction extraction
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);

    if (startDate > endDate) {
      alert('Start date must be before end date');
      return;
    }

    extractBtn.disabled = true;
    transactionsBody.innerHTML = '<div class="loading">Extracting transactions...</div>';

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

      await handleTransactionResponse(response, startDate, endDate);
    } catch (error) {
      transactionsBody.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    } finally {
      extractBtn.disabled = false;
    }
  });

  // Helper function to save state
  function saveState(startDate, endDate, transactions, summary) {
    chrome.storage.local.set({
      startDate: startDate,
      endDate: endDate,
      transactions: transactions,
      dateRangeSummary: summary
    });
  }

  extractBtn.addEventListener('click', async () => {
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);

    if (startDate > endDate) {
      alert('Start date must be before end date');
      return;
    }

    extractBtn.disabled = true;
    transactionsBody.innerHTML = '<div class="loading">Extracting transactions...</div>';

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

      await handleTransactionResponse(response, startDate, endDate);
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
    if (!transactions || transactions.length === 0) {
      transactionsBody.innerHTML = '<div class="transaction-row"><div class="no-transactions">No transactions found in the selected date range.</div></div>';
      return;
    }

    const expenseOptions = getExpenseOptions();
    const optionsHtml = expenseOptions
      .map(option => `<option value="${option.value}">${option.label}</option>`)
      .join('');

    const transactionsHTML = transactions.map(transaction => {
      const date = new Date(transaction.date);
      const formattedDate = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      
      // Create options HTML with selected state
      const optionsWithSelection = expenseOptions
        .map(option => `<option value="${option.value}" ${transaction.expenseType === option.value ? 'selected' : ''}>${option.label}</option>`)
        .join('');
      
      return `
        <div class="transaction-row">
          <div class="memo-col">
            <div>${transaction.description}</div>
            <div class="memo-date">${formattedDate}</div>
          </div>
          <div class="expense-col">
            <select class="expense-select" data-transaction-date="${transaction.date}">
              ${optionsWithSelection}
            </select>
          </div>
          <div class="amount-col">${transaction.amount}</div>
        </div>
      `;
    }).join('');

    transactionsBody.innerHTML = transactionsHTML;

    // Add change event listeners to all expense select dropdowns
    document.querySelectorAll('.expense-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const transactionDate = e.target.dataset.transactionDate;
        const selectedValue = e.target.value;
        const selectedOption = e.target.options[e.target.selectedIndex];
        const selectedLabel = selectedOption.text;
        
        // Find and update the transaction in our dataset
        const transaction = currentTransactions.find(t => t.date === transactionDate);
        if (transaction) {
          transaction.expenseType = selectedValue;
          transaction.expenseLabel = selectedLabel;
          
          // Save the updated transactions to storage
          saveState(
            startDateInput.value,
            endDateInput.value,
            currentTransactions,
            dateRangeSummary.textContent
          );
        }
      });
    });
  }

  // Update the response handling in both preset option click and Set Dates click handlers
  async function handleTransactionResponse(response, startDate, endDate) {
    if (response.error) {
      throw new Error(response.error);
    }

    // Get default expense option
    const defaultOption = getExpenseOptions()[0];

    // Preserve expense types and labels from existing transactions when updating
    const updatedTransactions = response.transactions.map(newTransaction => {
      const existingTransaction = currentTransactions.find(t => t.date === newTransaction.date);
      if (existingTransaction) {
        // If we have an existing transaction, preserve both the type and label
        return {
          ...newTransaction,
          expenseType: existingTransaction.expenseType,
          expenseLabel: existingTransaction.expenseLabel
        };
      } else {
        // For new transactions, use the default option
        return {
          ...newTransaction,
          expenseType: defaultOption.value,
          expenseLabel: defaultOption.label
        };
      }
    });

    // Save the state after successful extraction
    currentTransactions = updatedTransactions;
    saveState(
      formatDate(startDate),
      formatDate(endDate),
      currentTransactions,
      dateRangeSummary.textContent
    );

    displayTransactions(currentTransactions);
    addToExpenseBtn.disabled = false;
  }
}); 