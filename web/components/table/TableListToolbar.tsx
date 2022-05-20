// material
import { styled } from '@mui/material/styles';
import {
  Toolbar,
  OutlinedInput,
  InputAdornment,
  Theme,
  Transitions,
} from '@mui/material';
import { MUIStyledCommonProps } from '@mui/system';

// component
import Iconify from '@components/Iconify';
import GroupSelect from '@components/GroupSelect';

import React, { Dispatch, SetStateAction, useEffect } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { hasTitleState, queryFilter, queryTitle } from '@libs/atoms';
import { useRouter } from 'next/router';

// ----------------------------------------------------------------------

const RootStyle = styled(Toolbar)(({ theme }) => ({
  width: '100vw',
  height: 96,
  display: 'flex',
  justifyContent: 'space-between',
  padding: theme.spacing(0, 1, 0, 3),
}));

interface SearchStyleProps {
  theme: {
    transitions: Transitions;
    customShadows: { z8: string };
    palette: {
      grey: [number][];
    };
  };
}

const SearchStyle = styled(OutlinedInput)(
  ({ theme }: MUIStyledCommonProps<Theme> & SearchStyleProps) => ({
    width: 240,
    transition: theme.transitions.create(['box-shadow', 'width'], {
      easing: theme.transitions.easing.easeInOut,
      duration: theme.transitions.duration.shorter,
    }),
    '&.Mui-focused': { width: 320, boxShadow: theme.customShadows.z8 },
    '& fieldset': {
      borderWidth: `1px !important`,
      borderColor: `${theme.palette.grey[500_32]} !important`,
    },
  })
);

// ----------------------------------------------------------------------

export default function TableListToolbar({
  setPage,
}: {
  setPage: Dispatch<SetStateAction<number>>;
}) {
  const [filterName, setFilterName] = useRecoilState<string>(queryFilter);
  const [title, setTitle] = useRecoilState(queryTitle);
  const hasTitle = useRecoilValue(hasTitleState);

  const {
    query: { type, name, q },
  } = useRouter();

  useEffect(() => {
    const url = new URL(document.location as any);
    if (url.search !== '' && type && name) {
      if (
        typeof type !== 'string' ||
        typeof name !== 'string' ||
        (typeof q !== 'string' && !!q)
      )
        return;
      url.searchParams.set('type', type);
      url.searchParams.set('name', name);
      url.searchParams.set('q', q ?? '');
      setTitle({ type, name });
      setFilterName(q ?? '');
    }
  }, []);

  useEffect(() => {
    const url = new URL(document.location as any);
    if (!title) return;
    if (!hasTitle) {
      url.searchParams.delete('type');
      url.searchParams.delete('name');
      url.searchParams.delete('q');
    } else {
      url.searchParams.set('type', title.type);
      url.searchParams.set('name', title.name);
      url.searchParams.set('q', filterName);
    }
    window.history.pushState(null, '', url.toString());
  }, [hasTitle, filterName, title]);

  const handleFilterByName = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilterName(event.target.value);
    setPage(0);
  };

  return (
    <RootStyle
      sx={{
        color: 'primary.main',
      }}
    >
      {hasTitle ? <GroupSelect /> : <div></div>}

      {/* @ts-ignore */}
      <SearchStyle
        value={filterName}
        onChange={handleFilterByName}
        placeholder='Search data...'
        startAdornment={
          <InputAdornment position='start'>
            <Iconify icon='eva:search-fill' sx={{ color: 'text.disabled' }} />
          </InputAdornment>
        }
      />
    </RootStyle>
  );
}
