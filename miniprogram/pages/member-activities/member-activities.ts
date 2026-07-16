import { apiRequest, getUserToken } from '../../utils/api'
import { enableShareMenu, HOME_SHARE_TITLE } from '../../utils/share'

type ReportType = 'no_show' | 'leave_early' | 'disruptive' | 'offensive' | 'other'

type MemberActivity = {
  id: string
  userId?: string
  openid?: string
  nickName: string
  steamId: string
  remark: string
  avatarUrl: string
  action: number
  actionText: string
  createdAt: string
  isSelf: boolean
  hasReported: boolean
  canReport: boolean
  reportStatus: string
}

type ActivityPage = {
  takeoverState?: number
  list?: Record<string, any>[]
  total?: number
}

const PAGE_SIZE = 20
const FEMALE_AVATAR_URL = 'https://wechat-bot-images.oss-cn-hangzhou.aliyuncs.com/miniapp/default-avatar/avatar-female.jpg'
const REPORT_TYPES: { label: string; value: ReportType }[] = [
  { label: '到点不来', value: 'no_show' },
  { label: '中途跳车', value: 'leave_early' },
  { label: '消极捣乱', value: 'disruptive' },
  { label: '言语攻击', value: 'offensive' },
  { label: '其他', value: 'other' },
]

let searchTimer = 0

const isTrue = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true'

const buildQuery = (params: Record<string, string | number | undefined>) => {
  const query = Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== '')
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
    .join('&')
  return query ? `?${query}` : ''
}

const getUserKey = (item: Pick<MemberActivity, 'userId' | 'openid'>) => item.userId || item.openid || ''

const normalizeActivity = (raw: Record<string, any>): MemberActivity => {
  const userId = raw.userId !== undefined && raw.userId !== null ? String(raw.userId) : ''
  const openid = raw.openid ? String(raw.openid) : ''
  const hasReported = isTrue(raw.hasReported)
  const isSelf = isTrue(raw.isSelf)
  return {
    id: String(raw.id || ''),
    userId,
    openid,
    nickName: raw.nickname || raw.nickName || '玩家',
    steamId: raw.steamId || raw.steam_id || '',
    remark: raw.remark || '',
    avatarUrl: raw.avatarUrl || raw.avatar_url || FEMALE_AVATAR_URL,
    action: Number(raw.action || 0),
    actionText: raw.actionText || (Number(raw.action) === 3 ? '被踢出' : Number(raw.action) === 2 ? '退出' : '加入'),
    createdAt: raw.createdAt || raw.created_at || '',
    isSelf,
    hasReported,
    canReport: !isSelf && !hasReported,
    reportStatus: hasReported ? '已举报' : '举报',
  }
}

