ALTER TABLE `Account` ADD COLUMN `currency` CHAR(3) NOT NULL DEFAULT 'BRL';
ALTER TABLE `Transaction` ADD COLUMN `originalAmount` DECIMAL(15,2) NULL, ADD COLUMN `exchangeRate` DECIMAL(18,10) NULL;
ALTER TABLE `Transfer` ADD COLUMN `sourceAmount` DECIMAL(15,2) NULL, ADD COLUMN `destinationAmount` DECIMAL(15,2) NULL;
CREATE TABLE `ExchangeRate` (
 `currency` CHAR(3) NOT NULL,
 `requestedDate` CHAR(10) NOT NULL,
 `referenceDate` CHAR(10) NOT NULL,
 `rate` DECIMAL(18,10) NOT NULL,
 `source` VARCHAR(100) NOT NULL,
 `checkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`currency`, `requestedDate`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
