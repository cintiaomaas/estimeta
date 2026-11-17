-- Additional indexes preserve case/accent/trailing-space uniqueness without changing stored data.
-- Keep column collations deterministic so existing Prisma ILIKE filters remain supported.
CREATE COLLATION "estimeta_text_ci_ai" (provider = icu, locale = 'und-u-ks-level1', deterministic = false);
CREATE UNIQUE INDEX "User_email_ci_ai_key" ON "User" ((rtrim("email")) COLLATE "estimeta_text_ci_ai");
CREATE UNIQUE INDEX "Category_household_type_name_ci_ai_key" ON "Category" ("householdId", "type", (rtrim("name")) COLLATE "estimeta_text_ci_ai");
CREATE UNIQUE INDEX "GoalParticipant_goal_name_ci_ai_key" ON "GoalParticipant" ("goalId", (rtrim("name")) COLLATE "estimeta_text_ci_ai");
