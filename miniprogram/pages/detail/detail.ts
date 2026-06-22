export {}

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
  avatarUrl: string
  gender: Gender
  isAdmin?: boolean
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
  coverImage: string
}

type ApiResponse<T> = {
  success?: boolean
  code?: string
  message?: string
  data?: T
}

type ApiRequestOptions = {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: WechatMiniprogram.IAnyObject
  tokenType?: 'user' | 'none'
}

const TOKEN_KEY = 'steam_takeover_token'
const PROFILE_KEY = 'steam_takeover_user'
const API_BASE_URL = 'https://rabbits.ink/miniprogram-api'
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
  已满员: '/assets/takeover-card-pending.png',
  已结束: '/assets/takeover-card-full.png',
}

const getUserToken = () => wx.getStorageSync(TOKEN_KEY) as string

const isApiResponse = <T>(value: unknown): value is ApiResponse<T> =>
  !!value && typeof value === 'object' && 'success' in value

const apiRequest = <T>(options: ApiRequestOptions) => {
  return new Promise<T>((resolve, reject) => {
    const token = options.tokenType === 'none' ? '' : getUserToken()
    const header: WechatMiniprogram.IAnyObject = {
      'content-type': 'application/json',
    }

    if (token) {
      header.Authorization = `Bearer ${token}`
    }

    wx.request<WechatMiniprogram.IAnyObject>({
      url: `${API_BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      header,
      success: response => {
        const responseData = response.data as T | ApiResponse<T>
        const body = responseData as ApiResponse<T>

        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error((body && (body.code || body.message)) || `请求失败：${response.statusCode}`))
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
      fail: error => {
        reject(new Error(error.errMsg || '网络请求失败'))
      },
    })
  })
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

  return {
    userId: rawParticipant.userId ? String(rawParticipant.userId) : rawParticipant.id ? String(rawParticipant.id) : undefined,
    openid: rawParticipant.openid ? String(rawParticipant.openid) : undefined,
    nickName: rawParticipant.nickName || rawParticipant.nickname || '玩家',
    steamId: rawParticipant.steamId || rawParticipant.steam_id || '',
    gender,
    avatarUrl: rawParticipant.avatarUrl || rawParticipant.avatar_url || getGenderAvatar(gender),
  }
}

const normalizeUserProfile = (rawProfile: Record<string, any> | null | undefined): UserProfile | null => {
  if (!rawProfile) {
    return null
  }

  const gender = normalizeGender(rawProfile.gender)
  const nickName = rawProfile.nickName || rawProfile.nickname || ''
  const steamId = rawProfile.steamId || rawProfile.steam_id || ''

  if (!nickName || !steamId || !gender) {
    return null
  }

  return {
    userId: rawProfile.userId ? String(rawProfile.userId) : rawProfile.id ? String(rawProfile.id) : undefined,
    openid: rawProfile.openid ? String(rawProfile.openid) : undefined,
    nickName,
    steamId,
    gender,
    avatarUrl: rawProfile.avatarUrl || rawProfile.avatar_url || getGenderAvatar(gender),
    isAdmin: !!(rawProfile.isAdmin || rawProfile.is_admin),
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
  description: string
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
    statusTone: statusLabel === '已满员' ? 'purple' : statusLabel === '已结束' ? 'ended' : 'orange',
    coverImage: rawTakeover.coverImage || rawTakeover.cover_image || STATUS_COVERS[statusLabel] || CARD_COVERS[numericId % CARD_COVERS.length],
  }
}

const getStoredProfile = (): UserProfile | null => {
  const userProfile = wx.getStorageSync(PROFILE_KEY)

  if (
    userProfile &&
    typeof userProfile.nickName === 'string' &&
    typeof userProfile.steamId === 'string' &&
    (userProfile.gender === 'male' || userProfile.gender === 'female') &&
    userProfile.nickName &&
    userProfile.steamId
  ) {
    return {
      nickName: userProfile.nickName,
      steamId: userProfile.steamId,
      gender: userProfile.gender,
      avatarUrl: userProfile.avatarUrl || getGenderAvatar(userProfile.gender),
      isAdmin: !!userProfile.isAdmin,
    }
  }

  return null
}

Page({
  data: {
    takeoverId: '',
    takeover: null as Takeover | null,
    isLoading: false,
    isJoining: false,
    isLeaving: false,
    joinButtonText: '加入队伍',
    hasJoined: false,
    isCreator: false,
    canJoin: false,
    canManage: false,
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
    todayDate: formatDateForInput(new Date()),
  },

  onLoad(options: Record<string, string | undefined>) {
    const takeoverId = decodeURIComponent(options.id || '')
    const storedProfile = getStoredProfile()

    this.setData({ takeoverId })
    this.setData({ canManage: !!(storedProfile && storedProfile.isAdmin) })
    if (!takeoverId) {
      wx.showToast({ title: '队伍不存在', icon: 'none' })
      return
    }

    this.loadCurrentProfile()
    this.loadTakeover()
  },

  loadCurrentProfile() {
    apiRequest<Record<string, any>>({
      url: '/api/me/profile',
    })
      .then(result => {
        const profile = normalizeUserProfile(result)

        if (profile) {
          wx.setStorageSync(PROFILE_KEY, profile)
        }

        if (profile && profile.isAdmin) {
          this.setData({ canManage: true })
        }
      })
      .catch(() => {})
  },

  openEditSheet() {
    const takeover = this.data.takeover

    if (!this.data.canManage || !takeover) {
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

  handleEditDateChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ editDate: event.detail.value as string })
  },

  handleEditStartDateChange(event: WechatMiniprogram.PickerChange) {
    const startDate = event.detail.value as string
    const endDate = this.data.editEndDate
    this.setData({
      editStartDate: startDate,
      editEndDate: endDate && endDate < startDate ? startDate : endDate,
    })
  },

  handleEditEndDateChange(event: WechatMiniprogram.PickerChange) {
    const endDate = event.detail.value as string
    const startDate = this.data.editStartDate
    this.setData({
      editStartDate: startDate && startDate > endDate ? endDate : startDate,
      editEndDate: endDate,
    })
  },

  handleEditTimeChange(event: WechatMiniprogram.PickerChange) {
    this.setData({ editTime: event.detail.value as string })
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

    const title = this.data.editTitle.trim()
    const description = this.data.editDescription.trim()
    const limit = Number(this.data.editLimit)
    const schedule = this.buildEditSchedule()

    if (!title || !description || !Number.isInteger(limit) || limit <= 0 || limit > 99 || !schedule) {
      wx.showToast({ title: '请完整填写接龙信息', icon: 'none' })
      return
    }

    this.setData({ isSavingAdmin: true })
    apiRequest<Record<string, any> | null>({
      url: `/api/takeovers/${takeover.id}`,
      method: 'PUT',
      data: buildTakeoverPayload(title, limit, this.data.editScheduleType, schedule, description),
    })
      .then(result => {
        const editedTakeover = result
          ? normalizeTakeover(result as Record<string, any>)
          : normalizeTakeover({ ...takeover, title, participantLimit: limit, scheduleType: this.data.editScheduleType, playTime: schedule.time, startDate: schedule.type === 'daily' ? '' : schedule.type === 'range' ? schedule.startDate : schedule.date, endDate: schedule.type === 'range' ? schedule.endDate : undefined, description })
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
        const takeover = normalizeTakeover(result)
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

  getJoinState(takeover: Takeover) {
    const hasJoined = takeover.hasJoined
    const isFull = takeover.limit > 0 && takeover.joined >= takeover.limit

    if (takeover.isCreator) {
      return { hasJoined: true, isCreator: true, joinButtonText: '', canJoin: false }
    }

    if (hasJoined) {
      return { hasJoined: true, isCreator: false, joinButtonText: '退出队伍', canJoin: true }
    }

    if (isFull) {
      return { hasJoined: false, isCreator: false, joinButtonText: '队伍已满员', canJoin: false }
    }

    return { hasJoined: false, isCreator: false, joinButtonText: '加入队伍', canJoin: true }
  },

  joinTakeover() {
    if (!this.data.takeover || !this.data.canJoin || this.data.isJoining || this.data.isLeaving) {
      return
    }

    if (this.data.hasJoined) {
      this.leaveTakeover()
      return
    }

    if (!getStoredProfile()) {
      wx.showModal({
        title: '请先补充资料',
        content: '回到首页点击右下角头像，填写昵称和 SteamID 后再加入队伍。',
        confirmText: '知道了',
        showCancel: false,
      })
      return
    }

    this.setData({ isJoining: true })
    apiRequest<Record<string, any> | { hasJoined?: boolean; joinedCount?: number }>({
      url: `/api/takeovers/${this.data.takeover.id}/join`,
      method: 'POST',
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
        wx.showToast({ title: '已加入', icon: 'success' })
        this.loadTakeover()
      })
      .catch(error => {
        wx.showToast({ title: error.message || '加入失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ isJoining: false })
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

    if (!steamId) {
      return
    }

    wx.setClipboardData({
      data: steamId,
      success: () => {
        wx.showToast({ title: '已复制 SteamID', icon: 'success' })
      },
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
