import Layout from '@components/Layout';
import Table from '@components/table/Table';
import { withSsrSession } from '@libs/server/withSession';
import { User } from '@prisma/client';
import { NextPage, NextPageContext } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import useTable from '@libs/hooks/useTable';
import { getMe } from '@libs/server/queries';
import { useForm } from 'react-hook-form';
import Button from '@components/Button';
import { useRecoilState } from 'recoil';
import { Protocol, SgRequestForm, sgRequestFormState } from '@libs/atoms';
import useMutation from '@libs/hooks/useMutation';

const Request: NextPage<{ me: User }> = ({ me }) => {
  const router = useRouter();
  const { results, dataError, dataMsg, error } = useTable({
    getUrl: '/api/security-groups',
    hasRequestButton: true,
    buttonSettings: {
      isPopover: false,
      text: 'Add',
      color: 'primary',
      size: 'medium',
    },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<{ port: number, reason: string }>({
    defaultValues: {
      reason: '',
    },
    mode: 'onSubmit',
  });
  const [sgRequestForm, setSgRequestForm] = useRecoilState(sgRequestFormState);
  const [protocol, setProtocol] = useState<Protocol>('TCP');

  useEffect(() => {
    if (!me) router.replace('/');
  }, [me, router]);

  useEffect(() => {
    setSgRequestForm({ ...sgRequestForm, protocol: 'TCP' });
  }, [])

  const [request, { loading, data: responseData, error: mutationError }] =
    useMutation('/api/security-groups/request');

  const onValid = ({
    protocol,
    sourceId,
    destinationId,
  }: Partial<SgRequestForm>) => {
    return (sgForm: { port: number, reason: string }) => {
      if (loading) return;
      if (!sourceId || !destinationId) return;
      request({ ...sgForm, protocol, sourceId, destinationId });
    };
  };

  const handleChange = (event: SelectChangeEvent) => {
    const protocol = event.target.value as Protocol;
    setProtocol(protocol);
    setSgRequestForm({ ...sgRequestForm, protocol });
  };

  return (
    <Layout title='SECURITY GROUP - Request' userInfo={me}>
      {me ? (
        <>
          {sgRequestForm.source || sgRequestForm.destination ? (
            <Box
              component='form'
              onSubmit={handleSubmit(onValid(sgRequestForm))}
              sx={{ width: '100%' }}
            >
              <Stack
                direction='column'
                justifyContent='center'
                alignItems='center'
              >
                <TextField
                  disabled
                  label='Source'
                  error={!sgRequestForm.sourceId ? true : false}
                  value={sgRequestForm?.source ?? ''}
                  sx={{ minWidth: '100%' }}
                />
                <TextField
                  disabled
                  label='Destination'
                  error={!sgRequestForm.destinationId ? true : false}
                  value={sgRequestForm?.destination ?? ''}
                  sx={{ minWidth: '100%', marginTop: 1 }}
                />
                {!sgRequestForm.sourceId || !sgRequestForm.destinationId ? (
                  <Alert
                    variant='filled'
                    severity='error'
                    sx={{ minWidth: '100%', mt: 1 }}
                  >
                    {`'Source' or 'Destination' is empty.`}
                  </Alert>
                ) : null}
                <FormControl
                  sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', mt: 2, width: '100%', maxWidth: '100%' }}
                >
                  <InputLabel id="demo-simple-select-label">Protocol</InputLabel>
                  <Select
                    labelId="demo-simple-select-label"
                    value={protocol}
                    label="Protocol"
                    onChange={handleChange}
                    sx={{ minWidth: '10%', mr: 1 }}
                  >
                    <MenuItem value={'TCP'}>TCP</MenuItem>
                    <MenuItem value={'UDP'}>UDP</MenuItem>
                    <MenuItem value={'ICMP'}>ICMP</MenuItem>
                  </Select>
                  <TextField
                    type='number'
                    label='Port'
                    error={errors.port?.message ? true : false}
                    placeholder={'one of 1 - 65535'}
                    sx={{ minWidth: '10%', mr: 1 }}
                    {...register('port', {
                      valueAsNumber: true,
                      required: 'The Port is required.',
                      min: {
                        message: 'Minimum port value is 1.',
                        value: 1,
                      },
                      max: {
                        message: 'Maximum port value is 65535.',
                        value: 65535,
                      },
                    })}
                  />
                  <TextField
                    type='text'
                    label='Reason'
                    error={errors.reason?.message ? true : false}
                    placeholder={'Input reason to open...'}
                    sx={{ width: '80%' }}
                    {...register('reason', {
                      required: 'The Reason is required.',
                      minLength: {
                        message: 'The Reason should be longer than 6 chars.',
                        value: 6,
                      },
                      maxLength: {
                        message: 'The Reason should be less than 255 chars.',
                        value: 255,
                      },
                    })}
                  />
                </FormControl>
                {errors.port?.message ? (
                    <Alert
                      variant='filled'
                      severity='error'
                      sx={{ minWidth: '100%', mt: 1 }}
                    >
                      {errors.port?.message}
                    </Alert>
                  ) : null}
                {errors.reason?.message ? (
                  <Alert
                    variant='filled'
                    severity='error'
                    sx={{ minWidth: '100%', mt: 1 }}
                  >
                    {errors.reason?.message}
                  </Alert>
                ) : null}
                <Button
                  type='submit'
                  text='Submit'
                  color='primary'
                  sx={{
                    minWidth: '100%',
                    marginTop: 1,
                  }}
                  disabled={loading ? true : false}
                />
                <Button
                  type='reset'
                  text='Reset'
                  color='error'
                  sx={{
                    minWidth: '100%',
                    marginY: 1,
                  }}
                  onClick={() => {
                    setSgRequestForm({
                      protocol: 'TCP',
                      source: undefined,
                      sourceId: undefined,
                      destination: undefined,
                      destinationId: undefined,
                    });
                    reset();
                  }}
                />
                {!loading && responseData?.error ? (
                  <Alert
                    variant='filled'
                    severity='error'
                    sx={{ minWidth: '100%', mt: 1, mb: 3 }}
                  >
                    {responseData?.error}
                  </Alert>
                ) : null}
                {!loading && responseData?.msg ? (
                  <Alert
                    variant='filled'
                    severity='success'
                    sx={{ minWidth: '100%', mt: 1, mb: 3 }}
                  >
                    {responseData?.msg}
                  </Alert>
                ) : null}
              </Stack>
            </Box>
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
    console.log(`[/SECURITY-GROUPS/REQUEST] ${error}`);
  }

  return {
    props: {
      me,
    },
  };
});

export default Request;
