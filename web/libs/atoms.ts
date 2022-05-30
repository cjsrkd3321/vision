import { atom, selector } from 'recoil';

export const queryResults = atom<any>({
  key: 'queryResults',
  default: undefined,
});

export const queryFilter = atom<string>({
  key: 'queryFilter',
  default: '',
});

export const hasTitleState = atom<boolean>({
  key: 'hasTitleState',
  default: true,
});

export interface ButtonSettings {
  isPopover?: boolean;
  text: string;
  color?:
    | 'error'
    | 'info'
    | 'inherit'
    | 'success'
    | 'warning'
    | 'primary'
    | 'secondary'
    | undefined;
  size?: 'small' | 'medium' | 'large' | undefined;
}

export const buttonSettingState = atom<ButtonSettings>({
  key: 'buttonSettingState',
  default: {
    isPopover: false,
    text: 'Hello',
    color: 'success',
    size: 'medium',
  },
});

export const hasChipState = atom<boolean>({
  key: 'hasChip',
  default: false,
});

export interface QueryTitle {
  type: string;
  name: string;
  count?: number;
}

export const queryTitle = atom<QueryTitle | undefined>({
  key: 'queryTitle',
  default: undefined,
});

export const getApiUrlState = atom<string | undefined>({
  key: 'getApiUrlState',
  default: undefined,
});

export const postApiUrlState = atom<string | undefined>({
  key: 'postApiUrlState',
  default: undefined,
});

export const hasRequestButtonState = atom<boolean>({
  key: 'hasRequestButtonState',
  default: false,
});

export type Protocol = 'TCP' | 'UDP' | 'ICMP';

export interface SgRequestForm {
  protocol: Protocol;
  source?: string;
  sourceId?: number;
  destination?: string;
  destinationId?: number;
}

export const sgRequestFormState = atom<SgRequestForm>({
  key: 'sgRequestFormState',
  default: {
    protocol: 'TCP',
    source: undefined,
    sourceId: undefined,
    destination: undefined,
    destinationId: undefined,
  },
});

// NOTE: SELECTOR

export const queryTitles = selector({
  key: 'queryTitles',
  get: ({ get }) => {
    const results = get(queryResults);

    if (!results || !results[0]) return;

    return results.map((result: any) => {
      const count =
        result.compliances?.length ||
        result.resources?.length ||
        result._count?.compliances ||
        result._count?.resources ||
        0;
      return {
        type: result.type,
        name: result.name,
        count,
      };
    });
  },
});

export const queryIdxAndKey = selector({
  key: 'queryIdxAndKey',
  get: ({ get }) => {
    const results = get(queryResults);
    const title = get(queryTitle);

    if (!title || !get(queryTitles)) {
      return [];
    }

    const titleIdx = results.findIndex(
      (result: any) => result?.name === title?.name
    );

    if (!results[titleIdx]) {
      return [];
    }

    const [key] = Object.entries(results[titleIdx]).filter((result) => {
      return result[1] && typeof result[1] === 'object';
    });

    return [titleIdx, key];
  },
});

export const queryHeads = selector({
  key: 'queryHeads',
  get: ({ get }) => {
    let head = [];
    let result = undefined;

    const results = get(queryResults);
    const [titleIdx, key] = get(queryIdxAndKey);

    if (!results) return;

    if (
      typeof titleIdx === 'number' &&
      key &&
      Array.isArray(results[titleIdx][key[0]])
    ) {
      result = results[titleIdx][key[0]][0]?.result;
    } else {
      result = results[0];
    }

    if (typeof result === 'string') {
      head = JSON.parse(result || '{}');
    } else {
      head = result || {};
    }

    const headKeys = Object.keys(head);

    const countHeadIdx = headKeys.findIndex((headKey) => headKey === '_count');
    if (countHeadIdx !== -1) {
      headKeys.splice(countHeadIdx, 1);
    }

    const idHeadIdx = headKeys.findIndex((headKey) => headKey === 'id');
    if (idHeadIdx !== -1) {
      headKeys.splice(idHeadIdx, 1);
    }

    head = headKeys.map((key) => ({
      id: key,
      label: key,
    }));

    if (headKeys.length) head.splice(0, 0, { id: 'no', label: 'No' });

    return head;
  },
});

export const queryBody = selector({
  key: 'queryBody',
  get: ({ get }) => {
    let body = [];
    const results = get(queryResults);
    const [titleIdx, key] = get(queryIdxAndKey);

    if (!results) return;

    if (
      typeof titleIdx === 'number' &&
      key &&
      Array.isArray(results[titleIdx][key[0]])
    ) {
      body = results[titleIdx][key[0]].map((data: any, idx: number) => ({
        no: idx + 1,
        ...(typeof data.result === 'string'
          ? JSON.parse(data.result)
          : data.result),
        _id: data.id,
      }));
    } else {
      body = results.map((data: any, idx: number) => {
        const newData = Object.fromEntries(
          Object.entries(data).filter(
            (datum) => datum[0] !== '_count' && datum[0] !== 'id'
          )
        );
        return {
          no: idx + 1,
          ...newData,
          _id: data.id,
        };
      });
    }

    return body;
  },
});
