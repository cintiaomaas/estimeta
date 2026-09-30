-- CreateTable
CREATE TABLE `FinancialGoal` (
    `id` CHAR(36) NOT NULL,
    `householdId` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(2000) NULL,
    `icon` VARCHAR(30) NULL,
    `targetAmount` DECIMAL(15, 2) NOT NULL,
    `startDate` DATE NOT NULL,
    `targetDate` DATE NULL,
    `status` ENUM('ACTIVE', 'COMPLETED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `accountId` CHAR(36) NULL,
    `createdBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FinancialGoal_householdId_status_targetDate_idx`(`householdId`, `status`, `targetDate`),
    UNIQUE INDEX `FinancialGoal_id_householdId_key`(`id`, `householdId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GoalParticipant` (
    `id` CHAR(36) NOT NULL,
    `householdId` CHAR(36) NOT NULL,
    `goalId` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GoalParticipant_id_goalId_householdId_key`(`id`, `goalId`, `householdId`),
    UNIQUE INDEX `GoalParticipant_goalId_name_key`(`goalId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GoalContribution` (
    `id` CHAR(36) NOT NULL,
    `householdId` CHAR(36) NOT NULL,
    `goalId` CHAR(36) NOT NULL,
    `participantId` CHAR(36) NULL,
    `accountId` CHAR(36) NULL,
    `transferId` CHAR(36) NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `contributionDate` DATE NOT NULL,
    `competenceDate` DATE NOT NULL,
    `description` VARCHAR(2000) NULL,
    `createdBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GoalContribution_transferId_key`(`transferId`),
    INDEX `GoalContribution_householdId_goalId_competenceDate_idx`(`householdId`, `goalId`, `competenceDate`),
    UNIQUE INDEX `GoalContribution_transferId_householdId_key`(`transferId`, `householdId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Transfer_id_householdId_key` ON `Transfer`(`id`, `householdId`);

-- AddForeignKey
ALTER TABLE `FinancialGoal` ADD CONSTRAINT `FinancialGoal_householdId_fkey` FOREIGN KEY (`householdId`) REFERENCES `Household`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinancialGoal` ADD CONSTRAINT `FinancialGoal_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinancialGoal` ADD CONSTRAINT `FinancialGoal_accountId_householdId_fkey` FOREIGN KEY (`accountId`, `householdId`) REFERENCES `Account`(`id`, `householdId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `GoalParticipant` ADD CONSTRAINT `GoalParticipant_householdId_fkey` FOREIGN KEY (`householdId`) REFERENCES `Household`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoalParticipant` ADD CONSTRAINT `GoalParticipant_goalId_householdId_fkey` FOREIGN KEY (`goalId`, `householdId`) REFERENCES `FinancialGoal`(`id`, `householdId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `GoalContribution` ADD CONSTRAINT `GoalContribution_householdId_fkey` FOREIGN KEY (`householdId`) REFERENCES `Household`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoalContribution` ADD CONSTRAINT `GoalContribution_goalId_householdId_fkey` FOREIGN KEY (`goalId`, `householdId`) REFERENCES `FinancialGoal`(`id`, `householdId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `GoalContribution` ADD CONSTRAINT `GoalContribution_participantId_goalId_householdId_fkey` FOREIGN KEY (`participantId`, `goalId`, `householdId`) REFERENCES `GoalParticipant`(`id`, `goalId`, `householdId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `GoalContribution` ADD CONSTRAINT `GoalContribution_accountId_householdId_fkey` FOREIGN KEY (`accountId`, `householdId`) REFERENCES `Account`(`id`, `householdId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `GoalContribution` ADD CONSTRAINT `GoalContribution_transferId_householdId_fkey` FOREIGN KEY (`transferId`, `householdId`) REFERENCES `Transfer`(`id`, `householdId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `GoalContribution` ADD CONSTRAINT `GoalContribution_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
