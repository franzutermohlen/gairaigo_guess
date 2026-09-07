const state = {
    rows: [],
    order: [],
    index: 0,
    score: 0,
    answered: false,
    correct: 0,
};

const $ = (id) => document.getElementById(id);
const letters = ['A', 'B', 'C', 'D'];

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
            text: row['Correct Meaning'],
            good: true,
        },
        {
            text: row['Fake meaning 1'],
        },
        {
            text: row['Fake meaning 2'],
        },
        {
            text: row['Fake meaning 3'],
        },
    ]);

    state.correct = answers.findIndex((answer) => answer.good);
    state.answered = false;

    $('japanese').textContent = row.Japanese;
    $('romaji').textContent =
        row['Hepburn romanization'] || 'romaji unavailable';

    $('current').textContent = state.index + 1;
    $('round').textContent = `ROUND ${String(state.index + 1).padStart(2, '0')}`;
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
        button.addEventListener('click', () => choose(i, row));

        $('answers').appendChild(button);
    });
}

function choose(selected, row) {
    if (state.answered) {
        return;
    }

    state.answered = true;

    [...$('answers').children].forEach((button, i) => {
        button.disabled = true;

        if (i === state.correct) {
            button.classList.add('correct');
        } else if (i === selected) {
            button.classList.add('wrong');
        } else {
            button.classList.add('dim');
        }
    });

    const origin = row.Origin
        ? `<span class="origin">Origin: ${row.Origin}</span>`
        : '';

    if (selected === state.correct) {
        state.score += 100;
        $('score').textContent = state.score;
        status(`Correct. Nice catch.${origin}`, 'good');
    } else {
        status(`Not quite. The green answer is the one.${origin}`, 'bad');
    }

    $('next').disabled = false;
    $('next').focus();
}

function next() {
    state.index += 1;

    if (state.index >= state.rows.length) {
        state.index = 0;
        state.order = shuffle(state.rows.map((_, i) => i));
    }

    render();
}

$('next').addEventListener('click', next);
$('skip').addEventListener('click', next);

document.addEventListener('keydown', (e) => {
    if (['1', '2', '3', '4'].includes(e.key)) {
        const buttons = [...$('answers').children];
        const button = buttons[Number(e.key) - 1];

        if (button) {
            button.click();
        }
    }

    if (e.key === 'Enter' && !$('next').disabled) {
        next();
    }
});

fetch('english_gairaigo_and_wasei_eigo_terms.csv')
    .then((response) => {
        if (!response.ok) {
            throw Error('Could not load quiz data');
        }

        return response.text();
    })
    .then((text) => {
        state.rows = parseCsv(text).filter(
            (row) => row.Japanese && row['Correct Meaning'],
        );

        state.order = shuffle(state.rows.map((_, i) => i));
        $('total').textContent = state.rows.length;

        render();
    })
    .catch((error) => {
        $('japanese').textContent = 'Unable to load quiz';
        $('romaji').textContent = error.message;
    });
