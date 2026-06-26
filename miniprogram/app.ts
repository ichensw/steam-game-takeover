// app.ts
const setupAppUpdate = () => {
  if (!wx.canIUse('getUpdateManager')) {
    return
  }

  const updateManager = wx.getUpdateManager()
  updateManager.onUpdateReady(() => {
    wx.showModal({
      title: '更新提示',
      content: '新版本已准备好，重启后立即生效。',
      showCancel: false,
      confirmText: '立即重启',
      success: () => updateManager.applyUpdate(),
    })
  })
  updateManager.onUpdateFailed(() => {
    wx.showModal({
      title: '更新失败',
      content: '新版本下载失败，请删除小程序后重新打开。',
      showCancel: false,
    })
  })
}

App<IAppOption>({
  globalData: {},
  onLaunch() {
    setupAppUpdate()
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)
  },
})
