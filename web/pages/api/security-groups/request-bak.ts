import {
  getSecurityGroupInfo,
  getSgWithUniqueId,
  InstanceType
} from '@libs/queries';
import withHandler from '@libs/server/withHandler';
import { withApiSession } from '@libs/server/withSession';
import pgClient from '@libs/utils/pgClient';
import prisma from '@libs/utils/prisma';
import { Response } from '@_types/common-type';
import md5 from 'md5';
import type { NextApiRequest, NextApiResponse } from 'next';

async function handler(req: NextApiRequest, res: NextApiResponse<Response>) {
  // NOTE: GET
  if (req.method === 'GET') {
    return res.status(404).json({ ok: true, error: 'Not implemented' });
  }

  // NOTE: POST
  if (req.method === 'POST') {
    const {
      session: { user: { id } = {} },
      body: {
        sourceIp,
        sourceId: srcId,
        destinationId: dstId,
        protocol,
        port,
        reason,
      },
    } = req;

    if (!['TCP', 'UDP', 'ICMP'].includes(protocol)) {
      return res.status(400).json({
        ok: false,
        error: `Protocol can select one of 'TCP', 'UDP', 'ICMP'`,
      });
    }

    if ((!sourceIp && !srcId) || !dstId || !port) {
      return res.status(400).json({
        ok: false,
        error: 'sourceId(or sourceIp), destinationId, port are required',
      });
    }

    if (sourceIp && srcId) {
      return res.status(403).json({
        ok: false,
        error: `Unable to use 'sourceIp' and 'sourceId' at the same time`,
      });
    }

    const regex =
      /^(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]?|0)\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]?|0)\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]?|0)\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]?|0)(\/([1-9]|[1-2][0-9]|3[0-2])){0,1}$/;
    if (sourceIp && sourceIp.search(regex) === -1) {
      return res.status(400).json({
        ok: false,
        error: `Invalid IPv4 format`,
      });
    }

    if (
      (typeof sourceIp !== 'string' && typeof srcId !== 'number') ||
      typeof dstId !== 'number' ||
      typeof port !== 'number'
    ) {
      return res.status(400).json({
        ok: false,
        error: 'srcId, dstId, port are number type',
      });
    }

    if (protocol === 'ICMP' && port !== -1) {
      return res.status(400).json({
        ok: false,
        error: 'ICMP port only can -1',
      });
    }

    if (protocol !== 'ICMP' && (port < 1 || port > 65535)) {
      return res.status(400).json({
        ok: false,
        error: 'Port range needs to be between 1 and 65535',
      });
    }

    if (reason.length < 6 || reason.length > 255) {
      return res.status(400).json({
        ok: false,
        error: 'Reason length needs to be between 6 and 255',
      });
    }

    try {
      if (sourceIp) {
        // FIXME: DUPLICATED
        let dst = await prisma.resource.findUnique({
          where: { id: dstId },
          select: {
            result: true,
            queries: {
              select: {
                name: true,
              },
            },
          },
        });

        if (!dst) {
          return res.status(404).json({
            ok: false,
            error: 'destinationId does not exist',
          });
        }

        const dstInstanceType: InstanceType = dst?.queries
          ?.name as InstanceType;

        if (!dstInstanceType) {
          return res.status(404).json({
            ok: false,
            error: `Type is null(not EC2, ALB, NLB etc...)`,
          });
        }

        const {
          arn: dstArn,
          instance_id: dstInstanceId,
          region: dstRegion,
        } = JSON.parse(dst.result);

        const dstResult = await getSgWithUniqueId({
          client: pgClient,
          sgType: 'IP',
          instanceType: dstInstanceType,
          uniqueId: dstInstanceType === 'EC2' ? dstInstanceId : dstArn,
        });
        if (!dstResult) {
          return res.status(404).json({
            ok: false,
            error: `Dst(${dstInstanceId}) has no SG with tag(Type = IP)`,
          });
        }

        const { account_id, sg_id: dstSgId } = dstResult;
        const uid = md5(account_id + dstSgId + protocol + port + sourceIp);

        const duplicatedResult = await prisma?.securityGroup.findFirst({
          where: {
            uid,
            status: { notIn: ['DELETED', 'DETECT_DELETED'] },
          },
          select: {
            status: true,
            user: true,
          },
        });
        if (duplicatedResult) {
          return res.status(400).json({
            ok: false,
            error: `Your request already exists (Status : ${duplicatedResult.status} / Requester : ${duplicatedResult.user.userId})`,
          });
        }

        const securityGroupInfo = (
          await pgClient?.query(
            getSecurityGroupInfo({
              accountId: account_id,
              region: dstRegion,
              sgId: dstSgId,
              protocol,
              port,
              source: sourceIp,
            })
          )
        ).rows;
        if (securityGroupInfo.length !== 0) {
          const [{ account_id, region, sg_id, sgr_id }] = securityGroupInfo;
          return res.status(400).json({
            ok: false,
            error: `Your request already exists (${account_id} | ${region} | ${sg_id} | ${sgr_id})`,
          });
        }

        await prisma?.securityGroup.create({
          data: {
            accountId: account_id,
            region: dstRegion,
            sgId: dstSgId,
            protocol,
            port,
            source: sourceIp,
            reason,
            status: 'REQUEST_CREATE',
            uid,
            user: {
              connect: { id },
            },
          },
        });

        return res.status(200).json({
          ok: true,
          msg: `Request succeeded`,
        });
      } else {
        // FIXME: DUPLICATED
        let src = await prisma.resource.findUnique({
          where: { id: srcId },
          select: {
            result: true,
            queries: {
              select: {
                name: true,
              },
            },
          },
        });

        let dst = await prisma.resource.findUnique({
          where: { id: dstId },
          select: {
            result: true,
            queries: {
              select: {
                name: true,
              },
            },
          },
        });

        if (!src || !dst) {
          return res.status(404).json({
            ok: false,
            error: 'srcId or dstId does not exist',
          });
        }

        const srcInstanceType: InstanceType = src?.queries
          ?.name as InstanceType;
        const dstInstanceType: InstanceType = dst?.queries
          ?.name as InstanceType;

        if (!srcInstanceType || !dstInstanceType) {
          return res.status(404).json({
            ok: false,
            error: `Type is null(not EC2, ALB, NLB etc...)`,
          });
        }

        const {
          arn: srcArn,
          instance_id: srcInstanceId,
          vpc_id: srcVpcId,
        } = JSON.parse(src.result);
        const {
          arn: dstArn,
          instance_id: dstInstanceId,
          vpc_id: dstVpcId,
          region: dstRegion,
        } = JSON.parse(dst.result);

        if (srcVpcId !== dstVpcId) {
          return res.status(400).json({
            ok: false,
            error: `Src VPC and Dst VPC must be equal`,
          });
        }

        const [srcResult, dstResult] = [
          await getSgWithUniqueId({
            client: pgClient,
            sgType: 'REF',
            instanceType: srcInstanceType,
            uniqueId: srcInstanceType === 'EC2' ? srcInstanceId : srcArn,
          }),
          await getSgWithUniqueId({
            client: pgClient,
            sgType: 'REF',
            instanceType: dstInstanceType,
            uniqueId: dstInstanceType === 'EC2' ? dstInstanceId : dstArn,
          }),
        ];
        if (!srcResult || !dstResult) {
          return res.status(404).json({
            ok: false,
            error: `Src(${srcInstanceId}) or Dst(${dstInstanceId}) has no SG with tag(Type = REF)`,
          });
        }

        const { sg_id: srcSgId } = srcResult;
        const { account_id, sg_id: dstSgId } = dstResult;
        const uid = md5(account_id + dstSgId + protocol + port + srcSgId);

        const duplicatedResult = await prisma?.securityGroup.findFirst({
          where: {
            uid,
            status: { notIn: ['DELETED', 'DETECT_DELETED'] },
          },
          select: {
            status: true,
            user: true,
          },
        });
        if (duplicatedResult) {
          return res.status(400).json({
            ok: false,
            error: `Your request already exists (Status : ${duplicatedResult.status} / Requester : ${duplicatedResult.user.userId})`,
          });
        }

        const securityGroupInfo = (
          await pgClient?.query(
            getSecurityGroupInfo({
              accountId: account_id,
              region: dstRegion,
              sgId: dstSgId,
              protocol,
              port,
              source: srcSgId,
            })
          )
        ).rows;
        if (securityGroupInfo.length !== 0) {
          const [{ account_id, region, sg_id, sgr_id }] = securityGroupInfo;
          return res.status(400).json({
            ok: false,
            error: `Your request already exists (${account_id} | ${region} | ${sg_id} | ${sgr_id})`,
          });
        }

        await prisma?.securityGroup.create({
          data: {
            accountId: account_id,
            region: dstRegion,
            sgId: dstSgId,
            protocol,
            port,
            source: srcSgId,
            reason,
            status: 'REQUEST_CREATE',
            uid,
            user: {
              connect: { id },
            },
          },
        });

        return res.status(200).json({
          ok: true,
          msg: `Request succeeded`,
        });
      }
    } catch (error: any) {
      const { message: msg, code } = error;
      if (code === 'ECONNREFUSED') {
        return res.status(500).json({
          ok: false,
          error: "DB Connection error. Please check your steampipe's status",
        });
      }

      return res.status(500).json({ ok: false, error: msg });
    }
  }
}

export default withApiSession(
  withHandler({ methods: ['GET', 'POST'], handler })
);
