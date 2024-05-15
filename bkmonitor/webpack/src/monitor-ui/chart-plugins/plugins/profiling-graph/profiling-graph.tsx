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
import { Component, Ref } from 'vue-property-decorator';
import { ofType } from 'vue-tsx-support';

import dayjs from 'dayjs';
import { CancelToken } from 'monitor-api/index';
import { query, queryServicesDetail } from 'monitor-api/modules/apm_profile';
import { Debounce, typeTools } from 'monitor-common/utils/utils';
import { handleTransformToTimestamp } from 'monitor-pc/components/time-range/utils';

import {
  BaseDataType,
  DataTypeItem,
  IQueryParams,
  PanelModel,
  ProfilingTableItem,
  TextDirectionType,
  ViewModeType,
} from '../../typings';
import { CommonSimpleChart } from '../common-simple-chart';
import ChartTitle from './chart-title/chart-title';
import FilterSelect from './filter-select/filter-select';
import FrameGraph from './flame-graph/flame-graph';
import TableGraph from './table-graph/table-graph';
import TopoGraph from './topo-graph/topo-graph';
import TrendChart from './trend-chart/trend-chart';

import './profiling-graph.scss';

interface IProfilingChartProps {
  panel: PanelModel;
}

@Component
class ProfilingChart extends CommonSimpleChart {
  @Ref() frameGraphRef: FrameGraph;

  isLoading = false;
  tableData: ProfilingTableItem[] = [];
  flameData: BaseDataType = {
    name: '',
    children: undefined,
    id: '',
  };
  unit = '';
  empty = true;
  emptyText = window.i18n.t('查无数据');
  // 视图模式
  activeMode: ViewModeType = ViewModeType.Combine;
  textDirection: TextDirectionType = TextDirectionType.Ltr;
  highlightId = -1;
  filterKeyword = '';
  topoSrc = '';
  dataTypeList: DataTypeItem[] = [];
  dataType = '';
  queryParams: IQueryParams = {};

  cancelTableFlameFn = () => {};
  cancelTopoFn = () => {};

  get flameFilterKeywords() {
    return this.filterKeyword?.trim?.().length ? [this.filterKeyword] : [];
  }

  getParams(args: Record<string, any> = {}, start_time = '', end_time = '') {
    const { app_name, service_name } = this.viewOptions as any;
    const [startTime, endTime] = handleTransformToTimestamp(this.timeRange);
    const params = {
      ...args,
      ...this.queryParams,
      app_name,
      service_name,
      start: (start_time ? dayjs.tz(start_time).unix() : startTime) * Math.pow(10, 6),
      end: (end_time ? dayjs.tz(end_time).unix() : endTime) * Math.pow(10, 6),
      data_type: this.dataType,
    };

    return params;
  }

  @Debounce(300)
  async getPanelData(start_time = '', end_time = '') {
    if (!this.dataTypeList.length) {
      await this.getServiceDetail(start_time, end_time);
      return;
    }
    this.handleQuery(start_time, end_time);
  }

  async getServiceDetail(start_time = '', end_time = '') {
    const [start, end] = handleTransformToTimestamp(this.timeRange);
    const { app_name, service_name } = this.viewOptions as any;

    await queryServicesDetail({
      start_time: start_time ? dayjs.tz(start_time).unix() : start,
      end_time: end_time ? dayjs.tz(end_time).unix() : end,
      app_name,
      service_name,
    })
      .then(res => {
        if (res?.data_types?.length) {
          this.dataTypeList = res.data_types;
          this.dataType = this.dataTypeList[0].key;
          this.queryParams = {
            app_name,
            service_name,
            data_type: this.dataType,
          };
          this.handleQuery(start_time, end_time);
        }
      })
      .catch(() => ({}));
  }
  async handleQuery(start_time = '', end_time = '') {
    this.getTableFlameData(start_time, end_time);
    if (this.queryParams.is_compared) {
      if (this.activeMode === ViewModeType.Topo) {
        this.activeMode = ViewModeType.Combine;
      }
    } else {
      this.getTopoSrc(start_time, end_time);
    }
  }
  async handleModeChange(val: ViewModeType) {
    if (val === this.activeMode) return;

    this.highlightId = -1;
    this.activeMode = val;
  }
  /** 获取表格和火焰图 */
  async getTableFlameData(start_time = '', end_time = '') {
    this.isLoading = true;
    this.highlightId = -1;
    this.cancelTableFlameFn();
    const params = this.getParams({ diagram_types: ['table', 'flamegraph'] }, start_time, end_time);
    await query(params, {
      cancelToken: new CancelToken(c => (this.cancelTableFlameFn = c)),
    })
      .then(data => {
        if (data) {
          this.unit = data.unit || '';
          this.tableData = data.table_data?.items ?? [];
          this.flameData = data.flame_data;
          this.empty = false;
        } else {
          this.empty = true;
        }
        this.isLoading = false;
      })
      .catch(e => {
        if (e.message) {
          this.isLoading = false;
        }
      });
  }
  /** 获取拓扑图 */
  async getTopoSrc(start_time = '', end_time = '') {
    this.cancelTopoFn();
    if (ViewModeType.Topo === this.activeMode) {
      this.isLoading = true;
    }
    const params = this.getParams({ diagram_types: ['callgraph'] }, start_time, end_time);
    await query(params, {
      cancelToken: new CancelToken(c => (this.cancelTopoFn = c)),
    })
      .then(data => {
        if (data) {
          this.topoSrc = data.call_graph_data || '';
        }
        this.isLoading = false;
      })
      .catch(e => {
        if (e.message) {
          this.isLoading = false;
        }
      });
  }
  handleTextDirectionChange(val: TextDirectionType) {
    this.textDirection = val;
  }
  /** 表格排序 */
  async handleSortChange() {
    // const params = this.getParams({
    //   diagram_types: ['table'],
    //   sort: sortKey
    // });
    // const data = await query(params).catch(() => false);
    // if (data) {
    //   this.highlightId = -1;
    //   this.tableData = data.table_data?.items ?? [];
    // }
    this.highlightId = -1;
  }
  handleDownload(type: string) {
    switch (type) {
      case 'png':
        this.frameGraphRef?.handleStoreImg();
        break;
      case 'pprof': {
        const params = this.getParams({ export_format: 'pprof' });
        const downloadUrl = `/apm/profile_api/query/export/?bk_biz_id=${window.bk_biz_id}${this.getUrlParamsString(
          params
        )}`;
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = downloadUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        break;
      }
      default:
        break;
    }
  }
  handleDataTypeChange(val) {
    if (this.dataType === val) return;

    this.dataType = val;
    this.queryParams.data_type = val;
    this.getPanelData();
  }
  getUrlParamsString(obj) {
    const str = Object.keys(obj)
      .reduce((ary, key) => {
        if (obj[key]) {
          ary.push(
            `${encodeURIComponent(key)}=${encodeURIComponent(
              typeTools.isObject(obj[key]) ? JSON.stringify(obj[key]) : obj[key]
            )}`
          );
        }
        return ary;
      }, [])
      .join('&');
    if (str.length) return `&${str}`;
    return '';
  }
  goLink() {
    const url = location.href.replace(location.hash, '#/trace/profiling');
    window.open(url, '_blank');
  }
  handleFiltersChange(values, key) {
    this.queryParams = {
      ...this.queryParams,
      [key === 'filter' ? 'filter_labels' : 'diff_filter_labels']: values,
    };
    this.getPanelData();
  }
  /** 对比模式 */
  handleDiffModeChange(isDiff: boolean) {
    this.queryParams = {
      ...this.queryParams,
      is_compared: isDiff,
    };
    this.getPanelData();
  }

