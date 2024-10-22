# -*- coding: utf-8 -*-
"""
Tencent is pleased to support the open source community by making 蓝鲸智云 - 监控平台 (BlueKing - Monitor) available.
Copyright (C) 2017-2021 THL A29 Limited, a Tencent company. All rights reserved.
Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
You may obtain a copy of the License at http://opensource.org/licenses/MIT
Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
"""
import functools
from typing import Any, Callable, Dict, List, Optional

from django.db.models import Q

from apm_web.metric.constants import SeriesAliasType
from bkmonitor.data_source import dict_to_q
from bkmonitor.data_source.unify_query.builder import QueryConfigBuilder, UnifyQuerySet
from constants.apm import MetricTemporality, TRPCMetricTag

from .. import base, define


class TRPCMetricField:
    # 主调
    # 请求数
    RPC_CLIENT_HANDLED_TOTAL: str = "rpc_client_handled_total"
    # 请求时间
    RPC_CLIENT_HANDLED_SECONDS_SUM: str = "rpc_client_handled_seconds_sum"
    # 请求数
    RPC_CLIENT_HANDLED_SECONDS_COUNT: str = "rpc_client_handled_seconds_count"
    # 分桶
    RPC_CLIENT_HANDLED_SECONDS_BUCKET: str = "rpc_client_handled_seconds_bucket"

    # 被调
    # 请求数
    RPC_SERVER_HANDLED_TOTAL: str = "rpc_server_handled_total"
    # 请求时间
    RPC_SERVER_HANDLED_SECONDS_SUM: str = "rpc_server_handled_seconds_sum"
    # 请求数
    RPC_SERVER_HANDLED_SECONDS_COUNT: str = "rpc_server_handled_seconds_count"
    # 分桶
    RPC_SERVER_HANDLED_SECONDS_BUCKET: str = "rpc_server_handled_seconds_bucket"


class CodeType:
    SUCCESS: str = "success"
    TIMEOUT: str = "timeout"
    EXCEPTION: str = "exception"


