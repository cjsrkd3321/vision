import prisma from '@libs/utils/prisma';
import withHandler from '@libs/server/withHandler';
import { withApiSession } from '@libs/server/withSession';
import { Response } from '@_types/common-type';
import type { NextApiRequest, NextApiResponse } from 'next';
import { Queries, User } from '@prisma/client';

interface QueryWithUser extends Partial<Queries> {
  user?: Partial<User>;
}

async function handler(req: NextApiRequest, res: NextApiResponse<Response>) {
  try {
    const data = await prisma.queries.findMany({
        where: { 
          category: 'COMPLIANCE',
        },
        select: {
            type: true,
            name: true,
            query: true,
            registeredAt: true,
            user: {
                select: { 
                    userId: true, role: true
                }
            },
            _count: {
              select: {
                compliances: true,
                resources: true,
              }
            },
        }
    });
    const newData = data.map((d: QueryWithUser) => { 
      const query = { ...d, userId: d?.user?.userId };
      delete query.user;
      return query
     });
    
    return res.json({ ok: true, data: newData });
  } catch (error: any) {
    console.log(`[/API/QURIES/COMPLIANCES] ${error}`)
    return res.status(500).json({ ok: false, error });
  }
}

export default withApiSession(withHandler({ methods: ['GET'], handler }));
