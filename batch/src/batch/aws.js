import {
  GenerateCredentialReportCommand,
  GetCredentialReportCommand,
} from '@aws-sdk/client-iam';
import Batch from '../libs/batch';
import { iamClient } from '../libs/aws/iamClient';
import { HOUR, SECOND } from '../libs/time';
import { prisma } from '../libs/prisma';
import { pg } from '../db';

// NOTE: Create credential report
const createCredentialReport = async () => {
  let remainedTime = 4 * HOUR;

  try {
    // const data = await iamClient.send(new GetCredentialReportCommand());
    // remainedTime = Math.ceil(
    //   4 * HOUR - (Date.now() - Date.parse(data.GeneratedTime))
    // );
    // console.log(`[createCredentialReport][TRY] : ${remainedTime}`);
    return;
  } catch (error) {
    // console.log(`[createCredentialReport][ERROR] : ${error?.GeneratedTime}`);
    // while (true) {
    //   const data = await iamClient.send(new GenerateCredentialReportCommand());
    //   if (data.State === 'COMPLETE') {
    //     console.log('[createCredentialReport] COMPLETE');
    //     return;
    //   }
    // }
  } finally {
    // console.log(`[createCredentialReport][FINALLY] Waiting...`);
    // setTimeout(createCredentialReport, remainedTime);
  }
};

// NOTE: Create batch job for user's queries.
let currentQueryIds = [];
const createQueryBatch = async () => {
  try {
    const results = await prisma.queries.findMany({});

    results.forEach((result) => {
      const { id, query, category } = result;
      if (currentQueryIds.includes(id)) return;

      if (category === 'COMPLIANCE') {
        currentQueryIds.push(id);
        console.log(`[COMPLIANCE] ${id}`);
        Batch.complianceBatch(query, id);
      } else if (category === 'CUSTOM') {
        currentQueryIds.push(id);
        console.log(`[RESOURCE] ${id}`);
        Batch.resourceBatch(query, id);
      } else if (category === 'SG') {
        currentQueryIds.push(id);
        console.log(`[SG] ${id}`);
        Batch.resourceBatch(query, id);
      }
    });
  } catch (error) {
    console.log(`[createQeuryBatch][ERROR] : ${error.message}`);
  } finally {
    // console.log(`[createQueryBatch][FINALLY] Waiting...`);
    setTimeout(createQueryBatch, 10 * SECOND);
  }
};

// setTimeout(createCredentialReport, SECOND);
setTimeout(createQueryBatch, SECOND);
