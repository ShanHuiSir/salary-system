-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL DEFAULT 'hr_staff',
    "department_scope" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "username" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "table_name" TEXT,
    "record_id" TEXT,
    "changes" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_states" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_states_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "monthly_overviews" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "total_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "self_operated_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchise_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platform_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "factory_revenue" DOUBLE PRECISION DEFAULT 0,
    "total_labor_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "labor_cost_ratio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "per_capita_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "store_efficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mom_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yoy_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mom_labor_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yoy_labor_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_overviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "labor_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "per_capita_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "store_efficiency" DOUBLE PRECISION DEFAULT 0,
    "labor_cost_ratio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mom_labor_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yoy_labor_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mom_headcount" INTEGER NOT NULL DEFAULT 0,
    "yoy_headcount" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_compositions" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "fixed_income" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "floating_income" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "social_insurance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "severance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outsourcing" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_compositions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_levels" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "labor_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mom_headcount" INTEGER NOT NULL DEFAULT 0,
    "yoy_headcount" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_regions" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "store_count" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "labor_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "store_efficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "person_efficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mom_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "yoy_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_labor_costs" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "center" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "business_line" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "labor_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "budget_labor_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_labor_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_structures" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "attendance_salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "performance_bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtime_pay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "annual_leave_allowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sick_leave_pay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maternity_leave_pay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "other_payable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employer_social_insurance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hq_business_lines" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "business_line" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "labor_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fixed_salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variable_salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "social_benefits" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hq_business_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hq_depts" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "business_line" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "labor_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fixed_salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variable_salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hq_depts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platforms" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "labor_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fixed_salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variable_salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "per_capita_revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_table_name_idx" ON "audit_logs"("table_name");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_overviews_month_key" ON "monthly_overviews"("month");

-- CreateIndex
CREATE INDEX "departments_month_idx" ON "departments"("month");

-- CreateIndex
CREATE INDEX "departments_department_idx" ON "departments"("department");

-- CreateIndex
CREATE INDEX "departments_month_department_idx" ON "departments"("month", "department");

-- CreateIndex
CREATE UNIQUE INDEX "departments_month_department_key" ON "departments"("month", "department");

-- CreateIndex
CREATE INDEX "cost_compositions_month_department_idx" ON "cost_compositions"("month", "department");

-- CreateIndex
CREATE UNIQUE INDEX "cost_compositions_month_department_key" ON "cost_compositions"("month", "department");

-- CreateIndex
CREATE INDEX "position_levels_month_department_idx" ON "position_levels"("month", "department");

-- CreateIndex
CREATE UNIQUE INDEX "position_levels_month_department_level_key" ON "position_levels"("month", "department", "level");

-- CreateIndex
CREATE INDEX "store_regions_month_idx" ON "store_regions"("month");

-- CreateIndex
CREATE UNIQUE INDEX "store_regions_month_region_key" ON "store_regions"("month", "region");

-- CreateIndex
CREATE INDEX "budget_labor_costs_month_segment_idx" ON "budget_labor_costs"("month", "segment");

-- CreateIndex
CREATE UNIQUE INDEX "budget_labor_costs_month_segment_center_department_business_key" ON "budget_labor_costs"("month", "segment", "center", "department", "business_line");

-- CreateIndex
CREATE INDEX "cost_structures_month_segment_idx" ON "cost_structures"("month", "segment");

-- CreateIndex
CREATE UNIQUE INDEX "cost_structures_month_segment_key" ON "cost_structures"("month", "segment");

-- CreateIndex
CREATE INDEX "hq_business_lines_month_idx" ON "hq_business_lines"("month");

-- CreateIndex
CREATE UNIQUE INDEX "hq_business_lines_month_business_line_key" ON "hq_business_lines"("month", "business_line");

-- CreateIndex
CREATE INDEX "hq_depts_month_idx" ON "hq_depts"("month");

-- CreateIndex
CREATE UNIQUE INDEX "hq_depts_month_department_key" ON "hq_depts"("month", "department");

-- CreateIndex
CREATE INDEX "platforms_month_idx" ON "platforms"("month");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_month_platform_key" ON "platforms"("month", "platform");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
