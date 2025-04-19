# RocketMoney Transaction Extractor Chrome Extension

This Chrome extension allows you to extract transactions from RocketMoney.com within a specified date range.

## Installation

1. Clone this repository or download the files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing these files

## Usage

1. Navigate to RocketMoney.com and log in to your account
2. Click the extension icon in your Chrome toolbar
3. Select your desired date range using the date pickers
4. Click "Extract Transactions" to fetch the transactions
5. The transactions will be displayed in the popup window

## Features

- Extract transactions within a custom date range
- Clean and modern UI
- Real-time transaction filtering
- Easy to use interface

## Development

The extension consists of the following files:
- `manifest.json`: Extension configuration
- `popup.html`: The UI for the extension popup
- `popup.js`: Handles UI interactions
- `content.js`: Script that runs on RocketMoney.com to extract transactions
- `background.js`: Background script for handling extension logic

## Note

You'll need to add icon files (16x16, 48x48, and 128x128 pixels) in the `icons` directory for the extension to work properly. You can create your own icons or use placeholder icons for testing.

## Security

This extension only runs on RocketMoney.com and requires you to be logged in to your account to extract transactions. No data is stored or transmitted to external servers. 