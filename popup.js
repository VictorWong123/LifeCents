// DOM elements
const hourlyRateInput = document.getElementById('hourlyRate');
const tooltipTextInput = document.getElementById('tooltipText');
const settingsForm = document.getElementById('settingsForm');
const displayModeRadios = document.querySelectorAll('input[name="displayMode"]');

let userSettings = {
    hourlyRate: 25,
    displayMode: 'price-only',
    tooltipText: 'Time to earn this'
};

// Load saved settings on popup open
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    updateInputs();
});

settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hourlyRate = parseFloat(hourlyRateInput.value);
    const tooltipText = tooltipTextInput.value.trim();
    const displayMode = document.querySelector('input[name="displayMode"]:checked').value;

    if (hourlyRate <= 0) {
        showNotification('Please enter a valid hourly wage.', 'error');
        return;
    }

    if (!tooltipText) {
        showNotification('Please enter tooltip text.', 'error');
        return;
    }

    userSettings = { hourlyRate, displayMode, tooltipText };

    try {
        await chrome.storage.sync.set({ userSettings });
        showNotification('Settings saved successfully!', 'success');

        // Send message to content script to update highlighting
        sendMessageToTab({ action: 'highlight' });
    } catch (error) {
        showNotification('Failed to save settings.', 'error');
    }
});

async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get('userSettings');
        if (result.userSettings) {
            userSettings = { ...userSettings, ...result.userSettings };
        }
    } catch (error) {
        console.log('Error loading settings:', error);
    }
}

function updateInputs() {
    hourlyRateInput.value = userSettings.hourlyRate;
    tooltipTextInput.value = userSettings.tooltipText;

    // Set the correct radio button
    const targetRadio = document.querySelector(`input[name="displayMode"][value="${userSettings.displayMode}"]`);
    if (targetRadio) {
        targetRadio.checked = true;
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function sendMessageToTab(message) {
    if (!chrome.tabs) return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, message);
        }
    });
}

// Input validation
hourlyRateInput.addEventListener('input', () => {
    const value = parseFloat(hourlyRateInput.value);
    if (value < 0) {
        hourlyRateInput.value = 0;
    }
});

// Add some visual feedback for form submission
settingsForm.addEventListener('submit', (e) => {
    const saveButton = e.target.querySelector('.save-button');
    saveButton.style.transform = 'scale(0.98)';
    setTimeout(() => {
        saveButton.style.transform = '';
    }, 150);
}); 