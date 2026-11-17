-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "HouseholdRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CASH', 'INVESTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'RECEIVED', 'PAID');

-- CreateEnum
CREATE TYPE "PlanningIncomeSource" AS ENUM ('REALIZED', 'MANUAL');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" CHAR(36) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Household" (
    "id" CHAR(36) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "financialDefaultsAt" TIMESTAMP(3),

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "currency" CHAR(3) NOT NULL DEFAULT 'BRL',
    "position" INTEGER NOT NULL DEFAULT 2147483647,
    "id" CHAR(36) NOT NULL,
    "householdId" CHAR(36) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "bankCode" VARCHAR(40),
    "type" "AccountType" NOT NULL,
    "initialBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "includeInTotalBalance" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" CHAR(36) NOT NULL,
    "householdId" CHAR(36) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomePlanning" (
    "householdId" CHAR(36) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "incomeSource" "PlanningIncomeSource" NOT NULL DEFAULT 'REALIZED',
    "referenceIncome" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomePlanning_pkey" PRIMARY KEY ("householdId")
);

-- CreateTable
CREATE TABLE "PlanningGroup" (
    "id" CHAR(36) NOT NULL,
    "householdId" CHAR(36) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "alertPercentage" DECIMAL(5,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningGroupCategory" (
    "planningGroupId" CHAR(36) NOT NULL,
    "categoryId" CHAR(36) NOT NULL,
    "householdId" CHAR(36) NOT NULL,

    CONSTRAINT "PlanningGroupCategory_pkey" PRIMARY KEY ("planningGroupId","categoryId")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "originalAmount" DECIMAL(15,2),
    "exchangeRate" DECIMAL(18,10),
    "id" CHAR(36) NOT NULL,
    "householdId" CHAR(36) NOT NULL,
    "accountId" CHAR(36) NOT NULL,
    "categoryId" CHAR(36) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "transactionDate" DATE,
    "competenceDate" DATE NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "notes" VARCHAR(2000),
    "createdBy" CHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "installmentPlanId" CHAR(36),
    "installmentNumber" INTEGER,
    "installmentCount" INTEGER,
    "recurringOccurrenceId" CHAR(36),

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" CHAR(36) NOT NULL,
    "userId" CHAR(36) NOT NULL,
    "endpoint" TEXT NOT NULL,
    "endpointHash" CHAR(64) NOT NULL,
    "p256dh" VARCHAR(100) NOT NULL,
    "auth" VARCHAR(30) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sessionId" CHAR(36),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" CHAR(36) NOT NULL,
    "userId" CHAR(36) NOT NULL,
    "transactionId" CHAR(36),
    "description" VARCHAR(200),
    "amount" DECIMAL(15,2),
    "competenceDate" DATE,
    "readAt" TIMESTAMP(3),
    "type" VARCHAR(40) NOT NULL,
    "referenceDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" CHAR(36) NOT NULL,
    "logId" CHAR(36) NOT NULL,
    "endpointHash" CHAR(64) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'CLAIMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdMember" (
    "id" CHAR(36) NOT NULL,
    "householdId" CHAR(36) NOT NULL,
    "userId" CHAR(36) NOT NULL,
    "role" "HouseholdRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallmentPlan" (
    "id" CHAR(36) NOT NULL,
    "householdId" CHAR(36) NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "totalAmount" DECIMAL(15,2) NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "firstCompetenceDate" DATE NOT NULL,
    "createdBy" CHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringTransaction" (
    "id" CHAR(36) NOT NULL,
    "householdId" CHAR(36) NOT NULL,
    "accountId" CHAR(36) NOT NULL,
    "categoryId" CHAR(36) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "frequency" VARCHAR(10) NOT NULL DEFAULT 'MONTHLY',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "dayOfMonth" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" VARCHAR(2000),
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdBy" CHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringOccurrence" (
    "id" CHAR(36) NOT NULL,
    "householdId" CHAR(36) NOT NULL,
    "recurringTransactionId" CHAR(36) NOT NULL,
    "competenceDate" DATE NOT NULL,

    CONSTRAINT "RecurringOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "sourceAmount" DECIMAL(15,2),
    "destinationAmount" DECIMAL(15,2),
    "id" CHAR(36) NOT NULL,
    "householdId" CHAR(36) NOT NULL,
    "sourceAccountId" CHAR(36) NOT NULL,
    "destinationAccountId" CHAR(36) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "transferDate" DATE NOT NULL,
    "competenceDate" DATE NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "notes" VARCHAR(2000),
    "createdBy" CHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialGoal" (
    "hasHistory" BOOLEAN NOT NULL DEFAULT false,
    "id" CHAR(36) NOT NULL,
    "householdId" CHAR(36) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(2000),
    "icon" VARCHAR(30),
    "targetAmount" DECIMAL(15,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "targetDate" DATE,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "accountId" CHAR(36),
    "createdBy" CHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalParticipant" (
    "id" CHAR(36) NOT NULL,
    "householdId" CHAR(36) NOT NULL,
    "goalId" CHAR(36) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalContribution" (
    "id" CHAR(36) NOT NULL,
    "householdId" CHAR(36) NOT NULL,
    "goalId" CHAR(36) NOT NULL,
    "participantId" CHAR(36),
    "accountId" CHAR(36),
    "transferId" CHAR(36),
    "amount" DECIMAL(15,2) NOT NULL,
    "contributionDate" DATE NOT NULL,
    "competenceDate" DATE NOT NULL,
    "description" VARCHAR(2000),
    "createdBy" CHAR(36) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoalContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "currency" CHAR(3) NOT NULL,
    "requestedDate" CHAR(10) NOT NULL,
    "referenceDate" CHAR(10) NOT NULL,
    "rate" DECIMAL(18,10) NOT NULL,
    "source" VARCHAR(100) NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("currency","requestedDate")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_householdId_isActive_idx" ON "Account"("householdId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Account_id_householdId_key" ON "Account"("id", "householdId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_householdId_type_name_key" ON "Category"("householdId", "type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_id_householdId_key" ON "Category"("id", "householdId");

-- CreateIndex
CREATE INDEX "PlanningGroup_householdId_idx" ON "PlanningGroup"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningGroup_id_householdId_key" ON "PlanningGroup"("id", "householdId");

-- CreateIndex
CREATE INDEX "PlanningGroupCategory_categoryId_householdId_idx" ON "PlanningGroupCategory"("categoryId", "householdId");

-- CreateIndex
CREATE INDEX "PlanningGroupCategory_planningGroupId_householdId_idx" ON "PlanningGroupCategory"("planningGroupId", "householdId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_recurringOccurrenceId_key" ON "Transaction"("recurringOccurrenceId");

-- CreateIndex
CREATE INDEX "Transaction_installmentPlanId_householdId_idx" ON "Transaction"("installmentPlanId", "householdId");

-- CreateIndex
CREATE INDEX "Transaction_householdId_competenceDate_idx" ON "Transaction"("householdId", "competenceDate");

-- CreateIndex
CREATE INDEX "Transaction_householdId_type_competenceDate_idx" ON "Transaction"("householdId", "type", "competenceDate");

-- CreateIndex
CREATE INDEX "Transaction_householdId_scheduledDate_idx" ON "Transaction"("householdId", "scheduledDate");

-- CreateIndex
CREATE INDEX "Transaction_householdId_transactionDate_idx" ON "Transaction"("householdId", "transactionDate");

-- CreateIndex
CREATE INDEX "Transaction_accountId_householdId_idx" ON "Transaction"("accountId", "householdId");

-- CreateIndex
CREATE INDEX "Transaction_categoryId_householdId_idx" ON "Transaction"("categoryId", "householdId");

-- CreateIndex
CREATE INDEX "Transaction_createdBy_idx" ON "Transaction"("createdBy");

-- CreateIndex
CREATE INDEX "Transaction_type_status_scheduledDate_id_idx" ON "Transaction"("type", "status", "scheduledDate", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_installmentPlanId_installmentNumber_key" ON "Transaction"("installmentPlanId", "installmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_recurringOccurrenceId_householdId_key" ON "Transaction"("recurringOccurrenceId", "householdId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpointHash_key" ON "PushSubscription"("endpointHash");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_active_idx" ON "PushSubscription"("userId", "active");

-- CreateIndex
CREATE INDEX "PushSubscription_sessionId_idx" ON "PushSubscription"("sessionId");

-- CreateIndex
CREATE INDEX "NotificationLog_transactionId_idx" ON "NotificationLog"("transactionId");

-- CreateIndex
CREATE INDEX "NotificationLog_userId_readAt_createdAt_idx" ON "NotificationLog"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_identity_key" ON "NotificationLog"("userId", "transactionId", "type", "referenceDate");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_logId_endpointHash_key" ON "NotificationDelivery"("logId", "endpointHash");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdMember_userId_key" ON "HouseholdMember"("userId");

-- CreateIndex
CREATE INDEX "HouseholdMember_householdId_idx" ON "HouseholdMember"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "InstallmentPlan_id_householdId_key" ON "InstallmentPlan"("id", "householdId");

-- CreateIndex
CREATE INDEX "RecurringTransaction_householdId_isActive_idx" ON "RecurringTransaction"("householdId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringTransaction_id_householdId_key" ON "RecurringTransaction"("id", "householdId");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringOccurrence_id_householdId_key" ON "RecurringOccurrence"("id", "householdId");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringOccurrence_recurringTransactionId_competenceDate_key" ON "RecurringOccurrence"("recurringTransactionId", "competenceDate");

-- CreateIndex
CREATE INDEX "Transfer_householdId_competenceDate_idx" ON "Transfer"("householdId", "competenceDate");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_id_householdId_key" ON "Transfer"("id", "householdId");

-- CreateIndex
CREATE INDEX "FinancialGoal_householdId_status_targetDate_idx" ON "FinancialGoal"("householdId", "status", "targetDate");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialGoal_id_householdId_key" ON "FinancialGoal"("id", "householdId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalParticipant_id_goalId_householdId_key" ON "GoalParticipant"("id", "goalId", "householdId");

-- CreateIndex
CREATE UNIQUE INDEX "GoalParticipant_goalId_name_key" ON "GoalParticipant"("goalId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "GoalContribution_transferId_key" ON "GoalContribution"("transferId");

-- CreateIndex
CREATE INDEX "GoalContribution_householdId_goalId_competenceDate_idx" ON "GoalContribution"("householdId", "goalId", "competenceDate");

-- CreateIndex
CREATE UNIQUE INDEX "GoalContribution_transferId_householdId_key" ON "GoalContribution"("transferId", "householdId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomePlanning" ADD CONSTRAINT "IncomePlanning_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningGroup" ADD CONSTRAINT "PlanningGroup_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "IncomePlanning"("householdId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningGroupCategory" ADD CONSTRAINT "PlanningGroupCategory_planningGroupId_householdId_fkey" FOREIGN KEY ("planningGroupId", "householdId") REFERENCES "PlanningGroup"("id", "householdId") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PlanningGroupCategory" ADD CONSTRAINT "PlanningGroupCategory_categoryId_householdId_fkey" FOREIGN KEY ("categoryId", "householdId") REFERENCES "Category"("id", "householdId") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_householdId_fkey" FOREIGN KEY ("accountId", "householdId") REFERENCES "Account"("id", "householdId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_householdId_fkey" FOREIGN KEY ("categoryId", "householdId") REFERENCES "Category"("id", "householdId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_installmentPlanId_householdId_fkey" FOREIGN KEY ("installmentPlanId", "householdId") REFERENCES "InstallmentPlan"("id", "householdId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recurringOccurrenceId_householdId_fkey" FOREIGN KEY ("recurringOccurrenceId", "householdId") REFERENCES "RecurringOccurrence"("id", "householdId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_logId_fkey" FOREIGN KEY ("logId") REFERENCES "NotificationLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_accountId_householdId_fkey" FOREIGN KEY ("accountId", "householdId") REFERENCES "Account"("id", "householdId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_categoryId_householdId_fkey" FOREIGN KEY ("categoryId", "householdId") REFERENCES "Category"("id", "householdId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "RecurringOccurrence" ADD CONSTRAINT "RecurringOccurrence_recurringTransactionId_householdId_fkey" FOREIGN KEY ("recurringTransactionId", "householdId") REFERENCES "RecurringTransaction"("id", "householdId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_sourceAccountId_householdId_fkey" FOREIGN KEY ("sourceAccountId", "householdId") REFERENCES "Account"("id", "householdId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_destinationAccountId_householdId_fkey" FOREIGN KEY ("destinationAccountId", "householdId") REFERENCES "Account"("id", "householdId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "FinancialGoal" ADD CONSTRAINT "FinancialGoal_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialGoal" ADD CONSTRAINT "FinancialGoal_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialGoal" ADD CONSTRAINT "FinancialGoal_accountId_householdId_fkey" FOREIGN KEY ("accountId", "householdId") REFERENCES "Account"("id", "householdId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "GoalParticipant" ADD CONSTRAINT "GoalParticipant_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalParticipant" ADD CONSTRAINT "GoalParticipant_goalId_householdId_fkey" FOREIGN KEY ("goalId", "householdId") REFERENCES "FinancialGoal"("id", "householdId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "GoalContribution" ADD CONSTRAINT "GoalContribution_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalContribution" ADD CONSTRAINT "GoalContribution_goalId_householdId_fkey" FOREIGN KEY ("goalId", "householdId") REFERENCES "FinancialGoal"("id", "householdId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "GoalContribution" ADD CONSTRAINT "GoalContribution_participantId_goalId_householdId_fkey" FOREIGN KEY ("participantId", "goalId", "householdId") REFERENCES "GoalParticipant"("id", "goalId", "householdId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "GoalContribution" ADD CONSTRAINT "GoalContribution_accountId_householdId_fkey" FOREIGN KEY ("accountId", "householdId") REFERENCES "Account"("id", "householdId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "GoalContribution" ADD CONSTRAINT "GoalContribution_transferId_householdId_fkey" FOREIGN KEY ("transferId", "householdId") REFERENCES "Transfer"("id", "householdId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "GoalContribution" ADD CONSTRAINT "GoalContribution_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

