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

import RetrieveHelper from '../../retrieve-helper';
import CollectHead from './components/collect-head/collect-head';
import CollectList from './components/collect-list/collect-list';
import CollectTab from './components/collect-tab/collect-tab';
import CollectTool from './components/collect-tool/collect-tool';

import './collect-main.scss';

export default defineComponent({
  name: 'CollectMain',
  props: {
    isShowCollect: { type: Boolean, required: true },
  },
  emits: ['show-change'],

  setup(props, { emit, root }) {
    const { t } = useLocale();
    const store = useStore();
    const favoriteLoading = ref(false);
    const activeTab = ref('origin');
    const isShowCurrentIndexList = ref(RetrieveHelper.isViewCurrentIndex);
    const isUnionSearch = computed(() => store.getters.isUnionSearch);
    const unionIndexList = computed(() => store.state.unionIndexList);
    const indexSetId = computed(() => `${store.getters.indexId}`);
    const list = computed(() => store.state.favoriteList || []);
    const searchValue = ref('');
    const handleCollapse = () => {
      emit('show-change', !props.isShowCollect);
    };
    /** 根据不同tab类型获取要展示的列表 */
    const filterDataType = (dataType: string) => {
      return favoriteList.value.map(({ group_id, group_name, group_type, favorites }) => ({
        group_id,
        group_name,
        group_type,
        favorites: favorites.filter(item => item.favorite_type === dataType),
      }));
    };
    /** 获取每个tab类型数据量 */
    const getTypeCount = data => {
      return data.reduce((pre: number, cur) => pre + cur.favorites.length, 0);
    };
    /** tab 切换 */
    const handleTabChange = (tab: string) => {
      activeTab.value = tab;
    };
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
        //   if (!isFindCheckValue) handleClickFavoriteItem();
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
      showList.value.map(item =>
        item.favorites.filter(
          ele => ele.created_by.includes(searchValue.value) || ele.name.includes(searchValue.value),
        ),
      ),
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
        console.log(value, 'watch isShowCollect');
        if (value) {
          //   baseSortType.value = localStorage.getItem('favoriteSortType') || 'NAME_ASC';
          //   sortType.value = baseSortType.value;
          getFavoriteList();
        } else {
          //   activeFavorite.value = null;
          searchValue.value = '';
        }
      },
      { immediate: true },
    );
    console.log(showList.value, 'filterDataList');

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
          <CollectTool />
        </div>
        <CollectList list={showList.value} />
      </div>
    );
  },
});
