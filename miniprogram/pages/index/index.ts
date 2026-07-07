import { apiRequest, getUserToken, subscribeTakeoverReminder, uploadImage } from '../../utils/api'
import { enableShareMenu, HOME_SHARE_PATH, HOME_SHARE_TITLE } from '../../utils/share'

type PendingAction = 'view' | 'join' | 'create' | 'profile'
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
  remark?: string
  avatarUrl: string
  gender: Gender
  isAdmin?: boolean
  creditScore?: number
  creditStatus?: string
  isSelf?: boolean
}

type Participant = UserProfile

type RecommendTag = {
  type: string
  label: string
  tone: string
}

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
  participantExtraCount: number
  participants: Participant[]
  hasJoined: boolean
  creatorCreditScore?: number
  creatorCreditStatus?: string
  categoryLabel: string
  cardTags: string[]
  recommendTags: RecommendTag[]
  statusLabel: string
  statusTone: string
  takeoverState: number
  coverImage: string
  kookChannelId: string
  kookChannelName: string
  kookInviteUrl: string
}

type Announcement = {
  id: number
  title: string
  content: string
  imageUrl: string
}

const PAGE_SIZE = 5

const PROFILE_KEY = 'steam_takeover_user'
const TOKEN_KEY = 'steam_takeover_token'
const HOME_REFRESH_KEY = 'steam_takeover_home_needs_refresh'
const MALE_AVATAR_URL = 'https://wechat-bot-images.oss-cn-hangzhou.aliyuncs.com/miniapp/default-avatar/avatar-male.jpg'
const FEMALE_AVATAR_URL = 'https://wechat-bot-images.oss-cn-hangzhou.aliyuncs.com/miniapp/default-avatar/avatar-female.jpg'
const CREATE_SUBMIT_DEBOUNCE_MS = 1200
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
const canCreateWithCredit = (score?: number) => score === undefined || score >= 51
const canJoinWithCredit = (score?: number) => score === undefined || score >= 70

let lastCreateSubmitAt = 0

type LoginResult = {
  token?: string
  user?: Record<string, any>
  profileCompleted?: boolean
  publishTakeoverEnabled?: boolean
}

type ProfilePayload = {
  nickName: string
  steamId: string
  gender: Gender
  avatarUrl: string
  creditScore?: number
  creditStatus?: string
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
const isDefaultAvatar = (avatarUrl: string) => avatarUrl === MALE_AVATAR_URL || avatarUrl === FEMALE_AVATAR_URL
const isTrue = (value: unknown) => value === true || value === 1 || value === '1' || value === 'true'
const normalizeTakeoverState = (rawTakeover: Record<string, any>) =>
  Number(rawTakeover.takeoverState || rawTakeover.takeover_state || 1) === 2 ? 2 : 1

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
  const creditScore = getCreditScore(rawUser)

  if (!nickName || !gender) {
    return null
  }

  return {
    userId: rawUser.userId ? String(rawUser.userId) : rawUser.id ? String(rawUser.id) : undefined,
    openid: rawUser.openid ? String(rawUser.openid) : undefined,
    nickName,
    steamId,
    remark: normalizeRemark(rawUser.remark),
    gender,
    avatarUrl: rawUser.avatarUrl || rawUser.avatar_url || getGenderAvatar(gender),
    isAdmin: !!(rawUser.isAdmin || rawUser.is_admin),
    creditScore,
    creditStatus: rawUser.creditStatus || rawUser.credit_status || getCreditStatus(creditScore),
    isSelf: isTrue(rawUser.isSelf) || isTrue(rawUser.is_self),
  }
}

const normalizeRemark = (value: unknown) => Array.from(String(value || '').trim()).slice(0, 100).join('')

