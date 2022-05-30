import withHandler from '@libs/server/withHandler';
import { withApiSession } from '@libs/server/withSession';
import prisma from '@libs/utils/prisma';
import { Response } from '@_types/common-type';
import type { NextApiRequest, NextApiResponse } from 'next';

async function handler(req: NextApiRequest, res: NextApiResponse<Response>) {
  // NOTE: GET
  if (req.method === 'GET') {
    const {
      session: { user: { id } = {} },
    } = req;
    const data = await prisma.securityGroup.findMany({
      where: {
        user: {
          id,
        },
      },
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
      },
    });

    return res.json({ ok: true, data });
  }

  // NOTE: POST
  if (req.method === 'POST') {
    return res.status(200).json({ ok: true, error: 'Not implemented' });
  }
}

export default withApiSession(
  withHandler({ methods: ['GET', 'POST'], handler })
);
