/*
 * Tencent is pleased to support the open source community by making
 * 蓝鲸智云PaaS平台 (BlueKing PaaS) available.
 *
 * Copyright (C) 2021 THL A29 Limited, a Tencent company.  All rights reserved.
 *
 * 蓝鲸智云PaaS平台 (BlueKing PaaS) is licensed under the MIT License.
 *
 * License for 蓝鲸智云PaaS平台 (BlueKing PaaS):
 *
 * ---------------------------------------------------
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
 * to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of
 * the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
 * THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
 * CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

import { computed, defineComponent, ref, watch } from 'vue';

import useLocale from '@/hooks/use-locale';
import useStore from '@/hooks/use-store';
import { RetrieveUrlResolver } from '@/store/url-resolver';
import { useRouter, useRoute } from 'vue-router/composables';

import { deepClone } from '../../../common/util';
import { BK_LOG_STORAGE, SEARCH_MODE_DIC } from '../../../store/store.type';
import RetrieveHelper from '../../retrieve-helper';
import CollectHead from './components/collect-head/collect-head';
import CollectList from './components/collect-list/collect-list';
import CollectTab from './components/collect-tab/collect-tab';
import CollectTool from './components/collect-tool/collect-tool';
import { getGroupNameRules, handleUpdateGroupName } from './utils';

import { IGroupItem, IFavoriteItem } from './type';

import './collect-main.scss';

export default defineComponent({
  name: 'CollectMain',
  props: {
    isShowCollect: { type: Boolean, required: true },
  },
  emits: ['show-change'],

  setup(props, { emit }) {
    const { t } = useLocale();
    const store = useStore();
    const router = useRouter();
    const route = useRoute();
    const collectToolRef = ref(null);
    const favoriteLoading = ref(false);
    const activeTab = ref('origin');
    /** 当前业务名 */
    const spaceUid = computed(() => store.state.spaceUid);
    /** 是否仅查看当前索引集 */
    const isShowCurrentIndexList = ref(RetrieveHelper.isViewCurrentIndex);
    const isUnionSearch = computed(() => store.getters.isUnionSearch);
    const unionIndexList = computed(() => store.state.unionIndexList);
    const indexSetId = computed(() => `${store.getters.indexId}`);
    const list = computed(() => store.state.favoriteList || []);
    const indexSetList = computed(() => store.state.retrieve.indexSetList ?? []);
    const activeFavorite = ref({});
    /** 输入框搜索内容 */
    const searchValue = ref('');
    /** 是否展开全部列表 */
    const isCollapseList = ref(true);

    const isSearchEmpty = computed(
      () => !!searchValue.value?.length && filterDataList.value.filter(item => item.favorites.length).length === 0,
    );
    /** 分组名校验规则 */
    const rulesData = computed(() => getGroupNameRules(filterDataList.value));

    /** 展开/收起 收藏夹  */
    const handleCollapse = () => {
      emit('show-change', !props.isShowCollect);
    };
    /** 列表展开收起 */
    const handleCollapseList = (val: boolean) => {
      isCollapseList.value = val;
    };
    /** 根据不同tab类型获取要展示的列表 */
    const filterDataType = (dataType: string) => {
      return favoriteList.value.map(({ group_id, group_name, group_type, favorites }) => ({
        group_id,
        group_name,
        group_type,
        favorites: favorites.filter((item: IFavoriteItem) => item.favorite_type === dataType),
      }));
    };
    /** 获取每个tab类型数据量 */
    const getTypeCount = (data: IGroupItem[]) => {
      return data.reduce((pre: number, cur) => pre + cur.favorites.length, 0);
    };
    /** tab 切换 */
    const handleTabChange = (tab: string) => {
      activeTab.value = tab;
    };
    /** 调整排序 */
    const handleSortChange = () => {
      getFavoriteList();
    };
    /** 新增收藏分组 */
    const handleAddGroup = async (groupName: string) => {
      if (!groupName.trim()) return;
      await handleUpdateGroupName({ group_new_name: groupName }, spaceUid.value);
      collectToolRef.value?.handleCancel('add');
      getFavoriteList();
    };
    /** 是否仅查看当前索引集 */
    const handleChangeIndex = (val: boolean) => {
      isShowCurrentIndexList.value = val;
      RetrieveHelper.setViewCurrentIndexSet(val);
    };
    /** 获取列表数据 */
    const getFavoriteList = async () => {
      try {
        favoriteLoading.value = true;
        // isHidden.value = false;
        await store.dispatch('requestFavoriteList');
      } catch (err) {
        favoriteLoading.value = false;
      } finally {
        // if (activeFavoriteID.value !== -1) {
        //   let isFindCheckValue = false;
        //   for (const gItem of favoriteList.value) {
        //     const findFavorites = gItem.favorites.find(item => item.id === activeFavoriteID.value);
        //     if (!!findFavorites) {
        //       isFindCheckValue = true;
        //       break;
        //     }
        //   }
        //   if (!isFindCheckValue) handleClickitem();
        // }
        favoriteLoading.value = false;
      }
    };
    const allFavoriteNumber = computed(() => list.value.reduce((pre: number, cur) => pre + cur.favorites.length, 0));

    const favoriteList = computed(() => {
      let data = list.value ?? [];
      if (isShowCurrentIndexList.value) {
        data = (list.value ?? []).map(({ group_id, group_name, group_type, favorites }) => {
          return {
            group_id,
            group_name,
            group_type,
            favorites: favorites.filter(item => {
              if (isUnionSearch.value) {
                return (
                  item.index_set_type === 'union' &&
                  (item.index_set_ids ?? []).every(id => unionIndexList.value.includes(`${id}`))
                );
              }
              return item.index_set_type === 'single' && `${item.index_set_id}` === indexSetId.value;
            }),
          };
        });
      }
      const provideFavorite = data[0];
      const publicFavorite = data[data.length - 1];
      const sortFavoriteList = data.slice(1, data.length - 1).sort((a, b) => a.group_name.localeCompare(b.group_name));
      const sortAfterList = [provideFavorite, ...sortFavoriteList, publicFavorite];
      return sortAfterList.filter(item => item !== undefined);
    });

    const originFavoriteList = computed(() => filterDataType('search'));
    const chartFavoriteList = computed(() => filterDataType('chart'));
    const showList = computed(() =>
      activeTab.value === 'origin' ? originFavoriteList.value : chartFavoriteList.value,
    );

    const filterDataList = computed(() =>
      showList.value.map((group: IGroupItem) => ({
        ...group,
        favorites: group.favorites.filter(
          ele => ele.created_by.includes(searchValue.value) || ele.name.includes(searchValue.value),
        ),
      })),
    );

    const tabList = computed(() => [
      {
        name: t('原始日志'),
        icon: 'bklog-table-2',
        key: 'origin',
        count: getTypeCount(originFavoriteList.value),
      },
      {
        name: t('图表分析'),
        icon: 'bklog-chart-2',
        key: 'chart',
        count: getTypeCount(chartFavoriteList.value),
      },
    ]);
    watch(
      () => props.isShowCollect,
      value => {
        if (value) {
          getFavoriteList();
        } else {
          activeFavorite.value = null;
          searchValue.value = '';
        }
      },
      { immediate: true },
    );
    const handleRefresh = () => {
      getFavoriteList();
    };
    const renderEmpty = (emptyType: string) => {
      return (
        <div class='data-empty-box'>
          <bk-exception
            class='exception-wrap-item exception-part'
            scene='part'
            type={emptyType}
          ></bk-exception>
        </div>
      );
    };
    /** 更新路由配置 */
    const setRouteParams = (item: IFavoriteItem) => {
      const getRouteQueryParams = () => {
        const { ids, isUnionIndex } = store.state.indexItem;
        const search_mode = SEARCH_MODE_DIC[store.state.storage[BK_LOG_STORAGE.SEARCH_TYPE]] ?? 'ui';
        const unionList = store.state.unionIndexList;
        const clusterParams = store.state.clusterParams;
        const { start_time, end_time, addition, begin, size, ip_chooser, host_scopes, interval, sort_list } =
          store.getters.retrieveParams;
        return {
          addition,
          start_time,
          end_time,
          begin,
          size,
          ip_chooser,
          host_scopes,
          interval,
          bk_biz_id: store.state.bkBizId,
          search_mode,
          sort_list,
          ids,
          isUnionIndex,
          unionList,
          clusterParams,
        };
      };
      const routeParams = getRouteQueryParams();
      const { ids, isUnionIndex } = routeParams;
      const params = isUnionIndex
        ? { ...route.params, indexId: undefined }
        : { ...route.params, indexId: ids?.[0] ? `${ids?.[0]}` : route.params?.indexId };
      const query = { ...route.query };
      const resolver = new RetrieveUrlResolver({
        ...routeParams,
        datePickerValue: store.state.indexItem.datePickerValue,
      });
      Object.assign(query, resolver.resolveParamsToUrl(), {
        tab: item?.favorite_type === 'chart' ? 'graphAnalysis' : 'origin',
      });
      router.replace({
        params,
        query,
      });
    };
    /** 选中收藏 */
    const handleSelectItem = (item: IFavoriteItem) => {
      if (!item) {
        activeFavorite.value = null;
        let clearSearchValueNum = store.state.clearSearchValueNum;
        // 清空当前检索条件
        store.commit('updateClearSearchValueNum', (clearSearchValueNum += 1));
        setRouteParams(item);
        setTimeout(() => {
          RetrieveHelper.setFavoriteActive(activeFavorite.value);
        });
        return;
      }
      const cloneValue = deepClone(item);
      activeFavorite.value = deepClone(item);

      const isUnionIndex = cloneValue.index_set_ids.length > 0;
      const keyword = cloneValue.params.keyword;
      const addition = cloneValue.params.addition ?? [];
      const getSearchMode = () => {
        if (addition.length > 0 && keyword.length > 0) {
          return cloneValue.search_mode;
        }
        if (addition.length > 0) {
          return 'ui';
        }

        return 'sql';
      };
      const search_mode = getSearchMode();

      store.commit('resetIndexsetItemParams');
      store.commit('updateIndexId', cloneValue.index_set_id);
      store.commit('updateIsSetDefaultTableColumn', false);
      store.commit('updateStorage', {
        [BK_LOG_STORAGE.INDEX_SET_ACTIVE_TAB]: item.index_set_type,
        [BK_LOG_STORAGE.SEARCH_TYPE]: ['ui', 'sql'].indexOf(search_mode ?? 'ui'),
      });

      const ip_chooser = Object.assign({}, cloneValue.params.ip_chooser ?? {});
      if (isUnionIndex) {
        store.commit(
          'updateUnionIndexList',
          cloneValue.index_set_ids.map(item => String(item)),
        );
      }
      if (JSON.stringify(ip_chooser) !== '{}') {
        addition.push({
          field: '_ip-select_',
          operator: '',
          value: [ip_chooser],
        });
      }
      const ids = isUnionIndex ? cloneValue.index_set_ids : [cloneValue.index_set_id];
      store.commit('updateIndexItem', {
        keyword,
        addition,
        ip_chooser,
        index_set_id: cloneValue.index_set_id,
        ids,
        items: ids.map(id => indexSetList.value.find(item => item.index_set_id === `${id}`)),
        isUnionIndex,
        search_mode: search_mode,
      });

      setRouteParams(item);
      store.commit('updateChartParams', {
        ...cloneValue.params.chart_params,
        fromCollectionActiveTab: 'unused',
      });

      store.commit('updateIndexSetQueryResult', {
        origin_log_list: [],
        list: [],
      });
      store.dispatch('requestIndexSetFieldInfo').then(() => {
        RetrieveHelper.setFavoriteActive({ ...activeFavorite.value, search_mode });
        store.dispatch('requestIndexSetQuery');
      });
    };

    /** 工具栏相关操作 */
    const toolHandle = (type: string, data) => {
      switch (type) {
        /** 新增分组 */
        case 'add-group':
          handleAddGroup(data);
          break;
        /** 是否仅查看当前索引集 */
        case 'change-index':
          handleChangeIndex(data);
          break;
        /** 全部展开/收起 */
        case 'collapse':
          handleCollapseList(data);
          break;
        /** 调整排序 */
        case 'sort-change':
          handleSortChange();
          break;
      }
    };

    return () => (
      <div class='collect-main-box'>
        <div class='collect-main-top'>
          <CollectHead
            total={allFavoriteNumber.value}
            on-collapse={handleCollapse}
          />
          <bk-input
            class='collect-main-search-input'
            clearable={true}
            placeholder={t('请输入')}
            right-icon='bk-icon icon-search'
            value={searchValue.value}
            onInput={v => (searchValue.value = v)}
          />
          <CollectTab
            active={activeTab.value}
            list={tabList.value}
            on-tab-change={handleTabChange}
          />
          <CollectTool
            ref={collectToolRef}
            collapseAll={isCollapseList.value}
            isChecked={isShowCurrentIndexList.value}
            rules={rulesData.value}
            on-handle={toolHandle}
          />
        </div>
        {!isSearchEmpty.value ? (
          filterDataList.value.length ? (
            <CollectList
              isCollapse={isCollapseList.value}
              list={filterDataList.value}
              loading={favoriteLoading.value}
              on-refresh={handleRefresh}
              on-select-item={handleSelectItem}
            />
          ) : (
            renderEmpty('empty')
          )
        ) : (
          renderEmpty('search-empty')
        )}
      </div>
    );
  },
});
