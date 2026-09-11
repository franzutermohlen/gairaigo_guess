.PHONY: install dev deploy \
		db-create-remote \
		db-init-local db-init-remote \
		db-tables-local db-tables-remote \
		db-stats-local db-stats-remote \
		db-feedback-local db-feedback-remote \
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

db-tables-local:
	npx wrangler d1 execute gairaigo-guess-db --local --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

db-tables-remote:
	npx wrangler d1 execute gairaigo-guess-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

db-stats-local:
	npx wrangler d1 execute gairaigo-guess-db --local --command="SELECT * FROM answer_stats ORDER BY question_id, answer_id;"

db-stats-remote:
	npx wrangler d1 execute gairaigo-guess-db --remote --command="SELECT * FROM answer_stats ORDER BY question_id, answer_id;"

db-count-responses-local:
	npx wrangler d1 execute gairaigo-guess-db --local --command="SELECT COUNT(*) FROM responses;"

db-count-responses-remote:
	npx wrangler d1 execute gairaigo-guess-db --remote --command="SELECT COUNT(*) FROM responses;"

db-feedback-local:
	npx wrangler d1 execute gairaigo-guess-db --local --command="SELECT id, question_id, feedback_type, message, created_at FROM feedback ORDER BY created_at DESC;"

db-feedback-remote:
	npx wrangler d1 execute gairaigo-guess-db --remote --command="SELECT id, question_id, feedback_type, message, created_at FROM feedback ORDER BY created_at DESC;"

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
