import withHandler from '@libs/server/withHandler';
import { withApiSession } from '@libs/server/withSession';
import prisma from '@libs/utils/prisma';
import { Response } from '@_types/common-type';
import type { NextApiRequest, NextApiResponse } from 'next';

async function handler(req: NextApiRequest, res: NextApiResponse<Response>) {
  const {
    session: { user: { userId, id } = {} },
    body: { id: requestId },
  } = req;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        userId: true,
      },
    });

    if (user && user.userId !== userId) {
      return res.status(403).json({
        ok: false,
        error: `You're not ${userId}`,
      });
    }

    const result = await prisma.securityGroup.findUnique({
      where: { id: requestId },
      select: {
        status: true,
      },
    });
    if (!result) {
      return res.status(400).json({
        ok: false,
        error: `ID ${requestId} does not exist`,
      });
    }

    if (result.status !== 'COMPLETED') {
      return res.status(403).json({
        ok: false,
        error: `COMPLETED status only can delete (current: ${result.status})`,
      });
    }

    await prisma.securityGroup.update({
      where: { id: requestId },
      data: {
        status: 'REQUEST_DELETE',
      },
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

  return res.status(200).json({ ok: true, msg: `Request Succeeded` });
}

export default withApiSession(withHandler({ methods: ['POST'], handler }));
