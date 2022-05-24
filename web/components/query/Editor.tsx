import AceEditor from 'react-ace';

import 'ace-builds/src-noconflict/mode-pgsql';
import 'ace-builds/src-noconflict/snippets/pgsql';
import 'ace-builds/src-noconflict/theme-textmate';
import 'ace-builds/src-noconflict/ext-language_tools';
import React, { useEffect, useRef, useState } from 'react';

import Button from '../Button';
import { Ace } from 'ace-builds';
import useMutation from '@libs/hooks/useMutation';
import { Alert, CircularProgress, Container, Typography } from '@mui/material';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { queryFilter, queryResults } from '@libs/atoms';
import Table from '@components/table/Table';
import ReactAce from 'react-ace/lib/ace';
import { useForm } from 'react-hook-form';
import QuerySaveForm from './QuerySaveForm';

// FIXME: data 형태 고치기
export default function Editor({
  data,
  msg,
  error,
}: {
  data: any;
  msg: string | undefined;
  error: string | undefined;
}) {
  const clickBtn = useRef<HTMLButtonElement>(null);
  const focusEditor = useRef<ReactAce>(null);
  const [results, setResults] = useRecoilState(queryResults);
  const [queryFn, { loading, data: resData, error: resError, controller }] =
    useMutation('/api/queries');
  const setFilterName = useSetRecoilState(queryFilter);
  const [query, setQuery] = useState(`SELECT * FROM aws_account LIMIT 1`);
  const regex =
    /(;)|\/\*(.*)\*\/|(--).*|--|\/\*(.*)|\*\/|(\b(ALTER|INFORMATION_SCHEMA|CREATE|DELETE|DROP|EXEC(UTE){0,1}|INSERT( +INTO){0,1}|MERGE|UPDATE)\b)/gi;
  const tables: string[] = [];
  if (data) data.map((d: any) => tables.push(d.table_name));

  const onValid = (event: any) => {
    if (loading) return;
    setFilterName('');
    queryFn({ query: query.replaceAll(regex, '') });
    focusEditor.current?.editor.focus();
  };

  useEffect(() => {
    setResults(resData?.data);
  }, [loading, resData, setResults]);

  return (
    <Container
      maxWidth={false}
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      disableGutters
    >
      <AceEditor
        ref={focusEditor}
        mode='pgsql'
        theme='textmate'
        onChange={(value) => setQuery(value)}
        fontSize={14}
        showGutter={true}
        name='UNIQUE_ID_OF_DIV'
        value={query}
        editorProps={{ $blockScrolling: true }}
        setOptions={{
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
          enableSnippets: true,
          showLineNumbers: true,
          tabSize: 2,
          highlightGutterLine: false,
          printMargin: false,
        }}
        width={'100%'}
        height={'300px'}
        wrapEnabled={true}
        style={{ borderRadius: '5px', border: '1px solid rgba(0, 0, 0, 0.1)' }}
        commands={[
          {
            name: 'crown_sendo',
            bindKey: {
              win: 'ctrl-return',
              mac: 'cmd-return',
            },
            exec: (editor) => {
              if (!clickBtn.current) return;
              clickBtn.current.click();
            },
          },
        ]}
        onLoad={(editor) => {
          editor.renderer.setScrollMargin(1, 5, 0, 0);
          const mode = editor.getSession().getMode();
          mode.getCompletions = (
            state: string,
            session: Ace.EditSession,
            pos: Ace.Point,
            prefix: string
          ) => {
            const completions: Ace.Completion[] = [];
            tables.forEach(function (w) {
              completions.push({
                value: w,
                score: 0,
                caption: w || '',
              });
            });
            return completions;
          };
          editor.getSession().setMode(mode);
          editor.focus();
        }}
      />
      {error || (!loading && resData && !resData?.ok) ? (
        <Alert variant='filled' severity='error' sx={{ mt: 1, width: '100%' }}>
          {error || resData?.error}
        </Alert>
      ) : null}
      {!loading && resData?.msg && !error ? (
        <Alert
          variant='standard'
          severity='warning'
          sx={{ mt: 1, width: '100%' }}
        >
          <Typography variant={'inherit'}>{resData?.msg}</Typography>
        </Alert>
      ) : null}

      <Container
        maxWidth={false}
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          my: 1,
          width: '100%',
        }}
        disableGutters
      >
        <Button
          refer={clickBtn}
          text={
            loading ? (
              <>
                <CircularProgress color='inherit' size={20} />
                &nbsp;&nbsp;Querying...
              </>
            ) : (
              'Submit'
            )
          }
          sx={{
            width: '100%',
            mr: loading ? 1 : null,
          }}
          onClick={onValid}
          disabled={error || loading ? true : false}
        />
        {loading ? (
          <Button
            color='error'
            text='Cancel'
            sx={{
              width: '100%',
            }}
            onClick={() => controller?.abort()}
            disabled={!loading ? true : false}
          />
        ) : null}
      </Container>
      {!loading && resData?.ok && !error ? (
        <QuerySaveForm query={query.replaceAll(regex, '')} />
      ) : null}
      {results ? <Table rows={10} /> : null}
    </Container>
  );
}
