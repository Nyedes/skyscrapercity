// background.js

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Listen for messages from the content script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'processLinks') {
        // Handle asynchronously in the background and reply immediately to content script
        handleProcessLinks(request);
        sendResponse({ status: 'processing' });
        return true;
    }
});

/**
 * Handles tab creation and marking read sequentially with pacing delays.
 */
async function handleProcessLinks(request) {
    let openedCount = 0;
    try {
        // 1. Open requested URLs in new background tabs with a delay
        if (request.urlsToOpen && request.urlsToOpen.length > 0) {
            const total = request.urlsToOpen.length;
            for (let i = 0; i < total; i++) {
                const urlObj = request.urlsToOpen[i];
                const url = typeof urlObj === 'string' ? urlObj : (urlObj && urlObj.url);
                if (url) {
                    browser.tabs.create({ url: url, active: false });
                    openedCount++;
                }

                // Report progress back to the popup
                browser.runtime.sendMessage({
                    action: 'scanProgress',
                    stage: 'opening',
                    current: i + 1,
                    total: total
                }).catch(() => {
                    // Ignore error if popup is closed
                });

                // 500ms delay between opening each tab
                if (i < total - 1) {
                    await delay(500);
                }
            }
        }

        // Gather all marking targets
        const subforums = request.subforumUrlsToMarkAsRead || [];
        const threads = request.threadUrlsToMarkAsRead || [];
        const totalToMark = subforums.length + threads.length;

        // 2. Mark as read sequentially with a delay
        if (totalToMark > 0) {
            let processedCount = 0;

            // Process subforums first (via POST)
            for (let i = 0; i < subforums.length; i++) {
                await markSubforumAsRead(subforums[i], request.csrfToken);
                processedCount++;

                browser.runtime.sendMessage({
                    action: 'scanProgress',
                    stage: 'marking',
                    current: processedCount,
                    total: totalToMark
                }).catch(() => {});

                if (processedCount < totalToMark) {
                    await delay(400); // 400ms delay between actions
                }
            }

            // Process threads (via GET)
            for (let i = 0; i < threads.length; i++) {
                await markThreadAsRead(threads[i]);
                processedCount++;

                browser.runtime.sendMessage({
                    action: 'scanProgress',
                    stage: 'marking',
                    current: processedCount,
                    total: totalToMark
                }).catch(() => {});

                if (processedCount < totalToMark) {
                    await delay(400); // 400ms delay between actions
                }
            }
        }

        // Send final scan results to the popup
        browser.runtime.sendMessage({ action: 'scanResults', openedCount: openedCount }).catch(() => {});
    } catch (error) {
        console.error('Error in handleProcessLinks:', error);
        browser.runtime.sendMessage({
            action: 'scanResults',
            openedCount: openedCount,
            error: 'Background error: ' + error.message
        }).catch(() => {});
    }
}

/**
 * Sends a POST request to XenForo mark-read endpoint to clear subforum unread status.
 */
async function markSubforumAsRead(subforumUrl, csrfToken) {
    let markReadUrl = subforumUrl;
    if (!markReadUrl.endsWith('/')) {
        markReadUrl += '/';
    }
    markReadUrl += 'mark-read';

    const body = new URLSearchParams();
    body.append('_xfToken', csrfToken);
    body.append('confirm', '1');

    try {
        const response = await fetch(markReadUrl, {
            method: 'POST',
            body: body,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        if (response.ok) {
            console.log(`Successfully marked subforum as read: ${subforumUrl}`);
        } else {
            console.warn(`Failed to mark subforum as read: ${subforumUrl} (Status: ${response.status})`);
        }
    } catch (error) {
        console.error(`Error marking subforum as read: ${subforumUrl}`, error);
    }
}

/**
 * Sends a GET request to a thread URL to clear its unread status.
 */
async function markThreadAsRead(threadUrl) {
    try {
        const response = await fetch(threadUrl, {
            method: 'GET'
        });
        if (response.ok) {
            console.log(`Successfully marked thread as read: ${threadUrl}`);
        } else {
            console.warn(`Failed to mark thread as read: ${threadUrl} (Status: ${response.status})`);
        }
    } catch (error) {
        console.error(`Error marking thread as read: ${threadUrl}`, error);
    }
}


