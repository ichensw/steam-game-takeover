import { apiRequest, getUserToken } from '../../utils/api'
import { enableShareMenu, HOME_SHARE_TITLE } from '../../utils/share'

type CreditLog = {
  id: number
  scoreDelta: number
  scoreBefore: number
  scoreAfter: number
  reasonType: string
  reason: string
  createdAt: string
}

type CreditLogPage = {
  items?: CreditLog[]
  total?: number
}

const PAGE_SIZE = 10
const PROFILE_BG_URL = 'https://wechat-bot-images.oss-cn-hangzhou.aliyuncs.com/miniapp/uploads/2026/06/220-1782216063196384700-57523733eb66.png'

const reasonLabel = (value: string) => {
  if (value === 'report_penalty') return '举报核实'
  if (value === 'admin_restore') return '信誉恢复'
  return '信誉变动'
}

Page({
  data: {
    backgroundUrl: PROFILE_BG_URL,
    list: [] as CreditLog[],
    pageIndex: 1,
    total: 0,
    hasMore: false,
    isLoading: false,
    isLoadingMore: false,
    isRefreshing: false,
  },

  onLoad() {
    enableShareMenu()
    if (!getUserToken()) {
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }
    this.loadList(1, true)
  },

  onShareAppMessage() {
    return {
      title: `信誉记录 - ${HOME_SHARE_TITLE}`,
      path: '/pages/credit-logs/credit-logs',
    }
  },

  onShareTimeline() {
    return {
      title: HOME_SHARE_TITLE,
      query: '',
    }
  },

  loadList(page: number, replace: boolean) {
    this.setData({ isLoading: replace, isLoadingMore: !replace })
    apiRequest<CreditLogPage>(`/api/me/credit-logs?page=${page}&pageSize=${PAGE_SIZE}`)
      .then(result => {
        const list = (result.items || []).map(item => ({
          ...item,
          reasonType: reasonLabel(item.reasonType),
        }))
        const nextList = replace ? list : this.data.list.concat(list)
        const total = Number(result.total || 0)
        this.setData({
          list: nextList,
          total,
          pageIndex: page,
          hasMore: nextList.length < total,
        })
      })
      .catch(error => wx.showToast({ title: error.message || '加载失败', icon: 'none' }))
      .finally(() => this.setData({ isLoading: false, isLoadingMore: false, isRefreshing: false }))
  },

  refresh() {
    this.setData({ isRefreshing: true })
    this.loadList(1, true)
  },

  loadMore() {
    if (this.data.isLoadingMore || !this.data.hasMore) return
    this.loadList(this.data.pageIndex + 1, false)
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.redirectTo({ url: '/pages/profile/profile' })
  },
})
