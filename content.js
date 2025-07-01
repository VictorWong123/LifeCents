console.log('[LifeCents] Content script loaded');

// Store original text content for restoration
const originalTextMap = new WeakMap();

// Get user settings from storage
async function getUserSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get('userSettings', (result) => {
            resolve(result.userSettings || {
                hourlyRate: 25,
                displayMode: 'price-only',
                tooltipText: 'Time to earn this'
            });
        });
    });
}

// Convert price to time string
function priceToTime(price, hourlyRate) {
    if (!hourlyRate || hourlyRate <= 0) return price;

    const hours = price / hourlyRate;

    if (hours < 1) {
        const minutes = Math.round(hours * 60);
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (hours < 8) {
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    } else {
        const days = Math.round(hours / 8 * 10) / 10; // Assuming 8-hour workday
        return `${days} day${days !== 1 ? 's' : ''}`;
    }
}

// Add CSS for highlighting and tooltips
if (!document.getElementById('lifecents-style')) {
    const style = document.createElement('style');
    style.id = 'lifecents-style';
    style.textContent = `
        .lifecents-highlight { 
            background: rgba(255, 235, 59, 0.3) !important; 
            color: inherit !important; 
            padding: 2px 4px;
            border-radius: 3px;
            border: 1px solid rgba(255, 193, 7, 0.5);
            cursor: help;
            position: relative;
        }
        .lifecents-replaced {
            color: inherit !important;
            font-weight: inherit !important;
            background: transparent !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
        }
        .lifecents-tooltip {
            position: absolute;
            background: #333;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            white-space: nowrap;
            z-index: 10000;
            pointer-events: none;
            opacity: 0;
            transform: translateY(-100%);
            transition: opacity 0.2s ease;
            top: -10px;
            left: 50%;
            transform: translateX(-50%) translateY(-100%);
        }
        .lifecents-tooltip::after {
            content: '';
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            border: 5px solid transparent;
            border-top-color: #333;
        }
        .lifecents-highlight:hover .lifecents-tooltip {
            opacity: 1;
        }
    `;
    document.head.appendChild(style);
}

// Create tooltip element
function createTooltip(price, settings) {
    const timeString = priceToTime(price, settings.hourlyRate);
    const tooltip = document.createElement('div');
    tooltip.className = 'lifecents-tooltip';
    tooltip.textContent = `${settings.tooltipText}: ${timeString}`;
    return tooltip;
}

// Clear all extension modifications and restore original content
function clearAllModifications() {
    console.log('[LifeCents] Clearing all modifications');

    // First remove all tooltips
    document.querySelectorAll('.lifecents-tooltip').forEach(tooltip => {
        tooltip.remove();
    });

    // Restore Amazon price containers to their original HTML
    document.querySelectorAll('.a-price.lifecents-replaced').forEach(el => {
        if (originalTextMap.has(el)) {
            const originalHTML = originalTextMap.get(el);
            el.innerHTML = originalHTML;
            el.classList.remove('lifecents-replaced');
            originalTextMap.delete(el);
        }
    });

    // Restore text price spans to original text nodes
    document.querySelectorAll('span.lifecents-replaced').forEach(el => {
        const parent = el.parentElement;
        if (parent && originalTextMap.has(parent)) {
            const originalText = originalTextMap.get(parent);
            const textNode = document.createTextNode(originalText);
            parent.replaceChild(textNode, el);
            parent.classList.remove('lifecents-processed');
            originalTextMap.delete(parent);
        }
    });

    // Remove highlighting from text spans and restore to text nodes
    document.querySelectorAll('span.lifecents-highlight').forEach(el => {
        const parent = el.parentElement;
        if (parent) {
            const textNode = document.createTextNode(el.textContent);
            parent.replaceChild(textNode, el);
            parent.classList.remove('lifecents-processed');
        }
    });

    // Remove highlighting from Amazon price containers
    document.querySelectorAll('.a-price.lifecents-highlight').forEach(el => {
        el.classList.remove('lifecents-highlight');
    });

    // Clean up any remaining processed markers
    document.querySelectorAll('.lifecents-processed').forEach(el => {
        el.classList.remove('lifecents-processed');
    });

    console.log('[LifeCents] All modifications cleared');
}

// Process Amazon price symbol elements
function processAmazonPrices(settings) {
    console.log(`[LifeCents] Processing Amazon price symbols with mode: ${settings.displayMode}`);

    // Find all a-price elements (containers) that haven't been processed
    const priceContainers = document.querySelectorAll('.a-price:not(.lifecents-processed)');
    console.log(`[LifeCents] Found ${priceContainers.length} unprocessed Amazon price containers`);

    priceContainers.forEach((priceContainer) => {
        // Mark as processed to avoid double processing
        priceContainer.classList.add('lifecents-processed');

        // Find price components
        const symbolEl = priceContainer.querySelector('.a-price-symbol');
        const wholeEl = priceContainer.querySelector('.a-price-whole');
        const fractionEl = priceContainer.querySelector('.a-price-fraction');

        if (symbolEl && wholeEl) {
            // Construct the full price
            const wholePart = wholeEl.textContent.replace(/,/g, '');
            const fractionPart = fractionEl ? fractionEl.textContent : '00';
            const price = parseFloat(`${wholePart}.${fractionPart}`);

            console.log(`[LifeCents] Found Amazon price: $${price}`);

            if (price > 0) {
                if (settings.displayMode === 'time-only') {
                    // Store original content before replacing
                    if (!originalTextMap.has(priceContainer)) {
                        originalTextMap.set(priceContainer, priceContainer.innerHTML);
                    }

                    // Replace the price with time
                    const timeString = priceToTime(price, settings.hourlyRate);
                    priceContainer.innerHTML = '';
                    priceContainer.textContent = timeString;
                    priceContainer.classList.add('lifecents-replaced');
                    console.log(`[LifeCents] Replaced Amazon price $${price} with ${timeString}`);

                } else if (settings.displayMode === 'both') {
                    // Highlight with tooltip
                    priceContainer.classList.add('lifecents-highlight');
                    const tooltip = createTooltip(price, settings);
                    priceContainer.appendChild(tooltip);
                    console.log(`[LifeCents] Added tooltip to Amazon price: $${price}`);
                }
                // For 'price-only' mode, do nothing
            }
        }
    });
}

// Process regular text prices
function processTextPrices(settings) {
    console.log(`[LifeCents] Processing text prices with mode: ${settings.displayMode}`);

    // Find all text nodes that contain dollar signs
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function (node) {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                const tagName = parent.tagName.toLowerCase();
                if (['script', 'style', 'noscript', 'textarea', 'input'].includes(tagName)) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Skip Amazon price elements
                if (parent.closest('.a-price') || parent.classList.contains('a-price-symbol') ||
                    parent.classList.contains('a-price-whole') || parent.classList.contains('a-price-fraction')) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Skip already processed elements
                if (parent.classList.contains('lifecents-processed')) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Skip elements that are already modified
                if (parent.querySelector('.lifecents-highlight, .lifecents-replaced')) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Only process nodes that contain dollar signs and numbers
                if (node.textContent.includes('$') && /\d/.test(node.textContent)) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_REJECT;
            }
        }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }

    console.log(`[LifeCents] Found ${textNodes.length} text nodes with $ and numbers`);

    textNodes.forEach((textNode) => {
        const text = textNode.textContent;
        const priceRegex = /\$([0-9]+(?:\.[0-9]{1,2})?)/g;
        const matches = [...text.matchAll(priceRegex)];

        if (matches.length > 0) {
            console.log(`[LifeCents] Found prices in text: "${text}"`);

            // Mark parent as processed
            textNode.parentElement.classList.add('lifecents-processed');

            // Get the first price for processing
            const price = parseFloat(matches[0][1]);
            if (price > 0) {
                if (settings.displayMode === 'time-only') {
                    // Store original text before replacing
                    if (!originalTextMap.has(textNode.parentElement)) {
                        originalTextMap.set(textNode.parentElement, text);
                    }

                    // Replace prices with time in the text
                    let newText = text;
                    matches.forEach(match => {
                        const matchPrice = parseFloat(match[1]);
                        if (matchPrice > 0) {
                            const timeString = priceToTime(matchPrice, settings.hourlyRate);
                            newText = newText.replace(match[0], timeString);
                        }
                    });

                    const span = document.createElement('span');
                    span.className = 'lifecents-replaced';
                    span.textContent = newText;
                    textNode.parentElement.replaceChild(span, textNode);
                    console.log(`[LifeCents] Replaced text price $${price} with time`);

                } else if (settings.displayMode === 'both') {
                    // Highlight with tooltip
                    const span = document.createElement('span');
                    span.classList.add('lifecents-highlight');
                    span.textContent = text;

                    const tooltip = createTooltip(price, settings);
                    span.appendChild(tooltip);

                    textNode.parentElement.replaceChild(span, textNode);
                    console.log(`[LifeCents] Added tooltip to text price: $${price}`);
                }
                // For 'price-only' mode, do nothing
            }
        }
    });
}

// Process all prices on the page
function processAllPrices() {
    console.log(`[LifeCents] Processing all prices`);

    getUserSettings().then(settings => {
        console.log(`[LifeCents] Using settings:`, settings);

        // Always clear previous modifications first
        clearAllModifications();

        // Wait a bit for DOM cleanup, then process if needed
        setTimeout(() => {
            // Only process if not in price-only mode
            if (settings.displayMode !== 'price-only') {
                // Process both types of prices
                processAmazonPrices(settings);
                processTextPrices(settings);
            }
        }, 10);
    });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[LifeCents] Received message:', message);

    if (message.action === 'highlight') {
        processAllPrices();
    }
});

// Auto-run on page load
document.addEventListener('DOMContentLoaded', processAllPrices);
if (document.readyState !== 'loading') {
    processAllPrices();
} 