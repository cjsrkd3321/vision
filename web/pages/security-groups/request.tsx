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
  TableContainer,
  TextField,
  Typography,
  Table as MuiTable,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TablePagination,
  Card,
  CircularProgress,
} from '@mui/material';
import useTable, { UseSWRState } from '@libs/hooks/useTable';
import { getMe } from '@libs/server/queries';
import { useForm } from 'react-hook-form';
import Button from '@components/Button';
import { useRecoilState } from 'recoil';
import { Protocol, SgRequestForm, sgRequestFormState } from '@libs/atoms';
import useMutation from '@libs/hooks/useMutation';
import useSWR from 'swr';

const Request: NextPage<{ me: User }> = ({ me }) => {
  const cidrIPv4Regex = new RegExp(
    '^(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]?|0).(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]?|0).(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]?|0).(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]?|0)(/([1-9]|[1-2][0-9]|3[0-2])){0,1}$'
  );

  const router = useRouter();
  const [ids, setIds] = useState<{ srcId?: number; dstId?: number }>({
    srcId: undefined,
    dstId: undefined,
  });
  const { data: srcData, error: srcError } = useSWR<UseSWRState<any[]>>(
    ids.srcId ? `/api/security-groups/instances/${ids.srcId}` : null
  );
  const { data: dstData, error: dstError } = useSWR<UseSWRState<any[]>>(
    ids.dstId ? `/api/security-groups/instances/${ids.dstId}` : null
  );

  // TABLE
  const [isSrcIP, setIsSrcIP] = useState<boolean>(false);
  const [srcColumns, setSrcColumns] = useState<string[]>([]);
  const [dstColumns, setDstColumns] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  useEffect(() => {
    if (!srcData?.ok || !srcData?.data) return;
    setSrcColumns(Object.keys(srcData.data[0]));
  }, [srcData]);

  useEffect(() => {
    if (!dstData?.ok || !dstData?.data) return;
    setDstColumns(Object.keys(dstData.data[0]));
  }, [dstData]);
  // TABLE

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
    setValue,
    setFocus,
    clearErrors,
    getValues,
  } = useForm<{ port: number; reason: string; sourceIp: string }>({
    defaultValues: {
      reason: '',
    },
    mode: 'onChange',
  });
  const [sgRequestForm, setSgRequestForm] = useRecoilState(sgRequestFormState);
  const [protocol, setProtocol] = useState<Protocol>('TCP');

  useEffect(() => {
    if (!me) router.replace('/');
  }, [me, router]);

  useEffect(() => {
    setSgRequestForm({ ...sgRequestForm, protocol: 'TCP' });
  }, []);

  useEffect(() => {
    if (!isSrcIP) return;
    setFocus('sourceIp');
  }, [isSrcIP]);

  useEffect(() => {
    if (!sgRequestForm?.source && !sgRequestForm?.destination) return;
    if (sgRequestForm?.source) {
      setValue('sourceIp', sgRequestForm?.source);
      clearErrors('sourceIp');
      setIsSrcIP(false);
    }
    setIds({
      srcId: sgRequestForm?.sourceId,
      dstId: sgRequestForm?.destinationId,
    });
  }, [sgRequestForm.source, sgRequestForm.destination]);

  const [request, { loading, data: responseData, error: mutationError }] =
    useMutation('/api/security-groups/request');

  const onValid = ({
    protocol,
    sourceId,
    destinationId,
  }: Partial<SgRequestForm>) => {
    return ({
      port,
      reason,
      sourceIp,
    }: {
      port: number;
      reason: string;
      sourceIp: string;
    }) => {
      if (loading) return;
      if ((!sourceIp || !sourceId) && !destinationId) return;
      request({
        reason,
        protocol,
        sourceIp: sourceId ? null : sourceIp,
        sourceId,
        destinationId,
        port: protocol === 'ICMP' ? -1 : port,
      });
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
          <Button
            text='Add SOURCE using IP'
            color='info'
            sx={{
              mb: 2,
            }}
            disabled={isSrcIP}
            onClick={() => {
              setIsSrcIP(true);
              setIds({
                ...ids,
                srcId: undefined,
              });
              setSgRequestForm({
                ...sgRequestForm,
                source: undefined,
                sourceId: undefined,
              });
              setValue('sourceIp', '');
            }}
          />
          {isSrcIP || sgRequestForm.source || sgRequestForm.destination ? (
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
                  sx={{ minWidth: '100%' }}
                  {...register('sourceIp', {
                    onChange: () =>
                      setSgRequestForm({
                        ...sgRequestForm,
                        sourceIp: getValues('sourceIp'),
                      }),
                    pattern: !sgRequestForm.source
                      ? {
                          value:
                            /^(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]?|0)\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]?|0)\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]?|0)\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]?|0)(\/([1-9]|[1-2][0-9]|3[0-2])){0,1}$/,
                          message:
                            'Incorrect IPv4. Please change it to the correct value.',
                        }
                      : undefined,
                  })}
                  disabled={!isSrcIP}
                  label='Source'
                  error={
                    (isSrcIP && errors.sourceIp?.message) ||
                    (!isSrcIP && !sgRequestForm.sourceId)
                      ? true
                      : false
                  }
                  placeholder={'Input IPv4 like 192.168.0.1, 10.0.0.4/32 etc..'}
                />
                {errors.sourceIp?.message ? (
                  <Alert
                    variant='filled'
                    severity='error'
                    sx={{ minWidth: '100%', mt: 1 }}
                  >
                    {errors.sourceIp?.message}
                  </Alert>
                ) : null}
                {!isSrcIP &&
                srcData &&
                srcData.data &&
                srcData.data.length !== 0 ? (
                  <Card sx={{ width: '100%', overflow: 'hidden', my: 1 }}>
                    <TableContainer
                      sx={{ maxHeight: 440, backgroudColor: 'black' }}
                    >
                      <MuiTable>
                        <TableHead>
                          <TableRow>
                            {srcColumns.map((column) => (
                              <TableCell key={column} align={'center'}>
                                {column}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {srcData.data
                            .slice(
                              page * rowsPerPage,
                              page * rowsPerPage + rowsPerPage
                            )
                            .map((row, idx) => {
                              return (
                                <TableRow
                                  hover
                                  role='checkbox'
                                  tabIndex={-1}
                                  key={idx}
                                >
                                  {Object.values(row).map((value: any, idx) => {
                                    return (
                                      <TableCell key={idx} align={'center'}>
                                        {value}
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </MuiTable>
                    </TableContainer>
                    <TablePagination
                      rowsPerPageOptions={[10, 25, 100]}
                      component='div'
                      count={srcData.data.length}
                      rowsPerPage={rowsPerPage}
                      page={page}
                      onPageChange={handleChangePage}
                      onRowsPerPageChange={handleChangeRowsPerPage}
                    />
                  </Card>
                ) : ids.srcId ? (
                  <CircularProgress color='inherit' size={20} sx={{ my: 1 }} />
                ) : null}
                {srcData && srcData.error ? (
                  <Alert
                    variant='filled'
                    severity='error'
                    sx={{ minWidth: '100%', mt: 1 }}
                  >
                    {srcData.error}
                  </Alert>
                ) : null}
                <TextField
                  disabled
                  label='Destination'
                  error={!sgRequestForm.destinationId ? true : false}
                  value={sgRequestForm?.destination ?? ''}
                  sx={{ minWidth: '100%', marginTop: 1 }}
                />
                {dstData && dstData.data && dstData.data.length !== 0 ? (
                  <Card sx={{ width: '100%', overflow: 'hidden', my: 1 }}>
                    <TableContainer
                      sx={{ maxHeight: 440, backgroudColor: 'black' }}
                    >
                      <MuiTable>
                        <TableHead>
                          <TableRow>
                            {dstColumns.map((column) => (
                              <TableCell key={column} align={'center'}>
                                {column}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {dstData.data
                            .slice(
                              page * rowsPerPage,
                              page * rowsPerPage + rowsPerPage
                            )
                            .map((row, idx) => {
                              return (
                                <TableRow
                                  hover
                                  role='checkbox'
                                  tabIndex={-1}
                                  key={idx}
                                >
                                  {Object.values(row).map((value: any, idx) => {
                                    return (
                                      <TableCell key={idx} align={'center'}>
                                        {value}
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </MuiTable>
                    </TableContainer>
                    <TablePagination
                      rowsPerPageOptions={[5, 10, 25]}
                      component='div'
                      count={dstData.data.length}
                      rowsPerPage={rowsPerPage}
                      page={page}
                      onPageChange={handleChangePage}
                      onRowsPerPageChange={handleChangeRowsPerPage}
                    />
                  </Card>
                ) : ids.dstId ? (
                  <CircularProgress color='inherit' size={20} sx={{ my: 1 }} />
                ) : null}
                {dstData && dstData.error ? (
                  <Alert
                    variant='filled'
                    severity='error'
                    sx={{ minWidth: '100%', mt: 1 }}
                  >
                    {dstData.error}
                  </Alert>
                ) : null}
                {errors.sourceIp?.message || !sgRequestForm.destinationId ? (
                  <Alert
                    variant='filled'
                    severity='error'
                    sx={{ minWidth: '100%', mt: 1 }}
                  >
                    {`'Source' or 'Destination' is empty.`}
                  </Alert>
                ) : null}
                <FormControl
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    mt: 2,
                    width: '100%',
                    maxWidth: '100%',
                  }}
                >
                  <InputLabel id='demo-simple-select-label'>
                    Protocol
                  </InputLabel>
                  <Select
                    labelId='demo-simple-select-label'
                    value={protocol}
                    label='Protocol'
                    onChange={handleChange}
                    sx={{ minWidth: '10%', mr: 1 }}
                  >
                    <MenuItem value={'TCP'}>TCP</MenuItem>
                    <MenuItem value={'UDP'}>UDP</MenuItem>
                    <MenuItem value={'ICMP'}>ICMP</MenuItem>
                  </Select>
                  <TextField
                    disabled={protocol === 'ICMP' ? true : false}
                    type='number'
                    label='Port'
                    error={errors.port?.message ? true : false}
                    placeholder={'one of 1 - 65535'}
                    sx={{ minWidth: '10%', mr: 1 }}
                    {...register('port', {
                      valueAsNumber: true,
                      required:
                        sgRequestForm.protocol !== 'ICMP'
                          ? 'The Port is required.'
                          : undefined,
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
                  loading={loading}
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
                    setIds({
                      srcId: undefined,
                      dstId: undefined,
                    });
                    setIsSrcIP(false);
                    reset();
                    responseData.error = undefined;
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
          {!sgRequestForm.sourceId || !sgRequestForm.destinationId ? (
            <Table rows={10} />
          ) : null}
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
