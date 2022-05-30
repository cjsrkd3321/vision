import withHandler from '@libs/server/withHandler';
import { withApiSession } from '@libs/server/withSession';
import pgClient from '@libs/utils/pgClient';
import prisma from '@libs/utils/prisma';
import { Response } from '@_types/common-type';
import md5 from 'md5';
import type { NextApiRequest, NextApiResponse } from 'next';

const queryWithInstanceId = (instanceId: string) => {
  return `
    WITH sg AS (
      SELECT group_id, tags
      FROM aws_vpc_security_group
    )
    SELECT
        INSTANCE.account_id,
        EC2_SG ->> 'GroupId' as sg_id
    FROM
        aws_ec2_instance AS INSTANCE,
        jsonb_array_elements(INSTANCE.security_groups) AS EC2_SG
        JOIN sg AS SG ON sg.group_id = EC2_SG ->> 'GroupId'
    WHERE
        INSTANCE.instance_state = 'running'
        AND INSTANCE.instance_id = '${instanceId}'
        AND SG.tags ->> 'Type' = 'REF'
  `;
};

interface SecurityGroupInfo {
  accountId: string;
  region: string;
  sgId: string;
  protocol: string;
  port: number;
  source: string;
}

const getSecurityGroupInfo = ({
  accountId,
  region,
  sgId,
  protocol,
  port,
  source,
}: SecurityGroupInfo) => {
  return `
  SELECT 
    account_id, 
    region, 
    group_id AS sg_id, 
    security_group_rule_id AS sgr_id 
  FROM 
    aws_vpc_security_group_rule 
  WHERE 
    account_id = '${accountId}' 
    AND region = '${region}' 
    AND ip_protocol = '${protocol.toLowerCase()}' 
    AND referenced_group_id = '${source}' 
    AND group_id = '${sgId}' 
    AND to_port = ${port} 
    AND from_port = ${port}
  `;
};

async function handler(req: NextApiRequest, res: NextApiResponse<Response>) {
  // NOTE: GET
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, error: 'Unimplemented' });
  }

  // NOTE: POST
  if (req.method === 'POST') {
    const {
      session: { user: { id } = {} },
      body: { sourceId: srcId, destinationId: dstId, protocol, port, reason },
    } = req;

    if (!['TCP', 'UDP', 'ICMP'].includes(protocol)) {
      return res.status(400).json({
        ok: false,
        error: `Protocol can select one of 'TCP', 'UDP', 'ICMP'`,
      });
    }

    if (!srcId || !dstId || !port) {
      return res.status(400).json({
        ok: false,
        error: 'srcId, dstId, port are required',
      });
    }

    if (
      typeof srcId !== 'number' ||
      typeof dstId !== 'number' ||
      typeof port !== 'number'
    ) {
      return res.status(400).json({
        ok: false,
        error: 'srcId, dstId, port are number type',
      });
    }

    if (port < 1 || port > 65535) {
      return res.status(400).json({
        ok: false,
        error: 'Port range needs to be between 1 and 65535',
      });
    }

    if (reason.length < 6 || reason.length > 255) {
      return res
        .status(400)
        .json({
          ok: false,
          error: 'Reason length needs to be between 6 and 255',
        });
    }

    try {
      let [src, dst] = await prisma.resource.findMany({
        where: {
          OR: [
            {
              id: srcId,
            },
            srcId !== dstId
              ? {
                  id: dstId,
                }
              : {},
          ],
        },
      });
      srcId === dstId ? (dst = { ...src }) : null;
      if (!src || !dst) {
        return res.status(404).json({
          ok: false,
          error: 'srcId or dstId does not exist',
        });
      }

      const { instance_id: srcInstanceId, vpc_id: srcVpcId } = JSON.parse(
        src.result
      );
      const {
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

      const [srcResult, ..._srcRest] = (
        await pgClient?.query(queryWithInstanceId(srcInstanceId))
      ).rows;
      if (!srcResult) {
        return res.status(404).json({
          ok: false,
          error: `Src ${srcInstanceId} has no SG with tag(Type = REF)`,
        });
      }

      const [dstResult, ..._dstRest] = (
        await pgClient?.query(queryWithInstanceId(dstInstanceId))
      ).rows;
      if (!dstResult) {
        return res.status(404).json({
          ok: false,
          error: `Dst ${dstInstanceId} has no SG with tag(Type = REF)`,
        });
      }

      const { sg_id: srcSgId } = srcResult;
      const { account_id, sg_id: dstSgId } = dstResult;
      const uid = md5(account_id + dstSgId + protocol + port + srcSgId);

      const duplicatedResult = await prisma?.securityGroup.findUnique({
        where: {
          uid,
        },
      });
      if (duplicatedResult) {
        return res
          .status(400)
          .json({
            ok: false,
            error: `Your request is already requested or completed (${duplicatedResult.status})`,
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
      if (!!securityGroupInfo.length) {
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
