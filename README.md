# Gairaigo Guess

**Gairaigo Guess** is a web-based multiple-choice quiz game in which players guess the English meaning of Japanese **gairaigo** (外来語) terms derived from English and **wasei-eigo** (和製英語) terms.

Gairaigo are Japanese words originating from (or based on) a foreign language.
Wasei-eigo are a subset of gairaigo that are based on English words, or on parts of English phrases, but do not exist in standard English, or do not have the meanings that they have in standard English; in other words, they are pseudo-loanwords or pseudo-anglicisms.

Each round presents a Japanese term and its Hepburn romanization along with four possible English meanings. One answer is correct and three are distractors. After answering, the player sees whether they were correct and, when available, the percentage of other players who selected each answer.

The game is designed as a lightweight static web application with a small server-side component for collecting anonymous answer statistics.

**Author:** Franz Utermohlen

---

## Architecture

The application has three main components:

```text
                    ┌─────────────────────┐
                    │     Web Browser     │
                    │                     │
                    │  index.html         │
                    │  style.css          │
                    │  app.js             │
                    └──────────┬──────────┘
                               │
                               │ Load quiz data
                               ▼
              ┌──────────────────────────────┐
              │       CSV question data      │
              │                              │
              │ english_gairaigo_and_        │
              │ wasei_eigo_terms.csv         │
              └────────────────┬─────────────┘
                               │
                               │ POST /api/answer
                               │ GET /api/stats/:id
                               ▼
                    ┌─────────────────────┐
                    │    Worker backend   │
                    │                     │
                    │     index.js        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      D1 database    │
                    │                     │
                    │    responses        │
                    │    answer_stats     │
                    └─────────────────────┘
```

### Frontend

The frontend is a conventional HTML/CSS/JavaScript application:

* `index.html`: page structure and UI
* `style.css`: visual styling
* `app.js`: game logic
* `english_gairaigo_and_wasei_eigo_terms.csv`: quiz question data

The frontend does **not** retrieve quiz questions from the database. The CSV is the source of truth for the quiz content.

### Backend

`index.js` is a server-side JavaScript Worker.

It provides two API endpoints:

```text
POST /api/answer
GET  /api/stats/:questionId
```

All other requests are passed to the static asset server.

### Database

The application uses a SQLite-compatible D1 database to store anonymous answer data.

There are two tables:

#### `responses`

Stores an individual player's answer to a question.

```text
session_id
question_id
answer_id
created_at
```

The primary key is:

```text
(session_id, question_id)
```

This prevents the same browser session from submitting multiple answers for the same question.

#### `answer_stats`

Stores aggregated answer counts:

```text
question_id
answer_id
count
```

This table allows the application to efficiently calculate the percentage of players choosing each answer without scanning every individual response.

---

## Game Logic

### Loading the game

When the page loads, `app.js` fetches:

```text
english_gairaigo_and_wasei_eigo_terms.csv
```

The CSV is parsed in the browser.

Each valid row must contain at least:

* `id`
* `japanese`
* `correct`

---

### Starting a round

The application creates a randomized ordering of all questions.

For each question:

1. The Japanese term is displayed.
2. The Hepburn romanization is displayed.
3. The correct meaning and three fake meanings are collected.
4. The four answers are shuffled.
5. The answer buttons are rendered.
6. The progress indicator is updated.

The correct answer is tracked internally using its answer ID:

```text
correct
fake1
fake2
fake3
```

These IDs are intentionally independent of the answer's displayed position, since the answers are randomized.

---

### Answering a question

When the player selects an answer:

1. The question is marked as answered.
2. All answer buttons are disabled.
3. The selected answer is marked correct or incorrect.
4. The actual correct answer is highlighted.
5. The player's score is updated.
6. The answer is submitted to the backend.
7. Current answer statistics are retrieved.
8. Percentages are displayed next to the answer choices.

The browser generates a persistent anonymous session ID using `localStorage`.

The session ID is used only to prevent duplicate submissions from the same browser session.

No account or personally identifying information is required.

---

### Recording an answer

The frontend sends:

```json
{
    "sessionId": "...",
    "questionId": 123,
    "answerId": "fake2"
}
```

to:

```text
POST /api/answer
```

The backend validates:

* question ID
* answer ID
* session ID

