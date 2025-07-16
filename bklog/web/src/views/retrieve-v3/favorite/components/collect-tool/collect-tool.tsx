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

import BklogPopover from '@/components/bklog-popover';
import useLocale from '@/hooks/use-locale';

import './collect-tool.scss';

export default defineComponent({
  name: 'CollectTool',
  components: {
    BklogPopover,
  },
  props: {
    isChecked: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['width-change'],
  setup(props, { emit }) {
    const { t } = useLocale();
    const groupSortList = [
      {
        name: t('按名称 {n} 排序', { n: 'A - Z' }),
        id: 'NAME_ASC',
      },
      {
        name: t('按名称 {n} 排序', { n: 'Z - A' }),
        id: 'NAME_DESC',
      },
      {
        name: t('按更新时间排序'),
        id: 'UPDATED_AT_DESC',
      },
    ];
    const renderAddGroup = () => (
      <div class='collect-tool-add-group'>
        <div class='collect-tool-add-group-title'>
          {t('分组名称')}
          <span class='title-point'>*</span>
        </div>
        <input
          class='collect-tool-input'
          placeholder={t('请输入')}
        ></input>
        <div class='collect-tool-btn-box'>
          <span class='tool-btn-ok'>{t('确定')}</span>
          <span class='tool-btn-cancel'>{t('取消')}</span>
        </div>
      </div>
    );
    const renderSort = () => (
      <div class='collect-tool-sort-box'>
        <div class='tool-sort-title'>{t('收藏排序')}</div>
        {groupSortList.map(item => (
          <div class='tool-sort-item'>
            <input
              class='tool-sort-radio'
              name='contact'
              type='radio'
              value={item.id}
            />
            <span class='tool-sort-name'>{item.name}</span>
          </div>
        ))}
        <div class='collect-tool-btn-box'>
          <span class='tool-btn-ok'>{t('确定')}</span>
          <span class='tool-btn-cancel'>{t('取消')}</span>
        </div>
      </div>
    );

    return () => (
      <div class='collect-tool-box'>
        <span class='tool-checkbox'>
          <label class='custom-checkbox'>
            <input
              type='checkbox'
              value={props.isChecked}
            />
            <span class='check-mark'></span>
          </label>
          {t('仅查看当前索引集')}
        </span>
        <span class='tool-icon-box'>
          {/* 新建收藏分组 */}
          <BklogPopover
            options={{ placement: 'bottom-end', appendTo: document.body } as any}
            trigger='click'
            {...{
              scopedSlots: { content: renderAddGroup },
            }}
          >
            <i
              class='bklog-icon bklog-xinjianwenjianjia tool-icon'
              v-bk-tooltips={t('新建收藏分组')}
            ></i>
          </BklogPopover>
          {/* 全部收起/展开 */}
          <i
            class='bklog-icon bklog-zhankai-2 tool-icon'
            v-bk-tooltips={t('全部收起')}
          ></i>

          {/* 调整排序 */}
          <BklogPopover
            options={{ placement: 'bottom-end', appendTo: document.body } as any}
            trigger='click'
            {...{
              scopedSlots: { content: renderSort },
            }}
          >
            <i
              class='bklog-icon bklog-paixu tool-icon'
              v-bk-tooltips={t('调整排序')}
            ></i>
          </BklogPopover>
        </span>
      </div>
    );
  },
});
