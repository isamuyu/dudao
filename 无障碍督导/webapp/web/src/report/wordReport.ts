import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IRunOptions,
} from 'docx'
import { fileUrl } from '@/api/client'
import type { Issue, TaskDetail } from '@/api/types'
import { buildFacilityRowsFrom, facilityNameFrom, LEVEL_META, SUBTYPE_MAP, type ChecklibPayload } from '@/data/checklib'

/** 仿政府公文样式：标题黑体红色居中 + 红色分隔线；正文宋体小四、首行缩进 */
const RED = '9C1F1F'
const SONG = '宋体'
const HEI = '黑体'

const tr = (text: string, opts: IRunOptions = {}) =>
  new TextRun({ text, font: { ascii: 'Times New Roman', eastAsia: SONG }, size: 24, ...opts })

/** 一级标题：一、xxx（黑体三号） */
const h1 = (text: string) =>
  new Paragraph({ children: [tr(text, { font: { ascii: 'Times New Roman', eastAsia: HEI }, size: 32, bold: true })], spacing: { before: 240, after: 120 } })
/** 二级标题（黑体四号加粗） */
const h2 = (text: string) =>
  new Paragraph({ children: [tr(text, { font: { ascii: 'Times New Roman', eastAsia: HEI }, size: 28, bold: true })], spacing: { before: 160, after: 80 } })
/** 正文段落（宋体小四，首行缩进 2 字符） */
const p = (text: string, indent = true) =>
  new Paragraph({ children: [tr(text)], indent: indent ? { firstLine: 480 } : undefined, spacing: { after: 60 } })
/** 表格单元格 */
const cell = (text: string, opts: IRunOptions = {}, width?: number) =>
  new TableCell({
    children: [new Paragraph({ children: [tr(text, opts)] })],
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
  })
const table = (header: string[], rows: string[][], widths: number[]) =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: header.map((h, i) => cell(h, { bold: true }, widths[i])), tableHeader: true }),
      ...rows.map(r => new TableRow({ children: r.map((c, i) => cell(c, {}, widths[i])) })),
    ],
  })

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('zh-CN', { hour12: false }) : '—')
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('zh-CN') : '—')
const COLLECT_LABEL: Record<string, string> = {
  ok: '允许督导', no_enter: '无法督导-不允许进入', closed: '无法督导-关闭',
  construct: '无法督导-施工', occupied: '无法督导-被占用', missing: '无法督导-不存在', damaged: '无法督导-损坏',
}
const SEV_LABEL: Record<string, string> = { M: '违反强制性条文', C: '一般问题', R: '建议改进' }
const ISSUE_STATUS: Record<string, string> = { open: '待立案', deferred: '暂不立案', assigned: '已派单', fixing: '整改中', recheck: '待复查', closed: '已闭环' }

