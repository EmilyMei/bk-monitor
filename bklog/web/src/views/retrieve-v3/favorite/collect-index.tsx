/* eslint-disable @typescript-eslint/naming-convention */
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

import { RetrieveUrlResolver } from '@/store/url-resolver';
import { defineComponent, ref, reactive, computed, watch } from '@vue/composition-api';
import { Input, Popover, Radio, RadioGroup, Form, FormItem } from 'bk-magic-vue';
import $http from '../../../api';
import { copyMessage, deepClone } from '../../../common/util';
import { BK_LOG_STORAGE, SEARCH_MODE_DIC } from '../../../store/store.type';
import RetrieveHelper from '../../retrieve-helper';
import AddCollectDialog from './add-collect-dialog';
import CollectContainer from './collect-container';
import FavoriteManageDialog from './favorite-manage-dialog.vue';
import './collect-index.scss';

interface IProps {
  collectWidth: number;
  isShowCollect: boolean;
  visibleFields: Array<any>;
}

export interface IGroupItem {
  group_id: number;
  group_name: string;
  group_type?: visibleType;
  favorites?: IFavoriteItem[];
}

export interface IFavoriteItem {
  id: number;
  created_by: string;
  space_uid: number;
  index_set_id: number;
  name: string;
  group_id: number;
  visible_type: visibleType;
  params: any;
  is_active: boolean;
  is_actives?: boolean[];
  index_set_names?: string[];
  index_set_ids?: string[];
  display_fields: string[];
}

type visibleType = 'private' | 'public' | 'unknown';

