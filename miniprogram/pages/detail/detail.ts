export {}

import { apiRequest, getUserToken, uploadImage } from '../../utils/api'
import { enableShareMenu, HOME_SHARE_TITLE } from '../../utils/share'

type Gender = 'male' | 'female'
type ScheduleType = 'once' | 'daily' | 'range'
type Schedule =
  | {
      type: 'once'
      date: string
      time: string
    }
  | {
      type: 'daily'
      time: string
    }
  | {
      type: 'range'
      startDate: string
      endDate: string
      time: string
    }

type UserProfile = {
  userId?: string
  openid?: string
  nickName: string
  steamId: string
  remark?: string
  avatarUrl: string
  gender: Gender
  isAdmin?: boolean
  creditScore?: number
  creditStatus?: string
  hasReported?: boolean
  canReport?: boolean
  isSelf?: boolean
  reportStatus?: string
}

type Participant = UserProfile

type Takeover = {
  id: string
  title: string
  host: string
  joined: number
  limit: number
  schedule: Schedule
  scheduleText: string
  description: string
  avatarUrl: string
  participantAvatars: string[]
  participants: Participant[]
  hasJoined: boolean
  isCreator: boolean
  canManage: boolean
  categoryLabel: string
  cardTags: string[]
  statusLabel: string
  statusTone: string
  takeoverState: number
  coverImage: string
  kookChannelId: string
  kookChannelName: string
  kookInviteUrl: string
}

type LoginResult = {
  token?: string
  user?: Record<string, any>
}
type ProfilePayload = {
  nickName: string
  steamId: string
  gender: Gender
  avatarUrl: string
}

const TOKEN_KEY = 'steam_takeover_token'
const PROFILE_KEY = 'steam_takeover_user'
const HOME_REFRESH_KEY = 'steam_takeover_home_needs_refresh'
const MALE_AVATAR_URL = 'https://wechat-bot-images.oss-cn-hangzhou.aliyuncs.com/miniapp/default-avatar/avatar-male.jpg'
const FEMALE_AVATAR_URL = 'https://wechat-bot-images.oss-cn-hangzhou.aliyuncs.com/miniapp/default-avatar/avatar-female.jpg'
const CARD_COVERS = [
  '/assets/takeover-card-pending.png',
  '/assets/takeover-card-recruiting.png',
  '/assets/takeover-card-full.png',
]
const CARD_CATEGORIES = ['王者荣耀', '和平精英', '英雄联盟', 'Steam同好', '派对游戏']
const STATUS_COVERS: Record<string, string> = {
  招募中: '/assets/takeover-card-recruiting.png',
  已满员: '/assets/takeover-card-full.png',
  已结束: '/assets/takeover-card-pending.png',
}

const getCreditScore = (raw: Record<string, any> | null | undefined) =>
  Number(raw ? (raw.creditScore !== undefined && raw.creditScore !== null ? raw.creditScore : raw.credit_score !== undefined && raw.credit_score !== null ? raw.credit_score : 100) : 100)
const getCreditStatus = (score: number) => (score <= 50 ? 'disabled' : score < 70 ? 'limited' : 'normal')
const canJoinWithCredit = (score?: number) => score === undefined || score >= 70
const isTrue = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true'


const refreshPreviousHome = (page: WechatMiniprogram.Page.Instance<WechatMiniprogram.IAnyObject, WechatMiniprogram.IAnyObject>) => {
  const eventChannel = page.getOpenerEventChannel()
  if (eventChannel && typeof eventChannel.emit === 'function') {
    eventChannel.emit('takeoverChanged')
  }

  wx.setStorageSync(HOME_REFRESH_KEY, Date.now())
  const pages = getCurrentPages()
  const previousPage = pages[pages.length - 2] as unknown as {
    loadTakeoversFromServer?: (page: number, replace: boolean) => void
  }

  if (previousPage && typeof previousPage.loadTakeoversFromServer === 'function') {
    previousPage.loadTakeoversFromServer(1, true)
    wx.removeStorageSync(HOME_REFRESH_KEY)
  }
}


const getGenderAvatar = (gender: Gender | '') => {
  if (gender === 'female') {
    return FEMALE_AVATAR_URL
  }

  if (gender === 'male') {
    return MALE_AVATAR_URL
  }

  return ''
}
const isDefaultAvatar = (avatarUrl: string) => avatarUrl === MALE_AVATAR_URL || avatarUrl === FEMALE_AVATAR_URL

const toApiGender = (gender: Gender) => (gender === 'male' ? 1 : 2)

const normalizeGender = (gender: unknown): Gender | '' => {
  if (gender === 'female' || gender === 2 || gender === '2' || gender === '女') {
    return 'female'
  }

  if (gender === 'male' || gender === 1 || gender === '1' || gender === '男') {
    return 'male'
  }

  return ''
}

const normalizeParticipant = (rawParticipant: Record<string, any>): Participant => {
  const gender = normalizeGender(rawParticipant.gender) || 'female'
  const creditScore = getCreditScore(rawParticipant)

  return {
    userId: rawParticipant.userId ? String(rawParticipant.userId) : rawParticipant.id ? String(rawParticipant.id) : undefined,
    openid: rawParticipant.openid ? String(rawParticipant.openid) : undefined,
    nickName: rawParticipant.nickName || rawParticipant.nickname || '玩家',
    steamId: rawParticipant.steamId || rawParticipant.steam_id || '',
    remark: normalizeRemark(rawParticipant.remark),
    gender,
    avatarUrl: rawParticipant.avatarUrl || rawParticipant.avatar_url || getGenderAvatar(gender),
    creditScore,
    creditStatus: rawParticipant.creditStatus || rawParticipant.credit_status || getCreditStatus(creditScore),
    hasReported: isTrue(rawParticipant.hasReported) || isTrue(rawParticipant.has_reported) || isTrue(rawParticipant.reported),
    isSelf: isTrue(rawParticipant.isSelf) || isTrue(rawParticipant.is_self),
  }
}

