export const HOME_SHARE_TITLE = '兔兔窝游戏接龙'
export const HOME_SHARE_PATH = '/pages/index/index'

export const enableShareMenu = () => {
  wx.showShareMenu({
    withShareTicket: true,
    menus: ['shareAppMessage', 'shareTimeline'],
  })
}