export default defineComponent<IProps>({
  name: 'CollectIndex',
  props: {
    collectWidth: { type: Number, required: true },
    isShowCollect: { type: Boolean, required: true },
    visibleFields: { type: Array, default: () => [] },
    isRefreshCollect: { type: Boolean, default: false },
  },
  setup(props, { emit, root }) {
    // refs
    const popoverGroupRef = ref<any>(null);
    const popoverSortRef = ref<any>(null);
    const collectContainerRef = ref<any>(null);
    const checkInputFormRef = ref<any>(null);

    // 响应式数据
    const collectMinWidth = 160;
    const collectMaxWidth = 400;
    const currentTreeBoxWidth = ref<null | number>(null);
    const currentScreenX = ref<null | number>(null);
    const isChangingWidth = ref(false);
    const isShowManageDialog = ref(false);
    const isShowAddNewFavoriteDialog = ref(false);
    const collectLoading = ref(false);
    const searchVal = ref('');
    const privateGroupID = ref(0);
    const unknownGroupID = ref(0);
    const baseSortType = ref('NAME_ASC');
    const sortType = ref('NAME_ASC');
    const editFavoriteID = ref(-1);
    const activeFavorite = ref<IFavoriteItem | null>(null);
    const favoriteLoading = ref(false);
    const isHidden = ref(false);
    const currentCollectionType = ref('origin');
    const isShowCurrentIndexList = ref(RetrieveHelper.isViewCurrentIndex);
    const verifyData = reactive({ groupName: '' });
    const tippyOption = {
      trigger: 'click',
      interactive: true,
      theme: 'light',
    };
    const groupSortList = [
      {
        name: root.$t('按名称 {n} 排序', { n: 'A - Z' }),
        id: 'NAME_ASC',
      },
      {
        name: root.$t('按名称 {n} 排序', { n: 'Z - A' }),
        id: 'NAME_DESC',
      },
      {
        name: root.$t('按更新时间排序'),
        id: 'UPDATED_AT_DESC',
      },
    ];
    const rules = {
      groupName: [
        {
          validator: checkName,
          message: root.$t('{n}不规范, 包含特殊符号', { n: root.$t('组名') }),
          trigger: 'blur',
        },
        {
          validator: checkExistName,
          message: root.$t('组名重复'),
          trigger: 'blur',
        },
        {
          required: true,
          message: root.$t('必填项'),
          trigger: 'blur',
        },
        {
          max: 30,
          message: root.$t('不能多于{n}个字符', { n: 30 }),
          trigger: 'blur',
        },
      ],
    };

    // 计算属性
    const isSearchFilter = computed(() => !!searchVal.value?.length);
    const spaceUid = computed(() => root.$store.state.spaceUid);
    const bkBizId = computed(() => root.$store.state.bkBizId);
    const activeFavoriteID = computed(() => activeFavorite.value?.id || -1);
    const indexSetId = computed(() => `${root.$store.getters.indexId}`);
    const isUnionSearch = computed(() => root.$store.getters.isUnionSearch);
    const unionIndexList = computed(() => root.$store.state.unionIndexList);
    const indexSetList = computed(() => root.$store.state.retrieve.indexSetList ?? []);
    const favoriteList = computed(() => {
      let data = root.$store.state.favoriteList ?? [];
      if (isShowCurrentIndexList.value) {
        data = (root.$store.state.favoriteList ?? []).map(({ group_id, group_name, group_type, favorites }) => {
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
    const originFavoriteList = computed(() =>
      favoriteList.value.map(({ group_id, group_name, group_type, favorites }) => ({
        group_id,
        group_name,
        group_type,
        favorites: favorites.filter(item => item.favorite_type !== 'chart'),
      })),
    );
    const chartFavoriteList = computed(() =>
      favoriteList.value.map(({ group_id, group_name, group_type, favorites }) => ({
        group_id,
        group_name,
        group_type,
        favorites: favorites.filter(item => item.favorite_type === 'chart'),
      })),
    );
    const filterCollectList = computed(() => {
      const mapFn = ({ group_id, group_name, group_type, favorites }) => ({
        group_id,
        group_name,
        group_type,
        favorites: favorites.filter(
          fItem => fItem.created_by.includes(searchVal.value) || fItem.name.includes(searchVal.value),
        ),
      });
      if (currentCollectionType.value === 'origin') {
        return originFavoriteList.value
          .map(mapFn)
          .filter(item => !isShowCurrentIndexList.value || item.favorites.length);
      }
      return chartFavoriteList.value.map(mapFn).filter(item => !isShowCurrentIndexList.value || item.favorites.length);
    });
    const groupList = computed(() => filterCollectList.value);
    const originFavoriteCount = computed(() =>
      originFavoriteList.value.reduce((pre: number, cur) => pre + cur.favorites.length, 0),
    );
    const chartFavoriteCount = computed(() =>
      chartFavoriteList.value.reduce((pre: number, cur) => pre + cur.favorites.length, 0),
    );
    const allFavoriteNumber = computed(() =>
      favoriteList.value.reduce((pre: number, cur) => pre + cur.favorites.length, 0),
    );

    // 监听
    watch(
      () => props.isShowCollect,
      value => {
        if (value) {
          baseSortType.value = localStorage.getItem('favoriteSortType') || 'NAME_ASC';
          sortType.value = baseSortType.value;
          getFavoriteList();
        } else {
          activeFavorite.value = null;
          searchVal.value = '';
        }
      },
    );
    watch(
      () => props.isRefreshCollect,
      val => {
        if (val) getFavoriteList();
        emit('update:isRefreshCollect', false);
      },
    );
    watch(bkBizId, () => {
      if (props.isShowCollect) getFavoriteList();
    });
    watch(
      activeFavorite,
      val => {
        emit('update-active-favorite', val);
      },
      { deep: true },
    );

    // 方法
    function checkName() {
      if (verifyData.groupName.trim() === '') return true;
      return /^[\u4e00-\u9fa5_a-zA-Z0-9`~!@#$%^&*()_\-+=<>?:"\s{}|,.\/;'\\[\]·~！@#￥%……&*（）——\-+={}|《》？：“”【】、；‘'，。、]+$/im.test(
        verifyData.groupName.trim(),
      );
    }
    function checkExistName() {
      return !groupList.value.some(item => item.group_name === verifyData.groupName);
    }
    async function getFavoriteList() {
      try {
        favoriteLoading.value = true;
        isHidden.value = false;
        await root.$store.dispatch('requestFavoriteList');
      } catch (err) {
        favoriteLoading.value = false;
      } finally {
        if (activeFavoriteID.value !== -1) {
          let isFindCheckValue = false;
          for (const gItem of favoriteList.value) {
            const findFavorites = gItem.favorites.find(item => item.id === activeFavoriteID.value);
            if (!!findFavorites) {
              isFindCheckValue = true;
              break;
            }
          }
          if (!isFindCheckValue) handleClickFavoriteItem();
        }
        favoriteLoading.value = false;
      }
    }
    function setRouteParams(favoriteItem) {
      const getRouteQueryParams = () => {
        const { ids, isUnionIndex } = root.$store.state.indexItem;
        const search_mode = SEARCH_MODE_DIC[root.$store.state.storage[BK_LOG_STORAGE.SEARCH_TYPE]] ?? 'ui';
        const unionList = root.$store.state.unionIndexList;
        const clusterParams = root.$store.state.clusterParams;
        const { start_time, end_time, addition, begin, size, ip_chooser, host_scopes, interval, sort_list } =
          root.$store.getters.retrieveParams;
        return {
          addition,
          start_time,
          end_time,
          begin,
          size,
          ip_chooser,
          host_scopes,
          interval,
          bk_biz_id: root.$store.state.bkBizId,
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
        ? { ...root.$route.params, indexId: undefined }
        : { ...root.$route.params, indexId: ids?.[0] ? `${ids?.[0]}` : root.$route.params?.indexId };
      const query = { ...root.$route.query };
      const resolver = new RetrieveUrlResolver({
        ...routeParams,
        datePickerValue: root.$store.state.indexItem.datePickerValue,
      });
      Object.assign(query, resolver.resolveParamsToUrl(), {
        tab: favoriteItem?.favorite_type === 'chart' ? 'graphAnalysis' : 'origin',
      });
      root.$router.replace({
        params,
        query,
      });
    }
    function handleClickFavoriteItem(value?) {
      if (!value) {
        activeFavorite.value = null;
        let clearSearchValueNum = root.$store.state.clearSearchValueNum;
        root.$store.commit('updateClearSearchValueNum', (clearSearchValueNum += 1));
        setRouteParams(value);
        setTimeout(() => {
          RetrieveHelper.setFavoriteActive(activeFavorite.value);
        });
        return;
      }
      const cloneValue = deepClone(value);
      activeFavorite.value = deepClone(value);
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
      root.$store.commit('resetIndexsetItemParams');
      root.$store.commit('updateIndexId', cloneValue.index_set_id);
      root.$store.commit('updateIsSetDefaultTableColumn', false);
      root.$store.commit('updateStorage', {
        [BK_LOG_STORAGE.INDEX_SET_ACTIVE_TAB]: value.index_set_type,
        [BK_LOG_STORAGE.SEARCH_TYPE]: ['ui', 'sql'].indexOf(search_mode ?? 'ui'),
      });
      const ip_chooser = Object.assign({}, cloneValue.params.ip_chooser ?? {});
      if (isUnionIndex) {
        root.$store.commit(
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
      root.$store.commit('updateIndexItem', {
        keyword,
        addition,
        ip_chooser,
        index_set_id: cloneValue.index_set_id,
        ids,
        items: ids.map(id => indexSetList.value.find(item => item.index_set_id === `${id}`)),
        isUnionIndex,
        search_mode: search_mode,
      });
      setRouteParams(value);
      root.$store.commit('updateChartParams', { ...cloneValue.params.chart_params, fromCollectionActiveTab: 'unused' });
      root.$store.commit('updateIndexSetQueryResult', {
        origin_log_list: [],
        list: [],
      });
      root.$store.dispatch('requestIndexSetFieldInfo').then(() => {
        RetrieveHelper.setFavoriteActive({ ...activeFavorite.value, search_mode });
        root.$store.dispatch('requestIndexSetQuery');
      });
    }
    async function handleUserOperate(obj) {
      const { type, value } = obj;
      switch (type) {
        case 'click-favorite':
          handleClickFavoriteItem(value);
          break;
        case 'add-group':
          await handleUpdateGroupName({ group_new_name: value });
          getFavoriteList();
          break;
        case 'reset-group-name':
          await handleUpdateGroupName(value, false);
          getFavoriteList();
          break;
        case 'move-favorite': {
          const visible_type = value.group_id === privateGroupID.value ? 'private' : 'public';
          Object.assign(value, { visible_type });
          await handleUpdateFavorite(value);
          getFavoriteList();
          break;
        }
        case 'remove-group': {
          Object.assign(value, {
            visible_type: 'public',
            group_id: unknownGroupID.value,
          });
          await handleUpdateFavorite(value);
          getFavoriteList();
          break;
        }
        case 'edit-favorite':
          editFavoriteID.value = value.id;
          isShowAddNewFavoriteDialog.value = true;
          break;
        case 'delete-favorite':
          root.$bkInfo({
            subTitle: root.$t('当前收藏名为 {n}，确认是否删除？', { n: value.name }),
            type: 'warning',
            confirmFn: async () => {
              await deleteFavorite(value.id);
              getFavoriteList();
            },
          });
          break;
        case 'dismiss-group':
          root.$bkInfo({
            title: root.$t('当前分组名为 {n}，确认是否解散？', { n: value.group_name }),
            subTitle: `${root.$t('解散分组后，原分组内的收藏将移至未分组中。')}`,
            type: 'warning',
            confirmFn: async () => {
              await deleteGroup(value.group_id);
              getFavoriteList();
            },
          });
          break;
        case 'share':
        case 'new-link': {
          const params = { indexId: value.index_set_id };
          const resolver = new RetrieveUrlResolver({
            ...value.params,
            addition: value.params.addition,
            search_mode: value.search_mode,
            spaceUid: value.space_uid,
            unionList: value.index_set_ids.map((item: number) => String(item)),
            isUnionIndex: value.index_set_type === 'union',
          });
          const routeData = {
            name: 'retrieve',
            params,
            query: resolver.resolveParamsToUrl(),
          };
          let shareUrl = window.location.origin + root.$router.resolve(routeData).href;
          if (type === 'new-link') {
            window.open(shareUrl, '_blank');
          } else {
            copyMessage(shareUrl, root.$t('复制分享链接成功，通过链接，可直接查询对应收藏日志。'));
          }
          break;
        }
        case 'drag-move-end':
          break;
        case 'create-copy': {
          const { index_set_id, params, name, group_id, display_fields, visible_type, is_enable_display_fields } =
            value;
          const { host_scopes, addition, keyword, search_fields } = params;
          const data = {
            name: `${name} ${root.$t('副本')}`,
            group_id,
            display_fields,
            visible_type,
            host_scopes,
            addition,
            keyword,
            search_fields,
            is_enable_display_fields,
            index_set_id,
            space_uid: spaceUid.value,
          };
          if (isUnionSearch.value) {
            Object.assign(data, {
              index_set_ids: unionIndexList.value,
              index_set_type: 'union',
            });
          }
          $http.request('favorite/createFavorite', { data }).then(() => {
            showMessagePop(root.$t('创建成功'));
            getFavoriteList();
          });
          break;
        }
        default:
      }
    }
    async function handleUpdateGroupName(groupObj, isCreate = true) {
      const { group_id, group_new_name } = groupObj;
      const params = { group_id };
      const data = { name: group_new_name, space_uid: spaceUid.value };
      const requestStr = isCreate ? 'createGroup' : 'updateGroupName';
      await $http.request(`favorite/${requestStr}`, { params, data }).then(() => {
        showMessagePop(root.$t('操作成功'));
      });
    }
    async function deleteGroup(group_id) {
      await $http.request('favorite/deleteGroup', { params: { group_id } }).then(() => {
        showMessagePop(root.$t('操作成功'));
      });
    }
    async function deleteFavorite(favorite_id) {
      await $http.request('favorite/deleteFavorite', { params: { favorite_id } }).then(() => {
        showMessagePop(root.$t('删除成功'));
      });
    }
    function showMessagePop(message, theme = 'success') {
      root.$bkMessage({ message, theme });
    }
    async function handleUpdateFavorite(favoriteData) {
      const { params, name, group_id, display_fields, visible_type, id, index_set_id, index_set_ids, index_set_type } =
        favoriteData;
      const { ip_chooser, addition, keyword, search_fields } = params;
      const data: any = {
        name,
        group_id,
        display_fields,
        visible_type,
        ip_chooser,
        addition,
        keyword,
        search_fields,
        index_set_type,
      };
      if (index_set_type === 'union') {
        Object.assign(data, { index_set_ids });
      } else {
        Object.assign(data, { index_set_id });
      }
      await $http.request('favorite/updateFavorite', { params: { id }, data }).then(() => {
        showMessagePop(root.$t('操作成功'));
      });
    }
    function handleGroupKeyDown(value: string, event) {
      if (event.code === 'Tab' && !!value) {
        handleUserOperate({ type: 'add-group', value });
        popoverGroupRef.value?.hideHandler();
        setTimeout(() => {
          verifyData.groupName = '';
        }, 500);
      }
    }
    function dragBegin(e) {
      isChangingWidth.value = true;
      currentTreeBoxWidth.value = props.collectWidth;
      currentScreenX.value = e.screenX;
      window.addEventListener('mousemove', dragMoving, { passive: true });
      window.addEventListener('mouseup', dragStop, { passive: true });
    }
    function dragMoving(e) {
      const newTreeBoxWidth = currentTreeBoxWidth.value + e.screenX - currentScreenX.value;
      if (newTreeBoxWidth < collectMinWidth) {
        emit('update:collectWidth', 240);
        emit('update:isShowCollect', false);
        dragStop();
        localStorage.setItem('isAutoShowCollect', 'false');
      } else if (newTreeBoxWidth >= collectMaxWidth) {
        emit('update:collectWidth', collectMaxWidth);
      } else {
        emit('update:collectWidth', newTreeBoxWidth);
      }
    }
    function dragStop() {
      isChangingWidth.value = false;
      currentTreeBoxWidth.value = null;
      currentScreenX.value = null;
      window.removeEventListener('mousemove', dragMoving);
      window.removeEventListener('mouseup', dragStop);
    }
    function handleRadioGroup(val: string) {
      currentCollectionType.value = val;
    }
    function handleCollapse() {
      emit('update:isShowCollect', !props.isShowCollect);
    }
    function handleGroupIsHidden() {
      isHidden.value = !isHidden.value;
      collectContainerRef.value?.handleGroupIsHidden(isHidden.value);
    }
    function handleFavoriteSetttingClick() {
      isShowManageDialog.value = true;
    }
    function handleShowCurrentChange() {
      RetrieveHelper.setViewCurrentIndexSet(isShowCurrentIndexList.value);
    }
    function closeShowManageDialog() {
      isShowManageDialog.value = false;
      getFavoriteList();
    }
    function handleClickGroupBtn(clickType: string) {
      if (clickType === 'add') {
        checkInputFormRef.value.validate().then(async () => {
          if (!verifyData.groupName.trim()) return;
          await handleUpdateGroupName({ group_new_name: verifyData.groupName });
          getFavoriteList();
          popoverGroupRef.value?.hideHandler();
          setTimeout(() => {
            verifyData.groupName = '';
          }, 500);
        });
      }
      if (clickType === 'cancel') {
        popoverGroupRef.value?.hideHandler();
        checkInputFormRef.value?.clearError();
      }
    }
    function handleClickSortBtn(clickType: string) {
      if (clickType === 'sort') {
        baseSortType.value = sortType.value;
        localStorage.setItem('favoriteSortType', sortType.value);
        getFavoriteList();
      } else {
        setTimeout(() => {
          sortType.value = baseSortType.value;
        }, 500);
      }
      popoverSortRef.value?.hideHandler();
    }
    // 渲染
    return () => (
      <div
        style={{
          width: props.isShowCollect ? `${props.collectWidth}px` : 0,
          display: props.isShowCollect ? 'block' : 'none',
        }}
        class='retrieve-collect-index'
      >
        <CollectContainer
          ref={collectContainerRef}
          activeFavoriteID={activeFavoriteID.value}
          collectLoading={collectLoading.value || favoriteLoading.value}
          dataList={filterCollectList.value}
          groupList={groupList.value}
          isSearchFilter={isSearchFilter.value}
          on-change={handleUserOperate}
        >
          <div class='search-container-new'>
            <div class='search-container-new-title'>
              <div>
                <span style={{ fontSize: '14px', color: '#313238' }}>{root.$t('收藏夹')}</span>
                <span class='search-container-new-title-num'>{allFavoriteNumber.value}</span>
              </div>
              <div
                style={{ fontSize: '16px', cursor: 'pointer' }}
                class='search-container-new-title-right'
              >
                <span
                  class='bklog-icon bklog-shezhi'
                  onClick={handleFavoriteSetttingClick}
                ></span>
                <span
                  class='bklog-icon bklog-collapse'
                  onClick={handleCollapse}
                ></span>
              </div>
            </div>
            <div class='search-box fl-jcsb'>
              <Input
                class='search-input'
                behavior='normal'
                placeholder={root.$t('请输入')}
                right-icon='bk-icon icon-search'
                value={searchVal.value}
                onInput={v => (searchVal.value = v)}
              ></Input>
            </div>
            <div class='search-category'>
              <div class='selector-container'>
                {['origin', 'chart'].map(type => (
                  <span
                    key={type}
                    style={{ marginRight: '4px' }}
                    class={`option ${currentCollectionType.value === type ? 'selected' : ''}`}
                    onClick={() => handleRadioGroup(type)}
                  >
                    <span class={`bklog-icon ${type === 'origin' ? 'bklog-table-2' : 'bklog-chart-2'}`}></span>
                    <span
                      style={{ marginRight: '4px' }}
                      class='search-category-text'
                    >
                      {type === 'origin' ? root.$t('原始日志') : root.$t('图表分析')}
                    </span>
                    <span class='search-category-num'>
                      {type === 'origin' ? originFavoriteCount.value : chartFavoriteCount.value}
                    </span>
                  </span>
                ))}
              </div>
            </div>
            <div class='search-tool'>
              <span>
                <bk-checkbox
                  false-value={false}
                  true-value={true}
                  value={isShowCurrentIndexList.value}
                  onChange={handleShowCurrentChange}
                >
                  {root.$t('仅查看当前索引集')}
                </bk-checkbox>
              </span>
              <div
                style={{ marginTop: '1px', cursor: 'pointer', marginLeft: '0px', width: '72px' }}
                class='fl-jcsb '
              >
                <Popover
                  ref={popoverGroupRef}
                  ext-cls='new-group-popover'
                  placement='bottom-start'
                  tippy-options={tippyOption}
                >
                  <span
                    style={{ fontSize: '16px' }}
                    class='bklog-icon bklog-xinjianwenjianjia'
                    v-bk-tooltips={root.$t('新建收藏分组')}
                  ></span>
                  <div slot='content'>
                    <Form
                      ref={checkInputFormRef}
                      style={{ width: '100%', padding: '0px 2px' }}
                      form-type='vertical'
                      model={verifyData}
                      rules={rules}
                    >
                      <FormItem
                        icon-offset={34}
                        label={root.$t('分组名称')}
                        property='groupName'
                        required
                      >
                        <Input
                          style={{ marginTop: '4px' }}
                          placeholder={root.$t('请输入')}
                          value={verifyData.groupName}
                          clearable
                          onEnter={() => handleClickGroupBtn('add')}
                          onInput={v => (verifyData.groupName = v)}
                          onKeydown={handleGroupKeyDown}
                        ></Input>
                      </FormItem>
                    </Form>
                    <div class='operate-button'>
                      <span
                        class='operate-button-custom button-first'
                        onClick={() => handleClickGroupBtn('add')}
                      >
                        {root.$t('确定')}
                      </span>
                      <span
                        class='operate-button-custom button-second'
                        onClick={() => handleClickGroupBtn('cancel')}
                      >
                        {root.$t('取消')}
                      </span>
                    </div>
                  </div>
                </Popover>
                <span
                  style={{ fontSize: '16px' }}
                  class={`bklog-icon ${!isHidden.value ? 'bklog-zhankai-2' : 'bklog-shouqi'}`}
                  v-bk-tooltips={root.$t(`${!isHidden.value ? '全部收起' : '全部展开'}`)}
                  onClick={handleGroupIsHidden}
                ></span>
                <Popover
                  ref={popoverSortRef}
                  ext-cls='sort-group-popover'
                  placement='bottom-start'
                  tippy-options={tippyOption}
                >
                  <div
                    class='icon-box'
                    v-bk-tooltips={root.$t('调整排序')}
                  >
                    <span
                      style={{ fontSize: '16px' }}
                      class='bklog-icon bklog-paixu'
                    ></span>
                  </div>
                  <div slot='content'>
                    <div style={{ padding: '0px 2px' }}>
                      <span style={{ fontSize: '14px', marginTop: '8px' }}>{root.$t('收藏名排序')}</span>
                      <RadioGroup
                        class='sort-group-container'
                        value={sortType.value}
                        onChange={v => (sortType.value = v)}
                      >
                        {groupSortList.map(item => (
                          <Radio value={item.id}>{item.name}</Radio>
                        ))}
                      </RadioGroup>
                      <div class='operate-button'>
                        <span
                          class='operate-button-custom button-first'
                          onClick={() => handleClickSortBtn('sort')}
                        >
                          {root.$t('确定')}
                        </span>
                        <span
                          class='operate-button-custom button-second'
                          onClick={() => handleClickSortBtn('cancel')}
                        >
                          {root.$t('取消')}
                        </span>
                      </div>
                    </div>
                  </div>
                </Popover>
              </div>
            </div>
          </div>
          <div
            class={['drag-border', { 'drag-ing': isChangingWidth.value }]}
            onMousedown={dragBegin}
          ></div>
        </CollectContainer>
        <FavoriteManageDialog
          modelValue={isShowManageDialog.value}
          onClose={closeShowManageDialog}
        ></FavoriteManageDialog>
        <AddCollectDialog
          activeFavoriteID={activeFavoriteID.value}
          favoriteID={editFavoriteID.value}
          favoriteList={favoriteList.value}
          value={isShowAddNewFavoriteDialog.value}
          visibleFields={props.visibleFields}
          on-change-favorite={async value => {
            await getFavoriteList();
            handleClickFavoriteItem(value);
          }}
        />
      </div>
    );
  },
});
