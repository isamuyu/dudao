/**
 * 无障碍督导检查项库（种子数据）
 * 第一优先来源：《各类建筑无障碍设施配置清单表格22》（依据 GB 55019-2021 主 / GB 50763-2012 补充）
 * 配置等级: M=必须设置 ●  C=条件设置 ○  R=推荐设置 △  NA=不适用 —
 */

export type Level = 'M' | 'C' | 'R' | 'NA'

export const LEVEL_META: Record<Level, { label: string; symbol: string; tone: string }> = {
  M: { label: '必须设置', symbol: '●', tone: 'text-red-600' },
  C: { label: '条件设置', symbol: '○', tone: 'text-amber-600' },
  R: { label: '推荐设置', symbol: '△', tone: 'text-sky-600' },
  NA: { label: '不适用', symbol: '—', tone: 'text-slate-400' },
}

/** 14 类设施（配置矩阵横轴顺序） */
export interface FacilityCategory { id: string; name: string; short: string }
export const FACILITIES: FacilityCategory[] = [
  { id: 'entrance',  name: '无障碍出入口', short: '出入口' },
  { id: 'ramp',      name: '无障碍坡道', short: '坡道' },
  { id: 'passage',   name: '无障碍通道', short: '通道' },
  { id: 'door',      name: '无障碍门', short: '门' },
  { id: 'elevator',  name: '无障碍电梯', short: '电梯' },
  { id: 'stairs',    name: '无障碍楼梯', short: '楼梯' },
  { id: 'toilet',    name: '无障碍厕所', short: '厕所' },
  { id: 'bathroom',  name: '无障碍卫生间', short: '卫生间' },
  { id: 'room',      name: '无障碍住房/客房/病房', short: '住房/客房' },
  { id: 'parking',   name: '无障碍停车位', short: '停车位' },
  { id: 'seat',      name: '无障碍席位', short: '席位' },
  { id: 'lowdesk',   name: '低位服务台', short: '低位服务台' },
  { id: 'blindpath', name: '盲道', short: '盲道' },
  { id: 'handrail',  name: '扶手', short: '扶手' },
]
export const FACILITY_MAP = Object.fromEntries(FACILITIES.map(f => [f.id, f]))

/** 数值自动判定参数（来自清单"三、关键技术参数速查表"） */
export interface ParamSpec {
  label: string; unit: string
  kind: 'min' | 'max' | 'range'
  min?: number; max?: number
  hint?: string; clause: string
}
export interface FacilityGeneric {
  requirement: string
  clause: string
  param?: ParamSpec
  condition?: string // 条件设置项的触发条件说明
}

/** 设施类别通用要求兜底（某建筑类型明细表未展开该项时使用） */
export const FACILITY_GENERIC: Record<string, FacilityGeneric> = {
  entrance: { requirement: '主要出入口应设无障碍出入口，地面平整防滑，优先采用平坡出入口。', clause: 'G19 §2.4' },
  ramp: {
    requirement: '应设无障碍坡道，纵向坡度≤1:12（每段提升≤750mm；条件受限且高差≤150mm时≤1:10），净宽≥1.20m，休息平台净深≥1.50m，两侧设扶手、挡台，起终点设提示盲道。',
    clause: 'G19 §2.3.1–2.3.5',
    param: { label: '坡道坡度', unit: '%', kind: 'max', max: 8.33, hint: '1:12≈8.33%；受限条件 1:10≈10%（高差≤150mm）', clause: 'G19 §2.3.1' },
  },
  passage: {
    requirement: '主要通行路线应设无障碍通道，净宽≥1.20m（有高差处≥1.50m），地面平整防滑、不设门槛，高差处设坡道。',
    clause: 'G19 §2.2.2',
    param: { label: '通道净宽', unit: 'm', kind: 'min', min: 1.2, hint: '有高差处应≥1.50m', clause: 'G19 §2.2.2' },
  },
  door: {
    requirement: '应设自动门或平开门，有效通行净宽≥0.90m（新建/扩建）、≥0.80m（改造）；把手高度0.85–1.00m，门下方设护门板，不宜设弹簧门。',
    clause: 'G19 §2.5.4–2.5.8',
    param: { label: '门有效通行净宽', unit: 'm', kind: 'min', min: 0.9, hint: '自动门≥1.00m；改造工程≥0.80m', clause: 'G19 §2.5.4, §2.5.5' },
  },
  elevator: {
    requirement: '应设无障碍电梯：门净宽≥0.90m（新/扩）、≥0.80m（改造），轿厢深≥1.40m、宽≥1.10m，三面设扶手，按钮高0.85–1.10m带盲文，到层语音报层。',
    clause: 'G19 §2.6',
    param: { label: '电梯门净宽', unit: 'm', kind: 'min', min: 0.9, hint: '改造工程≥0.80m', clause: 'G19 §2.6.2, §2.6.3' },
    condition: '多层建筑且有电梯时应设置（具体触发条件见各建筑类型明细）',
  },
  stairs: {
    requirement: '应设无障碍楼梯：踏面宽≥0.28m、高≤0.16m且防滑，不宜设弧形踏步，两侧设扶手（0.85–0.90m），休息平台净深≥1.50m，扶手起末端延伸≥0.30m。',
    clause: 'G19 §2.7',
    param: { label: '踏步高度', unit: 'm', kind: 'max', max: 0.16, hint: '踏面宽≥0.28m', clause: 'G19 §2.7' },
  },
  toilet: {
    requirement: '应设无障碍厕所：新建使用面积≥4.00m²（改建受限≥2.00m²），无障碍厕位≥1.80m×1.00m，坐便器高0.40–0.45m两侧设扶手，距坐便器0.40–0.50m处设紧急呼叫按钮。',
    clause: 'G19 §3.2',
    param: { label: '厕所使用面积', unit: '㎡', kind: 'min', min: 4.0, hint: '改建受限制时≥2.00㎡', clause: 'G19 §3.2.1' },
  },
  bathroom: { requirement: '应设无障碍卫生间，设坐便器、扶手、紧急呼叫按钮，洗手盆台面0.80m、下方净空≥0.65m。', clause: 'G19 §3.2, §3.1.8–3.1.10' },
  room: {
    requirement: '应设无障碍住房/客房/病房，门宽≥0.80m；无障碍客房面积≥7.00㎡，卫生间满足无障碍要求。',
    clause: 'G19 §2.5',
    param: { label: '房间面积', unit: '㎡', kind: 'min', min: 7.0, hint: '无障碍住房起居室≥16.00㎡', clause: 'G19 §2.5' },
  },
  parking: {
    requirement: '停车场所应设无障碍停车位：宽≥3.50m、长≥6.00m，一侧设≥1.20m轮椅通道；数量≥总泊位0.5%（交通建筑≥1%），不少于1个。',
    clause: 'G19 §2.9.2, §2.9.5',
    param: { label: '停车位宽度', unit: 'm', kind: 'min', min: 3.5, hint: '长度≥6.00m', clause: 'G19 §2.9.2' },
    condition: '设有停车场/地面泊位时应设置',
  },
  seat: {
    requirement: '应设无障碍轮椅席位：宽≥0.80m×深≥1.10m，观演建筑≥总座位0.2%且≥2个，每个席位旁设1个陪护席，位置视线良好。',
    clause: 'G63 §8.3.2',
    param: { label: '轮椅席位宽度', unit: 'm', kind: 'min', min: 0.8, hint: '深度≥1.10m', clause: 'G63 §8.3.2' },
  },
  lowdesk: {
    requirement: '服务台/窗口应设低位台面：高度0.70–0.75m，下部净空≥0.65m，宽度≥0.70m，膝部净深≥0.45m。',
    clause: 'G63 §8.1.3',
    param: { label: '台面高度', unit: 'm', kind: 'range', min: 0.7, max: 0.75, hint: '下部净空≥0.65m', clause: 'G63 §8.1.3' },
  },
  blindpath: {
    requirement: '应设行进盲道（0.30–0.60m）与提示盲道（≥0.60m），设于人行道、公交车站、建筑出入口等，提示盲道设于转折/终点处。',
    clause: 'G63 §3.6',
    param: { label: '行进盲道宽度', unit: 'm', kind: 'range', min: 0.3, max: 0.6, hint: '提示盲道≥0.60m', clause: 'G63 §3.6.2' },
  },
  handrail: {
    requirement: '走廊、楼梯、坡道两侧应设扶手：高度0.85–0.90m（双层时下层0.65m），连续设置，起点和末端延伸≥0.30m。',
    clause: 'G19 §2.8.1–2.8.3',
    param: { label: '扶手高度', unit: 'm', kind: 'range', min: 0.85, max: 0.9, hint: '儿童场所双层时下层0.65m', clause: 'G19 §2.8.1' },
  },
}

/** 建筑类型字典：10 大类 / 30 个具体分类（★ 重点配置对象） */
export interface BuildingGroup { id: string; name: string }
export const BUILDING_GROUPS: BuildingGroup[] = [
  { id: 'residential', name: '居住建筑' },
  { id: 'office', name: '办公建筑' },
  { id: 'commercial', name: '商业建筑' },
  { id: 'performance', name: '观演建筑' },
  { id: 'education', name: '教育建筑' },
  { id: 'medical', name: '医疗/康复建筑' },
  { id: 'transport', name: '交通建筑' },
  { id: 'culture', name: '文化建筑' },
  { id: 'sports', name: '体育建筑' },
  { id: 'other_public', name: '其他公共建筑' },
  { id: 'outdoor', name: '室外环境与市政设施' },
]

