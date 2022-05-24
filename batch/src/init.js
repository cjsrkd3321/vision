import 'regenerator-runtime';
import 'dotenv/config';
import './batch/aws';
import './db';

import { prisma } from './libs/prisma';
import * as awsQueries from './queries/aws';

const saveInitialQueries = () => {
    Object.entries(awsQueries).forEach(async ([title, query]) => {
        const [category, type, name] = title.split('_');
        const isExistsQuery = await prisma.queries.findUnique({
            where: { name },
        });
        if (!isExistsQuery) {
            await prisma.queries.create({
                data: { 
                    category,
                    type,
                    name,
                    query,
                    user: {},
                }
            })
        }
    })
}

saveInitialQueries();