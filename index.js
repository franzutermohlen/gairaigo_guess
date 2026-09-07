const ALLOWED_ANSWER_IDS = new Set([
    'correct',
    'fake1',
    'fake2',
    'fake3',
]);

const JSON_HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
};

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: JSON_HEADERS,
    });
}

function isValidQuestionId(value) {
    return (
        Number.isInteger(value) &&
        value > 0 &&
        value <= 2147483647
    );
}

function isValidSessionId(value) {
    return (
        typeof value === 'string' &&
        value.length >= 20 &&
        value.length <= 100
    );
}

async function handleAnswer(request, env) {
    let body;

    try {
        body = await request.json();
    } catch {
        return json(
            { error: 'Invalid JSON' },
            400,
        );
    }

    const questionId = Number(body.questionId);
    const answerId = body.answerId;
    const sessionId = body.sessionId;

    if (!isValidQuestionId(questionId)) {
        return json(
            { error: 'Invalid question ID' },
            400,
        );
    }

    if (!ALLOWED_ANSWER_IDS.has(answerId)) {
        return json(
            { error: 'Invalid answer ID' },
            400,
        );
    }

    if (!isValidSessionId(sessionId)) {
        return json(
            { error: 'Invalid session ID' },
            400,
        );
    }

    /*
     * Both operations happen inside one D1 batch.
     *
     * INSERT OR IGNORE guarantees that a session can only submit
     * one answer for a particular question.
     *
     * The second statement increments the aggregate count only
     * if the first statement actually inserted a new response.
     */
    const results = await env.DB.batch([
        env.DB.prepare(`
            INSERT OR IGNORE INTO responses (
                session_id,
                question_id,
                answer_id
            )
            VALUES (?, ?, ?)
        `).bind(
            sessionId,
            questionId,
            answerId,
        ),

        env.DB.prepare(`
            INSERT INTO answer_stats (
                question_id,
                answer_id,
                count
            )
            SELECT ?, ?, 1
            WHERE changes() = 1
            ON CONFLICT(question_id, answer_id)
            DO UPDATE SET count = count + 1
        `).bind(
            questionId,
            answerId,
        ),
    ]);

    const inserted =
        results[0]?.meta?.changes === 1;

    return json({
        recorded: inserted,
        duplicate: !inserted,
    });
}

async function handleStats(questionId, env) {
    if (!isValidQuestionId(questionId)) {
        return json(
            { error: 'Invalid question ID' },
            400,
        );
    }

    const result = await env.DB.prepare(`
        SELECT
            answer_id,
            count
        FROM answer_stats
        WHERE question_id = ?
        ORDER BY answer_id
    `).bind(questionId).all();

    const counts = {
        correct: 0,
        fake1: 0,
        fake2: 0,
        fake3: 0,
    };

    for (const row of result.results) {
        if (ALLOWED_ANSWER_IDS.has(row.answer_id)) {
            counts[row.answer_id] = Number(row.count);
        }
    }

    const total =
        counts.correct +
        counts.fake1 +
        counts.fake2 +
        counts.fake3;

    const answers = [...ALLOWED_ANSWER_IDS].map(
        (answerId) => {
            const count = counts[answerId];

            return {
                answerId,
                count,
                percentage: total === 0
                    ? 0
                    : Math.round(
                        (count / total) * 100,
                    ),
            };
        },
    );

    return json({
        questionId,
        total,
        answers,
    });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        try {
            if (
                url.pathname === '/api/answer' &&
                request.method === 'POST'
            ) {
                return await handleAnswer(
                    request,
                    env,
                );
            }

            if (
                url.pathname.startsWith('/api/stats/') &&
                request.method === 'GET'
            ) {
                const idString =
                    url.pathname.slice('/api/stats/'.length);

                const questionId = Number(idString);

                return await handleStats(
                    questionId,
                    env,
                );
            }

            /*
             * Everything that isn't an API endpoint is served
             * from the public/ directory.
             */
            return env.ASSETS.fetch(request);
        } catch (error) {
            console.error(error);

            return json(
                { error: 'Internal server error' },
                500,
            );
        }
    },
};
