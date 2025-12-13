// options.js
document.addEventListener('DOMContentLoaded', () => {
    const statusDiv = document.getElementById('status');

    // --- Subforum Rule Elements ---
    const subforumPageUrlInput = document.getElementById('subforumPageUrl');
    const customSubforumsTextarea = document.getElementById('customSubforums');
    const addSubforumRuleButton = document.getElementById('addSubforumRuleButton');
    const subforumRulesListDiv = document.getElementById('subforumRulesList');

    // --- Thread Rule Elements ---
    const threadPageUrlInput = document.getElementById('threadPageUrl');
    const includeKeywordsInput = document.getElementById('includeKeywords');
    const excludeKeywordsInput = document.getElementById('excludeKeywords');
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

        const existingRuleIndex = subforumRules.findIndex(rule => rule.pageUrl === pageUrl);
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
                <div><strong>Include:</strong> ${rule.includeKeywords.join(', ')}</div>
                <div><strong>Exclude:</strong> ${rule.excludeKeywords.join(', ')}</div>
            `;
            threadRulesListDiv.appendChild(ruleDiv);
        });
        document.querySelectorAll('.delete-thread-rule').forEach(button => {
            button.addEventListener('click', deleteThreadRule);
        });
    }

    function addThreadRule() {
        const pageUrl = threadPageUrlInput.value.trim();
        const includeKeywords = includeKeywordsInput.value.split(',').map(kw => kw.trim()).filter(kw => kw);
        const excludeKeywords = excludeKeywordsInput.value.split(',').map(kw => kw.trim()).filter(kw => kw);

        if (!pageUrl) {
            setStatus('Please provide a subforum page URL for the thread rule.', true);
            return;
        }

        const existingRuleIndex = threadRules.findIndex(rule => rule.pageUrl === pageUrl);
        if (existingRuleIndex > -1) {
            threadRules[existingRuleIndex] = { pageUrl, includeKeywords, excludeKeywords };
        } else {
            threadRules.push({ pageUrl, includeKeywords, excludeKeywords });
        }
        
        saveThreadRules();
        threadPageUrlInput.value = '';
        includeKeywordsInput.value = '';
        excludeKeywordsInput.value = '';
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
            // Heuristic to decide which form to fill
            // This could be improved, e.g. by checking if it's a thread or forum list URL
            if (decodedUrl.includes('/threads/')) {
                 threadPageUrlInput.value = decodedUrl;
            } else {
                 subforumPageUrlInput.value = decodedUrl;
                 const existingRule = subforumRules.find(rule => rule.pageUrl === decodedUrl);
                 if (existingRule) {
                     customSubforumsTextarea.value = existingRule.subforumUrls.join('\n');
                 }
            }
        }
    }

    addSubforumRuleButton.addEventListener('click', addSubforumRule);
    addThreadRuleButton.addEventListener('click', addThreadRule);
    
    loadAllRules();
});