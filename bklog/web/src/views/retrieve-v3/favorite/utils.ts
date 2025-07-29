import $http from '@/api';
const checkName = val => {
  if (val.trim() === '') return true;
  return /^[\u4e00-\u9fa5_a-zA-Z0-9`~!@#$%^&*()_\-+=<>?:"\s{}|,.\/;'\\[\]·~！@#￥%……&*（）——\-+={}|《》？：“”【】、；‘'，。、]+$/im.test(
    val.trim(),
  );
};
const checkExistName = (filterDataList, val, key) => {
  return !filterDataList.some(item => item[key] === val);
};
/** 获取分组名的规则 */
export const getGroupNameRules = (filterDataList, key = 'group_name') => {
  return {
    [key]: [
      {
        validator: val => checkName(val),
        message: window.$t('{n}不规范, 包含特殊符号', { n: window.$t('组名') }),
        trigger: 'blur',
      },
      {
        validator: val => checkExistName(filterDataList, val, key),
        message: window.$t('组名重复'),
        trigger: 'blur',
      },
      {
        required: true,
        message: window.$t('必填项'),
        trigger: 'blur',
      },
      {
        max: 30,
        message: window.$t('不能多于{n}个字符', { n: 30 }),
        trigger: 'blur',
      },
    ],
  };
};

/* 显示消息 */
export const showMessagePop = (message, theme = 'success') => {
  window.mainComponent?.$bkMessage({ message, theme });
};

/** 修改/新增分组名 */
export const handleUpdateGroupName = async (groupObj, spaceUid, isCreate = true) => {
  const { group_id, group_new_name } = groupObj;
  const params = { group_id };
  const data = { name: group_new_name, space_uid: spaceUid };
  const requestStr = isCreate ? 'createGroup' : 'updateGroupName';
  await $http.request(`favorite/${requestStr}`, { params, data }).then(() => {
    showMessagePop(window.$t('操作成功'));
  });
};
