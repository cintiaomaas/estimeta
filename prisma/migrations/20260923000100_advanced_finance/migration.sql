-- AlterTable
ALTER TABLE `Account` ADD COLUMN `includeInTotalBalance` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `Transaction` ADD COLUMN `installmentCount` INTEGER NULL,
    ADD COLUMN `installmentNumber` INTEGER NULL,
    ADD COLUMN `installmentPlanId` CHAR(36) NULL,
    ADD COLUMN `recurringOccurrenceId` CHAR(36) NULL;

-- CreateTable
CREATE TABLE `InstallmentPlan` (
    `id` CHAR(36) NOT NULL,
    `householdId` CHAR(36) NOT NULL,
    `description` VARCHAR(200) NOT NULL,
    `totalAmount` DECIMAL(15, 2) NOT NULL,
    `installmentCount` INTEGER NOT NULL,
    `firstCompetenceDate` DATE NOT NULL,
    `createdBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InstallmentPlan_id_householdId_key`(`id`, `householdId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RecurringTransaction` (
    `id` CHAR(36) NOT NULL,
    `householdId` CHAR(36) NOT NULL,
    `accountId` CHAR(36) NOT NULL,
    `categoryId` CHAR(36) NOT NULL,
    `type` ENUM('INCOME', 'EXPENSE') NOT NULL,
    `description` VARCHAR(200) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `frequency` VARCHAR(10) NOT NULL DEFAULT 'MONTHLY',
    `startDate` DATE NOT NULL,
    `endDate` DATE NULL,
    `dayOfMonth` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `notes` VARCHAR(2000) NULL,
    `revision` INTEGER NOT NULL DEFAULT 0,
    `createdBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RecurringTransaction_householdId_isActive_idx`(`householdId`, `isActive`),
    UNIQUE INDEX `RecurringTransaction_id_householdId_key`(`id`, `householdId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RecurringOccurrence` (
    `id` CHAR(36) NOT NULL,
    `householdId` CHAR(36) NOT NULL,
    `recurringTransactionId` CHAR(36) NOT NULL,
    `competenceDate` DATE NOT NULL,

    UNIQUE INDEX `RecurringOccurrence_id_householdId_key`(`id`, `householdId`),
    UNIQUE INDEX `RecurringOccurrence_recurringTransactionId_competenceDate_key`(`recurringTransactionId`, `competenceDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transfer` (
    `id` CHAR(36) NOT NULL,
    `householdId` CHAR(36) NOT NULL,
    `sourceAccountId` CHAR(36) NOT NULL,
    `destinationAccountId` CHAR(36) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `transferDate` DATE NOT NULL,
    `competenceDate` DATE NOT NULL,
    `description` VARCHAR(200) NOT NULL,
    `notes` VARCHAR(2000) NULL,
    `createdBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Transfer_householdId_competenceDate_idx`(`householdId`, `competenceDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Transaction_recurringOccurrenceId_key` ON `Transaction`(`recurringOccurrenceId`);

-- CreateIndex
CREATE INDEX `Transaction_installmentPlanId_householdId_idx` ON `Transaction`(`installmentPlanId`, `householdId`);

-- CreateIndex
CREATE UNIQUE INDEX `Transaction_installmentPlanId_installmentNumber_key` ON `Transaction`(`installmentPlanId`, `installmentNumber`);

-- CreateIndex
CREATE UNIQUE INDEX `Transaction_recurringOccurrenceId_householdId_key` ON `Transaction`(`recurringOccurrenceId`, `householdId`);

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_installmentPlanId_householdId_fkey` FOREIGN KEY (`installmentPlanId`, `householdId`) REFERENCES `InstallmentPlan`(`id`, `householdId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_recurringOccurrenceId_householdId_fkey` FOREIGN KEY (`recurringOccurrenceId`, `householdId`) REFERENCES `RecurringOccurrence`(`id`, `householdId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `InstallmentPlan` ADD CONSTRAINT `InstallmentPlan_householdId_fkey` FOREIGN KEY (`householdId`) REFERENCES `Household`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InstallmentPlan` ADD CONSTRAINT `InstallmentPlan_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecurringTransaction` ADD CONSTRAINT `RecurringTransaction_householdId_fkey` FOREIGN KEY (`householdId`) REFERENCES `Household`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecurringTransaction` ADD CONSTRAINT `RecurringTransaction_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RecurringTransaction` ADD CONSTRAINT `RecurringTransaction_accountId_householdId_fkey` FOREIGN KEY (`accountId`, `householdId`) REFERENCES `Account`(`id`, `householdId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `RecurringTransaction` ADD CONSTRAINT `RecurringTransaction_categoryId_householdId_fkey` FOREIGN KEY (`categoryId`, `householdId`) REFERENCES `Category`(`id`, `householdId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `RecurringOccurrence` ADD CONSTRAINT `RecurringOccurrence_recurringTransactionId_householdId_fkey` FOREIGN KEY (`recurringTransactionId`, `householdId`) REFERENCES `RecurringTransaction`(`id`, `householdId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Transfer` ADD CONSTRAINT `Transfer_householdId_fkey` FOREIGN KEY (`householdId`) REFERENCES `Household`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transfer` ADD CONSTRAINT `Transfer_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transfer` ADD CONSTRAINT `Transfer_sourceAccountId_householdId_fkey` FOREIGN KEY (`sourceAccountId`, `householdId`) REFERENCES `Account`(`id`, `householdId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Transfer` ADD CONSTRAINT `Transfer_destinationAccountId_householdId_fkey` FOREIGN KEY (`destinationAccountId`, `householdId`) REFERENCES `Account`(`id`, `householdId`) ON DELETE RESTRICT ON UPDATE RESTRICT;
