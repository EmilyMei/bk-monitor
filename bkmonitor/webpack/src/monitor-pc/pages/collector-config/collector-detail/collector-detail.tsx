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
import { Component, Mixins, Provide } from 'vue-property-decorator';

import {
  collectConfigList,
  // collectInstanceStatus,
  frontendCollectConfigDetail,
} from 'monitor-api/modules/collecting';
import { collectingTargetStatus, storageStatus } from 'monitor-api/modules/datalink';
import { listUserGroup } from 'monitor-api/modules/model';
import { random } from 'monitor-common/utils';

import MonitorTab from '../../../components/monitor-tab/monitor-tab';
import authorityMixinCreate from '../../../mixins/authorityMixin';
import * as collectAuth from '../authority-map';
import { STATUS_LIST } from '../collector-host-detail/utils';
import CollectorConfiguration from './collector-configuration';
import CollectorStatusDetails from './collector-status-details';
import AlertTopic from './components/alert-topic';
import FieldDetails from './components/field-details';
import LinkStatus from './components/link-status';
import StorageState from './components/storage-state';
import { type DetailData, TCollectorAlertStage, TabEnum } from './typings/detail';

import type { IAlarmGroupList } from './components/alarm-group';
import type { Route, NavigationGuardNext } from 'vue-router';

import './collector-detail.scss';

Component.registerHooks(['beforeRouteEnter']);
@Component
export default class CollectorDetail extends Mixins(authorityMixinCreate(collectAuth)) {
  @Provide('authority') authority: Record<string, boolean> = {};
  @Provide('handleShowAuthorityDetail') handleShowAuthorityDetail;
  @Provide('authorityMap') authorityMap;

  active = TabEnum.Configuration;
  collectId = 0;

  detailData: DetailData = {
    basic_info: {},
    extend_info: {},
    metric_list: [],
    runtime_params: [],
    subscription_id: undefined,
    target_info: {},
  };

  loading = false;

  allData = {
    [TabEnum.TargetDetail]: {
      data: null,
      updateKey: random(8),
      pollingCount: 1,
      needPolling: true,
      timer: null,
      topicKey: '',
    },
    [TabEnum.StorageState]: {
      loading: false,
      data: null,
      topicKey: '',
    },
    [TabEnum.Configuration]: {
      renderKey: random(8),
    },
    [TabEnum.DataLink]: {
      topicKey: '',
    },
  };

  // 告警组
  alarmGroupList: IAlarmGroupList[] = [];
  /* 从采集列表获取当前采集数据 */
  collectConfigData = null;

  alarmGroupListLoading = false;

  public beforeRouteEnter(to: Route, from: Route, next: NavigationGuardNext) {
    const { params } = to;
    next((vm: CollectorDetail) => {
      vm.collectId = Number(params.id);
    });
  }

  created() {
    this.collectId = Number(this.$route.params.id);
    this.getCollectConfigListItem();
    this.getAlarmGroupList();
    this.getDetails();
    this.$store.commit('app/SET_NAV_ROUTE_LIST', [
      { name: this.$t('route-数据采集'), id: 'collect-config' },
      { name: this.$t('route-采集详情'), id: 'collect-config-detail' },
    ]);
    const tab = String(this.$route.query?.tab || '') as TabEnum;
    if (
      !!tab &&
      [
        TabEnum.Configuration,
        TabEnum.DataLink,
        TabEnum.FieldDetails,
        TabEnum.StorageState,
        TabEnum.TargetDetail,
      ].includes(tab)
    ) {
      this.handleTabChange(tab, true);
    }
  }

