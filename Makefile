.PHONY: install dev deploy \
		db-create-remote \
		db-init-local db-init-remote \
		db-session-stats-local db-session-stats-remote \
		db-count-sessions-local db-count-sessions-remote \
		db-feedback-local db-feedback-remote \
		db-all-responses-local db-all-responses-remote \
		db-clear-local db-clear-remote \
		clean-local

# ----------------------------------------------------------------------

# Application

# ----------------------------------------------------------------------

install:
	brew install node && npm install

dev:
	npx wrangler dev

deploy:
	npx wrangler deploy

# ----------------------------------------------------------------------

# Database creation and initialization

# ----------------------------------------------------------------------

# Note: This creates the production Cloudflare D1 database and returns the database_id,
#	    which must then be added to wrangler.jsonc
db-create-remote:
	npx wrangler d1 create gairaigo-guess-db

# Note: This also creates the local D1 database (there is no need for db-create-local)
db-init-local:
	npx wrangler d1 execute gairaigo-guess-db --local --file=./schema.sql

db-init-remote:
	npx wrangler d1 execute gairaigo-guess-db --remote --file=./schema.sql

# ----------------------------------------------------------------------

# Database inspection

# ----------------------------------------------------------------------

db-session-stats-local:
	@npx wrangler d1 execute gairaigo-guess-db --local --command="SELECT \
		session_id, \
		COUNT(*) AS response_count, \
		SUM(CASE WHEN answer_id = 'correct' THEN 1 ELSE 0 END) AS correct_count, \
		ROUND(100.0 * SUM(CASE WHEN answer_id = 'correct' THEN 1 ELSE 0 END) / COUNT(*), 1) AS correct_percentage, \
		MIN(created_at) AS first_response_at, \
		MAX(created_at) AS last_response_at, \
		ROUND((strftime('%s', MAX(created_at)) - strftime('%s', MIN(created_at))) / 60.0, 1) AS duration_minutes \
	FROM responses \
	GROUP BY session_id \
	ORDER BY last_response_at DESC;"

db-session-stats-remote:
	@npx wrangler d1 execute gairaigo-guess-db --remote --command="SELECT \
		session_id, \
		COUNT(*) AS response_count, \
		SUM(CASE WHEN answer_id = 'correct' THEN 1 ELSE 0 END) AS correct_count, \
		ROUND(100.0 * SUM(CASE WHEN answer_id = 'correct' THEN 1 ELSE 0 END) / COUNT(*), 1) AS correct_percentage, \
		MIN(created_at) AS first_response_at, \
		MAX(created_at) AS last_response_at, \
		ROUND((strftime('%s', MAX(created_at)) - strftime('%s', MIN(created_at))) / 60.0, 1) AS duration_minutes \
	FROM responses \
	GROUP BY session_id \
	ORDER BY last_response_at DESC;"

db-count-sessions-local:
	@npx wrangler d1 execute gairaigo-guess-db --local --command="SELECT COUNT(DISTINCT session_id) FROM responses;"

db-count-sessions-remote:
	@npx wrangler d1 execute gairaigo-guess-db --remote --command="SELECT COUNT(DISTINCT session_id) FROM responses;"

db-count-responses-local:
	@npx wrangler d1 execute gairaigo-guess-db --local --command="SELECT COUNT(*) FROM responses;"

db-count-responses-remote:
	@npx wrangler d1 execute gairaigo-guess-db --remote --command="SELECT COUNT(*) FROM responses;"

db-feedback-local:
	@npx wrangler d1 execute gairaigo-guess-db --local --command="SELECT id, question_id, feedback_type, message, created_at FROM feedback ORDER BY created_at DESC;"

db-feedback-remote:
	@npx wrangler d1 execute gairaigo-guess-db --remote --command="SELECT id, question_id, feedback_type, message, created_at FROM feedback ORDER BY created_at DESC;"

db-all-responses-local:
	@npx wrangler d1 execute gairaigo-guess-db --local --command="SELECT * FROM answer_stats ORDER BY question_id, answer_id;"

db-all-responses-remote:
	@npx wrangler d1 execute gairaigo-guess-db --remote --command="SELECT * FROM answer_stats ORDER BY question_id, answer_id;"

# ----------------------------------------------------------------------

# Database clearing

# ----------------------------------------------------------------------

db-clear-local:
	npx wrangler d1 execute gairaigo-guess-db --local --command="DELETE FROM responses; DELETE FROM answer_stats;"

db-clear-remote:
	@echo "WARNING: This will permanently delete all production answer data."
	@read -p "Continue? [y/N] " confirm && [ "$$confirm" = "y" ] || exit 1
	npx wrangler d1 execute gairaigo-guess-db --remote --command="DELETE FROM responses; DELETE FROM answer_stats;"

# ----------------------------------------------------------------------

# Cleanup

# ----------------------------------------------------------------------

clean-local:
	rm -rf .wrangler
