// MUI
import {
  Card,
  Container,
  Stack,
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableRow,
  Typography,
  Box,
  Divider,
  Tooltip,
  Button as MuiButton,
  Chip,
} from '@mui/material';
import { filter } from 'lodash';
import React, { useEffect, useState } from 'react';

// Componenets
import SearchNotFound from '@components/table/SearchNotFound';
import TableListHead from '@components/table/TableListHead';
import TableListToolbar from '@components/table/TableListToolbar';
import PopoverButton from '@components/PopoverButton';

import { useRecoilValue, useRecoilState } from 'recoil';
import {
  queryFilter,
  queryBody,
  postApiUrlState,
  buttonSettingState,
  getApiUrlState,
  hasRequestButtonState,
  sgRequestFormState,
} from '@libs/atoms';
import { isJsonString } from '@libs/utils';
import { format } from 'sql-formatter';
import Button from '@components/Button';
import useMutation from '@libs/hooks/useMutation';
import { useSWRConfig } from 'swr';
import Snackbar from '@components/Snackbar';

// ----------------------------------------------------------------------

interface ComplianceResult {
  [key: string]: any;
}

function descendingComparator(a: any, b: any, orderBy: string) {
  const [firstString, secondString] = [a[orderBy] ?? '', b[orderBy] ?? ''];
  if (secondString < firstString) return 1;
  if (secondString > firstString) return -1;
  return 0;
}

function getComparator(order: 'asc' | 'desc', orderBy: string) {
  return order === 'desc'
    ? (a: any, b: any) => descendingComparator(a, b, orderBy)
    : (a: any, b: any) => -descendingComparator(a, b, orderBy);
}

function applySortFilter(
  array: ComplianceResult[],
  comparator: (a: ComplianceResult, b: ComplianceResult) => number,
  query: string
) {
  if (!array) return [];

  const stabilizedThis = [...array];
  stabilizedThis.sort((a: ComplianceResult, b: ComplianceResult) => {
    return comparator(a, b);
  });
  if (query) {
    return filter(array, (arr) => {
      const refinedData = Object.values(arr)
        .map((stringifiedArr) =>
          typeof stringifiedArr === 'string'
            ? stringifiedArr
            : JSON.stringify(stringifiedArr)
        )
        .toString()
        .toLowerCase();
      if (query.startsWith('OR:')) {
        const splitedQueries = query.slice(3).split('||');
        for (const splitedQuery of splitedQueries) {
          if (refinedData.includes(splitedQuery.trim().toLowerCase()))
            return true;
        }
        return false;
      } else if (query.startsWith('AND:')) {
        const splitedQueries = query.slice(4).split('&&');
        for (const splitedQuery of splitedQueries) {
          if (!refinedData.includes(splitedQuery.trim().toLowerCase()))
            return false;
        }
        return true;
      } else if (query.startsWith('NOT:')) {
        const splitedQuery = query.slice(4);
        if (splitedQuery !== '' && refinedData.includes(splitedQuery.trim().toLowerCase()))
          return false;
        return true;
      } else {
        return refinedData.includes(query.trim().toLowerCase());
      }
    });
  }
  return stabilizedThis;
}

function getFormattedSQL(value: any) {
  if (typeof value === 'boolean') return [value ? 'TRUE' : 'FALSE', false];
  if (typeof value !== 'string') return [value, false];

  if (
    !value.toUpperCase().startsWith('SELECT') &&
    !value.toUpperCase().startsWith('WITH')
  ) {
    return [value, false];
  }

  return [
    format(String(value), {
      language: 'postgresql',
      indent: '    ',
      uppercase: true,
      linesBetweenQueries: 2,
    }),
    true,
  ];
}

