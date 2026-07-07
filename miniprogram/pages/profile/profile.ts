import { apiRequest, getUserToken, uploadImage } from '../../utils/api'
import { enableShareMenu, HOME_SHARE_TITLE } from '../../utils/share'

type Gender = 'male' | 'female'
type ProfileMode = 'complete' | 'edit'

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
  participantExtraCount?: number
  recommendTags?: { type?: string; label?: string; tone?: string }[]
  previewMembers?: { avatarUrl?: string }[]
}

type Summary = {
  user?: User
  createdCount?: number
  joinedCount?: number
  recent?: RecentTakeover[]
}

type ProfileCompletion = {
  score: number
  status: 'pending' | 'complete'
  title: string
  message: string
  tip: string
  badge: string
  tag: string
  actionLabel: string
}

type CreditInfo = {
  title: string
  desc: string
  badge: string
}

const FEMALE_AVATAR_URL = 'https://wechat-bot-images.oss-cn-hangzhou.aliyuncs.com/miniapp/default-avatar/avatar-female.jpg'
const MALE_AVATAR_URL = 'https://wechat-bot-images.oss-cn-hangzhou.aliyuncs.com/miniapp/default-avatar/avatar-male.jpg'
const PROFILE_BG_URL = 'https://wechat-bot-images.oss-cn-hangzhou.aliyuncs.com/miniapp/uploads/2026/06/220-1782216063196384700-57523733eb66.png'
const DEFAULT_AVATAR_URLS = [FEMALE_AVATAR_URL, MALE_AVATAR_URL]
const PROFILE_COMPLETION_DISMISSED_KEY = 'profileCompletionDismissed'
const STATUS_COVERS: Record<string, string> = {
  待发车: '/assets/takeover-card-pending.png',
  招募中: '/assets/takeover-card-recruiting.png',
  已满员: '/assets/takeover-card-full.png',
  已结束: '/assets/takeover-card-pending.png',
}


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

const getCreditInfo = (score: number, status: string): CreditInfo => {
  if (status === 'disabled') {
    return { title: '暂不可参与接龙', desc: '50 分及以下会暂停参与接龙，请联系管理员处理', badge: '' }
  }
  if (status === 'limited') {
    return { title: '参与接龙受限', desc: '低于 70 分会影响加入接龙，保持良好组队记录可恢复', badge: '' }
  }
  return { title: '信誉状态正常', desc: '70 分以上可正常加入接龙，90 分以上会展示可靠队友标识', badge: score >= 90 ? '可靠队友' : '' }
}

const getProfileCompletion = (user: User): ProfileCompletion => {
  const needsAvatar = !user.avatarUrl || DEFAULT_AVATAR_URLS.includes(user.avatarUrl)
  const needsSteamId = !user.steamId
  const score =
    (!needsAvatar ? 20 : 0) +
    (user.nickname ? 20 : 0) +
    (normalizeGender(user.gender) ? 10 : 0) +
    (!needsSteamId ? 40 : 0) +
    (Number(user.creditScore !== undefined && user.creditScore !== null ? user.creditScore : 100) >= 70 ? 10 : 0)

  if (needsSteamId && needsAvatar) {
    return { score, status: 'pending', title: '资料还差一点', message: '补上 SteamID，再换个头像更好认', tip: '完善资料后，队友更容易确认身份', badge: '!', tag: '待补 SteamID / 头像', actionLabel: '去完善' }
  }

  if (needsSteamId) {
    return { score, status: 'pending', title: '资料还差一点', message: '补上 SteamID，队友更容易找到你', tip: '完善资料后，队友更容易确认身份', badge: '!', tag: '待补 SteamID', actionLabel: '去完善' }
  }

  if (needsAvatar) {
    return { score, status: 'pending', title: '资料还差一点', message: '换个头像，队友更容易认出你', tip: '完善资料后，队友更容易确认身份', badge: '!', tag: '待换头像', actionLabel: '去完善' }
  }

  if (!user.nickname || !normalizeGender(user.gender)) {
    return { score, status: 'pending', title: '资料还差一点', message: '完善基础资料，接龙体验更顺滑', tip: '完善资料后，队友更容易确认身份', badge: '!', tag: '待补基础资料', actionLabel: '去完善' }
  }

  if (Number(user.creditScore !== undefined && user.creditScore !== null ? user.creditScore : 100) < 70) {
    return { score, status: 'pending', title: '资料还差一点', message: '保持良好组队记录，资料会更完整', tip: '完善资料后，队友更容易确认身份', badge: '!', tag: '信誉待恢复', actionLabel: '编辑资料' }
  }

  return { score, status: 'complete', title: '资料已满分', message: '队友一眼就能找到你，组队体验拉满', tip: '保持这个状态，组队会更顺利', badge: '✓', tag: '满分档案', actionLabel: '编辑资料' }
}

