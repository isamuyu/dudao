/** 天地图 Web 服务 API（浏览器端 Key，直接前端调用；Key 与底图共用，见 config.ts） */
import { TIANDITU_KEY } from '@/config'

const UA_OK = { referrerPolicy: 'strict-origin-when-cross-origin' } as RequestInit

export interface ReverseGeoResult {
  /** 最近 POI 名称（可能为空或与地址相同） */
  poi: string
  /** 标准地址（addressComponent.address，通常为 路+门牌号 或完整地址） */
  address: string
  /** 完整格式化地址（含方位距离描述） */
  formatted: string
  /** 所在道路 */
  road: string
}

export interface NearbyPoi {
  name: string
  address: string
  /** 距打点位置（米） */
  distance: number
}

/** 逆地理编码：经纬度 → 最近 POI / 标准地址 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeoResult | null> {
  try {
    const postStr = encodeURIComponent(`{'lon':${lng},'lat':${lat},'ver':1}`)
    const res = await fetch(`https://api.tianditu.gov.cn/geocoder?postStr=${postStr}&type=geocode&tk=${TIANDITU_KEY}`, UA_OK)
    const data = await res.json()
    if (data.status !== '0' || !data.result) return null
    const ac = data.result.addressComponent ?? {}
    return {
      poi: ac.poi ?? '',
      address: ac.address ?? '',
      formatted: data.result.formatted_address ?? '',
      road: ac.road ?? '',
    }
  } catch {
    return null
  }
}

/** 周边 POI 搜索：以打点为中心按关键词搜索附近地名 */
export async function searchNearby(lat: number, lng: number, keyword: string, radius = 1000): Promise<NearbyPoi[]> {
  if (!keyword.trim()) return []
  try {
    const postStr = encodeURIComponent(JSON.stringify({
      keyWord: keyword.trim(), level: '15', queryType: '3',
      pointLonlat: `${lng},${lat}`, queryRadius: String(radius), start: '0', count: '8',
    }))
    const res = await fetch(`https://api.tianditu.gov.cn/v2/search?postStr=${postStr}&type=query&tk=${TIANDITU_KEY}`, UA_OK)
    const data = await res.json()
    if (data.status?.infocode !== 1000 || !Array.isArray(data.pois)) return []
    return data.pois.map((p: { name?: string; address?: string; distance?: string | number }) => ({
      name: p.name ?? '',
      address: p.address ?? '',
      distance: Math.round(Number(p.distance ?? 0)),
    })).filter((p: NearbyPoi) => p.name)
  } catch {
    return []
  }
}
