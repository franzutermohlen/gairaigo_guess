const state = {
    rows: [],
    order: [],
    index: 0,
    score: 0,
    answered: false,
    finished: false,
    correct: 0,
    currentAnswers: [],
};

const $ = (id) => document.getElementById(id);
const letters = ['A', 'B', 'C', 'D'];

function fitJapaneseTerm() {
    const japanese = $('japanese');

    japanese.style.fontSize = '';

    const availableWidth = japanese.clientWidth;
    const textWidth = japanese.scrollWidth;

    if (availableWidth > 0 && textWidth > availableWidth) {
        const baseFontSize = parseFloat(getComputedStyle(japanese).fontSize);
        japanese.style.fontSize =
            `${baseFontSize * (availableWidth / textWidth) * 0.99}px`;
    }
}

function getSessionId() {
    const key = 'gairaigo-guess-session-id';

    let sessionId = localStorage.getItem(key);

    if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem(key, sessionId);
    }

    return sessionId;
}

function parseCsv(text) {
    const records = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
        const c = text[i];
        const n = text[i + 1];

        if (c === '"' && quoted && n === '"') {
            cell += '"';
            i += 1;
            continue;
        }

        if (c === '"') {
            quoted = !quoted;
            continue;
        }

        if (c === ',' && !quoted) {
            row.push(cell);
            cell = '';
            continue;
        }

        if ((c === '\n' || c === '\r') && !quoted) {
            if (c === '\r' && n === '\n') {
                i += 1;
            }

            row.push(cell);
            cell = '';

            if (row.some(Boolean)) {
                records.push(row);
            }

            row = [];
            continue;
        }

        cell += c;
    }

    if (cell || row.length) {
        row.push(cell);
        records.push(row);
    }

    const headers = records.shift();

    return records.map((values) =>
        Object.fromEntries(
            headers.map((header, i) => [header, values[i] || '']),
        ),
    );
}

function shuffle(items) {
    const a = [...items];

    for (let i = a.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }

    return a;
}

function status(text, type = '') {
    const el = $('feedback');

    el.className = `feedback ${type}`;
    el.innerHTML = text;
}

function render() {
    const row = state.rows[state.order[state.index]];

    const answers = shuffle([
        {
            id: 'correct',
            text: row['correct'],
            good: true,
        },
        {
            id: 'fake1',
            text: row['fake1'],
            good: false,
        },
        {
            id: 'fake2',
            text: row['fake2'],
            good: false,
        },
        {
            id: 'fake3',
            text: row['fake3'],
            good: false,
        },
    ]);

    state.currentAnswers = answers;
    state.correct = answers.findIndex((answer) => answer.good);
    state.answered = false;

    $('japanese').textContent = row.japanese;
    fitJapaneseTerm();

    $('romaji').textContent =
        row['romaji'] || 'romaji unavailable';

    $('romaji').hidden = !$('show-romaji').checked;

    $('current').textContent = state.index + 1;

    $('bar').style.width =
        `${((state.index + 1) / state.rows.length) * 100}%`;

    $('answers').innerHTML = '';

    status('');

    $('next').disabled = true;

    answers.forEach((answer, i) => {
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'answer';

        button.innerHTML = `
            <span class="letter">${letters[i]}</span>
            <span class="answer-text"></span>
        `;

        button.querySelector('.answer-text').textContent = answer.text;

        button.addEventListener('click', () => {
            choose(i, row, answer.id);
        });

        $('answers').appendChild(button);
    });
}

async function submitAnswer(questionId, answerId) {
    try {
        const response = await fetch('/api/answer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sessionId: getSessionId(),
                questionId,
                answerId,
            }),
        });

        if (!response.ok) {
            throw new Error('Could not record answer');
        }

        return await response.json();
    } catch (error) {
        console.error('Could not submit answer:', error);
        return null;
    }
}

async function loadStats(questionId) {
    try {
        const response = await fetch(
            `/api/stats/${encodeURIComponent(questionId)}`,
        );

        if (!response.ok) {
            throw new Error('Could not load statistics');
        }

        return await response.json();
    } catch (error) {
        console.error('Could not load statistics:', error);
        return null;
    }
}

function renderStats(stats) {
    if (!stats || !Array.isArray(stats.answers)) {
        return;
    }

    const buttons = [...$('answers').children];

    stats.answers.forEach((stat) => {
        const answerIndex = state.currentAnswers.findIndex(
            (answer) => answer.id === stat.answerId,
        );

        if (answerIndex < 0 || !buttons[answerIndex]) {
            return;
        }

        const answerText = buttons[answerIndex].querySelector(
            '.answer-text',
        );

        if (!answerText) {
            return;
        }

        const percentage = stat.percentage;

        const statsElement = document.createElement('span');

        statsElement.className = 'answer-stats';

        statsElement.textContent = ` (${percentage}%)`;

        answerText.appendChild(statsElement);
    });
}

