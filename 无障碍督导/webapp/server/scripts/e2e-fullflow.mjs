/**
 * 无障碍督导系统 — 全流程 E2E 测试（数据保留版）
 * 覆盖：4 个代表项目 × （任务认领→GPS签到→现场检查提交→问题单自动生成→立案派单→整改反馈→复查销号/退回）
 * 运行：node e2e-fullflow.mjs   （需后端已启动，默认 http://localhost:3100/api）
 */
const BASE = process.env.E2E_BASE ?? 'http://localhost:3100/api';

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  return data;
}

const login = (phone) =>
  api('POST', '/auth/login', { body: { phone, password: '123456' } }).then((d) => d.token);

const P = (v) => ({ verdict: v });
const M = (measured, v) => ({ measured, verdict: v });
const ins = (id, facility, no, locationDesc, checks, note = '') =>
  ({ id, facility, no, locationDesc, applicable: true, checks, photos: [], note });

const log = (msg) => console.log(`\x1b[36m${msg}\x1b[0m`);
const ok = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);

async function main() {
  console.log(`E2E 全流程测试 → ${BASE}\n`);

  const [hzAdmin, hzInsp, cdAdmin, cdInsp] = await Promise.all([
    login('13800000001'), login('13800000002'), login('13800000003'), login('13800000004'),
  ]);
  ok('4 个账号登录成功（杭州 admin/督导员、成都 admin/督导员）');

  /* ================= 项目 1：地铁2号线文新站（metro，13 必须项 + 条件项不立案） ================= */
  log('\n【项目1】地铁2号线文新站（metro）— 任务 t3（任务池认领）');
  await api('POST', '/tasks/t3/claim', { token: hzInsp });
  const st1 = await api('POST', '/tasks/t3/start', { token: hzInsp, body: { lat: 30.285, lng: 120.099 } });
  ok(`李强从任务池认领 t3 并签到（距点位 ${st1.startDistance ?? 0}m）`);

  const sub1 = await api('POST', '/inspections', {
    token: hzInsp,
    body: {
      taskId: 't3',
      mainInfo: { floors: '2', nature: '既有', contact: '站务员张某', contactPhone: '0571-88000004', collectStatus: 'ok', note: '站厅层及出入口现场核查。车站无配建停车场。', photos: [] },
      instances: [
        ins('m-ins1', 'entrance', 1, 'A出入口', { 'entrance#0': P('pass'), 'entrance#1': M('1.6', 'pass'), 'entrance#2': M('1.5', 'pass') }),
        ins('m-ins2', 'passage', 1, '站厅至站台通道', { 'passage#0': M('1.3', 'fail'), 'passage#1': P('pass'), 'passage#2': M('1.5', 'pass') }, '客流高峰有围栏收窄'),
        ins('m-ins3', 'elevator', 1, '站厅-站台垂直电梯', { 'elevator#0': M('0.9', 'pass'), 'elevator#1': M('1.5', 'pass'), 'elevator#2': P('fail'), 'elevator#3': P('fail') }, '按钮无盲文、无到层语音'),
        ins('m-ins4', 'toilet', 1, '站厅无障碍厕所', { 'toilet#0': M('4.5', 'pass'), 'toilet#1': M('1.1', 'pass'), 'toilet#2': M('0.42', 'pass'), 'toilet#3': M('0.68', 'pass'), 'toilet#4': P('pass') }),
      ],
      condTriggered: [], // 卫生间(C)、门(C) 未确认触发，不立案；停车位为交通建筑必须项(≥1%)，缺失即立案
    },
  });
  const iss1 = sub1.issues;
  ok(`提交检查记录 ${sub1.inspection.id}（checklib v${sub1.inspection.checklibVersion}），自动生成问题单 ${iss1.length} 条`);
  console.log('    问题单明细：');
  iss1.forEach((i) => console.log(`      - [${i.severity}/${i.status}] ${i.title}`));
  const expect1 = 9 /* M缺失: 坡道/楼梯/停车位/低位台/盲道/扶手/标识/报警/导览 */ + 3 /* fail: 通道净宽、电梯按钮、电梯语音 */;
  if (iss1.length !== expect1) throw new Error(`项目1问题单数应为 ${expect1}，实际 ${iss1.length}`);
  if (iss1.some((i) => ['bathroom', 'door'].includes(i.facility))) throw new Error('项目1：条件项未被确认却生成了问题单');
  ok('验证通过：9 条必须项缺失（含交通建筑必须的停车位）+ 3 条不合格 = 12 条；卫生间/门(C) 未确认不立案');

  // 问题单流转：坡道缺失走完整闭环；通道不合格走到"复查退回"；盲道缺失走到"派单"；其余留 open
  const iss1Ramp = iss1.find((i) => i.facility === 'ramp');
  await api('POST', `/issues/${iss1Ramp.id}/advance`, { token: hzAdmin, body: { responsible: '杭州地铁集团运营分公司', deadline: '2026-09-10', note: '列入车站无障碍改造计划' } });
  await api('POST', `/issues/${iss1Ramp.id}/advance`, { token: hzInsp, body: { note: 'A出入口已增设轮椅坡道，坡度1:12，附整改照片' } });
  await api('POST', `/issues/${iss1Ramp.id}/advance`, { token: hzInsp, body: {} });
  await api('POST', `/issues/${iss1Ramp.id}/advance`, { token: hzInsp, body: { note: '现场复核坡道坡度/扶手/提示盲道均符合要求' } });
  ok('坡道缺失问题单：open→assigned→fixing→recheck→closed（完整闭环销号）');

  const iss1Passage = iss1.find((i) => i.facility === 'passage');
  await api('POST', `/issues/${iss1Passage.id}/advance`, { token: hzAdmin, body: { responsible: '地铁文新站站务中心', deadline: '2026-09-05' } });
  await api('POST', `/issues/${iss1Passage.id}/advance`, { token: hzInsp, body: { note: '已移除通道内围栏及杂物' } });
  await api('POST', `/issues/${iss1Passage.id}/advance`, { token: hzInsp, body: {} });
  await api('POST', `/issues/${iss1Passage.id}/advance`, { token: hzAdmin, body: { to: 'fixing', note: '复核实测净宽仍1.35m，围栏未完全移除，退回整改' } });
  ok('通道净宽问题单：派单→整改→申请复查→复查不通过退回（当前 fixing）');

  const iss1Blind = iss1.find((i) => i.facility === 'blindpath');
  await api('POST', `/issues/${iss1Blind.id}/advance`, { token: hzAdmin, body: { responsible: '杭州地铁集团运营分公司', deadline: '2026-09-20' } });
  ok('盲道缺失问题单：已立案派单（当前 assigned）；其余 8 条保留 open 待办');

  /* ================= 项目 2：西溪湿地广场（square，条件不触发不立案 + 双问题单闭环 → 点位销号） ================= */
  log('\n【项目2】西溪湿地周家村出入口广场（square）— 新建任务');
  const t2 = await api('POST', '/tasks', { token: hzAdmin, body: { pointId: 'p8', title: '广场无障碍设施专项督导（E2E）', deadline: '2026-08-27', mode: 'assign', assigneeId: 'u-hz-insp' } });
  await api('POST', `/tasks/${t2.id}/start`, { token: hzInsp, body: { lat: 30.266, lng: 120.068 } });
  ok(`王敏创建指派任务 ${t2.id}，李强签到`);

  const sub2 = await api('POST', '/inspections', {
    token: hzInsp,
    body: {
      taskId: t2.id,
      mainInfo: { floors: '1', nature: '既有', contact: '管委会值班室', contactPhone: '0571-88000008', collectStatus: 'ok', note: '开放式广场，无配建停车场。', photos: [] },
      instances: [
        ins('s-ins1', 'entrance', 1, '主出入口', { 'entrance#0': P('pass'), 'entrance#1': M('1.8', 'pass'), 'entrance#2': M('1.6', 'pass') }),
        ins('s-ins2', 'passage', 1, '广场主通道', { 'passage#0': M('1.6', 'pass'), 'passage#1': P('pass'), 'passage#2': M('1.5', 'pass') }),
        ins('s-ins3', 'toilet', 1, '广场公共厕所', { 'toilet#0': M('4.2', 'pass'), 'toilet#1': M('1.0', 'pass'), 'toilet#2': M('0.43', 'pass'), 'toilet#3': M('0.7', 'pass'), 'toilet#4': P('fail') }, '未设紧急呼叫按钮'),
      ],
      condTriggered: [], // 无停车场 → 停车位(C)不立案；盲道(C)亦不确认
    },
  });
  const iss2 = sub2.issues;
  ok(`提交检查记录，自动生成问题单 ${iss2.length} 条：${iss2.map((i) => i.title).join('；')}`);
  if (iss2.length !== 2) throw new Error(`项目2问题单数应为 2，实际 ${iss2.length}`);
  ok('验证通过：仅"缺少必须设置的无障碍坡道"与"厕所·紧急呼叫不符合"2 条；停车位(C)条件不触发未立案');

  for (const i of iss2) {
    await api('POST', `/issues/${i.id}/advance`, { token: hzAdmin, body: { responsible: '西溪湿地管委会物业部', deadline: '2026-09-01' } });
    await api('POST', `/issues/${i.id}/advance`, { token: hzInsp, body: { note: '已完成整改' } });
    await api('POST', `/issues/${i.id}/advance`, { token: hzInsp, body: {} });
    await api('POST', `/issues/${i.id}/advance`, { token: hzInsp, body: { note: '复查合格' } });
  }
  const pt8 = await api('GET', '/points/p8', { token: hzAdmin });
  ok(`2 条问题单全部闭环销号，点位状态 → ${pt8.point.status}`);
  if (pt8.point.status !== 'closed') throw new Error('项目2点位应为 closed');

  /* ================= 项目 3：华西第二医院锦江院区（hospital，跨组织 + 条件项确认触发立案） ================= */
  log('\n【项目3】四川大学华西第二医院锦江院区（hospital，成都组织）— 新建任务');
  const t3 = await api('POST', '/tasks', { token: cdAdmin, body: { pointId: 'p10', title: '医院无障碍设施专项督导（E2E）', deadline: '2026-08-30', mode: 'assign', assigneeId: 'u-cd-insp' } });
  await api('POST', `/tasks/${t3.id}/start`, { token: cdInsp, body: { lat: 30.59, lng: 104.11 } });
  ok(`陈芳创建指派任务 ${t3.id}，赵磊签到`);

  const sub3 = await api('POST', '/inspections', {
    token: cdInsp,
    body: {
      taskId: t3.id,
      mainInfo: { floors: '5', nature: '新建', contact: '院办李主任', contactPhone: '028-86000002', collectStatus: 'ok', note: '门急诊楼核查。院内有地面停车场，未发现无障碍停车位。', photos: [] },
      instances: [
        ins('h-ins1', 'entrance', 1, '门诊主入口', { 'entrance#0': P('pass'), 'entrance#1': M('1.6', 'pass'), 'entrance#2': M('1.5', 'pass') }),
        ins('h-ins2', 'passage', 1, '门诊至住院连廊', { 'passage#0': M('1.6', 'pass'), 'passage#1': P('pass'), 'passage#2': M('1.5', 'pass') }),
        ins('h-ins3', 'elevator', 1, '医梯3号', { 'elevator#0': M('0.95', 'pass'), 'elevator#1': M('1.5', 'pass'), 'elevator#2': M('0.9', 'pass'), 'elevator#3': P('pass') }),
        ins('h-ins4', 'toilet', 1, '门诊一层无障碍厕所', { 'toilet#0': M('4.3', 'pass'), 'toilet#1': M('1.05', 'pass'), 'toilet#2': M('0.44', 'pass'), 'toilet#3': M('0.66', 'pass'), 'toilet#4': P('pass') }),
        ins('h-ins5', 'lowdesk', 1, '挂号收费窗口', { 'lowdesk#0': M('0.72', 'pass'), 'lowdesk#1': M('0.67', 'pass'), 'lowdesk#2': M('0.75', 'pass'), 'lowdesk#3': M('0.5', 'pass') }),
        ins('h-ins6', 'blindpath', 1, '入口至导诊台', { 'blindpath#0': M('0.4', 'pass'), 'blindpath#1': M('0.6', 'pass'), 'blindpath#2': P('pass') }),
      ],
      condTriggered: ['parking'], // 现场确认：医院设有停车场 → 条件触发，未设无障碍车位应立案
    },
  });
  const iss3 = sub3.issues;
  ok(`提交检查记录，自动生成问题单 ${iss3.length} 条`);
  console.log('    问题单明细：');
  iss3.forEach((i) => console.log(`      - [${i.severity}/${i.status}] ${i.title}`));
  const expect3 = 7 /* M缺失: 坡道/楼梯/卫生间/病房/扶手/标识/报警 */ + 1 /* C确认: 停车位 */;
  if (iss3.length !== expect3) throw new Error(`项目3问题单数应为 ${expect3}，实际 ${iss3.length}`);
  const parkIssue = iss3.find((i) => i.facility === 'parking');
  if (!parkIssue || parkIssue.severity !== 'C') throw new Error('项目3：停车位(C)确认触发后应立案');
  ok('验证通过：7 条必须项缺失 + 停车位(C)经确认触发立案（"医院设有停车场但未设无障碍车位"）');

  const roomIssue = iss3.find((i) => i.facility === 'room');
  await api('POST', `/issues/${roomIssue.id}/advance`, { token: cdAdmin, body: { responsible: '华西第二医院后勤保障部', deadline: '2026-09-15', note: '每科室至少1间无障碍病房' } });
  const alarmIssue = iss3.find((i) => i.facility === 'alarm');
  await api('POST', `/issues/${alarmIssue.id}/advance`, { token: cdAdmin, body: { responsible: '华西第二医院信息科', deadline: '2026-09-05' } });
  await api('POST', `/issues/${alarmIssue.id}/advance`, { token: cdInsp, body: { note: '病房及公共区域声光报警装置已安装调试' } });
  ok('病房缺失→已派单（assigned）；聋人报警→已整改反馈（fixing）；其余 6 条保留 open');

  /* ================= 项目 4：文三路人行道（road，缘石坡道实测判定） ================= */
  log('\n【项目4】文三路人行道（road）— 任务 t4（任务池认领）');
  await api('POST', '/tasks/t4/claim', { token: hzInsp });
  await api('POST', '/tasks/t4/start', { token: hzInsp, body: { lat: 30.279, lng: 120.108 } });
  const sub4 = await api('POST', '/inspections', {
    token: hzInsp,
    body: {
      taskId: 't4',
      mainInfo: { floors: '', nature: '既有', contact: '城管网格员', contactPhone: '0571-88000007', collectStatus: 'ok', note: '古翠路—丰潭路段北侧，沿线 3 处路口核查。', photos: [] },
      instances: [
        ins('r-ins1', 'curbramp', 1, '古翠路交叉口东北角', { 'curbramp#0': P('pass'), 'curbramp#1': M('9.5', 'fail') }, '缘石坡道坡度过大'),
        ins('r-ins2', 'blindpath', 1, '沿线行进盲道', { 'blindpath#0': M('0.4', 'pass'), 'blindpath#1': M('0.6', 'pass'), 'blindpath#2': P('pass') }),
        ins('r-ins3', 'passage', 1, '人行道全段', { 'passage#0': M('1.4', 'pass'), 'passage#1': P('pass'), 'passage#2': M('1.5', 'pass') }),
      ],
      condTriggered: [],
    },
  });
  const iss4 = sub4.issues;
  ok(`提交检查记录，生成问题单 ${iss4.length} 条：${iss4.map((i) => i.title).join('；')}`);
  if (iss4.length !== 1 || iss4[0].facility !== 'curbramp') throw new Error('项目4：应仅生成 1 条缘石坡道问题单');
  ok('验证通过：缘石坡道坡度实测 9.5% > 8.33%（1:12）自动判定不符合，立案 1 条；盲道/人行道合格');
  await api('POST', `/issues/${iss4[0].id}/advance`, { token: hzAdmin, body: { responsible: '西湖区城管局市政科', deadline: '2026-09-08' } });
  await api('POST', `/issues/${iss4[0].id}/advance`, { token: hzInsp, body: { note: '已安排改造缘石坡道坡度' } });
  ok('缘石坡道问题单：已派单并反馈整改（当前 fixing）');

  /* ================= 汇总 ================= */
  log('\n========== 全流程测试完成，保留数据如下 ==========');
  const tasks = await api('GET', '/tasks', { token: hzAdmin });
  const issuesHz = await api('GET', '/issues', { token: hzAdmin });
  const issuesCd = await api('GET', '/issues', { token: cdAdmin });
  const byStatus = (arr) => arr.reduce((m, i) => ({ ...m, [i.status]: (m[i.status] ?? 0) + 1 }), {});
  console.log(`杭州组织：任务 ${tasks.length} 个；问题单 ${issuesHz.length} 条，状态分布 ${JSON.stringify(byStatus(issuesHz))}`);
  console.log(`成都组织：问题单 ${issuesCd.length} 条，状态分布 ${JSON.stringify(byStatus(issuesCd))}`);
  const stats = await api('GET', '/stats/overview', { token: hzAdmin });
  console.log(`杭州统计：点位 ${stats.pointsTotal}，已督导 ${stats.inspectedPoints ?? '-'}，问题 ${stats.issuesTotal}，销号 ${stats.issuesClosed ?? '-'}`);
  console.log('\n可用演示账号登录 http://localhost:5173 核查（密码 123456）：');
  console.log('  13800000001 王敏(杭州管理员) / 13800000002 李强(杭州督导员)');
  console.log('  13800000003 陈芳(成都管理员) / 13800000004 赵磊(成都督导员)');
}

main().catch((e) => { console.error('\x1b[31m✗ E2E 失败:\x1b[0m', e.message); process.exit(1); });
