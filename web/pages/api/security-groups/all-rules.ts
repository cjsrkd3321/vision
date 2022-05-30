import withHandler from '@libs/server/withHandler';
import { withApiSession } from '@libs/server/withSession';
import prisma from '@libs/utils/prisma';
import { Response } from '@_types/common-type';
import type { NextApiRequest, NextApiResponse } from 'next';

async function handler(req: NextApiRequest, res: NextApiResponse<Response>) {
  // NOTE: GET
  if (req.method === 'GET') {
    const {
      session: { user: { role } = {} },
    } = req;

    if (role !== 'ADMIN') {
      return res.status(403).json({
        ok: false,
        error: `THIS PAGE CAN VIEW ONLY ADMIN`,
      });
    }

    const data = await prisma.securityGroup.findMany({
      select: {
        id: true,
        accountId: true,
        sgId: true,
        sgrId: true,
        requestedAt: true,
        createdAt: true,
        modifiedAt: true,
        protocol: true,
        port: true,
        source: true,
        reason: true,
        status: true,
        user: {
          select: { userId: true },
        },
      },
    });

    const newData = data.map((datum) => {
      const userId = datum?.user?.userId;
      // @ts-ignore
      delete datum?.user;
      return { ...datum, userId };
    });

    return res.json({ ok: true, data: newData });
  }

  // NOTE: POST
  if (req.method === 'POST') {
    return res.status(200).json({ ok: true, error: 'Not implemented' });
  }
}

export default withApiSession(
  withHandler({ methods: ['GET', 'POST'], handler })
);
