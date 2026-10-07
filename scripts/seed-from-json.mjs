#!/usr/bin/env node

/**
 * Seed PostgreSQL database from .data/scraper.json
 * 
 * This script migrates development data to PostgreSQL for production testing.
 * Run this after: npm run db:init
 * 
 * It imports all jobs, companies, workflows, opportunities, and evidence
 * from the JSON file and stores them in the PostgreSQL database.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting migration from JSON to PostgreSQL...");

  // Read JSON file
  const dataPath = join(process.cwd(), ".data", "scraper.json");
  let data;

  try {
    const content = readFileSync(dataPath, "utf8");
    data = JSON.parse(content);
  } catch (error) {
    console.error("Error reading .data/scraper.json:", error.message);
    process.exit(1);
  }

  if (!data.jobs || !Array.isArray(data.jobs)) {
    console.log("No jobs found in JSON file");
    return;
  }

  console.log(`Found ${data.jobs.length} jobs to migrate`);

  try {
    // 1. Migrate Jobs
    console.log("\nMigrating jobs...");
    for (const job of data.jobs) {
      await prisma.job.upsert({
        where: { id: job.id },
        update: {
          name: job.name,
          status: job.status || "queued",
          targetType: job.targetType,
          target: job.target,
          campaignId: job.campaignId,
          totalUrls: job.totalUrls,
          processedUrls: job.processedUrls,
          successfulUrls: job.successfulUrls,
          errorRate: job.errorRate || 0,
          configuration: JSON.stringify(job.configuration || {}),
          createdAt: new Date(job.createdAt),
          updatedAt: new Date(job.updatedAt || new Date()),
        },
        create: {
          id: job.id,
          name: job.name,
          status: job.status || "queued",
          targetType: job.targetType,
          target: job.target,
          campaignId: job.campaignId,
          totalUrls: job.totalUrls,
          processedUrls: job.processedUrls,
          successfulUrls: job.successfulUrls,
          errorRate: job.errorRate || 0,
          configuration: JSON.stringify(job.configuration || {}),
          createdAt: new Date(job.createdAt),
          updatedAt: new Date(job.updatedAt || new Date()),
        },
      });
    }
    console.log(`✓ Migrated ${data.jobs.length} jobs`);

    // 2. Migrate Queue Items
    if (data.queue && Array.isArray(data.queue)) {
      console.log("\nMigrating queue items...");
      for (const item of data.queue) {
        await prisma.queueItem.upsert({
          where: { id: item.id },
          update: {
            status: item.status,
            url: item.url,
            normalizedUrl: item.normalizedUrl,
            attempts: item.attempts,
            discoveredAt: new Date(item.discoveredAt),
          },
          create: {
            id: item.id,
            jobId: item.jobId,
            status: item.status,
            url: item.url,
            normalizedUrl: item.normalizedUrl,
            attempts: item.attempts,
            discoveredAt: new Date(item.discoveredAt),
          },
        });
      }
      console.log(`✓ Migrated ${data.queue.length} queue items`);
    }

    // 3. Migrate Companies
    if (data.companies && Array.isArray(data.companies)) {
      console.log("\nMigrating companies...");
      for (const company of data.companies) {
        await prisma.company.upsert({
          where: { id: company.id },
          update: {
            name: company.name,
            domain: company.domain,
            website: company.website,
            description: company.description,
            pageCount: company.pageCount,
            firstSeenAt: new Date(company.firstSeenAt),
            lastSeenAt: new Date(company.lastSeenAt),
          },
          create: {
            id: company.id,
            name: company.name,
            domain: company.domain,
            website: company.website,
            description: company.description,
            pageCount: company.pageCount,
            firstSeenAt: new Date(company.firstSeenAt),
            lastSeenAt: new Date(company.lastSeenAt),
          },
        });
      }
      console.log(`✓ Migrated ${data.companies.length} companies`);
    }

    // 4. Migrate Company Pages
    if (data.companies && Array.isArray(data.companies)) {
      console.log("\nMigrating company pages...");
      let pageCount = 0;
      for (const company of data.companies) {
        if (company.pages && Array.isArray(company.pages)) {
          for (const page of company.pages) {
            await prisma.companyPage.upsert({
              where: { id: page.id },
              update: {
                url: page.url,
                title: page.title,
                description: page.description,
                text: page.text,
                crawledAt: new Date(page.crawledAt),
              },
              create: {
                id: page.id,
                companyId: company.id,
                jobId: page.jobId,
                url: page.url,
                title: page.title,
                description: page.description,
                text: page.text,
                crawledAt: new Date(page.crawledAt),
              },
            });
            pageCount++;
          }
        }
      }
      console.log(`✓ Migrated ${pageCount} company pages`);
    }

    // 5. Migrate Evidence
    if (data.evidence && Array.isArray(data.evidence)) {
      console.log("\nMigrating evidence...");
      for (const evidence of data.evidence) {
        await prisma.evidence.upsert({
          where: { id: evidence.id },
          update: {
            url: evidence.url,
            label: evidence.label,
            excerpt: evidence.excerpt,
            createdAt: new Date(evidence.createdAt),
          },
          create: {
            id: evidence.id,
            companyId: evidence.companyId,
            jobId: evidence.jobId,
            url: evidence.url,
            label: evidence.label,
            excerpt: evidence.excerpt,
            createdAt: new Date(evidence.createdAt),
          },
        });
      }
      console.log(`✓ Migrated ${data.evidence.length} evidence records`);
    }

    // 6. Migrate Workflows
    if (data.workflows && Array.isArray(data.workflows)) {
      console.log("\nMigrating workflows...");
      for (const workflow of data.workflows) {
        await prisma.workflow.upsert({
          where: { id: workflow.id },
          update: {
            name: workflow.name,
            description: workflow.description,
            category: workflow.category,
            confidence: workflow.confidence,
            signals: JSON.stringify(workflow.signals || []),
            evaluation: JSON.stringify(workflow.evaluation || {}),
            firstSeenAt: new Date(workflow.firstSeenAt),
            lastSeenAt: new Date(workflow.lastSeenAt),
          },
          create: {
            id: workflow.id,
            companyId: workflow.companyId,
            jobId: workflow.jobId,
            name: workflow.name,
            description: workflow.description,
            category: workflow.category,
            confidence: workflow.confidence,
            signals: JSON.stringify(workflow.signals || []),
            evaluation: JSON.stringify(workflow.evaluation || {}),
            firstSeenAt: new Date(workflow.firstSeenAt),
            lastSeenAt: new Date(workflow.lastSeenAt),
          },
        });
      }
      console.log(`✓ Migrated ${data.workflows.length} workflows`);
    }

    // 7. Migrate Opportunities
    if (data.opportunities && Array.isArray(data.opportunities)) {
      console.log("\nMigrating opportunities...");
      for (const opportunity of data.opportunities) {
        await prisma.opportunity.upsert({
          where: { id: opportunity.id },
          update: {
            workflowId: opportunity.workflowId,
            companyName: opportunity.companyName,
            workflowName: opportunity.workflowName,
            title: opportunity.title,
            summary: opportunity.summary,
            score: opportunity.score,
            confidence: opportunity.confidence,
            status: opportunity.status || "new",
            createdAt: new Date(opportunity.createdAt),
            updatedAt: new Date(opportunity.updatedAt),
          },
          create: {
            id: opportunity.id,
            workflowId: opportunity.workflowId,
            companyId: opportunity.companyId,
            companyName: opportunity.companyName,
            workflowName: opportunity.workflowName,
            title: opportunity.title,
            summary: opportunity.summary,
            score: opportunity.score,
            confidence: opportunity.confidence,
            status: opportunity.status || "new",
            createdAt: new Date(opportunity.createdAt),
            updatedAt: new Date(opportunity.updatedAt),
          },
        });
      }
      console.log(`✓ Migrated ${data.opportunities.length} opportunities`);
    }

    console.log("\n✓ Migration complete!");
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
