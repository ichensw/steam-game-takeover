import { enableShareMenu, HOME_SHARE_TITLE } from '../../utils/share'

{
type Gender = 'male' | 'female'
type ProfileMode = 'complete' | 'edit'

type ApiResponse<T> = {
  success?: boolean
  code?: string
  message?: string
  data?: T
}

type User = {
  nickName?: string
  nickname: string
  steamId: string
  gender?: number | string
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

type ApiRequestOptions = {
  url: string
  method?: 'GET' | 'PUT'
  data?: WechatMiniprogram.IAnyObject
}

type UploadResult = {
  url?: string
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

const parseUploadResponse = (value: string) => {
  try {
    return JSON.parse(value) as ApiResponse<UploadResult> | UploadResult
  } catch {
    return null
  }
}

const apiRequest = <T>(options: string | ApiRequestOptions) =>
  new Promise<T>((resolve, reject) => {
    const requestOptions = typeof options === 'string' ? { url: options } : options
    wx.request<WechatMiniprogram.IAnyObject>({
      url: `${API_BASE_URL}${requestOptions.url}`,
      method: requestOptions.method || 'GET',
      data: requestOptions.data,
      header: {
        'content-type': 'application/json',
        Authorization: `Bearer ${getUserToken()}`,
      },
      success: response => {
        const responseData = response.data as T | ApiResponse<T>
        const body = responseData as ApiResponse<T>
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error((body && (body.message || body.code)) || `请求失败：${response.statusCode}`))
          return
        }
        if (isApiResponse<T>(body)) {
          if (body.success === false) {
            reject(new Error(body.message || body.code || '请求失败'))
            return
          }
          resolve((body.data || null) as T)
          return
        }
        resolve(responseData as T)
      },
      fail: error => reject(new Error(error.errMsg || '网络请求失败')),
    })
  })

const uploadImage = (filePath: string) =>
  new Promise<string>((resolve, reject) => {
    wx.uploadFile({
      url: `${API_BASE_URL}/api/uploads/image`,
      filePath,
      name: 'file',
      header: { Authorization: `Bearer ${getUserToken()}` },
      success: response => {
        const body = parseUploadResponse(response.data)
        const data = body && isApiResponse<UploadResult>(body) ? body.data : body
        if (response.statusCode < 200 || response.statusCode >= 300 || !(data && data.url)) {
          reject(new Error(body && isApiResponse<UploadResult>(body) ? body.message || body.code || '上传失败' : '上传失败'))
          return
        }
        resolve(data.url)
      },
      fail: error => reject(new Error(error.errMsg || '上传失败')),
    })
  })

const toApiGender = (gender: Gender) => (gender === 'male' ? 1 : 2)

const normalizeGender = (gender: unknown): Gender | '' => {
  if (gender === 'male' || gender === 1 || gender === '1' || gender === '男') return 'male'
  if (gender === 'female' || gender === 2 || gender === '2' || gender === '女') return 'female'
  return ''
}

const avatarFor = (user: User) => {
  if (user.avatarUrl) return user.avatarUrl
  return normalizeGender(user.gender) === 'male' ? MALE_AVATAR_URL : FEMALE_AVATAR_URL
}

const creditStatusFor = (score: number) => (score <= 50 ? 'disabled' : score < 70 ? 'limited' : 'normal')

const normalizeUser = (user: Partial<User> | null | undefined, fallback: User): User => {
  const rawUser = user || {}
  const creditScore = Number(
    rawUser.creditScore !== undefined && rawUser.creditScore !== null
      ? rawUser.creditScore
      : fallback.creditScore !== undefined && fallback.creditScore !== null
        ? fallback.creditScore
        : 100
  )
  const nextUser = {
    ...fallback,
    ...rawUser,
    nickname: rawUser.nickname || rawUser.nickName || fallback.nickname || '',
    steamId: rawUser.steamId || fallback.steamId || '',
    creditScore,
    creditStatus: rawUser.creditStatus || fallback.creditStatus || creditStatusFor(creditScore),
  } as User

  return {
    ...nextUser,
    avatarUrl: avatarFor(nextUser),
  }
}

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
    maleAvatarUrl: MALE_AVATAR_URL,
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
    showProfileSheet: false,
    profileMode: 'edit' as ProfileMode,
    editNickname: '',
    editSteamId: '',
    editGender: '' as Gender | '',
    editAvatarUrl: '',
    editNicknameError: '',
    editSteamIdError: '',
    editGenderError: '',
    isUploadingAvatar: false,
    isSavingProfile: false,
  },

  onLoad() {
    enableShareMenu()
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
        const safeSummary = summary || {}
        const normalizedUser = normalizeUser(safeSummary.user, this.data.user)
        this.setData({
          user: normalizedUser,
          createdCount: Number(safeSummary.createdCount || 0),
          joinedCount: Number(safeSummary.joinedCount || 0),
          recent: (safeSummary.recent || []).map(formatCardTakeover),
        })
        if (!normalizedUser.nickname || !normalizedUser.steamId || !normalizedUser.gender) {
          this.openCompleteProfileSheet()
        }
      })
      .catch(error => {
        wx.showToast({ title: error.message || '加载失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ isLoading: false })
      })
  },

  onShareAppMessage() {
    const nickname = this.data.user.nickname || '兔兔玩家'
    return {
      title: `${nickname} 的兔兔窝主页`,
      path: '/pages/profile/profile',
    }
  },

  onShareTimeline() {
    return {
      title: HOME_SHARE_TITLE,
      query: '',
    }
  },

  openTakeover(event: WechatMiniprogram.TouchEvent & { detail?: { id?: number | string } }) {
    const id = (event.detail && event.detail.id) || event.currentTarget.dataset.id
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

  openCompleteProfileSheet() {
    this.setData({
      showProfileSheet: true,
      profileMode: 'complete',
      editNickname: this.data.user.nickname || '',
      editSteamId: this.data.user.steamId || '',
      editGender: normalizeGender(this.data.user.gender),
      editAvatarUrl: this.data.user.avatarUrl || this.data.femaleAvatarUrl,
      editNicknameError: '',
      editSteamIdError: '',
      editGenderError: '',
    })
  },

  openProfileSheet() {
    if (!this.data.user.nickname || !this.data.user.steamId || !this.data.user.gender) return
    this.setData({
      showProfileSheet: true,
      profileMode: 'edit',
      editNickname: this.data.user.nickname || '',
      editSteamId: this.data.user.steamId || '',
      editGender: normalizeGender(this.data.user.gender),
      editAvatarUrl: this.data.user.avatarUrl || this.data.femaleAvatarUrl,
      editNicknameError: '',
      editSteamIdError: '',
      editGenderError: '',
    })
  },

  closeProfileSheet() {
    if (this.data.profileMode === 'complete' || this.data.isSavingProfile) return
    this.setData({ showProfileSheet: false })
  },

  handleNicknameInput(event: WechatMiniprogram.Input) {
    this.setData({ editNickname: String(event.detail.value || '').trim(), editNicknameError: '' })
  },

  handleSteamIdInput(event: WechatMiniprogram.Input) {
    if (this.data.user.steamId) return
    this.setData({ editSteamId: String(event.detail.value || '').trim(), editSteamIdError: '' })
  },

  selectGender(event: WechatMiniprogram.TouchEvent & { detail?: { gender?: Gender } }) {
    const gender = ((event.detail && event.detail.gender) || event.currentTarget.dataset.gender) as Gender
    if (gender !== 'male' && gender !== 'female') return
    this.setData({
      editGender: gender,
      editAvatarUrl: gender === 'male' ? MALE_AVATAR_URL : FEMALE_AVATAR_URL,
      editGenderError: '',
    })
  },

  chooseAvatar() {
    if (this.data.isUploadingAvatar) return

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: result => {
        const filePath = result.tempFiles[0] && result.tempFiles[0].tempFilePath
        if (!filePath) return

        this.setData({ isUploadingAvatar: true })
        uploadImage(filePath)
          .then(url => this.setData({ editAvatarUrl: url }))
          .catch(error => wx.showToast({ title: error.message || '上传失败', icon: 'none' }))
          .finally(() => this.setData({ isUploadingAvatar: false }))
      },
    })
  },

  saveProfile() {
    const nickname = this.data.editNickname.trim()
    const steamId = this.data.editSteamId.trim()
    const gender = this.data.editGender
    const isCompleteMode = this.data.profileMode === 'complete'

    if (!nickname) {
      this.setData({ editNicknameError: '请输入昵称' })
      return
    }

    if (isCompleteMode) {
      const steamIdError = steamId ? (/^[0-9A-Za-z_:.-]{3,32}$/.test(steamId) ? '' : 'SteamID 格式不对') : '请输入 SteamID'
      const genderError = gender ? '' : '请选择性别'
      if (steamIdError || genderError) {
        this.setData({ editSteamIdError: steamIdError, editGenderError: genderError })
        return
      }
    }

    const avatarUrl = this.data.editAvatarUrl || (gender === 'male' ? MALE_AVATAR_URL : FEMALE_AVATAR_URL)
    const data = isCompleteMode
      ? { nickName: nickname, nickname, steamId, gender: toApiGender(gender as Gender), avatarUrl }
      : { nickName: nickname, nickname, steamId: this.data.user.steamId, gender: this.data.user.gender, avatarUrl }

    this.setData({ isSavingProfile: true })
    apiRequest<Partial<User>>({
      url: '/api/me/profile',
      method: 'PUT',
      data,
    })
      .then(user => {
        const savedUser = user || {}
        const nextUser = normalizeUser({
          ...this.data.user,
          ...savedUser,
          nickname: savedUser.nickname || savedUser.nickName || nickname,
          steamId: savedUser.steamId || steamId || this.data.user.steamId,
          gender: savedUser.gender || (isCompleteMode ? toApiGender(gender as Gender) : this.data.user.gender),
          avatarUrl: savedUser.avatarUrl || avatarUrl,
        }, this.data.user)
        this.setData({
          user: nextUser,
          showProfileSheet: false,
        })
      })
      .catch(error => wx.showToast({ title: error.message || '保存失败', icon: 'none' }))
      .finally(() => this.setData({ isSavingProfile: false }))
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.redirectTo({ url: '/pages/index/index' })
  },
})
}
