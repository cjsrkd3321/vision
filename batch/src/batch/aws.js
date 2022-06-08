import {
  GenerateCredentialReportCommand,
  GetCredentialReportCommand,
} from '@aws-sdk/client-iam';
import Batch from '../libs/batch';
import { iamClient } from '../libs/aws/iamClient';
import {
  EC2Client,
  AuthorizeSecurityGroupIngressCommand,
  RevokeSecurityGroupIngressCommand,
  ModifySecurityGroupRulesCommand,
} from '@aws-sdk/client-ec2';
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

const createSecurityGroupBatch = async () => {
  try {
    const completedResults = await prisma.securityGroup.findMany({
      where: {
        OR: [{ status: 'COMPLETED' }, { status: 'DETECT_MODIFIED' }],
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
        status: true,
      },
    });

    completedResults.forEach(async (result) => {
      const {
        id,
        accountId,
        region: sgRegion,
        sgId,
        sgrId,
        protocol,
        port,
        source,
        status,
      } = result;

      const currentSecurityGroupRule = (
        await pg.query(`
          SELECT 
            account_id,
            region,
            group_id AS sg_id,
            security_group_rule_id as sgr_id,
            to_port,
            from_port,
            ip_protocol,
            referenced_group_id,
            cidr_ipv4
          FROM 
            aws_vpc_security_group_rule 
          WHERE 
            group_id = '${sgId}' 
            AND security_group_rule_id = '${sgrId}' 
            AND account_id = '${accountId}'
      `)
      ).rows;

      if (currentSecurityGroupRule.length === 0) {
        await prisma.securityGroup.update({
          where: { id },
          data: {
            status: 'DETECT_DELETED',
          },
        });
      } else if (currentSecurityGroupRule.length === 1) {
        const [
          {
            account_id,
            region,
            sg_id,
            sgr_id,
            to_port,
            from_port,
            ip_protocol,
            referenced_group_id,
            cidr_ipv4,
          },
        ] = currentSecurityGroupRule;

        if (
          status === 'COMPLETED' &&
          (accountId !== account_id ||
            sgRegion !== region ||
            sgId !== sg_id ||
            sgrId !== sgr_id ||
            Number(to_port) !== port ||
            Number(from_port) !== port ||
            protocol.toLowerCase() !== ip_protocol ||
            (source !== referenced_group_id && source !== cidr_ipv4))
        ) {
          await prisma.securityGroup.update({
            where: { id },
            data: {
              status: 'DETECT_MODIFIED',
            },
          });
        } else if (
          status === 'DETECT_MODIFIED' &&
          accountId === account_id &&
          sgRegion === region &&
          sgId === sg_id &&
          sgrId === sgr_id &&
          Number(to_port) === port &&
          Number(from_port) === port &&
          protocol.toLowerCase() === ip_protocol &&
          (source === referenced_group_id || source === cidr_ipv4)
        ) {
          await prisma.securityGroup.update({
            where: { id },
            data: {
              status: 'COMPLETED',
            },
          });
        }
      }
    });

    // // // // // // // // // // // // // // // //

    const results = await prisma.securityGroup.findMany({
      where: {
        OR: [
          { status: 'APPROVE_CREATE' },
          { status: 'APPROVE_MODIFY' },
          { status: 'APPROVE_DELETE' },
        ],
      },
      select: {
        id: true,
        status: true,
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
      const { id, status, region, sgId, sgrId, port, protocol, source } =
        result;

      const ec2 = new EC2Client({ region });

      try {
        if (status === 'APPROVE_CREATE') {
          const response = await ec2.send(
            new AuthorizeSecurityGroupIngressCommand({
              GroupId: sgId,
              IpPermissions: [
                {
                  FromPort: port,
                  ToPort: port,
                  IpProtocol: protocol,
                  IpRanges: [
                    {
                      CidrIp: !source.startsWith('sg') ? source : null,
                    },
                  ],
                  UserIdGroupPairs: [
                    {
                      GroupId: source.startsWith('sg') ? source : null,
                    },
                  ],
                },
              ],
            })
          );

          const {
            Return,
            SecurityGroupRules: [{ SecurityGroupRuleId }],
          } = response;

          // 생성 실패 시
          if (!Return) {
            await prisma.securityGroup.update({
              where: { id },
              data: {
                status: 'FAILED_CREATE',
              },
            });
          }

          // 생성 성공 시
          await prisma.securityGroup.update({
            where: { id },
            data: {
              sgrId: SecurityGroupRuleId,
              createdAt: new Date(),
              status: 'COMPLETED',
            },
          });
        } else if (status === 'APPROVE_DELETE') {
          const response = await ec2.send(
            new RevokeSecurityGroupIngressCommand({
              GroupId: sgId,
              IpPermissions: [
                {
                  FromPort: port,
                  ToPort: port,
                  IpProtocol: protocol,
                  IpRanges: [
                    {
                      CidrIp: !source.startsWith('sg') ? source : null,
                    },
                  ],
                  UserIdGroupPairs: [
                    {
                      GroupId: source.startsWith('sg') ? source : null,
                    },
                  ],
                },
              ],
            })
          );

          const { Return } = response;

          // 삭제 실패 시
          if (!Return) {
            await prisma.securityGroup.update({
              where: { id },
              data: {
                status: 'FAILED_DELETE',
              },
            });
          }

          // 삭제 성공 시
          await prisma.securityGroup.update({
            where: { id },
            data: {
              // sgrId: SecurityGroupRuleId,
              deletedAt: new Date(),
              status: 'DELETED',
            },
          });
        } else if (status === 'APPROVE_MODIFY') {
          const response = await ec2.send(
            new ModifySecurityGroupRulesCommand({
              GroupId: sgId,
              SecurityGroupRules: [
                {
                  SecurityGroupRuleId: sgrId,
                  SecurityGroupRule: {
                    IpProtocol: protocol,
                    FromPort: port,
                    ToPort: port,
                    ReferencedGroupId: source,
                  },
                },
              ],
            })
          );

          const { Return } = response;

          // 변경 실패 시
          if (!Return) {
            await prisma.securityGroup.update({
              where: { id },
              data: {
                status: 'FAILED_MODIFY',
              },
            });
          }

          // 변경 성공 시
          await prisma.securityGroup.update({
            where: { id },
            data: {
              modifiedAt: new Date(),
              status: 'COMPLETED',
            },
          });
        }
      } catch (error) {
        console.log(`[createSecurityGroupBatch][SG][ERROR] : ${error.message}`);
      } finally {
        console.log(
          `[createSecurityGroupBatch][SG][FINALLY] : Waiting 30 seconds...`
        );
      }
    });
  } catch (error) {
    console.log(`[createSecurityGroupBatch][ERROR] : ${error.message}`);
  } finally {
    setTimeout(createSecurityGroupBatch, 10 * SECOND);
  }
};

// setTimeout(createCredentialReport, SECOND);
setTimeout(createQueryBatch, SECOND);
setTimeout(createSecurityGroupBatch, SECOND);
