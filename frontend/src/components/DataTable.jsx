import { createSignal, createEffect, createMemo } from 'solid-js';

export default function DataTable(props) {
  const [currentPage, setCurrentPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal(props.pageSize || 10);
  const [sortField, setSortField] = createSignal(props.sortField || null);
  const [sortOrder, setSortOrder] = createSignal(props.sortOrder || 'asc');
  const [searchText, setSearchText] = createSignal('');

  const columns = props.columns || [];
  const data = props.data || [];

  const searchedData = createMemo(() => {
    if (!searchText()) return data;
    const lowerSearch = searchText().toLowerCase();
    return data.filter((row) => {
      return columns.some((col) => {
        if (col.searchable === false) return false;
        const value = row[col.key];
        if (value == null) return false;
        return String(value).toLowerCase().includes(lowerSearch);
      });
    });
  });

  const sortedData = createMemo(() => {
    const dataToSort = [...searchedData()];
    if (!sortField()) return dataToSort;

    return dataToSort.sort((a, b) => {
      const aVal = a[sortField()];
      const bVal = b[sortField()];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      const col = columns.find((c) => c.key === sortField());
      const sortFunc = col?.sorter;

      let comparison;
      if (sortFunc) {
        comparison = sortFunc(aVal, bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal), 'zh-CN');
      }

      return sortOrder() === 'asc' ? comparison : -comparison;
    });
  });

  const totalPages = createMemo(() => {
    return Math.max(1, Math.ceil(sortedData().length / pageSize()));
  });

  const paginatedData = createMemo(() => {
    const start = (currentPage() - 1) * pageSize();
    const end = start + pageSize();
    return sortedData().slice(start, end);
  });

  const pageNumbers = createMemo(() => {
    const pages = [];
    const total = totalPages();
    const current = currentPage();

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      if (current <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(total);
      } else if (current >= total - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = total - 4; i <= total; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = current - 1; i <= current + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(total);
      }
    }

    return pages;
  });

  createEffect(() => {
    if (currentPage() > totalPages()) {
      setCurrentPage(totalPages());
    }
  });

  createEffect(() => {
    setCurrentPage(1);
  }, [searchText, pageSize]);

  const handleSort = (field) => {
    const col = columns.find((c) => c.key === field);
    if (col?.sortable === false) return;

    if (sortField() === field) {
      setSortOrder(sortOrder() === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderCell = (row, col) => {
    if (col.render) {
      return col.render(row[col.key], row, col);
    }
    return row[col.key];
  };

  const getSortIcon = (field) => {
    if (sortField() !== field) return '↕';
    return sortOrder() === 'asc' ? '↑' : '↓';
  };

  return (
    <div class="data-table-container" style={{ width: '100%' }}>
      {(props.searchable !== false || props.showPageSize) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {props.searchable !== false && (
            <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
              <input
                type="text"
                value={searchText()}
                onInput={(e) => setSearchText(e.target.value)}
                placeholder="搜索..."
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#667eea')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
              />
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#a0aec0',
                }}
              >
                🔍
              </span>
            </div>
          )}

          {props.showPageSize && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#4a5568' }}>
              <span>每页显示</span>
              <select
                value={pageSize()}
                onChange={(e) => setPageSize(Number(e.target.value))}
                style={{
                  padding: '6px 10px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  background: '#fff',
                }}
              >
                {[10, 20, 50, 100].map((size) => (
                  <option value={size}>{size}</option>
                ))}
              </select>
              <span>条</span>
            </div>
          )}
        </div>
      )}

      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr style={{ background: '#f7fafc' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    padding: '12px 16px',
                    textAlign: col.align || 'left',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#2d3748',
                    borderBottom: '2px solid #e2e8f0',
                    whiteSpace: 'nowrap',
                    cursor: col.sortable === false ? 'default' : 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {col.title}
                    {col.sortable !== false && (
                      <span style={{ color: '#a0aec0', fontSize: '12px' }}>
                        {getSortIcon(col.key)}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData().length > 0 ? (
              paginatedData().map((row, rowIndex) => (
                <tr
                  key={row.key || rowIndex}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f7fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => props.onRowClick && props.onRowClick(row)}
                  style={{
                    borderBottom: '1px solid #f7fafc',
                    transition: 'background 0.15s',
                    cursor: props.onRowClick ? 'pointer' : 'default',
                  }}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: '12px 16px',
                        fontSize: '14px',
                        color: '#4a5568',
                        textAlign: col.align || 'left',
                      }}
                    >
                      {renderCell(row, col)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: '#a0aec0',
                    fontSize: '14px',
                  }}
                >
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                  <div>{props.emptyText || '暂无数据'}</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {props.pagination !== false && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '16px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '14px', color: '#718096' }}>
            共 <span style={{ color: '#2d3748', fontWeight: '500' }}>{sortedData().length}</span> 条记录，
            当前第 <span style={{ color: '#2d3748', fontWeight: '500' }}>{currentPage()}</span> / {totalPages()} 页
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage() === 1}
              style={{
                padding: '6px 12px',
                border: '1px solid #e2e8f0',
                background: '#fff',
                borderRadius: '4px',
                cursor: currentPage() === 1 ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                color: currentPage() === 1 ? '#cbd5e0' : '#4a5568',
              }}
            >
              首页
            </button>
            <button
              onClick={() => setCurrentPage(currentPage() - 1)}
              disabled={currentPage() === 1}
              style={{
                padding: '6px 12px',
                border: '1px solid #e2e8f0',
                background: '#fff',
                borderRadius: '4px',
                cursor: currentPage() === 1 ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                color: currentPage() === 1 ? '#cbd5e0' : '#4a5568',
              }}
            >
              上一页
            </button>

            {pageNumbers().map((page, idx) => (
              page === '...' ? (
                <span
                  key={`ellipsis-${idx}`}
                  style={{
                    padding: '6px 8px',
                    color: '#a0aec0',
                    fontSize: '14px',
                  }}
                >
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  style={{
                    minWidth: '36px',
                    padding: '6px 12px',
                    border: '1px solid',
                    borderColor: currentPage() === page ? '#667eea' : '#e2e8f0',
                    background: currentPage() === page ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#fff',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: currentPage() === page ? '#fff' : '#4a5568',
                    fontWeight: currentPage() === page ? '500' : 'normal',
                  }}
                >
                  {page}
                </button>
              )
            ))}

            <button
              onClick={() => setCurrentPage(currentPage() + 1)}
              disabled={currentPage() === totalPages()}
              style={{
                padding: '6px 12px',
                border: '1px solid #e2e8f0',
                background: '#fff',
                borderRadius: '4px',
                cursor: currentPage() === totalPages() ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                color: currentPage() === totalPages() ? '#cbd5e0' : '#4a5568',
              }}
            >
              下一页
            </button>
            <button
              onClick={() => setCurrentPage(totalPages())}
              disabled={currentPage() === totalPages()}
              style={{
                padding: '6px 12px',
                border: '1px solid #e2e8f0',
                background: '#fff',
                borderRadius: '4px',
                cursor: currentPage() === totalPages() ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                color: currentPage() === totalPages() ? '#cbd5e0' : '#4a5568',
              }}
            >
              末页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
