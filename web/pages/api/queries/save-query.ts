import withHandler from '@libs/server/withHandler';
import { withApiSession } from '@libs/server/withSession';
import { Response } from '@_types/common-type';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@libs/utils/prisma';

async function handler(req: NextApiRequest, res: NextApiResponse<Response>) {
  const {
    session: { user: { id, role } = {} },
    body: { category, type, name, query },
  } = req;

  if (!query || !category || !type || !name) {
    return res.status(400).json({ ok: false, error: 'QUERY, CATEGORY, TYPE, NAME are Required' });
  }

  if ((category === 'COMPLIANCE' || category === 'SG') && role !== 'ADMIN') {
    return res.status(403).json({ 
      ok:false, 
      error: `'COMPLIANCE' and 'SG' category only allow for ADMIN`
    });
  }

  if (category !== 'COMPLIANCE' && category !== 'CUSTOM' && category !== 'SG') {
    return res.status(403).json({
      ok: false,
      error: `Category can select 'COMPLIANCE' or 'CUSTOM' or 'SG'`
    });
  }

  try {
    if (role !== 'ADMIN') {
      const countOfQueries = await prisma?.user.findUnique({
        where: { id },
        select: {
          _count: {
            select: {
              queries: true,
            }
          }
        }
      });
      if (countOfQueries && countOfQueries._count.queries > 4) {
        return res.status(403).json({ ok: false, error: 'Queries can save maximum 5' });
      }
    }

    const isExistsQuery = await prisma?.queries.findUnique({
      where: {
        name
      },
      select: {
        id: true,
      }
    });
    if (isExistsQuery) return res.status(403).json({ ok: false, error: `NAME '${name}' is already exist`});

    const regex =
      /(;)|\/\*(.*)\*\/|(--).*|--|\/\*|\*\/|(\b(ALTER|INFORMATION_SCHEMA|CREATE|DELETE|DROP|EXEC(UTE){0,1}|INSERT( +INTO){0,1}|MERGE|UPDATE)\b)/gi;

    if (query.search(regex) !== -1) {
      return res.status(403).json({
        ok: false,
        error: 'Not permitted action, I think your query is SQL Injection',
      });
    }

    const checkQuery = query.toUpperCase();
    const isAsteriskColumn = checkQuery.search(/SELECT +\* +FROM/gi) !== -1 ? true : false;

    if (checkQuery.search(/SELECT +FROM/gi) !== -1) {
      return res.status(403).json({
        ok: false,
        error: 'Input normal query, "SELECT FROM" forbidden',
      });
    }

    let hasLimit = false;
    if (isAsteriskColumn && !checkQuery.includes(' LIMIT 1')) {
      hasLimit = true;
    }
    await prisma?.queries.create({
      data: {
        category: category.trim(),
        type: type.trim(),
        name: name.trim(),
        query: [query.trim(), hasLimit ? ' LIMIT 1' : ''].join(''),
        user: {
          connect: { id },
        },
      },
    });

    return res.status(200).json({ ok: true });
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

export default withApiSession(withHandler({ methods: ['POST'], handler }));
