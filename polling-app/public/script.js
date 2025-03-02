// DOM Elements
const pollsContainer = document.getElementById('pollsContainer');
const createPollBtn = document.getElementById('createPollBtn');
const modal = document.getElementById('createPollModal');
const closeBtn = document.querySelector('.close');
const createPollForm = document.getElementById('createPollForm');
const addOptionBtn = document.getElementById('addOptionBtn');
const optionsContainer = document.getElementById('optionsContainer');
const resetBtn = document.getElementById('resetBtn');

// Event Listeners
createPollBtn.onclick = () => modal.style.display = "block";
closeBtn.onclick = () => modal.style.display = "none";
window.onclick = (e) => {
    if (e.target == modal) modal.style.display = "none";
}

// Add this event listener
resetBtn.onclick = async () => {
    if (confirm('Are you sure you want to reset all polls? This cannot be undone.')) {
        try {
            const response = await fetch('/api/reset', {
                method: 'POST'
            });
            
            if (response.ok) {
                alert('All polls have been reset!');
                loadPolls(); // Refresh the polls display
            }
        } catch (error) {
            console.error('Error resetting polls:', error);
            alert('Failed to reset polls');
        }
    }
};

// Add Option Button
addOptionBtn.onclick = () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'option-input';
    input.required = true;
    optionsContainer.appendChild(input);
}

// Create Poll Form Submit
createPollForm.onsubmit = async (e) => {
    e.preventDefault();
    
    const question = document.getElementById('question').value;
    const options = [...document.getElementsByClassName('option-input')]
        .map(input => input.value)
        .filter(value => value.trim() !== '');

    try {
        const response = await fetch('/api/polls', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question, options })
        });

        if (response.ok) {
            modal.style.display = "none";
            createPollForm.reset();
            loadPolls();
        }
    } catch (error) {
        console.error('Error creating poll:', error);
    }
}

// Load Polls
async function loadPolls() {
    try {
        const response = await fetch('/api/polls');
        const polls = await response.json();
        displayPolls(polls);
    } catch (error) {
        console.error('Error loading polls:', error);
    }
}

// Display Polls
function displayPolls(polls) {
    pollsContainer.innerHTML = polls.map(poll => `
        <div class="poll-card" data-poll-id="${poll.id}">
            <h2 class="poll-question">${poll.question}</h2>
            <div class="poll-options">
                ${poll.options.map(option => `
                    <div class="poll-option" data-option-id="${option.id}">
                        <div class="option-text">${option.text}</div>
                        <div class="progress-bar">
                            <div class="progress" style="width: ${calculatePercentage(option.votes, poll.options)}%"></div>
                        </div>
                        <div class="vote-count">${option.votes} votes</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');

    // Add click handlers for voting
    document.querySelectorAll('.poll-option').forEach(option => {
        option.onclick = async () => {
            const pollId = option.parentElement.parentElement.dataset.pollId;
            const optionId = option.dataset.optionId;
            
            try {
                const response = await fetch(`/api/polls/${pollId}/vote`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ optionId: parseInt(optionId) })
                });

                if (response.ok) {
                    loadPolls(); // Refresh polls after voting
                }
            } catch (error) {
                console.error('Error voting:', error);
            }
        };
    });
}

// Calculate vote percentage
function calculatePercentage(votes, options) {
    const totalVotes = options.reduce((sum, option) => sum + option.votes, 0);
    return totalVotes === 0 ? 0 : (votes / totalVotes) * 100;
}

// Load polls when page loads
loadPolls();