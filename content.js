// content.js
console.log('Content script loaded');

// --- Subforum Page Logic ---
async function processSubforums() {
    console.log("Scanning for subforums...");
    const unreadLinks = [];
    document.querySelectorAll('.node.node--forum').forEach(item => {
        if (item.querySelector('.node-icon .node--unread.forum')) {
            const link = item.querySelector('.node-main .node-title a');
            if (link && link.href) {
                unreadLinks.push({ url: link.href, title: link.innerText.trim() });
            }
        }
    });
    document.querySelectorAll('.subNodeLink--unread').forEach(link => {
        if (link.href) {
            unreadLinks.push({ url: link.href, title: link.innerText.trim() });
        }
    });

    const result = await browser.storage.sync.get('subforumRules');
    const rules = result.subforumRules || [];
    const matchingRule = rules.find(rule => window.location.href.startsWith(rule.pageUrl));

    if (matchingRule) {
        const customUrls = matchingRule.subforumUrls.map(s => s.trim()).filter(Boolean);
        const matched = unreadLinks.filter(item => customUrls.some(customUrl => item.url.includes(customUrl)));
        
        // Sort matched to follow the exact order in customUrls
        matched.sort((a, b) => {
            const indexA = customUrls.findIndex(url => a.url.includes(url));
            const indexB = customUrls.findIndex(url => b.url.includes(url));
            return indexA - indexB;
        });

        const urlsToMarkAsRead = unreadLinks.map(item => item.url).filter(url => !matched.some(o => o.url === url));
        return { urlsToOpen: matched, urlsToMarkAsRead };
    } else {
        return { urlsToOpen: unreadLinks, urlsToMarkAsRead: [] };
    }
}

// --- Thread Page Logic ---
async function processThreads() {
    console.log("Scanning for threads...");
    const unreadThreads = [];
    
    // Check for both common XenForo unread classes
    const selector = '.structItem.structItem--thread.structItem--unread, .structItem.structItem--thread.is-unread';
    
    document.querySelectorAll(selector).forEach(item => {
        const titleLink = item.querySelector('.structItem-title a[data-tp-primary="on"]');
        if (titleLink && titleLink.href) {
            unreadThreads.push({ url: titleLink.href, title: titleLink.innerText.trim() });
        }
    });

    const result = await browser.storage.sync.get('threadRules');
    const rules = result.threadRules || [];
    const matchingRule = rules.find(rule => window.location.href.startsWith(rule.pageUrl));

    if (matchingRule) {
        const customUrls = matchingRule.threadUrls.map(s => s.trim()).filter(Boolean);
        const matched = unreadThreads.filter(item => customUrls.some(customUrl => item.url.includes(customUrl)));
        
        // Sort matched to follow the exact order in customUrls
        matched.sort((a, b) => {
            const indexA = customUrls.findIndex(url => a.url.includes(url));
            const indexB = customUrls.findIndex(url => b.url.includes(url));
            return indexA - indexB;
        });

        const urlsToMarkAsRead = unreadThreads.map(item => item.url).filter(url => !matched.some(o => o.url === url));
        return { urlsToOpen: matched, urlsToMarkAsRead };
    } else {
        return { urlsToOpen: unreadThreads, urlsToMarkAsRead: [] };
    }
}

// --- Helper to get CSRF token ---
function getCsrfToken() {
    const htmlCsrf = document.documentElement.getAttribute('data-csrf');
    if (htmlCsrf) return htmlCsrf;
    const inputCsrf = document.querySelector('input[name="_xfToken"]');
    if (inputCsrf && inputCsrf.value) return inputCsrf.value;
    return '';
}

// --- Main Execution ---
async function main() {
    let finalUrlsToOpen = [];
    let finalSubforumUrlsToMarkAsRead = [];
    let finalThreadUrlsToMarkAsRead = [];

    const hasSubforums = document.querySelector('.p-body-pageContent .node-list');
    const hasThreads = document.querySelector('.p-body-pageContent .structItemContainer-group.js-threadList');

    if (hasSubforums) {
        const subforumResult = await processSubforums();
        finalUrlsToOpen.push(...subforumResult.urlsToOpen);
        finalSubforumUrlsToMarkAsRead.push(...subforumResult.urlsToMarkAsRead);
    }

    if (hasThreads) {
        const threadResult = await processThreads();
        finalUrlsToOpen.push(...threadResult.urlsToOpen);
        finalThreadUrlsToMarkAsRead.push(...threadResult.urlsToMarkAsRead);
    }

    // Remove duplicates based on URL property
    const seen = new Set();
    finalUrlsToOpen = finalUrlsToOpen.filter(item => {
        if (seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
    });
    
    finalSubforumUrlsToMarkAsRead = [...new Set(finalSubforumUrlsToMarkAsRead)];
    finalThreadUrlsToMarkAsRead = [...new Set(finalThreadUrlsToMarkAsRead)];

    const hasItemsToProcess = finalUrlsToOpen.length > 0 || 
                             finalSubforumUrlsToMarkAsRead.length > 0 || 
                             finalThreadUrlsToMarkAsRead.length > 0;

    if (hasItemsToProcess) {
        browser.runtime.sendMessage({
            action: 'processLinks',
            urlsToOpen: finalUrlsToOpen,
            subforumUrlsToMarkAsRead: finalSubforumUrlsToMarkAsRead,
            threadUrlsToMarkAsRead: finalThreadUrlsToMarkAsRead,
            csrfToken: getCsrfToken()
        });
    } else {
        browser.runtime.sendMessage({
            action: 'scanResults',
            openedCount: 0,
            error: hasSubforums || hasThreads ? "No unread items found." : "Not a valid subforum or thread list page."
        });
    }
}

// Listen for messages from the popup script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'ping') {
        sendResponse({ status: 'pong' });
        return true;
    }
    if (message.action === 'scanPage') {
        main().then(() => {
            sendResponse({ status: 'started' });
        }).catch(err => {
            console.error('Scan failed:', err);
            sendResponse({ status: 'error', error: err.message });
        });
        return true; // Keep channel open for async response
    }
});