export default function Table({ rows = 10 }: any) {
  const [page, setPage] = useState(0);
  const [order, setOrder] = useState<'desc' | 'asc'>('asc');
  const [orderBy, setOrderBy] = useState('no');
  const filterName = useRecoilValue(queryFilter);
  const [rowsPerPage, setRowsPerPage] = useState(rows);
  const TABLE_DATA = useRecoilValue(queryBody);
  const buttonSettings = useRecoilValue(buttonSettingState);

  const getApiUrl = useRecoilValue(getApiUrlState) || '';
  const postApiUrl = useRecoilValue(postApiUrlState) || '';
  const hasRequestButton = useRecoilValue(hasRequestButtonState);
  const [sgRequestForm, setSgRequestForm] = useRecoilState(sgRequestFormState);

  const [mutateFn, { loading, data, error }] = useMutation(postApiUrl);

  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (data && data.ok) {
      mutate(getApiUrl);
    }
  }, [data, mutate, getApiUrl]);

  const handleRequestSort = (_event: any, property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (_event: any, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const filteredData = applySortFilter(
    TABLE_DATA,
    getComparator(order, orderBy),
    filterName
  );

  const isDataNotFound = filteredData.length === 0;

  const onClick: any = (id: number) => {
    return () => {
      mutateFn({ id });
    };
  };

  const onClickForRequestForm = (id: number) => {
    return () => {
      for (const [_, value] of Object.entries(filteredData)) {
        if (typeof value === 'number' || !('_id' in value)) return;
        if (typeof value._id !== 'number' || value._id !== id) continue;

        if (sgRequestForm.source && sgRequestForm.destination) {
          return;
        }

        let tmpValue = { ...value };
        ['no', 'account_id', 'region', '_id', 'state'].forEach((e) => delete tmpValue[e]);

        const presentValue = Object.values(tmpValue);

        if (sgRequestForm.sourceIp || sgRequestForm.source) {
          setSgRequestForm({
            ...sgRequestForm,
            destination: `${JSON.stringify(presentValue).replaceAll(`"`, ` `)}`,
            destinationId: value._id,
          });
        } else {
          setSgRequestForm({
            ...sgRequestForm,
            source: `${JSON.stringify(presentValue).replaceAll(`"`, ` `)}`,
            sourceId: value._id,
          });
        }
      }
    };
  };

  return (
    <Container maxWidth={false} disableGutters>
      <Card>
        <Stack direction='row' alignItems='center'>
          <TableListToolbar setPage={setPage} />
        </Stack>

        <Divider variant='middle' />

        <Box sx={{ paddingLeft: '10px' }}>
          <TableContainer sx={{ minWidth: 800 }}>
            <MuiTable>
              <TableListHead
                order={order}
                orderBy={orderBy}
                onRequestSort={handleRequestSort}
              />

              <TableBody>
                {filteredData
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((filteredDatum: any, idx) => {
                    return (
                      <TableRow hover key={idx} tabIndex={-1} role='checkbox'>
                        {Object.values(filteredDatum).map(
                          (row: any, idx: number) => {
                            return (
                              <TableCell
                                padding='normal'
                                align={
                                  getFormattedSQL(row)[1] ? 'left' : 'center'
                                }
                                key={idx}
                                sx={{ maxWidth: '400px' }}
                              >
                                {Object.values(filteredDatum).length ===
                                idx + 1 ? (
                                  postApiUrl && !hasRequestButton ? (
                                    buttonSettings.isPopover ? (
                                      <PopoverButton
                                        id={row}
                                        {...buttonSettings}
                                      />
                                    ) : (
                                      <Button
                                        id={row}
                                        onClick={onClick(row)}
                                        {...buttonSettings}
                                      />
                                    )
                                  ) : hasRequestButton ? (
                                    <Button
                                      id={row}
                                      onClick={onClickForRequestForm(row)}
                                      {...buttonSettings}
                                    />
                                  ) : null
                                ) : (
                                  <Typography
                                    variant={'inherit'}
                                    // noWrap={true}
                                    paragraph={true}
                                    sx={{
                                      whiteSpace:
                                        typeof row === 'string' &&
                                        row.length > 36
                                          ? 'pre-wrap'
                                          : 'nowrap',
                                      maxWidth: '100%',
                                      // maxHeight: '150px',
                                      overflowY: 'overlay',
                                      // overflowX: 'visible',
                                      m: 0,
                                      // display: 'flex',
                                      // justifyContent: 'center',
                                    }}
                                  >
                                    {row &&
                                    (isJsonString(row) ||
                                      typeof row === 'object') ? (
                                      <Tooltip
                                        title={
                                          <Typography
                                            variant={'body2'}
                                            sx={{
                                              whiteSpace: 'pre-wrap',
                                              maxWidth: '100%',
                                            }}
                                          >
                                            {JSON.stringify(
                                              isJsonString(row)
                                                ? JSON.parse(row)
                                                : row,
                                              null,
                                              4
                                            )}
                                          </Typography>
                                        }
                                        arrow
                                      >
                                        <MuiButton>DETAIL</MuiButton>
                                      </Tooltip>
                                    ) : typeof row === 'string' &&
                                      row.startsWith('USER_') ? (
                                      <Chip
                                        label={row.split('_')[1]}
                                        color={
                                          row.split('_')[1].startsWith('D')
                                            ? 'secondary'
                                            : 'error'
                                        }
                                        sx={{
                                          height: '30px',
                                          fontWeight: 'bold',
                                          borderRadius: '8px',
                                        }}
                                      />
                                    ) : (
                                      getFormattedSQL(row)[0]
                                    )}
                                  </Typography>
                                )}
                              </TableCell>
                            );
                          }
                        )}
                      </TableRow>
                    );
                  })}
              </TableBody>
              {isDataNotFound && (
                <TableBody>
                  <TableRow>
                    <TableCell align='center' colSpan={6} sx={{ py: 3 }}>
                      <SearchNotFound searchQuery={filterName} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              )}
            </MuiTable>
          </TableContainer>
        </Box>

        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100, 1000]}
          component='div'
          count={filteredData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Card>
      <Snackbar isOpen={!loading && data} data={data} />
    </Container>
  );
}
