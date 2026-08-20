import { useEffect, useMemo, useState } from 'react'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

/**
 * 客户端分页 hook（一期：接口返回全量列表，前端分页展示；
 * 后续数据量增长时可在列表接口加 ?page=&pageSize= 切换为服务端分页，组件接口不变）。
 *
 * @param items    全量列表
 * @param pageSize 每页条数
 * @param resetDep 该值变化时重置回第 1 页（如切换行动/筛选条件）
 */
export function usePager<T>(items: T[], pageSize = 8, resetDep?: unknown) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  // 列表缩短时收敛页码，避免停留在空页
  useEffect(() => { setPage(p => Math.min(Math.max(1, p), totalPages)) }, [totalPages])
  useEffect(() => { setPage(1) }, [resetDep])
  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  )
  return { page, setPage, totalPages, pageItems, total: items.length }
}

/** 页码序列：≤7 页全显；否则 首尾页 + 当前页±1，中间省略 */
function pageNums(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const set = new Set([1, totalPages, page - 1, page, page + 1].filter(n => n >= 1 && n <= totalPages))
  const arr = [...set].sort((a, b) => a - b)
  const out: (number | 'ellipsis')[] = []
  arr.forEach((n, i) => {
    if (i > 0 && n - arr[i - 1] > 1) out.push('ellipsis')
    out.push(n)
  })
  return out
}

/** 通用分页条：单页时不渲染 */
export function Pager({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number
  totalPages: number
  total: number
  onChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      <span className="text-[11px] text-slate-400 whitespace-nowrap">共 {total} 条 · 第 {page}/{totalPages} 页</span>
      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={(e) => { e.preventDefault(); if (page > 1) onChange(page - 1) }}
              className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
          {pageNums(page, totalPages).map((n, i) =>
            n === 'ellipsis' ? (
              <PaginationItem key={`e${i}`}><PaginationEllipsis /></PaginationItem>
            ) : (
              <PaginationItem key={n}>
                <PaginationLink
                  isActive={n === page}
                  onClick={(e) => { e.preventDefault(); onChange(n) }}
                  className="cursor-pointer"
                >
                  {n}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              onClick={(e) => { e.preventDefault(); if (page < totalPages) onChange(page + 1) }}
              className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
