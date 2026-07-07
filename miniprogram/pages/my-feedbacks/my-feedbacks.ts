import { apiRequest, getUserToken } from '../../utils/api'
import { enableShareMenu, HOME_SHARE_TITLE } from '../../utils/share'

type FeedbackItem = {
  id: number
  feedback_type: string
  content: string
  images: string[]
  status: number
  status_label: string
  created_at: string
}

type FeedbackPage = {
  items?: FeedbackItem[]
  total?: number
}

const PAGE_SIZE = 10
const PROFILE_BG_URL = 'https://wechat-bot-images.oss-cn-hangzhou.aliyuncs.com/miniapp/uploads/2026/06/220-1782216063196384700-57523733eb66.png'

const typeLabel = (value: string) => {
  switch (value) {
    case 'problem':
      return '问题反馈'
    case 'experience':
      return '体验吐槽'
    case 'other':
      return '其他'
    default:
      return '功能建议'
  }
}

const statusLabel = (status: number, fallback: string) => {
  if (status === 2) return '已采纳'
  if (status === 3) return '未采纳'
  return fallback === '不理睬' || fallback === '待采纳' ? (fallback === '不理睬' ? '未采纳' : '待处理') : fallback || '待处理'
}

const buildQuery = (page: number) => `?page=${page}&pageSize=${PAGE_SIZE}`

Page({
  data: {
    backgroundUrl: PROFILE_BG_URL,
    list: [] as FeedbackItem[],
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
      title: `我的反馈 - ${HOME_SHARE_TITLE}`,
      path: '/pages/my-feedbacks/my-feedbacks',
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
    apiRequest<FeedbackPage>(`/api/user-feedbacks${buildQuery(page)}`)
      .then(result => {
        const list = (result.items || []).map(item => ({
          ...item,
          feedback_type: typeLabel(item.feedback_type),
          status_label: statusLabel(Number(item.status), item.status_label),
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

  previewImage(event: WechatMiniprogram.TouchEvent) {
    const feedbackIndex = Number(event.currentTarget.dataset.feedbackIndex)
    const imageIndex = Number(event.currentTarget.dataset.imageIndex)
    const feedback = this.data.list[feedbackIndex]
    if (!feedback || !feedback.images || !feedback.images[imageIndex]) return
    wx.previewImage({ current: feedback.images[imageIndex], urls: feedback.images })
  },

  openFeedback() {
    wx.navigateTo({ url: '/pages/feedback/feedback' })
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.redirectTo({ url: '/pages/profile/profile' })
  },
})
