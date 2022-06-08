import Layout from '@components/Layout';
import Table from '@components/table/Table';
import { withSsrSession } from '@libs/server/withSession';
import { User } from '@prisma/client';
import { NextPage, NextPageContext } from 'next';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { Container, Typography } from '@mui/material';
import useTable from '@libs/hooks/useTable';
import { getMe } from '@libs/server/queries';

const MyRules: NextPage<{ me: User }> = ({ me }) => {
  const router = useRouter();
  const { results, dataError, dataMsg, error } = useTable({
    getUrl: '/api/security-groups/my-rules',
    postUrl: '/api/security-groups/delete',
    buttonSettings: {
      isPopover: false,
      text: 'Delete',
      color: 'error',
      size: 'medium',
    },
    existsTitle: false,
  });

  useEffect(() => {
    if (!me) router.replace('/');
  }, [me, router]);

  return (
    <Layout title='SECURITY GROUP - My Rules' userInfo={me}>
      {me ? (
        <>
          <Table rows={10} />
        </>
      ) : (
        <Container
          sx={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant={'h3'}>
            {me && !results ? 'No data for viewing.' : 'Login Required'}
          </Typography>
        </Container>
      )}
    </Layout>
  );
};

export const getServerSideProps = withSsrSession(async function ({
  req,
}: NextPageContext) {
  let me = null;
  const userId = req?.session.user?.id;

  try {
    if (userId) {
      me = await getMe(userId);
    }
  } catch (error: any) {
    console.log(`[/SECURITY-GROUPS/MY-RULES] ${error}`);
  }

  return {
    props: {
      me,
    },
  };
});

export default MyRules;
