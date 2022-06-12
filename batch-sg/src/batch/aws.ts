import {
  AuthorizeSecurityGroupIngressCommand,
  EC2Client,
  ModifySecurityGroupRulesCommand,
  RevokeSecurityGroupIngressCommand,
} from '@aws-sdk/client-ec2';
import { SecurityGroup } from '@prisma/client';
import { pg } from '../db';
import { prisma } from '../libs/prisma';
import { SECOND } from '../libs/time';

const batchTime = 10 * SECOND;

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

    results.forEach(async (result: Partial<SecurityGroup>) => {
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
                      CidrIp: !source!.startsWith('sg') ? source : undefined,
                    },
                  ],
                  UserIdGroupPairs: [
                    {
                      GroupId: source!.startsWith('sg') ? source : undefined,
                    },
                  ],
                },
              ],
            })
          );

          const { Return, SecurityGroupRules: [{ SecurityGroupRuleId }] = [] } =
            response;

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
                      CidrIp: !source!.startsWith('sg') ? source : undefined,
                    },
                  ],
                  UserIdGroupPairs: [
                    {
                      GroupId: source!.startsWith('sg') ? source : undefined,
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
                  SecurityGroupRuleId: sgrId ?? undefined,
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
      } catch (error: any) {
        console.log(`[createSecurityGroupBatch][SG][ERROR] : ${error.message}`);
      } finally {
        console.log(
          `[createSecurityGroupBatch][SG][FINALLY] : Waiting ${
            batchTime / SECOND
          } seconds...`
        );
      }
    });
  } catch (error: any) {
    console.log(`[createSecurityGroupBatch][ERROR] : ${error.message}`);
  } finally {
    setTimeout(createSecurityGroupBatch, batchTime);
  }
};

setTimeout(createSecurityGroupBatch, SECOND);