  handleTabChange(v: TabEnum, init = false) {
    this.active = v;
    if (this.active === TabEnum.TargetDetail) {
      this.getHosts(this.allData[TabEnum.TargetDetail].pollingCount);
      setTimeout(() => {
        this.allData[TabEnum.TargetDetail].topicKey = random(8);
      }, 300);
    } else if (this.active === TabEnum.StorageState) {
      this.getStorageStateData();
      this.allData[TabEnum.StorageState].topicKey = random(8);
    } else if (this.active === TabEnum.DataLink) {
      this.allData[TabEnum.DataLink].topicKey = random(8);
    }
    if (!init) {
      Object.keys(this.$route.query)?.length &&
        this.$router.replace({
          name: this.$route.name,
          query: {},
        });
    }
  }

  /**
   * @description 从采集列表接口获取采集数据
   */
  getCollectConfigListItem() {
    const params = {
      refresh_status: false,
      order: '-create_time',
      search: {
        fuzzy: this.collectId,
      },
      page: 1,
      limit: 10,
    };
    collectConfigList(params).then(data => {
      if (data.config_list?.length) {
        this.collectConfigData = data.config_list[0];
      }
    });
  }

  /**
   * @description 获取配置信息
   */
  getDetails() {
    this.loading = true;
    frontendCollectConfigDetail({ id: this.collectId })
      .then(res => {
        this.detailData = res;
        this.allData[TabEnum.Configuration].renderKey = random(8);
      })
      .finally(() => {
        this.loading = false;
      });
  }

  getStorageStateData() {
    this.allData[TabEnum.StorageState].loading = true;
    storageStatus({ collect_config_id: this.collectId })
      .then(res => {
        this.allData[TabEnum.StorageState].data = res;
      })
      .finally(() => {
        this.allData[TabEnum.StorageState].loading = false;
      });
  }

  getAlarmGroupList() {
    return listUserGroup({ exclude_detail_info: 1 })
      .then(data => {
        this.alarmGroupList = data.map(item => ({
          id: item.id,
          name: item.name,
          needDuty: item.need_duty,
          receiver:
            item?.users?.map(rec => rec.display_name).filter((item, index, arr) => arr.indexOf(item) === index) || [],
        }));
      })
      .catch(e => {
        console.log(e);
      });
  }

  getHosts(count) {
    return collectingTargetStatus({ collect_config_id: this.collectId })
      .then(data => {
        if (count !== this.allData[TabEnum.TargetDetail].pollingCount) return;
        this.allData[TabEnum.TargetDetail].data = data;
        this.allData[TabEnum.TargetDetail].needPolling = data.contents.some(item =>
          item.child.some(set => STATUS_LIST.includes(set.status))
        );
        if (!this.allData[TabEnum.TargetDetail].needPolling) {
          window.clearTimeout(this.allData[TabEnum.TargetDetail].timer);
        } else if (count === 1) {
          this.handlePolling();
        }
        this.allData[TabEnum.TargetDetail].updateKey = random(8);
      })
      .catch(() => {});
  }
  handlePolling(v = true) {
    if (v) {
      this.allData[TabEnum.TargetDetail].timer = setTimeout(() => {
        clearTimeout(this.allData[TabEnum.TargetDetail].timer);
        this.allData[TabEnum.TargetDetail].pollingCount += 1;
        this.getHosts(this.allData[TabEnum.TargetDetail].pollingCount).finally(() => {
          if (!this.allData[TabEnum.TargetDetail].needPolling) return;
          this.handlePolling();
        });
      }, 10000);
    } else {
      window.clearTimeout(this.allData[TabEnum.TargetDetail].timer);
    }
  }

  /**
   * @description 刷新采集详情状态
   */
  handleRefreshData() {
    collectingTargetStatus({ collect_config_id: this.collectId })
      .then(data => {
        this.allData[TabEnum.TargetDetail].data = data;
        this.allData[TabEnum.TargetDetail].updateKey = random(8);
      })
      .catch(() => {});
  }

