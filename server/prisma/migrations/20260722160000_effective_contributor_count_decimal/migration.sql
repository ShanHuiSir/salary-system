ALTER TABLE "budget_labor_costs"
  ALTER COLUMN "effective_contributor_count" TYPE DOUBLE PRECISION
  USING "effective_contributor_count"::DOUBLE PRECISION;