  render() {
    return (
      <div class='profiling-retrieval-chart'>
        <FilterSelect
          appName={this.queryParams.app_name}
          serviceName={this.queryParams.service_name}
          onDiffChange={val => this.handleFiltersChange(val, 'diff')}
          onDiffModeChange={this.handleDiffModeChange}
          onFilterChange={val => this.handleFiltersChange(val, 'filter')}
        />
        <div class='profiling-retrieval-header'>
          <div class='data-type'>
            <span>{this.$t('数据类型')}</span>
            <div class='bk-button-group data-type-list'>
              {this.dataTypeList.map(item => {
                return (
                  <bk-button
                    key={item.key}
                    class={item.key === this.dataType ? 'is-selected' : ''}
                    size='small'
                    onClick={() => this.handleDataTypeChange(item.key)}
                  >
                    {item.name}
                  </bk-button>
                );
              })}
            </div>
          </div>
          <div class='link-tips'>
            <i class='icon-monitor icon-tishi'></i>
            <i18n
              class='flex-center'
              path='更多功能，请前往 {0}'
            >
              <span
                class='link-text'
                onClick={() => this.goLink()}
              >
                {this.$t('Profiling 检索')}
              </span>
            </i18n>
          </div>
        </div>
        <TrendChart queryParams={this.queryParams}></TrendChart>
        <div
          class='profiling-graph'
          v-bkloading={{ isLoading: this.isLoading }}
        >
          <ChartTitle
            activeMode={this.activeMode}
            isCompared={this.queryParams.is_compared}
            textDirection={this.textDirection}
            onDownload={this.handleDownload}
            onKeywordChange={val => (this.filterKeyword = val)}
            onModeChange={this.handleModeChange}
            onTextDirectionChange={this.handleTextDirectionChange}
          />
          {this.empty ? (
            <div class='empty-chart'>{this.emptyText}</div>
          ) : (
            <div class='profiling-graph-content'>
              {[ViewModeType.Combine, ViewModeType.Table].includes(this.activeMode) && (
                <TableGraph
                  data={this.tableData}
                  dataType={this.queryParams.data_type}
                  filterKeyword={this.filterKeyword}
                  highlightId={this.highlightId}
                  isCompared={this.queryParams.is_compared}
                  textDirection={this.textDirection}
                  unit={this.unit}
                  onSortChange={this.handleSortChange}
                  onUpdateHighlightId={id => (this.highlightId = id)}
                />
              )}
              {[ViewModeType.Combine, ViewModeType.Flame].includes(this.activeMode) && (
                <FrameGraph
                  ref='frameGraphRef'
                  appName={(this.viewOptions as any).app_name}
                  data={this.flameData}
                  filterKeywords={this.flameFilterKeywords}
                  highlightId={this.highlightId}
                  isCompared={this.queryParams.is_compared}
                  showGraphTools={false}
                  textDirection={this.textDirection}
                  onUpdateHighlightId={id => (this.highlightId = id)}
                />
              )}
              {ViewModeType.Topo === this.activeMode && <TopoGraph topoSrc={this.topoSrc} />}
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default ofType<IProfilingChartProps>().convert(ProfilingChart);
