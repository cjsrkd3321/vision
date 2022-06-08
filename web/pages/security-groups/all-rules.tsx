import Layout from '@components/Layout';
import Table from '@components/table/Table';
import { withSsrSession } from '@libs/server/withSession';
import { User } from '@prisma/client';
import { NextPage, NextPageContext } from 'next';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { Alert, Container, Typography } from '@mui/material';
import useTable from '@libs/hooks/useTable';
import { getMe } from '@libs/server/queries';

const AllRules: NextPage<{ me: User }> = ({ me }) => {
  const router = useRouter();
  const { results, dataError, dataMsg, error } = useTable({
    getUrl: '/api/security-groups/all-rules',
    postUrl: '/api/security-groups/approve',
    buttonSettings: {
      isPopover: false,
      text: 'Approve',
      color: 'info',
      size: 'medium',
    },
    existsTitle: false,
  });

  useEffect(() => {
    if (!me) router.replace('/');
  }, [me, router]);

  return (
    <Layout title='SECURITY GROUP - All Rules' userInfo={me}>
      {me ? (
        <>
          {dataError ? (
            <Alert
              variant='filled'
              severity='error'
              sx={{ minWidth: '100%', mt: 1, mb: 3 }}
            >
              {dataError}
            </Alert>
          ) : null}
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
    console.log(`[/SECURITY-GROUPS/ALL-RULES] ${error}`);
  }

  return {
    props: {
      me,
    },
  };
});

export default AllRules;
