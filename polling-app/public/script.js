// Predefined questions and their options
const presetQuestions = {
    1: {
        question: "How Do You Prefer to Learn New Skills?",
        options: ["Online Courses", "Hands-on Practice", "Mentorship", "Traditional Training"]
    },
    2: {
        question: "What's Your Preferred Work Environment?",
        options: ["Remote Work", "Office Space", "Hybrid Model", "Co-working Space"]
    },
    3: {
        question: "Which Technology Interests You Most?",
        options: ["Artificial Intelligence", "Blockchain", "Cloud Computing", "IoT"]
    }
};

// DOM Elements
const questionOptions = document.querySelectorAll('.question-option');
const customQuestionInput = document.getElementById('custom-question');
const presetOptionsDiv = document.getElementById('preset-options');
const customOptionsDiv = document.getElementById('custom-options');
const addOptionBtn = document.getElementById('add-option');
const customOptionsList = document.getElementById('custom-options-list');
const createPollBtn = document.getElementById('create-poll');

// Event Listeners
questionOptions.forEach(option => {
    const radio = option.querySelector('input[type="radio"]');
    radio.addEventListener('change', () => handleQuestionSelection(option));
});

addOptionBtn.addEventListener('click', addCustomOption);
createPollBtn.addEventListener('click', createPoll);

// Handle Question Selection
function handleQuestionSelection(option) {
    const isCustom = option.classList.contains('custom');
    customQuestionInput.disabled = !isCustom;
    
    if (isCustom) {
        showCustomOptionsSection();
    } else {
        showPresetOptions(option.dataset.question);
    }
}

// Show Preset Options
function showPresetOptions(questionId) {
    customOptionsDiv.style.display = 'none';
    presetOptionsDiv.style.display = 'block';
    
    const options = presetQuestions[questionId].options;
    presetOptionsDiv.innerHTML = options.map((option, index) => `
        <div class="option-item">
            <input type="checkbox" id="option${index}" value="${option}">
            <label for="option${index}">${option}</label>
        </div>
    `).join('');
}

// Show Custom Options Section
function showCustomOptionsSection() {
    presetOptionsDiv.style.display = 'none';
    customOptionsDiv.style.display = 'block';
    customOptionsList.innerHTML = ''; // Clear existing options
    addCustomOption(); // Add first option field
    addCustomOption(); // Add second option field
}

// Add Custom Option
function addCustomOption() {
    const optionDiv = document.createElement('div');
    optionDiv.className = 'custom-option-input';
    optionDiv.innerHTML = `
        <input type="text" placeholder="Enter option text" class="option-text">
        <button class="remove-option" onclick="removeOption(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    customOptionsList.appendChild(optionDiv);
}

// Remove Option
function removeOption(button) {
    const optionDiv = button.parentElement;
    if (customOptionsList.children.length > 2) { // Maintain minimum 2 options
        optionDiv.remove();
    } else {
        showNotification('Minimum 2 options required', 'error');
    }
}

// Create Poll
async function createPoll() {
    const selectedQuestion = document.querySelector('input[name="question"]:checked');
    if (!selectedQuestion) {
        showNotification('Please select a question', 'error');
        return;
    }

    let question, options;

    if (selectedQuestion.id === 'custom') {
        question = customQuestionInput.value.trim();
        options = Array.from(customOptionsList.querySelectorAll('.option-text'))
            .map(input => input.value.trim())
            .filter(text => text !== '');
    } else {
        const questionId = selectedQuestion.parentElement.dataset.question;
        const selectedOptions = Array.from(presetOptionsDiv.querySelectorAll('input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value);
        question = presetQuestions[questionId].question;
        options = selectedOptions;
    }

    // Validate
    if (!question) {
        showNotification('Please enter a question', 'error');
        return;
    }
    if (options.length < 2) {
        showNotification('Please provide at least 2 options', 'error');
        return;
    }

    try {
        showLoading(true);
        const response = await fetch(`${API_URL}/api/polls`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question, options })
        });

        if (!response.ok) throw new Error('Failed to create poll');

        const poll = await response.json();
        showPoll(poll);
        showNotification('Poll created successfully!', 'success');
    } catch (error) {
        console.error('Error:', error);
        showNotification('Failed to create poll', 'error');
    } finally {
        showLoading(false);
    }
}

// Show Poll
function showPoll(poll) {
    document.querySelector('.poll-creator').style.display = 'none';
    const pollDisplay = document.querySelector('.poll-display');
    pollDisplay.style.display = 'block';
    
    // Add poll display HTML here (similar to original poll display)
    // You can reuse the poll display code from the previous version
}

// Utility Functions (loading, notifications, etc.)
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

function showNotification(message, type) {
    // Implementation remains the same
}