export interface BuildingSubtype { id: string; group: string; name: string; star: boolean }
export const BUILDING_SUBTYPES: BuildingSubtype[] = [
  { id: 'house', group: 'residential', name: '住宅楼/公寓', star: false },
  { id: 'dorm', group: 'residential', name: '宿舍建筑', star: false },
  { id: 'elderly', group: 'residential', name: '老年人住宅/养老设施', star: false },
  { id: 'gov', group: 'office', name: '政府/行政办公', star: true },
  { id: 'office_other', group: 'office', name: '其他办公建筑', star: false },
  { id: 'mall', group: 'commercial', name: '大中型商业建筑', star: false },
  { id: 'shop', group: 'commercial', name: '小型商业建筑', star: false },
  { id: 'theater', group: 'performance', name: '剧院/音乐厅', star: false },
  { id: 'cinema', group: 'performance', name: '电影院', star: false },
  { id: 'school', group: 'education', name: '中小学', star: false },
  { id: 'university', group: 'education', name: '高等院校', star: false },
  { id: 'kindergarten', group: 'education', name: '幼儿园/托幼机构', star: false },
  { id: 'hospital', group: 'medical', name: '综合/专科医院', star: true },
  { id: 'clinic', group: 'medical', name: '社区医疗/卫生服务站', star: false },
  { id: 'rehab', group: 'medical', name: '康复中心', star: true },
  { id: 'station', group: 'transport', name: '公路/铁路客运站', star: true },
  { id: 'airport', group: 'transport', name: '机场航站楼', star: true },
  { id: 'metro', group: 'transport', name: '地铁/轻轨车站', star: true },
  { id: 'library', group: 'culture', name: '图书馆', star: true },
  { id: 'museum', group: 'culture', name: '博物馆/展览馆', star: true },
  { id: 'culturecenter', group: 'culture', name: '文化馆/科技馆', star: false },
  { id: 'stadium', group: 'sports', name: '体育场/体育馆', star: true },
  { id: 'gym', group: 'sports', name: '游泳馆/健身馆', star: false },
  { id: 'restaurant', group: 'other_public', name: '餐厅/食堂', star: false },
  { id: 'hotel', group: 'other_public', name: '酒店/宾馆/招待所', star: false },
  { id: 'religion', group: 'other_public', name: '寺庙/教堂/清真寺', star: false },
  { id: 'memorial', group: 'other_public', name: '纪念馆/纪念碑', star: false },
  { id: 'road', group: 'outdoor', name: '人行道/人行横道', star: false },
  { id: 'square', group: 'outdoor', name: '公共广场', star: false },
  { id: 'park', group: 'outdoor', name: '公园/游园/绿地', star: false },
  { id: 'community', group: 'outdoor', name: '居住小区/组团', star: false },
]
export const SUBTYPE_MAP = Object.fromEntries(BUILDING_SUBTYPES.map(s => [s.id, s]))

/**
 * 总体配置矩阵（以指南"二、各类建筑无障碍设施配置详细要求"各表为准校准：
 * ●必须设置 严格对应该表"必须设置"行；该表未列为必须的降为 ○条件设置；
 * 条件/推荐行与详表一致；室外类缘石坡道经 EXTRA_LEVELS 单独配置）
 * 顺序与 FACILITIES 一致：出入口,坡道,通道,门,电梯,楼梯,厕所,卫生间,住房,停车位,席位,低位服务台,盲道,扶手
 */
export const MATRIX: Record<string, Level[]> = {
  house:         ['M','M','C','C','C','C','NA','NA','C','C','NA','NA','C','C'],
  dorm:          ['M','M','C','C','C','C','C','C','C','R','NA','NA','R','C'],
  elderly:       ['M','M','M','M','M','M','M','M','M','M','NA','C','M','M'],
  gov:           ['M','M','M','C','M','M','M','C','NA','M','NA','M','C','C'],
  office_other:  ['M','M','M','C','C','C','M','C','NA','C','NA','C','R','C'],
  mall:          ['M','M','M','M','M','C','M','C','NA','M','NA','M','C','C'],
  shop:          ['M','M','M','C','NA','NA','C','NA','NA','C','NA','C','R','R'],
  theater:       ['M','M','M','C','M','C','M','C','NA','M','M','C','C','M'],
  cinema:        ['M','M','M','C','M','C','M','NA','NA','M','M','C','C','M'],
  school:        ['M','M','M','C','C','C','M','C','C','C','NA','C','R','C'],
  university:    ['M','M','M','C','M','C','M','C','C','C','NA','C','C','M'],
  kindergarten:  ['M','M','M','C','NA','NA','M','NA','NA','C','NA','NA','C','C'],
  hospital:      ['M','M','M','C','M','M','M','M','M','C','NA','M','M','M'],
  clinic:        ['M','M','M','C','C','NA','M','C','NA','C','NA','M','C','M'],
  rehab:         ['M','M','M','M','M','M','M','M','M','M','NA','M','M','M'],
  station:       ['M','M','M','C','M','M','M','C','NA','M','NA','M','M','M'],
  airport:       ['M','M','M','C','M','M','M','C','NA','M','NA','M','M','M'],
  metro:         ['M','M','M','C','M','M','M','C','NA','M','NA','M','M','M'],
  library:       ['M','M','M','C','M','C','M','C','NA','C','M','M','M','M'],
  museum:        ['M','M','M','C','M','C','M','C','NA','C','NA','M','M','M'],
  culturecenter: ['M','M','M','C','C','NA','M','NA','NA','C','NA','C','C','C'],
  stadium:       ['M','M','M','C','M','C','M','C','NA','M','M','C','C','M'],
  gym:           ['M','M','M','C','C','NA','M','C','NA','C','NA','C','C','M'],
  restaurant:    ['M','M','M','C','C','NA','M','NA','NA','C','M','C','C','C'],
  hotel:         ['M','M','M','C','M','C','M','C','M','M','NA','M','C','C'],
  religion:      ['M','M','M','C','C','NA','M','NA','NA','C','C','NA','C','C'],
  memorial:      ['M','M','M','C','C','NA','M','NA','NA','C','NA','C','C','C'],
  road:          ['NA','NA','M','NA','NA','NA','NA','NA','NA','NA','NA','NA','M','NA'],
  square:        ['M','M','M','NA','NA','NA','M','NA','NA','C','NA','NA','C','NA'],
  park:          ['M','M','M','NA','NA','NA','M','NA','NA','C','NA','NA','C','NA'],
  community:     ['C','NA','M','NA','NA','NA','NA','NA','NA','C','NA','NA','M','NA'],
}

/** 各建筑类型明细要求（清单"二、各类建筑无障碍设施配置详细要求"结构化，作为类型级说明附在设施行上） */
export interface DetailNote {
  subtype: string
  facility: string
  level: Exclude<Level, 'NA'>
  requirement: string
  clause: string
  condition?: string
}

const D = (
  subtype: string, facility: string, level: Exclude<Level, 'NA'>,
  requirement: string, clause: string, condition?: string, _param?: ParamSpec,
): DetailNote => ({ subtype, facility, level, requirement, clause, condition })

