import {
  GenerateCredentialReportCommand,
  GetCredentialReportCommand,
} from '@aws-sdk/client-iam';
import Batch from '../libs/batch';
import { iamClient } from '../libs/aws/iamClient';
import { HOUR, MINUTE, SECOND } from '../libs/time';
import { prisma } from '../libs/prisma';

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
    console.log(`[createCredentialReport][ERROR] : ${error?.GeneratedTime}`);
    // while (true) {
    //   const data = await iamClient.send(new GenerateCredentialReportCommand());
    //   if (data.State === 'COMPLETE') {
    //     console.log('[createCredentialReport] COMPLETE');
    //     return;
    //   }
    // }
  } finally {
    console.log(`[createCredentialReport][FINALLY] Waiting...`);
    // setTimeout(createCredentialReport, remainedTime);
  }
};

// NOTE: Create batch job for user's queries.
let currentQueryIds = [];
const createBatch = async () => {
  try {
    const results = await prisma.queries.findMany({
      // include: {
      //   user: {},
      //   resources: {},
      //   compliances: {},
      // },
    });

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
    console.log(`[createBatch][ERROR] : ${error?.GeneratedTime}`);
  } finally {
    // console.log(`[createBatch][FINALLY] Waiting...`);
    setTimeout(createBatch, 10 * SECOND);
  }
};

setTimeout(createCredentialReport, SECOND);
setTimeout(createBatch, SECOND);
