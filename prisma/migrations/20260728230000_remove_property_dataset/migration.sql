-- Business records have been normalized into dedicated relational tables.
-- Back up and complete normalization with the previous release before
-- deploying this release if any installation still contains JSON-only data.
DROP TABLE IF EXISTS "PropertyDataset";