Page({
  data: {
    takeoverId: '',
    takeoverState: 0,
    keyword: '',
    list: [] as MemberActivity[],
    pageIndex: 1,
    total: 0,
    hasMore: false,
    isLoading: false,
    isLoadingMore: false,
    isRefreshing: false,
    showReportSheet: false,
    reportTypes: REPORT_TYPES,
    reportType: 'no_show' as ReportType,
    reportUserId: '',
    reportUserKey: '',
    reportNickname: '',
    reportContent: '',
    reportedUserKeys: [] as string[],
    isSubmittingReport: false,
  },

  onLoad(query: { id?: string }) {
    enableShareMenu()
    const takeoverId = query.id || ''
    this.setData({ takeoverId })
    if (takeoverId) {
      this.loadList(1, true)
    }
  },

  onShareAppMessage() {
    return {
      title: `进出记录 - ${HOME_SHARE_TITLE}`,
      path: `/pages/member-activities/member-activities?id=${encodeURIComponent(this.data.takeoverId)}`,
    }
  },

  onShareTimeline() {
    return {
      title: HOME_SHARE_TITLE,
      query: this.data.takeoverId ? `id=${encodeURIComponent(this.data.takeoverId)}` : '',
    }
  },

  loadList(page: number, replace: boolean) {
    if (!this.data.takeoverId) return
    this.setData({ isLoading: replace, isLoadingMore: !replace })
    apiRequest<ActivityPage>(`/api/takeovers/${this.data.takeoverId}/member-activities${buildQuery({
      keyword: this.data.keyword.trim(),
      page,
      pageSize: PAGE_SIZE,
    })}`)
      .then(result => {
        const loaded = (result.list || []).map(normalizeActivity)
        const merged = replace ? loaded : [...this.data.list, ...loaded]
        const reportedUserKeys = replace
          ? loaded.filter(item => item.hasReported).map(getUserKey).filter(Boolean)
          : this.data.reportedUserKeys.concat(loaded.filter(item => item.hasReported).map(getUserKey).filter(Boolean))
        const total = Number(result.total || 0)
        this.setData({
          list: this.withReportState(merged, reportedUserKeys),
          reportedUserKeys,
          total,
          takeoverState: Number(result.takeoverState || this.data.takeoverState || 0),
          pageIndex: page,
          hasMore: merged.length < total,
        })
      })
      .catch(error => {
        wx.showToast({ title: error.message || '加载失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ isLoading: false, isLoadingMore: false, isRefreshing: false })
      })
  },

  withReportState(list: MemberActivity[], reportedUserKeys: string[]) {
    return list.map(item => {
      const userKey = getUserKey(item)
      const hasReported = !!userKey && reportedUserKeys.indexOf(userKey) >= 0
      return {
        ...item,
        hasReported,
        canReport: !item.isSelf && !hasReported,
        reportStatus: hasReported ? '已举报' : '举报',
      }
    })
  },

  handleSearchInput(event: WechatMiniprogram.Input) {
    this.setData({ keyword: event.detail.value })
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => this.loadList(1, true), 300)
  },

  clearSearch() {
    this.setData({ keyword: '' })
    this.loadList(1, true)
  },

  refresh() {
    this.setData({ isRefreshing: true })
    this.loadList(1, true)
  },

  loadMore() {
    if (this.data.isLoadingMore || !this.data.hasMore) return
    this.loadList(this.data.pageIndex + 1, false)
  },

  openReportSheet(event: WechatMiniprogram.TouchEvent) {
    if (this.data.takeoverState !== 2) {
      wx.showToast({ title: '接龙结束后才可以举报', icon: 'none' })
      return
    }
    if (!getUserToken()) {
      wx.showToast({ title: '请先登录后举报', icon: 'none' })
      return
    }

    const userId = String(event.currentTarget.dataset.userid || '')
    const reportUserKey = String(event.currentTarget.dataset.userkey || userId)
    const isSelf = isTrue(event.currentTarget.dataset.isself)
    if (!userId || !reportUserKey || isSelf || this.data.reportedUserKeys.indexOf(reportUserKey) >= 0) return

    this.setData({
      showReportSheet: true,
      reportUserId: userId,
      reportUserKey,
      reportNickname: String(event.currentTarget.dataset.nickname || '玩家'),
      reportType: (event.currentTarget.dataset.reporttype as ReportType) || 'no_show',
      reportContent: '',
    })
  },

  closeReportSheet() {
    if (this.data.isSubmittingReport) return
    this.setData({ showReportSheet: false })
  },

  selectReportType(event: WechatMiniprogram.TouchEvent) {
    const reportType = event.currentTarget.dataset.value as ReportType
    if (REPORT_TYPES.some(item => item.value === reportType)) {
      this.setData({ reportType })
    }
  },

  handleReportContentInput(event: WechatMiniprogram.Input) {
    this.setData({ reportContent: event.detail.value })
  },

  noop() {},

  submitReport() {
    const content = this.data.reportContent.trim()
    if (!content) {
      wx.showToast({ title: '请填写举报内容', icon: 'none' })
      return
    }
    if (!this.data.takeoverId || !this.data.reportUserId || this.data.isSubmittingReport) return

    this.setData({ isSubmittingReport: true })
    apiRequest<null>({
      url: `/api/takeovers/${this.data.takeoverId}/reports`,
      method: 'POST',
      data: {
        reportedUserId: Number(this.data.reportUserId),
        reportType: this.data.reportType,
        content,
        imageUrls: [],
      },
    })
      .then(() => {
        wx.showToast({ title: '已提交举报', icon: 'success' })
        const reportedUserKeys = this.data.reportedUserKeys.concat(this.data.reportUserKey)
        this.setData({
          showReportSheet: false,
          reportedUserKeys,
          list: this.withReportState(this.data.list, reportedUserKeys),
        })
      })
      .catch(error => {
        wx.showToast({ title: error.message || '提交失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ isSubmittingReport: false })
      })
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.redirectTo({ url: `/pages/detail/detail?id=${encodeURIComponent(this.data.takeoverId)}` })
  },
})
