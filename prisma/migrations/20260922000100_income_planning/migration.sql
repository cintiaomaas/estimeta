-- CreateTable
CREATE TABLE `IncomePlanning` (
    `householdId` CHAR(36) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `incomeSource` ENUM('REALIZED', 'MANUAL') NOT NULL DEFAULT 'REALIZED',
    `referenceIncome` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `revision` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`householdId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanningGroup` (
    `id` CHAR(36) NOT NULL,
    `householdId` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `percentage` DECIMAL(5, 2) NOT NULL,
    `alertPercentage` DECIMAL(5, 2) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PlanningGroup_householdId_idx`(`householdId`),
    UNIQUE INDEX `PlanningGroup_id_householdId_key`(`id`, `householdId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanningGroupCategory` (
    `planningGroupId` CHAR(36) NOT NULL,
    `categoryId` CHAR(36) NOT NULL,
    `householdId` CHAR(36) NOT NULL,

    INDEX `PlanningGroupCategory_categoryId_householdId_idx`(`categoryId`, `householdId`),
    INDEX `PlanningGroupCategory_planningGroupId_householdId_idx`(`planningGroupId`, `householdId`),
    PRIMARY KEY (`planningGroupId`, `categoryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `IncomePlanning` ADD CONSTRAINT `IncomePlanning_householdId_fkey` FOREIGN KEY (`householdId`) REFERENCES `Household`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanningGroup` ADD CONSTRAINT `PlanningGroup_householdId_fkey` FOREIGN KEY (`householdId`) REFERENCES `IncomePlanning`(`householdId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanningGroupCategory` ADD CONSTRAINT `PlanningGroupCategory_planningGroupId_householdId_fkey` FOREIGN KEY (`planningGroupId`, `householdId`) REFERENCES `PlanningGroup`(`id`, `householdId`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `PlanningGroupCategory` ADD CONSTRAINT `PlanningGroupCategory_categoryId_householdId_fkey` FOREIGN KEY (`categoryId`, `householdId`) REFERENCES `Category`(`id`, `householdId`) ON DELETE CASCADE ON UPDATE RESTRICT;
