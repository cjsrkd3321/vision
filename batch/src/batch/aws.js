import {
  GenerateCredentialReportCommand,
  GetCredentialReportCommand,
} from '@aws-sdk/client-iam';
import Batch from '../libs/batch';
import { iamClient } from '../libs/aws/iamClient';
import { EC2Client, AuthorizeSecurityGroupIngressCommand } from "@aws-sdk/client-ec2";
import { HOUR, SECOND } from '../libs/time';
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
    setTimeout(createQueryBatch, 30 * SECOND);
  }
};

const createSecurityGroupBatch = async () => {
  try {
    const results = await prisma.securityGroup.findMany({
      where: {
        status: 'REQUEST_CREATE',
      },
      select: {
        id: true,
        accountId: true,
        region: true,
        sgId: true,
        sgrId: true,
        protocol: true,
        port: true,
        source: true,
      },
    });

    results.forEach(async (result) => {
      const { id, region, port, protocol, source } = result;
      const ec2 = new EC2Client({ region });

      try {
        const response = await ec2.send(new AuthorizeSecurityGroupIngressCommand({
          GroupId: result.sgId,
          IpPermissions: [
            {
              FromPort: port,
              ToPort: port,
              IpProtocol: protocol,
              UserIdGroupPairs: [
                {
                  GroupId: source,
                },
              ],
            },
          ],
        }));

        const { Return, SecurityGroupRules: [{ SecurityGroupRuleId }] } = response;

        if (!Return) {
          await prisma.securityGroup.update({
            where: { id },
            data: {
              status: 'FALIED',
            },
          });
        }

        await prisma.securityGroup.update({
          where: { id },
          data: {
            sgrId: SecurityGroupRuleId,
            createdAt: new Date(),
            status: 'COMPLETED',
          },
        })
      } catch (error) {
        console.log(`[createSecurityGroupBatch][Authorize][ERROR] : ${error.message}`);
      }
    });
  } catch (error) {
    console.log(`[createSecurityGroupBatch][ERROR] : ${error.message}`);
  } finally {
    setTimeout(createSecurityGroupBatch, 30 * SECOND);
  }
}

// setTimeout(createCredentialReport, SECOND);
setTimeout(createQueryBatch, SECOND);
setTimeout(createSecurityGroupBatch, SECOND);
