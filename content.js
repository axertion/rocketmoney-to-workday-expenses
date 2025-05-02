// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractTransactions') {
    // Log the page structure to help debug
    console.log('Page structure:', document.body.innerHTML);
    
    // Try to find any transaction-related elements
    const allElements = document.querySelectorAll('*');
    console.log('All elements with classes:', Array.from(allElements)
      .filter(el => el.className)
      .map(el => ({
        tag: el.tagName,
        class: el.className,
        text: el.textContent.substring(0, 50)
      }))
    );

    extractTransactions()
      .then(transactions => sendResponse({ transactions }))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Will respond asynchronously
  }
});

async function extractTransactions() {
  // Wait for the transactions to load
  await waitForElement('[data-test="transaction-table-row"]');
  
  const transactions = [];
  
  // Get all transaction elements
  const transactionElements = document.querySelectorAll('[data-test="transaction-table-row"]');
  console.log('Found transaction elements:', transactionElements.length);
  
  for (const element of transactionElements) {
    try {
      const dateElement = element.querySelector('[data-test="transaction-cell-date"]');
      const amountElement = element.querySelector('[data-test="amount-table-cell"]');
      const descriptionElement = element.querySelector('[data-test="transaction-cell-name"]');

      if (!dateElement || !amountElement || !descriptionElement) {
        continue;
      }

      // Parse the date (format: "M/D")
      const dateText = dateElement.textContent.trim();
      console.log('Transaction date text:', dateText);
      
      const [month, day] = dateText.split('/');
      const transactionMonth = parseInt(month);
      const transactionDay = parseInt(day);

      // Create a date object for the current year
      const currentYear = new Date().getFullYear();
      const transactionDate = new Date(currentYear, transactionMonth - 1, transactionDay);
      
      transactions.push({
        date: transactionDate.toISOString(),
        amount: amountElement.textContent.trim(),
        description: descriptionElement.value || descriptionElement.textContent.trim()
      });
    } catch (error) {
      console.error('Error parsing transaction:', error);
    }
  }

  console.log('Found transactions:', transactions.length);
  return transactions;
}

// Helper function to wait for an element to appear in the DOM
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkElement = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      if (Date.now() - startTime >= timeout) {
        reject(new Error(`Timeout waiting for element: ${selector}`));
        return;
      }

      requestAnimationFrame(checkElement);
    };

    checkElement();
  });
} 