// DOM Elements
const pollsContainer = document.getElementById('pollsContainer');
const createPollBtn = document.getElementById('createPollBtn');
const modal = document.getElementById('createPollModal');
const closeBtn = document.querySelector('.close');
const createPollForm = document.getElementById('createPollForm');
const addOptionBtn = document.getElementById('addOptionBtn');
const optionsContainer = document.getElementById('optionsContainer');
const resetBtn = document.getElementById('resetBtn');

// Reset Password Modal Elements
const resetPasswordModal = document.getElementById('resetPasswordModal');
const closeResetModalBtn = document.querySelector('.close-reset');
const resetPasswordForm = document.getElementById('resetPasswordForm');

// State Management
let polls = [];

// Event Listeners Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadPolls();
    setupEventListeners();
});

function setupEventListeners() {
    // Create Poll Button
    createPollBtn.addEventListener('click', () => {
        modal.style.display = "block";
    });

    // Close Create Poll Modal
    closeBtn.addEventListener('click', () => {
        modal.style.display = "none";
        resetCreatePollForm();
    });

    // Add Option Button
    addOptionBtn.addEventListener('click', addPollOption);

    // Create Poll Form Submit
    createPollForm.addEventListener('submit', createPoll);

    // Reset Polls Button
    resetBtn.addEventListener('click', resetPolls);

    // Reset Password Modal Close
    if (closeResetModalBtn) {
        closeResetModalBtn.addEventListener('click', () => {
            resetPasswordModal.style.display = "none";
        });
    }

    // Reset Password Form Submit
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', submitResetPassword);
    }

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target == modal) {
            modal.style.display = "none";
            resetCreatePollForm();
        }
        if (e.target == resetPasswordModal) {
            resetPasswordModal.style.display = "none";
        }
    });
}

// Reset Create Poll Form
function resetCreatePollForm() {
    createPollForm.reset();
    optionsContainer.innerHTML = `
        <input type="text" class="option-input" placeholder="Option 1" required>
        <input type="text" class="option-input" placeholder="Option 2" required>
    `;
}

// Add Poll Option Dynamically
function addPollOption() {
    const optionInput = document.createElement('input');
    optionInput.type = 'text';
    optionInput.classList.add('option-input');
    optionInput.placeholder = `Option ${optionsContainer.children.length + 1}`;
    optionInput.required = true;
    optionsContainer.appendChild(optionInput);
}

// Create New Poll
async function createPoll(e) {
    e.preventDefault();
    
    const question = document.getElementById('question').value.trim();
    const options = Array.from(document.getElementsByClassName('option-input'))
        .map(input => input.value.trim())
        .filter(value => value !== '');

    // Validate inputs
    if (!question) {
        showNotification('Please enter a question', 'error');
        return;
    }

    if (options.length < 2) {
        showNotification('Please add at least 2 options', 'error');
        return;
    }

    try {
        const response = await fetch('/api/polls', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question, options })
        });

        if (response.ok) {
            const newPoll = await response.json();
            showNotification('Poll created successfully!', 'success');
            
            // Reset form and close modal
            modal.style.display = "none";
            resetCreatePollForm();

            // Reload polls
            loadPolls();
        } else {
            const errorData = await response.json();
            showNotification(errorData.message || 'Failed to create poll', 'error');
        }
    } catch (error) {
        console.error('Error creating poll:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

// Load Polls
async function loadPolls() {
    try {
        const response = await fetch('/api/polls');
        polls = await response.json();
        displayPolls(polls);
    } catch (error) {
        console.error('Error loading polls:', error);
        showNotification('Failed to load polls', 'error');
    }
}

// Display Polls
function displayPolls(polls) {
    if (polls.length === 0) {
        pollsContainer.innerHTML = `
            <div class="no-polls">
                <p>No polls available. Create your first poll!</p>
            </div>
        `;
        return;
    }

    pollsContainer.innerHTML = polls.map(poll => `
        <div class="poll-card" data-poll-id="${poll.id}">
            <h2 class="poll-question">${poll.question}</h2>
            <div class="poll-options">
                ${poll.options.map(option => `
                    <div class="poll-option" data-option-id="${option.id}">
                        <div class="option-details">
                            <span class="option-text">${option.text}</span>
                            <span class="vote-count">${option.votes} votes</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress" style="width: ${calculatePercentage(option.votes, poll.options)}%"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="poll-actions">
                <button class="vote-btn" onclick="votePoll(${poll.id})">Vote</button>
                <button class="delete-btn" onclick="deletePoll(${poll.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

// Calculate Vote Percentage
function calculatePercentage(votes, options) {
    const totalVotes = options.reduce((sum, option) => sum + option.votes, 0);
    return totalVotes === 0 ? 0 : (votes / totalVotes * 100).toFixed(2);
}

// Vote on a Poll
async function votePoll(pollId) {
    const pollCard = document.querySelector(`.poll-card[data-poll-id="${pollId}"]`);
    const selectedOption = pollCard.querySelector('.poll-option.selected');

    if (!selectedOption) {
        showNotification('Please select an option', 'error');
        return;
    }

    const optionId = selectedOption.dataset.optionId;

    try {
        const response = await fetch(`/api/polls/${pollId}/vote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ optionId: parseInt(optionId) })
        });

        if (response.ok) {
            showNotification('Vote submitted successfully!', 'success');
            loadPolls();
        } else {
            const errorData = await response.json();
            showNotification(errorData.message || 'Failed to submit vote', 'error');
        }
    } catch (error) {
        console.error('Error voting:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

// Delete Poll
async function deletePoll(pollId) {
    if (!confirm('Are you sure you want to delete this poll?')) return;

    try {
        const response = await fetch(`/api/polls/${pollId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification('Poll deleted successfully!', 'success');
            loadPolls();
        } else {
            const errorData = await response.json();
            showNotification(errorData.message || 'Failed to delete poll', 'error');
        }
    } catch (error) {
        console.error('Error deleting poll:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

// Reset Polls (Show Password Modal)
function resetPolls() {
    resetPasswordModal.style.display = "block";
}

// Submit Reset Password
async function submitResetPassword(e) {
    e.preventDefault();
    
    const password = document.getElementById('resetPassword').value;

    try {
        const response = await fetch('/api/reset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });

        if (response.ok) {
            showNotification('All polls have been reset!', 'success');
            loadPolls();
            resetPasswordModal.style.display = "none";
            resetPasswordForm.reset();
        } else {
            const errorData = await response.json();
            showNotification(errorData.error || 'Failed to reset polls', 'error');
        }
    } catch (error) {
        console.error('Error resetting polls:', error);
        showNotification('Network error. Please try again.', 'error');
    }
}

// Notification System
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.classList.add('notification', type);
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add event delegation for selecting poll options
document.addEventListener('click', (e) => {
    const pollOption = e.target.closest('.poll-option');
    if (pollOption && pollOption.closest('.poll-card')) {
        const pollCard = pollOption.closest('.poll-card');
        pollCard.querySelectorAll('.poll-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        pollOption.classList.add('selected');
    }
});