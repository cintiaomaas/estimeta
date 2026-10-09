ALTER TABLE `PushSubscription` ADD COLUMN `sessionId` CHAR(36) NULL, ADD COLUMN `expiresAt` DATETIME(3) NULL;
ALTER TABLE `NotificationLog` DROP FOREIGN KEY `NotificationLog_transactionId_fkey`;
ALTER TABLE `NotificationLog` MODIFY `transactionId` CHAR(36) NULL, ADD COLUMN `description` VARCHAR(200) NULL, ADD COLUMN `amount` DECIMAL(15,2) NULL, ADD COLUMN `competenceDate` DATE NULL, ADD COLUMN `readAt` DATETIME(3) NULL;
UPDATE `NotificationLog` n JOIN `Transaction` t ON t.id = n.transactionId SET n.description = t.description, n.amount = t.amount, n.competenceDate = t.competenceDate;
CREATE INDEX `NotificationLog_userId_readAt_createdAt_idx` ON `NotificationLog` (`userId`, `readAt`, `createdAt`);
ALTER TABLE `NotificationLog` ADD CONSTRAINT `NotificationLog_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `Transaction` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX `PushSubscription_sessionId_idx` ON `PushSubscription` (`sessionId`);
