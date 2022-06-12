import {
  getSgWithUniqueId, InstanceType, listInstancesWithSgQuery
} from '@libs/queries';
import withHandler from '@libs/server/withHandler';
import { withApiSession } from '@libs/server/withSession';
import pgClient from '@libs/utils/pgClient';
import prisma from '@libs/utils/prisma';
import { Response } from '@_types/common-type';
import type { NextApiRequest, NextApiResponse } from 'next';

const sortByTitle = (a: any, b: any) => {
  if (a.title > b.title) return 1;
  if (a.title < b.title) return -1;
  return 0;
};

async function handler(req: NextApiRequest, res: NextApiResponse<Response>) {
  const {
    session: { user: { userId, id } = {} },
    query: { id: requestId },
  } = req;
  let instances = [];

  if (!requestId || isNaN(Number(requestId))) {
    return res.status(400).json({
      ok: false,
      error: `ID is required and numeric`,
    });
  }

  try {
    const result = await prisma.resource.findUnique({
      where: { id: Number(requestId) },
      select: {
        result: true,
        queries: {
          select: {
            name: true,
          },
        },
      },
    });
    if (!result) {
      return res.status(404).json({
        ok: false,
        error: `ID ${requestId} does not exist`,
      });
    }

    const instanceType = result?.queries?.name;
    if (!instanceType) {
      return res.status(404).json({
        ok: false,
        error: `Type is null(not EC2, ALB, NLB etc...)`,
      });
    }

    const { instance_id, arn } = JSON.parse(result.result);
    const uniqueId = instanceType === 'EC2' ? instance_id : arn;
    const instance = await getSgWithUniqueId({ client: pgClient, sgType: 'REF', instanceType: instanceType as InstanceType, uniqueId });

    if (!instance) {
      return res.status(404).json({
        ok: false,
        error: `${uniqueId} has no SG with tag(Type = REF)`,
      });
    }

    const { sg_id } = instance;
    instances = (await pgClient?.query(listInstancesWithSgQuery(sg_id))).rows;
    if (instances.length === 0) {
      return res.status(404).json({
        ok: false,
        error: `No instances applied`,
      });
    }
  } catch (error: any) {
    console.log(`[/API/SECURITY-GROUPS/INSTANCES/[ID]] ${error}`);
    const { message: msg, code } = error;
    if (code === 'ECONNREFUSED') {
      return res.status(500).json({
        ok: false,
        error: "DB Connection error. Please check your steampipe's status",
      });
    }

    return res.status(500).json({ ok: false, error: msg });
  }

  instances.sort(sortByTitle);

  return res.json({
    ok: true,
    data: instances,
  });
}

export default withApiSession(withHandler({ methods: ['GET'], handler }));
