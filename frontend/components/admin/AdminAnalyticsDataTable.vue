<template>
  <div class="analytics-data-table-container">
    <!-- Table Header: Title, Search, CSV Export -->
    <div class="table-toolbar">
      <div class="toolbar-title-wrap">
        <h4 v-if="title" class="table-title">{{ title }}</h4>
        <p v-if="description" class="table-desc">{{ description }}</p>
      </div>

      <div class="toolbar-actions">
        <div class="search-input-wrap">
          <span class="search-icon">🔍</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search table..."
            class="search-input"
          />
        </div>
        <button v-if="exportable" type="button" class="btn-export" @click="exportTableCsv">
          <span>⬇</span> CSV
        </button>
      </div>
    </div>

    <!-- Table Element -->
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              :class="[col.align ? `align-${col.align}` : '', col.sortable !== false ? 'sortable' : '']"
              @click="col.sortable !== false ? handleSort(col.key) : null"
            >
              <div class="th-content">
                <span>{{ col.label }}</span>
                <span v-if="sortKey === col.key" class="sort-indicator">
                  {{ sortAsc ? '▲' : '▼' }}
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="paginatedRows.length === 0">
            <td :colspan="columns.length" class="empty-cell">
              No matching records found.
            </td>
          </tr>
          <tr v-for="(row, rIdx) in paginatedRows" :key="rIdx">
            <td
              v-for="col in columns"
              :key="col.key"
              :class="col.align ? `align-${col.align}` : ''"
            >
              <slot :name="col.key" :row="row" :value="row[col.key]">
                {{ formatCell(row[col.key], col.format) }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Table Pagination -->
    <div v-if="filteredRows.length > pageSize" class="table-pagination">
      <span class="pagination-info">
        Showing {{ (currentPage - 1) * pageSize + 1 }} to {{ Math.min(currentPage * pageSize, filteredRows.length) }} of {{ filteredRows.length }} entries
      </span>
      <div class="pagination-controls">
        <button
          type="button"
          class="page-btn"
          :disabled="currentPage === 1"
          @click="currentPage--"
        >
          Previous
        </button>
        <span class="page-num">Page {{ currentPage }} of {{ totalPages }}</span>
        <button
          type="button"
          class="page-btn"
          :disabled="currentPage === totalPages"
          @click="currentPage++"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

export interface TableColumn {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  format?: 'currency' | 'number' | 'percent' | 'date'
}

const props = withDefaults(
  defineProps<{
    columns: TableColumn[]
    rows: any[]
    title?: string
    description?: string
    pageSize?: number
    exportable?: boolean
  }>(),
  {
    pageSize: 10,
    exportable: true,
  }
)

const searchQuery = ref('')
const sortKey = ref('')
const sortAsc = ref(true)
const currentPage = ref(1)

function handleSort(key: string) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = true
  }
}

const filteredRows = computed(() => {
  let result = [...props.rows]

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter((row) => {
      return Object.values(row).some((val) =>
        String(val || '').toLowerCase().includes(q)
      )
    })
  }

  if (sortKey.value) {
    result.sort((a, b) => {
      const valA = a[sortKey.value]
      const valB = b[sortKey.value]
      if (valA === valB) return 0
      if (valA === null || valA === undefined) return 1
      if (valB === null || valB === undefined) return -1
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc.value ? valA - valB : valB - valA
      }
      return sortAsc.value
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA))
    })
  }

  return result
})

const totalPages = computed(() => Math.ceil(filteredRows.value.length / props.pageSize) || 1)

const paginatedRows = computed(() => {
  const start = (currentPage.value - 1) * props.pageSize
  return filteredRows.value.slice(start, start + props.pageSize)
})

function formatCell(val: any, format?: string) {
  if (val === null || val === undefined) return '-'
  if (format === 'currency') {
    return '$' + Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  if (format === 'percent') {
    return Number(val).toFixed(1) + '%'
  }
  if (format === 'number') {
    return Number(val).toLocaleString()
  }
  if (format === 'date') {
    return new Date(val).toLocaleDateString()
  }
  return val
}

function exportTableCsv() {
  if (props.rows.length === 0) return
  const headers = props.columns.map((c) => `"${c.label}"`).join(',')
  const rows = filteredRows.value.map((r) => {
    return props.columns
      .map((c) => {
        let v = r[c.key]
        if (v === null || v === undefined) v = ''
        return `"${String(v).replace(/"/g, '""')}"`
      })
      .join(',')
  })
  const csv = [headers, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `table_export_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.analytics-data-table-container {
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.table-title {
  font-size: 1rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 2px 0;
}

.table-desc {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.search-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px 10px;
}

.search-input {
  border: none;
  background: transparent;
  font-size: 0.8125rem;
  outline: none;
  width: 160px;
}

.btn-export {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.table-responsive {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.data-table th {
  background: #f8fafc;
  padding: 10px 14px;
  text-align: left;
  font-weight: 700;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
}

.data-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.th-content {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sort-indicator {
  font-size: 0.6875rem;
  color: #0d9488;
}

.data-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}

.data-table tr:hover td {
  background: #f8fafc;
}

.align-left { text-align: left; }
.align-center { text-align: center; }
.align-right { text-align: right; }

.empty-cell {
  text-align: center;
  padding: 24px !important;
  color: #94a3b8;
}

.table-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
  font-size: 0.75rem;
  color: #64748b;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-btn {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
