import withHandler from '@libs/server/withHandler';
import { withApiSession } from '@libs/server/withSession';
import prisma from '@libs/utils/prisma';
import { Response } from '@_types/common-type';
import type { NextApiRequest, NextApiResponse } from 'next';

async function handler(req: NextApiRequest, res: NextApiResponse<Response>) {
  const {
    session: { user: { role } = {} },
    body: { id },
  } = req;

  if (role !== 'ADMIN') {
    return res.status(403).json({
      ok: false,
      error: `THIS FUNCTION CAN CONTROL ONLY ADMIN`,
    });
  }

  try {
    const result = await prisma.securityGroup.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!result) {
      return res.status(404).json({
        ok: false,
        error: `${id} does not exists`,
      });
    }

    if (!result.status.startsWith('REQUEST')) {
      return res.status(400).json({
        ok: false,
        error: `You can only apply for the status of the REQUEST`,
      });
    }

    await prisma.securityGroup.update({
      where: { id },
      data: { status: `APPROVE_${result.status.split('_')[1]}` },
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

  return res.status(200).json({ ok: true, msg: `APPROVED !` });
}

export default withApiSession(withHandler({ methods: ['POST'], handler }));
