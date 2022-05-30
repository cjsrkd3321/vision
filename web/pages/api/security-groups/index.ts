import withHandler from '@libs/server/withHandler';
import { withApiSession } from '@libs/server/withSession';
import prisma from '@libs/utils/prisma';
import { Queries, Resource } from '@prisma/client';
import { Response } from '@_types/common-type';
import type { NextApiRequest, NextApiResponse } from 'next';

interface QueryWithResource extends Partial<Queries> {
  resources?: Partial<Resource>[] | [];
}

async function handler(req: NextApiRequest, res: NextApiResponse<Response>) {
  try {
    const data = await prisma.queries.findMany({
      where: {
        category: 'SG',
      },
      select: {
        category: true,
        type: true,
        name: true,
        resources: {
          select: { id: true, result: true },
        },
      },
    });

    const newData = data.map((datum: QueryWithResource) => {
      if (!datum.resources) return;

      const newDatum = datum.resources.map((resource: Partial<Resource>) => {
        if (!resource.result) return;

        const result = JSON.parse(resource.result);
        delete result.sg;
        delete result.vpc_id;

        return {
          ...resource,
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
