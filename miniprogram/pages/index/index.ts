type PendingAction = 'view' | 'join' | 'create'
type Gender = 'male' | 'female'
type ScheduleType = 'once' | 'daily' | 'range'
type TimeFilter = 'all' | 'today' | 'tomorrow' | 'daily' | 'week' | 'range'
type RangeFilter = {
  startDate: string
  endDate: string
}
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
  nickName: string
  steamId: string
  avatarUrl: string
  gender: Gender
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
}

const PAGE_SIZE = 5

const PROFILE_KEY = 'steam_takeover_user'
const LOGIN_CODE_KEY = 'steam_takeover_login_code'
const ADMIN_AUTH_KEY = 'steam_takeover_admin_authed'
const BLACKLIST_KEY = 'steam_takeover_blacklist'
const ADMIN_PASSWORD = 'tuwo2026'
const MALE_AVATAR_URL = '/assets/avatar-male.jpg'
const FEMALE_AVATAR_URL = '/assets/avatar-female.jpg'

const getGenderAvatar = (gender: Gender | '') => {
  if (gender === 'female') {
    return FEMALE_AVATAR_URL
  }

  if (gender === 'male') {
    return MALE_AVATAR_URL
  }

  return ''
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

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null
  }

  const currentYear = new Date().getFullYear()
  const parsedDate = new Date(currentYear, month - 1, day)

  if (parsedDate.getMonth() !== month - 1 || parsedDate.getDate() !== day) {
    return null
  }

  return parsedDate
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