  /**
   * @description 跳转到采集视图
   */
  handleToRetrieval() {
    const url = this.$router.resolve({
      name: 'collect-config-view',
      params: {
        id: this.collectConfigData.id,
        title: this.collectConfigData.name,
      },
      query: {
        name: this.collectConfigData.name,
        customQuery: JSON.stringify({
          pluginId: this.collectConfigData.plugin_id,
          bizId: this.collectConfigData.bk_biz_id,
        }),
      },
    });
    window.open(url.href);
  }

  async handleAlarmGroupListRefresh() {
    this.alarmGroupListLoading = true;
    await this.getAlarmGroupList();
    this.alarmGroupListLoading = false;
  }

  render() {
    return (
      <div
        class='collector-detail-page'
        v-bkloading={{
          isLoading: this.loading,
        }}
      >
        <MonitorTab
          active={this.active}
          on-tab-change={v => this.handleTabChange(v)}
        >
          <bk-tab-panel
            label={this.$t('配置信息')}
            name={TabEnum.Configuration}
          >
            {!!this.collectId && (
              <CollectorConfiguration
                id={this.collectId as any}
                key={this.allData[TabEnum.Configuration].renderKey}
                collectConfigData={this.collectConfigData}
                detailData={this.detailData}
                show={this.active === TabEnum.Configuration}
              />
            )}
          </bk-tab-panel>
          <bk-tab-panel
            label={this.$t('采集状态')}
            name={TabEnum.TargetDetail}
          >
            <AlertTopic
              id={this.collectId as any}
              class='mb-24'
              alarmGroupList={this.alarmGroupList}
              alarmGroupListLoading={this.alarmGroupListLoading}
              stage={TCollectorAlertStage.collecting}
              updateKey={this.allData[TabEnum.TargetDetail].topicKey}
              onAlarmGroupListRefresh={this.handleAlarmGroupListRefresh}
            />
            <CollectorStatusDetails
              data={this.allData[TabEnum.TargetDetail].data}
              updateKey={this.allData[TabEnum.TargetDetail].updateKey}
              onCanPolling={this.handlePolling}
              onRefresh={this.handleRefreshData}
            />
          </bk-tab-panel>
          <bk-tab-panel
            label={this.$t('链路状态')}
            name={TabEnum.DataLink}
          >
            <AlertTopic
              id={this.collectId as any}
              class='mb-24'
              alarmGroupList={this.alarmGroupList}
              alarmGroupListLoading={this.alarmGroupListLoading}
              stage={TCollectorAlertStage.transfer}
              updateKey={this.allData[TabEnum.DataLink].topicKey}
              onAlarmGroupListRefresh={this.handleAlarmGroupListRefresh}
            />
            <LinkStatus
              collectId={this.collectId}
              show={this.active === TabEnum.DataLink}
            />
          </bk-tab-panel>
          <bk-tab-panel
            label={this.$t('存储状态')}
            name={TabEnum.StorageState}
          >
            <AlertTopic
              id={this.collectId as any}
              class='mb-24'
              alarmGroupList={this.alarmGroupList}
              alarmGroupListLoading={this.alarmGroupListLoading}
              stage={TCollectorAlertStage.storage}
              updateKey={this.allData[TabEnum.StorageState].topicKey}
              onAlarmGroupListRefresh={this.handleAlarmGroupListRefresh}
            />
            <StorageState
              collectId={this.collectId}
              data={this.allData[TabEnum.StorageState].data}
              loading={this.allData[TabEnum.StorageState].loading}
            />
          </bk-tab-panel>
          <bk-tab-panel
            label={this.$t('指标/维度')}
            name={TabEnum.FieldDetails}
          >
            <FieldDetails detailData={this.detailData} />
          </bk-tab-panel>
          <span
            class='tab-right-tip'
            slot='setting'
          >
            <span class='icon-monitor icon-tishi' />
            <i18n path='数据采集好了，去 {0}'>
              <span
                class='link-btn'
                onClick={() => this.handleToRetrieval()}
              >
                {this.$t('查看数据')}
              </span>
            </i18n>
          </span>
        </MonitorTab>
      </div>
    );
  }
}
