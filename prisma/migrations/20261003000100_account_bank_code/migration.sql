-- Optional visual institution identifier; existing accounts remain NULL.
ALTER TABLE `Account` ADD COLUMN `bankCode` VARCHAR(40) NULL;
