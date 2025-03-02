const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const app = express();
const helmet = require('helmet');


// Add a configuration section
const RESET_PASSWORD = 'pollreset123'; // Change this to a secure password

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(helmet());

// Database Connection
const db = new sqlite3.Database('polls.db');

// Function to initialize default polls
function initializeDefaultPolls() {
    db.get("SELECT COUNT(*) as count FROM polls", [], (err, row) => {
        if (err) {
            console.error('Error checking polls:', err);
            return;
        }

        // Only add default polls if the table is empty
        if (row.count === 0) {
            const defaultPolls = [
                {
                    question: "What is your favorite programming language?",
                    options: ["JavaScript", "Python", "Java", "C++"]
                },
                {
                    question: "Which web framework do you prefer?",
                    options: ["React", "Angular", "Vue", "Svelte"]
                },
                {
                    question: "What's your preferred development environment?",
                    options: ["VS Code", "IntelliJ", "Sublime", "Atom"]
                }
            ];

            defaultPolls.forEach(poll => {
                db.run(`INSERT INTO polls (question) VALUES (?)`, [poll.question], function(err) {
                    if (err) {
                        console.error('Error inserting poll:', err);
                        return;
                    }
                    
                    const pollId = this.lastID;
                    const optionValues = poll.options.map(opt => `(${pollId}, '${opt}', 0)`).join(',');
                    
                    db.run(`INSERT INTO options (poll_id, text, votes) VALUES ${optionValues}`, (err) => {
                        if (err) {
                            console.error('Error inserting options:', err);
                        }
                    });
                });
            });
        }
    });
}