const normalizeDateForPicker = (dateText: string) => {
  const parsedDate = parseDateText(dateText)
  return parsedDate ? formatDateForInput(parsedDate) : ''
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

const createMockTakeover = (takeover: Omit<Takeover, 'scheduleText' | 'participantAvatars'>): Takeover => {
  return {
    ...takeover,
    scheduleText: formatSchedule(takeover.schedule),
    participantAvatars: takeover.participants.map(participant => participant.avatarUrl).slice(0, 4),
  }
}

const mockParticipantPool: Participant[] = [
  { nickName: '阿澈', steamId: 'steam_ache', gender: 'male', avatarUrl: MALE_AVATAR_URL },
  { nickName: 'Mika', steamId: 'mika-2048', gender: 'female', avatarUrl: FEMALE_AVATAR_URL },
  { nickName: '兔兔窝', steamId: 'rabbit_den', gender: 'female', avatarUrl: FEMALE_AVATAR_URL },
  { nickName: '山竹', steamId: 'shanzhu_77', gender: 'male', avatarUrl: MALE_AVATAR_URL },
  { nickName: 'Nora', steamId: 'nora.play', gender: 'female', avatarUrl: FEMALE_AVATAR_URL },
  { nickName: '小禾', steamId: 'xiaohe_steam', gender: 'female', avatarUrl: FEMALE_AVATAR_URL },
  { nickName: '北极星', steamId: 'polaris:game', gender: 'male', avatarUrl: MALE_AVATAR_URL },
  { nickName: 'K', steamId: 'k_speedrun', gender: 'male', avatarUrl: MALE_AVATAR_URL },
  { nickName: '薄荷', steamId: 'mint-puzzle', gender: 'female', avatarUrl: FEMALE_AVATAR_URL },
  { nickName: 'Leo', steamId: 'leo_manager', gender: 'male', avatarUrl: MALE_AVATAR_URL },
]

const getMockParticipants = (joined: number, offset = 0) => {
  return Array.from({ length: joined }, (_, index) => {
    const participant = mockParticipantPool[(offset + index) % mockParticipantPool.length]
    return { ...participant }
  })
}

const timeFilters: { label: string; value: TimeFilter }[] = [
  { label: '今天', value: 'today' },
  { label: '明天', value: 'tomorrow' },
  { label: '本周', value: 'week' },
  { label: '每天固定', value: 'daily' },
  { label: '日期范围', value: 'range' },
]

const getTimeFilterLabel = (timeFilter: TimeFilter) => {
  if (timeFilter === 'all') {
    return '今天'
  }

  const selectedFilter = timeFilters.find(filter => filter.value === timeFilter)
  return selectedFilter?.label || '今天'
}

const parseMonthDayValue = (dateText: string) => {
  const parsedDate = parseDateText(dateText)

  if (!parsedDate) {
    return null
  }

  return (parsedDate.getMonth() + 1) * 100 + parsedDate.getDate()
}

const isDateBeforeToday = (dateText: string) => {
  const parsedDate = parseDateText(dateText)

  if (!parsedDate) {
    return false
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  parsedDate.setHours(0, 0, 0, 0)

  return parsedDate.getTime() < today.getTime()
}

const rangeOverlaps = (schedule: Schedule, rangeFilter: RangeFilter) => {
  if (schedule.type !== 'range') {
    return false
  }

  const scheduleStart = parseMonthDayValue(schedule.startDate)
  const scheduleEnd = parseMonthDayValue(schedule.endDate)
  const filterStart = rangeFilter.startDate ? parseMonthDayValue(rangeFilter.startDate) : null
  const filterEnd = rangeFilter.endDate ? parseMonthDayValue(rangeFilter.endDate) : null

  if (!scheduleStart || !scheduleEnd) {
    return false
  }

  if (filterStart && filterEnd) {
    return scheduleStart <= filterEnd && scheduleEnd >= filterStart
  }

  if (filterStart) {
    return scheduleEnd >= filterStart
  }

  if (filterEnd) {
    return scheduleStart <= filterEnd
  }

  return true
}

const mockTakeovers: Takeover[] = [
  createMockTakeover({
    id: 'coop-night',
    title: '周末合作游戏局',
    host: '阿澈',
    joined: 3,
    limit: 6,
    schedule: {
      type: 'once',
      date: '今晚',
      time: '20:30',
    },
    description: '想找几位轻松聊天的队友，合作游戏优先，不卷进度。',
    avatarUrl: MALE_AVATAR_URL,
    participants: getMockParticipants(3, 0),
    hasJoined: false,
  }),
  createMockTakeover({
    id: 'story-relay',
    title: '剧情党接龙',
    host: 'Mika',
    joined: 2,
    limit: 4,
    schedule: {
      type: 'daily',
      time: '21:00',
    },
    description: '慢慢看文本，认真聊选择，适合喜欢剧情和角色讨论的朋友。',
    avatarUrl: FEMALE_AVATAR_URL,
    participants: getMockParticipants(2, 1),
    hasJoined: false,
  }),
  createMockTakeover({
    id: 'party-pick',
    title: '轻松派对轮换',
    host: '兔兔窝',
    joined: 5,
    limit: 8,
    schedule: {
      type: 'range',
      startDate: '06/21',
      endDate: '06/23',
      time: '22:00',
    },
    description: '小游戏轮换，主打热闹和好笑，输赢不重要。',
    avatarUrl: FEMALE_AVATAR_URL,
    participants: getMockParticipants(5, 2),
    hasJoined: false,
  }),
  createMockTakeover({
    id: 'survival-line',
    title: '生存建家小队',
    host: '山竹',
    joined: 2,
    limit: 5,
    schedule: {
      type: 'once',
      date: '周六',
      time: '14:00',
    },
    description: '慢节奏开荒，想一起盖漂亮基地，欢迎建筑党。',
    avatarUrl: MALE_AVATAR_URL,
    participants: getMockParticipants(2, 3),
    hasJoined: false,
  }),
  createMockTakeover({
    id: 'monster-hunt',
    title: '猎人补票车',
    host: 'Nora',
    joined: 3,
    limit: 4,
    schedule: {
      type: 'daily',
      time: '23:00',
    },
    description: '救援、刷素材、配装交流都可以，新老猎人都欢迎。',
    avatarUrl: FEMALE_AVATAR_URL,
    participants: getMockParticipants(3, 4),
    hasJoined: false,
  }),
  createMockTakeover({
    id: 'farm-night',
    title: '种田放松局',
    host: '小禾',
    joined: 1,
    limit: 4,
    schedule: {
      type: 'range',
      startDate: '06/24',
      endDate: '06/30',
      time: '19:30',
    },
    description: '钓鱼、种田、下矿，晚上慢慢玩，适合放松。',
    avatarUrl: FEMALE_AVATAR_URL,
    participants: getMockParticipants(1, 5),
    hasJoined: false,
  }),
  createMockTakeover({
    id: 'rogue-club',
    title: '肉鸽互助会',
    host: '北极星',
    joined: 4,
    limit: 6,
    schedule: {
      type: 'once',
      date: '周三',
      time: '20:00',
    },
    description: '分享构筑和手感，顺便互相种草最近玩到的肉鸽。',
    avatarUrl: MALE_AVATAR_URL,
    participants: getMockParticipants(4, 6),
    hasJoined: false,
  }),
  createMockTakeover({
    id: 'speedrun-cafe',
    title: '速通练习室',
    host: 'K',
    joined: 1,
    limit: 3,
    schedule: {
      type: 'daily',
      time: '21:30',
    },
    description: '练图、看录像、互相鼓励，不竞速也可以来围观。',
    avatarUrl: MALE_AVATAR_URL,
    participants: getMockParticipants(1, 7),
    hasJoined: false,
  }),
  createMockTakeover({
    id: 'puzzle-table',
    title: '解谜同好桌',
    host: '薄荷',
    joined: 1,
    limit: 2,
    schedule: {
      type: 'once',
      date: '明晚',
      time: '20:00',
    },
    description: '找搭子解谜，不剧透，慢慢推，语音沟通更佳。',
    avatarUrl: FEMALE_AVATAR_URL,
    participants: getMockParticipants(1, 8),
    hasJoined: false,
  }),
  createMockTakeover({
    id: 'football-manager',
    title: '经理人茶话会',
    host: 'Leo',
    joined: 6,
    limit: 10,
    schedule: {
      type: 'range',
      startDate: '07/01',
      endDate: '07/07',
      time: '16:00',
    },
    description: '聊战术、妖人和离谱董事会，适合边玩边吐槽。',
    avatarUrl: MALE_AVATAR_URL,
    participants: getMockParticipants(6, 9),
    hasJoined: false,
  }),
  createMockTakeover({
    id: 'horror-lobby',
    title: '恐怖游戏壮胆群',
    host: '橘子',
    joined: 4,
    limit: 6,
    schedule: {
      type: 'once',
      date: '今晚',
      time: '23:30',
    },
    description: '胆小也能来，大家一起尖叫，别一个人硬撑。',
    avatarUrl: FEMALE_AVATAR_URL,
    participants: getMockParticipants(4, 10),
    hasJoined: false,
  }),
  createMockTakeover({
    id: 'strategy-den',
    title: '策略慢慢下',
    host: '青木',
    joined: 3,
    limit: 5,
    schedule: {
      type: 'range',
      startDate: '周六',
      endDate: '周日',
      time: '13:00',
    },
    description: '不催回合，适合周末长局，最好能接受慢节奏。',
    avatarUrl: MALE_AVATAR_URL,
    participants: getMockParticipants(3, 11),
    hasJoined: false,
  }),
  createMockTakeover({
    id: 'indie-picks',
    title: '独立游戏互推',
    host: 'Luna',
    joined: 5,
    limit: 8,
    schedule: {
      type: 'daily',
      time: '21:00',
    },
    description: '互相推荐冷门好玩的小作品，也可以一起云试玩。',
    avatarUrl: FEMALE_AVATAR_URL,
    participants: getMockParticipants(5, 12),
    hasJoined: false,
  }),
  createMockTakeover({
    id: 'racing-night',
    title: '周五竞速夜',
    host: '弯道超车',
    joined: 6,
    limit: 8,
    schedule: {
      type: 'once',
      date: '周五',
      time: '20:00',
    },
    description: '休闲跑图，不卷成绩，主打风景和拍照。',
    avatarUrl: MALE_AVATAR_URL,
    participants: getMockParticipants(6, 13),
    hasJoined: false,
  }),
]

let allTakeovers = [...mockTakeovers]

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
      avatarUrl: getGenderAvatar(userProfile.gender),
    }
  }

  return null
}

