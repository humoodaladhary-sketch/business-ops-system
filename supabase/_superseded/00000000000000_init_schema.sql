-- Alwalaa OS — full database schema.
-- GENERATED from prisma/schema.prisma (prisma migrate diff) so it matches the
-- application exactly. Run this ONCE in the Supabase SQL editor, then run
-- 20260603000000_auth_rls.sql to enable row-level security.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SENIOR', 'ADVISOR', 'NEW', 'TRAINEE', 'SALES_HEAD', 'MARKETING', 'FINANCE', 'LISTINGS', 'CEO');

-- CreateEnum
CREATE TYPE "LeadChannel" AS ENUM ('WHATSAPP', 'INSTAGRAM_DM', 'INSTAGRAM_COMMENT', 'INSTAGRAM_LEAD_AD', 'FACEBOOK_LEAD_AD', 'GOOGLE_LEAD_FORM', 'WEBSITE', 'PORTAL_FEED', 'REFERRAL', 'WALKIN', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "ScoreBand" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateEnum
CREATE TYPE "CommChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'CALL', 'SMS', 'INSTAGRAM', 'SYSTEM', 'NOTE');

-- CreateEnum
CREATE TYPE "CommDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('CONNECTED', 'NO_ANSWER', 'BUSY', 'WRONG_NUMBER');

-- CreateEnum
CREATE TYPE "UnitMarket" AS ENUM ('OFF_PLAN', 'SECONDARY');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'OFF_MARKET');

-- CreateEnum
CREATE TYPE "Segment" AS ENUM ('DIASPORA', 'RESIDENT', 'NA');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'PROBATION', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('ALWALAA_SOURCED', 'AGENT_NETWORK');

-- CreateEnum
CREATE TYPE "CanonicalStage" AS ENUM ('NEW', 'QUALIFIED', 'ENGAGED', 'VIEWING', 'NEGOTIATION', 'RESERVATION', 'CLOSED_WON', 'CLOSED_LOST');

-- CreateEnum
CREATE TYPE "AttributionRole" AS ENUM ('PRIMARY', 'CO_BROKER', 'REFERRER');

-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('PROVISIONAL', 'FINAL');

-- CreateEnum
CREATE TYPE "PaidStatus" AS ENUM ('UNPAID', 'INVOICED', 'RECEIVED', 'PAID');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('AGENT_OF_MONTH', 'OVERACHIEVER_BONUS', 'STREAK_BONUS');

