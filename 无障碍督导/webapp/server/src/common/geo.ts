/** 与原型 store 一致的工具函数 */

/** 服务端 ID：`${prefix}-${6位随机}` */
export const uid = (p: string) =>
  `${p}-${Math.random().toString(36).slice(2, 8)}`;

export type Bounds = [[number, number], [number, number]];

/** 坐标是否在矩形区域内（bounds 为 null 时恒真），与原型 inRegion/inBounds 一致 */
export function inBounds(bounds: Bounds | null | undefined, lat: number, lng: number): boolean {
  if (!bounds) return true;
  return (
    lat >= bounds[0][0] &&
    lat <= bounds[1][0] &&
    lng >= bounds[0][1] &&
    lng <= bounds[1][1]
  );
}

/** 两点距离（米），haversine，与原型 distM 一致 */
export function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export const nowIso = () => new Date().toISOString();

/** 原型种子用户名带"（角色）"后缀，问题单 history.by 使用去掉后缀的姓名 */
export const shortName = (name: string) => name.replace(/（.*）/, '');
