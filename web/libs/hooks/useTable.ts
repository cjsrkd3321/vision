import {
  ButtonSettings,
  buttonSettingState,
  getApiUrlState,
  hasChipState,
  hasRequestButtonState,
  hasTitleState,
  postApiUrlState,
  queryFilter,
  queryResults,
  QueryTitle,
  queryTitle,
  queryTitles,
  sgRequestFormState
} from '@libs/atoms';
import { useEffect } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import useSWR from 'swr';

interface UseTableProps {
  getUrl: string;
  hasInterval?: boolean;
  hasRequestButton?: boolean;
  postUrl?: string;
  buttonSettings?: ButtonSettings;
  hasChip?: boolean;
  previewData?: any;
  existsTitle?: boolean;
}

export interface UseSWRState<T> {
  ok: boolean;
  data: T;
  error?: string;
  msg?: string;
}

export default function useTable<T = any>({
  getUrl,
  hasInterval = true,
  hasRequestButton = false,
  postUrl,
  buttonSettings = {
    isPopover: false,
    text: 'Hello',
    color: 'success',
    size: 'medium',
  },
  hasChip = false,
  previewData,
  existsTitle = true,
}: UseTableProps) {
  const [results, setResults] = useRecoilState(queryResults);
  const [title, setTitle] = useRecoilState(queryTitle);
  const [hasTitle, setHasTitle] = useRecoilState(hasTitleState);
  const titles = useRecoilValue(queryTitles);
  const setButtonSettings = useSetRecoilState(buttonSettingState);
  const setGetApiUrl = useSetRecoilState(getApiUrlState);
  const setPostApiUrl = useSetRecoilState(postApiUrlState);
  const setHasRequestButton = useSetRecoilState(hasRequestButtonState);
  const setHasChip = useSetRecoilState(hasChipState);
  const setFilterName = useSetRecoilState(queryFilter);
  const setSgRequestForm = useSetRecoilState(sgRequestFormState);
  const { data, error } = useSWR<UseSWRState<T>>(getUrl, {
    refreshInterval: hasInterval ? 3000 : 0,
  });

  let dataError = data?.error;
  let dataMsg = data?.msg;

  useEffect(() => {
    return () => {
      setResults(undefined);
      setGetApiUrl(undefined);
      setPostApiUrl(undefined);
      setTitle(undefined);
      setHasChip(false);
      setFilterName('');
      setHasRequestButton(false);
      setSgRequestForm({
        protocol: 'TCP',
        source: undefined,
        sourceId: undefined,
        destination: undefined,
        destinationId: undefined,
      });
    };
  }, [
    setResults,
    setGetApiUrl,
    setPostApiUrl,
    setTitle,
    setHasChip,
    setFilterName,
    setHasRequestButton,
    setSgRequestForm,
  ]);

  useEffect(() => {
    setHasTitle(existsTitle);
    setGetApiUrl(getUrl);
    setPostApiUrl(postUrl);
    setButtonSettings(buttonSettings);
    setHasChip(hasChip);
    setHasRequestButton(hasRequestButton);
  }, [
    setGetApiUrl,
    setPostApiUrl,
    setHasTitle,
    existsTitle,
    getUrl,
    postUrl,
    setButtonSettings,
    buttonSettings,
    setHasChip,
    hasChip,
    setHasRequestButton,
    hasRequestButton,
  ]);

  useEffect(() => {
    if (!data) return;
    setResults(data?.data || previewData);
  }, [data, previewData, setResults]);

  useEffect(() => {
    if (!hasTitle || !results || !titles) return;
    const idx = titles.findIndex((_title: QueryTitle) =>
      JSON.stringify(_title).includes(title?.name || '')
    );
    setTitle(idx === -1 ? titles[0] || title : titles[idx]);
  }, [results, setTitle, results, title, titles]);

  return { results, dataError, dataMsg, error };
}