async function choose(selected, row, answerId) {
    if (state.answered) {
        return;
    }

    state.answered = true;

    const buttons = [...$('answers').children];

    buttons.forEach((button, i) => {
        button.disabled = true;

        if (i === state.correct) {
            button.classList.add('correct');
        } else if (i === selected) {
            button.classList.add('wrong');
        } else {
            button.classList.add('dim');
        }
    });

    const origin = row.origin
        ? `<span class="origin">Origin: ${row.origin}</span>`
        : '';

    if (selected === state.correct) {
        state.score += 1;

        $('score').textContent = state.score;

        status(
            `Correct${origin}`,
            'good',
        );
    } else {
        status(
            `Incorrect${origin}`,
            'bad',
        );
    }

    $('next').disabled = false;
    $('next').focus();

    /*
     * Record the answer and load the updated statistics.
     *
     * These requests intentionally happen after the answer has already
     * been displayed, so a temporary API failure does not interrupt
     * gameplay.
     */
    const questionId = Number(row.id);

    const result = await submitAnswer(questionId, answerId);

    /*
     * If this answer was already recorded for this session/question,
     * the Worker will return duplicate: true. We still load the stats.
     */
    if (result) {
        const stats = await loadStats(questionId);
        renderStats(stats);
    }
}

async function submitFeedback(questionId, feedbackType, message) {
    try {
        const response = await fetch('/api/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                questionId,
                feedbackType,
                message,
            }),
        });

        if (!response.ok) {
            throw new Error('Could not submit feedback');
        }

        return await response.json();
    } catch (error) {
        console.error('Could not submit feedback:', error);
        return null;
    }
}

function openFeedback() {
    $('feedback-modal').hidden = false;
    $('feedback-status').textContent = '';
    $('feedback-message').focus();
}

function closeFeedback() {
    $('feedback-modal').hidden = true;
    $('feedback-status').textContent = '';
}

async function handleFeedbackSubmit(event) {
    event.preventDefault();

    const feedbackType = $('feedback-type').value;
    const message = $('feedback-message').value.trim();

    if (!message) {
        return;
    }

    const row = state.rows[state.order[state.index]];
    const questionId = row ? Number(row.id) : null;

    $('feedback-status').textContent = 'Sending...';

    const result = await submitFeedback(
        questionId,
        feedbackType,
        message,
    );

    if (!result) {
        $('feedback-status').textContent =
            'Sorry, your feedback could not be submitted. Please try again.';
        return;
    }

    $('feedback-status').textContent =
        'Thanks! Your feedback has been submitted.';

    $('feedback-form').reset();
}

function finish() {
    state.finished = true;

    status('You completed all the words.', 'good');

    [...$('answers').children].forEach((button) => {
        button.disabled = true;
    });

    $('next').disabled = true;
    $('skip').disabled = true;
    $('next').textContent = 'Complete';
}

function next() {
    if (state.finished) {
        return;
    }

    if (state.index >= state.rows.length - 1) {
        finish();
        return;
    }

    state.index += 1;

    render();
}

$('next').addEventListener('click', next);

$('skip').addEventListener('click', next);

const help = document.querySelector('.gairaigo-help');
const helpButton = help.querySelector('.gairaigo-help-button');

function closeHelp() {
    help.classList.remove('is-open');
    helpButton.setAttribute('aria-expanded', 'false');
}

helpButton.addEventListener('click', () => {
    const isOpen = help.classList.toggle('is-open');
    helpButton.setAttribute('aria-expanded', String(isOpen));
});

document.addEventListener('click', (event) => {
    if (!help.contains(event.target)) {
        closeHelp();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && help.classList.contains('is-open')) {
        closeHelp();
        helpButton.focus();
    }
});

window.addEventListener('resize', fitJapaneseTerm);

$('show-romaji').addEventListener('change', (event) => {
    $('romaji').hidden = !event.target.checked;
});

$('feedback-button').addEventListener('click', openFeedback);

$('feedback-close').addEventListener('click', closeFeedback);

$('feedback-form').addEventListener(
    'submit',
    handleFeedbackSubmit,
);

$('feedback-modal').addEventListener('click', (event) => {
    if (event.target === $('feedback-modal')) {
        closeFeedback();
    }
});

document.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement?.tagName;
    const isTypingTarget =
        activeTag === 'INPUT' ||
        activeTag === 'TEXTAREA' ||
        activeTag === 'SELECT';

    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || isTypingTarget) {
        return;
    }

    if (
        e.key === 'Escape' &&
        !$('feedback-modal').hidden
    ) {
        e.preventDefault();
        closeFeedback();
        return;
    }

    const key = e.key.toUpperCase();
    const answerKeys = ['A', 'B', 'C', 'D'];
    const numericKeys = ['1', '2', '3', '4'];

    if (answerKeys.includes(key) || numericKeys.includes(key)) {
        e.preventDefault();

        const buttons = [...$('answers').children];
        const answerIndex = answerKeys.includes(key)
            ? answerKeys.indexOf(key)
            : Number(key) - 1;
        const button = buttons[answerIndex];

        if (button) {
            button.click();
        }
    }

    if (e.key === 'Enter' && !$('next').disabled) {
        e.preventDefault();
        next();
    }
});

fetch('english_gairaigo_and_wasei_eigo_terms.csv')
    .then((response) => {
        if (!response.ok) {
            throw new Error('Could not load game data');
        }

        return response.text();
    })
    .then((text) => {
        state.rows = parseCsv(text).filter(
            (row) =>
                row.id &&
                row.japanese &&
                row['correct'],
        );

        if (state.rows.length === 0) {
            throw new Error('No valid questions found');
        }

        state.order = shuffle(
            state.rows.map((_, i) => i),
        );

        $('total').textContent = state.rows.length;

        render();
    })
    .catch((error) => {
        console.error(error);

        $('japanese').textContent = 'Unable to load game';

        $('romaji').textContent = error.message;
    });
