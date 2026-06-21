document.addEventListener('DOMContentLoaded', () => {
    const openUnreadButton = document.getElementById('openAllUnread');
    const addRuleForPageButton = document.getElementById('addRuleForPage');
    const statusDiv = document.getElementById('status');

    let currentTab;

    function setStatus(message, type = 'info') {
        statusDiv.textContent = message;
        statusDiv.className = type;
    }

    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        currentTab = tabs[0];
        if (currentTab && currentTab.url && currentTab.url.startsWith('https://www.skyscrapercity.com/')) {
            openUnreadButton.disabled = false;
            addRuleForPageButton.disabled = false;
            setStatus('Ready to scan.', 'info');
        } else {
            openUnreadButton.disabled = true;
            addRuleForPageButton.disabled = true;
            setStatus('Navigate to a Skyscraper City page.', 'error');
        }
    });

    addRuleForPageButton.addEventListener('click', () => {
        if (currentTab) {
            const optionsUrl = browser.runtime.getURL('options.html');
            browser.tabs.create({ url: `${optionsUrl}?pageUrl=${encodeURIComponent(currentTab.url)}` });
        }
    });

    openUnreadButton.addEventListener('click', async () => {
        setStatus('Scanning page...', 'info');
        openUnreadButton.disabled = true;

        if (currentTab) {
            try {
                // Check if content.js is already running on the page using a ping
                let loaded = false;
                try {
                    const response = await browser.tabs.sendMessage(currentTab.id, { action: 'ping' });
                    if (response && response.status === 'pong') {
                        loaded = true;
                    }
                } catch (e) {
                    // Message failed, script not injected yet
                }

                // If not loaded, inject it dynamically
                if (!loaded) {
                    console.log('Content script not loaded on this tab. Injecting dynamically...');
                    await browser.scripting.executeScript({
                        target: { tabId: currentTab.id },
                        files: ['content.js']
                    });
                }

                // Send the scanPage trigger
                const response = await browser.tabs.sendMessage(currentTab.id, { action: 'scanPage' });
                if (response && response.status === 'error') {
                    setStatus('Error: ' + response.error, 'error');
                    openUnreadButton.disabled = false;
                }
            } catch (error) {
                console.error('Failed to execute scan action:', error);
                setStatus('Error: ' + error.message, 'error');
                openUnreadButton.disabled = false;
            }
        } else {
            setStatus('Error: No active tab found.', 'error');
            openUnreadButton.disabled = false;
        }
    });

    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'scanProgress') {
            if (request.stage === 'opening') {
                setStatus(`Opening tabs (${request.current}/${request.total})...`, 'info');
            } else if (request.stage === 'marking') {
                setStatus(`Clearing unread (${request.current}/${request.total})...`, 'info');
            }
        } else if (request.action === 'scanResults') {
            if (request.error) {
                setStatus(request.error, 'error');
            } else if (request.openedCount > 0) {
                setStatus(`Opened ${request.openedCount} new tabs!`, 'success');
            } else {
                setStatus('No unread items found.', 'info');
            }
            openUnreadButton.disabled = false;
        }
        sendResponse({status: "Received"});
        return true;
    });
});
