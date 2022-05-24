import withHandler from '@libs/server/withHandler';
import { withApiSession } from '@libs/server/withSession';
import prisma from '@libs/utils/prisma';
import { Response } from '@_types/common-type';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Queries, Resource, User } from '@prisma/client';

async function handler(req: NextApiRequest, res: NextApiResponse<Response>) {
  try {
    const data = await prisma.queries.findMany({
      where: {
        category: 'SG',
      },
      include: {
        resources: {
          select: { result: true },
        },
      },
    });

    const newData = data.map((datum) => {
      const newDatum = datum.resources.map((resource) => {
        const result = JSON.parse(resource.result)
        delete result.sg;

        return {
          result: JSON.stringify(result),
        };
      });
      return { ...datum, resources: newDatum };
    });

    return res.status(200).json({ ok: true, data: newData });
  } catch (error: any) {
    console.log(`[/API/SECURITY-GROUPS] ${error}`);
    return res.status(500).json({ ok: false, error: error.message });
  }
}

export default withApiSession(withHandler({ methods: ['GET'], handler }));