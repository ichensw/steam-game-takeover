import { enableShareMenu, HOME_SHARE_TITLE } from '../../utils/share'

type ApiResponse<T> = {
  success?: boolean
  code?: string
  message?: string
  data?: T
}

type Takeover = {
  id: number
  title: string
  description: string
  creatorName?: string
  participantLimit: number
  joinedCount: number
  scheduleText: string
  statusLabel: string
  isCreator: boolean
  statusTone: string
  coverImage: string
  participantAvatars: string[]
  previewMembers?: { avatarUrl?: string }[]
}

type TakeoverPage = {
  list?: Takeover[]
  total?: number
}

const PAGE_SIZE = 10
const TOKEN_KEY = 'steam_takeover_token'
const API_BASE_URL = 'https://rabbits.ink/miniprogram-api'
const PROFILE_BG_URL = 'https://wechat-bot-images.oss-cn-hangzhou.aliyuncs.com/miniapp/uploads/2026/06/220-1782216063196384700-57523733eb66.png'
const FEMALE_AVATAR_URL = 'https://wechat-bot-images.oss-cn-hangzhou.aliyuncs.com/miniapp/default-avatar/avatar-female.jpg'
const STATUS_COVERS: Record<string, string> = {
  待发车: '/assets/takeover-card-pending.png',
  招募中: '/assets/takeover-card-recruiting.png',
  已满员: '/assets/takeover-card-full.png',
  已结束: '/assets/takeover-card-pending.png',
}

let searchTimer = 0

const getUserToken = () => wx.getStorageSync(TOKEN_KEY) as string

const isApiResponse = <T>(value: unknown): value is ApiResponse<T> =>
  !!value && typeof value === 'object' && 'success' in value

const apiRequest = <T>(url: string) =>
  new Promise<T>((resolve, reject) => {
    wx.request<WechatMiniprogram.IAnyObject>({
      url: `${API_BASE_URL}${url}`,
      header: {
        Authorization: `Bearer ${getUserToken()}`,
      },
      success: response => {
        const body = response.data as ApiResponse<T>
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(body.message || body.code || `请求失败：${response.statusCode}`))
          return
        }
        resolve(isApiResponse<T>(body) ? (body.data as T) : (response.data as T))
      },
      fail: error => reject(new Error(error.errMsg || '网络请求失败')),
    })
  })

const buildQuery = (params: Record<string, string | number | undefined>) => {
  const query = Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== '')
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
    .join('&')
  return query ? `?${query}` : ''
}

const formatCardTakeover = (takeover: Takeover) => {
  const statusTone = takeover.statusLabel === '已结束' ? 'ended' : takeover.statusLabel === '已满员' ? 'purple' : 'orange'
  return {
    ...takeover,
    statusTone,
    coverImage: STATUS_COVERS[takeover.statusLabel] || STATUS_COVERS['招募中'],
    participantAvatars: (takeover.previewMembers || []).map(member => member.avatarUrl || FEMALE_AVATAR_URL).slice(0, 5),
  }
}

Page({
  data: {
    backgroundUrl: PROFILE_BG_URL,
    keyword: '',
    list: [] as Takeover[],
    pageIndex: 1,
    total: 0,
    hasMore: false,
    isLoading: false,
    isLoadingMore: false,
    isRefreshing: false,
  },

  onLoad() {
    enableShareMenu()
    this.loadList(1, true)
  },

  onShareAppMessage() {
    return {
      title: `我的接龙 - ${HOME_SHARE_TITLE}`,
      path: '/pages/my-takeovers/my-takeovers',
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
    apiRequest<TakeoverPage>(`/api/me/takeovers${buildQuery({
      keyword: this.data.keyword.trim(),
      page,
      pageSize: PAGE_SIZE,
    })}`)
      .then(result => {
        const list = (result.list || []).map(formatCardTakeover)
        const nextList = replace ? list : [...this.data.list, ...list]
        const total = Number(result.total || 0)
        this.setData({
          list: nextList,
          total,
          pageIndex: page,
          hasMore: nextList.length < total,
        })
      })
      .catch(error => {
        wx.showToast({ title: error.message || '加载失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ isLoading: false, isLoadingMore: false, isRefreshing: false })
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

  openTakeover(event: WechatMiniprogram.TouchEvent & { detail?: { id?: number | string } }) {
    const id = (event.detail && event.detail.id) || event.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({
      url: `/pages/detail/detail?id=${encodeURIComponent(String(id))}`,
      events: {
        takeoverChanged: () => this.loadList(1, true),
      },
    })
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.redirectTo({ url: '/pages/profile/profile' })
  },
})