const getStoredBlacklist = () => {
  const blacklist = wx.getStorageSync(BLACKLIST_KEY)

  if (!Array.isArray(blacklist)) {
    return []
  }

  return blacklist.filter(item => typeof item === 'string')
}

const isProfileBlacklisted = (profile: UserProfile | null) => {
  return !!profile && getStoredBlacklist().includes(profile.steamId)
}

const matchesTimeFilter = (takeover: Takeover, timeFilter: TimeFilter, rangeFilter: RangeFilter) => {
  const schedule = takeover.schedule

  if (timeFilter === 'all') {
    return true
  }

  if (timeFilter === 'daily') {
    return schedule.type === 'daily'
  }

  if (timeFilter === 'range') {
    return rangeOverlaps(schedule, rangeFilter)
  }

  if (timeFilter === 'today') {
    if (schedule.type !== 'once') {
      return false
    }

    const parsedDate = parseDateText(schedule.date)
    return parsedDate
      ? formatDateForInput(parsedDate) === formatDateForInput(new Date())
      : ['今天', '今晚'].includes(schedule.date)
  }

  if (timeFilter === 'tomorrow') {
    if (schedule.type !== 'once') {
      return false
    }

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const parsedDate = parseDateText(schedule.date)
    return parsedDate
      ? formatDateForInput(parsedDate) === formatDateForInput(tomorrow)
      : ['明天', '明晚'].includes(schedule.date)
  }

  return (
    (schedule.type === 'once' && ['周一', '周二', '周三', '周四', '周五', '周六', '周日', '周末'].includes(schedule.date)) ||
    schedule.type === 'range'
  )
}

const getFilteredTakeovers = (keyword: string, timeFilter: TimeFilter, rangeFilter: RangeFilter) => {
  const normalizedKeyword = keyword.trim().toLowerCase()

  return allTakeovers.filter(takeover => {
    const matchesKeyword =
      !normalizedKeyword ||
      takeover.title.toLowerCase().includes(normalizedKeyword) ||
      takeover.description.toLowerCase().includes(normalizedKeyword)

    return matchesKeyword && matchesTimeFilter(takeover, timeFilter, rangeFilter)
  })
}