const getUserKey = (user: { userId?: string; openid?: string } | null | undefined) =>
  user ? user.userId || user.openid || '' : ''

const normalizeRemark = (value: unknown) => Array.from(String(value || '').trim()).slice(0, 100).join('')

const normalizeTakeoverState = (rawTakeover: Record<string, any>) =>
  Number(rawTakeover.takeoverState || rawTakeover.takeover_state || 1) === 2 ? 2 : 1

const normalizeUserProfile = (rawProfile: Record<string, any> | null | undefined): UserProfile | null => {
  if (!rawProfile) {
    return null
  }

  const gender = normalizeGender(rawProfile.gender)
  const nickName = rawProfile.nickName || rawProfile.nickname || ''
  const steamId = rawProfile.steamId || rawProfile.steam_id || ''
  const creditScore = getCreditScore(rawProfile)

  if (!nickName || !gender) {
    return null
  }

  return {
    userId: rawProfile.userId ? String(rawProfile.userId) : rawProfile.id ? String(rawProfile.id) : undefined,
    openid: rawProfile.openid ? String(rawProfile.openid) : undefined,
    nickName,
    steamId,
    remark: '',
    gender,
    avatarUrl: rawProfile.avatarUrl || rawProfile.avatar_url || getGenderAvatar(gender),
    isAdmin: !!(rawProfile.isAdmin || rawProfile.is_admin),
    creditScore,
    creditStatus: rawProfile.creditStatus || rawProfile.credit_status || getCreditStatus(creditScore),
  }
}

const normalizeScheduleType = (scheduleType: unknown): ScheduleType => {
  if (scheduleType === 'daily' || scheduleType === 2 || scheduleType === '2') {
    return 'daily'
  }

  if (scheduleType === 'range' || scheduleType === 3 || scheduleType === '3' || scheduleType === 'date_range') {
    return 'range'
  }

  return 'once'
}

const stripTimeSeconds = (time: unknown) => {
  if (typeof time !== 'string') {
    return ''
  }

  return time.length >= 5 ? time.slice(0, 5) : time
}

function parseDateText(dateText: string) {
  const normalizedDateText = dateText.trim()
  const fullDateMatch = normalizedDateText.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)

  if (fullDateMatch) {
    const year = Number(fullDateMatch[1])
    const month = Number(fullDateMatch[2])
    const day = Number(fullDateMatch[3])
    const parsedDate = new Date(year, month - 1, day)

    if (
      parsedDate.getFullYear() === year &&
      parsedDate.getMonth() === month - 1 &&
      parsedDate.getDate() === day
    ) {
      return parsedDate
    }

    return null
  }

  const match = dateText.trim().match(/^(?:\d{4}-)?(\d{1,2})[/-](\d{1,2})$/)

  if (!match) {
    return null
  }

  const month = Number(match[1])
  const day = Number(match[2])
  const currentYear = new Date().getFullYear()
  const parsedDate = new Date(currentYear, month - 1, day)

  return parsedDate.getMonth() === month - 1 && parsedDate.getDate() === day ? parsedDate : null
}

const padDatePart = (value: number) => String(value).padStart(2, '0')

