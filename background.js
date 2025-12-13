// background.js
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'processLinks') {
        let openedCount = 0;
        // Open URLs in new background tabs
        if (request.urlsToOpen && request.urlsToOpen.length > 0) {
            request.urlsToOpen.forEach(url => {
                browser.tabs.create({ url: url, active: false });
                openedCount++;
            });
        }

        // Handle URLs to mark as read (for Custom Mode)
        if (request.urlsToMarkAsRead && request.urlsToMarkAsRead.length > 0) {
            console.log('URLs to mark as read:', request.urlsToMarkAsRead);
            // TODO: Implement logic to programmatically mark these URLs as read.
            // This will likely involve:
            // 1. Identifying a "Mark forum(s) as read" link or API endpoint on the forum.
            // 2. Potentially navigating to those pages in a headless manner or sending POST requests
            //    with appropriate tokens (e.g., _xfToken) to clear the unread status.
            // This is complex and requires further detailed DOM analysis of subforum pages
            // to find the correct element/endpoint and how to interact with it.
        }

        // Send response back to the popup with the number of tabs opened
        browser.runtime.sendMessage({ action: 'scanResults', openedCount: openedCount });
    }
});