/** 拉取照片并转为 ImageRun 段落（居中，限宽 360px，保持纵横比） */
async function imageParagraphs(ids: string[], caption: string): Promise<Paragraph[]> {
  const out: Paragraph[] = []
  for (const [i, id] of ids.entries()) {
    try {
      const resp = await fetch(fileUrl(id))
      const blob = await resp.blob()
      const bmp = await createImageBitmap(blob)
      const width = Math.min(360, bmp.width)
      const height = Math.round((bmp.height / bmp.width) * width)
      const type = blob.type.includes('png') ? 'png' : blob.type.includes('gif') ? 'gif' : blob.type.includes('bmp') ? 'bmp' : 'jpg'
      out.push(new Paragraph({
        children: [new ImageRun({ type, data: new Uint8Array(await blob.arrayBuffer()), transformation: { width, height } })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 120 },
      }))
      out.push(new Paragraph({
        children: [tr(`${caption} ${i + 1}`, { size: 18, color: '666666' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }))
    } catch {
      out.push(p(`（照片加载失败：${id}）`, false))
    }
  }
  return out
}

/** 生成并下载督导报告 Word 文档（图文并茂，不含任务日志） */
export async function exportInspectionWord(d: TaskDetail, orgName?: string, lib?: ChecklibPayload): Promise<void> {
  const fname = (id: string) => facilityNameFrom(lib, id)
  const { task, point, inspections, issues, contacts } = d
  const st = SUBTYPE_MAP[point.subtypeId]
  const sortedInsps = [...inspections].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
  const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  const secNo = (i: number) => CN[i] ?? `（${i + 1}）`
  const children: (Paragraph | Table)[] = []

  /* ===== 红头标题 ===== */
  children.push(new Paragraph({
    children: [tr('无障碍设施督导报告', { font: { ascii: 'Times New Roman', eastAsia: HEI }, size: 44, bold: true, color: RED })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
  }))
  children.push(new Paragraph({
    children: [tr(`（${task.title}）`, { size: 24, color: RED })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 16, color: RED, space: 4 } },
  }))

  /* ===== 报告信息表 ===== */
  const reviewers = (contacts?.reviewers ?? []).map(r => `${r.name}（${r.phone}）`).join('；') || '—'
  const insp0 = sortedInsps[0]
  children.push(table(
    ['项目', '内容'],
    [
      ['督导对象', `${point.name}${st?.star ? '（★重点配置对象）' : ''}`],
      ['对象类别', `${point.kind === 'road' ? '道路线段' : st?.name ?? point.subtypeId} · ${point.nature}`],
      ['地址', point.address || '—'],
      ['责任单位及联系方式', `${point.owner || '—'}（${point.contact || '—'}）`],
      ['督导人员及联系方式', contacts?.inspector ? `${contacts.inspector.name}（${contacts.inspector.phone}）` : (insp0 ? `${insp0.inspectorName}（联系电话详询督导单位）` : '—')],
      ['评审人员及联系方式', reviewers],
      ['督导时间', insp0 ? `${fmt(sortedInsps[0].submittedAt)}${sortedInsps.length > 1 ? ` 至 ${fmt(sortedInsps[sortedInsps.length - 1].submittedAt)}（共 ${sortedInsps.length} 次现场督导）` : ''}` : '—'],
      ['督导依据', 'GB 55019-2021《建筑与市政工程无障碍通用规范》、GB 50763-2012《无障碍设计规范》'],
    ],
    [22, 78],
  ))

  /* ===== 各次现场督导情况 ===== */
  let totalItems = 0
  let totalPass = 0
  for (const [idx, insp] of sortedInsps.entries()) {
    const rows = buildFacilityRowsFrom(lib, point.subtypeId)
    const rowOf = Object.fromEntries(rows.map(r => [r.facility, r]))
    children.push(h1(`${secNo(idx)}、${sortedInsps.length > 1 ? `第${idx + 1}次` : ''}现场督导情况（${fmt(insp.submittedAt)}）`))

    children.push(p(`督导人员：${insp.inspectorName}；建设性质：${insp.mainInfo.nature}；${insp.mainInfo.floors ? `楼层数：${insp.mainInfo.floors} 层；` : ''}督导许可：${COLLECT_LABEL[insp.mainInfo.collectStatus] ?? insp.mainInfo.collectStatus}。${insp.mainInfo.contact ? `现场联系人：${insp.mainInfo.contact}（${insp.mainInfo.contactPhone}）。` : ''}`))
    if (insp.mainInfo.note) children.push(p(`现场情况说明：${insp.mainInfo.note}`))
    children.push(...await imageParagraphs(insp.mainInfo.photos ?? [], `图 ${idx + 1}-0 现场照片`))

    // 设施核查
    const applicableIns = insp.instances.filter(x => x.applicable !== false)
    const naIns = insp.instances.filter(x => x.applicable === false)
    if (applicableIns.length > 0) {
      children.push(h2('（一）设施核查结果'))
      for (const ins of applicableIns) {
        const row = rowOf[ins.facility]
        const allItems = [
          ...(row?.items ?? []),
          ...(ins.customItems ?? []).map(c => ({ key: c.key, aspect: c.aspect, requirement: c.requirement, clause: '督导员现场补充条款' })),
        ]
        children.push(p(`${fname(ins.facility)} 实例${String(ins.no).padStart(2, '0')}${ins.locationDesc ? `（${ins.locationDesc}）` : ''}${row ? `〔${LEVEL_META[row.level].label}〕` : ''}${ins.note ? `：${ins.note}` : ''}`, false))
        if (allItems.length > 0) {
          children.push(table(
            ['检查点', '标准要求', '条款依据', '实测', '结论'],
            allItems.map(it => {
              const r = ins.checks[it.key]
              if (r?.verdict) totalItems++
              if (r?.verdict === 'pass') totalPass++
              return [
                it.aspect,
                it.requirement,
                it.clause,
                r?.measured ?? '—',
                r?.verdict === 'pass' ? '符合' : r?.verdict === 'fail' ? '不符合' : '未核查',
              ]
            }),
            [16, 40, 16, 12, 16],
          ))
        }
        children.push(...await imageParagraphs(ins.photos ?? [], `图 ${idx + 1}-${ins.no} ${fname(ins.facility)}取证照片`))
      }
    }
    if (naIns.length > 0) {
      children.push(h2('（二）本处不涉及的服务设施'))
      children.push(p(naIns.map(x => `${fname(x.facility)}（实例${String(x.no).padStart(2, '0')}${x.locationDesc ? `，${x.locationDesc}` : ''}${x.note ? `，${x.note}` : ''}）`).join('；') + '。上述设施经现场确认本处不涉及，未逐项评测，不作为缺失、不生成问题单。'))
    }

    // 缺失设施
    const present = new Set(insp.instances.map(x => x.facility))
    const missing = rows.filter(r => !present.has(r.facility) && r.level !== 'R')
    if (missing.length > 0) {
      children.push(h2('（三）缺失设施'))
      children.push(table(
        ['设施类别', '配置等级', '标准要求', '处理'],
        missing.map(r => [
          fname(r.facility),
          LEVEL_META[r.level].label,
          r.typeNote ?? r.items[0]?.requirement ?? '',
          r.level === 'M' ? '必须项缺失，予以立案' : (insp.condTriggered ?? []).includes(r.facility) ? '条件触发，予以立案' : '条件未触发，不予立案',
        ]),
        [18, 12, 50, 20],
      ))
    }
  }

  /* ===== 问题清单及整改要求 ===== */
  children.push(h1(`${secNo(sortedInsps.length)}、发现问题及整改要求`))
  if (issues.length === 0) {
    children.push(p('本次督导未发现需立案的问题。'))
  } else {
    children.push(table(
      ['序号', '问题描述', '问题等级', '条款依据', '责任单位', '整改期限', '当前状态'],
      issues.map((i: Issue, k: number) => [
        String(k + 1), i.title, SEV_LABEL[i.severity] ?? i.severity, i.clause,
        i.responsible || '—', i.deadline || '—', ISSUE_STATUS[i.status] ?? i.status,
      ]),
      [7, 33, 14, 16, 12, 10, 8],
    ))
    const open = issues.filter(i => i.status !== 'closed' && i.status !== 'deferred').length
    children.push(p(`上述问题共计 ${issues.length} 项，其中违反强制性条文 ${issues.filter(i => i.severity === 'M').length} 项；已闭环 ${issues.filter(i => i.status === 'closed').length} 项，待整改 ${open} 项。请相关责任单位按照《建筑与市政工程无障碍通用规范》（GB 55019-2021）有关要求，于整改期限内完成整改并申请复查。`))
  }

  /* ===== 督导结论 ===== */
  children.push(h1(`${secNo(sortedInsps.length + 1)}、督导结论`))
  children.push(p(`本次督导共核查设施实例 ${sortedInsps.reduce((n, i) => n + i.instances.length, 0)} 个，检查点判定 ${totalItems} 项（符合 ${totalPass} 项，不符合 ${totalItems - totalPass} 项）；发现缺失设施 ${sortedInsps.length > 0 ? '详见缺失设施清单' : '无'}；生成问题单 ${issues.length} 条。`))

  /* ===== 落款 ===== */
  children.push(new Paragraph({ children: [tr('')], spacing: { before: 240 } }))
  children.push(new Paragraph({ children: [tr(`督导单位（盖章）：${orgName ?? '—'}`)], alignment: AlignmentType.RIGHT, spacing: { after: 80 } }))
  children.push(new Paragraph({ children: [tr(`督导人员：${contacts?.inspector?.name ?? insp0?.inspectorName ?? '—'}（${contacts?.inspector?.phone ?? '—'}）`)], alignment: AlignmentType.RIGHT, spacing: { after: 80 } }))
  children.push(new Paragraph({ children: [tr(`评审人员：${reviewers}`)], alignment: AlignmentType.RIGHT, spacing: { after: 80 } }))
  children.push(new Paragraph({ children: [tr(`报告日期：${fmtDate(new Date().toISOString())}`)], alignment: AlignmentType.RIGHT }))

  const doc = new Document({
    title: `${point.name}-无障碍设施督导报告`,
    sections: [{ children }],
  })
  const blob = await Packer.toBlob(doc)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${point.name}-无障碍设施督导报告.docx`
  a.click()
  URL.revokeObjectURL(a.href)
}
