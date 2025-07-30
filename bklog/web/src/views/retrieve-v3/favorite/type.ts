// 收藏项类型
export interface IFavoriteItem {
  id?: number;
  created_by?: string;
  space_uid?: number;
  index_set_id?: number;
  name?: string;
  group_id?: number;
  visible_type?: 'private' | 'public' | 'unknown';
  params?: IParams;
  is_active?: boolean;
  is_actives?: boolean[];
  index_set_names?: string[];
  index_set_ids?: string[]; // union 类型时
  display_fields: string[];
  index_set_type?: 'single' | 'union';
  favorite_type?: string; // 'search' | 'chart'
  updated_by?: string;
  created_at?: string;
  [key: string]: any;
}

export interface IParams {
  addition: { field: string; operator: string; value: number[] }[];
  chart_params: any;
  ip_chooser: any;
  keyword: string;
  search_fields: any[];
}

// 收藏分组类型
export interface IGroupItem {
  group_id: number | string;
  group_name: string;
  group_type?: 'private' | 'public' | 'unknown' | string;
  favorites: IFavoriteItem[];
}

// Tab 列表项类型
export interface ITabItem {
  name: string;
  icon: string;
  key: string;
  count: number;
}

// 工具栏规则类型
export type IGroupNameRules = Record<
  string,
  Array<{
    validator?: (val: any) => boolean;
    message: string;
    trigger: string;
    required?: boolean;
    max?: number;
  }>
>;

// CollectList 组件 props
export interface ICollectListProps {
  list: IGroupItem[];
  loading: boolean;
  isCollapse: boolean;
}

// CollectTool 组件 props
export interface ICollectToolProps {
  isChecked: boolean;
  collapseAll: boolean;
  rules: IGroupNameRules;
}

export interface IMenuItem {
  key: string;
  label: string;
}
