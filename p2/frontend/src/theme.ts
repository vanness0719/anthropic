// 配色经 dataviz 校验器在暗色表面 #141414 上验证通过(明度带/色度/CVD/对比度)。
// A股约定:红涨绿跌;涨跌语义除颜色外均有方向(零轴上下)或正负号作次级编码。
export const UP = '#f04848' // 涨 / 流入
export const DOWN = '#3ba272' // 跌 / 流出
export const ACCENT = '#4d8de8' // 策略线 / 强调
export const NEUTRAL = '#8c8c8c' // 基准线 / 次要文本
export const SURFACE = '#141414'
export const PANEL = '#1e1e1e'
export const BORDER = '#2c2c2c'
export const TEXT = 'rgba(255,255,255,0.88)'
export const TEXT_2 = 'rgba(255,255,255,0.55)'

export const signColor = (v: number) => (v > 0 ? UP : v < 0 ? DOWN : NEUTRAL)
