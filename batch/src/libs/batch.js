import md5 from 'md5';
import { pg } from '../db';
import { DEFAULT_TTL } from '../libs/time';
import { prisma } from './prisma';

class Batch {
  // NOTE: complianceBatch
  static async complianceBatch(query, queryId) {
    let isError = false;
    try {
      const isQueryExists = await prisma.queries.findUnique({
        where: { id: queryId },
      });
      if (!isQueryExists) {
        isError = true;
        return;
      }

      const queryResults = (await pg.query(query)).rows;

      const now = new Date();
      // 현재 타이틀 기준으로 데이터 없으면 기존 데이터도 모두 업데이트(삭제되지 않은 경우만)
      if (queryResults.length === 0) {
        await prisma.compliance.updateMany({
          data: {
            isDeleted: true,
            deletedAt: now,
          },
          where: {
            AND: [
              { queriesId: queryId },
              //   {
              //     exception: { none: {} },
              //   },
              {
                isDeleted: false,
              },
            ],
          },
        });
      }

      const currentUids = [];
      const currentVulns = queryResults.map((result) => {
        const stringResult = JSON.stringify(result);
        const uid = md5(stringResult);
        currentUids.push(uid);
        return {
          queriesId: queryId,
          result: stringResult,
          uid,
        };
      });

      // 현재 내용과 일치하지 않는 애들 업데이트(삭제되지 않은 경우만)
      await prisma.compliance.updateMany({
        data: {
          isDeleted: true,
          deletedAt: now,
        },
        where: {
          AND: [
            { queriesId: queryId },
            {
              uid: { notIn: currentUids },
            },
            // {
            //   exception: { none: {} },
            // },
            {
              isDeleted: false,
            },
          ],
        },
      });

      const oldUids = (
        await prisma.compliance.findMany({
          where: {
            AND: [
              { queriesId: queryId },
              // { exceptions: { none: {} } },
              { isDeleted: false },
            ],
          },
          select: {
            uid: true,
          },
        })
      ).map((uid) => uid.uid);

      const newVulns = currentVulns.filter(
        (vuln) => !oldUids.includes(vuln.uid)
      );

      await prisma.compliance.createMany({
        data: newVulns,
      });
    } catch (error) {
      isError = true;
      console.error('[complianceBATCH] ', error?.message);
      console.error(
        `[complianceBATCH] ${queryId} ${error?.code} ${error?.meta?.field_name}`
      );
      return;
    } finally {
      console.log(`[complianceBATCH] QUERY_ID : ${queryId}`);
      if (!isError)
        setTimeout(Batch.complianceBatch, DEFAULT_TTL, query, queryId);
    }
  }

  // NOTE: resourceBatch
  static async resourceBatch(query, queryId) {
    let isError = false;
    try {
      const isQueryExists = await prisma.queries.findUnique({
        where: { id: queryId },
      });
      if (!isQueryExists) {
        isError = true;
        return;
      }

      const queryResults = (await pg.query(query)).rows;

      // 현재 타이틀 기준으로 데이터 없으면 기존 데이터도 모두 삭제
      if (queryResults.length === 0) {
        const resources = await prisma.queries.findUnique({
          where: {
            id: queryId,
          },
          select: {
            resources: {
              select: {
                id: true,
              },
            },
          },
        });

        await prisma.resource.deleteMany({
          where: {
            id: { in: resources.resources.map((resource) => resource.id) },
          },
        });
      }

      const currentUids = [];
      const currentResources = queryResults.map((result) => {
        const stringResult = JSON.stringify(result);
        const uid = md5(stringResult);
        currentUids.push(uid);
        return {
          queriesId: queryId,
          result: stringResult,
          uid,
        };
      });

      // 현재 내용과 일치하지 않는 애들 삭제
      await prisma.resource.deleteMany({
        where: {
          AND: [
            { queriesId: queryId },
            {
              uid: { notIn: currentUids },
            },
          ],
        },
      });

      const oldUids = (
        await prisma.resource.findMany({
          where: {
            queriesId: queryId,
          },
          select: {
            uid: true,
          },
        })
      ).map((uid) => uid.uid);

      const newResources = currentResources.filter(
        (vuln) => !oldUids.includes(vuln.uid)
      );

      await prisma.resource.createMany({
        data: newResources,
      });
    } catch (error) {
      isError = true;
      console.error('[resourceBATCH] ', error?.message);
      console.error(
        `[resourceBATCH] ${queryId} ${error?.code} ${error?.meta?.field_name}`
      );
      return;
    } finally {
      console.log(`[resourceBATCH] QUERY_ID : ${queryId}`);
      if (!isError)
        setTimeout(Batch.resourceBatch, DEFAULT_TTL, query, queryId);
    }
  }
}

export default Batch;
