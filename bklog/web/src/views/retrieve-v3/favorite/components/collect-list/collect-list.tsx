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

import { defineComponent } from 'vue';

import useLocale from '@/hooks/use-locale';
import useStore from '@/hooks/use-store';

import './collect-list.scss';

export default defineComponent({
  name: 'CollectList',
  props: {
    list: {
      type: Array,
      default: () => [],
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['width-change'],
  setup(props, { emit }) {
    const { t } = useLocale();
    const store = useStore();
    /** 是否展示失效 */
    const isFailFavorite = item => {
      return item.index_set_type === 'single' ? !item.is_active : !item.is_actives.every(Boolean);
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
            <div class='collect-list-item-main'>
              <span
                class={`bklog-icon item-icon bklog-${item.group_type === 'private' ? 'file-personal' : 'file-close'}`}
              ></span>
              {/* <span
              class={`bklog-icon item-iconbklog-${item.group_type === 'private' ? 'file-personal' : this.isHiddenList ? 'file-close' : 'folder-fill'}`}
            ></span> */}
              <span class='item-name'>{item.group_name}</span>
              <span class='item-count'>{(item.favorites || []).length}</span>
              <span class='bklog-icon bklog-more icon-more'></span>
            </div>
            {(item.favorites || []).length > 0 && (
              <div class='collect-list-item-child'>
                {item.favorites.map(child => (
                  <div class='child-item'>
                    <span class='child-name'>{child.name}</span>
                    {/* 数据源不存在 */}
                    {isFailFavorite(child) && <span class='bklog-icon bklog-shixiao child-icon'></span>}
                    <span class='bklog-icon bklog-more icon-more'></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  },
});