const shouldShowProfileCompletion = (completion: ProfileCompletion) => (
  completion.score < 100 || wx.getStorageSync(PROFILE_COMPLETION_DISMISSED_KEY) !== true
)

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
    steamId: rawUser.steamId !== undefined && rawUser.steamId !== null ? rawUser.steamId : fallback.steamId || '',
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
  const participantAvatars = (takeover.previewMembers || []).map(member => member.avatarUrl || FEMALE_AVATAR_URL).slice(0, 4)
  return {
    ...takeover,
    statusTone,
    coverImage: STATUS_COVERS[takeover.statusLabel] || STATUS_COVERS['招募中'],
    participantAvatars,
    participantExtraCount: Math.max((takeover.joinedCount || 0) - participantAvatars.length, 0),
    recommendTags: (takeover.recommendTags || []).filter(tag => tag.label !== '已满员').slice(0, 2),
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
    profileCompletion: {
      score: 0,
      status: 'pending',
      title: '资料还差一点',
      message: '补上 SteamID，队友更容易找到你',
      tip: '完善资料后，队友更容易确认身份',
      badge: '!',
      tag: '待补 SteamID',
      actionLabel: '去完善',
    } as ProfileCompletion,
    creditInfo: {
      title: '信誉状态正常',
      desc: '70 分以上可正常加入接龙，90 分以上会展示可靠队友标识',
      badge: '可靠队友',
    } as CreditInfo,
    showCreditHelp: false,
    showProfileCompletion: true,
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
        const profileCompletion = getProfileCompletion(normalizedUser)
        if (profileCompletion.score < 100) wx.removeStorageSync(PROFILE_COMPLETION_DISMISSED_KEY)
        this.setData({
          user: normalizedUser,
          profileCompletion,
          creditInfo: getCreditInfo(Number(normalizedUser.creditScore || 100), normalizedUser.creditStatus || 'normal'),
          showProfileCompletion: shouldShowProfileCompletion(profileCompletion),
          createdCount: Number(safeSummary.createdCount || 0),
          joinedCount: Number(safeSummary.joinedCount || 0),
          recent: (safeSummary.recent || []).map(formatCardTakeover),
        })
        if (!normalizedUser.nickname || !normalizedUser.gender) {
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

  openFeedback() {
    wx.navigateTo({ url: '/pages/feedback/feedback' })
  },

  openMyFeedbacks() {
    wx.navigateTo({ url: '/pages/my-feedbacks/my-feedbacks' })
  },

  openCreditLogs() {
    wx.navigateTo({ url: '/pages/credit-logs/credit-logs' })
  },

  openCreditHelp() {
    this.setData({ showCreditHelp: true })
  },

  closeCreditHelp() {
    this.setData({ showCreditHelp: false })
  },

  openProfileCompletion() {
    if (!this.data.user.nickname || !this.data.user.gender) {
      this.openCompleteProfileSheet()
      return
    }
    this.openProfileSheet()
  },

  closeProfileCompletion() {
    if (this.data.profileCompletion.score < 100) return
    wx.setStorageSync(PROFILE_COMPLETION_DISMISSED_KEY, true)
    this.setData({ showProfileCompletion: false })
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
    if (!this.data.user.nickname || !this.data.user.gender) return
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

    const steamIdError = steamId ? (/^[0-9A-Za-z_:.-]{3,32}$/.test(steamId) ? '' : 'SteamID 格式不对') : ''
    const genderError = isCompleteMode && !gender ? '请选择性别' : ''
    if (steamIdError || genderError) {
      this.setData({ editSteamIdError: steamIdError, editGenderError: genderError })
      return
    }

    const avatarUrl = this.data.editAvatarUrl || (gender === 'male' ? MALE_AVATAR_URL : FEMALE_AVATAR_URL)
    const data = isCompleteMode
      ? { nickName: nickname, nickname, steamId, gender: toApiGender(gender as Gender), avatarUrl }
      : { nickName: nickname, nickname, steamId, gender: this.data.user.gender, avatarUrl }

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
          steamId: savedUser.steamId !== undefined && savedUser.steamId !== null ? savedUser.steamId : steamId,
          gender: savedUser.gender || (isCompleteMode ? toApiGender(gender as Gender) : this.data.user.gender),
          avatarUrl: savedUser.avatarUrl || avatarUrl,
        }, this.data.user)
        const profileCompletion = getProfileCompletion(nextUser)
        if (profileCompletion.score < 100) wx.removeStorageSync(PROFILE_COMPLETION_DISMISSED_KEY)
        this.setData({
          user: nextUser,
          profileCompletion,
          creditInfo: getCreditInfo(Number(nextUser.creditScore || 100), nextUser.creditStatus || 'normal'),
          showProfileCompletion: shouldShowProfileCompletion(profileCompletion),
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
