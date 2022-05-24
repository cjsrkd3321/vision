import withHandler from '@libs/server/withHandler';
import { withApiSession } from '@libs/server/withSession';
import pgClient from '@libs/utils/pgClient';
import { Response } from '@_types/common-type';
import type { NextApiRequest, NextApiResponse } from 'next';

async function handler(req: NextApiRequest, res: NextApiResponse<Response>) {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ ok: false, error: 'Query Required' });
  }

  const regex =
    /(;)|\/\*(.*)\*\/|(--).*|--|\/\*|\*\/|(\b(ALTER|INFORMATION_SCHEMA|CREATE|DELETE|DROP|EXEC(UTE){0,1}|INSERT( +INTO){0,1}|MERGE|UPDATE)\b)/gi;

  if (query.search(regex) !== -1) {
    return res.status(403).json({
      ok: false,
      error: 'Not permitted action, I think your query is SQL Injection',
    });
  }

  const checkQuery = query.toUpperCase();
  const isAsteriskColumn = !checkQuery.search(/SELECT +\* +FROM/gi);

  if (checkQuery.search(/SELECT +FROM/gi) !== -1) {
    return res.status(400).json({
      ok: false,
      error: 'Input normal query, "SELECT FROM" forbidden',
    });
  }

  try {
    let data = [];
    console.log(query);
    if (isAsteriskColumn && !checkQuery.includes(' LIMIT 1')) {
      data = (await pgClient?.query(query.concat(' LIMIT 1'))).rows;
    } else {
      data = (await pgClient?.query(query)).rows;
    }

    return res.status(200).json({
      ok: true,
      data,
      msg: isAsteriskColumn
        ? "'*' Column can only query with LIMIT 1"
        : undefined,
    });
  } catch (error: any) {
    const { message: msg, position, code } = error;
    if (code === 'ECONNREFUSED') {
      return res.status(500).json({
        ok: false,
        error: "DB Connection error. Please check your steampipe's status",
      });
    }

    if (position) {
      return res
        .status(400)
        .json({ ok: false, error: msg + `, Position : ${position}` });
    }

    return res.status(500).json({ ok: false, error: msg });
  }
}

export default withApiSession(withHandler({ methods: ['POST'], handler }));
