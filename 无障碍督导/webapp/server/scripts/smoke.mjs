/**
 * 全国无障碍督导系统 - 后端冒烟测试
 * 用法：先启动服务（node dist/main.js），再执行 node scripts/smoke.mjs
 */
const BASE = process.env.SMOKE_BASE ?? 'http://localhost:3000/api';

let passed = 0;
let failed = 0;
const ok = (cond, label) => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
};
const section = (t) => console.log(`\n== ${t} ==`);

async function api(method, path, { token, body, raw, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h['Authorization'] = `Bearer ${token}`;
  let payload;
  if (raw !== undefined) {
    payload = raw;
  } else if (body !== undefined) {
    h['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body: payload });
  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('json') ? await res.json() : await res.arrayBuffer();
  return { status: res.status, data };
}

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** ---------------- 1. 认证 ---------------- */
section('认证：登录 5 个种子账号 + 错误密码 401');
const bad = await api('POST', '/auth/login', { body: { phone: '13800000001', password: 'wrong-pass' } });
ok(bad.status === 401, `错误密码返回 401（实际 ${bad.status}）`);

const accounts = {
  platform: '13900000000',
  hzAdmin: '13800000001',
  hzInsp: '13800000002',
  cdAdmin: '13800000003',
  cdInsp: '13800000004',
};
const T = {};
for (const [k, phone] of Object.entries(accounts)) {
  const r = await api('POST', '/auth/login', { body: { phone, password: '123456' } });
  ok(r.status === 201 && r.data.token, `登录 ${phone}（${k}）`);
  T[k] = r.data.token;
  if (k === 'platform') ok(r.data.org === null, 'platform_admin 登录 org 为 null');
  if (k === 'hzAdmin') ok(r.data.org?.id === 'org-hz' && r.data.user?.role === 'admin', '王敏 org=org-hz role=admin');
}
const noToken = await api('GET', '/auth/me');
ok(noToken.status === 401, `无 token 访问返回 401（实际 ${noToken.status}）`);

const me = await api('GET', '/auth/me', { token: T.hzAdmin });
ok(me.status === 200 && me.data.user?.phone === '13800000001' && me.data.org?.id === 'org-hz', 'GET /auth/me');
const meP = await api('GET', '/auth/me', { token: T.platform });
ok(meP.status === 200 && meP.data.org === null && meP.data.user?.role === 'platform_admin', 'platform_admin /auth/me org=null');

section('检查项库');
const lib = await api('GET', '/checklib', { token: T.hzAdmin });
ok(lib.status === 200 && lib.data.version === '1.4', "checklib version='1.4'");
ok(Array.isArray(lib.data.facilities) && lib.data.facilities.length === 14, 'checklib facilities=14');
ok(lib.data.matrix && lib.data.aspects && lib.data.paramTable && lib.data.details, 'checklib 全字段序列化');
const profs = await api('GET', '/check-profiles', { token: T.hzAdmin });
ok(profs.status === 200 && profs.data.some((p) => p.id === 'prof-quick' && p.name === '督导员快速检查表'), '检查项配置含内置版本"督导员快速检查表"');
const profDetail = await api('GET', '/check-profiles/prof-quick', { token: T.hzAdmin });
ok(profDetail.status === 200 && profDetail.data.payload?.matrix && profDetail.data.description.length > 10, '配置详情含完整 payload 与配置说明');

/** ---------------- 2. 租户隔离 ---------------- */
section('租户隔离');
const cdPoints = await api('GET', '/points', { token: T.cdAdmin });
ok(cdPoints.status === 200 && cdPoints.data.every((p) => p.orgId === 'org-cd'), '成都用户 GET /points 仅本组织');
ok(!cdPoints.data.some((p) => p.id === 'p1'), '成都用户列表不含 p1');
const cross = await api('GET', '/points/p1', { token: T.cdAdmin });
ok(cross.status === 404, `成都用户 GET /points/p1 返回 404（实际 ${cross.status}）`);
const hzP1 = await api('GET', '/points/p1', { token: T.hzAdmin });
ok(hzP1.status === 200 && hzP1.data.point?.id === 'p1' && Array.isArray(hzP1.data.tasks) && Array.isArray(hzP1.data.issues), '杭州 GET /points/p1 → {point,tasks,issues,inspections}');

/** ---------------- 3. 行动/点位/任务 ---------------- */
section('行动创建（区域内成功 / 区域外 422）');
const badCampaign = await api('POST', '/campaigns', {
  token: T.hzAdmin,
  body: { name: '越界行动', regionDesc: '测试', bounds: [[31.0, 121.0], [31.1, 121.1]] },
});
ok(badCampaign.status === 422, `区域外创建行动 422（实际 ${badCampaign.status}）`);
const campaign = await api('POST', '/campaigns', {
  token: T.hzAdmin,
  body: { name: '冒烟测试督导行动', regionDesc: '黄龙片区', bounds: [[30.25, 120.1], [30.29, 120.14]] },
});
ok(campaign.status === 201 && campaign.data.id?.startsWith('c-'), `区域内创建行动成功（${campaign.data.id}）`);
ok(campaign.data.profileId === 'prof-quick', '行动默认采用检查项配置"督导员快速检查表"');
const badProfile = await api('POST', '/campaigns', {
  token: T.hzAdmin,
  body: { name: '错误配置行动', profileId: 'prof-none' },
});
ok(badProfile.status === 422, `不存在的检查项配置 422（实际 ${badProfile.status}）`);
const cid = campaign.data.id;
const noBoundsCampaign = await api('POST', '/campaigns', {
  token: T.hzAdmin,
  body: { name: '不划范围行动' },
});
ok(noBoundsCampaign.status === 201 && noBoundsCampaign.data.bounds === null, `不划定范围创建行动成功（bounds=null，实际 ${noBoundsCampaign.status}）`);

section('点位创建（建筑）');
const point1 = await api('POST', '/points', {
  token: T.hzAdmin,
  body: { campaignId: cid, kind: 'building', name: '冒烟测试广场A', address: '西湖区黄龙路100号', lat: 30.265, lng: 120.125, subtypeId: 'square', nature: '既有', owner: '测试单位', contact: '0571-00000000' },
});
ok(point1.status === 201 && point1.data.status === 'pending' && point1.data.locked === true, `创建建筑点位A（${point1.data.id}）status=pending locked=true`);
const pidA = point1.data.id;
const point2 = await api('POST', '/points', {
  token: T.hzAdmin,
  body: { campaignId: cid, kind: 'building', name: '冒烟测试广场B', address: '西湖区黄龙路101号', lat: 30.266, lng: 120.126, subtypeId: 'square', nature: '既有', owner: '测试单位', contact: '0571-00000001' },
});
const pidB = point2.data.id;
ok(point2.status === 201, `创建建筑点位B（${pidB}）`);
const outPoint = await api('POST', '/points', {
  token: T.hzAdmin,
  body: { campaignId: cid, kind: 'building', name: '越界点位', address: 'x', lat: 31.0, lng: 121.0, subtypeId: 'square', nature: '既有', owner: 'x', contact: 'x' },
});
ok(outPoint.status === 422 && String(outPoint.data.message).includes('点位超出组织督导区域'), `组织区域外建点 422「${outPoint.data.message}」`);
const roadNoEnd = await api('POST', '/points', {
  token: T.hzAdmin,
  body: { campaignId: cid, kind: 'road', name: '缺终点道路', address: 'x', lat: 30.265, lng: 120.125, subtypeId: 'road', nature: '既有', owner: 'x', contact: 'x' },
});
ok(roadNoEnd.status === 422, `道路类缺 lat2/lng2 → 422（实际 ${roadNoEnd.status}）`);
const outOfCampaign = await api('POST', '/points', {
  token: T.hzAdmin,
  body: { campaignId: cid, kind: 'building', name: '行动范围外点位', lat: 30.205, lng: 120.06, subtypeId: 'square', nature: '既有', owner: 'x', contact: 'x', publishTask: true, taskDeadline: '2026-10-01' },
});
ok(outOfCampaign.status === 201, `超出行动范围但在组织区域内建点不禁止（实际 ${outOfCampaign.status}）`);
ok(outOfCampaign.data.publishedTask?.status === 'pool' && outOfCampaign.data.publishedTask?.pointId === outOfCampaign.data.id && outOfCampaign.data.publishedTask?.deadline === '2026-10-01',
  `建点同时发布任务池任务（${outOfCampaign.data.publishedTask?.id}，deadline=${outOfCampaign.data.publishedTask?.deadline}）`);
const noContact = await api('POST', '/points', {
  token: T.hzAdmin,
  body: { campaignId: cid, kind: 'building', name: '缺电话点位', lat: 30.265, lng: 120.125, subtypeId: 'square', nature: '既有', owner: 'x' },
});
ok(noContact.status === 422 && String(noContact.data.message).includes('请填写联系电话'), `缺联系电话 422 中文提示「${noContact.data.message}」`);

section('任务创建与重复校验');
const taskA = await api('POST', '/tasks', {
  token: T.hzAdmin,
  body: { pointId: pidA, title: '广场A无障碍督导', deadline: '2026-09-10', mode: 'pool' },
});
ok(taskA.status === 201 && taskA.data.status === 'pool', `创建任务A pool（${taskA.data.id}）`);
const tidA = taskA.data.id;
const dupTask = await api('POST', '/tasks', {
  token: T.hzAdmin,
  body: { pointId: pidA, title: '重复任务', deadline: '2026-09-11', mode: 'pool' },
});
ok(dupTask.status === 422 && String(dupTask.data.message).includes('该点位已有进行中的督导任务'), `同点位重复创建 422「${dupTask.data.message}」`);
const assignTask = await api('POST', '/tasks', {
  token: T.hzAdmin,
  body: { pointId: pidB, title: '广场B指派督导', deadline: '2026-09-10', mode: 'assign', assigneeId: 'u-hz-insp' },
});
ok(assignTask.status === 201 && assignTask.data.status === 'todo' && assignTask.data.assigneeId === 'u-hz-insp', 'assign 模式直接 todo');
const tidB = assignTask.data.id;

/** ---------------- 4. 督导流程 ---------------- */
section('claim → start（远距 422 / force 成功）');
const claimA = await api('POST', `/tasks/${tidA}/claim`, { token: T.hzInsp });
ok(claimA.status === 201 && claimA.data.status === 'todo' && claimA.data.assigneeId === 'u-hz-insp', 'inspector 领取任务A');
const farStart = await api('POST', `/tasks/${tidA}/start`, {
  token: T.hzInsp,
  body: { lat: 31.2, lng: 121.4 },
});
ok(farStart.status === 422 && typeof farStart.data.distance === 'number' && String(farStart.data.message).includes('超出签到允许范围'), `远处签到 422「${farStart.data.message}」distance=${farStart.data.distance}`);
const forceStart = await api('POST', `/tasks/${tidA}/start`, {
  token: T.hzInsp,
  body: { lat: 31.2, lng: 121.4, force: true },
});
ok(forceStart.status === 201 && forceStart.data.status === 'doing' && forceStart.data.startDistance > 200, 'force:true 签到成功并记录 startDistance');
const ptAfterStart = await api('GET', `/points/${pidA}`, { token: T.hzAdmin });
ok(ptAfterStart.data.point.status === 'inspecting', '开始后点位 → inspecting');

section('提交 inspection（缺失设施 + 检查点 fail → 自动问题单）');
const mainInfo = { floors: '1', nature: '既有', contact: '张三', contactPhone: '0571-1', collectStatus: 'ok', note: '', photos: [] };
const instances = [
  { id: 'ins-a1', facility: 'entrance', no: 1, locationDesc: '主入口', applicable: true, customItems: [{ key: 'c-smoke2', aspect: '无障碍引导标识', requirement: '入口设醒目的无障碍引导标识（现场补充）' }], checks: { 'entrance#0': { verdict: 'fail' }, 'entrance#1': { measured: '1.6', verdict: 'pass' }, 'c-smoke2': { verdict: 'fail' } }, note: '' },
  // 其他无障碍设施：督导员现场补充自定义条款（不合格 → 建议改进问题单）
  { id: 'ins-a2', facility: 'other', no: 1, locationDesc: '一层大厅', applicable: true, customItems: [{ key: 'c-smoke1', aspect: '无障碍饮水设施', requirement: '饮水台容膝空间与高度适合轮椅使用者（现场补充）' }], checks: { 'c-smoke1': { verdict: 'fail' } }, note: '' },
  // 本处不涉及该服务设施：applicable=false → 不评测、其 fail 不生成问题单
  { id: 'ins-a3', facility: 'entrance', no: 2, locationDesc: '侧门', applicable: false, checks: { 'entrance#0': { verdict: 'fail' } }, note: '侧门长期封闭，不涉及' },
];
const sub = await api('POST', '/inspections', {
  token: T.hzInsp,
  body: { taskId: tidA, mainInfo, instances, condTriggered: ['parking'] },
});
ok(sub.status === 201 && sub.data.inspection?.checklibVersion === '1.4', '提交检查记录成功');
ok(sub.data.inspection?.profileId === 'prof-quick', '检查记录保存所用检查项配置 profileId');
ok(Array.isArray(sub.data.inspection?.condTriggered) && sub.data.inspection.condTriggered.includes('parking'), '检查记录保存 condTriggered 确认结果');
const gen = sub.data.issues ?? [];
// square: M=entrance,ramp,passage,toilet; C=parking,blindpath,signage。entrance 有 1 实例；
// 缺失 M 3 条（ramp/passage/toilet）+ condTriggered 确认的 C 1 条（parking）+ fail 1 条 + 自定义条款 fail 2 条 = 7
ok(gen.length === 7, `自动生成 7 条问题单（实际 ${gen.length}）`);
ok(gen.some((i) => i.title === '缺少必须设置的无障碍坡道' && i.severity === 'M' && i.facility === 'ramp'), '缺失问题单：缺少必须设置的无障碍坡道 (M)');
ok(gen.some((i) => i.title === '缺少条件设置的无障碍停车位' && i.severity === 'C'), '缺失问题单：条件项经确认触发后立案 (C parking)');
ok(!gen.some((i) => i.facility === 'blindpath' || i.facility === 'signage'), '条件项未确认触发（blindpath/signage）不生成问题单');
ok(gen.some((i) => i.facility === 'other' && i.title === '其他无障碍设施·无障碍饮水设施不符合（一层大厅）' && i.severity === 'R' && i.clause === '督导员现场补充条款'), '自定义条款（其他无障碍设施）不合格 → 建议改进问题单');
ok(gen.some((i) => i.facility === 'entrance' && i.title === '无障碍出入口·无障碍引导标识不符合（主入口）' && i.severity === 'R'), '标准设施（无障碍出入口）自定义条款不合格 → 建议改进问题单');
ok(!gen.some((i) => i.title.includes('（侧门）')), '"本处不涉及"（applicable=false）实例的 fail 不生成问题单');
const failIssue = gen.find((i) => i.title === '无障碍出入口·设置要求不符合（主入口）');
ok(!!failIssue && failIssue.severity === 'M', '不合格检查点问题单标题/severity 正确');
ok(failIssue?.history?.[0]?.action === '现场检查发现，自动生成问题单' && failIssue?.history?.[0]?.by === '李强', 'fail 问题单 history 首条与原型一致（by 去除括号后缀）');
ok(gen.find((i) => i.facility === 'ramp')?.history?.[0]?.action === '现场检查发现（设施缺失），自动生成问题单', '缺失问题单 history action 与原型一致');
ok(gen.every((i) => i.status === 'open' && i.inspectionId === sub.data.inspection.id), '问题单 status=open 且关联 inspectionId');
const taskADone = await api('GET', `/tasks/${tidA}`, { token: T.hzInsp });
ok(taskADone.data.task.status === 'done', '提交后任务 → done');
const ptAIssue = await api('GET', `/points/${pidA}`, { token: T.hzAdmin });
ok(ptAIssue.data.point.status === 'issue', '提交后点位 → issue');

section('提交 collectStatus!=ok → blocked 且无问题单');
const startB = await api('POST', `/tasks/${tidB}/start`, { token: T.hzInsp, body: { lat: 30.266, lng: 120.126 } });
ok(startB.status === 201 && startB.data.status === 'doing', '近距签到直接成功');
const issuesBefore = (await api('GET', '/issues', { token: T.hzAdmin })).data.length;
const subB = await api('POST', '/inspections', {
  token: T.hzInsp,
  body: { taskId: tidB, mainInfo: { ...mainInfo, collectStatus: 'construct', note: '现场施工' }, instances: [] },
});
ok(subB.status === 201 && (subB.data.issues ?? []).length === 0, 'blocked 提交无问题单');
const taskB = await api('GET', `/tasks/${tidB}`, { token: T.hzInsp });
ok(taskB.data.task.status === 'blocked', '任务 → blocked');
const ptB = await api('GET', `/points/${pidB}`, { token: T.hzAdmin });
ok(ptB.data.point.status === 'blocked', '点位 → blocked');
const issuesAfter = (await api('GET', '/issues', { token: T.hzAdmin })).data.length;
ok(issuesAfter === issuesBefore, '问题单总数不变');

/** ---------------- 5. 问题单状态机 ---------------- */
section('问题单 advance 全状态机');
const pointAIssues = (await api('GET', `/issues?pointId=${pidA}`, { token: T.hzAdmin })).data;
ok(pointAIssues.length === 7, '点位A共 7 条问题单');

const target = pointAIssues.find((i) => i.id === failIssue.id);
const forbidden = await api('POST', `/issues/${target.id}/advance`, { token: T.hzInsp, body: {} });
ok(forbidden.status === 403, `inspector 执行 open→assigned 被拒 403（实际 ${forbidden.status}）`);

// open → assigned（admin，带 responsible/deadline）
let r = await api('POST', `/issues/${target.id}/advance`, {
  token: T.hzAdmin,
  body: { responsible: '广场物业', deadline: '2026-09-20' },
});
ok(r.status === 201 && r.data.status === 'assigned' && r.data.responsible === '广场物业' && r.data.deadline === '2026-09-20', 'open→assigned 写入 responsible/deadline');
ok(r.data.history.at(-1).action === '审核立案并派单' && r.data.history.at(-1).by === '王敏', 'history 默认文案「审核立案并派单」');
// assigned → fixing（inspector）
r = await api('POST', `/issues/${target.id}/advance`, { token: T.hzInsp, body: { note: '已施工整改' } });
ok(r.status === 201 && r.data.status === 'fixing' && r.data.history.at(-1).note === '已施工整改', 'assigned→fixing 默认文案「整改反馈」+note');
// fixing → recheck
r = await api('POST', `/issues/${target.id}/advance`, { token: T.hzInsp, body: {} });
ok(r.status === 201 && r.data.status === 'recheck' && r.data.history.at(-1).action === '整改完成，申请复查', 'fixing→recheck');
let pt = await api('GET', `/points/${pidA}`, { token: T.hzAdmin });
ok(pt.data.point.status === 'recheck', '点位联动 → recheck');
// recheck → fixing（退回）
r = await api('POST', `/issues/${target.id}/advance`, { token: T.hzAdmin, body: { to: 'fixing' } });
ok(r.status === 201 && r.data.status === 'fixing' && r.data.history.at(-1).action === '复查不通过，退回整改', 'recheck→fixing 退回');
pt = await api('GET', `/points/${pidA}`, { token: T.hzAdmin });
ok(pt.data.point.status === 'issue', '退回后点位 → issue');
// 再走到 closed
r = await api('POST', `/issues/${target.id}/advance`, { token: T.hzInsp, body: {} });
r = await api('POST', `/issues/${target.id}/advance`, { token: T.hzAdmin, body: {} });
ok(r.status === 201 && r.data.status === 'closed' && r.data.history.at(-1).action === '复查通过，闭环销号', 'recheck→closed 闭环');
pt = await api('GET', `/points/${pidA}`, { token: T.hzAdmin });
ok(pt.data.point.status !== 'closed', '仍有未闭环问题单，点位不 closed');

// 其余问题单全部走到 closed
for (const iss of pointAIssues.filter((i) => i.id !== target.id)) {
  await api('POST', `/issues/${iss.id}/advance`, { token: T.hzAdmin, body: {} });
  await api('POST', `/issues/${iss.id}/advance`, { token: T.hzInsp, body: {} });
  await api('POST', `/issues/${iss.id}/advance`, { token: T.hzInsp, body: {} });
  const last = await api('POST', `/issues/${iss.id}/advance`, { token: T.hzAdmin, body: {} });
  if (last.data.status !== 'closed') console.error(`  ! 问题单 ${iss.id} 未闭环: ${JSON.stringify(last.data)}`);
}
pt = await api('GET', `/points/${pidA}`, { token: T.hzAdmin });
ok(pt.data.point.status === 'closed', '全部问题单闭环后点位 → closed');
const invalidTrans = await api('POST', `/issues/${target.id}/advance`, { token: T.hzAdmin, body: {} });
ok(invalidTrans.status === 422, `已闭环问题单再流转 422（实际 ${invalidTrans.status}）`);

/** ---------------- 6. 文件 ---------------- */
section('文件 presign → PUT 上传 → 下载 / 跨组织 404');
const presign = await api('POST', '/files/presign', {
  token: T.hzInsp,
  body: { filename: 'test.png', mime: 'image/png', size: PNG.length },
});
ok(presign.status === 201 && presign.data.file?.id && presign.data.uploadUrl === `/api/files/${presign.data.file.id}/content`, 'presign 返回 file + local uploadUrl');
const fid = presign.data.file.id;
const up = await api('PUT', `/files/${fid}/content`, {
  token: T.hzInsp,
  raw: PNG,
  headers: { 'Content-Type': 'image/png' },
});
ok(up.status === 200, `PUT 上传成功（实际 ${up.status}）`);
const dl = await api('GET', `/files/${fid}`, { token: T.hzAdmin });
ok(dl.status === 200 && Buffer.from(dl.data).equals(PNG), 'GET 下载字节一致');
const dlQuery = await fetch(`${BASE}/files/${fid}?token=${T.hzAdmin}`);
ok(dlQuery.status === 200 && Buffer.from(await dlQuery.arrayBuffer()).equals(PNG), '?token= 方式下载（供 <img>）');
const dlCross = await api('GET', `/files/${fid}`, { token: T.cdAdmin });
ok(dlCross.status === 404, `跨组织下载 404（实际 ${dlCross.status}）`);
const badMime = await api('POST', '/files/presign', {
  token: T.hzInsp,
  body: { filename: 'a.txt', mime: 'text/plain', size: 10 },
});
ok(badMime.status === 422, `非图/视频 mime 422（实际 ${badMime.status}）`);
const tooBig = await api('POST', '/files/presign', {
  token: T.hzInsp,
  body: { filename: 'a.png', mime: 'image/png', size: 21 * 1024 * 1024 },
});
ok(tooBig.status === 422, `超 20MB 422（实际 ${tooBig.status}）`);

/** ---------------- 7. 统计 ---------------- */
section('统计 /stats/overview 自洽');
const stats = await api('GET', '/stats/overview', { token: T.hzAdmin });
const s = stats.data;
const sumBy = (arr) => arr.reduce((a, b) => a + b.count, 0);
ok(stats.status === 200 && s.pointsTotal === 12, `pointsTotal=12（种子 9 + 新建 3，实际 ${s.pointsTotal}）`);
ok(sumBy(s.pointsByStatus) === s.pointsTotal, 'pointsByStatus 求和 = pointsTotal');
ok(sumBy(s.issuesByStatus) === s.issuesTotal, 'issuesByStatus 求和 = issuesTotal');
ok(s.issuesClosed === s.issuesByStatus.find((x) => x.status === 'closed')?.count, 'issuesClosed 与 issuesByStatus 一致');
const expectInspected = s.pointsTotal - (s.pointsByStatus.find((x) => x.status === 'pending')?.count ?? 0);
ok(s.inspectedPoints === expectInspected && s.inspectedPoints === 4, `inspectedPoints=${s.inspectedPoints} 与状态分布一致`);
ok(Array.isArray(s.starPoints) && s.starPoints.some((p) => p.id === 'p1' && p.subtypeId === 'gov'), 'starPoints 含 ★ 重点点位 p1');
const gStats = await api('GET', '/stats/overview', { token: T.platform });
ok(gStats.status === 200 && gStats.data.pointsTotal === 15, `platform_admin 全局汇总 pointsTotal=15（实际 ${gStats.data.pointsTotal}）`);
const c1Stats = await api('GET', '/stats/overview?campaignId=c1', { token: T.hzAdmin });
ok(c1Stats.status === 200 && c1Stats.data.pointsTotal === 8, `按行动筛选 c1：pointsTotal=8（实际 ${c1Stats.data.pointsTotal}）`);
ok(Array.isArray(c1Stats.data.facilityStats) && Array.isArray(c1Stats.data.subtypeStats) && Array.isArray(c1Stats.data.rectification?.bySeverity), '统计含设施达标率/类型达标/整改落实维度');
ok(typeof c1Stats.data.rectification.closeRate === 'number' || c1Stats.data.rectification.closeRate === null, '整改落实含闭环率/平均闭环天数/逾期/按等级分布');

/** ---------------- 7.5 任务日志 + 退回编辑 ---------------- */
section('任务日志 + 管理员退回已结办任务');
const detail = await api('GET', `/tasks/${tidA}`, { token: T.hzInsp });
ok(detail.status === 200 && Array.isArray(detail.data.log) && detail.data.log.length >= 4, `任务详情含日志时间线（实际 ${detail.data.log?.length} 条）`);
ok(detail.data.log.some((e) => e.event.includes('任务创建')) && detail.data.log.some((e) => e.event.includes('现场签到')) && detail.data.log.some((e) => e.event.includes('提交检查记录')), '日志含创建/签到/提交事件');
ok(Array.isArray(detail.data.inspections) && detail.data.inspections.length === 1 && Array.isArray(detail.data.issues), '任务详情含检查记录（督导报告）与关联问题单');
const retForbidden = await api('POST', `/tasks/${tidA}/return`, { token: T.hzInsp });
ok(retForbidden.status === 403, `督导员退回 403（实际 ${retForbidden.status}）`);
const ret = await api('POST', `/tasks/${tidA}/return`, { token: T.hzAdmin });
ok(ret.status === 201 && ret.data.status === 'doing' && ret.data.finishedAt == null, '管理员退回：done → doing（finishedAt 清空）');
const ptRet = await api('GET', `/points/${pidA}`, { token: T.hzAdmin });
ok(ptRet.data.point.status === 'inspecting', '退回后点位 → inspecting');
const retB = await api('POST', `/tasks/${tidB}/return`, { token: T.hzAdmin });
ok(retB.status === 201 && retB.data.status === 'doing', 'blocked 任务也可退回编辑状态');
const detailRet = await api('GET', `/tasks/${tidA}`, { token: T.hzInsp });
ok(detailRet.data.log.some((e) => e.event.includes('管理员退回') && e.by === '王敏'), '任务日志记录"管理员退回"事件（含操作人）');
ok(detailRet.data.log.some((e) => e.event.includes('审核立案并派单')), '任务日志含问题单流转记录（审核立案/派单等）');

section('重新督导提交：未闭环问题单更新、已闭环保留');
const beforeRe = (await api('GET', `/issues?pointId=${pidA}`, { token: T.hzAdmin })).data;
ok(beforeRe.length === 7 && beforeRe.every((i) => i.status === 'closed'), '重提前：点位A 首批 7 条问题单均已闭环');
const sub2 = await api('POST', '/inspections', { token: T.hzInsp, body: { taskId: tidA, mainInfo, instances, condTriggered: ['parking'] } });
ok(sub2.status === 201 && (sub2.data.issues ?? []).length === 7, '退回后重新提交成功并生成 7 条新问题单');
let afterRe = (await api('GET', `/issues?pointId=${pidA}`, { token: T.hzAdmin })).data;
ok(afterRe.length === 14 && afterRe.filter((i) => i.status === 'closed').length === 7, `已闭环保留 7 条 + 新生成 7 条（实际共 ${afterRe.length}）`);
// 第二批：1 条闭环、6 条未闭环 → 再次退回重提，未闭环 6 条应被替换
const batch2 = sub2.data.issues;
for (let k = 0; k < 4; k++) await api('POST', `/issues/${batch2[0].id}/advance`, { token: T.hzAdmin, body: {} });
const ret2 = await api('POST', `/tasks/${tidA}/return`, { token: T.hzAdmin });
ok(ret2.status === 201 && ret2.data.status === 'doing', '第二次退回编辑状态');
const sub3 = await api('POST', '/inspections', { token: T.hzInsp, body: { taskId: tidA, mainInfo, instances, condTriggered: ['parking'] } });
ok(sub3.status === 201 && (sub3.data.issues ?? []).length === 7, '第二次重新提交成功');
afterRe = (await api('GET', `/issues?pointId=${pidA}`, { token: T.hzAdmin })).data;
ok(afterRe.length === 15, `点位A共 15 条 = 首批闭环 7 + 第二批闭环 1 + 最新批 7（实际 ${afterRe.length}）`);
ok(afterRe.some((i) => i.id === batch2[0].id && i.status === 'closed'), '第二批中已闭环的原样保留');
ok(!batch2.slice(1).some((b) => afterRe.some((i) => i.id === b.id)), '第二批未闭环 6 条已全部替换为最新提交结果');
const dRe = await api('GET', `/tasks/${tidA}`, { token: T.hzInsp });
ok(dRe.data.log.some((e) => e.event.includes('未闭环问题单已按最新结果更新')), '任务日志记录问题单更新事件');

section('暂不立案（补充说明）与补立案');
const openOne = sub3.data.issues[0];
const noNote = await api('POST', `/issues/${openOne.id}/advance`, { token: T.hzAdmin, body: { to: 'deferred' } });
ok(noNote.status === 422, `暂不立案未填补充说明 → 422（实际 ${noNote.status}）`);
const deferInsp = await api('POST', `/issues/${openOne.id}/advance`, { token: T.hzInsp, body: { to: 'deferred', note: 'x' } });
ok(deferInsp.status === 403, `督导员暂不立案被拒 403（实际 ${deferInsp.status}）`);
const rDefer = await api('POST', `/issues/${openOne.id}/advance`, { token: T.hzAdmin, body: { to: 'deferred', note: '纳入下一年度改造计划' } });
ok(rDefer.status === 201 && rDefer.data.status === 'deferred' && rDefer.data.history.at(-1).note === '纳入下一年度改造计划', 'open → deferred 暂不立案（含补充说明）');
const rRefile = await api('POST', `/issues/${openOne.id}/advance`, { token: T.hzAdmin, body: { responsible: '广场物业', deadline: '2026-12-31' } });
ok(rRefile.status === 201 && rRefile.data.status === 'assigned' && rRefile.data.responsible === '广场物业', 'deferred → assigned 补立案（写入责任单位/期限）');

section('用户自助与组织/用户管理');
const badOld = await api('PATCH', '/users/me', { token: T.hzInsp, body: { oldPassword: 'wrong', newPassword: '654321' } });
ok(badOld.status === 401, `自助改密码：原密码错误 401（实际 ${badOld.status}）`);
const selfPhone = await api('PATCH', '/users/me', { token: T.hzInsp, body: { phone: '13800000002' } });
ok(selfPhone.status === 200 && selfPhone.data.phone === '13800000002', '自助修改手机号（同号幂等）');
const selfPwd = await api('PATCH', '/users/me', { token: T.hzInsp, body: { oldPassword: '123456', newPassword: '654321' } });
ok(selfPwd.status === 200, '自助修改密码成功');
const loginNew = await api('POST', '/auth/login', { body: { phone: '13800000002', password: '654321' } });
ok(loginNew.status === 201, '新密码可登录');
await api('PATCH', '/users/me', { token: T.hzInsp, body: { oldPassword: '654321', newPassword: '123456' } });
const resetByAdmin = await api('PATCH', '/users/u-hz-insp', { token: T.hzAdmin, body: { password: '123456' } });
ok(resetByAdmin.status === 200, '组织管理员重置用户密码');
const disOrg = await api('PATCH', '/orgs/org-cd', { token: T.platform, body: { status: 'disabled' } });
ok(disOrg.status === 200 && disOrg.data.status === 'disabled', '平台停用组织');
const loginDisabled = await api('POST', '/auth/login', { body: { phone: '13800000003', password: '123456' } });
ok(loginDisabled.status === 401 && String(loginDisabled.data.message).includes('组织已停用'), '停用组织账号登录被拒（组织已停用）');
await api('PATCH', '/orgs/org-cd', { token: T.platform, body: { status: 'active' } });
const loginBack = await api('POST', '/auth/login', { body: { phone: '13800000003', password: '123456' } });
ok(loginBack.status === 201, '组织启用后恢复登录');
const newAdmin = await api('POST', '/users', { token: T.platform, body: { name: '测试管理员', phone: '13811111111', role: 'admin', orgId: 'org-cd' } });
ok(newAdmin.status === 201 && newAdmin.data.role === 'admin' && newAdmin.data.orgId === 'org-cd', '平台为组织新增管理员');
const demote = await api('PATCH', `/users/${newAdmin.data.id}`, { token: T.platform, body: { role: 'inspector' } });
ok(demote.status === 200 && demote.data.role === 'inspector', '平台修改组织管理员（降级为督导员）');

/** ---------------- 8. reseed ---------------- */
section('platform_admin reseed 数据复原');
const reseedForbidden = await api('POST', '/admin/reseed', { token: T.hzAdmin });
ok(reseedForbidden.status === 403, `admin 调 reseed 403（实际 ${reseedForbidden.status}）`);
const reseed = await api('POST', '/admin/reseed', { token: T.platform });
ok(reseed.status === 201 && reseed.data.ok === true, 'reseed 返回 {ok:true}');
const hzPoints = await api('GET', '/points', { token: T.hzAdmin });
ok(hzPoints.data.length === 9 && hzPoints.data.some((p) => p.id === 'p1'), `杭州点位复原 9 个含 p1（实际 ${hzPoints.data.length}）`);
const allIssues = await api('GET', '/issues', { token: T.hzAdmin });
ok(allIssues.data.length === 3 && allIssues.data.some((i) => i.id === 'i1' && i.status === 'fixing'), '问题单复原 3 条（i1 fixing）');
const allTasks = await api('GET', '/tasks', { token: T.hzAdmin });
ok(allTasks.data.length === 6 && allTasks.data.some((t) => t.id === 't1' && t.status === 'doing'), '杭州任务复原 6 条（t1 doing）');
const relogin = await api('POST', '/auth/login', { body: { phone: '13800000002', password: '123456' } });
ok(relogin.status === 201, 'reseed 后种子账号可登录');

console.log(`\n========================================`);
console.log(`冒烟测试结果：${passed} 通过 / ${failed} 失败`);
process.exit(failed === 0 ? 0 : 1);
