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

import { defineComponent, ref, watch, computed } from 'vue';

import BklogPopover from '@/components/bklog-popover';
import useLocale from '@/hooks/use-locale';
import useStore from '@/hooks/use-store';
import { RetrieveUrlResolver } from '@/store/url-resolver';
import { useRouter } from 'vue-router/composables';

import { copyMessage, utcFormatDate } from '../../../../../common/util';
import { IFavoriteItem, IGroupItem, IMenuItem } from '../../type';
import { getGroupNameRules, showMessagePop } from '../../utils';
import AddGroup from './add-group';
import EditDialog from './edit-dialog';
import $http from '@/api';

import './collect-list.scss';

export default defineComponent({
  name: 'CollectList',
  props: {
    list: {
      type: Array as () => IGroupItem[],
      default: () => [],
    },
    loading: {
      type: Boolean,
      default: false,
    },
    isCollapse: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['refresh', 'select-item'],
  setup(props, { emit }) {
    const { t } = useLocale();
    const router = useRouter();
    const store = useStore();
    const expandedMap = ref({});
    /** 当前选中的收藏 */
    const selectedId = ref(null);
    const unknownGroupID = ref(0);
    const privateGroupID = ref(0);
    const deleteRefMap = ref({});
    const currentFavorite = ref();
    const listMenuPopoverMap = ref({});
    /** 删除操作相关key list */
    const deleteKey = ['dismiss-group', 'delete'];
    const childMenu = ref([
      {
        key: 'share',
        label: t('分享'),
      },
      {
        key: 'edit',
        label: t('编辑'),
      },
      {
        key: 'create-copy',
        label: t('克隆'),
      },
      {
        key: 'move-group',
        label: t('移动至分组'),
      },
      {
        key: 'remove-group',
        label: t('从该组移除'),
      },
      {
        key: 'new-link',
        label: t('新开标签页'),
      },
      {
        key: 'delete',
        label: t('删除'),
      },
    ]);
    const groupMenu = ref([
      {
        key: 'reset-group-name',
        label: t('重命名'),
      },
      {
        key: 'dismiss-group',
        label: t('解散分组'),
      },
    ]);

    const delTxtConfig = {
      delete: {
        label: t('删除'),
        tips: t('删除后，无法恢复，请谨慎操作。'),
        title: t('确认删除该收藏项？'),
        nameKey: 'name',
        idKey: 'id',
      },
      'dismiss-group': {
        label: t('解散'),
        tips: t('解散后，该分组下的收藏项将统一挪动至[未分组]，请谨慎操作！'),
        title: t('确认解散该分组？'),
        nameKey: 'group_name',
        idKey: 'group_id',
      },
    };
    const isShowEdit = ref(false);
    // 用户信息
    const userMeta = computed(() => store.state.userMeta);
    // 去掉个人收藏的组列表
    const unPrivateGroupList = computed(() => props.list.filter(g => g.group_type !== 'private'));
    // 根据用户名判断是否时自己创建的收藏 若不是自己的则去除个人收藏选项
    const showGroupList = item => {
      return userMeta.value.username !== item.created_by ? unPrivateGroupList.value : props.list;
    };
    /** 分组名校验规则 */
    const ruleData = computed(() => getGroupNameRules(props.list));
    /** 是否展示失效 */
    const isFailFavorite = item => {
      return item.index_set_type === 'single' ? !item.is_active : !item.is_actives.every(Boolean);
    };

    /** 是否是多索引集 */
    const isMultiIndex = item => item.index_set_type === 'union';

    /** 展开所有 */
    const handleCollapse = () => {
      const map = {};
      props.list.forEach(item => {
        map[item.group_id] = true;
      });
      expandedMap.value = map;
    };
    /** 选中某个节点 */
    const handleSelectItem = (item: IFavoriteItem) => {
      if (!isFailFavorite(item)) {
        selectedId.value = item.id;
        emit('select-item', item);
      }
    };
    // 初始化全部展开
    watch(
      () => props.list,
      () => {
        handleCollapse();
      },
      { deep: true, immediate: true },
    );
    // 是否展开/收起所有
    watch(
      () => props.isCollapse,
      value => {
        if (value) {
          handleCollapse();
        } else {
          expandedMap.value = {};
        }
      },
    );

    // 切换展开/收起
    const handleToggleExpand = (groupId: number) => {
      expandedMap.value[groupId] = !expandedMap.value[groupId];
      expandedMap.value = { ...expandedMap.value };
    };

    const showIcon = (item: IGroupItem) => {
      return expandedMap.value[item.group_id] ? 'folder-fill' : 'file-close';
    };
    /** 修改分组 */
    const handleUpdateFavorite = async (item: IFavoriteItem, tips: string) => {
      const { params, name, group_id, display_fields, visible_type, id, index_set_id, index_set_ids, index_set_type } =
        item;
      const { ip_chooser, addition, keyword, search_fields } = params;
      const data = {
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
        Object.assign(data, {
          index_set_ids,
        });
      } else {
        Object.assign(data, {
          index_set_id,
        });
      }
      await $http
        .request('favorite/updateFavorite', {
          params: { id },
          data,
        })
        .then(() => {
          showMessagePop(tips);
        })
        .catch(err => {
          console.log(err, 'err');
        });
    };

    /** 删除收藏 */
    const deleteFavorite = async (favorite_id: number) => {
      await $http
        .request('favorite/deleteFavorite', {
          params: { favorite_id },
        })
        .then(() => {
          // deleteRefMap.value[favorite_id]?.hide();
          listMenuPopoverMap.value[favorite_id]?.hide();
          showMessagePop(t('删除成功'));
        })
        .catch(err => {
          console.log(err, 'err');
        });
    };
    /** 删除分组 */
    const deleteGroup = async (group_id: number) => {
      await $http
        .request('favorite/deleteGroup', {
          params: { group_id },
        })
        .then(() => {
          // deleteRefMap.value[group_id]?.hide();
          listMenuPopoverMap.value[group_id]?.hide();
          showMessagePop(t('该分组已成功解散，相关收藏项已移动到 [未分组]。'));
        })
        .catch(err => {
          console.log(err, 'err');
        });
    };
    const handleCreateCopy = (item: IFavoriteItem) => {
      const {
        index_set_id,
        params,
        name,
        group_id,
        display_fields,
        visible_type,
        is_enable_display_fields,
        index_set_type,
        index_set_ids,
        space_uid,
      } = item;
      const { host_scopes, addition, keyword, search_fields } = params;
      const data = {
        name: `${name} ${t('副本')}`,
        group_id,
        display_fields,
        visible_type,
        host_scopes,
        addition,
        keyword,
        search_fields,
        is_enable_display_fields,
        index_set_id,
        index_set_type,
        space_uid,
      };
      if (isMultiIndex(item)) {
        Object.assign(data, {
          index_set_ids,
        });
      }
      $http
        .request('favorite/createFavorite', { data })
        .then(() => {
          showMessagePop(t('创建成功'));
          handleRefreshMenu(item);
        })
        .catch(err => {
          console.log(err);
        });
    };
    /** 刷新列表并关闭menu */
    const handleRefreshMenu = (item: IFavoriteItem, isGroup = false) => {
      listMenuPopoverMap.value[isGroup ? item.group_id : item.id]?.hide();
      emit('refresh');
    };
    const handleMenuClick = (type: string, item: IFavoriteItem) => {
      console.log(item, type);
      switch (type) {
        case 'reset-group-name':
          handleRefreshMenu(item, true);
          break;
        case 'create-copy':
          handleCreateCopy(item);
          break;
        case 'edit': // 编辑分组
          currentFavorite.value = item;
          isShowEdit.value = true;
          break;
        case 'dismiss-group': // 解散分组
          deleteGroup(item.group_id).then(() => {
            handleRefreshMenu(item, true);
          });
          break;
        case 'delete': // 删除收藏
          deleteFavorite(item.id).then(() => {
            handleRefreshMenu(item);
          });
          break;
        case 'move-group': // 移动分组
          const visible_type = item.group_id === privateGroupID.value ? 'private' : 'public';
          Object.assign(item, { visible_type });
          handleUpdateFavorite(item, t('收藏项移动成功。')).then(() => {
            handleRefreshMenu(item);
          });
          break;
        case 'remove-group': // 从组中移除收藏（移动至未分组）
          Object.assign(item, {
            visible_type: 'public',
            group_id: unknownGroupID.value,
          });
          handleUpdateFavorite(item, t('收藏项已移动到 [未分组]。')).then(() => {
            handleRefreshMenu(item);
          });
          break;
        /** 分享/新标签页 */
        case 'share':
        case 'new-link':
          {
            const params = { indexId: item.index_set_id };
            const resolver = new RetrieveUrlResolver({
              ...item.params,
              addition: item.params.addition,
              search_mode: item.search_mode,
              spaceUid: item.space_uid,
              unionList: item.index_set_ids.map((item: string) => String(item)),
              isUnionIndex: item.index_set_type === 'union',
            });

            const routeData = {
              name: 'retrieve',
              params,
              query: resolver.resolveParamsToUrl(),
            };

            let shareUrl = (window as any).SITE_URL;
            if (!shareUrl.startsWith('/')) shareUrl = `/${shareUrl}`;
            if (!shareUrl.endsWith('/')) shareUrl += '/';

            shareUrl = `${window.location.origin + shareUrl}${router.resolve(routeData).href}`;
            if (type === 'new-link') {
              window.open(shareUrl, '_blank');
            } else {
              copyMessage(shareUrl, t('复制分享链接成功，通过链接，可直接查询对应收藏日志。'));
            }
          }
          break;
      }
    };
    /** 操作菜单默认显示的Item */
    const defaultItem = (menu: IMenuItem, item: IFavoriteItem, isPoint = false) => (
      <span
        key={menu.key}
        class={`menu-popover-item ${isPoint && menu.key !== 'reset-group-name' ? 'delete' : ''}`}
        onClick={() => {
          !isPoint && handleMenuClick(menu.key, item);
        }}
      >
        {menu.label}
        {menu.key === 'move-group' && <span class='bk-icon icon-angle-right move-icon'></span>}
      </span>
    );
    /** 操作菜单删除类显示的Item */
    const delRender = (type: string, item: IFavoriteItem) => {
      return (
        <div class='menu-delete-item-popover'>
          <div class='menu-delete-item-title'>{delTxtConfig[type].title}</div>
          <div class='menu-delete-item-content'>
            {t('分组名称')}：{item[delTxtConfig[type].nameKey]}
          </div>
          <div class='menu-delete-item-content'>{delTxtConfig[type].tips}</div>
          <div class='menu-delete-item-btns'>
            <bk-button
              size='small'
              theme='danger'
              onClick={() => handleMenuClick(type, item)}
            >
              {delTxtConfig[type].label}
            </bk-button>
            <bk-button
              class='ml8'
              size='small'
              onClick={() => {
                listMenuPopoverMap.value[item[delTxtConfig[type].idKey]]?.hide();
              }}
            >
              {t('取消')}
            </bk-button>
          </div>
        </div>
      );
    };

    /** 移动至分组Render */
    const moveGroupRender = (item: IFavoriteItem) => (
      <div class='menu-move-group-popover'>
        <div class='move-group-list'>
          {showGroupList(item)
            .filter(group => group.group_id !== item.group_id)
            .map(group => (
              <div
                class='list-item'
                onClick={() => {
                  const newItem = { ...item };
                  newItem.group_id = group.group_id;
                  handleMenuClick('move-group', newItem);
                }}
              >
                {group.group_name}
              </div>
            ))}
        </div>
        <div class='move-group-add'>
          <AddGroup
            rules={ruleData.value}
            on-submit={() => handleRefreshMenu(item)}
          />
        </div>
      </div>
    );
    /** 操作下拉操作渲染 */
    const renderMenu = (list: IMenuItem[], item: IFavoriteItem, isChild = true) => {
      const isDataExist = isChild && isFailFavorite(item);
      /** 数据源不存在的情况下，只支持删除操作 */
      const showList = isDataExist ? list.filter(item => item.key === 'delete') : list;
      return (
        <div class='collect-list-menu-popover'>
          {showList.map(menu => {
            /** 删除类的操作 */
            if (deleteKey.includes(menu.key)) {
              return (
                <BklogPopover
                  ref={el => (deleteRefMap.value[item[delTxtConfig[menu.key].idKey]] = el)}
                  options={{ placement: 'bottom' } as any}
                  trigger='click'
                  {...{
                    scopedSlots: { content: () => delRender(menu.key, item) },
                  }}
                >
                  {defaultItem(menu, item, true)}
                </BklogPopover>
              );
            }
            /** 移动到分组 */
            if (menu.key === 'move-group') {
              return (
                <BklogPopover
                  options={{ offset: [0, 1], placement: 'right', arrow: false } as any}
                  trigger='hover'
                  {...{
                    scopedSlots: { content: () => moveGroupRender(item) },
                  }}
                >
                  {defaultItem(menu, item)}
                </BklogPopover>
              );
            }
            if (menu.key === 'reset-group-name') {
              return (
                <BklogPopover
                  options={{ placement: 'bottom', always: true } as any}
                  trigger='click'
                  {...{
                    scopedSlots: {
                      content: () => (
                        <div class='popover-add-group-box'>
                          <AddGroup
                            data={item}
                            isCreate={false}
                            isFormType={true}
                            rules={ruleData.value}
                            on-cancel={item => {
                              listMenuPopoverMap.value[item.group_id]?.hide();
                            }}
                            on-submit={() => handleMenuClick(menu.key, item)}
                          />
                        </div>
                      ),
                    },
                  }}
                >
                  {defaultItem(menu, item, true)}
                </BklogPopover>
              );
            }
            return defaultItem(menu, item);
          })}
        </div>
      );
    };

    const renderTips = (item: IFavoriteItem) => {
      const tipsData = [
        {
          title: t('创建人'),
          value: item.created_by,
        },
        {
          title: t('更新人'),
          value: item.updated_by,
        },
        {
          title: t('创建时间'),
          value: utcFormatDate(item.created_at),
        },
      ];

      return (
        <div class='collect-list-child-tips'>
          {isMultiIndex(item) && (
            <div class='no-data-item'>
              <span class='bk-icon icon-panels item-icon blue-icon'></span>
              {t('多索引集')}
            </div>
          )}
          {isFailFavorite(item) && (
            <div class='no-data-item'>
              <span class='bklog-icon bklog-shixiao item-icon'></span>
              {t('数据源不存在')}
            </div>
          )}
          {tipsData.map((tips, ind) => (
            <div
              key={ind}
              class='tips-item'
            >
              {`${tips.title}：${tips.value || '--'}`}
            </div>
          ))}
        </div>
      );
    };

    return () => (
      <div
        class='collect-list-box'
        v-bkloading={{ isLoading: props.loading }}
      >
        {props.list.map(item => (
          <div
            key={item.group_id}
            class='collect-list-item'
          >
            <div
              style='cursor:pointer;'
              class='collect-list-item-main'
              onClick={() => handleToggleExpand(item.group_id)}
            >
              <span
                class={`bklog-icon item-icon bklog-${item.group_type === 'private' ? 'file-personal' : showIcon(item)}`}
              ></span>
              <span class='item-name'>{item.group_name}</span>
              <span
                class={[
                  'item-count',
                  {
                    'is-private': item.group_type !== 'public',
                  },
                ]}
              >
                {(item.favorites || []).length}
              </span>
              {item.group_type === 'public' && (
                <BklogPopover
                  ref={el => (listMenuPopoverMap.value[item.group_id] = el)}
                  options={{ offset: [50, 5], placement: 'bottom-end', appendTo: document.body, arrow: false } as any}
                  trigger='hover'
                  {...{
                    scopedSlots: { content: () => renderMenu(groupMenu.value, item, false) },
                  }}
                >
                  <span class='bklog-icon bklog-more icon-more'></span>
                </BklogPopover>
              )}
            </div>
            {(item.favorites || []).length > 0 && expandedMap.value[item.group_id] && (
              <div class='collect-list-item-child'>
                {item.favorites.map(child => (
                  <div
                    class={[
                      'child-item',
                      { 'is-active': child.id === selectedId.value },
                      { 'is-disabled': isFailFavorite(child) },
                    ]}
                    onClick={() => handleSelectItem(child)}
                  >
                    <BklogPopover
                      class='child-item-name'
                      options={{ placement: 'top', appendTo: document.body, theme: 'dark' } as any}
                      trigger='hover'
                      {...{
                        scopedSlots: { content: () => renderTips(child) },
                      }}
                    >
                      <span class='child-name'>{child.name}</span>
                      {isFailFavorite(child) && <span class='bklog-icon bklog-shixiao child-icon'></span>}
                      {isMultiIndex(child) && <span class='bk-icon icon-panels blue-icon'></span>}
                    </BklogPopover>

                    {/* 数据源不存在 */}
                    <BklogPopover
                      ref={el => (listMenuPopoverMap.value[child.id] = el)}
                      options={
                        { offset: [50, 5], placement: 'bottom-end', appendTo: document.body, arrow: false } as any
                      }
                      trigger='hover'
                      {...{
                        scopedSlots: { content: () => renderMenu(childMenu.value, child) },
                      }}
                    >
                      <span class='bklog-icon bklog-more icon-more'></span>
                    </BklogPopover>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <EditDialog
          activeFavoriteID={selectedId.value}
          data={currentFavorite.value}
          favoriteList={props.list}
          isShow={isShowEdit.value}
          on-cancel={(val: boolean) => (isShowEdit.value = val)}
          on-refresh-group={() => {
            emit('refresh');
          }}
        />
      </div>
    );
  },
});