const formatDateForInput = (date: Date) => {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`
}

const getDateLabel = (dateText: string) => {
  const parsedDate = parseDateText(dateText)

  if (!parsedDate) {
    return dateText
  }

  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const normalizedDate = formatDateForInput(parsedDate)

  if (normalizedDate === formatDateForInput(today)) {
    return '今天'
  }

  if (normalizedDate === formatDateForInput(tomorrow)) {
    return '明天'
  }

  return `${padDatePart(parsedDate.getMonth() + 1)}/${padDatePart(parsedDate.getDate())}`
}

const formatSchedule = (schedule: Schedule) => {
  if (schedule.type === 'once') {
    return `${getDateLabel(schedule.date)} ${schedule.time}`
  }

  if (schedule.type === 'daily') {
    return `每天 ${schedule.time}`
  }

  return `${getDateLabel(schedule.startDate)}-${getDateLabel(schedule.endDate)} 每天 ${schedule.time}`
}

const buildTakeoverPayload = (
  title: string,
  limit: number,
  scheduleType: ScheduleType,
  schedule: Schedule,
  description: string,
  kookChannelId = '',
  kookChannelName = ''
) => ({
  title,
  participantLimit: limit,
  scheduleType: scheduleType === 'daily' ? 2 : scheduleType === 'range' ? 3 : 1,
  startDate:
    schedule.type === 'daily'
      ? undefined
      : schedule.type === 'range'
        ? schedule.startDate
        : schedule.date,
  endDate: schedule.type === 'range' ? schedule.endDate : undefined,
  playTime: schedule.time,
  description,
  kookChannelId,
  kookChannelName,
})

const normalizeTakeover = (rawTakeover: Record<string, any>): Takeover => {
  const scheduleType = normalizeScheduleType(rawTakeover.scheduleType || rawTakeover.schedule_type)
  const playTime = stripTimeSeconds(rawTakeover.playTime || rawTakeover.play_time || rawTakeover.time)
  const membersSource = rawTakeover.members || rawTakeover.participants || rawTakeover.previewMembers || []
  const participants = Array.isArray(membersSource)
    ? membersSource.map((member: Record<string, any>) => normalizeParticipant(member))
    : []
  const joined = Number(rawTakeover.joinedCount || rawTakeover.joined_count || rawTakeover.joined || participants.length || 0)
  const limit = Number(rawTakeover.participantLimit || rawTakeover.participant_limit || rawTakeover.limit || 0)
  const numericId = String(rawTakeover.id || '')
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const schedule: Schedule =
    scheduleType === 'daily'
      ? { type: 'daily', time: playTime }
      : scheduleType === 'range'
        ? {
            type: 'range',
            startDate: rawTakeover.startDate || rawTakeover.start_date || '',
            endDate: rawTakeover.endDate || rawTakeover.end_date || '',
            time: playTime,
          }
        : {
            type: 'once',
            date: rawTakeover.startDate || rawTakeover.start_date || rawTakeover.date || '',
            time: playTime,
          }
  const statusLabel = rawTakeover.statusLabel || rawTakeover.status_label || (joined >= limit && limit > 0 ? '已满员' : '招募中')
  const takeoverState = normalizeTakeoverState(rawTakeover)

  return {
    id: String(rawTakeover.id),
    title: rawTakeover.title || '',
    host: rawTakeover.host || rawTakeover.creatorName || rawTakeover.creator_name || '',
    joined,
    limit,
    schedule,
    scheduleText: rawTakeover.scheduleText || rawTakeover.schedule_text || formatSchedule(schedule),
    description: rawTakeover.description || '',
    avatarUrl: rawTakeover.avatarUrl || rawTakeover.avatar_url || (participants[0] && participants[0].avatarUrl) || FEMALE_AVATAR_URL,
    participantAvatars: participants.map(participant => participant.avatarUrl).slice(0, 4),
    participants,
    hasJoined: !!(rawTakeover.hasJoined || rawTakeover.has_joined),
    isCreator: !!(rawTakeover.isCreator || rawTakeover.is_creator),
    canManage: !!(rawTakeover.canManage || rawTakeover.can_manage),
    categoryLabel: rawTakeover.categoryLabel || rawTakeover.category_label || rawTakeover.gameName || rawTakeover.game_name || CARD_CATEGORIES[numericId % CARD_CATEGORIES.length],
    cardTags: [
      rawTakeover.teamType || rawTakeover.team_type || (limit <= 4 ? '四排' : '五排'),
      rawTakeover.mode || rawTakeover.mode_label || (scheduleType === 'daily' ? '日常' : '上分'),
      joined >= limit && limit > 0 ? '满员' : '开黑',
    ],
    statusLabel,
    statusTone: takeoverState === 2 ? 'ended' : statusLabel === '已满员' ? 'purple' : 'orange',
    takeoverState,
    coverImage: rawTakeover.coverImage || rawTakeover.cover_image || STATUS_COVERS[statusLabel] || CARD_COVERS[numericId % CARD_COVERS.length],
    kookChannelId: rawTakeover.kookChannelId || rawTakeover.kook_channel_id || '',
    kookChannelName: rawTakeover.kookChannelName || rawTakeover.kook_channel_name || '',
    kookInviteUrl: rawTakeover.kookInviteUrl || rawTakeover.kook_invite_url || '',
  }
}

const getStoredProfile = (): UserProfile | null => {
  const userProfile = wx.getStorageSync(PROFILE_KEY)

  if (
    userProfile &&
    typeof userProfile.nickName === 'string' &&
    (userProfile.gender === 'male' || userProfile.gender === 'female') &&
    userProfile.nickName
  ) {
    return {
      nickName: userProfile.nickName,
      steamId: typeof userProfile.steamId === 'string' ? userProfile.steamId : '',
      remark: '',
      gender: userProfile.gender,
      avatarUrl: userProfile.avatarUrl || getGenderAvatar(userProfile.gender),
      isAdmin: !!userProfile.isAdmin,
      creditScore: Number(userProfile.creditScore !== undefined && userProfile.creditScore !== null ? userProfile.creditScore : 100),
      creditStatus: userProfile.creditStatus || getCreditStatus(Number(userProfile.creditScore !== undefined && userProfile.creditScore !== null ? userProfile.creditScore : 100)),
    }
  }

  return null
}

Page({
  data: {
    takeoverId: '',
    sharePath: '/pages/index/index',
    takeover: null as Takeover | null,
    isLoading: false,
    isJoining: false,
    isLeaving: false,
    joinButtonText: '加入队伍',
    hasJoined: false,
    isCreator: false,
    canJoin: false,
    canManage: false,
    isAuthorizing: false,
    showProfileSheet: false,
    nickName: '',
    steamId: '',
    steamIdLocked: false,
    gender: '' as Gender | '',
    avatarUrl: '',
    nickNameError: '',
    steamIdError: '',
    genderError: '',
    isUploadingAvatar: false,
    isSaving: false,
    maleAvatarUrl: MALE_AVATAR_URL,
    femaleAvatarUrl: FEMALE_AVATAR_URL,
    isSavingAdmin: false,
    isDeleting: false,
    showEditSheet: false,
    editTitle: '',
    editLimit: '',
    editScheduleType: 'once' as ScheduleType,
    editDate: '',
    editStartDate: '',
    editEndDate: '',
    editTime: '',
    editDescription: '',
    editKookChannelId: '',
    editKookChannelName: '',
    editKookChannelSearch: '',
    todayDate: formatDateForInput(new Date()),
    showReportSheet: false,
    reportUserId: '',
    reportUserKey: '',
    reportNickname: '',
    reportContent: '',
    reportImageUrl: '',
    reportImageUrls: [] as string[],
    reportedUserKeys: [] as string[],
    isUploadingReportImage: false,
    isSubmittingReport: false,
    showRemarkSheet: false,
    remarkMode: 'join' as 'join' | 'edit',
    memberRemark: '',
    memberRemarkError: '',
    isSavingRemark: false,
  },

  onLoad(options: Record<string, string | undefined>) {
    const takeoverId = decodeURIComponent(options.id || '')
    const storedProfile = getStoredProfile()

    enableShareMenu()
    this.setData({
      takeoverId,
      sharePath: takeoverId ? `/pages/detail/detail?id=${encodeURIComponent(takeoverId)}` : '/pages/index/index',
    })
    this.setData({ canManage: !!(storedProfile && storedProfile.isAdmin) })
    if (!takeoverId) {
      wx.showToast({ title: '队伍不存在', icon: 'none' })
      return
    }

    this.bootstrap()
  },

  bootstrap() {
    if (getUserToken()) {
      this.loadCurrentProfile()
      this.loadTakeover()
      return
    }

    this.setData({ isAuthorizing: true })
    wx.login({
      success: ({ code }) => {
        if (!code) {
          this.setData({ isAuthorizing: false })
          wx.showToast({ title: '登录失败，请重试', icon: 'none' })
          return
        }
        apiRequest<LoginResult>({
          url: '/api/auth/wx-login',
          method: 'POST',
          data: { code },
          tokenType: 'none',
        })
          .then(result => {
            if (result.token) wx.setStorageSync(TOKEN_KEY, result.token)
            const profile = normalizeUserProfile(result.user)
            if (profile) {
              this.applyProfile(profile)
            } else {
              wx.removeStorageSync(PROFILE_KEY)
              this.openProfileSheet()
            }
            this.loadTakeover()
          })
          .catch(error => {
            wx.showToast({ title: error.message || '登录失败', icon: 'none' })
          })
          .finally(() => {
            this.setData({ isAuthorizing: false })
          })
      },
      fail: () => {
        this.setData({ isAuthorizing: false })
        wx.showToast({ title: '登录失败，请重试', icon: 'none' })
      },
    })
  },

  applyProfile(profile: UserProfile) {
    wx.setStorageSync(PROFILE_KEY, profile)
    getApp<IAppOption>().globalData.userProfile = profile
    this.setData({
      nickName: profile.nickName,
      steamId: profile.steamId,
      steamIdLocked: !!profile.steamId,
      gender: profile.gender,
      avatarUrl: profile.avatarUrl,
      canManage: profile.isAdmin || this.data.canManage,
    })
  },

  loadCurrentProfile() {
    apiRequest<Record<string, any>>({
      url: '/api/me/profile',
    })
      .then(result => {
        const profile = normalizeUserProfile(result)

        if (profile) this.applyProfile(profile)
        else this.openProfileSheet()

        if (profile && this.data.takeover) {
          this.setData({ takeover: this.withReportState(this.data.takeover) })
        }
      })
      .catch(() => {
        if (!getStoredProfile()) this.openProfileSheet()
      })
  },

  openProfileSheet() {
    this.setData({
      showProfileSheet: true,
      nickNameError: '',
      steamIdError: '',
      genderError: '',
      avatarUrl: this.data.avatarUrl || getGenderAvatar(this.data.gender),
    })
  },

  closeProfileSheet() {
    this.setData({ showProfileSheet: false })
  },

  ensureProfileReady() {
    if (getStoredProfile()) return true
    this.openProfileSheet()
    wx.showToast({ title: '请先补充资料', icon: 'none' })
    return false
  },

  selectGender(event: WechatMiniprogram.TouchEvent & { detail?: { gender?: Gender } }) {
    const gender = ((event.detail && event.detail.gender) || event.currentTarget.dataset.gender) as Gender
    if (gender !== 'male' && gender !== 'female') return
    this.setData({
      gender,
      avatarUrl: !this.data.avatarUrl || isDefaultAvatar(this.data.avatarUrl) ? getGenderAvatar(gender) : this.data.avatarUrl,
      genderError: '',
    })
  },

  handleNickNameInput(event: WechatMiniprogram.Input | WechatMiniprogram.CustomEvent<{ value?: string }>) {
    this.setData({ nickName: String((event.detail as { value?: string }).value || '').trim(), nickNameError: '' })
  },

  handleSteamIdInput(event: WechatMiniprogram.Input | WechatMiniprogram.CustomEvent<{ value?: string }>) {
    if (this.data.steamIdLocked) return
    this.setData({ steamId: String((event.detail as { value?: string }).value || '').trim(), steamIdError: '' })
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
          .then(url => this.setData({ avatarUrl: url }))
          .catch(error => wx.showToast({ title: error.message || '上传失败', icon: 'none' }))
          .finally(() => this.setData({ isUploadingAvatar: false }))
      },
    })
  },

  validateSteamId(steamId: string) {
    if (!steamId) return ''
    return /^[0-9A-Za-z_:.-]{3,32}$/.test(steamId) ? '' : 'SteamID 可填写 3-32 位数字、字母或 _ : . -'
  },

  saveProfile() {
    if (this.data.isSaving) return
    const nickName = this.data.nickName.trim()
    const steamId = this.data.steamId.trim()
    const gender = this.data.gender
    const nickNameError = nickName ? '' : '请输入昵称'
    const steamIdError = this.validateSteamId(steamId)
    const genderError = gender ? '' : '请选择性别'
    if (nickNameError || steamIdError || genderError) {
      this.setData({ nickNameError, steamIdError, genderError })
      return
    }
    const payload: ProfilePayload = {
      nickName,
      steamId,
      gender: gender as Gender,
      avatarUrl: this.data.avatarUrl || getGenderAvatar(gender as Gender),
    }
    this.setData({ isSaving: true })
    apiRequest<Record<string, any>>({
      url: '/api/me/profile',
      method: 'PUT',
      data: {
        nickName: payload.nickName,
        steamId: payload.steamId,
        gender: toApiGender(payload.gender),
        avatarUrl: payload.avatarUrl,
      },
    })
      .then(result => {
        this.applyProfile(normalizeUserProfile(result) || payload)
        this.setData({ showProfileSheet: false })
        this.loadTakeover()
      })
      .catch(error => wx.showToast({ title: error.message || '保存失败', icon: 'none' }))
      .finally(() => this.setData({ isSaving: false }))
  },

  onShareAppMessage() {
    const takeover = this.data.takeover
    return {
      title: takeover ? `${takeover.title} - ${HOME_SHARE_TITLE}` : HOME_SHARE_TITLE,
      path: this.data.sharePath,
    }
  },

  onShareTimeline() {
    const takeover = this.data.takeover
    return {
      title: takeover ? `${takeover.title} - ${HOME_SHARE_TITLE}` : HOME_SHARE_TITLE,
      query: this.data.takeoverId ? `id=${encodeURIComponent(this.data.takeoverId)}` : '',
    }
  },

  openEditSheet() {
    const takeover = this.data.takeover

    if (!this.data.canManage || !takeover) {
      return
    }
    if (takeover.takeoverState === 2) {
      wx.showToast({ title: '已结束的接龙不可编辑', icon: 'none' })
      return
    }

    this.setData({
      showEditSheet: true,
      editTitle: takeover.title,
      editLimit: String(takeover.limit),
      editScheduleType: takeover.schedule.type,
      editDate: takeover.schedule.type === 'once' ? formatDateForInput(parseDateText(takeover.schedule.date) || new Date()) : '',
      editStartDate: takeover.schedule.type === 'range' ? formatDateForInput(parseDateText(takeover.schedule.startDate) || new Date()) : '',
      editEndDate: takeover.schedule.type === 'range' ? formatDateForInput(parseDateText(takeover.schedule.endDate) || new Date()) : '',
      editTime: takeover.schedule.time,
      editDescription: takeover.description,
      editKookChannelId: takeover.kookChannelId,
      editKookChannelName: takeover.kookChannelName,
      editKookChannelSearch: takeover.kookChannelName,
    })
  },

  closeEditSheet() {
    this.setData({ showEditSheet: false })
  },

  handleEditTitleInput(event: WechatMiniprogram.Input) {
    this.setData({ editTitle: event.detail.value.trim() })
  },

  handleEditLimitInput(event: WechatMiniprogram.Input) {
    this.setData({ editLimit: event.detail.value.trim() })
  },

  handleEditDescriptionInput(event: WechatMiniprogram.Input) {
    this.setData({ editDescription: event.detail.value.trim() })
  },

  selectEditScheduleType(event: WechatMiniprogram.TouchEvent) {
    const scheduleType = event.currentTarget.dataset.type as ScheduleType
    if (scheduleType === 'once' || scheduleType === 'daily' || scheduleType === 'range') {
      this.setData({ editScheduleType: scheduleType })
    }
  },

  handleEditDateChange(event: WechatMiniprogram.PickerChange | { detail: { value: string } }) {
    this.setData({ editDate: event.detail.value as string })
  },

  handleEditStartDateChange(event: WechatMiniprogram.PickerChange | { detail: { value: string } }) {
    const startDate = event.detail.value as string
    const endDate = this.data.editEndDate
    this.setData({
      editStartDate: startDate,
      editEndDate: endDate && endDate < startDate ? startDate : endDate,
    })
  },

  handleEditEndDateChange(event: WechatMiniprogram.PickerChange | { detail: { value: string } }) {
    const endDate = event.detail.value as string
    const startDate = this.data.editStartDate
    this.setData({
      editStartDate: startDate && startDate > endDate ? endDate : startDate,
      editEndDate: endDate,
    })
  },

  handleEditTimeChange(event: WechatMiniprogram.PickerChange | { detail: { value: string } }) {
    this.setData({ editTime: event.detail.value as string })
  },

  handleEditKookChannelChange(event: WechatMiniprogram.CustomEvent) {
    const detail = event.detail || {}
    this.setData({
      editKookChannelId: detail.id || '',
      editKookChannelName: detail.name || '',
      editKookChannelSearch: detail.label || detail.name || '',
    })
  },

  buildEditSchedule(): Schedule | null {
    const time = this.data.editTime.trim()
    if (!time) return null

    if (this.data.editScheduleType === 'daily') {
      return { type: 'daily', time }
    }

    if (this.data.editScheduleType === 'range') {
      if (!this.data.editStartDate || !this.data.editEndDate) return null
      return {
        type: 'range',
        startDate: this.data.editStartDate,
        endDate: this.data.editEndDate,
        time,
      }
    }

    if (!this.data.editDate) return null
    return { type: 'once', date: this.data.editDate, time }
  },

  saveAdminEdit() {
    const takeover = this.data.takeover
    if (!this.data.canManage || !takeover || this.data.isSavingAdmin) return
    if (takeover.takeoverState === 2) {
      wx.showToast({ title: '已结束的接龙不可编辑', icon: 'none' })
      return
    }

    const title = this.data.editTitle.trim()
    const description = this.data.editDescription.trim()
    const limit = Number(this.data.editLimit)
    const schedule = this.buildEditSchedule()

    if (!title || title.length > 30 || !description || description.length > 500 || !Number.isInteger(limit) || limit <= 0 || limit > 99 || !schedule) {
      wx.showToast({ title: '请完整填写接龙信息', icon: 'none' })
      return
    }

    this.setData({ isSavingAdmin: true })
    apiRequest<Record<string, any> | null>({
      url: `/api/takeovers/${takeover.id}`,
      method: 'PUT',
      data: buildTakeoverPayload(title, limit, this.data.editScheduleType, schedule, description, this.data.editKookChannelId, this.data.editKookChannelName),
    })
      .then(result => {
        const editedTakeover = result
          ? normalizeTakeover(result as Record<string, any>)
          : normalizeTakeover({ ...takeover, title, participantLimit: limit, scheduleType: this.data.editScheduleType, playTime: schedule.time, startDate: schedule.type === 'daily' ? '' : schedule.type === 'range' ? schedule.startDate : schedule.date, endDate: schedule.type === 'range' ? schedule.endDate : undefined, description, kookChannelId: this.data.editKookChannelId, kookChannelName: this.data.editKookChannelName })
        if (!editedTakeover.participants.length) {
          editedTakeover.participants = takeover.participants
          editedTakeover.participantAvatars = takeover.participantAvatars
        }
        this.setData({
          takeover: editedTakeover,
          ...this.getJoinState(editedTakeover),
          showEditSheet: false,
        })
        wx.showToast({ title: '已保存', icon: 'success' })
      })
      .catch(error => {
        wx.showToast({ title: error.message || '保存失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ isSavingAdmin: false })
      })
  },

  deleteAdminTakeover() {
    const takeover = this.data.takeover
    if (!this.data.canManage || !takeover || this.data.isDeleting) return
    if (takeover.takeoverState === 2) {
      wx.showToast({ title: '已结束的接龙不可删除', icon: 'none' })
      return
    }

    wx.showModal({
      title: '删除接龙',
      content: '删除后当前接龙将不可恢复。',
      confirmText: '删除',
      confirmColor: '#fb7185',
      success: ({ confirm }) => {
        if (!confirm) return

        this.setData({ isDeleting: true })
        apiRequest<null>({
          url: `/api/takeovers/${takeover.id}`,
          method: 'DELETE',
        })
          .then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => {
              wx.redirectTo({ url: '/pages/index/index' })
            }, 500)
          })
          .catch(error => {
            wx.showToast({ title: error.message || '删除失败', icon: 'none' })
          })
          .finally(() => {
            this.setData({ isDeleting: false })
          })
      },
    })
  },

  loadTakeover() {
    this.setData({ isLoading: true })
    apiRequest<Record<string, any>>({
      url: `/api/takeovers/${this.data.takeoverId}`,
    })
      .then(result => {
        const takeover = this.withReportState(normalizeTakeover(result))
        this.setData({
          takeover,
          ...this.getJoinState(takeover),
          isCreator: takeover.isCreator,
          canManage: takeover.canManage || this.data.canManage,
        })
      })
      .catch(error => {
        wx.showToast({ title: error.message || '详情加载失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ isLoading: false })
      })
  },

  withReportState(takeover: Takeover, reportedUserKeys?: string[]) {
    const keys = reportedUserKeys || this.data.reportedUserKeys
    return {
      ...takeover,
      participants: takeover.participants.map(participant => {
        const userKey = getUserKey(participant)
        const isSelf = !!participant.isSelf
        const hasReported = !!participant.hasReported || (!!userKey && keys.indexOf(userKey) >= 0)
        return {
          ...participant,
          isSelf,
          hasReported,
          canReport: !isSelf && !hasReported,
          reportStatus: isSelf ? '自己' : hasReported ? '已举报' : '举报',
        }
      }),
    }
  },

  getJoinState(takeover: Takeover) {
    const hasJoined = takeover.hasJoined
    const isFull = takeover.limit > 0 && takeover.joined >= takeover.limit

    if (hasJoined) {
      return { hasJoined: true, isCreator: takeover.isCreator, joinButtonText: '退出队伍', canJoin: true }
    }

    if (isFull) {
      return { hasJoined: false, isCreator: takeover.isCreator, joinButtonText: '队伍已满员', canJoin: false }
    }

    return { hasJoined: false, isCreator: takeover.isCreator, joinButtonText: '加入队伍', canJoin: true }
  },

  joinTakeover() {
    if (!this.data.takeover || !this.data.canJoin || this.data.isJoining || this.data.isLeaving) {
      return
    }

    if (!this.ensureProfileReady()) {
      return
    }

    if (this.data.hasJoined) {
      this.leaveTakeover()
      return
    }

    const profile = getStoredProfile()
    if (profile && !canJoinWithCredit(profile.creditScore)) {
      wx.showToast({ title: '信誉分低于 70，暂无法参与接龙', icon: 'none' })
      return
    }

    this.setData({
      showRemarkSheet: true,
      remarkMode: 'join',
      memberRemark: '',
      memberRemarkError: '',
    })
  },

  submitJoinRemark(remark: string) {
    if (!this.data.takeover || this.data.isJoining) {
      return
    }

    this.setData({ isJoining: true, isSavingRemark: true })
    apiRequest<Record<string, any> | { hasJoined?: boolean; joinedCount?: number }>({
      url: `/api/takeovers/${this.data.takeover.id}/join`,
      method: 'POST',
      data: { remark },
    })
      .then(result => {
        if (this.data.takeover && result && typeof (result as Record<string, any>).joinedCount === 'number') {
          const updatedTakeover = {
            ...this.data.takeover,
            joined: Number((result as Record<string, any>).joinedCount),
            hasJoined: true,
          }
          this.setData({
            takeover: updatedTakeover,
            ...this.getJoinState(updatedTakeover),
          })
        }
        this.setData({ showRemarkSheet: false, memberRemark: '', memberRemarkError: '' })
        wx.showToast({ title: '已加入', icon: 'success' })
        refreshPreviousHome(this)
        this.loadTakeover()
      })
      .catch(error => {
        if (error.code === 'PROFILE_INCOMPLETE') {
          this.openProfileSheet()
          wx.showToast({ title: '请先补充资料', icon: 'none' })
          return
        }
        wx.showToast({ title: error.message || '加入失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ isJoining: false, isSavingRemark: false })
      })
  },

  openMemberRemarkSheet(event: WechatMiniprogram.TouchEvent) {
    if (this.data.takeover && this.data.takeover.takeoverState === 2) {
      wx.showToast({ title: '已结束的接龙不可编辑备注', icon: 'none' })
      return
    }
    const remark = event.currentTarget.dataset.remark as string
    this.setData({
      showRemarkSheet: true,
      remarkMode: 'edit',
      memberRemark: normalizeRemark(remark),
      memberRemarkError: '',
    })
  },

  closeMemberRemarkSheet() {
    if (this.data.isSavingRemark || this.data.isJoining) return
    this.setData({ showRemarkSheet: false, memberRemark: '', memberRemarkError: '' })
  },

  joinWithoutRemark() {
    if (this.data.isSavingRemark || this.data.isJoining) return
    this.submitJoinRemark('')
  },

  handleMemberRemarkInput(event: WechatMiniprogram.Input) {
    this.setData({
      memberRemark: normalizeRemark(event.detail.value),
      memberRemarkError: '',
    })
  },

  submitMemberRemark() {
    const remark = normalizeRemark(this.data.memberRemark)
    if (this.data.remarkMode === 'join') {
      this.submitJoinRemark(remark)
      return
    }

    const takeover = this.data.takeover
    if (!takeover || this.data.isSavingRemark) {
      return
    }

    this.setData({ isSavingRemark: true })
    apiRequest<{ remark?: string }>({
      url: `/api/takeovers/${takeover.id}/member-remark`,
      method: 'PUT',
      data: { remark },
    })
      .then(result => {
        const nextRemark = normalizeRemark(result && typeof result.remark === 'string' ? result.remark : remark)
        const updatedTakeover = {
          ...takeover,
          participants: takeover.participants.map(participant =>
            participant.isSelf ? { ...participant, remark: nextRemark } : participant
          ),
        }
        this.setData({
          takeover: updatedTakeover,
          showRemarkSheet: false,
          memberRemark: '',
          memberRemarkError: '',
        })
        wx.showToast({ title: '已保存', icon: 'success' })
      })
      .catch(error => {
        wx.showToast({ title: error.message || '保存失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ isSavingRemark: false })
      })
  },

  leaveTakeover() {
    const takeover = this.data.takeover

    if (!takeover || this.data.isLeaving) {
      return
    }

    wx.showModal({
      title: '退出队伍',
      content: '确定要退出这个接龙吗？',
      confirmText: '退出',
      confirmColor: '#fb7185',
      success: ({ confirm }) => {
        if (!confirm) return

        this.setData({ isLeaving: true })
        apiRequest<Record<string, any> | { hasJoined?: boolean; joinedCount?: number }>({
          url: `/api/takeovers/${takeover.id}/leave`,
          method: 'POST',
        })
          .then(result => {
            if (this.data.takeover && result && typeof (result as Record<string, any>).joinedCount === 'number') {
              const updatedTakeover = {
                ...this.data.takeover,
                joined: Number((result as Record<string, any>).joinedCount),
                hasJoined: false,
              }
              this.setData({
                takeover: updatedTakeover,
                ...this.getJoinState(updatedTakeover),
              })
            }
            wx.showToast({ title: '已退出', icon: 'success' })
            refreshPreviousHome(this)
            this.loadTakeover()
          })
          .catch(error => {
            wx.showToast({ title: error.message || '退出失败', icon: 'none' })
          })
          .finally(() => {
            this.setData({ isLeaving: false })
          })
      },
    })
  },

  copySteamId(event: WechatMiniprogram.TouchEvent) {
    const steamId = event.currentTarget.dataset.steamid as string
    if (!steamId) return

    wx.setClipboardData({
      data: steamId,
      success: () => {
        wx.showToast({ title: '已复制 SteamID', icon: 'success' })
      },
    })
  },

  copyKookInvite() {
    const inviteURL = this.data.takeover && this.data.takeover.kookInviteUrl
    if (!inviteURL) return

    wx.setClipboardData({
      data: inviteURL,
      success: () => {
        wx.showToast({ title: '已复制频道链接，用浏览器打开即可加入 KOOK 频道。', icon: 'none' })
      },
    })
  },

  openReportSheet(event: WechatMiniprogram.TouchEvent) {
    if (!this.ensureProfileReady()) {
      return
    }

    const userId = event.currentTarget.dataset.userid as string
    const openid = event.currentTarget.dataset.openid as string
    const nickname = event.currentTarget.dataset.nickname as string
    const index = Number(event.currentTarget.dataset.index)
    const reportUserKey = userId || openid
    const takeover = this.data.takeover
    const targetUser = takeover && index >= 0 ? takeover.participants[index] : null

    if (!takeover || takeover.takeoverState !== 2) {
      wx.showToast({ title: '接龙结束后才可以举报', icon: 'none' })
      return
    }
    if (!reportUserKey) {
      return
    }
    if (!userId) {
      wx.showToast({ title: '用户信息异常，无法举报', icon: 'none' })
      return
    }
    if (targetUser && targetUser.isSelf) {
      wx.showToast({ title: '不能举报自己', icon: 'none' })
      return
    }
    if (!targetUser) {
      return
    }
    if (this.data.reportedUserKeys.indexOf(reportUserKey) >= 0) {
      wx.showToast({ title: '已举报过该用户', icon: 'none' })
      return
    }

    this.setData({
      showReportSheet: true,
      reportUserId: userId,
      reportUserKey,
      reportNickname: nickname || '玩家',
      reportContent: '',
      reportImageUrl: '',
      reportImageUrls: [],
    })
  },

  closeReportSheet() {
    if (this.data.isSubmittingReport || this.data.isUploadingReportImage) {
      return
    }
    this.setData({ showReportSheet: false })
  },

  handleReportContentInput(event: WechatMiniprogram.Input) {
    this.setData({ reportContent: event.detail.value })
  },

  chooseReportImage(event: WechatMiniprogram.CustomEvent<{ count?: number }>) {
    if (this.data.isUploadingReportImage) {
      return
    }

    wx.chooseMedia({
      count: event.detail.count || 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: result => {
        const filePaths = result.tempFiles.map(file => file.tempFilePath).filter(Boolean)
        if (!filePaths.length) {
          return
        }

        this.setData({ isUploadingReportImage: true })
        Promise.all(filePaths.map(filePath => uploadImage(filePath)))
          .then(urls => {
            const reportImageUrls = this.data.reportImageUrls.concat(urls)
            this.setData({
              reportImageUrl: reportImageUrls[0] || '',
              reportImageUrls,
            })
            wx.showToast({ title: '截图已上传', icon: 'success' })
          })
          .catch(error => {
            wx.showToast({ title: error.message || '上传失败', icon: 'none' })
          })
          .finally(() => {
            this.setData({ isUploadingReportImage: false })
          })
      },
    })
  },

  removeReportImage(event: WechatMiniprogram.CustomEvent<{ index: number }>) {
    const index = Number(event.detail.index)
    if (index < 0 || index >= this.data.reportImageUrls.length) return
    const reportImageUrls = this.data.reportImageUrls.filter((_, itemIndex) => itemIndex !== index)
    this.setData({
      reportImageUrl: reportImageUrls[0] || '',
      reportImageUrls,
    })
  },

  previewReportImage(event: WechatMiniprogram.CustomEvent<{ index: number }>) {
    const index = Number(event.detail.index)
    const urls = this.data.reportImageUrls
    if (index < 0 || index >= urls.length) return
    wx.previewImage({
      current: urls[index],
      urls,
    })
  },

  submitReport() {
    if (!this.ensureProfileReady()) {
      return
    }

    const takeover = this.data.takeover
    const content = this.data.reportContent.trim()
    const reportUserKey = this.data.reportUserKey
    const targetUser = takeover ? takeover.participants.find(participant => getUserKey(participant) === reportUserKey || participant.userId === this.data.reportUserId) : null

    if (!takeover || !this.data.reportUserId || !reportUserKey || this.data.isSubmittingReport) {
      return
    }
    if (targetUser && targetUser.isSelf) {
      wx.showToast({ title: '不能举报自己', icon: 'none' })
      return
    }
    if (this.data.reportedUserKeys.indexOf(reportUserKey) >= 0) {
      wx.showToast({ title: '已举报过该用户', icon: 'none' })
      return
    }
    if (!content) {
      wx.showToast({ title: '请填写举报内容', icon: 'none' })
      return
    }

    this.setData({ isSubmittingReport: true })
    apiRequest<null>({
      url: `/api/takeovers/${takeover.id}/reports`,
      method: 'POST',
      data: {
        reportedUserId: Number(this.data.reportUserId),
        content,
        imageUrls: this.data.reportImageUrls,
      },
    })
      .then(() => {
        wx.showToast({ title: '已提交举报', icon: 'success' })
        const reportedUserKeys = this.data.reportedUserKeys.concat(reportUserKey)
        this.setData({
          showReportSheet: false,
          reportedUserKeys,
          takeover: takeover ? this.withReportState(takeover, reportedUserKeys) : takeover,
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

    wx.redirectTo({ url: '/pages/index/index' })
  },
})
