CREATE TABLE IF NOT EXISTS responses (
    session_id TEXT NOT NULL,
    question_id INTEGER NOT NULL,
    answer_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (session_id, question_id),

    CHECK (
        answer_id IN (
            'correct',
            'fake1',
            'fake2',
            'fake3'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_responses_question
ON responses(question_id);


CREATE TABLE IF NOT EXISTS answer_stats (
    question_id INTEGER NOT NULL,
    answer_id TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (question_id, answer_id),

    CHECK (
        answer_id IN (
            'correct',
            'fake1',
            'fake2',
            'fake3'
        )
    ),

    CHECK (count >= 0)
);
