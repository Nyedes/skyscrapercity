// options.js

// Helper to normalize URLs for reliable comparisons
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

document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');

    // --- Subforum Rule Elements ---
    const subforumPageUrlInput = document.getElementById('subforumPageUrl');
    const customSubforumsTextarea = document.getElementById('customSubforums');
    const addSubforumRuleButton = document.getElementById('addSubforumRuleButton');
    const subforumRulesListDiv = document.getElementById('subforumRulesList');

    // --- Thread Rule Elements ---
    const threadPageUrlInput = document.getElementById('threadPageUrl');
    const customThreadsTextarea = document.getElementById('customThreads');
    const addThreadRuleButton = document.getElementById('addThreadRuleButton');
    const threadRulesListDiv = document.getElementById('threadRulesList');

    let subforumRules = [];
    let threadRules = [];

    // --- Generic Functions ---
    function setStatus(message, isError = false) {
        statusDiv.textContent = message;
        statusDiv.style.color = isError ? 'red' : 'green';
        setTimeout(() => statusDiv.textContent = '', 3000);
    }

    // --- Subforum Rule Functions ---
    function saveSubforumRules() {
        browser.storage.sync.set({ subforumRules: subforumRules }, () => {
            setStatus('Subforum rules saved!');
            renderSubforumRules();
        });
    }

    function renderSubforumRules() {
        subforumRulesListDiv.innerHTML = '';
        subforumRules.forEach((rule, index) => {
            const ruleDiv = document.createElement('div');
            ruleDiv.className = 'rule';
            ruleDiv.innerHTML = `
                <button class="delete-subforum-rule" data-index="${index}" title="Delete this rule">×</button>
                <div class="rule-page-url">${rule.pageUrl}</div>
                <div class="rule-subforums">${rule.subforumUrls.join('<br>')}</div>
            `;
            subforumRulesListDiv.appendChild(ruleDiv);
        });
        document.querySelectorAll('.delete-subforum-rule').forEach(button => {
            button.addEventListener('click', deleteSubforumRule);
        });
    }

    function addSubforumRule() {
        const pageUrl = subforumPageUrlInput.value.trim();
        const subforumUrls = customSubforumsTextarea.value.split('\n').map(url => url.trim()).filter(url => url);

        if (!pageUrl || subforumUrls.length === 0) {
            setStatus('Please provide a page URL and at least one subforum URL.', true);
            return;
        }

        const existingRuleIndex = subforumRules.findIndex(rule => normalizeUrl(rule.pageUrl) === normalizeUrl(pageUrl));
        if (existingRuleIndex > -1) {
            subforumRules[existingRuleIndex].subforumUrls = subforumUrls;
        } else {
            subforumRules.push({ pageUrl, subforumUrls });
        }
        
        saveSubforumRules();
        subforumPageUrlInput.value = '';
        customSubforumsTextarea.value = '';
    }

    function deleteSubforumRule(event) {
        const indexToDelete = parseInt(event.target.dataset.index, 10);
        subforumRules.splice(indexToDelete, 1);
        saveSubforumRules();
    }

    // --- Thread Rule Functions ---
    function saveThreadRules() {
        browser.storage.sync.set({ threadRules: threadRules }, () => {
            setStatus('Thread rules saved!');
            renderThreadRules();
        });
    }

    function renderThreadRules() {
        threadRulesListDiv.innerHTML = '';
        threadRules.forEach((rule, index) => {
            const ruleDiv = document.createElement('div');
            ruleDiv.className = 'rule';
            ruleDiv.innerHTML = `
                <button class="delete-thread-rule" data-index="${index}" title="Delete this rule">×</button>
                <div class="rule-page-url">${rule.pageUrl}</div>
                <div class="rule-subforums">${rule.threadUrls.join('<br>')}</div>
            `;
            threadRulesListDiv.appendChild(ruleDiv);
        });
        document.querySelectorAll('.delete-thread-rule').forEach(button => {
            button.addEventListener('click', deleteThreadRule);
        });
    }

    function addThreadRule() {
        const pageUrl = threadPageUrlInput.value.trim();
        const threadUrls = customThreadsTextarea.value.split('\n').map(url => url.trim()).filter(url => url);

        if (!pageUrl || threadUrls.length === 0) {
            setStatus('Please provide a subforum page URL and at least one thread URL.', true);
            return;
        }

        const existingRuleIndex = threadRules.findIndex(rule => normalizeUrl(rule.pageUrl) === normalizeUrl(pageUrl));
        if (existingRuleIndex > -1) {
            threadRules[existingRuleIndex].threadUrls = threadUrls;
        } else {
            threadRules.push({ pageUrl, threadUrls });
        }
        
        saveThreadRules();
        threadPageUrlInput.value = '';
        customThreadsTextarea.value = '';
    }

    function deleteThreadRule(event) {
        const indexToDelete = parseInt(event.target.dataset.index, 10);
        threadRules.splice(indexToDelete, 1);
        saveThreadRules();
    }


    // --- Initial Load and Event Listeners ---
    function loadAllRules() {
        browser.storage.sync.get(['subforumRules', 'threadRules'], (result) => {
            subforumRules = result.subforumRules || [];
            threadRules = result.threadRules || [];
            renderSubforumRules();
            renderThreadRules();
            prefillFromUrl();
        });
    }

    function prefillFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const pageUrl = urlParams.get('pageUrl');
        if (pageUrl) {
            const decodedUrl = decodeURIComponent(pageUrl);
            
            // Heuristic fallback before scraping
            const existingThreadRule = threadRules.find(rule => normalizeUrl(rule.pageUrl) === normalizeUrl(decodedUrl));
            const existingSubforumRule = subforumRules.find(rule => normalizeUrl(rule.pageUrl) === normalizeUrl(decodedUrl));
            if (existingThreadRule) {
                threadPageUrlInput.value = decodedUrl;
                customThreadsTextarea.value = existingThreadRule.threadUrls.join('\n');
            } else if (existingSubforumRule) {
                subforumPageUrlInput.value = decodedUrl;
                customSubforumsTextarea.value = existingSubforumRule.subforumUrls.join('\n');
            } else {
                // Default fallback
                subforumPageUrlInput.value = decodedUrl;
            }

            // Attempt to query the tab and scrape its items for the Interactive Builder
            browser.tabs.query({}).then((tabs) => {
                const tab = tabs.find(t => t.url && normalizeUrl(t.url).startsWith(normalizeUrl(decodedUrl.split('#')[0])));
                if (tab) {
                    browser.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: scrapePageForRules
                    }).then((results) => {
                        if (results && results[0] && results[0].result) {
                            const res = results[0].result;
                            if (res.success) {
                                if (res.type === 'threads') {
                                    threadPageUrlInput.value = decodedUrl;
                                    const exRule = threadRules.find(rule => normalizeUrl(rule.pageUrl) === normalizeUrl(decodedUrl));
                                    if (exRule) {
                                        customThreadsTextarea.value = exRule.threadUrls.join('\n');
                                    } else {
                                        customThreadsTextarea.value = '';
                                    }
                                } else {
                                    subforumPageUrlInput.value = decodedUrl;
                                    const exRule = subforumRules.find(rule => normalizeUrl(rule.pageUrl) === normalizeUrl(decodedUrl));
                                    if (exRule) {
                                        customSubforumsTextarea.value = exRule.subforumUrls.join('\n');
                                    } else {
                                        customSubforumsTextarea.value = '';
                                    }
                                }
                                setupInteractiveBuilder(res.items, res.type, decodedUrl);
                            } else {
                                console.warn('Interactive builder scrape error:', res.error);
                            }
                        }
                    }).catch(err => {
                        console.error('Failed to execute script on tab:', err);
                    });
                }
            });
        }
    }

    function setupInteractiveBuilder(items, type, pageUrl) {
        const builderDiv = document.getElementById('interactiveBuilder');
        const builderPageUrl = document.getElementById('builderPageUrl');
        const builderContent = document.getElementById('builderContent');
        const saveBtn = document.getElementById('saveBuilderRuleButton');

        builderDiv.style.display = 'block';
        builderPageUrl.textContent = pageUrl;
        builderPageUrl.href = pageUrl;

        builderContent.innerHTML = '';

        if (type === 'subforums') {
            const existingRule = subforumRules.find(r => normalizeUrl(r.pageUrl) === normalizeUrl(pageUrl));
            const savedUrls = existingRule ? existingRule.subforumUrls : [];

            // Initialize orderedSubforums in the saved order
            let orderedSubforums = [];
            savedUrls.forEach(url => {
                const found = items.find(item => normalizeUrl(item.url) === normalizeUrl(url));
                if (found) {
                    orderedSubforums.push(found);
                }
            });
            // For items not in the saved list but checked (or if no rule exists yet), default to checked in document order
            if (!existingRule) {
                orderedSubforums = [...items];
            } else {
                // If there is an existing rule, append any other items (unchecked by default)
                items.forEach(item => {
                    if (!savedUrls.includes(item.url)) {
                        // Not checked, so not in orderedSubforums
                    }
                });
            }

            const interfaceHtml = `
                <p>Check the subforums you want the scanner to open. Unchecked subforums will be automatically marked as read.</p>
                <div class="builder-bulk-actions">
                    <button type="button" class="btn-small" id="builderSelectAll">Select All</button>
                    <button type="button" class="btn-small" id="builderClearAll">Clear All</button>
                </div>
                <div class="builder-checkbox-grid">
                    ${items.map((item, idx) => {
                        const isChecked = orderedSubforums.some(s => s.url === item.url) ? 'checked' : '';
                        return `
                            <label class="builder-checkbox-label">
                                <input type="checkbox" class="subforum-checkbox" value="${item.url}" data-title="${item.title}" ${isChecked}>
                                <span>${item.title}</span>
                            </label>
                        `;
                    }).join('')}
                </div>

                <!-- Sequencing Container -->
                <div id="sequencingContainer" style="margin-top: 16px;">
                    <label style="font-size: 13px; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 2px;">⚡ Set Opening Sequence:</label>
                    <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px;">Use the arrows to arrange the order in which these subforums will be opened.</p>
                    <div id="orderList" class="preview-list"></div>
                </div>
            `;
            builderContent.innerHTML = interfaceHtml;

            const orderListDiv = document.getElementById('orderList');

            const renderOrderList = () => {
                if (orderedSubforums.length === 0) {
                    document.getElementById('sequencingContainer').style.display = 'none';
                    return;
                }
                document.getElementById('sequencingContainer').style.display = 'block';

                orderListDiv.innerHTML = orderedSubforums.map((item, idx) => {
                    return `
                        <div class="preview-item" data-url="${item.url}" style="padding: 6px 12px; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-weight: 700; color: #818cf8; font-size: 12px;">#${idx + 1}</span>
                                <span class="preview-title" style="font-size: 13px; font-weight: 500;">${item.title}</span>
                            </div>
                            <div style="display: flex; gap: 4px;">
                                <button type="button" class="btn-small btn-move-up" data-index="${idx}" style="padding: 2px 6px;" ${idx === 0 ? 'disabled' : ''}>▲</button>
                                <button type="button" class="btn-small btn-move-down" data-index="${idx}" style="padding: 2px 6px;" ${idx === orderedSubforums.length - 1 ? 'disabled' : ''}>▼</button>
                            </div>
                        </div>
                    `;
                }).join('');

                // Wire up move buttons
                document.querySelectorAll('.btn-move-up').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const idx = parseInt(e.target.dataset.index, 10);
                        if (idx > 0) {
                            const temp = orderedSubforums[idx];
                            orderedSubforums[idx] = orderedSubforums[idx - 1];
                            orderedSubforums[idx - 1] = temp;
                            renderOrderList();
                        }
                    });
                });

                document.querySelectorAll('.btn-move-down').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const idx = parseInt(e.target.dataset.index, 10);
                        if (idx < orderedSubforums.length - 1) {
                            const temp = orderedSubforums[idx];
                            orderedSubforums[idx] = orderedSubforums[idx + 1];
                            orderedSubforums[idx + 1] = temp;
                            renderOrderList();
                        }
                    });
                });
            };

            renderOrderList();

            // Wire up checkbox state listeners
            document.querySelectorAll('.subforum-checkbox').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const url = e.target.value;
                    const title = e.target.dataset.title;
                    if (e.target.checked) {
                        if (!orderedSubforums.some(s => s.url === url)) {
                            orderedSubforums.push({ url, title });
                        }
                    } else {
                        orderedSubforums = orderedSubforums.filter(s => s.url !== url);
                    }
                    renderOrderList();
                });
            });

            document.getElementById('builderSelectAll').addEventListener('click', () => {
                document.querySelectorAll('.subforum-checkbox').forEach(cb => {
                    cb.checked = true;
                    const url = cb.value;
                    const title = cb.dataset.title;
                    if (!orderedSubforums.some(s => s.url === url)) {
                        orderedSubforums.push({ url, title });
                    }
                });
                renderOrderList();
            });

            document.getElementById('builderClearAll').addEventListener('click', () => {
                document.querySelectorAll('.subforum-checkbox').forEach(cb => cb.checked = false);
                orderedSubforums = [];
                renderOrderList();
            });

            const newSaveHandler = () => {
                const checkedUrls = orderedSubforums.map(s => s.url);

                if (checkedUrls.length === 0) {
                    setStatus('Please select at least one subforum to open.', true);
                    return;
                }

                const existingIndex = subforumRules.findIndex(r => normalizeUrl(r.pageUrl) === normalizeUrl(pageUrl));
                if (existingIndex > -1) {
                    subforumRules[existingIndex].subforumUrls = checkedUrls;
                } else {
                    subforumRules.push({ pageUrl, subforumUrls: checkedUrls });
                }

                saveSubforumRules();
                setStatus('Subforum sequence saved successfully from Interactive Builder!');
            };

            const oldSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(oldSaveBtn, saveBtn);
            oldSaveBtn.addEventListener('click', newSaveHandler);

        } else if (type === 'threads') {
            const existingRule = threadRules.find(r => normalizeUrl(r.pageUrl) === normalizeUrl(pageUrl));
            const savedUrls = existingRule ? existingRule.threadUrls : [];

            // Initialize orderedThreads in the saved order
            let orderedThreads = [];
            savedUrls.forEach(url => {
                const found = items.find(item => normalizeUrl(item.url) === normalizeUrl(url));
                if (found) {
                    orderedThreads.push(found);
                }
            });
            // For items not in the saved list but checked (or if no rule exists yet), default to checked in document order
            if (!existingRule) {
                orderedThreads = [...items];
            }

            const interfaceHtml = `
                <p>Check the threads you want the scanner to open. Unchecked threads will be automatically marked as read.</p>
                <div class="builder-bulk-actions">
                    <button type="button" class="btn-small" id="builderSelectAll">Select All</button>
                    <button type="button" class="btn-small" id="builderClearAll">Clear All</button>
                </div>
                <div class="builder-checkbox-grid">
                    ${items.map((item, idx) => {
                        const isChecked = orderedThreads.some(s => s.url === item.url) ? 'checked' : '';
                        return `
                            <label class="builder-checkbox-label">
                                <input type="checkbox" class="thread-checkbox" value="${item.url}" data-title="${item.title}" ${isChecked}>
                                <span>${item.title}</span>
                            </label>
                        `;
                    }).join('')}
                </div>

                <!-- Sequencing Container -->
                <div id="sequencingContainer" style="margin-top: 16px;">
                    <label style="font-size: 13px; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 2px;">⚡ Set Opening Sequence:</label>
                    <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px;">Use the arrows to arrange the order in which these threads will be opened.</p>
                    <div id="orderList" class="preview-list"></div>
                </div>
            `;
            builderContent.innerHTML = interfaceHtml;

            const orderListDiv = document.getElementById('orderList');

            const renderOrderList = () => {
                if (orderedThreads.length === 0) {
                    document.getElementById('sequencingContainer').style.display = 'none';
                    return;
                }
                document.getElementById('sequencingContainer').style.display = 'block';

                orderListDiv.innerHTML = orderedThreads.map((item, idx) => {
                    return `
                        <div class="preview-item" data-url="${item.url}" style="padding: 6px 12px; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-weight: 700; color: #818cf8; font-size: 12px;">#${idx + 1}</span>
                                <span class="preview-title" style="font-size: 13px; font-weight: 500;">${item.title}</span>
                            </div>
                            <div style="display: flex; gap: 4px;">
                                <button type="button" class="btn-small btn-move-up" data-index="${idx}" style="padding: 2px 6px;" ${idx === 0 ? 'disabled' : ''}>▲</button>
                                <button type="button" class="btn-small btn-move-down" data-index="${idx}" style="padding: 2px 6px;" ${idx === orderedThreads.length - 1 ? 'disabled' : ''}>▼</button>
                            </div>
                        </div>
                    `;
                }).join('');

                // Wire up move buttons
                document.querySelectorAll('.btn-move-up').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const idx = parseInt(e.target.dataset.index, 10);
                        if (idx > 0) {
                            const temp = orderedThreads[idx];
                            orderedThreads[idx] = orderedThreads[idx - 1];
                            orderedThreads[idx - 1] = temp;
                            renderOrderList();
                        }
                    });
                });

                document.querySelectorAll('.btn-move-down').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const idx = parseInt(e.target.dataset.index, 10);
                        if (idx < orderedThreads.length - 1) {
                            const temp = orderedThreads[idx];
                            orderedThreads[idx] = orderedThreads[idx + 1];
                            orderedThreads[idx + 1] = temp;
                            renderOrderList();
                        }
                    });
                });
            };

            renderOrderList();

            // Wire up checkbox state listeners
            document.querySelectorAll('.thread-checkbox').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const url = e.target.value;
                    const title = e.target.dataset.title;
                    if (e.target.checked) {
                        if (!orderedThreads.some(s => s.url === url)) {
                            orderedThreads.push({ url, title });
                        }
                    } else {
                        orderedThreads = orderedThreads.filter(s => s.url !== url);
                    }
                    renderOrderList();
                });
            });

            document.getElementById('builderSelectAll').addEventListener('click', () => {
                document.querySelectorAll('.thread-checkbox').forEach(cb => {
                    cb.checked = true;
                    const url = cb.value;
                    const title = cb.dataset.title;
                    if (!orderedThreads.some(s => s.url === url)) {
                        orderedThreads.push({ url, title });
                    }
                });
                renderOrderList();
            });

            document.getElementById('builderClearAll').addEventListener('click', () => {
                document.querySelectorAll('.thread-checkbox').forEach(cb => cb.checked = false);
                orderedThreads = [];
                renderOrderList();
            });

            const newSaveHandler = () => {
                const checkedUrls = orderedThreads.map(s => s.url);

                if (checkedUrls.length === 0) {
                    setStatus('Please select at least one thread to open.', true);
                    return;
                }

                const existingIndex = threadRules.findIndex(r => normalizeUrl(r.pageUrl) === normalizeUrl(pageUrl));
                if (existingIndex > -1) {
                    threadRules[existingIndex].threadUrls = checkedUrls;
                } else {
                    threadRules.push({ pageUrl, threadUrls: checkedUrls });
                }

                saveThreadRules();
                setStatus('Thread sequence saved successfully from Interactive Builder!');
            };

            const oldSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(oldSaveBtn, saveBtn);
            oldSaveBtn.addEventListener('click', newSaveHandler);
        }
    }

    addSubforumRuleButton.addEventListener('click', addSubforumRule);
    addThreadRuleButton.addEventListener('click', addThreadRule);
    
    loadAllRules();
});

