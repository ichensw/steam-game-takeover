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
  userId?: string
  openid?: string
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
const TOKEN_KEY = 'steam_takeover_token'
const ADMIN_TOKEN_KEY = 'steam_takeover_admin_token'
const API_BASE_URL = 'http://47.102.200.211:8081'
const MALE_AVATAR_URL = '/assets/avatar-male.jpg'
const FEMALE_AVATAR_URL = '/assets/avatar-female.jpg'

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
  tokenType?: 'user' | 'admin' | 'none'
}

type LoginResult = {
  token?: string
  user?: Record<string, any>
  profileCompleted?: boolean
  blocked?: boolean
  isBlocked?: boolean
}

type UploadResult = {
  url?: string
  objectKey?: string
}

type ProfilePayload = {
  nickName: string
  steamId: string
  gender: Gender
  avatarUrl: string
}

const getUserToken = () => wx.getStorageSync(TOKEN_KEY) as string
const getAdminToken = () => wx.getStorageSync(ADMIN_TOKEN_KEY) as string

const parseUploadResponse = (value: string) => {
  try {
    return JSON.parse(value) as ApiResponse<UploadResult> | UploadResult
  } catch {
    return null
  }
}

const apiRequest = <T>(options: ApiRequestOptions) => {
  return new Promise<T>((resolve, reject) => {
    const token =
      options.tokenType === 'admin'
        ? getAdminToken()
        : options.tokenType === 'none'
          ? ''
          : getUserToken()
    const header: WechatMiniprogram.IAnyObject = {
      'content-type': 'application/json',
    }

    if (token) {
      header.Authorization = `Bearer ${token}`
    }

    wx.request<ApiResponse<T> | T>({
      url: `${API_BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      header,
      success: response => {
        const body = response.data as ApiResponse<T>

        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error((body && (body.code || body.message)) || `请求失败：${response.statusCode}`))
          return
        }

        if (body && typeof body === 'object' && 'success' in body) {
          if (body.success === false) {
            reject(new Error(body.message || body.code || '请求失败'))
            return
          }

          resolve((body.data || null) as T)
          return
        }

        resolve(response.data as T)
      },
      fail: error => {
        console.error('api request failed:', `${API_BASE_URL}${options.url}`, error)
        reject(new Error(error.errMsg || '网络请求失败'))
      },
    })
  })
}

const uploadImage = (filePath: string) => {
  return new Promise<string>((resolve, reject) => {
    const token = getUserToken()
    if (!token) {
      reject(new Error('请先登录'))
      return
    }

    wx.uploadFile({
      url: `${API_BASE_URL}/api/uploads/image`,
      filePath,
      name: 'file',
      header: {
        Authorization: `Bearer ${token}`,
      },
      success: response => {
        const body = parseUploadResponse(response.data)
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error((body && (body.message || body.code)) || `上传失败：${response.statusCode}`))
          return
        }

        const data = body && 'success' in body ? body.data : body
        if (!data || !data.url) {
          reject(new Error('上传结果异常'))
          return
        }

        resolve(data.url)
      },
      fail: error => {
        console.error('image upload failed:', `${API_BASE_URL}/api/uploads/image`, error)
        reject(new Error(error.errMsg || '图片上传失败'))
      },
    })
  })
}

const buildQuery = (params: Record<string, string | number | undefined>) => {
  const query = Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== '')
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
    .join('&')

  return query ? `?${query}` : ''
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

const toApiGender = (gender: Gender) => {
  return gender === 'male' ? 1 : 2
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

const normalizeUserProfile = (rawUser: Record<string, any> | null | undefined): UserProfile | null => {
  if (!rawUser) {
    return null
  }

  const gender = normalizeGender(rawUser.gender)
  const nickName = rawUser.nickName || rawUser.nickname || rawUser.nick_name || ''
  const steamId = rawUser.steamId || rawUser.steam_id || ''

  if (!nickName || !steamId || !gender) {
    return null
  }

  return {
    userId: rawUser.userId ? String(rawUser.userId) : rawUser.id ? String(rawUser.id) : undefined,
    openid: rawUser.openid ? String(rawUser.openid) : undefined,
    nickName,
    steamId,
    gender,
    avatarUrl: rawUser.avatarUrl || rawUser.avatar_url || getGenderAvatar(gender),
  }
}

const normalizeParticipant = (rawParticipant: Record<string, any>): Participant => {
  const normalized = normalizeUserProfile(rawParticipant)

  if (normalized) {
    return normalized
  }

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

const normalizeTakeover = (rawTakeover: Record<string, any>): Takeover => {
  const scheduleType = normalizeScheduleType(rawTakeover.scheduleType || rawTakeover.schedule_type)
  const playTime = stripTimeSeconds(rawTakeover.playTime || rawTakeover.play_time || rawTakeover.time)
  const membersSource = rawTakeover.members || rawTakeover.participants || rawTakeover.previewMembers || []
  const participants = Array.isArray(membersSource)
    ? membersSource.map((member: Record<string, any>) => normalizeParticipant(member))
    : []
  const joined = Number(rawTakeover.joinedCount || rawTakeover.joined_count || rawTakeover.joined || participants.length || 0)
  const limit = Number(rawTakeover.participantLimit || rawTakeover.participant_limit || rawTakeover.limit || 0)
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
  }
}

const normalizeTakeoverList = (rawData: unknown) => {
  const data = rawData as Record<string, any>
  const rawList = Array.isArray(rawData)
    ? rawData
    : data && Array.isArray(data.list)
      ? data.list
      : data && Array.isArray(data.records)
        ? data.records
        : []
  const list = rawList.map((item: Record<string, any>) => normalizeTakeover(item))
  const total = Number((data && (data.total || data.totalCount || data.total_count)) || list.length)

  return {
    list,
    total,
  }
}

const buildTakeoverPayload = (
  title: string,
  limit: number,
  scheduleType: ScheduleType,
  schedule: Schedule,
  description: string
) => {
  return {
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
  }
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

const formatTimeForInput = (date: Date) => {
  return `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
}

const minFutureTimeForInput = () => {
  const nextMinute = new Date(Date.now() + 60 * 1000)
  return formatTimeForInput(nextMinute)
}

const isTodayText = (dateText: string) => {
  const parsedDate = parseDateText(dateText)
  return !!parsedDate && formatDateForInput(parsedDate) === formatDateForInput(new Date())
}

const isTimeAfterNow = (timeText: string) => {
  const match = timeText.match(/^(\d{2}):(\d{2})$/)
  if (!match) {
    return false
  }

  const now = new Date()
  const candidate = new Date(now)
  candidate.setHours(Number(match[1]), Number(match[2]), 0, 0)
  return candidate.getTime() > now.getTime()
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
  return (selectedFilter && selectedFilter.label) || '今天'
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

const ENABLE_MOCK_DATA = false
let allTakeovers = ENABLE_MOCK_DATA ? [...mockTakeovers] : []

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
    }
  }

  return null
}

const getServerTimeFilter = (timeFilter: TimeFilter, rangeFilter: RangeFilter) => {
  const timeFilterMap: Record<TimeFilter, string> = {
    all: 'all',
    today: 'today',
    tomorrow: 'tomorrow',
    daily: 'daily',
    week: 'this_week',
    range: rangeFilter.startDate || rangeFilter.endDate ? 'custom_range' : 'date_range',
  }

  return timeFilterMap[timeFilter]
}

const isPendingRangeFilter = (timeFilter: TimeFilter, rangeFilter: RangeFilter) =>
  timeFilter === 'range' && (!rangeFilter.startDate || !rangeFilter.endDate)

Component({
  data: {
    takeoverList: [] as Takeover[],
    searchKeyword: '',
    timeFilters,
    activeTimeFilter: 'all' as TimeFilter,
    activeTimeFilterLabel: '今天',
    showTimeFilterDropdown: false,
    rangeStartDate: '',
    rangeEndDate: '',
    todayDate: formatDateForInput(new Date()),
    minCreateTime: '',
    pageIndex: 1,
    isRefreshing: false,
    isLoadingMore: false,
    isLoadMoreLocked: false,
    hasMore: false,
    maleAvatarUrl: MALE_AVATAR_URL,
    femaleAvatarUrl: FEMALE_AVATAR_URL,
    isAuthorizing: false,
    isSaving: false,
    isUploadingAvatar: false,
    isBlocked: false,
    blockedMessage: '',
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

      this.setData({
        isAdmin: !!getAdminToken(),
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

      this.bootstrap()
    },
  },

  methods: {
    bootstrap() {
      this.setData({ isAuthorizing: true })
      wx.login({
        success: ({ code }) => {
          if (!code) {
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
              if (result.token) {
                wx.setStorageSync(TOKEN_KEY, result.token)
              }

              const normalizedProfile = normalizeUserProfile(result.user)
              if (normalizedProfile) {
                wx.setStorageSync(PROFILE_KEY, normalizedProfile)
                getApp<IAppOption>().globalData.userProfile = normalizedProfile
                this.setData({
                  nickName: normalizedProfile.nickName,
                  steamId: normalizedProfile.steamId,
                  gender: normalizedProfile.gender,
                  avatarUrl: normalizedProfile.avatarUrl,
                })
              }

              if (result.blocked || result.isBlocked) {
                this.setData({
                  isBlocked: true,
                  blockedMessage: '您已被管理员拉黑',
                  takeoverList: [],
                  hasMore: false,
                })
                return
              }

              this.setData({
                isBlocked: false,
                blockedMessage: '',
              })
              this.loadTakeoversFromServer(1, true)
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
          wx.showToast({ title: '登录失败，请稍后再试', icon: 'none' })
        },
      })
    },

    viewTakeover(event: WechatMiniprogram.TouchEvent) {
      this.ensureProfile('view', event.currentTarget.dataset.id as string)
    },

    handleTakeoverAction(event: WechatMiniprogram.TouchEvent) {
      const takeoverId = event.currentTarget.dataset.id as string
      const takeover = allTakeovers.find(item => item.id === takeoverId)

      this.ensureProfile(takeover && takeover.hasJoined ? 'view' : 'join', takeoverId)
    },

    createTakeover() {
      this.ensureProfile('create', '')
    },

    openAdminSheet() {
      if (this.data.isAdmin) {
        this.setData({ isAdmin: false })
        wx.removeStorageSync(ADMIN_TOKEN_KEY)
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
      const password = this.data.adminPassword

      if (!password) {
        this.setData({ adminPasswordError: '请输入管理员密码' })
        return
      }

      this.setData({ isAuthorizing: true })
      apiRequest<{ adminToken?: string; token?: string }>({
        url: '/api/admin/login',
        method: 'POST',
        data: { password },
        tokenType: 'none',
      })
        .then(result => {
          const adminToken = result.adminToken || result.token

          if (!adminToken) {
            throw new Error('管理员登录失败')
          }

          wx.setStorageSync(ADMIN_TOKEN_KEY, adminToken)
          this.setData({
            isAdmin: true,
            showAdminSheet: false,
            adminPassword: '',
            adminPasswordError: '',
          })
          wx.showToast({ title: '已进入管理', icon: 'success' })
        })
        .catch(error => {
          this.setData({ adminPasswordError: error.message || '密码不正确' })
        })
        .finally(() => {
          this.setData({ isAuthorizing: false })
        })
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
      const activeTimeFilterLabel = getTimeFilterLabel(timeFilter)

      this.setData({
        searchKeyword: keyword,
        activeTimeFilter: timeFilter,
        activeTimeFilterLabel,
        showTimeFilterDropdown: false,
        pageIndex: 1,
        isLoadingMore: false,
      })

      if (isPendingRangeFilter(timeFilter, rangeFilter)) {
        return
      }

      this.loadTakeoversFromServer(1, true, rangeFilter)
    },

    loadTakeoversFromServer(page: number, replace: boolean, nextRangeFilter?: RangeFilter) {
      if (this.data.isBlocked) {
        return
      }

      const rangeFilter = nextRangeFilter || {
        startDate: this.data.rangeStartDate,
        endDate: this.data.rangeEndDate,
      }
      if (isPendingRangeFilter(this.data.activeTimeFilter, rangeFilter)) {
        return
      }

      const query = buildQuery({
        keyword: this.data.searchKeyword.trim(),
        timeFilter: getServerTimeFilter(this.data.activeTimeFilter, rangeFilter),
        startDate: rangeFilter.startDate,
        endDate: rangeFilter.endDate,
        page,
        pageSize: PAGE_SIZE,
      })

      apiRequest<unknown>({
        url: `/api/takeovers${query}`,
      })
        .then(rawData => {
          const result = normalizeTakeoverList(rawData)
          allTakeovers = replace ? result.list : [...allTakeovers, ...result.list]

          this.setData({
            takeoverList: allTakeovers,
            pageIndex: page,
            hasMore: allTakeovers.length < result.total && result.list.length > 0,
          })
        })
        .catch(error => {
          if (error.message === 'USER_BLOCKED' || error.message.includes('拉黑')) {
            this.setData({
              isBlocked: true,
              blockedMessage: '您已被管理员拉黑',
              takeoverList: [],
              hasMore: false,
            })
            return
          }

          wx.showToast({ title: error.message || '列表加载失败', icon: 'none' })
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

      const finishRefresh = () => {
        this.setData({ isRefreshing: false })
        setTimeout(() => {
          this.setData({ isLoadMoreLocked: false })
        }, 600)
      }

      this.loadTakeoversFromServer(1, true)
      setTimeout(finishRefresh, 600)
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

      if (isPendingRangeFilter(this.data.activeTimeFilter, {
        startDate: this.data.rangeStartDate,
        endDate: this.data.rangeEndDate,
      })) {
        return
      }

      this.setData({ isLoadingMore: true })
      const nextPageIndex = this.data.pageIndex + 1

      apiRequest<unknown>({
        url: `/api/takeovers${buildQuery({
          keyword: this.data.searchKeyword.trim(),
          timeFilter: getServerTimeFilter(this.data.activeTimeFilter, {
            startDate: this.data.rangeStartDate,
            endDate: this.data.rangeEndDate,
          }),
          startDate: this.data.rangeStartDate,
          endDate: this.data.rangeEndDate,
          page: nextPageIndex,
          pageSize: PAGE_SIZE,
        })}`,
      })
        .then(rawData => {
          const result = normalizeTakeoverList(rawData)
          allTakeovers = [...allTakeovers, ...result.list]
          this.setData({
            takeoverList: allTakeovers,
            pageIndex: nextPageIndex,
            hasMore: allTakeovers.length < result.total && result.list.length > 0,
          })
        })
        .catch(error => {
          wx.showToast({ title: error.message || '加载失败', icon: 'none' })
        })
        .finally(() => {
          this.setData({ isLoadingMore: false })
        })
    },

    ensureProfile(action: PendingAction, takeoverId: string) {
      if (this.data.isAuthorizing) {
        return
      }

      this.setData({
        pendingAction: action,
        pendingTakeoverId: takeoverId,
      })

      if (this.data.isBlocked) {
        wx.showToast({ title: '您已被管理员拉黑', icon: 'none' })
        return
      }

      const userProfile = getStoredProfile()

      if (userProfile) {
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

    openProfileEditor() {
      if (this.data.isBlocked) {
        wx.showToast({ title: '您已被管理员拉黑', icon: 'none' })
        return
      }

      this.setData({
        pendingAction: '',
        pendingTakeoverId: '',
        nickNameError: '',
        steamIdError: '',
        genderError: '',
      })

      const openSheet = (profile?: UserProfile | null) => {
        if (profile) {
          wx.setStorageSync(PROFILE_KEY, profile)
          getApp<IAppOption>().globalData.userProfile = profile
          this.setData({
            nickName: profile.nickName,
            steamId: profile.steamId,
            gender: profile.gender,
            avatarUrl: profile.avatarUrl,
          })
        }

        this.setData({
          showProfileSheet: true,
          avatarUrl: this.data.avatarUrl || getGenderAvatar(this.data.gender),
        })
      }

      if (!getUserToken()) {
        openSheet(getStoredProfile())
        return
      }

      this.setData({ isAuthorizing: true })
      apiRequest<Record<string, any>>({
        url: '/api/me/profile',
      })
        .then(result => {
          openSheet(normalizeUserProfile(result))
        })
        .catch(() => {
          openSheet(getStoredProfile())
        })
        .finally(() => {
          this.setData({ isAuthorizing: false })
        })
    },

    selectGender(event: WechatMiniprogram.TouchEvent) {
      const gender = event.currentTarget.dataset.gender as Gender

      if (gender !== 'male' && gender !== 'female') {
        return
      }

      this.setData({
        gender,
        avatarUrl: this.data.avatarUrl || getGenderAvatar(gender),
        genderError: '',
      })
    },

    chooseAvatar() {
      if (this.data.isUploadingAvatar) {
        return
      }

      const handleFile = (filePath: string) => {
        console.log('avatar upload start:', filePath)
        this.setData({ isUploadingAvatar: true })
        uploadImage(filePath)
          .then(url => {
            this.setData({ avatarUrl: url })
            const nickName = this.data.nickName.trim()
            const steamId = this.data.steamId.trim()
            const gender = this.data.gender

            if (nickName && steamId && gender) {
              return this.persistProfile({ nickName, steamId, gender, avatarUrl: url }, false)
            }
          })
          .catch(error => {
            wx.showToast({ title: error.message || '头像上传或保存失败', icon: 'none' })
          })
          .finally(() => {
            this.setData({ isUploadingAvatar: false })
          })
      }

      wx.chooseImage({
        count: 1,
        sourceType: ['album', 'camera'],
        success: result => {
          console.log('chooseImage result:', result)
          const filePath = result.tempFilePaths[0]
          if (filePath) {
            handleFile(filePath)
          } else {
            wx.showToast({ title: '未获取到图片路径', icon: 'none' })
          }
        },
        fail: () => {
          wx.showToast({ title: '选择图片失败', icon: 'none' })
        },
      })
    },

    persistProfile(userProfile: ProfilePayload, closeSheet: boolean) {
      return apiRequest<Record<string, any> | { profileCompleted?: boolean }>({
        url: '/api/me/profile',
        method: 'PUT',
        data: {
          nickName: userProfile.nickName,
          steamId: userProfile.steamId,
          gender: toApiGender(userProfile.gender),
          avatarUrl: userProfile.avatarUrl,
        },
      }).then(result => {
        const normalizedProfile = normalizeUserProfile(result as Record<string, any>) || userProfile
        wx.setStorageSync(PROFILE_KEY, normalizedProfile)
        getApp<IAppOption>().globalData.userProfile = normalizedProfile

        this.setData({
          nickName: normalizedProfile.nickName,
          steamId: normalizedProfile.steamId,
          gender: normalizedProfile.gender,
          avatarUrl: normalizedProfile.avatarUrl,
          showProfileSheet: closeSheet ? false : this.data.showProfileSheet,
        })

        return normalizedProfile
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
      this.syncCreateTimeLimit()
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
      const createTime = event.detail.value as string
      const createTimeError =
        this.data.createScheduleType === 'once' &&
        isTodayText(this.data.createDate) &&
        !isTimeAfterNow(createTime)
          ? '请选择当前时间之后的时间'
          : ''

      this.setData({
        createTime: createTimeError ? '' : createTime,
        createTimeError,
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
      this.syncCreateTimeLimit()
    },

    syncCreateTimeLimit() {
      const minCreateTime =
        this.data.createScheduleType === 'once' && isTodayText(this.data.createDate)
          ? minFutureTimeForInput()
          : ''
      const shouldClearTime =
        !!minCreateTime &&
        !!this.data.createTime &&
        !isTimeAfterNow(this.data.createTime)

      this.setData({
        minCreateTime,
        createTime: shouldClearTime ? '' : this.data.createTime,
        createTimeError: shouldClearTime ? '请选择当前时间之后的时间' : this.data.createTimeError,
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
        avatarUrl: this.data.avatarUrl || getGenderAvatar(gender),
      }

      this.persistProfile(userProfile, true)
        .then(() => {
          this.completePendingAction(this.data.pendingAction)
        })
        .catch(error => {
          wx.showToast({ title: error.message || '保存失败', icon: 'none' })
        })
        .finally(() => {
          this.setData({ isSaving: false })
        })
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
      this.syncCreateTimeLimit()
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

          this.setData({ isAuthorizing: true })
          apiRequest<null>({
            url: `/api/admin/takeovers/${takeoverId}`,
            method: 'DELETE',
            tokenType: 'admin',
          })
            .then(() => {
              allTakeovers = allTakeovers.filter(takeover => takeover.id !== takeoverId)
              if (this.data.currentTakeover && this.data.currentTakeover.id === takeoverId) {
                this.setData({
                  showDetailSheet: false,
                  currentTakeover: null,
                })
              }
              this.applyFilters(this.data.searchKeyword, this.data.activeTimeFilter)
              wx.showToast({ title: '已删除', icon: 'success' })
            })
            .catch(error => {
              wx.showToast({ title: error.message || '删除失败', icon: 'none' })
            })
            .finally(() => {
              this.setData({ isAuthorizing: false })
            })
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
      const createTimeError = time ? this.validateCreateTime(time) : '请输入时间'
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
      const payload = buildTakeoverPayload(title, limit, scheduleType, schedule, description)

      if (editingTakeover) {
        this.setData({ isAuthorizing: true })
        apiRequest<Record<string, any> | null>({
          url: `/api/admin/takeovers/${editingTakeover.id}`,
          method: 'PUT',
          data: payload,
          tokenType: 'admin',
        })
          .then(result => {
            const editedTakeover = result ? normalizeTakeover(result as Record<string, any>) : createMockTakeover({
              ...editingTakeover,
              title,
              limit,
              schedule,
              description,
            })

            allTakeovers = allTakeovers.map(takeover =>
              takeover.id === editingTakeover.id ? editedTakeover : takeover
            )

            const currentTakeover = this.data.currentTakeover && this.data.currentTakeover.id === editingTakeover.id
              ? editedTakeover
              : this.data.currentTakeover

            this.applyFilters(this.data.searchKeyword, this.data.activeTimeFilter)
            this.resetCreateSheet(currentTakeover)
            wx.showToast({ title: '已保存', icon: 'success' })
          })
          .catch(error => {
            wx.showToast({ title: error.message || '保存失败', icon: 'none' })
          })
          .finally(() => {
            this.setData({ isAuthorizing: false })
          })
        return
      }

      this.setData({ isAuthorizing: true })
      apiRequest<{ id?: string } | Record<string, any>>({
        url: '/api/takeovers',
        method: 'POST',
        data: payload,
      })
        .then(() => {
          this.resetCreateSheet(null)
          this.setData({
            searchKeyword: '',
            activeTimeFilter: 'all',
            activeTimeFilterLabel: '今天',
          })
          this.loadTakeoversFromServer(1, true)
          wx.showToast({ title: '已创建', icon: 'success' })
        })
        .catch(error => {
          wx.showToast({ title: error.message || '创建失败', icon: 'none' })
        })
        .finally(() => {
          this.setData({ isAuthorizing: false })
        })
    },

    resetCreateSheet(currentTakeover: Takeover | null) {
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
    },

    validateCreateTime(time: string) {
      if (
        this.data.createScheduleType === 'once' &&
        isTodayText(this.data.createDate.trim()) &&
        time &&
        !isTimeAfterNow(time)
      ) {
        return '固定时间必须晚于当前时间'
      }

      return ''
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
        this.syncCreateTimeLimit()
        return
      }

      if (action === 'join') {
        this.markTakeoverJoined(this.data.pendingTakeoverId)
        return
      }

      this.openTakeoverDetail(this.data.pendingTakeoverId)
    },

    openTakeoverDetail(takeoverId: string) {
      this.setData({ isAuthorizing: true })
      apiRequest<Record<string, any>>({
        url: `/api/takeovers/${takeoverId}`,
      })
        .then(result => {
          const takeover = normalizeTakeover(result)

          allTakeovers = allTakeovers.map(item => (item.id === takeover.id ? takeover : item))
          this.setData({
            currentTakeover: takeover,
            ...this.getDetailJoinState(takeover),
            showDetailSheet: true,
            takeoverList: allTakeovers,
          })
        })
        .catch(error => {
          const fallbackTakeover = allTakeovers.find(item => item.id === takeoverId)

          if (fallbackTakeover) {
            this.setData({
              currentTakeover: fallbackTakeover,
              ...this.getDetailJoinState(fallbackTakeover),
              showDetailSheet: true,
            })
            return
          }

          wx.showToast({ title: error.message || '接龙不存在', icon: 'none' })
        })
        .finally(() => {
          this.setData({ isAuthorizing: false })
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

      return takeover.hasJoined || takeover.participants.some(participant => participant.steamId === userProfile.steamId)
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
      const userId = event.currentTarget.dataset.userid as string

      if (!userId && !steamId) {
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

          this.setData({ isAuthorizing: true })
          apiRequest<null>({
            url: `/api/admin/users/${userId || steamId}/block`,
            method: 'POST',
            data: { reason: '管理员拉黑' },
            tokenType: 'admin',
          })
            .then(() => {
              allTakeovers = allTakeovers.map(takeover => {
                const participants = takeover.participants.filter(participant =>
                  userId ? participant.userId !== userId : participant.steamId !== steamId
                )
                const joined = Math.min(participants.length, takeover.limit)

                return {
                  ...takeover,
                  joined,
                  participants,
                  participantAvatars: participants.map(participant => participant.avatarUrl).slice(0, 4),
                }
              })

              const currentTakeover = this.data.currentTakeover
                ? allTakeovers.find(takeover => takeover.id === (this.data.currentTakeover && this.data.currentTakeover.id)) || null
                : null

              this.setData({
                currentTakeover,
                ...(currentTakeover
                  ? this.getDetailJoinState(currentTakeover)
                  : { detailJoinStatusText: '未加入', showDetailJoinButton: false }),
              })
              this.loadTakeoversFromServer(1, true)
              wx.showToast({ title: '已拉黑', icon: 'success' })
            })
            .catch(error => {
              wx.showToast({ title: error.message || '拉黑失败', icon: 'none' })
            })
            .finally(() => {
              this.setData({ isAuthorizing: false })
            })
        },
      })
    },

    markTakeoverJoined(takeoverId: string) {
      this.setData({ isAuthorizing: true })
      apiRequest<Record<string, any> | { hasJoined?: boolean; joinedCount?: number }>({
        url: `/api/takeovers/${takeoverId}/join`,
        method: 'POST',
      })
        .then(() => {
          wx.showToast({ title: '已加入', icon: 'success' })
          this.loadTakeoversFromServer(1, true)
          this.openTakeoverDetail(takeoverId)
        })
        .catch(error => {
          wx.showToast({ title: error.message || '加入失败', icon: 'none' })
        })
        .finally(() => {
          this.setData({ isAuthorizing: false })
        })
    },
  },
})
