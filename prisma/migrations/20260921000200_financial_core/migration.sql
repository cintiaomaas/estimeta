-- AlterTable
ALTER TABLE `Household` ADD COLUMN `financialDefaultsAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `Account` (
    `id` CHAR(36) NOT NULL,
    `householdId` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `type` ENUM('CHECKING', 'SAVINGS', 'CASH', 'INVESTMENT', 'OTHER') NOT NULL,
    `initialBalance` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Account_householdId_isActive_idx`(`householdId`, `isActive`),
    UNIQUE INDEX `Account_id_householdId_key`(`id`, `householdId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` CHAR(36) NOT NULL,
    `householdId` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `type` ENUM('INCOME', 'EXPENSE') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_householdId_type_name_key`(`householdId`, `type`, `name`),
    UNIQUE INDEX `Category_id_householdId_key`(`id`, `householdId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transaction` (
    `id` CHAR(36) NOT NULL,
    `householdId` CHAR(36) NOT NULL,
    `accountId` CHAR(36) NOT NULL,
    `categoryId` CHAR(36) NOT NULL,
    `type` ENUM('INCOME', 'EXPENSE') NOT NULL,
    `description` VARCHAR(200) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `scheduledDate` DATE NOT NULL,
    `transactionDate` DATE NULL,
    `competenceDate` DATE NOT NULL,
    `status` ENUM('PENDING', 'RECEIVED', 'PAID') NOT NULL DEFAULT 'PENDING',
    `notes` VARCHAR(2000) NULL,
    `createdBy` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Transaction_householdId_competenceDate_idx`(`householdId`, `competenceDate`),
    INDEX `Transaction_householdId_type_competenceDate_idx`(`householdId`, `type`, `competenceDate`),
    INDEX `Transaction_householdId_scheduledDate_idx`(`householdId`, `scheduledDate`),
    INDEX `Transaction_householdId_transactionDate_idx`(`householdId`, `transactionDate`),
    INDEX `Transaction_accountId_householdId_idx`(`accountId`, `householdId`),
    INDEX `Transaction_categoryId_householdId_idx`(`categoryId`, `householdId`),
    INDEX `Transaction_createdBy_idx`(`createdBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Account` ADD CONSTRAINT `Account_householdId_fkey` FOREIGN KEY (`householdId`) REFERENCES `Household`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_householdId_fkey` FOREIGN KEY (`householdId`) REFERENCES `Household`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_householdId_fkey` FOREIGN KEY (`householdId`) REFERENCES `Household`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_accountId_householdId_fkey` FOREIGN KEY (`accountId`, `householdId`) REFERENCES `Account`(`id`, `householdId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_categoryId_householdId_fkey` FOREIGN KEY (`categoryId`, `householdId`) REFERENCES `Category`(`id`, `householdId`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

