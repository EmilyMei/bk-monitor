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
export const IndexSetQueryResult = {
  is_loading: false,
  aggregations: {},
  _shards: {},
  total: 0,
  took: 0,
  list: [],
  origin_log_list: [],
  aggs: {},
  fields: [],
};

export const IndexFieldInfo = {
  fields: [],
  display_fields: [],
  sort_list: [],
  time_field: '',
  time_field_type: '',
  time_field_unit: '',
  config: [],
  config_id: 0,
};

export const IndexsetItemParams = {
  keyword: '*',
  host_scopes: { modules: [], ips: '', target_nodes: [], target_node_type: '' },
  ip_chooser: {},
  addition: [],
  begin: 0,
  size: 50,
  interval: '1d',
  timezone: 'Asia/Shanghai',
};

export const IndexItem = {
  start_time: 'now-15m',
  end_time: 'now',
  ids: [],
  isUnionIndex: false,
  items: [],
  catchUnionBeginList: [],
  selectIsUnionSearch: false,
  ...IndexsetItemParams,
};
