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

import { computed, defineComponent, ref } from 'vue';

import useLocale from '@/hooks/use-locale';
import useStore from '@/hooks/use-store';
import { ConditionOperator } from '@/store/condition-operator';

import { IFavoriteItem, IGroupItem } from '../../type';
import { getGroupNameRules, showMessagePop } from '../../utils';
import AddGroup from './add-group';
import $http from '@/api';

import './edit-dialog.scss';

export default defineComponent({
  name: 'EditDialog',
  props: {
    isShow: {
      type: Boolean,
      default: false,
    },
    data: {
      type: Object as () => IFavoriteItem,
      default: () => ({}),
    },
    activeFavoriteID: {
      type: Number,
    },
    favoriteList: {
      type: Array as () => IGroupItem[],
      default: () => [],
    },
  },
  emits: ['cancel', 'refresh-group'],
  setup(props, { emit }) {
    const { t } = useLocale();
    const formRef = ref(null);
    const store = useStore();
    /** 当前空间id */
    const spaceUid = computed(() => store.state.spaceUid);
    const isUnionSearch = computed(() => props.data.index_set_type === 'union');
    const groupNameMap = {
      unknown: t('未分组'),
      private: t('个人收藏'),
    };

    const groupList = ref([]);
    const favoriteData = ref<IFavoriteItem>({});
    // 可见状态为公共的时候显示的收藏组
    const publicGroupList = ref([]);
    // 个人收藏 group_name替换为本人
    const privateGroupList = ref([]);
    const isClickFavoriteEdit = ref(false);
    const isDisableSelect = ref(false);
    const loading = ref(false);

    /** 获取组列表 */
    const requestGroupList = async () => {
      try {
        const res = await $http.request('favorite/getGroupList', {
          query: {
            space_uid: spaceUid.value,
          },
        });
        groupList.value = res.data.map(item => ({
          ...item,
          name: groupNameMap[item.group_type] ?? item.name,
        }));
        const len = groupList.value.length;
        publicGroupList.value = groupList.value.slice(1, len);
        privateGroupList.value = [groupList.value[0]];
      } catch (error) {}
    };

    const getAdditionValue = (addition, ipChooser) => {
      const newAddition = addition.filter(item => item.field !== '_ip-select_');
      if (JSON.stringify(ipChooser) !== '{}') {
        newAddition.push({
          field: '_ip-select_',
          operator: '',
          value: [ipChooser],
        });
      }
      return newAddition;
    };
    const showAddition = computed(() => {
      const { addition = [], ip_chooser } = props.data;
      return getAdditionValue(addition, ip_chooser);
    });
    const formatAddition = computed(() => {
      return showAddition.value
        .filter(item => {
          if (!Object.keys(item).includes('disabled')) return true;
          return !item.disabled;
        })
        .map(item => {
          const instance = new ConditionOperator(item);
          return instance.getRequestParam();
        });
    });
    const additionString = computed(() => {
      return `* AND (${formatAddition.value
        .map(({ field, operator, value }) => {
          if (field === '_ip-select_') {
            const target = value?.[0] ?? {};
            return Object.keys(target)
              .reduce((output, key) => {
                return [...output, `${key}:[${(target[key] ?? []).map(c => c.ip ?? c.objectId ?? c.id).join(' ')}]`];
              }, [])
              .join(' AND ');
          }
          return `${field} ${operator} [${value?.toString() ?? ''}]`;
        })
        .join(' AND ')})`;
    });

    const sqlString = computed(() => {
      if (props.data.search_mode === 'sql') {
        return props.data.keyword;
      }
      return additionString.value;
    });
    /** 当前选中分组的favorites */
    const currentGroupFavorite = computed(() => {
      const favorites = props.favoriteList.find(item => item.group_id === props.data.group_id)?.favorites || [];
      return favorites.filter(item => item.favorite_id !== props.data.favorite_id);
    });
    /** 分组名的规则 */
    const ruleData = computed(() => getGroupNameRules(currentGroupFavorite.value, 'name'));

    /** 根据visible_type 展示对应的分组名 */
    const showGroupList = computed(() => {
      return favoriteData.value.visible_type === 'public' ? publicGroupList.value : privateGroupList.value;
    });
    const indexItem = computed(() => store.state.indexItem);

    const handleCancel = () => {
      emit('cancel', !props.isShow);
    };
    const currentParamsValue = computed(() => {
      return isClickFavoriteEdit.value ? Object.assign({}, favoriteData.value, indexItem.value) : favoriteData.value;
    });
    /** 获取收藏详情 */
    const getFavoriteData = async (id: number) => {
      try {
        const res = await $http.request('favorite/getFavorite', { params: { id } });
        Object.assign(favoriteData.value, {
          ...res.data,
          ...res.data.params,
        });
      } catch {}
    };

    /** 修改收藏 */
    const handleUpdateFavorite = async () => {
      const {
        ip_chooser,
        addition,
        keyword,
        search_fields,
        name,
        group_id,
        display_fields,
        visible_type,
        search_mode,
        index_set_type,
        is_enable_display_fields,
        index_set_ids,
      } = currentParamsValue.value;
      const searchParams =
        search_mode === 'sql'
          ? { keyword, addition: [] }
          : { addition: (addition || []).filter(v => v.field !== '_ip-select_'), keyword: '*' };

      const data = {
        name,
        group_id,
        display_fields,
        visible_type,
        ip_chooser,
        search_fields,
        is_enable_display_fields,
        search_mode,
        index_set_type,
        ...searchParams,
      };
      if (isUnionSearch.value) {
        Object.assign(data, {
          index_set_ids,
        });
      }
      try {
        const res = await $http.request('favorite/updateFavorite', {
          params: { id: props.data.id },
          data,
        });
        if (res.result) {
          showMessagePop(t('保存成功'));
          emit('refresh-group', res.result);
          handleCancel();
        }
      } catch (error) {}
    };

    const handleSubmitFormData = () => {
      formRef.value.validate().then(() => {
        handleUpdateFavorite();
      });
    };
    /** 刷新 */
    const handleRefreshGroup = () => {
      requestGroupList();
    };
    /** 弹框value值改变时的handle */
    const handleValueChange = async (value: boolean) => {
      if (value) {
        loading.value = true;
        isClickFavoriteEdit.value = props.data.id === props.activeFavoriteID;
        await getFavoriteData(props.data.id);
        await requestGroupList();
        loading.value = false;
        isDisableSelect.value = favoriteData.value.visible_type === 'private';
      }
    };
    /** 展示的索引集，当为多索引集时，展示index_set_names字段，反之展示index_set_name */
    const indexSetName = () => {
      const { index_set_name: indexSetName, index_set_names: indexSetNames } = favoriteData.value;
      return !isUnionSearch.value ? indexSetName : (indexSetNames || []).join(',');
    };

    return () => (
      <bk-dialog
        width={640}
        ext-cls='add-collect-dialog'
        auto-close={false}
        header-position='left'
        ok-text={t('保存')}
        render-directive={'if'}
        title={t('编辑收藏')}
        value={props.isShow}
        on-cancel={handleCancel}
        on-confirm={handleSubmitFormData}
        on-value-change={handleValueChange}
      >
        <bk-form
          ref={formRef}
          v-bkloading={{ isLoading: loading.value }}
          form-type='vertical'
          {...{
            props: {
              model: favoriteData.value,
              rules: ruleData.value,
            },
          }}
        >
          <bk-form-item
            label={t('收藏名称')}
            property='name'
            required={true}
          >
            <bk-input
              value={favoriteData.value.name}
              onInput={val => (favoriteData.value.name = val)}
            ></bk-input>
          </bk-form-item>
          <bk-form-item
            label={t('所属分组')}
            required={true}
          >
            <bk-select
              clearable={false}
              disabled={isDisableSelect.value}
              searchable={true}
              value={favoriteData.value.group_id}
              onChange={val => (favoriteData.value.group_id = val)}
            >
              {showGroupList.value.map(item => (
                <bk-option
                  id={item.id}
                  key={item.id}
                  name={item.name}
                ></bk-option>
              ))}
              <div
                style={{ cursor: 'pointer' }}
                slot='extension'
              >
                <AddGroup
                  rules={ruleData.value}
                  on-submit={handleRefreshGroup}
                />
              </div>
            </bk-select>
          </bk-form-item>
          <bk-form-item label={t('索引集')}>
            <bk-input
              disabled={true}
              value={indexSetName()}
            ></bk-input>
          </bk-form-item>
          <bk-form-item label={t('查询语句')}>
            <bk-input
              disabled={true}
              type='textarea'
              value={sqlString.value}
            ></bk-input>
          </bk-form-item>
        </bk-form>
      </bk-dialog>
    );
  },
});
