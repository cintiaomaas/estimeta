-- Earlier versions permanently removed contributions, so absence cannot prove no history.
-- Preserve all legacy goals conservatively; new goals begin without history.
ALTER TABLE `FinancialGoal` ADD COLUMN `hasHistory` BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE `FinancialGoal` ALTER COLUMN `hasHistory` SET DEFAULT false;
