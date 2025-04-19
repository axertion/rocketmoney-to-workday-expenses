// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('RocketMoney Transaction Extractor installed');
});

// Handle any background tasks here
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTransactions') {
    // Handle any background processing if needed
    sendResponse({ success: true });
  }
  return true;
}); 