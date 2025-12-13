# 🏙️ Skyscraper City Forum Tab Opener
## Project Overview

This is a browser extension designed to eliminate the tedious process of manually opening every unread subforum thread on the Skyscraper City Forum. By clicking a single button, the extension will automatically scan the current page and open all relevant unread subforums in new background tabs, significantly streamlining the forum reading experience.

## ✨ Features

The extension will support two primary modes of operation, configurable via a simple user interface:

**1. Default Mode (Quick Scan)**

    Behavior: When clicked, the extension will scan the page you are currently viewing and open every single unread subforum link in a new background tab.

    Goal: To quickly access all new content on a main forum page (e.g., the root page for a specific continent or country).

**2. Custom Mode (Filtered Scan)**

    Behavior: Users can pre-select a list of specific subforums they are interested in. When clicked, the extension will only open links that match the selected subforum titles and are currently unread.

    Automatic Clearing: Any unread subforums that are not on the user's custom list will be automatically marked as read without being opened, effectively hiding irrelevant content.

    Goal: To focus reading efforts only on high-priority subforums while keeping the overall forum clean.

## 🛠️ Technical Implementation

The extension will be built using standard web technologies (HTML, CSS, JavaScript) for cross-browser compatibility (Chrome, Firefox, Edge).

**1. Manifest File (manifest.json)**

This file will define the extension's properties and required permissions.

    Permissions:

        tabs: Required to open new tabs in the background.

        storage: Required to save user preferences (the Custom list and the active mode).

        https://www.skyscrapercity.com/*: The host permission required to interact with the forum pages and inject content scripts.

**2. Core Logic (content.js)**

This script will be injected into the Skyscraper City forum pages to interact with the DOM.

    Identifying Unread Links: Skyscraper City uses specific classes or icons to denote unread threads/subforums. The script will need to inspect the forum's HTML structure to reliably identify these elements (e.g., looking for a specific icon or a class like forum_status_new).

    Extracting URLs: Once an unread element is identified, the script will extract the corresponding href attribute.

3. Background Script (background.js)

This script handles the actual tab manipulation and marking threads as read.

    Opening Tabs: Upon receiving a list of URLs from content.js, the background script will use the chrome.tabs.create() API (or equivalent) with the active: false option to open them in the background.

    Marking as Read (Custom Mode): This will be the most complex step. The extension will need to identify the "Mark forum(s) as read" link associated with the unwanted subforums and programmatically send a request to that URL to clear the unread status.

4. User Interface (popup.html / options.html)

A user interface will be needed for configuration.

    popup.html (Extension Button Click):

        A simple interface to select the active mode: Default or Custom.

        A prominent "Run Scan" button.

    options.html (Configuration Page):

        A list (or text area) where the user can input the exact titles or URLs of the subforums they wish to keep in their Custom list.

        A save button to persist the settings using the storage API.

## ⚙️ Development Steps

    DOM Analysis: Thoroughly examine the HTML structure of a Skyscraper City forum page to find reliable selectors for unread subforum links and the "Mark as read" links.

    Basic Functionality: Create a minimal extension that can identify all unread links and open them in new background tabs (Default Mode).

    Storage Integration: Implement saving and loading of the Custom Subforum List and the preferred mode (Default or Custom).

    Custom Filter Logic: Implement the filtering logic in content.js to only pass back URLs that match the Custom list when in Custom Mode.

    Auto-Clear Logic: Implement the feature to programmatically send requests to the "Mark as read" links for the excluded subforums in Custom Mode.

    UI Refinement: Build a user-friendly configuration and pop-up interface.