-- CreateEnum
CREATE TYPE "TargetSource" AS ENUM ('ROLE_DEFAULT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "IngestSource" AS ENUM ('CSV', 'GOOGLE_SHEETS', 'FORM');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('UNCLAIMED', 'ASSIGNED', 'CLAIMED', 'REASSIGNED');

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" "Role" NOT NULL,
    "segment" "Segment" NOT NULL DEFAULT 'NA',
    "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE',
    "contractTriggered" BOOLEAN NOT NULL DEFAULT false,
    "contractStartDate" TIMESTAMP(3),
    "rampEndDate" TIMESTAMP(3),
    "exemptFromAtRisk" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Developer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "paymentReliable" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Developer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "location" TEXT,
    "priorityRank" INTEGER NOT NULL DEFAULT 999,
    "signed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "contact" TEXT,
    "email" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'ALWALAA_SOURCED',
    "segment" "Segment" NOT NULL DEFAULT 'NA',
    "assignedAgentId" TEXT,
    "canonicalStage" "CanonicalStage" NOT NULL DEFAULT 'NEW',
    "rawStageLabel" TEXT,
    "projectInterestId" TEXT,
    "nationality" TEXT,
    "countryOfResidence" TEXT,
    "budgetBand" TEXT,
    "purpose" TEXT,
    "timeline" TEXT,
    "language" TEXT,
    "currency" TEXT,
    "notes" TEXT,
    "registeredAt" TIMESTAMP(3),
    "lastFollowUpAt" TIMESTAMP(3),
    "stagingRowId" TEXT,
    "assignmentStatus" "AssignmentStatus" NOT NULL DEFAULT 'UNCLAIMED',
    "assignedAt" TIMESTAMP(3),
    "claimExpiresAt" TIMESTAMP(3),
    "clientId" TEXT,
    "channel" "LeadChannel",
    "sourceRef" TEXT,
    "utm" JSONB,
    "rawPayload" JSONB,
    "score" INTEGER NOT NULL DEFAULT 0,
    "scoreBand" "ScoreBand",
    "touchCount" INTEGER NOT NULL DEFAULT 0,
    "firstResponseAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "developerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "dealValue" DECIMAL(18,3) NOT NULL,
    "canonicalStage" "CanonicalStage" NOT NULL DEFAULT 'RESERVATION',
    "clientName" TEXT,
    "unitType" TEXT,
    "unitNumber" TEXT,
    "reservationDate" TIMESTAMP(3),
    "closeDate" TIMESTAMP(3),
    "notes" TEXT,
    "stagingRowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealAttribution" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "sharePct" DECIMAL(6,4) NOT NULL,
    "role" "AttributionRole" NOT NULL DEFAULT 'PRIMARY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Target" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "targetAmount" DECIMAL(18,3) NOT NULL,
    "source" "TargetSource" NOT NULL DEFAULT 'ROLE_DEFAULT',

    CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionLadder" (
    "id" TEXT NOT NULL,
    "tierName" TEXT NOT NULL,
    "minPctOfTarget" DECIMAL(7,4) NOT NULL,
    "maxPctOfTarget" DECIMAL(7,4),
    "agentSplitRate" DECIMAL(6,4) NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "CommissionLadder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSourceFloor" (
    "id" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "floorSplitRate" DECIMAL(6,4) NOT NULL,
    "note" TEXT,

    CONSTRAINT "LeadSourceFloor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeveloperCommissionRule" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "tierName" TEXT,
    "minQuarterlyVolume" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "maxQuarterlyVolume" DECIMAL(18,3),
    "rate" DECIMAL(6,4) NOT NULL,

    CONSTRAINT "DeveloperCommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyPerformanceSnapshot" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "volumeClosed" DECIMAL(18,3) NOT NULL,
    "targetAmount" DECIMAL(18,3) NOT NULL,
    "pctOfTarget" DECIMAL(7,4) NOT NULL,
    "currentTier" TEXT NOT NULL,
    "currentSplitRate" DECIMAL(6,4) NOT NULL,
    "projectedPayout" DECIMAL(18,3) NOT NULL,
    "finalPayout" DECIMAL(18,3),
    "status" "SnapshotStatus" NOT NULL DEFAULT 'PROVISIONAL',
    "dealCount" INTEGER NOT NULL DEFAULT 0,
    "watchFlag" BOOLEAN NOT NULL DEFAULT false,
    "atRiskFlag" BOOLEAN NOT NULL DEFAULT false,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyPerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "attributionId" TEXT NOT NULL,
    "developerRate" DECIMAL(6,4) NOT NULL,
    "alwalaaGross" DECIMAL(18,3) NOT NULL,
    "agentSplitRate" DECIMAL(6,4) NOT NULL,
    "agentPayout" DECIMAL(18,3) NOT NULL,
    "developerPaid" "PaidStatus" NOT NULL DEFAULT 'UNPAID',
    "agentPaid" "PaidStatus" NOT NULL DEFAULT 'UNPAID',
    "paidDate" TIMESTAMP(3),
    "attributionReason" TEXT NOT NULL,
    "overrideNote" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "type" "RewardType" NOT NULL,
    "amount" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtRiskReview" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "assignedTo" TEXT NOT NULL DEFAULT 'CEO',
    "status" "ReviewStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AtRiskReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageMapping" (
    "id" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "canonicalStage" "CanonicalStage" NOT NULL,
    "agentId" TEXT,
    "note" TEXT,

    CONSTRAINT "StageMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeveloperAlias" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,

    CONSTRAINT "DeveloperAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAlias" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ProjectAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StagingBatch" (
    "id" TEXT NOT NULL,
    "source" "IngestSource" NOT NULL,
    "sourceRef" TEXT,
    "agentName" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StagingBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StagingRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "sheetTab" TEXT,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StagingRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionError" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "raw" JSONB NOT NULL,
    "errors" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryPhone" TEXT NOT NULL,
    "email" TEXT,
    "country" TEXT,
    "language" TEXT,
    "optOutWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "optOutEmail" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "clientId" TEXT,
    "agentId" TEXT,
    "dealId" TEXT,
    "channel" "CommChannel" NOT NULL,
    "direction" "CommDirection" NOT NULL,
    "templateRef" TEXT,
    "body" TEXT,
    "outcome" "CallOutcome",
    "durationSec" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "developerId" TEXT,
    "market" "UnitMarket" NOT NULL,
    "unitType" TEXT NOT NULL,
    "unitNumber" TEXT,
    "bedrooms" INTEGER,
    "sizeSqm" DECIMAL(10,2),
    "priceOMR" DECIMAL(18,3),
    "status" "UnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "residencyTier" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_email_key" ON "Agent"("email");

-- CreateIndex
CREATE INDEX "Agent_role_idx" ON "Agent"("role");

-- CreateIndex
CREATE INDEX "Agent_status_idx" ON "Agent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Developer_name_key" ON "Developer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Developer_canonicalKey_key" ON "Developer"("canonicalKey");

-- CreateIndex
CREATE INDEX "Project_priorityRank_idx" ON "Project"("priorityRank");

-- CreateIndex
CREATE UNIQUE INDEX "Project_developerId_name_key" ON "Project"("developerId", "name");

-- CreateIndex
CREATE INDEX "Lead_canonicalStage_idx" ON "Lead"("canonicalStage");

-- CreateIndex
CREATE INDEX "Lead_assignedAgentId_idx" ON "Lead"("assignedAgentId");

-- CreateIndex
CREATE INDEX "Lead_source_idx" ON "Lead"("source");

-- CreateIndex
CREATE INDEX "Lead_assignmentStatus_idx" ON "Lead"("assignmentStatus");

-- CreateIndex
CREATE INDEX "Lead_clientId_idx" ON "Lead"("clientId");

-- CreateIndex
CREATE INDEX "Lead_scoreBand_idx" ON "Lead"("scoreBand");

-- CreateIndex
CREATE INDEX "Deal_closeDate_idx" ON "Deal"("closeDate");

-- CreateIndex
CREATE INDEX "Deal_developerId_idx" ON "Deal"("developerId");

-- CreateIndex
CREATE INDEX "Deal_canonicalStage_idx" ON "Deal"("canonicalStage");

-- CreateIndex
CREATE INDEX "DealAttribution_agentId_idx" ON "DealAttribution"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "DealAttribution_dealId_agentId_key" ON "DealAttribution"("dealId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "Target_agentId_period_key" ON "Target"("agentId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionLadder_tierName_key" ON "CommissionLadder"("tierName");

-- CreateIndex
CREATE INDEX "CommissionLadder_sortOrder_idx" ON "CommissionLadder"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSourceFloor_source_key" ON "LeadSourceFloor"("source");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperCommissionRule_developerId_minQuarterlyVolume_key" ON "DeveloperCommissionRule"("developerId", "minQuarterlyVolume");

-- CreateIndex
CREATE INDEX "MonthlyPerformanceSnapshot_period_idx" ON "MonthlyPerformanceSnapshot"("period");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyPerformanceSnapshot_agentId_period_key" ON "MonthlyPerformanceSnapshot"("agentId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_attributionId_key" ON "Commission"("attributionId");

-- CreateIndex
CREATE INDEX "Commission_dealId_idx" ON "Commission"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "Reward_agentId_period_type_key" ON "Reward"("agentId", "period", "type");

-- CreateIndex
CREATE UNIQUE INDEX "AtRiskReview_agentId_period_key" ON "AtRiskReview"("agentId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "StageMapping_sourceLabel_agentId_key" ON "StageMapping"("sourceLabel", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperAlias_alias_key" ON "DeveloperAlias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAlias_alias_key" ON "ProjectAlias"("alias");

-- CreateIndex
CREATE INDEX "StagingRow_batchId_idx" ON "StagingRow"("batchId");

-- CreateIndex
CREATE INDEX "IngestionError_batchId_idx" ON "IngestionError"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_primaryPhone_key" ON "Client"("primaryPhone");

-- CreateIndex
CREATE INDEX "CommunicationLog_leadId_idx" ON "CommunicationLog"("leadId");

-- CreateIndex
CREATE INDEX "CommunicationLog_agentId_idx" ON "CommunicationLog"("agentId");

-- CreateIndex
CREATE INDEX "CommunicationLog_occurredAt_idx" ON "CommunicationLog"("occurredAt");

-- CreateIndex
CREATE INDEX "Unit_projectId_idx" ON "Unit"("projectId");

-- CreateIndex
CREATE INDEX "Unit_status_idx" ON "Unit"("status");

-- CreateIndex
CREATE INDEX "Unit_published_idx" ON "Unit"("published");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_projectInterestId_fkey" FOREIGN KEY ("projectInterestId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealAttribution" ADD CONSTRAINT "DealAttribution_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealAttribution" ADD CONSTRAINT "DealAttribution_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperCommissionRule" ADD CONSTRAINT "DeveloperCommissionRule_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyPerformanceSnapshot" ADD CONSTRAINT "MonthlyPerformanceSnapshot_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "DealAttribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtRiskReview" ADD CONSTRAINT "AtRiskReview_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageMapping" ADD CONSTRAINT "StageMapping_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperAlias" ADD CONSTRAINT "DeveloperAlias_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Developer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAlias" ADD CONSTRAINT "ProjectAlias_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StagingRow" ADD CONSTRAINT "StagingRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "StagingBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionError" ADD CONSTRAINT "IngestionError_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "StagingBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

