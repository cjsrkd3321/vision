import 'ace-builds/src-noconflict/mode-pgsql';
import 'ace-builds/src-noconflict/snippets/pgsql';
import 'ace-builds/src-noconflict/theme-textmate';
import 'ace-builds/src-noconflict/ext-language_tools';
import React, { useState } from 'react';

import Button from '../Button';
import useMutation from '@libs/hooks/useMutation';
import {
  Alert,
  Autocomplete,
  Box,
  CircularProgress,
  Container,
  TextField,
  Typography,
} from '@mui/material';
import { useForm } from 'react-hook-form';

export default function QuerySaveForm({ query }: { query: string }) {
  const { register, handleSubmit } = useForm<any>();
  const [category, setCategory] = useState<string | null>('CUSTOM');
  const [queryFn, { loading, data, error, controller }] = useMutation(
    '/api/queries/save-query'
  );

  const onValid = (querySaveForm: any) => {
    if (loading) return;
    queryFn({ ...querySaveForm, query });
  };

  return (
    <Container maxWidth={false} disableGutters>
      <Box
        component='form'
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          width: '100%',
          my: 1,
        }}
        onSubmit={handleSubmit(onValid)}
      >
        <Autocomplete
          disablePortal
          options={['COMPLIANCE', 'CUSTOM', 'SG']}
          sx={{ minWidth: '200px', mr: 1 }}
          renderInput={(params) => <TextField {...register('category')} {...params} label='CATEGORY' />}
          size='medium'
          onChange={(event: React.SyntheticEvent, value) => setCategory(value)}
          value={category}
          inputValue={category ?? ''}
        />
        <TextField
          fullWidth={false}
          label='TYPE'
          type='text'
          sx={{ mr: 1, minWidth: '200px' }}
          size='medium'
          {...register('type')}
        />
        <TextField
          fullWidth={false}
          label='NAME'
          type='text'
          sx={{ mr: 1, minWidth: '200px' }}
          size='medium'
          {...register('name')}
        />
        <Button
          type='submit'
          color='secondary'
          text={
            loading ? (
              <>
                <CircularProgress color='inherit' size={20} />
                &nbsp;&nbsp;Saving...
              </>
            ) : (
              'Save Query'
            )
          }
          sx={{ minWidth: '300px', width: '100%' }}
          size='large'
          disabled={error || loading ? true : false}
        />
      </Box>
      {!loading && data ? (
        <Alert
          variant='filled'
          severity={data?.ok ? 'success' : 'error'}
          sx={{ my: 1, width: '100%' }}
        >
          <Typography variant={'inherit'}>
            {data?.ok && !data?.error ? 'Query Saved!' : data?.error}
          </Typography>
        </Alert>
      ) : null}
    </Container>
  );
}