The response is inserted into `responses`.

If that session has already answered that question, the duplicate is ignored.

When a new response is successfully inserted, the corresponding row in `answer_stats` is incremented.

---

### Calculating percentages

For a question, the backend retrieves the four answer counts:

```text
correct
fake1
fake2
fake3
```

The total number of recorded answers is calculated:

```text
total = correct + fake1 + fake2 + fake3
```

Each percentage is then:

```text
percentage = count / total × 100
```

The result is rounded to the nearest whole percent.

---

## Project Structure

```text
gairaigo-guess/
├── public/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── english_gairaigo_and_wasei_eigo_terms.csv
│
├── index.js
├── schema.sql
├── wrangler.jsonc
├── package.json
└── Makefile
└── README.md
└── LICENSE
```

### `public/`

Contains everything served to the browser.

### `index.js`

Server-side API and request routing.

### `schema.sql`

Database schema for the D1 database.

### `wrangler.jsonc`

Deployment and infrastructure configuration, including:

* Worker name
* static asset directory
* database binding
* database ID

### `package.json`

Project metadata.

### `Makefile`

Development/deployment commands.

---

# Development

## Prerequisites

Install the dependencies (Node.js, npm):

```bash
make install
```

---

## Initialize the Local Database

After creating the D1 database and whenever the local database needs to be initialized:

```bash
make db-init-local
```

Check that the tables exist:

```bash
make db-tables-local
```

Expected tables include:

```text
answer_stats
responses
```

---

## Run Locally

Start the local development server:

```bash
make dev
```

The application will normally be available at:

```text
http://localhost:8787
```

The local development environment uses the local D1 database created by `make db-init-local` rather than the production database.

This is intentional: local testing should not modify production statistics.

---

## Test the API Locally

With the development server running:

```bash
curl -X POST http://localhost:8787/api/answer \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-12345678901234567890",
    "questionId": 1,
    "answerId": "correct"
  }'
```

Then retrieve the statistics:

```bash
curl http://localhost:8787/api/stats/1
```

---

## Test Static Assets

The quiz CSV should be accessible locally:

```bash
curl http://localhost:8787/english_gairaigo_and_wasei_eigo_terms.csv
```

Or check only the HTTP status:

```bash
curl -I http://localhost:8787/english_gairaigo_and_wasei_eigo_terms.csv
```

It should return HTTP `200`.

---

# Deployment

The production application is hosted using **Cloudflare Workers**, with **Cloudflare D1** providing the database.

Cloudflare is responsible for:

* hosting the web application
* serving the static frontend
* running the API backend
* providing the production SQLite-compatible database
* providing the public `workers.dev` URL
* optionally providing the custom domain

The application itself remains a standard HTML/CSS/JavaScript application; Cloudflare-specific functionality is primarily contained in the deployment configuration and Worker backend.

---

## Cloudflare Setup

Authenticate Wrangler:

```bash
npx wrangler login
```

Create the production database:

```bash
make db-create-remote
```

Cloudflare will return a database ID.

Put that ID into `wrangler.jsonc`:

```jsonc
"d1_databases": [
    {
        "binding": "DB",
        "database_name": "gairaigo-guess-db",
        "database_id": "YOUR_DATABASE_ID"
    }
]
```

Initialize the production database:

```bash
make db-init-remote
```

---

## Deploy

Deploy the application:

```bash
make deploy
```

After deployment, Wrangler will display the public `workers.dev` URL.

For example:

```text
https://gairaigo-guess.<subdomain>.workers.dev
```

---

## Deploying Updates

After changing the application:

```bash
make deploy
```

No separate frontend build step is required.

The contents of `public/` are deployed as static assets, while `index.js` is deployed as the Worker backend.

---

# Database Maintenance

## View Production Tables

```bash
make db-tables-remote
```

## View Answer Statistics

```bash
make db-stats-remote
```

## Count Responses

```bash
make db-count-responses-remote
```

## Reset Production Statistics

To remove all recorded answers and aggregated statistics:

```bash
make db-clear-remote
```

Verify:

```bash
npx wrangler d1 execute gairaigo-guess-db --remote --command="
SELECT
    (SELECT COUNT(*) FROM responses) AS responses,
    (SELECT COUNT(*) FROM answer_stats) AS stats;
"
```