// Standalone function used for dynamic execution inside page context
function scrapePageForRules() {
    const hasSubforums = document.querySelector('.p-body-pageContent .node-list');
    const hasThreads = document.querySelector('.p-body-pageContent .structItemContainer-group.js-threadList');

    if (hasSubforums) {
        const subforums = [];
        document.querySelectorAll('.node.node--forum').forEach(item => {
            const link = item.querySelector('.node-main .node-title a');
            if (link && link.href) {
                subforums.push({
                    url: link.href,
                    title: link.innerText.trim()
                });
            }
        });
        document.querySelectorAll('.subNodeLink').forEach(link => {
            if (link.href) {
                subforums.push({
                    url: link.href,
                    title: link.innerText.trim()
                });
            }
        });
        
        const uniqueSubforums = [];
        const seen = new Set();
        subforums.forEach(s => {
            if (!seen.has(s.url)) {
                seen.add(s.url);
                uniqueSubforums.push(s);
            }
        });
        return { success: true, type: 'subforums', items: uniqueSubforums };
    }

    if (hasThreads) {
        const threads = [];
        document.querySelectorAll('.structItem.structItem--thread').forEach(item => {
            const titleLink = item.querySelector('.structItem-title a[data-tp-primary="on"]');
            if (titleLink) {
                threads.push({
                    title: titleLink.innerText.trim(),
                    url: titleLink.href
                });
            }
        });
        return { success: true, type: 'threads', items: threads };
    }

    return { success: false, error: 'Page has no subforums or thread list.' };
}