// Database Setup
db.serialize(() => {
    // Create polls table
    db.run(`CREATE TABLE IF NOT EXISTS polls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Create options table
    db.run(`CREATE TABLE IF NOT EXISTS options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        poll_id INTEGER,
        text TEXT NOT NULL,
        votes INTEGER DEFAULT 0,
        FOREIGN KEY(poll_id) REFERENCES polls(id)
    )`, [], (err) => {
        if (err) {
            console.error('Error creating tables:', err);
            return;
        }
        // Initialize default polls after tables are created
        initializeDefaultPolls();
    });
});

// Routes
// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get all polls with their options
app.get('/api/polls', (req, res) => {
    db.all(`
        SELECT 
            p.id, 
            p.question, 
            p.created_at,
            json_group_array(
                json_object(
                    'id', o.id,
                    'text', o.text,
                    'votes', o.votes
                )
            ) as options
        FROM polls p
        LEFT JOIN options o ON p.id = o.poll_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
    `, [], (err, rows) => {
        if (err) {
            console.error('Error fetching polls:', err);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }

        // Parse options JSON
        const parsedRows = rows.map(row => ({
            ...row,
            options: JSON.parse(row.options)
        }));

        res.json(parsedRows);
    });
});

// Create a new poll
app.post('/api/polls', (req, res) => {
    const { question, options } = req.body;

    // Validate input
    if (!question || !options || options.length < 2) {
        return res.status(400).json({ 
            error: 'Question must be provided with at least 2 options' 
        });
    }

    // Insert poll
    db.run(`INSERT INTO polls (question) VALUES (?)`, [question], function(err) {
        if (err) {
            console.error('Error creating poll:', err);
            return res.status(500).json({ error: 'Failed to create poll' });
        }

        const pollId = this.lastID;
        
        // Prepare options insert
        const optionValues = options.map(opt => `(${pollId}, ?, 0)`).join(',');
        const optionParams = options.map(opt => opt.toString());

        // Insert options
        db.run(
            `INSERT INTO options (poll_id, text, votes) VALUES ${optionValues}`,
            optionParams,
            (err) => {
                if (err) {
                    console.error('Error inserting options:', err);
                    // Rollback poll if options insert fails
                    db.run(`DELETE FROM polls WHERE id = ?`, [pollId]);
                    return res.status(500).json({ error: 'Failed to create poll options' });
                }

                // Fetch and return the new poll with its options
                db.all(`
                    SELECT 
                        p.id, 
                        p.question, 
                        json_group_array(
                            json_object(
                                'id', o.id,
                                'text', o.text,
                                'votes', o.votes
                            )
                        ) as options
                    FROM polls p
                    LEFT JOIN options o ON p.id = o.poll_id
                    WHERE p.id = ?
                    GROUP BY p.id
                `, [pollId], (err, rows) => {
                    if (err) {
                        console.error('Error fetching new poll:', err);
                        return res.status(500).json({ error: 'Failed to retrieve new poll' });
                    }

                    const newPoll = {
                        ...rows[0],
                        options: JSON.parse(rows[0].options)
                    };

                    res.status(201).json(newPoll);
                });
            }
        );
    });
});

// Vote on a poll
app.post('/api/polls/:pollId/vote', (req, res) => {
    const { pollId } = req.params;
    const { optionId } = req.body;

    // Validate input
    if (!optionId) {
        return res.status(400).json({ error: 'Option ID is required' });
    }

    // Update vote count
    db.run(
        `UPDATE options SET votes = votes + 1 WHERE id = ? AND poll_id = ?`,
        [optionId, pollId],
        function(err) {
            if (err) {
                console.error('Error voting:', err);
                return res.status(500).json({ error: 'Failed to submit vote' });
            }

            // Check if vote was recorded
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Option not found' });
            }

            // Fetch updated poll data
            db.all(`
                SELECT 
                    p.id, 
                    p.question, 
                    json_group_array(
                        json_object(
                            'id', o.id,
                            'text', o.text,
                            'votes', o.votes
                        )
                    ) as options
                FROM polls p
                LEFT JOIN options o ON p.id = o.poll_id
                WHERE p.id = ?
                GROUP BY p.id
            `, [pollId], (err, rows) => {
                if (err) {
                    console.error('Error fetching updated poll:', err);
                    return res.status(500).json({ error: 'Failed to retrieve updated poll' });
                }

                const updatedPoll = {
                    ...rows[0],
                    options: JSON.parse(rows[0].options)
                };

                res.json(updatedPoll);
            });
        }
    );
});

// Delete a poll
app.delete('/api/polls/:id', (req, res) => {
    const { id } = req.params;

    // Delete options first (due to foreign key constraint)
    db.run(`DELETE FROM options WHERE poll_id = ?`, [id], (err) => {
        if (err) {
            console.error('Error deleting poll options:', err);
            return res.status(500).json({ error: 'Failed to delete poll' });
        }

        // Then delete the poll
        db.run(`DELETE FROM polls WHERE id = ?`, [id], function(err) {
            if (err) {
                console.error('Error deleting poll:', err);
                return res.status(500).json({ error: 'Failed to delete poll' });
            }

            // Check if a row was actually deleted
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Poll not found' });
            }

            res.json({ message: 'Poll deleted successfully' });
        });
    });
});


// Modify the reset endpoint
app.post('/api/reset', (req, res) => {
    const { password } = req.body;

    // Verify password
    if (!password || password !== RESET_PASSWORD) {
        return res.status(403).json({ error: 'Incorrect reset password' });
    }

    // Delete all options
    db.run(`DELETE FROM options`, (err) => {
        if (err) {
            console.error('Error deleting options:', err);
            return res.status(500).json({ error: 'Failed to reset polls' });
        }

        // Delete all polls
        db.run(`DELETE FROM polls`, (err) => {
            if (err) {
                console.error('Error deleting polls:', err);
                return res.status(500).json({ error: 'Failed to reset polls' });
            }

            // Reset auto-increment sequences
            db.run(`DELETE FROM sqlite_sequence WHERE name IN ('polls', 'options')`, (err) => {
                if (err) {
                    console.error('Error resetting sequences:', err);
                    return res.status(500).json({ error: 'Failed to reset polls' });
                }

                // Reinitialize default polls
                initializeDefaultPolls();

                res.json({ message: 'Polls reset successfully' });
            });
        });
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
    });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        }
        console.log('Database connection closed');
        process.exit(0);
    });
});