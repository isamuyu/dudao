/** 天地图服务配置（原型使用，正式版应放服务端环境变量） */
export const TIANDITU_KEY = 'a96815b863e88e94a024178e3894e355'

export const TDT_VEC = `https://t{s}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=${TIANDITU_KEY}`
export const TDT_CVA = `https://t{s}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=${TIANDITU_KEY}`
export const TDT_SUBDOMAINS = ['0', '1', '2', '3', '4', '5', '6', '7']
