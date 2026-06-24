// logs.ts
// const util = require('../../utils/util.js')
import { formatTime } from '../../utils/util'
import { enableShareMenu, HOME_SHARE_PATH, HOME_SHARE_TITLE } from '../../utils/share'

Page({
  data: {
    logs: [],
  },

  onLoad() {
    enableShareMenu()
    this.setData({
      logs: (wx.getStorageSync('logs') || []).map((log: string) => {
        return {
          date: formatTime(new Date(log)),
          timeStamp: log,
        }
      }),
    })
  },

  onShareAppMessage() {
    return {
      title: HOME_SHARE_TITLE,
      path: HOME_SHARE_PATH,
    }
  },

  onShareTimeline() {
    return {
      title: HOME_SHARE_TITLE,
      query: '',
    }
  },
})
