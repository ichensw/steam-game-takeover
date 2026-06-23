type Gender = 'male' | 'female'

type ApiResponse<T> = {
  success?: boolean
  code?: string
  message?: string
  data?: T
}

type User = {
  nickname: string
  steamId: string
  gender?: number
  avatarUrl: string
  creditScore?: number
  creditStatus?: string
}

type RecentTakeover = {
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

type Summary = {
  user?: User
  createdCount?: number
  joinedCount?: number
  recent?: RecentTakeover[]
}

const TOKEN_KEY = 'steam_takeover_token'
const API_BASE_URL = 'https://rabbits.ink/miniprogram-api'
const FEMALE_AVATAR_URL = 'https://wechat-bot-images.oss-cn-hangzhou.aliyuncs.com/miniapp/default-avatar/avatar-female.jpg'
const MALE_AVATAR_URL = 'https://wechat-bot-images.oss-cn-hangzhou.aliyuncs.com/miniapp/default-avatar/avatar-male.jpg'
const PROFILE_BG_URL = 'https://wechat-bot-images.oss-cn-hangzhou.aliyuncs.com/miniapp/uploads/2026/06/220-1782216063196384700-57523733eb66.png'
const STATUS_COVERS: Record<string, string> = {
  待发车: '/assets/takeover-card-pending.png',
  招募中: '/assets/takeover-card-recruiting.png',
  已满员: '/assets/takeover-card-full.png',
  已结束: '/assets/takeover-card-pending.png',
}

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

const avatarFor = (user: User) => {
  if (user.avatarUrl) return user.avatarUrl
  return user.gender === 1 ? MALE_AVATAR_URL : FEMALE_AVATAR_URL
}

const creditStatusFor = (score: number) => (score <= 50 ? 'disabled' : score < 70 ? 'limited' : 'normal')

const formatCardTakeover = (takeover: RecentTakeover) => {
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
    femaleAvatarUrl: FEMALE_AVATAR_URL,
    user: {
      nickname: '',
      steamId: '',
      avatarUrl: '',
      creditScore: 100,
      creditStatus: 'normal',
    } as User,
    createdCount: 0,
    joinedCount: 0,
    recent: [] as RecentTakeover[],
    isLoading: false,
  },

  onLoad() {
    if (!getUserToken()) {
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }
    this.loadSummary()
  },

  loadSummary() {
    this.setData({ isLoading: true })
    apiRequest<Summary>('/api/me/summary')
      .then(summary => {
        const user = summary.user || this.data.user
        this.setData({
          user: {
            ...user,
            avatarUrl: avatarFor(user),
            creditScore: Number(user.creditScore ?? 100),
            creditStatus: user.creditStatus || creditStatusFor(Number(user.creditScore ?? 100)),
          },
          createdCount: Number(summary.createdCount || 0),
          joinedCount: Number(summary.joinedCount || 0),
          recent: (summary.recent || []).map(formatCardTakeover),
        })
      })
      .catch(error => {
        wx.showToast({ title: error.message || '加载失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ isLoading: false })
      })
  },

  openTakeover(event: WechatMiniprogram.TouchEvent & { detail?: { id?: number | string } }) {
    const id = event.detail?.id || event.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({
      url: `/pages/detail/detail?id=${encodeURIComponent(String(id))}`,
      events: {
        takeoverChanged: () => this.loadSummary(),
      },
    })
  },

  openMyTakeovers() {
    wx.navigateTo({ url: '/pages/my-takeovers/my-takeovers' })
  },

  copySteamId() {
    if (!this.data.user.steamId) return
    wx.setClipboardData({
      data: this.data.user.steamId,
      success: () => wx.showToast({ title: '已复制 SteamID', icon: 'success' }),
    })
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.redirectTo({ url: '/pages/index/index' })
  },
})
