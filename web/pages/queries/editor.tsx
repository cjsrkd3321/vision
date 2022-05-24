import { NextPage, NextPageContext } from 'next';

import Layout from '@components/Layout';
import { withSsrSession } from '@libs/server/withSession';
import { User } from '@prisma/client';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Link, Stack } from '@mui/material';
import Button from '@components/Button';
import useTable from '@libs/hooks/useTable';
import pgClient from '@libs/utils/pgClient';
import { getMe } from '@libs/server/queries';

const Editor = dynamic(() => import('@components/query/Editor'), {
  ssr: false,
});

const Query: NextPage<{ me: User; columns: any }> = ({ me, columns }) => {
  const router = useRouter();
  const { dataError, dataMsg, error } = useTable({
    getUrl: '/api/steampipe-columns',
    hasInterval: false,
    postUrl: undefined,
    existsTitle: false,
  });

  useEffect(() => {
    if (!me) router.replace('/');
  }, [me, router]);

  return (
    <Layout title='QUERY' userInfo={me}>
      <Stack
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Stack
          sx={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'flex-start',
          }}
        >
          <Link
            href='https://hub.steampipe.io/plugins/turbot/aws/tables/aws_account'
            target='_blank'
            sx={{ textDecoration: 'none', mr: 1 }}
          >
            <Button color='info' text='table information'></Button>
          </Link>
          <Link
            href='https://steampipe.io/docs/sql/steampipe-sql'
            target='_blank'
            sx={{ textDecoration: 'none' }}
          >
            <Button color='info' text='SQL Syntax'></Button>
          </Link>
        </Stack>
      </Stack>
      {me ? <Editor data={columns} msg={dataMsg} error={dataError} /> : null}
    </Layout>
  );
};

export const getServerSideProps = withSsrSession(async function ({
  req,
}: NextPageContext) {
  let me = null;
  let columns = null;
  const userId = req?.session.user?.id;

  try {
    if (userId) {
      me = await getMe(userId);

      columns = (
        await pgClient?.query(`
          SELECT DISTINCT table_name 
          FROM information_schema.tables 
          WHERE table_catalog = 'steampipe' 
                AND table_type = 'FOREIGN'
        `)
      ).rows;
    }
  } catch (error) {
    console.log(`[/QUERIES/EDITOR] ${error}`);
  }

  return {
    props: {
      me,
      columns,
    },
  };
});

export default Query;