Both values should be `0`.

**Use `--remote` carefully.** This operates on the production database.

---

# Taking the Site Offline

To disable the public `workers.dev` deployment while continuing development, set:

```jsonc
"workers_dev": false
```

in `wrangler.jsonc`, then deploy:

```bash
make deploy
```

Remove `workers_dev: false` and deploy again when the site should be publicly accessible.

---

# Custom Domain

The application can use a custom domain instead of the default `workers.dev` URL.

For example:

```text
https://gairaigoguess.com
```

The custom domain is configured through Cloudflare and routes to the Worker.

The domain name is independent of the Worker name and does not require changes to the game's frontend code.

---

# Data Format

The quiz data is stored in:

```text
public/english_gairaigo_and_wasei_eigo_terms.csv
```

The expected columns are:

```text
id
japanese
romaji
origin
correct
fake1
fake2
fake3
```

Example:

```csv
id,japanese,romaji,origin,correct,fake1,fake2,fake3
1,サラリーマン,sararīman,salaryman,businessman,salesperson,office manager,...
2,リモコン,rimokon,remote control,television,radio,air conditioner,...
```

Question IDs must be unique and should remain stable after publication.

Do not renumber existing questions merely because questions are added, removed, or reordered.

---

# Technology

### Frontend

* HTML
* CSS
* JavaScript
* CSV

### Backend

* JavaScript
* Cloudflare Workers

### Database

* SQLite-compatible Cloudflare D1

### Development / Deployment

* Node.js
* npm
* Wrangler

---

# Design Principles

The application intentionally keeps the architecture simple.

### Quiz content is separate from user statistics

The CSV contains the actual game content. The database only contains player response data.

This means the quiz can be updated without modifying the database schema.

### Anonymous statistics

Players do not need accounts.

A randomly generated browser session ID is used only to prevent duplicate submissions for the same question.

### Static-first architecture

Most of the application runs entirely in the browser. The backend is only needed when recording or retrieving aggregate statistics.

### No build system

There is currently no frontend framework or bundler. The application can be edited and deployed directly.

---

# Makefile

The repository includes a `Makefile` for commonly used development, deployment, and database commands.

## Application

```bash
make install       # Install npm dependencies
make dev           # Run the application locally
make deploy        # Deploy to Cloudflare Workers
```

## Database

```bash
make db-create-remote    # Create production Cloudflare D1 database and return database_id
make db-init-local       # Create and initialize local D1 database
make db-init-remote      # Initialize production D1 database

make db-tables-local     # List local database tables
make db-tables-remote    # List production database tables

make db-stats-local      # View local answer statistics
make db-stats-remote     # View production answer statistics

make db-feedback-local   # View local feedback
make db-feedback-remote  # View production feedback

make db-clear-local      # Clear all test data from local database
make db-clear-remote     # Clear all answer data from production database

make clean-local         # Remove all local Wrangler/D1 development state
```

# Data Sources & Attribution

Most of the Japanese gairaigo and wasei-eigo data used in this game was obtained from the following Wikipedia article:

* [List of gairaigo and wasei-eigo terms](https://en.wikipedia.org/wiki/List_of_gairaigo_and_wasei-eigo_terms)

The data has been adapted, formatted, and supplemented as necessary for use in the game.

The Wikipedia article and its contributors should be credited separately from the original code of this project. See the [Wikipedia licensing information](https://en.wikipedia.org/wiki/Wikipedia:Copyrights) for the applicable terms governing Wikipedia content.

# Development Assistance

This project was developed with the assistance of:

- [ChatGPT](https://chatgpt.com/) by OpenAI
- [GitHub Copilot](https://github.com/features/copilot) by GitHub

# License

The original source code for Gairaigo Guess is © 2026 Franz Utermohlen. All rights reserved.

The quiz data in `public/english_gairaigo_and_wasei_eigo_terms.csv` includes material derived from [List of gairaigo and wasei-eigo terms](https://en.wikipedia.org/wiki/List_of_gairaigo_and_wasei-eigo_terms) on Wikipedia and may be subject to separate licensing terms. It is not necessarily covered by the same copyright or licensing terms as the original code. See [Data Sources & Attribution](#data-sources--attribution) for information about the source and applicable licensing terms.
