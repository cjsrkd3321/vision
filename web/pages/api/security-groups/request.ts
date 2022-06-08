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
      const dst = await prisma.resource.findUnique({
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

      const dstInstanceType: InstanceType = dst?.queries?.name as InstanceType;

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
        vpc_id: dstVpcId,
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

      // NOTE:
      let srcSgId = undefined;
      if (srcId) {
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

        if (!src) {
          return res.status(404).json({
            ok: false,
            error: 'sourceId does not exist',
          });
        }

        const srcInstanceType: InstanceType = src?.queries
          ?.name as InstanceType;

        if (!srcInstanceType) {
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

        if (srcVpcId !== dstVpcId) {
          return res.status(400).json({
            ok: false,
            error: `Src VPC and Dst VPC must be equal`,
          });
        }

        const srcResult = await getSgWithUniqueId({
          client: pgClient,
          sgType: 'REF',
          instanceType: srcInstanceType,
          uniqueId: srcInstanceType === 'EC2' ? srcInstanceId : srcArn,
        });
        if (!srcResult) {
          return res.status(404).json({
            ok: false,
            error: `Src(${srcInstanceId}) has no SG with tag(Type = REF)`,
          });
        }

        srcSgId = srcResult.sg_id;
      }

      const uid = md5(
        account_id + dstSgId + protocol + port + sourceIp ?? srcSgId
      );

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
            source: sourceIp ?? srcSgId,
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
          source: sourceIp ?? srcSgId,
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
        msg: `Request Succeeded`,
      });
    } catch (error: any) {
      const { message: msg, code } = error;
      if (code === 'ECONNREFUSED') {
        return res.status(500).json({
          ok: false,
          error: "DB Connection error. Please check your steampipe's status",
        });
      }

      console.log(`[/API/SECURITY-GROUPS/REQUEST] ${error}`);
      return res.status(500).json({ ok: false, error: msg });
    }
  }
}

export default withApiSession(
  withHandler({ methods: ['GET', 'POST'], handler })
);
