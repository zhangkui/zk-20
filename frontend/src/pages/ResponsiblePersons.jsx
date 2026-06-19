import { createSignal, createEffect, onCleanup } from 'solid-js';
import api from '../services/api';
import wsClient from '../services/websocket';

function ResponsiblePersons() {
  const [persons, setPersons] = createSignal([]);
  const [buildings, setBuildings] = createSignal([]);
  const [selectedBuilding, setSelectedBuilding] = createSignal('all');
  const [showModal, setShowModal] = createSignal(false);
  const [editingPerson, setEditingPerson] = createSignal(null);
  const [showDetail, setShowDetail] = createSignal(null);
  const [formData, setFormData] = createSignal({
    name: '',
    phone: '',
    position: '',
    building_id: '',
    email: '',
    description: '',
  });

  const loadData = async () => {
    try {
      const [personsData, buildingsData] = await Promise.all([
        api.responsiblePersons.list(),
        api.buildings.list(),
      ]);
      setPersons(personsData || []);
      setBuildings(buildingsData || []);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  const filteredPersons = () => {
    if (selectedBuilding() === 'all') return persons();
    return persons().filter((p) => p.building_id?.toString() === selectedBuilding());
  };

  const getBuildingName = (buildingId) => {
    const building = buildings().find((b) => b.id?.toString() === buildingId?.toString());
    return building?.name || '未分配';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPerson()) {
        // In a real app, we would have an update endpoint
        // For now, we'll just update the local state
        setPersons((prev) =>
          prev.map((p) =>
            p.id === editingPerson().id ? { ...p, ...formData() } : p
          )
        );
      } else {
        const newPerson = await api.responsiblePersons.create(formData());
        setPersons((prev) => [newPerson, ...prev]);
      }
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('保存人员失败:', error);
    }
  };

  const handleEdit = (person) => {
    setEditingPerson(person);
    setFormData({
      name: person.name || '',
      phone: person.phone || '',
      position: person.position || '',
      building_id: person.building_id || '',
      email: person.email || '',
      description: person.description || '',
    });
    setShowModal(true);
  };

  const handleDeactivate = async (person) => {
    if (!confirm(`确定要停用 ${person.name} 吗？`)) return;
    try {
      await api.responsiblePersons.deactivate(person.id);
      setPersons((prev) =>
        prev.map((p) => (p.id === person.id ? { ...p, is_active: false } : p))
      );
    } catch (error) {
      console.error('停用人员失败:', error);
    }
  };

  const resetForm = () => {
    setEditingPerson(null);
    setFormData({
      name: '',
      phone: '',
      position: '',
      building_id: '',
      email: '',
      description: '',
    });
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getStatusClass = (isActive) => {
    return isActive !== false
      ? 'bg-green-100 text-green-800'
      : 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (isActive) => {
    return isActive !== false ? '在职' : '已停用';
  };

  createEffect(() => {
    loadData();
    wsClient.connect();
    wsClient.subscribeAll();

    onCleanup(() => {});
  });

  return (
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">责任人员归档</h1>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <span>➕</span>
          <span>新建人员</span>
        </button>
      </div>

      <div class="bg-white rounded-lg shadow mb-6">
        <div class="p-4 border-b flex flex-wrap items-center gap-4">
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium text-gray-700">按建筑筛选:</label>
            <select
              value={selectedBuilding()}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              class="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">全部建筑</option>
              {buildings().map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </select>
          </div>
          <span class="text-sm text-gray-500">
            共 {filteredPersons().length} 条记录
          </span>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden">
          <div class="p-4 border-b font-semibold">人员列表</div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">姓名</th>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">职位</th>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">联系电话</th>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">负责建筑</th>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
                  <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                {filteredPersons().length === 0 ? (
                  <tr>
                    <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                      暂无人员数据
                    </td>
                  </tr>
                ) : (
                  filteredPersons().map((person) => (
                    <tr class="hover:bg-gray-50">
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-3">
                          <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span class="text-blue-600 font-medium">
                              {person.name?.charAt(0) || '?'}
                            </span>
                          </div>
                          <span class="font-medium cursor-pointer hover:text-blue-600" onClick={() => setShowDetail(person)}>
                            {person.name}
                          </span>
                        </div>
                      </td>
                      <td class="px-4 py-3 text-gray-600">{person.position || '-'}</td>
                      <td class="px-4 py-3 text-gray-600">{person.phone || '-'}</td>
                      <td class="px-4 py-3 text-gray-600">{getBuildingName(person.building_id)}</td>
                      <td class="px-4 py-3">
                        <span
                          class={`px-2 py-1 rounded text-xs font-medium ${getStatusClass(
                            person.is_active
                          )}`}
                        >
                          {getStatusText(person.is_active)}
                        </span>
                      </td>
                      <td class="px-4 py-3">
                        <div class="flex gap-2">
                          <button
                            onClick={() => setShowDetail(person)}
                            class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            详情
                          </button>
                          <button
                            onClick={() => handleEdit(person)}
                            class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            编辑
                          </button>
                          {person.is_active !== false && (
                            <button
                              onClick={() => handleDeactivate(person)}
                              class="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              停用
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div class="space-y-6">
          <div class="bg-white rounded-lg shadow p-4">
            <h3 class="font-semibold mb-4">快速统计</h3>
            <div class="space-y-3">
              <div class="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span class="text-gray-600">总人数</span>
                <span class="text-xl font-bold text-blue-600">{persons().length}</span>
              </div>
              <div class="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span class="text-gray-600">在职人员</span>
                <span class="text-xl font-bold text-green-600">
                  {persons().filter((p) => p.is_active !== false).length}
                </span>
              </div>
              <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span class="text-gray-600">已停用</span>
                <span class="text-xl font-bold text-gray-600">
                  {persons().filter((p) => p.is_active === false).length}
                </span>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow p-4">
            <h3 class="font-semibold mb-4">按建筑分布</h3>
            <div class="space-y-2">
              {buildings().map((building) => {
                const count = persons().filter(
                  (p) => p.building_id?.toString() === building.id?.toString()
                ).length;
                const percentage = persons().length > 0 ? (count / persons().length) * 100 : 0;
                return (
                  <div key={building.id}>
                    <div class="flex justify-between text-sm mb-1">
                      <span class="text-gray-600">{building.name}</span>
                      <span class="font-medium">{count} 人</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                      <div
                        class="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showModal() && (
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div class="p-4 border-b flex items-center justify-between">
              <h2 class="text-lg font-semibold">
                {editingPerson() ? '编辑人员' : '新建人员'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                class="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} class="p-4 space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
                <input
                  type="text"
                  value={formData().name}
                  onInput={(e) => handleInputChange('name', e.target.value)}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">联系电话 *</label>
                <input
                  type="tel"
                  value={formData().phone}
                  onInput={(e) => handleInputChange('phone', e.target.value)}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">职位</label>
                <input
                  type="text"
                  value={formData().position}
                  onInput={(e) => handleInputChange('position', e.target.value)}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">负责建筑</label>
                <select
                  value={formData().building_id}
                  onChange={(e) => handleInputChange('building_id', e.target.value)}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">请选择建筑</option>
                  {buildings().map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                <input
                  type="email"
                  value={formData().email}
                  onInput={(e) => handleInputChange('email', e.target.value)}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={formData().description}
                  onInput={(e) => handleInputChange('description', e.target.value)}
                  class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                />
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  class="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingPerson() ? '保存修改' : '创建人员'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetail() && (
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div class="p-4 border-b flex items-center justify-between">
              <h2 class="text-lg font-semibold">人员档案详情</h2>
              <button
                onClick={() => setShowDetail(null)}
                class="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>
            <div class="p-6">
              <div class="flex items-center gap-4 mb-6">
                <div class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                  <span class="text-4xl font-bold text-blue-600">
                    {showDetail()?.name?.charAt(0) || '?'}
                  </span>
                </div>
                <div>
                  <h3 class="text-xl font-bold">{showDetail()?.name}</h3>
                  <p class="text-gray-500">{showDetail()?.position || '未设置职位'}</p>
                  <span
                    class={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${getStatusClass(
                      showDetail()?.is_active
                    )}`}
                  >
                    {getStatusText(showDetail()?.is_active)}
                  </span>
                </div>
              </div>

              <div class="space-y-4">
                <div class="p-4 bg-gray-50 rounded-lg">
                  <h4 class="font-medium text-gray-700 mb-3">基本信息</h4>
                  <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                      <span class="text-gray-500">联系电话</span>
                      <span>{showDetail()?.phone || '-'}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">邮箱</span>
                      <span>{showDetail()?.email || '-'}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">负责建筑</span>
                      <span>{getBuildingName(showDetail()?.building_id)}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-gray-500">创建时间</span>
                      <span>
                        {showDetail()?.created_at
                          ? new Date(showDetail().created_at).toLocaleDateString()
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {showDetail()?.description && (
                  <div class="p-4 bg-gray-50 rounded-lg">
                    <h4 class="font-medium text-gray-700 mb-2">备注</h4>
                    <p class="text-sm text-gray-600">{showDetail().description}</p>
                  </div>
                )}

                <div class="flex gap-3">
                  <button
                    onClick={() => {
                      handleEdit(showDetail());
                      setShowDetail(null);
                    }}
                    class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    编辑信息
                  </button>
                  <button
                    onClick={() => setShowDetail(null)}
                    class="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResponsiblePersons;
