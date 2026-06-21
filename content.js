// content.js
console.log('Content script loaded');

// Helper to normalize URLs for reliable comparisons (stripping trailing slashes, query parameters, hashes, etc.)
function normalizeUrl(url) {
    if (!url) return '';
    try {
        const u = new URL(url);
        let path = u.pathname;
        if (path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        return (u.origin + path).toLowerCase();
    } catch (e) {
        let clean = url.trim().toLowerCase();
        if (clean.endsWith('/')) {
            clean = clean.slice(0, -1);
        }
        return clean;
    }
}

// --- Subforum Page Logic ---
async function processSubforums() {
    console.log("Scanning for subforums...");
    const unreadLinks = [];
    
    // Map of sub-subforum (child) URL to parent subforum URL in the DOM
    const childToParentMap = new Map();
    
    document.querySelectorAll('.node.node--forum').forEach(item => {
        const parentLink = item.querySelector('.node-main .node-title a');
        if (parentLink && parentLink.href) {
            const parentUrl = parentLink.href;
            
            // Build the parent-child relationship map for all subnodes
            item.querySelectorAll('.subNodeLink').forEach(subLink => {
                if (subLink.href) {
                    childToParentMap.set(subLink.href, parentUrl);
                }
            });
            
            if (item.querySelector('.node-icon .node--unread.forum')) {
                unreadLinks.push({ url: parentUrl, title: parentLink.innerText.trim() });
            }
        }
    });
    
    document.querySelectorAll('.subNodeLink--unread').forEach(link => {
        if (link.href) {
            unreadLinks.push({ url: link.href, title: link.innerText.trim() });
        }
    });

    // Reverse to open tabs from bottom to top
    unreadLinks.reverse();

    const result = await browser.storage.sync.get('subforumRules');
    const rules = result.subforumRules || [];
    const currentNormalized = normalizeUrl(window.location.href);
    const matchingRule = rules.find(rule => currentNormalized.startsWith(normalizeUrl(rule.pageUrl)));

    if (matchingRule) {
        const customUrls = matchingRule.subforumUrls.map(s => s.trim()).filter(Boolean);
        const normalizedCustom = customUrls.map(normalizeUrl);
        
        const matched = unreadLinks.filter(item => {
            const normItem = normalizeUrl(item.url);
            return normalizedCustom.some(normCustom => normItem.includes(normCustom) || normCustom.includes(normItem));
        });
        
        // Sort matched to follow the exact order in customUrls
        matched.sort((a, b) => {
            const normA = normalizeUrl(a.url);
            const normB = normalizeUrl(b.url);
            const indexA = normalizedCustom.findIndex(url => normA.includes(url) || url.includes(normA));
            const indexB = normalizedCustom.findIndex(url => normB.includes(url) || url.includes(normB));
            return indexA - indexB;
        });

        const openedNormalized = new Set(matched.map(item => normalizeUrl(item.url)));
        
        const urlsToMarkAsRead = unreadLinks
            .map(item => item.url)
            .filter(url => {
                const normUrl = normalizeUrl(url);
                
                // 1. If this URL is directly being opened, do not mark it read
                if (openedNormalized.has(normUrl)) {
                    return false;
                }
                
                // 2. If this URL is a child of a parent subforum that is being opened, do not mark it read
                const parentUrl = childToParentMap.get(url);
                if (parentUrl && openedNormalized.has(normalizeUrl(parentUrl))) {
                    return false;
                }
                
                // 3. If this URL is a parent and has any child that is being opened, do not mark it read
                const hasOpenedChild = Array.from(childToParentMap.entries()).some(([childUrl, parentUrl]) => {
                    return normalizeUrl(parentUrl) === normUrl && openedNormalized.has(normalizeUrl(childUrl));
                });
                if (hasOpenedChild) {
                    return false;
                }
                
                return true;
            });
            
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

    // Reverse to open tabs from bottom to top
    unreadThreads.reverse();

    const result = await browser.storage.sync.get('threadRules');
    const rules = result.threadRules || [];
    const currentNormalized = normalizeUrl(window.location.href);
    const matchingRule = rules.find(rule => currentNormalized.startsWith(normalizeUrl(rule.pageUrl)));

    if (matchingRule) {
        const customUrls = matchingRule.threadUrls.map(s => s.trim()).filter(Boolean);
        const normalizedCustom = customUrls.map(normalizeUrl);
        
        const matched = unreadThreads.filter(item => {
            const normItem = normalizeUrl(item.url);
            return normalizedCustom.some(normCustom => normItem.includes(normCustom) || normCustom.includes(normItem));
        });
        
        // Sort matched to follow the exact order in customUrls
        matched.sort((a, b) => {
            const normA = normalizeUrl(a.url);
            const normB = normalizeUrl(b.url);
            const indexA = normalizedCustom.findIndex(url => normA.includes(url) || url.includes(normA));
            const indexB = normalizedCustom.findIndex(url => normB.includes(url) || url.includes(normB));
            return indexA - indexB;
        });

        const openedNormalized = new Set(matched.map(item => normalizeUrl(item.url)));
        
        const urlsToMarkAsRead = unreadThreads
            .map(item => item.url)
            .filter(url => !openedNormalized.has(normalizeUrl(url)));
            
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
            urlsToOpen: finalUrlsToOpen.map(item => item.url),
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