class TrpcMetricGroup(base.BaseMetricGroup):

    METRIC_FIELDS: Dict[str, Dict[str, str]] = {
        SeriesAliasType.CALLER.value: {
            "rpc_handled_total": TRPCMetricField.RPC_CLIENT_HANDLED_TOTAL,
            "rpc_handled_seconds_sum": TRPCMetricField.RPC_CLIENT_HANDLED_SECONDS_SUM,
            "rpc_handled_seconds_count": TRPCMetricField.RPC_CLIENT_HANDLED_SECONDS_COUNT,
            "rpc_handled_seconds_bucket": TRPCMetricField.RPC_CLIENT_HANDLED_SECONDS_BUCKET,
        },
        SeriesAliasType.CALLEE.value: {
            "rpc_handled_total": TRPCMetricField.RPC_SERVER_HANDLED_TOTAL,
            "rpc_handled_seconds_sum": TRPCMetricField.RPC_SERVER_HANDLED_SECONDS_SUM,
            "rpc_handled_seconds_count": TRPCMetricField.RPC_SERVER_HANDLED_SECONDS_COUNT,
            "rpc_handled_seconds_bucket": TRPCMetricField.RPC_SERVER_HANDLED_SECONDS_BUCKET,
        },
    }

    def __init__(
        self,
        bk_biz_id: int,
        app_name: str,
        group_by: Optional[List[str]] = None,
        filter_dict: Optional[Dict[str, Any]] = None,
        **kwargs,
    ):
        super().__init__(bk_biz_id, app_name, group_by, filter_dict, **kwargs)
        self.kind: str = kwargs.get("kind") or SeriesAliasType.CALLER.value
        self.temporality: str = kwargs.get("temporality") or MetricTemporality.CUMULATIVE

    def handle(self, calculation_type: str, **kwargs) -> List[Dict[str, Any]]:
        return self.get_calculation_method(calculation_type)(**kwargs)

    class Meta:
        name = define.GroupEnum.TRPC

    def get_calculation_method(self, calculation_type: str) -> Callable[..., List[Dict[str, Any]]]:
        support_calculation_methods: Dict[str, Callable[..., List[Dict[str, Any]]]] = {
            define.CalculationType.REQUEST_TOTAL: self._request_total,
            define.CalculationType.SUCCESS_RATE: functools.partial(self._request_code_rate, CodeType.SUCCESS),
            define.CalculationType.TIMEOUT_RATE: functools.partial(self._request_code_rate, CodeType.TIMEOUT),
            define.CalculationType.EXCEPTION_RATE: functools.partial(self._request_code_rate, CodeType.EXCEPTION),
            define.CalculationType.AVG_DURATION: self._avg_duration,
            define.CalculationType.P50_DURATION: functools.partial(self._histogram_quantile_duration, 0.50),
            define.CalculationType.P95_DURATION: functools.partial(self._histogram_quantile_duration, 0.95),
            define.CalculationType.P99_DURATION: functools.partial(self._histogram_quantile_duration, 0.99),
            define.CalculationType.TOP_N: self._top_n,
            define.CalculationType.BOTTOM_N: self._bottom_n,
        }
        if calculation_type not in support_calculation_methods:
            raise ValueError(f"Unsupported calculation type -> {calculation_type}")
        return support_calculation_methods[calculation_type]

    def q(self, start_time: Optional[int] = None, end_time: Optional[int] = None) -> QueryConfigBuilder:
        interval: int = self.metric_helper.get_interval(start_time, end_time)
        q: QueryConfigBuilder = (
            self.metric_helper.q.interval(interval).group_by(*self.group_by).filter(dict_to_q(self.filter_dict) or Q())
        )
        if self.temporality == MetricTemporality.CUMULATIVE:
            q = q.func(_id="increase", params=[{"id": "window", "value": f"{interval}s"}])
        return q

    def _request_total_qs(self, start_time: Optional[int] = None, end_time: Optional[int] = None) -> UnifyQuerySet:
        q: QueryConfigBuilder = (
            self.q(start_time, end_time)
            .alias("a")
            .metric(field=self.METRIC_FIELDS[self.kind]["rpc_handled_total"], method="SUM", alias="a")
        )
        return self.metric_helper.time_range_qs(start_time, end_time).add_query(q).expression("a").instant()

    def _request_total(self, start_time: Optional[int] = None, end_time: Optional[int] = None) -> List[Dict[str, Any]]:
        return list(self._request_total_qs(start_time, end_time))

    def _avg_duration_qs(self, start_time: Optional[int] = None, end_time: Optional[int] = None) -> UnifyQuerySet:
        sum_q: QueryConfigBuilder = (
            self.q(start_time, end_time)
            .alias("a")
            .metric(field=self.METRIC_FIELDS[self.kind]["rpc_handled_seconds_sum"], method="SUM", alias="a")
        )
        count_q: QueryConfigBuilder = (
            self.q(start_time, end_time)
            .alias("b")
            .metric(field=self.METRIC_FIELDS[self.kind]["rpc_handled_seconds_count"], method="SUM", alias="b")
        )
        return (
            self.metric_helper.time_range_qs(start_time, end_time)
            .add_query(sum_q)
            .add_query(count_q)
            .expression("(a / b) * 1000")
            .instant()
        )

    def _avg_duration(self, start_time: Optional[int] = None, end_time: Optional[int] = None) -> List[Dict[str, Any]]:
        return list(self._avg_duration_qs(start_time, end_time))

    def _histogram_quantile_duration(
        self, scalar: float, start_time: Optional[int] = None, end_time: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        q: QueryConfigBuilder = (
            self.q(start_time, end_time)
            .group_by("le")
            .metric(field=self.METRIC_FIELDS[self.kind]["rpc_handled_seconds_bucket"], method="SUM", alias="a")
            .func(_id="histogram_quantile", params=[{"id": "scalar", "value": scalar}])
        )
        qs: UnifyQuerySet = (
            self.metric_helper.time_range_qs(start_time, end_time).add_query(q).expression("a * 1000").instant()
        )
        return list(qs)

    def _request_code_rate_qs(
        self, code_type: str, start_time: Optional[int] = None, end_time: Optional[int] = None
    ) -> UnifyQuerySet:
        if code_type == CodeType.SUCCESS:
            q: Q = Q(code_type__eq=code_type)
            expression: str = "(a / b) * 100"
        else:
            # 先计算出对立面的概率，尽可能规避等值查询 0 值会有 series 缺失的情况
            q: Q = Q(code_type__neq=code_type)
            expression: str = "(1 - a / b) * 100"

        code_q: QueryConfigBuilder = (
            self.q(start_time, end_time)
            .alias("a")
            .filter(q)
            .metric(field=self.METRIC_FIELDS[self.kind]["rpc_handled_total"], method="SUM", alias="a")
        )
        total_q: QueryConfigBuilder = (
            self.q(start_time, end_time)
            .alias("b")
            .metric(field=self.METRIC_FIELDS[self.kind]["rpc_handled_total"], method="SUM", alias="b")
        )
        return (
            self.metric_helper.time_range_qs(start_time, end_time)
            .add_query(code_q)
            .add_query(total_q)
            .expression(expression)
            .instant()
        )

    def _request_code_rate(
        self, code_type: str, start_time: Optional[int] = None, end_time: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        return list(self._request_code_rate_qs(code_type, start_time, end_time))

    def _get_qs(self, qs_type: str, start_time: Optional[int] = None, end_time: Optional[int] = None) -> UnifyQuerySet:
        return {
            define.CalculationType.REQUEST_TOTAL: self._request_total_qs,
            define.CalculationType.SUCCESS_RATE: functools.partial(self._request_code_rate_qs, CodeType.SUCCESS),
            define.CalculationType.TIMEOUT_RATE: functools.partial(self._request_code_rate_qs, CodeType.TIMEOUT),
            define.CalculationType.EXCEPTION_RATE: functools.partial(self._request_code_rate_qs, CodeType.EXCEPTION),
            define.CalculationType.AVG_DURATION: self._avg_duration_qs,
        }[qs_type](start_time, end_time)

    def _top_n(
        self, qs_type: str, limit: int, start_time: Optional[int] = None, end_time: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        return list(self._get_qs(qs_type, start_time, end_time).func(_id="topk", params=[{"value": limit}]))

    def _bottom_n(
        self, qs_type: str, limit: int, start_time: Optional[int] = None, end_time: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        return list(self._get_qs(qs_type, start_time, end_time).func(_id="bottomk", params=[{"value": limit}]))

    def fetch_server_list(self, start_time: Optional[int] = None, end_time: Optional[int] = None) -> List[str]:
        return self.metric_helper.get_field_option_values_by_groups(
            params_list=[
                {"metric_field": TRPCMetricField.RPC_CLIENT_HANDLED_TOTAL, "field": TRPCMetricTag.CALLER_SERVER},
                {"metric_field": TRPCMetricField.RPC_SERVER_HANDLED_TOTAL, "field": TRPCMetricTag.CALLEE_SERVER},
            ],
            start_time=start_time,
            end_time=end_time,
        )

    def get_server_config(
        self, server: str, start_time: Optional[int] = None, end_time: Optional[int] = None
    ) -> Dict[str, Any]:
        sdk_names: List[str] = self.metric_helper.get_field_option_values_by_groups(
            params_list=[
                {
                    "metric_field": TRPCMetricField.RPC_CLIENT_HANDLED_TOTAL,
                    "field": TRPCMetricTag.SDK_NAME,
                    "filter_dict": {f"{TRPCMetricTag.CALLER_SERVER}__eq": server},
                },
                {
                    "metric_field": TRPCMetricField.RPC_SERVER_HANDLED_TOTAL,
                    "field": TRPCMetricTag.SDK_NAME,
                    "filter_dict": {f"{TRPCMetricTag.CALLEE_SERVER}__eq": server},
                },
            ],
            start_time=start_time,
            end_time=end_time,
        )
        if sdk_names:
            return {"temporality": MetricTemporality.DELTA}
        return {"temporality": MetricTemporality.CUMULATIVE}