export const DETAILS: DetailNote[] = [
  // （一）居住建筑
  D('house', 'entrance', 'M', '住宅单元出入口应设无障碍坡道，纵向坡度≤1:12（条件受限且高差≤150mm时≤1:10）；出入口平台净宽≥1.50m。', 'G19 §2.4', undefined, FACILITY_GENERIC.ramp.param),
  D('house', 'elevator', 'C', '7层及以上住宅应设置电梯，其中至少1部为无障碍电梯；6层及以下可不设。', 'G19 §2.6.4', '7层及以上时必须设置', FACILITY_GENERIC.elevator.param),
  D('house', 'stairs', 'C', '设有电梯的住宅，其楼梯应满足无障碍楼梯要求：踏步防滑、设扶手、休息平台净深≥1.50m。', 'G19 §2.7', '设有电梯时', FACILITY_GENERIC.stairs.param),
  D('house', 'parking', 'C', '设有地面停车泊位的住宅区，应设置无障碍停车位，数量≥总泊位数的0.5%。', 'G19 §2.9.2, §2.9.5', '设有地面停车泊位时', FACILITY_GENERIC.parking.param),
  D('house', 'passage', 'C', '住宅出入口至单元门应设无障碍通道，净宽≥1.20m，高差处设坡道。', 'G19 §2.2.2', undefined, FACILITY_GENERIC.passage.param),
  D('dorm', 'entrance', 'M', '宿舍主要出入口应设无障碍坡道，净宽≥1.20m。', 'G63 §7.3', undefined, FACILITY_GENERIC.ramp.param),
  D('dorm', 'room', 'C', '每100张床位至少设置1间无障碍居室，面积≥普通居室。', 'G63 §7.3.2', '按床位数核算'),
  D('dorm', 'bathroom', 'C', '每层至少设置1个无障碍厕所/卫生间，靠近无障碍居室。', 'G19 §3.2.1'),
  D('dorm', 'elevator', 'C', '多层宿舍应设置无障碍电梯或坡道连通各层。', 'G63 §7.3.3', '多层时'),
  D('dorm', 'handrail', 'C', '走廊、楼梯、坡道两侧应设扶手，高度0.85–0.90m。', 'G19 §2.8.1', undefined, FACILITY_GENERIC.handrail.param),
  D('elderly', 'entrance', 'M', '全面配置无障碍出入口、坡道、通道、电梯、楼梯、厕所、扶手等，标准高于普通住宅。', 'G19 全文'),
  D('elderly', 'elevator', 'M', '2层及以上均应设无障碍电梯。', 'G63 §7.4.2', undefined, FACILITY_GENERIC.elevator.param),
  D('elderly', 'bathroom', 'M', '每套居室应配设无障碍卫生间，设坐便器、扶手、紧急呼叫按钮。', 'G19 §3.2'),
  D('elderly', 'room', 'M', '应按不低于总床位/套数的比例设置无障碍居室。', 'G63 §7.4.2'),
  D('elderly', 'alarm', 'M', '居室应设聋人紧急报警装置（声光报警器）。', 'G19 §3.1.4'),

  // （二）办公建筑
  D('gov', 'entrance', 'M', '主要出入口设无障碍坡道；设置轮椅回转空间直径≥1.50m。', 'G19 §2.4', undefined, FACILITY_GENERIC.ramp.param),
  D('gov', 'passage', 'M', '主要通行路线应设无障碍通道，净宽≥1.20m；高差处设坡道。', 'G19 §2.2', undefined, FACILITY_GENERIC.passage.param),
  D('gov', 'elevator', 'M', '2层及以上应至少设1部无障碍电梯，门净宽≥0.90m（新建/扩建）、≥0.80m（改造）。', 'G19 §2.6.2, §2.6.3', undefined, FACILITY_GENERIC.elevator.param),
  D('gov', 'stairs', 'M', '应设无障碍楼梯，踏面防滑、设双侧扶手、休息平台净深≥1.50m。', 'G19 §2.7', undefined, FACILITY_GENERIC.stairs.param),
  D('gov', 'toilet', 'M', '每层至少设1个无障碍厕所，使用面积≥4.00㎡（新建）。', 'G19 §3.2.1', undefined, FACILITY_GENERIC.toilet.param),
  D('gov', 'lowdesk', 'M', '对外服务窗口/柜台应设低位服务台，台面高度0.70–0.75m，下部净空≥0.65m。', 'G63 §8.1.3', undefined, FACILITY_GENERIC.lowdesk.param),
  D('gov', 'parking', 'M', '停车场所应设无障碍停车位，数量≥总泊位数的0.5%（政府建筑不少于2个）。', 'G19 §2.9.2, §2.9.5', undefined, FACILITY_GENERIC.parking.param),
  D('gov', 'signage', 'M', '应设无障碍设施引导标识，含无障碍路线图、设施位置指示。', 'G19 §4'),
  D('office_other', 'entrance', 'M', '主要出入口设无障碍坡道。', 'G19 §2.4'),
  D('office_other', 'passage', 'M', '主要通行路线设无障碍通道。', 'G19 §2.2', undefined, FACILITY_GENERIC.passage.param),
  D('office_other', 'elevator', 'C', '2层及以上且有电梯时，至少1部为无障碍电梯。', 'G63 §8.1', '2层及以上且有电梯时', FACILITY_GENERIC.elevator.param),
  D('office_other', 'toilet', 'M', '每层至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('office_other', 'lowdesk', 'C', '有对外服务功能时设置低位服务台。', 'G63 §8.1.3', '有对外服务功能时', FACILITY_GENERIC.lowdesk.param),
  D('office_other', 'parking', 'C', '设有停车场的应配无障碍停车位。', 'G19 §2.9.2, §2.9.5', '设有停车场时', FACILITY_GENERIC.parking.param),

  // （三）商业建筑
  D('mall', 'entrance', 'M', '主要出入口设无障碍坡道，地面平整防滑。', 'G19 §2.4'),
  D('mall', 'passage', 'M', '主要购物通道净宽≥1.50m，满足轮椅双向通行。', 'G19 §2.2', undefined, { label: '购物通道净宽', unit: 'm', kind: 'min', min: 1.5, clause: 'G19 §2.2' }),
  D('mall', 'door', 'M', '主要出入口设自动门或平开门，有效通行净宽≥0.90m（新建/扩建）、≥0.80m（改造）。', 'G19 §2.5', undefined, FACILITY_GENERIC.door.param),
  D('mall', 'elevator', 'M', '多层商业建筑应设无障碍电梯，至少1部。', 'G63 §8.2.4', undefined, FACILITY_GENERIC.elevator.param),
  D('mall', 'toilet', 'M', '每层至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('mall', 'lowdesk', 'M', '服务台、收银台应设低位窗口，台面高度0.70–0.75m。', 'G63 §8.2.3', undefined, FACILITY_GENERIC.lowdesk.param),
  D('mall', 'parking', 'M', '停车场所应设无障碍停车位，数量≥总泊位数的0.5%。', 'G19 §2.9.2, §2.9.5', undefined, FACILITY_GENERIC.parking.param),
  D('shop', 'entrance', 'M', '出入口设无障碍坡道或消除台阶。', 'G19 §2.4'),
  D('shop', 'passage', 'M', '店堂内主要通道净宽≥1.20m。', 'G19 §2.2', undefined, FACILITY_GENERIC.passage.param),
  D('shop', 'toilet', 'C', '有条件的应设无障碍厕所。', 'G63 §8.2', '有条件时'),
  D('shop', 'lowdesk', 'C', '服务台宜设低位窗口。', 'G63 §8.2.3', '有条件时', FACILITY_GENERIC.lowdesk.param),
  D('shop', 'parking', 'C', '设有停车场的应配无障碍停车位。', 'G19 §2.9', '设有停车场时', FACILITY_GENERIC.parking.param),

  // （四）观演建筑（剧院/音乐厅、电影院共用）
  D('theater', 'entrance', 'M', '主要出入口设无障碍坡道，门厅设轮椅回转空间。', 'G19 §2.4'),
  D('theater', 'passage', 'M', '从出入口至观众厅、厕所等设无障碍通道。', 'G19 §2.2', undefined, FACILITY_GENERIC.passage.param),
  D('theater', 'elevator', 'M', '多层应设无障碍电梯。', 'G63 §8.3.2', undefined, FACILITY_GENERIC.elevator.param),
  D('theater', 'toilet', 'M', '每层至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('theater', 'seat', 'M', '1000座以上：轮椅席位数≥总座位的0.2%且≥2个；1000座以下：≥1–2个。应设在视线良好的位置。', 'G63 §8.3.2', undefined, FACILITY_GENERIC.seat.param),
  D('theater', 'parking', 'M', '停车场所应设无障碍停车位。', 'G19 §2.9', undefined, FACILITY_GENERIC.parking.param),
  D('theater', 'handrail', 'M', '楼梯/坡道设扶手，设无障碍设施引导标识。', 'G19 §2.8, §4', undefined, FACILITY_GENERIC.handrail.param),
  D('cinema', 'entrance', 'M', '主要出入口设无障碍坡道，门厅设轮椅回转空间。', 'G19 §2.4'),
  D('cinema', 'passage', 'M', '从出入口至观众厅、厕所等设无障碍通道。', 'G19 §2.2', undefined, FACILITY_GENERIC.passage.param),
  D('cinema', 'elevator', 'M', '多层应设无障碍电梯。', 'G63 §8.3.2', undefined, FACILITY_GENERIC.elevator.param),
  D('cinema', 'toilet', 'M', '每层至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('cinema', 'seat', 'M', '轮椅席位数≥总座位的0.2%且≥2个（1000座以下≥1–2个），应设在视线良好的位置。', 'G63 §8.3.2', undefined, FACILITY_GENERIC.seat.param),
  D('cinema', 'parking', 'M', '停车场所应设无障碍停车位。', 'G19 §2.9', undefined, FACILITY_GENERIC.parking.param),
  D('cinema', 'handrail', 'M', '楼梯/坡道设扶手，设无障碍设施引导标识。', 'G19 §2.8, §4', undefined, FACILITY_GENERIC.handrail.param),

  // （五）教育建筑
  D('school', 'entrance', 'M', '教学楼主要出入口设无障碍坡道。', 'G19 §2.4'),
  D('school', 'passage', 'M', '主要教学通行路线设无障碍通道。', 'G19 §2.2', undefined, FACILITY_GENERIC.passage.param),
  D('school', 'elevator', 'C', '多层教学建筑应设无障碍电梯；高等院校必须设置。', 'G63 §8.4.2', '多层教学建筑时', FACILITY_GENERIC.elevator.param),
  D('school', 'toilet', 'M', '每层至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('school', 'room', 'C', '首层至少设1间无障碍教室，门宽≥0.90m（新/扩）、≥0.80m（改造），室内设轮椅回转空间。', 'G63 §8.4.2'),
  D('school', 'handrail', 'C', '楼梯设扶手，设无障碍设施标识。高等院校必须设置。', 'G19 §2.8, §4', undefined, FACILITY_GENERIC.handrail.param),
  D('university', 'entrance', 'M', '教学楼主要出入口设无障碍坡道。', 'G19 §2.4'),
  D('university', 'passage', 'M', '主要教学通行路线设无障碍通道。', 'G19 §2.2', undefined, FACILITY_GENERIC.passage.param),
  D('university', 'elevator', 'M', '多层教学建筑应设无障碍电梯（高等院校必须设置）。', 'G63 §8.4.2', undefined, FACILITY_GENERIC.elevator.param),
  D('university', 'toilet', 'M', '每层至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('university', 'room', 'C', '首层至少设1间无障碍教室，门宽≥0.90m（新/扩）、≥0.80m（改造），室内设轮椅回转空间。', 'G63 §8.4.2'),
  D('university', 'signage', 'M', '设无障碍设施标识（高等院校必须设置）。', 'G19 §4'),
  D('university', 'handrail', 'M', '楼梯设扶手（高等院校必须设置）。', 'G19 §2.8', undefined, FACILITY_GENERIC.handrail.param),
  D('kindergarten', 'entrance', 'M', '主要出入口设无障碍坡道。', 'G19 §2.4'),
  D('kindergarten', 'passage', 'M', '主要通行路线设无障碍通道。', 'G19 §2.2', undefined, FACILITY_GENERIC.passage.param),
  D('kindergarten', 'toilet', 'M', '至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('kindergarten', 'handrail', 'C', '楼梯/坡道设扶手，高度宜设双层（0.65m + 0.85m）。', 'G19 §2.8', undefined, FACILITY_GENERIC.handrail.param),

  // （六）医疗/康复建筑
  D('hospital', 'entrance', 'M', '门急诊、住院主要出入口均设无障碍坡道。', 'G19 §2.4'),
  D('hospital', 'passage', 'M', '各功能区域间设无障碍通道，净宽≥1.50m，满足担架通行。', 'G19 §2.2', undefined, { label: '通道净宽', unit: 'm', kind: 'min', min: 1.5, hint: '满足担架通行', clause: 'G19 §2.2' }),
  D('hospital', 'elevator', 'M', '2层及以上设无障碍电梯，至少1部兼作医用电梯。', 'G63 §8.5.3', undefined, FACILITY_GENERIC.elevator.param),
  D('hospital', 'stairs', 'M', '设无障碍楼梯，休息平台满足担架回转。', 'G19 §2.7'),
  D('hospital', 'toilet', 'M', '每层至少设1个无障碍厕所；病房卫生间应满足无障碍要求。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('hospital', 'room', 'M', '每科室至少设1间无障碍病房，面积≥普通病房，卫生间满足无障碍要求。', 'G63 §8.5.2'),
  D('hospital', 'lowdesk', 'M', '挂号、收费、取药等窗口设低位台面，高度0.70–0.75m。', 'G63 §8.5.3', undefined, FACILITY_GENERIC.lowdesk.param),
  D('hospital', 'blindpath', 'M', '主要通道设盲道引导，走廊两侧设扶手，设无障碍设施标识。', 'G19 §2.8, §3.1.4, §4'),
  D('hospital', 'alarm', 'M', '病房、公共场所设聋人声光报警装置。', 'G19 §3.1.4'),
  D('clinic', 'entrance', 'M', '主要出入口设无障碍坡道。', 'G19 §2.4'),
  D('clinic', 'passage', 'M', '主要通行路线设无障碍通道。', 'G19 §2.2', undefined, FACILITY_GENERIC.passage.param),
  D('clinic', 'toilet', 'M', '至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('clinic', 'elevator', 'C', '多层时应设无障碍电梯。', 'G63 §8.5', '多层时', FACILITY_GENERIC.elevator.param),
  D('clinic', 'lowdesk', 'M', '服务窗口设低位台面。', 'G63 §8.5', undefined, FACILITY_GENERIC.lowdesk.param),
  D('clinic', 'handrail', 'M', '设扶手和无障碍标识。', 'G19 §2.8, §4', undefined, FACILITY_GENERIC.handrail.param),
  D('rehab', 'entrance', 'M', '全面配置无障碍设施，标准高于普通医院。', 'G19 全文'),
  D('rehab', 'passage', 'M', '净宽≥1.80m，满足轮椅双向通行。', 'G63 §8.6.2', undefined, { label: '通道净宽', unit: 'm', kind: 'min', min: 1.8, hint: '满足轮椅双向通行', clause: 'G63 §8.6.2' }),
  D('rehab', 'elevator', 'M', '2层及以上设无障碍电梯，满足担架/轮椅通行。', 'G63 §8.6', undefined, FACILITY_GENERIC.elevator.param),
  D('rehab', 'room', 'M', '应设无障碍病房，比例不低于总床位10%。', 'G63 §8.6.2'),
  D('rehab', 'toilet', 'M', '每层设无障碍厕所、卫生间、淋浴间。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('rehab', 'training', 'M', '康复训练区应满足轮椅回转空间，地面防滑。', 'G63 §8.6'),
  D('rehab', 'blindpath', 'M', '全面设置盲道、扶手、无障碍标识。', 'G19 §2.8, §3.1.4, §4'),
  D('rehab', 'alarm', 'M', '病房及公共场所设聋人声光报警。', 'G19 §3.1.4'),

  // （七）交通建筑（客运站/机场/地铁站共用）
  D('station', 'entrance', 'M', '各出入口设无障碍坡道，门厅设轮椅回转空间。', 'G19 §2.4'),
  D('station', 'passage', 'M', '主要通行流线设无障碍通道，净宽≥1.50m；满足行李+轮椅通行。', 'G19 §2.2', undefined, { label: '通道净宽', unit: 'm', kind: 'min', min: 1.5, clause: 'G19 §2.2' }),
  D('station', 'elevator', 'M', '所有楼层间设无障碍电梯，至少1部。', 'G63 §8.7.3', undefined, FACILITY_GENERIC.elevator.param),
  D('station', 'stairs', 'M', '设无障碍楼梯，休息平台净深≥1.50m。', 'G19 §2.7'),
  D('station', 'toilet', 'M', '每层至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('station', 'parking', 'M', '停车场所设无障碍停车位，数量≥总泊位数的1%。', 'G19 §2.9', undefined, FACILITY_GENERIC.parking.param),
  D('station', 'lowdesk', 'M', '售票、问询、值机等窗口设低位台面。', 'G63 §8.7.3', undefined, FACILITY_GENERIC.lowdesk.param),
  D('station', 'blindpath', 'M', '从出入口至站台/候车区设盲道引导系统；设扶手和无障碍标识。', 'G19 §2.8, §3.1.4, §4'),
  D('station', 'alarm', 'M', '设聋人声光报警。', 'G19 §3.1.4'),
  D('station', 'guide', 'M', '设无障碍导览/讲解设施。', 'G19 §3.1.4'),
  D('airport', 'entrance', 'M', '各出入口设无障碍坡道，门厅设轮椅回转空间。', 'G19 §2.4'),
  D('airport', 'passage', 'M', '主要通行流线设无障碍通道，净宽≥1.50m；满足行李+轮椅通行。', 'G19 §2.2', undefined, { label: '通道净宽', unit: 'm', kind: 'min', min: 1.5, clause: 'G19 §2.2' }),
  D('airport', 'elevator', 'M', '所有楼层间设无障碍电梯，至少1部。', 'G63 §8.7.3', undefined, FACILITY_GENERIC.elevator.param),
  D('airport', 'stairs', 'M', '设无障碍楼梯，休息平台净深≥1.50m。', 'G19 §2.7'),
  D('airport', 'toilet', 'M', '每层至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('airport', 'parking', 'M', '停车场所设无障碍停车位，数量≥总泊位数的1%。', 'G19 §2.9', undefined, FACILITY_GENERIC.parking.param),
  D('airport', 'lowdesk', 'M', '售票、问询、值机等窗口设低位台面。', 'G63 §8.7.3', undefined, FACILITY_GENERIC.lowdesk.param),
  D('airport', 'blindpath', 'M', '从出入口至登机区设盲道引导系统；设扶手和无障碍标识。', 'G19 §2.8, §3.1.4, §4'),
  D('airport', 'alarm', 'M', '设聋人声光报警。', 'G19 §3.1.4'),
  D('airport', 'guide', 'M', '设无障碍导览/讲解设施。', 'G19 §3.1.4'),
  D('metro', 'entrance', 'M', '各出入口设无障碍坡道，门厅设轮椅回转空间。', 'G19 §2.4'),
  D('metro', 'passage', 'M', '主要通行流线设无障碍通道，净宽≥1.50m。', 'G19 §2.2', undefined, { label: '通道净宽', unit: 'm', kind: 'min', min: 1.5, clause: 'G19 §2.2' }),
  D('metro', 'elevator', 'M', '站厅至站台设无障碍电梯，至少1部。', 'G63 §8.7.3', undefined, FACILITY_GENERIC.elevator.param),
  D('metro', 'stairs', 'M', '设无障碍楼梯，休息平台净深≥1.50m。', 'G19 §2.7'),
  D('metro', 'toilet', 'M', '每层至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('metro', 'parking', 'M', '停车场所设无障碍停车位，数量≥总泊位数的1%。', 'G19 §2.9', undefined, FACILITY_GENERIC.parking.param),
  D('metro', 'lowdesk', 'M', '售票、问询窗口设低位台面。', 'G63 §8.7.3', undefined, FACILITY_GENERIC.lowdesk.param),
  D('metro', 'blindpath', 'M', '从出入口至站台设盲道引导系统；设扶手和无障碍标识。', 'G19 §2.8, §3.1.4, §4'),
  D('metro', 'alarm', 'M', '设聋人声光报警。', 'G19 §3.1.4'),
  D('metro', 'guide', 'M', '设无障碍导览/讲解设施。', 'G19 §3.1.4'),

  // （八）文化建筑
  D('library', 'entrance', 'M', '主要出入口设无障碍坡道。', 'G19 §2.4'),
  D('library', 'passage', 'M', '主要通行路线设无障碍通道，净宽≥1.50m。', 'G19 §2.2', undefined, { label: '通道净宽', unit: 'm', kind: 'min', min: 1.5, clause: 'G19 §2.2' }),
  D('library', 'elevator', 'M', '多层设无障碍电梯。', 'G63 §8.8', undefined, FACILITY_GENERIC.elevator.param),
  D('library', 'toilet', 'M', '每层至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('library', 'seat', 'M', '阅览室设无障碍阅览席位，桌台面高度0.70–0.75m。', 'G63 §8.8.2', undefined, FACILITY_GENERIC.lowdesk.param),
  D('library', 'lowdesk', 'M', '借阅/还书台设低位窗口。', 'G63 §8.8', undefined, FACILITY_GENERIC.lowdesk.param),
  D('library', 'blindpath', 'M', '设盲道引导、扶手、无障碍设施标识。', 'G19 §2.8, §3.1.4, §4'),
  D('library', 'guide', 'C', '有条件的设无障碍导览/讲解设施。', 'G63 §8.8', '有条件时'),
  D('museum', 'entrance', 'M', '主要出入口设无障碍坡道。', 'G19 §2.4'),
  D('museum', 'passage', 'M', '展厅通行路线设无障碍通道，净宽≥1.50m。', 'G19 §2.2', undefined, { label: '通道净宽', unit: 'm', kind: 'min', min: 1.5, clause: 'G19 §2.2' }),
  D('museum', 'elevator', 'M', '多层设无障碍电梯。', 'G63 §8.8', undefined, FACILITY_GENERIC.elevator.param),
  D('museum', 'toilet', 'M', '每层至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('museum', 'lowdesk', 'M', '展柜/服务台设低位观览/服务区域。', 'G63 §8.8', undefined, FACILITY_GENERIC.lowdesk.param),
  D('museum', 'blindpath', 'M', '设盲道引导、扶手、无障碍标识。', 'G19 §2.8, §3.1.4, §4'),
  D('culturecenter', 'entrance', 'M', '主要出入口设无障碍坡道。', 'G19 §2.4'),
  D('culturecenter', 'passage', 'M', '主要通行路线设无障碍通道。', 'G19 §2.2', undefined, FACILITY_GENERIC.passage.param),
  D('culturecenter', 'elevator', 'C', '多层设无障碍电梯。', 'G63 §8.8', '多层时', FACILITY_GENERIC.elevator.param),
  D('culturecenter', 'toilet', 'M', '至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('culturecenter', 'signage', 'M', '设无障碍设施标识。', 'G19 §4'),
  D('culturecenter', 'guide', 'M', '应设无障碍导览设施（语音/触觉）。', 'G63/G19'),

  // （九）体育建筑
  D('stadium', 'entrance', 'M', '观众出入口设无障碍坡道。', 'G19 §2.4'),
  D('stadium', 'passage', 'M', '从出入口至观众席设无障碍通道。', 'G19 §2.2', undefined, FACILITY_GENERIC.passage.param),
  D('stadium', 'elevator', 'M', '多层看台设无障碍电梯。', 'G63 §8.9', undefined, FACILITY_GENERIC.elevator.param),
  D('stadium', 'toilet', 'M', '每层至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('stadium', 'seat', 'M', '观众席设无障碍轮椅席位，数量≥总座位的0.2%且≥2个。', 'G63 §8.9.2', undefined, FACILITY_GENERIC.seat.param),
  D('stadium', 'parking', 'M', '停车场所设无障碍停车位。', 'G19 §2.9', undefined, FACILITY_GENERIC.parking.param),
  D('stadium', 'handrail', 'M', '楼梯/坡道设扶手，设无障碍标识。', 'G19 §2.8, §4', undefined, FACILITY_GENERIC.handrail.param),
  D('gym', 'entrance', 'M', '主要出入口设无障碍坡道。', 'G19 §2.4'),
  D('gym', 'passage', 'M', '至更衣/淋浴区设无障碍通道。', 'G19 §2.2', undefined, FACILITY_GENERIC.passage.param),
  D('gym', 'toilet', 'M', '设无障碍厕所和卫生间。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('gym', 'bathroom', 'C', '设无障碍淋浴间，面积≥3.50㎡，设坐台、扶手。', 'G19 §3.2', undefined, { label: '淋浴间面积', unit: '㎡', kind: 'min', min: 3.5, hint: '设坐台、扶手、紧急呼叫', clause: 'G19 §3.2' }),
  D('gym', 'elevator', 'C', '多层设无障碍电梯。', 'G63 §8.9', '多层时', FACILITY_GENERIC.elevator.param),
  D('gym', 'handrail', 'M', '楼梯/坡道及更衣淋浴区设扶手。', 'G19 §2.8', undefined, FACILITY_GENERIC.handrail.param),

  // （十）其他公共建筑
  D('restaurant', 'entrance', 'M', '主要出入口设无障碍坡道。', 'G19 §2.4'),
  D('restaurant', 'passage', 'M', '至就餐区设无障碍通道，净宽≥1.20m。', 'G19 §2.2', undefined, FACILITY_GENERIC.passage.param),
  D('restaurant', 'seat', 'M', '就餐区设无障碍席位（轮椅就餐位）。', 'G63 §8.10.2'),
  D('restaurant', 'toilet', 'M', '至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('restaurant', 'elevator', 'C', '多层设无障碍电梯。', 'G63 §8.10', '多层时', FACILITY_GENERIC.elevator.param),
  D('restaurant', 'parking', 'C', '设有停车场的配无障碍停车位。', 'G19 §2.9', '设有停车场时', FACILITY_GENERIC.parking.param),
  D('hotel', 'entrance', 'M', '主要出入口设无障碍坡道。', 'G19 §2.4'),
  D('hotel', 'passage', 'M', '至客房/餐厅等设无障碍通道。', 'G19 §2.2', undefined, FACILITY_GENERIC.passage.param),
  D('hotel', 'elevator', 'M', '2层及以上设无障碍电梯。', 'G63 §8.11.2', undefined, FACILITY_GENERIC.elevator.param),
  D('hotel', 'room', 'M', '无障碍客房：100间以下至少1间；100–200间至少2间；200间以上每增加100间增设1间。面积≥7.00㎡。', 'G19 §2.5', undefined, FACILITY_GENERIC.room.param),
  D('hotel', 'toilet', 'M', '公共区域每层至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('hotel', 'lowdesk', 'M', '前台/登记处设低位服务窗口。', 'G63 §8.11', undefined, FACILITY_GENERIC.lowdesk.param),
  D('hotel', 'parking', 'M', '停车场所设无障碍停车位。', 'G19 §2.9', undefined, FACILITY_GENERIC.parking.param),
  D('religion', 'entrance', 'M', '主要出入口设无障碍坡道。', 'G19 §2.4'),
  D('religion', 'passage', 'M', '主要通行路线设无障碍通道。', 'G19 §2.2', undefined, FACILITY_GENERIC.passage.param),
  D('religion', 'toilet', 'M', '至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('religion', 'elevator', 'C', '多层设无障碍电梯。', 'G63 §8.12', '多层时', FACILITY_GENERIC.elevator.param),
  D('religion', 'seat', 'C', '有固定座位的应设无障碍席位。', 'G63 §8.12', '有固定座位时', FACILITY_GENERIC.seat.param),
  D('memorial', 'entrance', 'M', '主要出入口设无障碍坡道。', 'G19 §2.4'),
  D('memorial', 'passage', 'M', '至展览/陈列区设无障碍通道。', 'G19 §2.2', undefined, FACILITY_GENERIC.passage.param),
  D('memorial', 'toilet', 'M', '至少设1个无障碍厕所。', 'G19 §3.2', undefined, FACILITY_GENERIC.toilet.param),
  D('memorial', 'elevator', 'C', '多层设无障碍电梯。', 'G63 §8.13', '多层时', FACILITY_GENERIC.elevator.param),
  D('memorial', 'guide', 'C', '有条件的设无障碍导览设施。', 'G63 §8.13', '有条件时'),

  // （十一）室外环境与市政设施
  D('road', 'curbramp', 'M', '人行道交叉口、街坊路口、人行横道处均应设缘石坡道，坡度≤1:12。', 'G19 §2.10'),
  D('road', 'blindpath', 'M', '城市中心区、政府建筑周边、交通设施周边等人行道应设行进盲道和提示盲道。', 'G63 §3.6', undefined, FACILITY_GENERIC.blindpath.param),
  D('road', 'passage', 'M', '人行道净宽≥1.20m，满足轮椅通行。', 'G19 §2.2', undefined, FACILITY_GENERIC.passage.param),
  D('square', 'entrance', 'M', '广场出入口设无障碍坡道。', 'G19 §2.4'),
  D('square', 'passage', 'M', '广场内主要通道设无障碍通道，净宽≥1.50m。', 'G19 §2.2', undefined, { label: '通道净宽', unit: 'm', kind: 'min', min: 1.5, clause: 'G19 §2.2' }),
  D('square', 'toilet', 'M', '广场公共厕所设无障碍厕位/厕所。', 'G19 §3.2'),
  D('square', 'parking', 'C', '设有停车场的配无障碍停车位。', 'G19 §2.9', '设有停车场时', FACILITY_GENERIC.parking.param),
  D('park', 'entrance', 'M', '公园出入口设无障碍坡道。', 'G19 §2.4'),
  D('park', 'passage', 'M', '主要游览路线设无障碍游步道，净宽≥1.20m，坡度≤1:12。', 'G19/G63', undefined, FACILITY_GENERIC.passage.param),
  D('park', 'toilet', 'M', '公园公共厕所设无障碍厕位/厕所。', 'G19 §3.2'),
  D('park', 'parking', 'C', '设有停车场的配无障碍停车位。', 'G19 §2.9', '设有停车场时', FACILITY_GENERIC.parking.param),
  D('community', 'passage', 'M', '居住区内主要道路设无障碍通道，路口设缘石坡道。', 'G19 §2.2', undefined, FACILITY_GENERIC.passage.param),
  D('community', 'curbramp', 'M', '居住区内路口应设缘石坡道，坡度≤1:12。', 'G19 §2.2'),
  D('community', 'blindpath', 'M', '居住区主要出入口、公共建筑周边设盲道。', 'G63 §6.2'),
]

/** ===== 设施检查点模板：每类设施展开为多个检查点，完整覆盖"三、关键技术参数速查表" ===== */
export interface AspectTemplate {
  aspect: string          // 检查点/参数名称
  requirement: string
  clause: string
  param?: ParamSpec
  condition?: string
}

export const FACILITY_ASPECTS: Record<string, AspectTemplate[]> = {
  entrance: [
    { aspect: '设置要求', requirement: '主要出入口应为无障碍出入口，优先采用平坡出入口；同时设置台阶和轮椅坡道/升降平台的出入口应满足各自要求。', clause: 'G19 §2.4' },
    { aspect: '出入口平台净宽', requirement: '出入口平台净宽≥1.50m，地面平整防滑。', clause: 'G19 §2.4', param: { label: '平台净宽', unit: 'm', kind: 'min', min: 1.5, clause: 'G19 §2.4' } },
    { aspect: '轮椅回转空间', requirement: '门厅/出入口处应设轮椅回转空间，直径≥1.50m。', clause: 'G19 §3.1.2', condition: '设门厅时', param: { label: '回转空间直径', unit: 'm', kind: 'min', min: 1.5, clause: 'G19 §3.1.2' } },
  ],
  ramp: [
    { aspect: '坡度', requirement: '纵向坡度≤1:12（每段提升高度≤750mm）；条件受限且高差≤150mm时≤1:10。每段坡道水平长度超过9m应设休息平台。', clause: 'G19 §2.3.1', param: { label: '坡道坡度', unit: '%', kind: 'max', max: 8.33, hint: '1:12≈8.33%；受限条件1:10≈10%（高差≤150mm）', clause: 'G19 §2.3.1' } },
    { aspect: '净宽', requirement: '坡道净宽≥1.20m。', clause: 'G19 §2.3.2', param: { label: '坡道净宽', unit: 'm', kind: 'min', min: 1.2, clause: 'G19 §2.3.2' } },
    { aspect: '休息平台', requirement: '休息平台净深≥1.50m；转弯处应设休息平台。', clause: 'G19 §2.3.3', param: { label: '休息平台净深', unit: 'm', kind: 'min', min: 1.5, clause: 'G19 §2.3.3' } },
    { aspect: '扶手/挡台/盲道', requirement: '两侧设扶手（0.85–0.90m）；坡道两侧设挡台；起点、终点设提示盲道。', clause: 'G19 §2.3.4–2.3.5' },
  ],
  passage: [
    { aspect: '净宽', requirement: '无障碍通道净宽≥1.20m（一段）；有高差处≥1.50m，高差处应设坡道。', clause: 'G19 §2.2.2', param: { label: '通道净宽', unit: 'm', kind: 'min', min: 1.2, hint: '有高差处应≥1.50m', clause: 'G19 §2.2.2' } },
    { aspect: '地面', requirement: '地面平整防滑，不设门槛；地面高差≤15mm时应做斜面过渡。', clause: 'G19 §2.1.4, §2.5.3' },
    { aspect: '轮椅回转空间', requirement: '通道端部及转折处应设轮椅回转空间，直径≥1.50m。', clause: 'G19 §3.1.2', param: { label: '回转空间直径', unit: 'm', kind: 'min', min: 1.5, clause: 'G19 §3.1.2' } },
  ],
  door: [
    { aspect: '有效通行净宽', requirement: '自动门≥1.00m；手动门≥0.90m（新建/扩建）、≥0.80m（改造）。', clause: 'G19 §2.5.4, §2.5.5', param: { label: '门通行净宽', unit: 'm', kind: 'min', min: 0.9, hint: '自动门≥1.00m；改造工程≥0.80m', clause: 'G19 §2.5.4, §2.5.5' } },
    { aspect: '把手高度', requirement: '门把手高度0.85–1.00m。', clause: 'G19 §2.5.4', param: { label: '把手高度', unit: 'm', kind: 'range', min: 0.85, max: 1.0, clause: 'G19 §2.5.4' } },
    { aspect: '门扇构造', requirement: '门下方设护门板；不宜设弹簧门；玻璃门应有醒目防撞标识。', clause: 'G19 §2.5.4, §2.5.8' },
  ],
  elevator: [
    { aspect: '门净宽', requirement: '电梯门净宽≥0.90m（新建/扩建）、≥0.80m（改造）。', clause: 'G19 §2.6.2, §2.6.3', param: { label: '电梯门净宽', unit: 'm', kind: 'min', min: 0.9, hint: '改造工程≥0.80m', clause: 'G19 §2.6.2, §2.6.3' } },
    { aspect: '轿厢尺寸', requirement: '轿厢深度≥1.40m、宽度≥1.10m，轿厢三面设扶手。', clause: 'G19 §2.6.2, §2.6.3', param: { label: '轿厢深度', unit: 'm', kind: 'min', min: 1.4, hint: '宽度≥1.10m；三面设扶手', clause: 'G19 §2.6.2' } },
    { aspect: '按钮', requirement: '按钮高度0.85–1.10m，带盲文。', clause: 'G19 §2.6.1', param: { label: '按钮高度', unit: 'm', kind: 'range', min: 0.85, max: 1.1, hint: '按钮应带盲文', clause: 'G19 §2.6.1' } },
    { aspect: '语音/显示', requirement: '到层语音报层；轿厢外设楼层显示。', clause: 'G19 §2.6.1' },
  ],
  stairs: [
    { aspect: '踏步高度', requirement: '踏面高≤0.16m，踏面宽≥0.28m且防滑，不宜设弧形踏步。', clause: 'G19 §2.7', param: { label: '踏步高度', unit: 'm', kind: 'max', max: 0.16, hint: '踏面宽≥0.28m', clause: 'G19 §2.7' } },
    { aspect: '休息平台', requirement: '休息平台净深≥1.50m。', clause: 'G19 §2.7', param: { label: '休息平台净深', unit: 'm', kind: 'min', min: 1.5, clause: 'G19 §2.7' } },
    { aspect: '扶手', requirement: '两侧设扶手（0.85–0.90m）；扶手起点和末端延伸≥0.30m。', clause: 'G19 §2.7, §2.8' },
  ],
  toilet: [
    { aspect: '使用面积', requirement: '无障碍厕所使用面积新建≥4.00㎡，改建受限制≥2.00㎡。', clause: 'G19 §3.2.1', param: { label: '厕所使用面积', unit: '㎡', kind: 'min', min: 4.0, hint: '改建受限制时≥2.00㎡', clause: 'G19 §3.2.1' } },
    { aspect: '无障碍厕位', requirement: '无障碍厕位≥1.80m×1.00m。', clause: 'G19 §3.2', param: { label: '厕位宽度', unit: 'm', kind: 'min', min: 1.0, hint: '进深≥1.80m', clause: 'G19 §3.2' } },
    { aspect: '坐便器', requirement: '坐便器高0.40–0.45m，两侧设扶手。', clause: 'G19 §3.1.8', param: { label: '坐便器高度', unit: 'm', kind: 'range', min: 0.4, max: 0.45, hint: '两侧应设扶手', clause: 'G19 §3.1.8' } },
    { aspect: '洗手盆', requirement: '洗手盆台面高0.80m，下方净空≥0.65m。', clause: 'G19 §3.1.10', param: { label: '洗手盆下方净空', unit: 'm', kind: 'min', min: 0.65, hint: '台面高0.80m', clause: 'G19 §3.1.10' } },
    { aspect: '紧急呼叫', requirement: '距坐便器0.40–0.50m处设紧急呼叫按钮，距地0.40m。', clause: 'G19 §3.1.4' },
  ],
  bathroom: [
    { aspect: '使用面积', requirement: '无障碍卫生间使用面积≥4.00㎡。', clause: 'G19 §3.2', param: { label: '卫生间使用面积', unit: '㎡', kind: 'min', min: 4.0, clause: 'G19 §3.2' } },
    { aspect: '坐便器与扶手', requirement: '设坐便器，高0.40–0.45m，两侧设扶手。', clause: 'G19 §3.1.8' },
    { aspect: '洗手盆', requirement: '洗手盆台面高0.80m，下方净空≥0.65m。', clause: 'G19 §3.1.10', param: { label: '洗手盆下方净空', unit: 'm', kind: 'min', min: 0.65, clause: 'G19 §3.1.10' } },
    { aspect: '紧急呼叫', requirement: '设紧急呼叫按钮（距坐便器0.40–0.50m，距地0.40m）。', clause: 'G19 §3.1.4' },
  ],
  room: [
    { aspect: '房间面积', requirement: '无障碍客房面积≥7.00㎡；无障碍住房起居室≥16.00㎡、厨房≥6.00㎡、卫生间≥4.00㎡。', clause: 'G19 §2.5', param: { label: '房间面积', unit: '㎡', kind: 'min', min: 7.0, hint: '住房起居室≥16.00㎡', clause: 'G19 §2.5' } },
    { aspect: '门宽', requirement: '门宽≥0.80m。', clause: 'G19 §2.5', param: { label: '门宽', unit: 'm', kind: 'min', min: 0.8, clause: 'G19 §2.5' } },
    { aspect: '配套卫生间', requirement: '配套卫生间应满足无障碍要求（坐便器、扶手、紧急呼叫）。', clause: 'G19 §2.5, §3.2' },
  ],
  parking: [
    { aspect: '车位宽度', requirement: '无障碍停车位宽≥3.50m。', clause: 'G19 §2.9.2', param: { label: '车位宽度', unit: 'm', kind: 'min', min: 3.5, clause: 'G19 §2.9.2' } },
    { aspect: '车位长度', requirement: '无障碍停车位长≥6.00m。', clause: 'G19 §2.9.2', param: { label: '车位长度', unit: 'm', kind: 'min', min: 6.0, clause: 'G19 §2.9.2' } },
    { aspect: '轮椅通道', requirement: '停车位一侧设宽度≥1.20m的轮椅通道。', clause: 'G19 §2.9.2', param: { label: '轮椅通道宽度', unit: 'm', kind: 'min', min: 1.2, clause: 'G19 §2.9.2' } },
    { aspect: '数量比例', requirement: '无障碍停车位数量≥总泊位数的0.5%（交通建筑≥1%），不少于1个。', clause: 'G19 §2.9.5', param: { label: '无障碍泊位占比', unit: '%', kind: 'min', min: 0.5, hint: '交通建筑≥1%；不少于1个（政府建筑不少于2个）', clause: 'G19 §2.9.5' } },
    { aspect: '地面标识', requirement: '停车位地面应划设无障碍停车位标线及标识，位置靠近无障碍出入口。', clause: 'G19 §2.9, §4' },
  ],
  seat: [
    { aspect: '席位尺寸', requirement: '轮椅席位宽≥0.80m×深≥1.10m。', clause: 'G63 §8.3.2', param: { label: '席位宽度', unit: 'm', kind: 'min', min: 0.8, hint: '深度≥1.10m', clause: 'G63 §8.3.2' } },
    { aspect: '席位数量', requirement: '观演建筑：轮椅席位数≥总座位的0.2%且≥2个（1000座以下≥1–2个）。', clause: 'G63 §8.3.2', condition: '设固定观众席时', param: { label: '轮椅席位占比', unit: '%', kind: 'min', min: 0.2, hint: '且不少于2个（1000座以下≥1–2个）', clause: 'G63 §8.3.2' } },
    { aspect: '陪护席与位置', requirement: '每个轮椅席位旁设1个陪护席；席位应设在视线良好、疏散便捷的位置。', clause: 'G63 §8.3.2' },
  ],
  lowdesk: [
    { aspect: '台面高度', requirement: '低位服务台台面高度0.70–0.75m。', clause: 'G63 §8.1.3', param: { label: '台面高度', unit: 'm', kind: 'range', min: 0.7, max: 0.75, clause: 'G63 §8.1.3' } },
    { aspect: '下部净空', requirement: '台面下部净空高度≥0.65m。', clause: 'G63 §8.1.3', param: { label: '下部净空高度', unit: 'm', kind: 'min', min: 0.65, clause: 'G63 §8.1.3' } },
    { aspect: '台面宽度', requirement: '低位服务台宽度≥0.70m。', clause: 'G63 §8.1.3', param: { label: '台面宽度', unit: 'm', kind: 'min', min: 0.7, clause: 'G63 §8.1.3' } },
    { aspect: '膝部净深', requirement: '膝部净深≥0.45m。', clause: 'G63 §8.1.3', param: { label: '膝部净深', unit: 'm', kind: 'min', min: 0.45, clause: 'G63 §8.1.3' } },
  ],
  blindpath: [
    { aspect: '行进盲道宽度', requirement: '行进盲道宽度0.30–0.60m。', clause: 'G63 §3.6.2', param: { label: '行进盲道宽度', unit: 'm', kind: 'range', min: 0.3, max: 0.6, clause: 'G63 §3.6.2' } },
    { aspect: '提示盲道宽度', requirement: '提示盲道宽度≥0.60m。', clause: 'G63 §3.6.2', param: { label: '提示盲道宽度', unit: 'm', kind: 'min', min: 0.6, clause: 'G63 §3.6.2' } },
    { aspect: '设置位置与连续性', requirement: '设于人行道、公交车站、地下通道、建筑出入口等；提示盲道设于转折/终点处；盲道应连续、无占用、无断点。', clause: 'G63 §3.6.3' },
  ],
  handrail: [
    { aspect: '扶手高度', requirement: '扶手高度0.85–0.90m（成人）；设双层时下层0.65m（儿童场所）。', clause: 'G19 §2.8.1', param: { label: '扶手高度', unit: 'm', kind: 'range', min: 0.85, max: 0.9, hint: '双层时下层0.65m', clause: 'G19 §2.8.1' } },
    { aspect: '延伸长度', requirement: '扶手起点和末端延伸≥0.30m。', clause: 'G19 §2.8.2–2.8.3', param: { label: '延伸长度', unit: 'm', kind: 'min', min: 0.3, clause: 'G19 §2.8.2–2.8.3' } },
    { aspect: '连续性', requirement: '扶手应连续设置，安装牢固，抓握面圆滑。', clause: 'G19 §2.8.2' },
  ],
  signage: [
    { aspect: '无障碍路线图', requirement: '应设无障碍路线图、设施位置图。', clause: 'G19 §4' },
    { aspect: '引导标识', requirement: '设无障碍设施引导标识，含盲文/触觉标识。', clause: 'G19 §4' },
    { aspect: '标识质量', requirement: '标识应醒目、清晰、系统连续。', clause: 'G19 §4' },
  ],
  shower: [
    { aspect: '淋浴间面积', requirement: '无障碍淋浴间面积≥3.50㎡。', clause: 'G19 §3.2', param: { label: '淋浴间面积', unit: '㎡', kind: 'min', min: 3.5, clause: 'G19 §3.2' } },
    { aspect: '内部设施', requirement: '设坐台、扶手、紧急呼叫装置。', clause: 'G19 §3.2' },
  ],
  alarm: [
    { aspect: '声光报警装置', requirement: '病房/居室、公共场所应设聋人紧急报警装置（声光报警器）。', clause: 'G19 §3.1.4' },
  ],
  guide: [
    { aspect: '导览/讲解设施', requirement: '应设无障碍导览/讲解设施（含语音导览、触觉地图等）。', clause: 'G63 §8.8' },
  ],
  training: [
    { aspect: '轮椅回转空间', requirement: '康复训练区应满足轮椅回转空间，直径≥1.50m。', clause: 'G63 §8.6', param: { label: '回转空间直径', unit: 'm', kind: 'min', min: 1.5, clause: 'G19 §3.1.2' } },
    { aspect: '地面', requirement: '训练区地面应平整防滑。', clause: 'G63 §8.6' },
  ],
  curbramp: [
    { aspect: '设置位置', requirement: '人行道交叉口、街坊路口、人行横道处均应设缘石坡道。', clause: 'G19 §2.10' },
    { aspect: '坡度', requirement: '缘石坡道坡度≤1:12。', clause: 'G19 §2.10', param: { label: '缘石坡道坡度', unit: '%', kind: 'max', max: 8.33, hint: '1:12≈8.33%', clause: 'G19 §2.10' } },
  ],
  // 其他无障碍设施：无预设检查点，由督导员现场自行补充条款（customItems）
  other: [],
}

/** 附加设施（矩阵 14 列之外、明细表/速查表要求的补充检查类别） */
export const EXTRA_FACILITIES: Record<string, { name: string; short: string }> = {
  signage: { name: '无障碍标识', short: '标识' },
  shower: { name: '无障碍淋浴', short: '淋浴' },
  alarm: { name: '聋人紧急报警装置', short: '紧急报警' },
  guide: { name: '无障碍导览/讲解设施', short: '导览' },
  training: { name: '无障碍康复训练区', short: '训练区' },
  curbramp: { name: '缘石坡道', short: '缘石坡道' },
  other: { name: '其他无障碍设施', short: '其他' },
}
export function facilityName(id: string): string {
  return FACILITY_MAP[id]?.name ?? EXTRA_FACILITIES[id]?.name ?? id
}

/** 无障碍标识配置等级：明细表明确"必须设置"的类型为 M，推荐类型为 R，其余 C */
const SIGNAGE_M = new Set(['gov', 'hospital', 'clinic', 'rehab', 'station', 'airport', 'metro', 'library', 'museum', 'culturecenter', 'stadium', 'theater', 'cinema', 'university'])
function signageLevel(subtypeId: string): 'M' | 'C' | 'R' {
  if (subtypeId === 'community') return 'R'
  return SIGNAGE_M.has(subtypeId) ? 'M' : 'C'
}
/** 矩阵之外的附加设施适用类型与等级（源自清单明细表/速查表） */
export const EXTRA_LEVELS: Record<string, Record<string, 'M' | 'C' | 'R'>> = {
  shower: { gym: 'M', rehab: 'M' },
  alarm: { elderly: 'M', hospital: 'M', rehab: 'M', station: 'M', airport: 'M', metro: 'M' },
  guide: { station: 'M', airport: 'M', metro: 'M', culturecenter: 'M', library: 'C', memorial: 'C' },
  training: { rehab: 'M' },
  curbramp: { road: 'M', community: 'M' },
}

/** 类型差异化参数补丁（按清单明细表的类型特定阈值） */
export const PARAM_PATCH: Record<string, Record<string, ParamSpec>> = {
  'hospital:passage': { '净宽': { label: '通道净宽', unit: 'm', kind: 'min', min: 1.5, hint: '满足担架通行', clause: 'G19 §2.2' } },
  'rehab:passage': { '净宽': { label: '通道净宽', unit: 'm', kind: 'min', min: 1.8, hint: '满足轮椅双向通行', clause: 'G63 §8.6.2' } },
  'station:passage': { '净宽': { label: '通道净宽', unit: 'm', kind: 'min', min: 1.5, hint: '满足行李+轮椅通行', clause: 'G19 §2.2' } },
  'airport:passage': { '净宽': { label: '通道净宽', unit: 'm', kind: 'min', min: 1.5, hint: '满足行李+轮椅通行', clause: 'G19 §2.2' } },
  'metro:passage': { '净宽': { label: '通道净宽', unit: 'm', kind: 'min', min: 1.5, clause: 'G19 §2.2' } },
  'library:passage': { '净宽': { label: '通道净宽', unit: 'm', kind: 'min', min: 1.5, clause: 'G19 §2.2' } },
  'museum:passage': { '净宽': { label: '通道净宽', unit: 'm', kind: 'min', min: 1.5, clause: 'G19 §2.2' } },
  'square:passage': { '净宽': { label: '通道净宽', unit: 'm', kind: 'min', min: 1.5, clause: 'G19 §2.2' } },
  'mall:passage': { '净宽': { label: '购物通道净宽', unit: 'm', kind: 'min', min: 1.5, hint: '满足轮椅双向通行', clause: 'G19 §2.2' } },
  'station:parking': { '数量比例': { label: '无障碍泊位占比', unit: '%', kind: 'min', min: 1, hint: '交通建筑≥1%', clause: 'G19 §2.9' } },
  'airport:parking': { '数量比例': { label: '无障碍泊位占比', unit: '%', kind: 'min', min: 1, hint: '交通建筑≥1%', clause: 'G19 §2.9' } },
  'metro:parking': { '数量比例': { label: '无障碍泊位占比', unit: '%', kind: 'min', min: 1, hint: '交通建筑≥1%', clause: 'G19 §2.9' } },
  'house:room': { '房间面积': { label: '起居室面积', unit: '㎡', kind: 'min', min: 16, hint: '厨房≥6.00㎡、卫生间≥4.00㎡', clause: 'G19 §2.5' } },
  'elderly:room': { '房间面积': { label: '居室面积', unit: '㎡', kind: 'min', min: 16, hint: '无障碍住房起居室≥16.00㎡', clause: 'G19 §2.5' } },
}

/** 展开后的检查项（一个设施类别 → 多个检查点） */
export interface CheckItem {
  key: string             // `${facility}#${idx}`
  subtype: string
  facility: string
  aspect: string
  level: Exclude<Level, 'NA'>
  requirement: string
  clause: string
  condition?: string
  typeNote?: string       // 清单明细表中该类型的总体要求
  typeClause?: string
  param?: ParamSpec
}

/** 生成某建筑具体分类的现场核查表：配置矩阵决定设施范围，检查点模板覆盖全部技术参数，类型明细差异化 */
export function buildChecklist(subtypeId: string): CheckItem[] {
  const levels = MATRIX[subtypeId] || []
  const items: CheckItem[] = []
  const push = (facility: string, level: Exclude<Level, 'NA'>, cond?: string) => {
    const detail = DETAILS.find(c => c.subtype === subtypeId && c.facility === facility)
    const patch = PARAM_PATCH[`${subtypeId}:${facility}`] ?? {}
    const aspects = FACILITY_ASPECTS[facility] ?? []
    aspects.forEach((a, idx) => {
      items.push({
        key: `${facility}#${idx}`,
        subtype: subtypeId, facility, aspect: a.aspect, level,
        requirement: a.requirement, clause: (patch[a.aspect]?.clause ?? a.clause),
        condition: detail?.condition ?? cond ?? a.condition,
        typeNote: detail?.requirement, typeClause: detail?.clause,
        param: patch[a.aspect] ?? a.param,
      })
    })
  }
  FACILITIES.forEach((fac, i) => {
    const level = levels[i]
    if (!level || level === 'NA') return
    push(fac.id, level, level === 'C' ? FACILITY_GENERIC[fac.id]?.condition : undefined)
  })
  push('signage', signageLevel(subtypeId))
  Object.entries(EXTRA_LEVELS).forEach(([fac, m]) => {
    const lv = m[subtypeId]
    if (lv) push(fac, lv)
  })
  // 其他无障碍设施：所有建筑类型均可由督导员现场补充；按推荐级处理（缺失不立案，不合格为建议改进）
  push('other', 'R')
  // 排序：必须 > 条件 > 推荐；同级保持设施顺序
  const rank = (l: string) => (l === 'M' ? 0 : l === 'C' ? 1 : 2)
  return items.sort((a, b) => rank(a.level) - rank(b.level))
}

/** 按设施聚合（第2步设施实例配置用） */
export interface FacilityRow {
  facility: string
  level: Exclude<Level, 'NA'>
  typeNote?: string
  typeClause?: string
  condition?: string
  items: CheckItem[]
}
export function buildFacilityRows(subtypeId: string): FacilityRow[] {
  const items = buildChecklist(subtypeId)
  const rows: FacilityRow[] = []
  items.forEach(it => {
    let r = rows.find(x => x.facility === it.facility)
    if (!r) {
      r = { facility: it.facility, level: it.level, typeNote: it.typeNote, typeClause: it.typeClause, condition: it.condition, items: [] }
      rows.push(r)
    }
    r.items.push(it)
  })
  // 其他无障碍设施无预设检查点（自定义条款），确保其行始终存在于设施选择面板
  if (!rows.some(r => r.facility === 'other')) {
    rows.push({ facility: 'other', level: 'R', items: [] })
  }
  return rows
}

/** 参数速查表（清单"三、关键技术参数速查表"全量覆盖） */
export const PARAM_TABLE = [
  { facility: '无障碍坡道', param: '坡度', value: '≤1:12（每段提升高度≤750mm）；≤1:10（条件受限且高差≤150mm）；每段水平长度超9m应设休息平台', clause: 'G19 §2.3.1' },
  { facility: '无障碍坡道', param: '净宽', value: '≥1.20m', clause: 'G19 §2.3.2' },
  { facility: '无障碍坡道', param: '休息平台', value: '净深≥1.50m；转弯处应设休息平台', clause: 'G19 §2.3.3' },
  { facility: '无障碍坡道', param: '扶手/挡台/盲道', value: '两侧设扶手（0.85–0.90m）；坡道两侧设挡台；起点终点设盲道', clause: 'G19 §2.3.4–2.3.5' },
  { facility: '无障碍通道', param: '净宽', value: '≥1.20m（一段）；≥1.50m（有高差处）', clause: 'G19 §2.2.2' },
  { facility: '无障碍通道', param: '地面', value: '平整防滑，不设门槛；地面高差≤15mm时应做斜面过渡', clause: 'G19 §2.1.4, §2.5.3' },
  { facility: '无障碍通道', param: '轮椅回转空间', value: '直径≥1.50m；通道端部及转折处应设', clause: 'G19 §3.1.2' },
  { facility: '无障碍门', param: '有效通行净宽', value: '自动门≥1.00m；手动门≥0.90m（新建/扩建）、≥0.80m（改造）', clause: 'G19 §2.5.4, §2.5.5' },
  { facility: '无障碍门', param: '门扇/把手', value: '把手高度0.85–1.00m；门下方设护门板；不宜设弹簧门', clause: 'G19 §2.5.4, §2.5.8' },
  { facility: '无障碍电梯', param: '轿厢尺寸', value: '门净宽≥0.90m（新/扩）、≥0.80m（改造）；深度≥1.40m；宽度≥1.10m；轿厢三面设扶手', clause: 'G19 §2.6.2, §2.6.3' },
  { facility: '无障碍电梯', param: '按钮', value: '高度0.85–1.10m，带盲文', clause: 'G19 §2.6.1' },
  { facility: '无障碍电梯', param: '语音/显示', value: '到层语音报层；轿厢外设楼层显示', clause: 'G19 §2.6.1' },
  { facility: '无障碍楼梯', param: '踏步', value: '踏面宽≥0.28m、踏面高≤0.16m、防滑；不宜设弧形踏步', clause: 'G19 §2.7' },
  { facility: '无障碍楼梯', param: '扶手/休息平台', value: '两侧设扶手（0.85–0.90m）；休息平台净深≥1.50m；扶手起点终点延伸≥0.30m', clause: 'G19 §2.7' },
  { facility: '无障碍厕所/卫生间', param: '使用面积（无障碍厕所）', value: '新建≥4.00㎡；改建受限制≥2.00㎡', clause: 'G19 §3.2.1' },
  { facility: '无障碍厕所/卫生间', param: '无障碍厕位', value: '≥1.80m×1.00m', clause: 'G19 §3.2' },
  { facility: '无障碍厕所/卫生间', param: '坐便器/洗手盆', value: '坐便器高0.40–0.45m，两侧设扶手；洗手盆台面0.80m，下方净空≥0.65m', clause: 'G19 §3.1.8, §3.1.10' },
  { facility: '无障碍厕所/卫生间', param: '紧急呼叫', value: '距坐便器0.40–0.50m处设紧急呼叫按钮，距地0.40m', clause: 'G19 §3.1.4' },
  { facility: '无障碍住房/客房/病房', param: '无障碍住房', value: '起居室≥16.00㎡；厨房≥6.00㎡；卫生间≥4.00㎡', clause: 'G19 §2.5' },
  { facility: '无障碍住房/客房/病房', param: '无障碍客房', value: '面积≥7.00㎡；卫生间满足无障碍要求', clause: 'G19 §2.5' },
  { facility: '无障碍住房/客房/病房', param: '门宽', value: '≥0.80m', clause: 'G19 §2.5' },
  { facility: '无障碍停车位', param: '宽度/长度', value: '宽≥3.50m；长≥6.00m；一侧设轮椅通道≥1.20m', clause: 'G19 §2.9.2, §2.9.5' },
  { facility: '无障碍停车位', param: '数量', value: '≥总泊位数的0.5%（交通建筑≥1%），不少于1个', clause: 'G19 §2.9.2, §2.9.5' },
  { facility: '扶手', param: '高度', value: '0.85–0.90m（成人）；0.65m（儿童/双层时下层）', clause: 'G19 §2.8.1' },
  { facility: '扶手', param: '连续性', value: '连续设置；起点和末端延伸≥0.30m', clause: 'G19 §2.8.2–2.8.3' },
  { facility: '盲道', param: '宽度', value: '行进盲道≥0.30–0.60m；提示盲道≥0.60m', clause: 'G63 §3.6.2' },
  { facility: '盲道', param: '设置位置', value: '人行道、公交车站、地下通道、建筑出入口等；提示盲道设于转折/终点', clause: 'G63 §3.6.3' },
  { facility: '无障碍席位', param: '轮椅席位', value: '宽≥0.80m×深≥1.10m；观演建筑≥总座位0.2%且≥2个；每个席位旁设1个陪护席', clause: 'G63 §8.3.2' },
  { facility: '低位服务台', param: '台面高度/下部净空', value: '台面高度0.70–0.75m；下部净空高度≥0.65m；宽度≥0.70m；膝部净深≥0.45m', clause: 'G63 §8.1.3' },
  { facility: '无障碍淋浴', param: '面积/设施', value: '面积≥3.50㎡；设坐台、扶手、紧急呼叫', clause: 'G19 §3.2' },
  { facility: '无障碍标识', param: '标识系统', value: '含无障碍路线图、设施位置图、引导标识（含盲文/触觉标识）；标识应醒目、清晰', clause: 'G19 §4' },
]

/** 自动判定 */
export function judgeParam(p: ParamSpec, v: number): boolean {
  if (p.kind === 'min') return v >= (p.min ?? -Infinity)
  if (p.kind === 'max') return v <= (p.max ?? Infinity)
  return v >= (p.min ?? -Infinity) && v <= (p.max ?? Infinity)
}