const normalizeParticipant = (rawParticipant: Record<string, any>): Participant => {
  const normalized = normalizeUserProfile(rawParticipant)

  if (normalized) {
    return normalized
  }

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

const normalizeRecommendTags = (value: unknown): RecommendTag[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter((tag): tag is Record<string, any> => !!tag && typeof tag === 'object')
    .map((tag: Record<string, any>) => ({
      type: String(tag.type || ''),
      label: String(tag.label || ''),
      tone: String(tag.tone || tag.type || 'muted'),
    }))
    .filter(tag => tag.label && tag.label !== '已满员')
    .slice(0, 2)
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
  const takeoverState = normalizeTakeoverState(rawTakeover)
  const creatorCreditScore = Number(rawTakeover.creatorCreditScore !== undefined && rawTakeover.creatorCreditScore !== null ? rawTakeover.creatorCreditScore : rawTakeover.creator_credit_score !== undefined && rawTakeover.creator_credit_score !== null ? rawTakeover.creator_credit_score : 100)
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

  const participantAvatars = participants.map(participant => participant.avatarUrl).slice(0, 4)

  return {
    id: String(rawTakeover.id),
    title: rawTakeover.title || '',
    host: rawTakeover.host || rawTakeover.creatorName || rawTakeover.creator_name || '',
    joined,
    limit,
    schedule,
    scheduleText: formatSchedule(schedule) || rawTakeover.scheduleText || rawTakeover.schedule_text || '',
    description: rawTakeover.description || '',
    avatarUrl: rawTakeover.avatarUrl || rawTakeover.avatar_url || (participants[0] && participants[0].avatarUrl) || FEMALE_AVATAR_URL,
    participantAvatars,
    participantExtraCount: Math.max(joined - participantAvatars.length, 0),
    participants,
    hasJoined: !!(rawTakeover.hasJoined || rawTakeover.has_joined),
    takeoverState,
    creatorCreditScore,
    creatorCreditStatus: rawTakeover.creatorCreditStatus || rawTakeover.creator_credit_status || getCreditStatus(creatorCreditScore),
    kookChannelId: rawTakeover.kookChannelId || rawTakeover.kook_channel_id || '',
    kookChannelName: rawTakeover.kookChannelName || rawTakeover.kook_channel_name || '',
    kookInviteUrl: rawTakeover.kookInviteUrl || rawTakeover.kook_invite_url || '',
    ...buildTakeoverDisplayFields(String(rawTakeover.id), joined, limit, scheduleType, rawTakeover),
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
  description: string,
  kookChannelId = '',
  kookChannelName = ''
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
    kookChannelId,
    kookChannelName,
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

  return `${getDateLabel(schedule.startDate)}-${getDateLabel(schedule.endDate)} ${schedule.time}`
}

const getDisplaySeed = (id: string) =>
  id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)

const buildTakeoverDisplayFields = (
  id: string,
  joined: number,
  limit: number,
  scheduleType: ScheduleType,
  rawTakeover: Record<string, any> = {}
) => {
  const numericId = getDisplaySeed(id)
  const statusLabel = rawTakeover.statusLabel || rawTakeover.status_label || (joined >= limit && limit > 0 ? '已满员' : '招募中')

  const statusTone = statusLabel === '已结束' ? 'ended' : statusLabel === '已满员' ? 'purple' : 'orange'

  return {
    categoryLabel: rawTakeover.categoryLabel || rawTakeover.category_label || rawTakeover.gameName || rawTakeover.game_name || CARD_CATEGORIES[numericId % CARD_CATEGORIES.length],
    cardTags: [
      rawTakeover.teamType || rawTakeover.team_type || (limit <= 4 ? '四排' : '五排'),
      rawTakeover.mode || rawTakeover.mode_label || (scheduleType === 'daily' ? '日常' : '上分'),
      joined >= limit && limit > 0 ? '满员' : '开黑',
    ],
    recommendTags: normalizeRecommendTags(rawTakeover.recommendTags || rawTakeover.recommend_tags),
    statusLabel,
    statusTone,
    coverImage: rawTakeover.coverImage || rawTakeover.cover_image || STATUS_COVERS[statusLabel] || CARD_COVERS[numericId % CARD_COVERS.length],
  }
}

const createMockTakeover = (
  takeover: Omit<Takeover, 'scheduleText' | 'participantAvatars' | 'participantExtraCount' | 'categoryLabel' | 'cardTags' | 'recommendTags' | 'statusLabel' | 'statusTone' | 'takeoverState' | 'coverImage' | 'kookChannelId' | 'kookChannelName' | 'kookInviteUrl'> & {
    kookChannelId?: string
    kookChannelName?: string
    kookInviteUrl?: string
  }
): Takeover => {
  const participantAvatars = takeover.participants.map(participant => participant.avatarUrl).slice(0, 4)

  return {
    ...takeover,
    kookChannelId: takeover.kookChannelId || '',
    kookChannelName: takeover.kookChannelName || '',
    kookInviteUrl: takeover.kookInviteUrl || '',
    takeoverState: 1,
    ...buildTakeoverDisplayFields(takeover.id, takeover.joined, takeover.limit, takeover.schedule.type),
    scheduleText: formatSchedule(takeover.schedule),
    participantAvatars,
    participantExtraCount: Math.max(takeover.joined - participantAvatars.length, 0),
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
let searchTimer: number | undefined

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

const isCompleteProfile = (profile: { nickName?: string; gender?: Gender | '' } | null | undefined) =>
  !!profile && !!profile.nickName && (profile.gender === 'male' || profile.gender === 'female')

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

Page({
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
    isSubmittingTakeover: false,
    isSaving: false,
    isUploadingAvatar: false,
    publishTakeoverEnabled: false,
    profileCompleted: false,
    isAdmin: false,
    showProfileSheet: false,
    showCreateSheet: false,
    showDetailSheet: false,
    showRemarkSheet: false,
    showCardMenuSheet: false,
    showAnnouncement: false,
    announcement: null as Announcement | null,
    currentTakeover: null as Takeover | null,
    detailJoinStatusText: '未加入',
    showDetailJoinButton: false,
    remarkMode: 'join' as 'join' | 'edit',
    memberRemark: '',
    isSavingRemark: false,
    managingTakeover: null as Takeover | null,
    pendingAction: '' as PendingAction | '',
    pendingTakeoverId: '',
    nickName: '',
    steamId: '',
    steamIdLocked: false,
    gender: '' as Gender | '',
    avatarUrl: '',
    creditScore: 100,
    creditStatus: 'normal',
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
    selectedKookChannelId: '',
    selectedKookChannelName: '',
    kookChannelSearch: '',
    editingTakeoverId: '',
    createTitleError: '',
    createLimitError: '',
    createDateError: '',
    createTimeError: '',
    createDescriptionError: '',
  },

  onLoad() {
    enableShareMenu()
    const userProfile = getStoredProfile()

    this.setData({
      isAdmin: !!(userProfile && userProfile.isAdmin),
    })

    if (userProfile) {
      getApp<IAppOption>().globalData.userProfile = userProfile
      this.setData({
        nickName: userProfile.nickName,
        steamId: userProfile.steamId,
        steamIdLocked: !!userProfile.steamId,
        gender: userProfile.gender,
        avatarUrl: userProfile.avatarUrl,
        isAdmin: !!userProfile.isAdmin,
      })
    }

    this.bootstrap()
  },

  onShow() {
    if (!getUserToken() || this.data.isAuthorizing) {
      return
    }

    wx.removeStorageSync(HOME_REFRESH_KEY)
    this.loadTakeoversFromServer(1, true)
    this.loadCurrentAnnouncement()
  },

  onShareAppMessage() {
    return {
      title: HOME_SHARE_TITLE,
      path: HOME_SHARE_PATH,
    }
  },

  onShareTimeline() {
    return {
      title: HOME_SHARE_TITLE,
      query: '',
    }
  },

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

              this.setData({ publishTakeoverEnabled: result.publishTakeoverEnabled === true })

              const normalizedProfile = normalizeUserProfile(result.user)
              if (normalizedProfile) {
                wx.setStorageSync(PROFILE_KEY, normalizedProfile)
                getApp<IAppOption>().globalData.userProfile = normalizedProfile
                this.setData({
                  profileCompleted: true,
                  nickName: normalizedProfile.nickName,
                  steamId: normalizedProfile.steamId,
                  steamIdLocked: !!normalizedProfile.steamId,
                  gender: normalizedProfile.gender,
                  avatarUrl: normalizedProfile.avatarUrl,
                  isAdmin: !!normalizedProfile.isAdmin,
                  creditScore: normalizedProfile.creditScore !== undefined && normalizedProfile.creditScore !== null ? normalizedProfile.creditScore : 100,
                  creditStatus: normalizedProfile.creditStatus || getCreditStatus(normalizedProfile.creditScore !== undefined && normalizedProfile.creditScore !== null ? normalizedProfile.creditScore : 100),
                })
              } else {
                wx.removeStorageSync(PROFILE_KEY)
                getApp<IAppOption>().globalData.userProfile = undefined
                this.setData({
                  profileCompleted: false,
                  nickName: '',
                  steamId: '',
                  steamIdLocked: false,
                  gender: '',
                  avatarUrl: '',
                  isAdmin: false,
                  creditScore: 100,
                  creditStatus: 'normal',
                })
              }

              this.loadTakeoversFromServer(1, true)
              this.loadCurrentAnnouncement()
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

    loadCurrentAnnouncement() {
      apiRequest<Record<string, any> | null>('/api/announcements/current')
        .then(raw => {
          if (!raw || !raw.id) return
          this.setData({
            announcement: {
              id: Number(raw.id),
              title: String(raw.title || ''),
              content: String(raw.content || ''),
              imageUrl: String(raw.imageUrl || raw.image_url || ''),
            },
            showAnnouncement: true,
          })
        })
        .catch(() => {
          // 公告不影响首页主流程。
        })
    },

    closeAnnouncement() {
      const announcement = this.data.announcement
      this.setData({ showAnnouncement: false })
      if (!announcement) return
      apiRequest({
        url: `/api/announcements/${announcement.id}/read`,
        method: 'POST',
      }).catch(() => {
        // 下次进入仍可再次拉取，当前不打断用户。
      })
    },

    viewTakeover(event: WechatMiniprogram.TouchEvent & { detail?: { id?: string } }) {
      const takeoverId = ((event.detail && event.detail.id) || event.currentTarget.dataset.id) as string
      if (!takeoverId) {
        return
      }

      if (!getStoredProfile()) {
        this.ensureProfile('view', takeoverId)
        return
      }

      this.navigateToDetail(takeoverId)
    },

    handleTakeoverAction(event: WechatMiniprogram.TouchEvent) {
      const takeoverId = event.currentTarget.dataset.id as string
      if (!takeoverId) {
        return
      }

      if (!getStoredProfile()) {
        this.ensureProfile('view', takeoverId)
        return
      }

      this.navigateToDetail(takeoverId)
    },

    createTakeover() {
      if (!this.data.publishTakeoverEnabled) {
        wx.showToast({ title: '暂未开放发起接龙', icon: 'none' })
        return
      }

      this.ensureProfile('create', '')
    },

    handleSearchInput(event: WechatMiniprogram.Input) {
      const keyword = event.detail.value
      this.setData({ searchKeyword: keyword })
      if (searchTimer) clearTimeout(searchTimer)
      searchTimer = setTimeout(() => {
        this.applyFilters(keyword, this.data.activeTimeFilter)
      }, 500) as unknown as number
    },

    clearSearch() {
      if (searchTimer) clearTimeout(searchTimer)
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

    handleRangeStartChange(event: WechatMiniprogram.PickerChange | { detail: { value: string } }) {
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

    handleRangeEndChange(event: WechatMiniprogram.PickerChange | { detail: { value: string } }) {
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
      if (searchTimer) clearTimeout(searchTimer)
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

      const pageProfile = isCompleteProfile({
        nickName: this.data.nickName,
        gender: this.data.gender,
      })
        ? {
            nickName: this.data.nickName,
            steamId: this.data.steamId,
            gender: this.data.gender as Gender,
            avatarUrl: this.data.avatarUrl || getGenderAvatar(this.data.gender),
            creditScore: this.data.creditScore,
            creditStatus: this.data.creditStatus,
          }
        : null
      const userProfile = getStoredProfile() || pageProfile

      if (!userProfile) {
        if (!getUserToken()) {
          this.openProfileSheetForAction(action, takeoverId)
          return
        }

        this.setData({ isAuthorizing: true })
        apiRequest<Record<string, any>>({
          url: '/api/me/profile',
        })
          .then(result => {
            const profile = normalizeUserProfile(result)
            if (!profile) {
              this.openProfileSheetForAction(action, takeoverId)
              return
            }

            wx.setStorageSync(PROFILE_KEY, profile)
            getApp<IAppOption>().globalData.userProfile = profile
            this.setData({
              nickName: profile.nickName,
              steamId: profile.steamId,
              steamIdLocked: !!profile.steamId,
              gender: profile.gender,
              avatarUrl: profile.avatarUrl,
              creditScore: profile.creditScore !== undefined && profile.creditScore !== null ? profile.creditScore : 100,
              creditStatus: profile.creditStatus || getCreditStatus(profile.creditScore !== undefined && profile.creditScore !== null ? profile.creditScore : 100),
              profileCompleted: true,
            })
            this.completePendingAction(action)
          })
          .catch(() => {
            this.openProfileSheetForAction(action, takeoverId)
          })
          .finally(() => {
            this.setData({ isAuthorizing: false })
          })
        return
      }

      if (userProfile) {
        if (action === 'create' && !canCreateWithCredit(userProfile.creditScore)) {
          wx.showToast({ title: '信誉分过低，暂无法发起接龙', icon: 'none' })
          return
        }
        if (action === 'join' && !canJoinWithCredit(userProfile.creditScore)) {
          wx.showToast({ title: '信誉分低于 70，暂无法参与接龙', icon: 'none' })
          return
        }
        getApp<IAppOption>().globalData.userProfile = userProfile
        this.completePendingAction(action)
        return
      }

    },

    openProfileSheetForAction(action: PendingAction | '', takeoverId = '') {
      this.setData({
        pendingAction: action,
        pendingTakeoverId: takeoverId,
        showProfileSheet: true,
        nickNameError: '',
        steamIdError: '',
        genderError: '',
      })
    },

    openProfileEditor() {
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
            steamIdLocked: !!profile.steamId,
            gender: profile.gender,
            avatarUrl: profile.avatarUrl,
            creditScore: profile.creditScore !== undefined && profile.creditScore !== null ? profile.creditScore : 100,
            creditStatus: profile.creditStatus || getCreditStatus(profile.creditScore !== undefined && profile.creditScore !== null ? profile.creditScore : 100),
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

    openProfilePage() {
      this.ensureProfile('profile', '')
    },

    selectGender(event: WechatMiniprogram.TouchEvent & { detail?: { gender?: Gender } }) {
      const gender = ((event.detail && event.detail.gender) || event.currentTarget.dataset.gender) as Gender

      if (gender !== 'male' && gender !== 'female') {
        return
      }

      this.setData({
        gender,
        avatarUrl: !this.data.avatarUrl || isDefaultAvatar(this.data.avatarUrl) ? getGenderAvatar(gender) : this.data.avatarUrl,
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

            if (nickName && gender) {
              return this.persistProfile({ nickName, steamId, gender, avatarUrl: url }, false)
            }

            return undefined
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
          steamIdLocked: !!normalizedProfile.steamId,
          gender: normalizedProfile.gender,
          avatarUrl: normalizedProfile.avatarUrl,
          creditScore: normalizedProfile.creditScore !== undefined && normalizedProfile.creditScore !== null ? normalizedProfile.creditScore : 100,
          creditStatus: normalizedProfile.creditStatus || getCreditStatus(normalizedProfile.creditScore !== undefined && normalizedProfile.creditScore !== null ? normalizedProfile.creditScore : 100),
          profileCompleted: true,
          showProfileSheet: closeSheet ? false : this.data.showProfileSheet,
        })

        return normalizedProfile
      })
    },

    handleNickNameInput(event: WechatMiniprogram.Input) {
      this.setData({
        nickName: String(event.detail.value || '').trim(),
        nickNameError: '',
      })
    },

    handleSteamIdInput(event: WechatMiniprogram.Input) {
      if (this.data.steamIdLocked) {
        return
      }

      this.setData({
        steamId: String(event.detail.value || '').trim(),
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

    handleCreateDateChange(event: WechatMiniprogram.PickerChange | { detail: { value: string } }) {
      const createDate = event.detail.value as string
      if (isDateBeforeToday(createDate)) {
        wx.showToast({ title: '不能选择今天之前的日期', icon: 'none' })
        return
      }
      this.setData({
        createDate,
        createDateError: '',
      })
      this.syncCreateTimeLimit()
    },

    handleCreateStartDateChange(event: WechatMiniprogram.PickerChange | { detail: { value: string } }) {
      const startDate = event.detail.value as string
      if (isDateBeforeToday(startDate)) {
        wx.showToast({ title: '不能选择今天之前的日期', icon: 'none' })
        return
      }
      const endDate = this.data.createEndDate
      this.setData({
        createStartDate: startDate,
        createEndDate: endDate && endDate < startDate ? startDate : endDate,
        createDateError: '',
      })
    },

    handleCreateEndDateChange(event: WechatMiniprogram.PickerChange | { detail: { value: string } }) {
      const endDate = event.detail.value as string
      if (isDateBeforeToday(endDate)) {
        wx.showToast({ title: '不能选择今天之前的日期', icon: 'none' })
        return
      }
      const startDate = this.data.createStartDate
      this.setData({
        createStartDate: startDate && startDate > endDate ? endDate : startDate,
        createEndDate: endDate,
        createDateError: '',
      })
    },

    handleCreateTimeChange(event: WechatMiniprogram.PickerChange | { detail: { value: string } }) {
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

      const userProfile: ProfilePayload = {
        nickName,
        steamId,
        gender: gender as Gender,
        avatarUrl: this.data.avatarUrl || getGenderAvatar(gender as Gender),
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
        selectedKookChannelId: takeover.kookChannelId,
        selectedKookChannelName: takeover.kookChannelName,
        kookChannelSearch: takeover.kookChannelName,
        createTitleError: '',
        createLimitError: '',
        createDateError: '',
        createTimeError: '',
        createDescriptionError: '',
      })
      this.syncCreateTimeLimit()
    },

    handleKookChannelChange(event: WechatMiniprogram.CustomEvent) {
      const detail = event.detail || {}
      this.setData({
        selectedKookChannelId: detail.id || '',
        selectedKookChannelName: detail.name || '',
        kookChannelSearch: detail.label || detail.name || '',
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

          this.setData({ isAuthorizing: true })
          apiRequest<null>({
            url: `/api/takeovers/${takeoverId}`,
            method: 'DELETE',
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
      if (this.data.isSubmittingTakeover) return
      const now = Date.now()
      if (now - lastCreateSubmitAt < CREATE_SUBMIT_DEBOUNCE_MS) return
      lastCreateSubmitAt = now

      const title = this.data.createTitle.trim()
      const limit = Number(this.data.createLimit)
      const description = this.data.createDescription.trim()
      const time = this.data.createTime.trim()
      const scheduleType = this.data.createScheduleType

      const createTitleError = title ? (title.length > 30 ? '标题不能超过 30 个字' : '') : '请输入标题'
      const createLimitError =
        Number.isInteger(limit) && limit > 0 && limit <= 99 ? '' : '请输入 1-99 的人数'
      const createTimeError = time ? this.validateCreateTime(time) : '请输入时间'
      const createDescriptionError = description ? (description.length > 500 ? '介绍不能超过 500 个字' : '') : '请输入介绍'
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

      const editingTakeover = allTakeovers.find(takeover => takeover.id === this.data.editingTakeoverId)

      const schedule = this.buildCreateSchedule(scheduleType, time)
      const payload = buildTakeoverPayload(
        title,
        limit,
        scheduleType,
        schedule,
        description,
        this.data.selectedKookChannelId,
        this.data.selectedKookChannelName
      )

      if (editingTakeover) {
        this.setData({ isAuthorizing: true, isSubmittingTakeover: true })
        apiRequest<Record<string, any> | null>({
          url: `/api/takeovers/${editingTakeover.id}`,
          method: 'PUT',
          data: payload,
        })
          .then(result => {
            const editedTakeover = result ? normalizeTakeover(result as Record<string, any>) : createMockTakeover({
              ...editingTakeover,
              title,
              limit,
              schedule,
              description,
              kookChannelId: this.data.selectedKookChannelId,
              kookChannelName: this.data.selectedKookChannelName,
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
            this.setData({ isAuthorizing: false, isSubmittingTakeover: false })
          })
        return
      }

      this.setData({ isAuthorizing: true, isSubmittingTakeover: true })
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
          if (error.code === 'PROFILE_INCOMPLETE') {
            this.openProfileSheetForAction('create')
            return
          }

          wx.showToast({ title: error.message || '创建失败', icon: 'none' })
        })
        .finally(() => {
          this.setData({ isAuthorizing: false, isSubmittingTakeover: false })
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
        selectedKookChannelId: '',
        selectedKookChannelName: '',
        kookChannelSearch: '',
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
        return ''
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
        if (!this.data.publishTakeoverEnabled) {
          wx.showToast({ title: '暂未开放发起接龙', icon: 'none' })
          return
        }

        this.setData({ showCreateSheet: true })
        this.syncCreateTimeLimit()
        return
      }

      if (action === 'join') {
        this.markTakeoverJoined(this.data.pendingTakeoverId)
        return
      }

      if (action === 'profile') {
        wx.navigateTo({ url: '/pages/profile/profile' })
        return
      }

      this.navigateToDetail(this.data.pendingTakeoverId)
    },

    navigateToDetail(takeoverId: string) {
      wx.navigateTo({
        url: `/pages/detail/detail?id=${encodeURIComponent(takeoverId)}`,
        events: {
          takeoverChanged: () => {
            this.loadTakeoversFromServer(1, true)
          },
        },
      })
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

      return takeover.hasJoined || (!!userProfile.steamId && takeover.participants.some(participant => participant.steamId === userProfile.steamId))
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

      this.setData({
        showRemarkSheet: true,
        remarkMode: 'join',
        memberRemark: '',
      })
    },

    openMemberRemarkSheet(event: WechatMiniprogram.TouchEvent) {
      const remark = event.currentTarget.dataset.remark as string
      this.setData({
        showRemarkSheet: true,
        remarkMode: 'edit',
        memberRemark: normalizeRemark(remark),
      })
    },

    closeMemberRemarkSheet() {
      if (this.data.isSavingRemark || this.data.isAuthorizing) return
      this.setData({ showRemarkSheet: false, memberRemark: '' })
    },

    joinWithoutRemark() {
      const takeover = this.data.currentTakeover
      if (!takeover || this.data.isSavingRemark || this.data.isAuthorizing) return
      this.markTakeoverJoined(takeover.id, '')
    },

    handleMemberRemarkInput(event: WechatMiniprogram.Input) {
      this.setData({ memberRemark: normalizeRemark(event.detail.value) })
    },

    submitMemberRemark() {
      const takeover = this.data.currentTakeover
      const remark = normalizeRemark(this.data.memberRemark)
      if (!takeover || this.data.isSavingRemark || this.data.isAuthorizing) {
        return
      }

      if (this.data.remarkMode === 'join') {
        this.markTakeoverJoined(takeover.id, remark)
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
          const currentTakeover = this.data.currentTakeover
          if (!currentTakeover) return
          const updatedTakeover = {
            ...currentTakeover,
            participants: currentTakeover.participants.map(participant =>
              participant.isSelf ? { ...participant, remark: nextRemark } : participant
            ),
          }
          allTakeovers = allTakeovers.map(item => (item.id === updatedTakeover.id ? updatedTakeover : item))
          this.setData({
            currentTakeover: updatedTakeover,
            takeoverList: this.data.takeoverList.map(item => (item.id === updatedTakeover.id ? updatedTakeover : item)),
            showRemarkSheet: false,
            memberRemark: '',
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

    copyKookInvite() {
      const inviteURL = this.data.currentTakeover && this.data.currentTakeover.kookInviteUrl
      if (!inviteURL) {
        return
      }

      wx.setClipboardData({
        data: inviteURL,
        success: () => {
          wx.showToast({ title: '已复制频道链接，用浏览器打开即可加入 KOOK 频道。', icon: 'none' })
        },
      })
    },

    markTakeoverJoined(takeoverId: string, remark = '') {
      this.setData({ isAuthorizing: true })
      apiRequest<Record<string, any> | { hasJoined?: boolean; joinedCount?: number }>({
        url: `/api/takeovers/${takeoverId}/join`,
        method: 'POST',
        data: { remark },
      })
        .then(() => {
          this.setData({ showRemarkSheet: false, memberRemark: '' })
          wx.showToast({ title: '已加入', icon: 'success' })
          subscribeTakeoverReminder(takeoverId)
          this.loadTakeoversFromServer(1, true)
          this.openTakeoverDetail(takeoverId)
        })
        .catch(error => {
          if (error.code === 'PROFILE_INCOMPLETE') {
            this.setData({ showRemarkSheet: false })
            this.openProfileSheetForAction('join', takeoverId)
            return
          }

          wx.showToast({ title: error.message || '加入失败', icon: 'none' })
        })
        .finally(() => {
          this.setData({ isAuthorizing: false })
        })
    },
})
