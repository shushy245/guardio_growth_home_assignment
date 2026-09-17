-- Runs once on first container start: a separate database for integration tests so they
-- never touch development data.
CREATE DATABASE breachscan_test OWNER breachscan;