Component({
  data: {
    takeoverList: allTakeovers.slice(0, PAGE_SIZE),
    searchKeyword: '',
    timeFilters,
    activeTimeFilter: 'all' as TimeFilter,
    activeTimeFilterLabel: '今天',
    showTimeFilterDropdown: false,
    rangeStartDate: '',
    rangeEndDate: '',
    todayDate: formatDateForInput(new Date()),
    pageIndex: 1,
    isRefreshing: false,
    isLoadingMore: false,
    isLoadMoreLocked: false,
    hasMore: allTakeovers.length > PAGE_SIZE,
    maleAvatarUrl: MALE_AVATAR_URL,
    femaleAvatarUrl: FEMALE_AVATAR_URL,
    isAuthorizing: false,
    isSaving: false,
    isAdmin: false,
    showProfileSheet: false,
    showCreateSheet: false,
    showDetailSheet: false,
    showAdminSheet: false,
    showCardMenuSheet: false,
    currentTakeover: null as Takeover | null,
    detailJoinStatusText: '未加入',
    showDetailJoinButton: false,
    managingTakeover: null as Takeover | null,
    pendingAction: '' as PendingAction | '',
    pendingTakeoverId: '',
    adminPassword: '',
    adminPasswordError: '',
    blacklistedSteamIds: [] as string[],
    nickName: '',
    steamId: '',
    gender: '' as Gender | '',
    avatarUrl: '',
    nickNameError: '',
    steamIdError: '',
    genderError: '',
    createTitle: '',
    createLimit: '4',
    createScheduleType: 'once' as ScheduleType,
    createDate: '',
    createStartDate: '',
    createEndDate: '',
    createTime: '',
    createDescription: '',
    editingTakeoverId: '',
    createTitleError: '',
    createLimitError: '',
    createDateError: '',
    createTimeError: '',
    createDescriptionError: '',
  },

  lifetimes: {
    attached() {
      const userProfile = getStoredProfile()
      const blacklistedSteamIds = getStoredBlacklist()

      this.setData({
        isAdmin: wx.getStorageSync(ADMIN_AUTH_KEY) === true,
        blacklistedSteamIds,
      })

      if (userProfile) {
        getApp<IAppOption>().globalData.userProfile = userProfile
        this.setData({
          nickName: userProfile.nickName,
          steamId: userProfile.steamId,
          gender: userProfile.gender,
          avatarUrl: userProfile.avatarUrl,
        })
      }
    },
  },

  methods: {
    viewTakeover(event: WechatMiniprogram.TouchEvent) {
      this.ensureProfile('view', event.currentTarget.dataset.id as string)
    },

    handleTakeoverAction(event: WechatMiniprogram.TouchEvent) {
      const takeoverId = event.currentTarget.dataset.id as string
      const takeover = allTakeovers.find(item => item.id === takeoverId)

      this.ensureProfile(takeover?.hasJoined ? 'view' : 'join', takeoverId)
    },

    createTakeover() {
      this.ensureProfile('create', '')
    },

    openAdminSheet() {
      if (this.data.isAdmin) {
        this.setData({ isAdmin: false })
        wx.removeStorageSync(ADMIN_AUTH_KEY)
        wx.showToast({ title: '已退出管理', icon: 'success' })
        return
      }

      this.setData({
        showAdminSheet: true,
        adminPassword: '',
        adminPasswordError: '',
      })
    },

    closeAdminSheet() {
      this.setData({
        showAdminSheet: false,
        adminPassword: '',
        adminPasswordError: '',
      })
    },

    handleAdminPasswordInput(event: WechatMiniprogram.Input) {
      this.setData({
        adminPassword: event.detail.value.trim(),
        adminPasswordError: '',
      })
    },

    verifyAdminPassword() {
      if (this.data.adminPassword !== ADMIN_PASSWORD) {
        this.setData({ adminPasswordError: '密码不正确' })
        return
      }

      wx.setStorageSync(ADMIN_AUTH_KEY, true)
      this.setData({
        isAdmin: true,
        showAdminSheet: false,
        adminPassword: '',
        adminPasswordError: '',
      })
      wx.showToast({ title: '已进入管理', icon: 'success' })
    },

    handleSearchInput(event: WechatMiniprogram.Input) {
      this.applyFilters(event.detail.value, this.data.activeTimeFilter)
    },

    clearSearch() {
      this.applyFilters('', this.data.activeTimeFilter)
    },

    selectTimeFilter(event: WechatMiniprogram.TouchEvent) {
      const timeFilter = event.currentTarget.dataset.value as TimeFilter

      if (!['all', 'today', 'tomorrow', 'daily', 'week', 'range'].includes(timeFilter)) {
        return
      }

      this.applyFilters(this.data.searchKeyword, timeFilter)
    },

    selectAllTimeFilter() {
      this.applyFilters(this.data.searchKeyword, 'all')
      this.setData({ showTimeFilterDropdown: false })
    },

    toggleTimeFilterDropdown() {
      this.setData({
        showTimeFilterDropdown: !this.data.showTimeFilterDropdown,
      })
    },

    handleRangeStartChange(event: WechatMiniprogram.PickerChange) {
      const startDate = event.detail.value as string
      const endDate = this.data.rangeEndDate
      const normalizedEndDate = endDate && endDate < startDate ? startDate : endDate
      const rangeFilter = {
        startDate,
        endDate: normalizedEndDate,
      }

      this.setData({
        rangeStartDate: startDate,
        rangeEndDate: normalizedEndDate,
      })

      this.applyFilters(this.data.searchKeyword, 'range', rangeFilter)
    },

    handleRangeEndChange(event: WechatMiniprogram.PickerChange) {
      const endDate = event.detail.value as string
      const startDate = this.data.rangeStartDate
      const normalizedStartDate = startDate && startDate > endDate ? endDate : startDate
      const rangeFilter = {
        startDate: normalizedStartDate,
        endDate,
      }

      this.setData({
        rangeStartDate: normalizedStartDate,
        rangeEndDate: endDate,
      })

      this.applyFilters(this.data.searchKeyword, 'range', rangeFilter)
    },

    clearRangeFilter() {
      const rangeFilter = {
        startDate: '',
        endDate: '',
      }

      this.setData({
        rangeStartDate: '',
        rangeEndDate: '',
      })

      this.applyFilters(this.data.searchKeyword, 'range', rangeFilter)
    },

    applyFilters(keyword: string, timeFilter: TimeFilter, nextRangeFilter?: RangeFilter) {
      const rangeFilter = nextRangeFilter || {
        startDate: this.data.rangeStartDate,
        endDate: this.data.rangeEndDate,
      }
      const filteredList = getFilteredTakeovers(keyword, timeFilter, rangeFilter)
      const takeoverList = filteredList.slice(0, PAGE_SIZE)
      const activeTimeFilterLabel = getTimeFilterLabel(timeFilter)

      this.setData({
        searchKeyword: keyword,
        activeTimeFilter: timeFilter,
        activeTimeFilterLabel,
        showTimeFilterDropdown: false,
        takeoverList,
        pageIndex: 1,
        hasMore: filteredList.length > takeoverList.length,
        isLoadingMore: false,
      })
    },

    refreshTakeovers() {
      if (this.data.isRefreshing) {
        return
      }

      this.setData({
        isRefreshing: true,
        isLoadMoreLocked: true,
      })

      setTimeout(() => {
        const filteredList = getFilteredTakeovers(
          this.data.searchKeyword,
          this.data.activeTimeFilter,
          {
            startDate: this.data.rangeStartDate,
            endDate: this.data.rangeEndDate,
          }
        )
        const refreshedList = filteredList.slice(0, PAGE_SIZE)

        this.setData({
          takeoverList: refreshedList,
          pageIndex: 1,
          hasMore: filteredList.length > refreshedList.length,
          isRefreshing: false,
        })

        wx.showToast({ title: '已刷新', icon: 'success' })

        setTimeout(() => {
          this.setData({ isLoadMoreLocked: false })
        }, 600)
      }, 500)
    },

    loadMoreTakeovers() {
      if (
        this.data.isRefreshing ||
        this.data.isLoadMoreLocked ||
        this.data.isLoadingMore ||
        !this.data.hasMore
      ) {
        return
      }

      this.setData({ isLoadingMore: true })

      setTimeout(() => {
        const filteredList = getFilteredTakeovers(
          this.data.searchKeyword,
          this.data.activeTimeFilter,
          {
            startDate: this.data.rangeStartDate,
            endDate: this.data.rangeEndDate,
          }
        )
        const nextPageIndex = this.data.pageIndex + 1
        const nextList = filteredList.slice(0, nextPageIndex * PAGE_SIZE)

        this.setData({
          takeoverList: nextList,
          pageIndex: nextPageIndex,
          hasMore: nextList.length < filteredList.length,
          isLoadingMore: false,
        })
      }, 500)
    },

    ensureProfile(action: PendingAction, takeoverId: string) {
      if (this.data.isAuthorizing) {
        return
      }

      this.setData({
        isAuthorizing: true,
        pendingAction: action,
        pendingTakeoverId: takeoverId,
      })

      wx.login({
        success: ({ code }) => {
          if (!code) {
            wx.showToast({ title: '进入失败，请重试', icon: 'none' })
            return
          }

          // TODO: Send code to your server and exchange it for openid/session_key.
          wx.setStorageSync(LOGIN_CODE_KEY, code)

          const userProfile = getStoredProfile()

          if (userProfile) {
            if (isProfileBlacklisted(userProfile)) {
              wx.showToast({ title: '当前用户已被限制', icon: 'none' })
              return
            }

            getApp<IAppOption>().globalData.userProfile = userProfile
            this.completePendingAction(action)
            return
          }

          this.setData({
            showProfileSheet: true,
            nickNameError: '',
            steamIdError: '',
            genderError: '',
          })
        },
        fail: () => {
          wx.showToast({ title: '进入失败，请稍后再试', icon: 'none' })
        },
        complete: () => {
          this.setData({ isAuthorizing: false })
        },
      })
    },

    selectGender(event: WechatMiniprogram.TouchEvent) {
      const gender = event.currentTarget.dataset.gender as Gender

      if (gender !== 'male' && gender !== 'female') {
        return
      }

      this.setData({
        gender,
        avatarUrl: getGenderAvatar(gender),
        genderError: '',
      })
    },

    handleNickNameInput(event: WechatMiniprogram.Input) {
      this.setData({
        nickName: event.detail.value.trim(),
        nickNameError: '',
      })
    },

    handleSteamIdInput(event: WechatMiniprogram.Input) {
      this.setData({
        steamId: event.detail.value.trim(),
        steamIdError: '',
      })
    },

    handleCreateTitleInput(event: WechatMiniprogram.Input) {
      this.setData({
        createTitle: event.detail.value.trim(),
        createTitleError: '',
      })
    },

    handleCreateLimitInput(event: WechatMiniprogram.Input) {
      this.setData({
        createLimit: event.detail.value.trim(),
        createLimitError: '',
      })
    },

    handleCreateDateChange(event: WechatMiniprogram.PickerChange) {
      this.setData({
        createDate: event.detail.value as string,
        createDateError: '',
      })
    },

    handleCreateStartDateChange(event: WechatMiniprogram.PickerChange) {
      const startDate = event.detail.value as string
      const endDate = this.data.createEndDate
      this.setData({
        createStartDate: startDate,
        createEndDate: endDate && endDate < startDate ? startDate : endDate,
        createDateError: '',
      })
    },

    handleCreateEndDateChange(event: WechatMiniprogram.PickerChange) {
      const endDate = event.detail.value as string
      const startDate = this.data.createStartDate
      this.setData({
        createStartDate: startDate && startDate > endDate ? endDate : startDate,
        createEndDate: endDate,
        createDateError: '',
      })
    },

    handleCreateTimeChange(event: WechatMiniprogram.PickerChange) {
      this.setData({
        createTime: event.detail.value as string,
        createTimeError: '',
      })
    },

    handleCreateDescriptionInput(event: WechatMiniprogram.Input) {
      this.setData({
        createDescription: event.detail.value.trim(),
        createDescriptionError: '',
      })
    },

    selectScheduleType(event: WechatMiniprogram.TouchEvent) {
      const scheduleType = event.currentTarget.dataset.type as ScheduleType

      if (scheduleType !== 'once' && scheduleType !== 'daily' && scheduleType !== 'range') {
        return
      }

      this.setData({
        createScheduleType: scheduleType,
        createDateError: '',
      })
    },

    saveProfile() {
      if (this.data.isSaving) {
        return
      }

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

      this.setData({ isSaving: true })

      const userProfile = {
        nickName,
        steamId,
        gender,
        avatarUrl: getGenderAvatar(gender),
      }

      if (isProfileBlacklisted(userProfile)) {
        this.setData({ isSaving: false })
        wx.showToast({ title: '该 SteamID 已被限制', icon: 'none' })
        return
      }

      wx.setStorageSync(PROFILE_KEY, userProfile)
      getApp<IAppOption>().globalData.userProfile = userProfile

      this.setData({
        isSaving: false,
        showProfileSheet: false,
      })

      this.completePendingAction(this.data.pendingAction)
    },

    closeProfileSheet() {
      this.setData({
        showProfileSheet: false,
        pendingAction: '',
        pendingTakeoverId: '',
        nickNameError: '',
        steamIdError: '',
        genderError: '',
      })
    },

    closeCreateSheet() {
      this.setData({
        showCreateSheet: false,
        editingTakeoverId: '',
      })
    },

    openCardMenu(event: WechatMiniprogram.TouchEvent) {
      if (!this.data.isAdmin) {
        return
      }

      const takeoverId = event.currentTarget.dataset.id as string
      const takeover = allTakeovers.find(item => item.id === takeoverId)

      if (!takeover) {
        wx.showToast({ title: '接龙不存在', icon: 'none' })
        return
      }

      this.setData({
        managingTakeover: takeover,
        showCardMenuSheet: true,
      })
    },

    closeCardMenu() {
      this.setData({
        showCardMenuSheet: false,
        managingTakeover: null,
      })
    },

    editManagingTakeover() {
      const takeover = this.data.managingTakeover

      if (!takeover) {
        return
      }

      this.closeCardMenu()
      this.fillEditTakeover(takeover)
    },

    deleteManagingTakeover() {
      const takeover = this.data.managingTakeover

      if (!takeover) {
        return
      }

      this.closeCardMenu()
      this.confirmDeleteTakeover(takeover.id)
    },

    editTakeover(event: WechatMiniprogram.TouchEvent) {
      if (!this.data.isAdmin) {
        return
      }

      const takeoverId = event.currentTarget.dataset.id as string
      const takeover = allTakeovers.find(item => item.id === takeoverId)

      if (!takeover) {
        wx.showToast({ title: '接龙不存在', icon: 'none' })
        return
      }

      this.fillEditTakeover(takeover)
    },

    fillEditTakeover(takeover: Takeover) {
      this.setData({
        showCreateSheet: true,
        editingTakeoverId: takeover.id,
        createTitle: takeover.title,
        createLimit: String(takeover.limit),
        createScheduleType: takeover.schedule.type,
        createDate: takeover.schedule.type === 'once' ? normalizeDateForPicker(takeover.schedule.date) : '',
        createStartDate:
          takeover.schedule.type === 'range' ? normalizeDateForPicker(takeover.schedule.startDate) : '',
        createEndDate:
          takeover.schedule.type === 'range' ? normalizeDateForPicker(takeover.schedule.endDate) : '',
        createTime: takeover.schedule.time,
        createDescription: takeover.description,
        createTitleError: '',
        createLimitError: '',
        createDateError: '',
        createTimeError: '',
        createDescriptionError: '',
      })
    },

    deleteTakeover(event: WechatMiniprogram.TouchEvent) {
      if (!this.data.isAdmin) {
        return
      }

      const takeoverId = event.currentTarget.dataset.id as string
      this.confirmDeleteTakeover(takeoverId)
    },

    confirmDeleteTakeover(takeoverId: string) {
      wx.showModal({
        title: '删除接龙',
        content: '删除后当前列表里不会再显示这个接龙。',
        confirmText: '删除',
        confirmColor: '#fb7185',
        success: ({ confirm }) => {
          if (!confirm) {
            return
          }

          allTakeovers = allTakeovers.filter(takeover => takeover.id !== takeoverId)
          if (this.data.currentTakeover?.id === takeoverId) {
            this.setData({
              showDetailSheet: false,
              currentTakeover: null,
            })
          }
          this.applyFilters(this.data.searchKeyword, this.data.activeTimeFilter)
          wx.showToast({ title: '已删除', icon: 'success' })
        },
      })
    },

    submitCreateTakeover() {
      const title = this.data.createTitle.trim()
      const limit = Number(this.data.createLimit)
      const description = this.data.createDescription.trim()
      const time = this.data.createTime.trim()
      const scheduleType = this.data.createScheduleType

      const createTitleError = title ? '' : '请输入标题'
      const createLimitError =
        Number.isInteger(limit) && limit > 0 && limit <= 99 ? '' : '请输入 1-99 的人数'
      const createTimeError = time ? '' : '请输入时间'
      const createDescriptionError = description ? '' : '请输入介绍'
      const createDateError = this.validateCreateDate()

      if (
        createTitleError ||
        createLimitError ||
        createTimeError ||
        createDescriptionError ||
        createDateError
      ) {
        this.setData({
          createTitleError,
          createLimitError,
          createTimeError,
          createDescriptionError,
          createDateError,
        })
        return
      }

      const userProfile = getStoredProfile()
      const editingTakeover = allTakeovers.find(takeover => takeover.id === this.data.editingTakeoverId)

      if (!userProfile && !editingTakeover) {
        wx.showToast({ title: '请先补充资料', icon: 'none' })
        return
      }

      const schedule = this.buildCreateSchedule(scheduleType, time)
      if (editingTakeover) {
        const editedTakeover = createMockTakeover({
          ...editingTakeover,
          title,
          limit,
          schedule,
          description,
        })

        allTakeovers = allTakeovers.map(takeover =>
          takeover.id === editingTakeover.id ? editedTakeover : takeover
        )

        const currentTakeover = this.data.currentTakeover?.id === editingTakeover.id
          ? editedTakeover
          : this.data.currentTakeover

        this.applyFilters(this.data.searchKeyword, this.data.activeTimeFilter)
        this.setData({
          showCreateSheet: false,
          editingTakeoverId: '',
          currentTakeover,
          ...(currentTakeover
            ? this.getDetailJoinState(currentTakeover)
            : { detailJoinStatusText: '未加入', showDetailJoinButton: false }),
          createTitle: '',
          createLimit: '4',
          createScheduleType: 'once',
          createDate: '',
          createStartDate: '',
          createEndDate: '',
          createTime: '',
          createDescription: '',
          createTitleError: '',
          createLimitError: '',
          createDateError: '',
          createTimeError: '',
          createDescriptionError: '',
        })
        wx.showToast({ title: '已保存', icon: 'success' })
        return
      }

      const createdTakeover = createMockTakeover({
        id: `local-${Date.now()}`,
        title,
        host: userProfile!.nickName,
        joined: 1,
        limit,
        schedule,
        description,
        avatarUrl: userProfile!.avatarUrl,
        participants: [userProfile!],
        hasJoined: true,
      })

      allTakeovers = [createdTakeover, ...allTakeovers]
      const takeoverList = allTakeovers.slice(0, PAGE_SIZE)

      this.setData({
        takeoverList,
        searchKeyword: '',
        activeTimeFilter: 'all',
        activeTimeFilterLabel: '今天',
        pageIndex: 1,
        hasMore: allTakeovers.length > takeoverList.length,
        showCreateSheet: false,
        editingTakeoverId: '',
        createTitle: '',
        createLimit: '4',
        createScheduleType: 'once',
        createDate: '',
        createStartDate: '',
        createEndDate: '',
        createTime: '',
        createDescription: '',
        createTitleError: '',
        createLimitError: '',
        createDateError: '',
        createTimeError: '',
        createDescriptionError: '',
      })

      wx.showToast({ title: '已创建', icon: 'success' })
    },

    validateCreateDate() {
      if (this.data.createScheduleType === 'daily') {
        return ''
      }

      if (this.data.createScheduleType === 'once') {
        if (!parseDateText(this.data.createDate.trim())) {
          return '请选择日期'
        }

        return isDateBeforeToday(this.data.createDate.trim()) ? '不能选择今天之前的日期' : ''
      }

      if (
        !parseDateText(this.data.createStartDate.trim()) ||
        !parseDateText(this.data.createEndDate.trim())
      ) {
        return '请选择日期范围'
      }

      if (
        isDateBeforeToday(this.data.createStartDate.trim()) ||
        isDateBeforeToday(this.data.createEndDate.trim())
      ) {
        return '不能选择今天之前的日期'
      }

      return ''
    },

    buildCreateSchedule(scheduleType: ScheduleType, time: string): Schedule {
      if (scheduleType === 'daily') {
        return {
          type: 'daily',
          time,
        }
      }

      if (scheduleType === 'range') {
        return {
          type: 'range',
          startDate: this.data.createStartDate.trim(),
          endDate: this.data.createEndDate.trim(),
          time,
        }
      }

      return {
        type: 'once',
        date: this.data.createDate.trim(),
        time,
      }
    },

    validateSteamId(steamId: string) {
      if (!steamId) {
        return '请输入 SteamID'
      }

      if (!/^[0-9A-Za-z_:.-]{3,32}$/.test(steamId)) {
        return 'SteamID 可填写 3-32 位数字、字母或 _ : . -'
      }

      return ''
    },

    completePendingAction(action: PendingAction | '') {
      if (!action) {
        return
      }

      if (action === 'create') {
        this.setData({ showCreateSheet: true })
        return
      }

      if (action === 'join') {
        this.markTakeoverJoined(this.data.pendingTakeoverId)
        return
      }

      this.openTakeoverDetail(this.data.pendingTakeoverId)
    },

    openTakeoverDetail(takeoverId: string) {
      const takeover = allTakeovers.find(item => item.id === takeoverId)

      if (!takeover) {
        wx.showToast({ title: '接龙不存在', icon: 'none' })
        return
      }

      this.setData({
        currentTakeover: takeover,
        ...this.getDetailJoinState(takeover),
        showDetailSheet: true,
      })
    },

    getDetailJoinState(takeover: Takeover) {
      const detailJoinStatusText = this.getDetailJoinStatusText(takeover)

      return {
        detailJoinStatusText,
        showDetailJoinButton: !this.data.isAdmin && detailJoinStatusText === '未加入',
      }
    },

    getDetailJoinStatusText(takeover: Takeover) {
      const userProfile = getStoredProfile()

      if (!userProfile) {
        return '未加入'
      }

      return takeover.participants.some(participant => participant.steamId === userProfile.steamId)
        ? '已加入'
        : '未加入'
    },

    closeDetailSheet() {
      this.setData({
        showDetailSheet: false,
        currentTakeover: null,
        detailJoinStatusText: '未加入',
        showDetailJoinButton: false,
      })
    },

    joinCurrentTakeover() {
      const takeover = this.data.currentTakeover

      if (!takeover || this.data.isAdmin) {
        return
      }

      this.ensureProfile('join', takeover.id)
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

    blockUser(event: WechatMiniprogram.TouchEvent) {
      if (!this.data.isAdmin) {
        return
      }

      const steamId = event.currentTarget.dataset.steamid as string

      if (!steamId) {
        return
      }

      wx.showModal({
        title: '拉黑用户',
        content: `拉黑 ${steamId} 后，该用户不能继续加入或创建接龙。`,
        confirmText: '拉黑',
        confirmColor: '#fb7185',
        success: ({ confirm }) => {
          if (!confirm) {
            return
          }

          const blacklistedSteamIds = Array.from(new Set([...getStoredBlacklist(), steamId]))
          wx.setStorageSync(BLACKLIST_KEY, blacklistedSteamIds)

          allTakeovers = allTakeovers.map(takeover => {
            const participants = takeover.participants.filter(participant => participant.steamId !== steamId)
            const joined = Math.min(participants.length, takeover.limit)

            return {
              ...takeover,
              joined,
              participants,
              participantAvatars: participants.map(participant => participant.avatarUrl).slice(0, 4),
            }
          })

          const currentTakeover = this.data.currentTakeover
            ? allTakeovers.find(takeover => takeover.id === this.data.currentTakeover?.id) || null
            : null

          this.setData({
            blacklistedSteamIds,
            currentTakeover,
            ...(currentTakeover
              ? this.getDetailJoinState(currentTakeover)
              : { detailJoinStatusText: '未加入', showDetailJoinButton: false }),
          })
          this.applyFilters(this.data.searchKeyword, this.data.activeTimeFilter)
          wx.showToast({ title: '已拉黑', icon: 'success' })
        },
      })
    },

    markTakeoverJoined(takeoverId: string) {
      const userProfile = getStoredProfile()
      const avatarUrl = userProfile?.avatarUrl || FEMALE_AVATAR_URL

      allTakeovers = allTakeovers.map(takeover => {
        if (takeover.id !== takeoverId || takeover.hasJoined) {
          return takeover
        }

        return {
          ...takeover,
          hasJoined: true,
          joined: Math.min(takeover.joined + 1, takeover.limit),
          participantAvatars: [avatarUrl, ...takeover.participantAvatars].slice(0, 4),
          participants:
            userProfile && !takeover.participants.some(participant => participant.steamId === userProfile.steamId)
              ? [userProfile, ...takeover.participants]
              : takeover.participants,
        }
      })

      const filteredList = getFilteredTakeovers(
        this.data.searchKeyword,
        this.data.activeTimeFilter,
        {
          startDate: this.data.rangeStartDate,
          endDate: this.data.rangeEndDate,
        }
      )
      const takeoverList = filteredList.slice(0, this.data.pageIndex * PAGE_SIZE)
      const currentTakeover = allTakeovers.find(takeover => takeover.id === takeoverId) || null

      this.setData({
        takeoverList,
        currentTakeover,
        ...(currentTakeover
          ? this.getDetailJoinState(currentTakeover)
          : { detailJoinStatusText: '未加入', showDetailJoinButton: false }),
        hasMore: filteredList.length > takeoverList.length,
      })

      wx.showToast({ title: '已加入', icon: 'success' })
    },
  },
})
