.PHONY: install dev deploy \
        db-init-local db-init-remote \
        db-tables-local db-tables-remote \
        db-stats-local db-stats-remote \
        db-count-responses-local db-count-responses-remote \
        db-clear-local db-clear-remote \
        clean

# ----------------------------------------------------------------------

# Application

# ----------------------------------------------------------------------

install:
npm install

dev:
npx wrangler dev

deploy:
npx wrangler deploy

# ----------------------------------------------------------------------

# Database initialization

# ----------------------------------------------------------------------

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

# ----------------------------------------------------------------------

# Database clearing

# ----------------------------------------------------------------------

db-clear-local:
npx wrangler d1 execute gairaigo-guess-db --local --command="DELETE FROM responses; DELETE FROM answer_stats;"

db-clear-remote:
@echo "WARNING: This will permanently delete all production answer data."
@read -p "Continue? [y/N] " confirm &&
[ "$$confirm" = "y" ] || exit 1
npx wrangler d1 execute gairaigo-guess-db --remote --command="DELETE FROM responses; DELETE FROM answer_stats;"

# ----------------------------------------------------------------------

# Cleanup

# ----------------------------------------------------------------------

clean:
rm -rf .wrangler
