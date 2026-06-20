const API_BASE_URL = "http://47.102.200.211:8081"
const TOKEN_KEY = "tabbits_user_token"
const ADMIN_TOKEN_KEY = "tabbits_admin_token"
const PROFILE_KEY = "tabbits_profile"
const DEFAULT_AVATAR = {
  1: "./assets/avatar-male.jpg",
  2: "./assets/avatar-female.jpg",
}

const icons = {
  green: '<path d="M7 8h10l2 4-7 7-7-7 2-4Z"></path><path d="m9 8 3 11 3-11"></path>',
  purple: '<path d="M12 3v18"></path><path d="M5 8h14"></path><path d="M7 14h10"></path>',
  pink: '<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z"></path>',
  yellow: '<path d="M12 3 4 8l8 5 8-5-8-5Z"></path><path d="M4 13l8 5 8-5"></path>',
}

const tones = ["green", "purple", "yellow", "pink"]
const listEl = document.querySelector("#takeoverList")
const loadMoreButton = document.querySelector("#loadMoreButton")
const detailEl = document.querySelector("#detailPanel")
const countEl = document.querySelector("#resultCount")
const searchInput = document.querySelector("#searchInput")
const themeToggle = document.querySelector("#themeToggle")
const profileButton = document.querySelector("#profileButton")
const accountMenu = document.querySelector("#accountMenu")
const accountDropdown = document.querySelector("#accountDropdown")
const createButton = document.querySelector("#createButton")
const statusText = document.querySelector("#statusText")
const sessionLabel = document.querySelector("#sessionLabel")
const app = document.querySelector(".app")
const toastEl = document.querySelector("#toast")
const profileModal = document.querySelector("#profileModal")
const registerModal = document.querySelector("#registerModal")
const createModal = document.querySelector("#createModal")
const adminModal = document.querySelector("#adminModal")
const blockedUsersModal = document.querySelector("#blockedUsersModal")
const blockConfirmModal = document.querySelector("#blockConfirmModal")
const detailModal = document.querySelector("#detailModal")
const detailModalContent = document.querySelector("#detailModalContent")
const loginForm = document.querySelector("#loginForm")
const registerForm = document.querySelector("#registerForm")
const openRegisterButton = document.querySelector("#openRegisterButton")
const createForm = document.querySelector("#createForm")
const adminForm = document.querySelector("#adminForm")
const blockConfirmForm = document.querySelector("#blockConfirmForm")
const blockTargetText = document.querySelector("#blockTargetText")
const blockedPanel = document.querySelector("#blockedPanel")
const blockedUsersPanel = document.querySelector("#blockedUsersPanel")
const blockedSearchInput = document.querySelector("#blockedSearchInput")
const profileGender = document.querySelector("#profileGender")
const genderOptions = Array.from(document.querySelectorAll(".gender-option"))
const scheduleTypeInput = document.querySelector("#scheduleType")
const scheduleTypeButton = document.querySelector("#scheduleTypeButton")
const scheduleTypeLabel = document.querySelector("#scheduleTypeLabel")
const scheduleTypeMenu = document.querySelector("#scheduleTypeMenu")
const scheduleTypeOptions = Array.from(document.querySelectorAll(".select-option"))
const avatarInput = document.querySelector("#avatarInput")
const avatarPreview = document.querySelector("#avatarPreview")
const filterButtons = Array.from(document.querySelectorAll(".filter"))
const rangeFilter = document.querySelector("#rangeFilter")
const rangeStartDate = document.querySelector("#rangeStartDate")
const rangeEndDate = document.querySelector("#rangeEndDate")
const clearRangeFilter = document.querySelector("#clearRangeFilter")
const stepperButtons = Array.from(document.querySelectorAll("[data-stepper]"))
const pickerFields = Array.from(document.querySelectorAll(".picker-field"))
const pickerInputs = Array.from(document.querySelectorAll("[data-picker]"))
const pickerPopover = document.querySelector("#pickerPopover")
const scheduleFields = Array.from(document.querySelectorAll("[data-schedule-field]"))
const startDateLabel = document.querySelector("#startDateLabel")

const PAGE_SIZE = 10
let activeFilter = "all"
let selectedId = ""
let takeovers = []
let selectedDetail = null
let loading = false
let loadingMore = false
let currentPage = 1
let totalTakeovers = 0
let adminMode = !!localStorage.getItem(ADMIN_TOKEN_KEY)
let selectedAvatarFile = null
let selectedAvatarObjectUrl = ""
let pendingBlockUser = null
const mobileDetailQuery = window.matchMedia("(max-width: 900px)")
let activePickerInput = null
let pickerMonth = new Date()
let loadMoreObserver = null

const getTakeoverTimeFilter = () => {
  if (activeFilter !== "range") return activeFilter
  return getPickerValue(rangeStartDate) || getPickerValue(rangeEndDate) ? "custom_range" : "date_range"
}

const syncRangeFilter = () => {
  rangeFilter.hidden = activeFilter !== "range"
}

const getToken = () => localStorage.getItem(TOKEN_KEY) || ""
const getAdminToken = () => localStorage.getItem(ADMIN_TOKEN_KEY) || ""
const getProfile = () => {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null")
  } catch {
    return null
  }
}

const escapeHtml = value =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

const showToast = message => {
  document.body.appendChild(toastEl)
  toastEl.textContent = message
  toastEl.classList.add("show")
  window.clearTimeout(showToast.timer)
  showToast.timer = window.setTimeout(() => toastEl.classList.remove("show"), 2800)
}

const defaultAvatarForGender = gender => DEFAULT_AVATAR[Number(gender) === 2 ? 2 : 1]
const updateAvatarPreview = src => {
  avatarPreview.src = src || defaultAvatarForGender(profileGender.value)
}

const padNumber = value => String(value).padStart(2, "0")
const formatDateValue = date => `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`
const parseDateValue = value => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

const displayDateValue = value => {
  const date = parseDateValue(value)
  return date ? `${date.getFullYear()}年${padNumber(date.getMonth() + 1)}月${padNumber(date.getDate())}日` : ""
}

const syncPickerDisplay = input => {
  if (!input) return
  const formatPattern = input.dataset.picker === "date" ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{2}:\d{2}$/
  const rawValue = input.dataset.value || (formatPattern.test(input.value) ? input.value : "")
  input.dataset.value = rawValue
  if (input.dataset.picker === "date") input.value = displayDateValue(rawValue)
  if (input.dataset.picker === "time") input.value = rawValue
}

const getPickerValue = input => input?.dataset.value || ""

const positionPickerPopover = input => {
  const rect = input.getBoundingClientRect()
  const dialog = input.closest("dialog")
  const containerRect = dialog ? dialog.getBoundingClientRect() : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
  const availableWidth = Math.max(280, Math.min(340, containerRect.width - 24, window.innerWidth - 24))
  const popoverHeight = pickerPopover.offsetHeight || 320
  const belowTop = rect.bottom - containerRect.top + 8
  const aboveTop = rect.top - containerRect.top - popoverHeight - 8
  const hasRoomBelow = rect.bottom + popoverHeight + 8 <= Math.min(window.innerHeight - 12, containerRect.bottom - 12)
  const hasRoomAbove = aboveTop >= 12
  const top = hasRoomBelow || !hasRoomAbove ? belowTop : aboveTop
  const left = Math.max(12, Math.min(rect.left - containerRect.left, containerRect.width - availableWidth - 12))

  pickerPopover.style.position = dialog ? "absolute" : "fixed"
  pickerPopover.style.width = `${availableWidth}px`
  pickerPopover.style.left = `${left}px`
  pickerPopover.style.top = `${Math.max(12, top)}px`
}

const currentPickerContainer = input => input.closest("dialog") || document.body

const renderActivePicker = () => {
  if (!activePickerInput) return
  if (activePickerInput.dataset.picker === "date") renderDatePicker()
  if (activePickerInput.dataset.picker === "time") renderTimePicker()
  positionPickerPopover(activePickerInput)
}

const closePickerPopover = () => {
  pickerPopover.hidden = true
  activePickerInput = null
}

const setPickerValue = (input, value) => {
  input.dataset.value = value || ""
  syncPickerDisplay(input)
  input.dispatchEvent(new Event("change", { bubbles: true }))
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

const renderDatePicker = () => {
  const selected = parseDateValue(getPickerValue(activePickerInput))
  const today = new Date()
  const year = pickerMonth.getFullYear()
  const month = pickerMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const leading = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = []
  for (let index = 0; index < leading; index += 1) days.push("")
  for (let day = 1; day <= daysInMonth; day += 1) days.push(day)
  while (days.length % 7) days.push("")

  pickerPopover.innerHTML = `
    <div class="picker-head">
      <button class="picker-nav" type="button" data-picker-nav="-1" aria-label="上个月">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>
      </button>
      <span>${year}年${padNumber(month + 1)}月</span>
      <button class="picker-nav" type="button" data-picker-nav="1" aria-label="下个月">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>
      </button>
    </div>
    <div class="date-weekdays">${["日", "一", "二", "三", "四", "五", "六"].map(day => `<span>${day}</span>`).join("")}</div>
    <div class="date-grid">
      ${days
        .map(day => {
          if (!day) return '<span class="date-cell empty-cell"></span>'
          const date = new Date(year, month, day)
          const value = formatDateValue(date)
          const active = selected && value === formatDateValue(selected)
          const isToday = value === formatDateValue(today)
          return `<button class="date-cell${active ? " active" : ""}${isToday ? " today" : ""}" type="button" data-picker-date="${value}">${day}</button>`
        })
        .join("")}
    </div>
    <div class="picker-footer">
      <button class="picker-link" type="button" data-picker-clear>清空</button>
      <button class="picker-link" type="button" data-picker-today>今天</button>
    </div>
  `
}

const renderTimePicker = () => {
  const [hour = "18", minute = "00"] = (getPickerValue(activePickerInput) || "18:00").split(":")
  const hours = Array.from({ length: 24 }, (_, index) => padNumber(index))
  const minutes = Array.from({ length: 12 }, (_, index) => padNumber(index * 5))
  pickerPopover.innerHTML = `
    <div class="time-grid">
      <div class="time-column" aria-label="小时">
        ${hours.map(item => `<button class="time-cell${item === hour ? " active" : ""}" type="button" data-picker-hour="${item}">${item}</button>`).join("")}
      </div>
      <div class="time-column" aria-label="分钟">
        ${minutes.map(item => `<button class="time-cell${item === minute ? " active" : ""}" type="button" data-picker-minute="${item}">${item}</button>`).join("")}
      </div>
    </div>
    <div class="picker-footer">
      <button class="picker-link" type="button" data-picker-now>此刻</button>
      <button class="picker-confirm" type="button" data-picker-confirm>确定</button>
    </div>
  `
}

const openPickerPopover = input => {
  activePickerInput = input
  const selectedDate = parseDateValue(getPickerValue(input))
  pickerMonth = selectedDate || new Date()
  currentPickerContainer(input).appendChild(pickerPopover)
  pickerPopover.hidden = false
  pickerPopover.dataset.type = input.dataset.picker
  renderActivePicker()
}

const setGender = gender => {
  profileGender.value = String(Number(gender) === 2 ? 2 : 1)
  genderOptions.forEach(option => {
    const active = option.dataset.gender === profileGender.value
    option.classList.toggle("active", active)
    option.setAttribute("aria-checked", String(active))
  })
  if (!selectedAvatarFile && !getProfile()?.avatarUrl) {
    updateAvatarPreview(defaultAvatarForGender(profileGender.value))
  }
}

const prepareRegisterForm = profile => {
  selectedAvatarFile = null
  if (selectedAvatarObjectUrl) URL.revokeObjectURL(selectedAvatarObjectUrl)
  selectedAvatarObjectUrl = ""
  registerForm.elements.nickname.value = profile?.nickname || ""
  registerForm.elements.steamId.value = profile?.steamId || loginForm.elements.steamId.value.trim() || ""
  setGender(profile?.gender || profileGender.value || 1)
  updateAvatarPreview(profile?.avatarUrl || defaultAvatarForGender(profile?.gender || profileGender.value))
}

const setScheduleFieldVisible = (field, visible) => {
  field.hidden = !visible
  field.querySelectorAll("input, textarea, button").forEach(control => {
    if (control.type !== "hidden") control.disabled = !visible
    if (control.matches?.('[data-picker="date"]')) control.required = visible
  })
}

const syncCreateScheduleFields = () => {
  const scheduleType = Number(scheduleTypeInput.value)
  const showStartDate = scheduleType !== 2
  const showEndDate = scheduleType === 3
  if (startDateLabel) startDateLabel.textContent = scheduleType === 3 ? "开始日期" : "日期"
  scheduleFields.forEach(field => {
    if (field.dataset.scheduleField === "startDate") setScheduleFieldVisible(field, showStartDate)
    if (field.dataset.scheduleField === "endDate") setScheduleFieldVisible(field, showEndDate)
  })
}

const normalizeCreateScheduleFields = () => {
  const scheduleType = Number(scheduleTypeInput.value)
  syncCreateScheduleFields()
  if (scheduleType === 1) setPickerValue(createForm.elements.endDate, "")
  if (scheduleType === 2) {
    setPickerValue(createForm.elements.startDate, "")
    setPickerValue(createForm.elements.endDate, "")
  }
}

const setScheduleType = value => {
  scheduleTypeInput.value = String([1, 2, 3].includes(Number(value)) ? Number(value) : 1)
  scheduleTypeOptions.forEach(option => {
    const active = option.dataset.value === scheduleTypeInput.value
    option.classList.toggle("active", active)
    option.setAttribute("aria-selected", String(active))
    if (active) scheduleTypeLabel.textContent = option.textContent.trim()
  })
  syncCreateScheduleFields()
}

const closeScheduleMenu = () => {
  scheduleTypeButton.classList.remove("open")
  scheduleTypeButton.setAttribute("aria-expanded", "false")
  scheduleTypeMenu.classList.remove("open")
}

const toggleScheduleMenu = () => {
  const open = !scheduleTypeMenu.classList.contains("open")
  scheduleTypeButton.classList.toggle("open", open)
  scheduleTypeButton.setAttribute("aria-expanded", String(open))
  scheduleTypeMenu.classList.toggle("open", open)
}

const closeAccountMenu = () => {
  accountDropdown.classList.remove("open")
  profileButton.setAttribute("aria-expanded", "false")
}

const toggleAccountMenu = () => {
  const open = !accountDropdown.classList.contains("open")
  accountDropdown.classList.toggle("open", open)
  profileButton.setAttribute("aria-expanded", String(open))
}

const setProfile = profile => {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  profileButton.textContent = profile?.nickname || "资料"
  sessionLabel.textContent = profile?.nickname ? `${profile.nickname} 的游戏窝` : "兔兔窝开车大厅"
  closeAccountMenu()
}

const clearProfile = () => {
  localStorage.removeItem(PROFILE_KEY)
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ADMIN_TOKEN_KEY)
  adminMode = false
  selectedId = ""
  selectedDetail = null
  profileButton.textContent = "登录"
  sessionLabel.textContent = "兔兔窝开车大厅"
  statusText.textContent = "用 SteamID 登录后，就可以创建接龙、加入队伍、同步小程序资料。"
}

const buildQuery = params => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, value)
  })
  return query.toString() ? `?${query.toString()}` : ""
}

const apiRequest = async (path, options = {}) => {
  const headers = new Headers(options.headers || {})
  const token = options.admin ? getAdminToken() : options.auth === false ? "" : getToken()
  if (options.json !== undefined) headers.set("Content-Type", "application/json")
  if (token) headers.set("Authorization", `Bearer ${token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
  })

  const text = await response.text()
  let body = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = { message: text }
    }
  }

  if (!response.ok || body?.success === false) {
    throw new Error(body?.message || body?.code || `璇锋眰澶辫触锛?{response.status}`)
  }

  return body && Object.prototype.hasOwnProperty.call(body, "data") ? body.data : body
}

const webLoginBySteamId = async steamId => {
  const result = await apiRequest("/api/auth/web-login", { method: "POST", json: { steamId }, auth: false })
  localStorage.setItem(TOKEN_KEY, result.token)
  setProfile(result.user)
  return result
}

const uploadAvatar = async file => {
  const form = new FormData()
  form.append("file", file)
  const result = await apiRequest("/api/uploads/image", { method: "POST", body: form })
  if (!result?.url) throw new Error("上传结果缺少图片地址")
  return result.url
}

const normalizeMember = member => ({
  userId: member.userId || member.id || "",
  nickname: member.nickname || "鐜╁",
  steamId: member.steamId || "",
  avatarUrl: member.avatarUrl || "",
  gender: member.gender || "",
  openid: member.openid || "",
})

const normalizeTakeover = (raw, index = 0) => {
  const members = (raw.members || raw.previewMembers || []).map(normalizeMember)
  const joined = Number(raw.joinedCount || raw.joined || members.length || 0)
  const limit = Number(raw.participantLimit || raw.limit || 0)
  const id = String(raw.id)

  return {
    id,
    title: raw.title || "未命名接龙",
    scheduleText: raw.scheduleText || raw.playTime || "待定",
    scheduleType: Number(raw.scheduleType || 1),
    startDate: raw.startDate || "",
    endDate: raw.endDate || "",
    playTime: raw.playTime || "",
    joined,
    limit,
    tag: raw.hasJoined ? "已加入" : limit && joined >= limit ? "已满" : `缺 ${Math.max(limit - joined, 0)}`,
    tone: tones[Number(id.replace(/\D/g, "")) % tones.length || index % tones.length],
    description: raw.description || "这个接龙还没有写介绍。",
    hasJoined: !!raw.hasJoined,
    members,
    host: members[0]?.nickname || "发起人",
  }
}

const iconSvg = tone => `<svg class="card-icon" viewBox="0 0 24 24" aria-hidden="true">${icons[tone]}</svg>`
const avatarText = member => escapeHtml((member.nickname || member || "玩家").slice(0, 2))
const memberAvatar = member =>
  member.avatarUrl
    ? `<img class="member-avatar" src="${escapeHtml(member.avatarUrl)}" alt="" />`
    : `<span class="member-avatar">${avatarText(member)}</span>`
const avatarMarkup = members =>
  members
    .slice(0, 5)
    .map(member => `<span class="avatar">${avatarText(member)}</span>`)
    .join("")

const ensureLogin = () => {
  if (getToken()) {
    const profile = getProfile()
    if (profile?.profileCompleted) return true
    prepareRegisterForm(profile)
    registerModal.showModal()
    showToast("请先完善资料")
    return false
  }
  profileModal.showModal()
  showToast("请先用 SteamID 登录")
  return false
}

const fetchProfile = async () => {
  if (!getToken()) return
  const profile = await apiRequest("/api/me/profile")
  setProfile(profile)
  if (profile?.blocked) statusText.textContent = "当前账号已被限制使用，无法查看和操作接龙。"
}

const hasMoreTakeovers = () => getToken() && totalTakeovers > 0 && takeovers.length < totalTakeovers

const syncPagination = () => {
  const hasMore = hasMoreTakeovers()
  if (loadMoreButton) {
    loadMoreButton.hidden = !hasMore && !loadingMore
    loadMoreButton.disabled = loading || loadingMore || !hasMore
    loadMoreButton.textContent = loadingMore ? "加载中..." : ""
  }
  if (!getToken()) return
  countEl.textContent = totalTakeovers > takeovers.length ? `${takeovers.length}/${totalTakeovers} 个接龙` : `${takeovers.length} 个接龙`
}

const fetchTakeovers = async ({ append = false } = {}) => {
  if (!getToken()) {
    takeovers = []
    totalTakeovers = 0
    currentPage = 1
    countEl.textContent = "未登录"
    listEl.innerHTML = '<div class="empty">登录后加载真实接龙列表。</div>'
    syncPagination()
    renderDetail(null)
    return
  }

  if (append && !hasMoreTakeovers()) {
    syncPagination()
    return
  }

  const nextPage = append ? currentPage + 1 : 1
  if (append) {
    loadingMore = true
  } else {
    loading = true
    countEl.textContent = "加载中"
    listEl.innerHTML = '<div class="empty">正在加载接龙列表...</div>'
  }
  syncPagination()

  try {
    const data = await apiRequest(
      `/api/takeovers${buildQuery({
        keyword: searchInput.value.trim(),
        timeFilter: getTakeoverTimeFilter(),
        startDate: activeFilter === "range" ? getPickerValue(rangeStartDate) : "",
        endDate: activeFilter === "range" ? getPickerValue(rangeEndDate) : "",
        page: nextPage,
        pageSize: PAGE_SIZE,
      })}`,
    )
    const list = Array.isArray(data) ? data : data?.list || []
    const normalized = list.map(normalizeTakeover)
    totalTakeovers = Number(Array.isArray(data) ? normalized.length : data?.total ?? normalized.length)
    currentPage = nextPage
    takeovers = append ? [...takeovers, ...normalized] : normalized
    if (!append && (!selectedId || !takeovers.some(item => item.id === selectedId))) selectedId = takeovers[0]?.id || ""
    renderList()
    syncPagination()
    if (!append && selectedId) await fetchDetail(selectedId)
  } catch (error) {
    if (append) {
      showToast(error.message)
    } else {
      listEl.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`
      renderDetail(null)
    }
  } finally {
    loading = false
    loadingMore = false
    syncPagination()
  }
}

const fetchDetail = async id => {
  if (!id || !getToken()) return
  try {
    const path = adminMode ? `/api/admin/takeovers/${id}` : `/api/takeovers/${id}`
    const detail = await apiRequest(path, { admin: adminMode })
    selectedDetail = normalizeTakeover(detail)
    selectedDetail.members = (detail.members || detail.previewMembers || []).map(normalizeMember)
    renderDetail(selectedDetail)
    return selectedDetail
  } catch (error) {
    showToast(error.message)
    return null
  }
}

const renderList = () => {
  syncPagination()
  if (!takeovers.length) {
    listEl.innerHTML = `<div class="empty">${loading ? "加载中" : "暂无接龙，来创建一个。"}</div>`
    return
  }

  listEl.innerHTML = takeovers
    .map(
      item => `
        <button class="takeover-card ${item.id === selectedId ? "selected" : ""}" type="button" data-id="${escapeHtml(item.id)}">
          <span class="card-art tone-${item.tone}">${iconSvg(item.tone)}</span>
          <span class="card-main">
            <span class="card-title-row">
              <h3>${escapeHtml(item.title)}</h3>
              <span class="badge">${escapeHtml(item.tag)}</span>
            </span>
            <span class="card-description">${escapeHtml(item.description)}</span>
            <span class="card-meta">
              <span class="meta-pill">${escapeHtml(item.scheduleText)}</span>
              <span class="meta-pill">${escapeHtml(item.host)} 发起</span>
            </span>
          </span>
          <span class="card-side">
            <span class="join-count">${item.joined}<span>/${item.limit || "-"}</span></span>
            <span class="avatars">${avatarMarkup(item.members)}</span>
          </span>
        </button>
      `,
    )
    .join("")
}

const detailIcon = path => `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`

const adminActionMarkup = () =>
  adminMode
    ? `
        <button class="secondary-action" type="button" data-action="blocked-users">黑名单管理</button>
        <button class="secondary-action" type="button" data-action="admin-exit">退出管理员</button>
        <button class="secondary-action" type="button" data-action="edit">编辑接龙</button>
        <button class="danger-action" type="button" data-action="delete">删除接龙</button>
      `
    : '<button class="secondary-action" type="button" data-action="admin">管理员操作</button>'

const detailMarkup = item => {
  if (!item) return '<div class="empty">这里会显示选中接龙的详情。</div>'

  const members = item.members || []
  const joinButton = item.hasJoined
    ? '<button class="danger-action wide" type="button" data-action="leave">退出接龙</button>'
    : '<button class="primary-action wide" type="button" data-action="join">加入接龙</button>'

  return `
    <div class="detail-hero tone-${item.tone}">
      <div class="detail-kicker">
        <span>${escapeHtml(item.scheduleText)}</span>
        <span>${item.joined}/${item.limit || "-"}</span>
      </div>
      <h2>${escapeHtml(item.title)}</h2>
      <p>${escapeHtml(item.description)}</p>
    </div>
    <div class="detail-body">
      <div class="detail-meta">
        <div class="detail-meta-item">
          <span class="detail-meta-icon">${detailIcon('<path d="M8 2v4M16 2v4M3 10h18"></path><rect x="3" y="4" width="18" height="18" rx="4"></rect>')}</span>
          <span><span class="detail-label">开车时间</span><span class="detail-value">${escapeHtml(item.scheduleText)}</span></span>
        </div>
        <div class="detail-meta-item">
          <span class="detail-meta-icon">${detailIcon('<path d="M20 21a8 8 0 0 0-16 0"></path><circle cx="12" cy="7" r="4"></circle>')}</span>
          <span><span class="detail-label">发起人</span><span class="detail-value">${escapeHtml(item.host)}</span></span>
        </div>
        <div class="detail-meta-item">
          <span class="detail-meta-icon">${detailIcon('<path d="M6 11h12M8 7h8M9 15h6"></path><rect x="4" y="3" width="16" height="18" rx="4"></rect>')}</span>
          <span><span class="detail-label">状态</span><span class="detail-value">${escapeHtml(item.tag)}</span></span>
        </div>
      </div>
      <div class="detail-actions">
        ${joinButton}
        ${adminActionMarkup()}
      </div>
      <div class="detail-members">
        <h3>队伍成员</h3>
        <div class="member-list">
          ${
            members.length
              ? members
                  .map(
                    member => `
                      <div class="member-row">
                        ${memberAvatar(member)}
                        <span class="member-info">
                          <span class="member-name">${escapeHtml(member.nickname)}</span>
                          <span class="member-steam">SteamID：${escapeHtml(member.steamId || "未填写")}</span>
                        </span>
                        <span class="member-actions">
                          ${
                            member.steamId
                              ? `<button class="tiny-action" type="button" data-copy-steam="${escapeHtml(member.steamId)}">复制</button>`
                              : ""
                          }
                           ${adminMode && member.userId ? `<button class="tiny-action" type="button" data-block="${escapeHtml(member.userId)}">拉黑</button>` : ""}
                        </span>
                      </div>
                    `,
                  )
                  .join("")
              : '<span class="meta-pill">暂无成员</span>'
          }
        </div>
      </div>
    </div>
  `
}

const renderDetail = item => {
  const markup = detailMarkup(item)
  detailEl.innerHTML = markup
  if (detailModal.open || mobileDetailQuery.matches) detailModalContent.innerHTML = markup
}

const openMobileDetail = () => {
  if (!mobileDetailQuery.matches || !selectedDetail) return
  detailModalContent.innerHTML = detailMarkup(selectedDetail)
  detailModal.showModal()
}

const handleDetailAction = event => {
  const action = event.target.closest("[data-action]")?.dataset.action
  if (action === "join") joinSelected()
  if (action === "leave") leaveSelected()
  if (action === "admin") {
    adminModal.showModal()
  }
  if (action === "blocked-users") openBlockedUsers()
  if (action === "admin-exit") exitAdminMode()
  if (action === "delete") deleteSelected()
  if (action === "edit") editSelected()
  const steamId = event.target.closest("[data-copy-steam]")?.dataset.copySteam
  if (steamId) copySteamId(steamId)
  const blockButton = event.target.closest("[data-block]")
  if (blockButton) openBlockConfirm(blockButton.dataset.block)
}

const closeMobileDetailAfterRefresh = () => {
  if (detailModal.open && !mobileDetailQuery.matches) detailModal.close()
}

const submitLogin = async event => {
  event.preventDefault()
  const steamId = new FormData(loginForm).get("steamId").trim()
  try {
    const result = await webLoginBySteamId(steamId)
    profileModal.close()
    if (!result.user?.profileCompleted) {
      prepareRegisterForm({ steamId })
      registerModal.showModal()
      showToast("请完善资料后完成注册")
      return
    }
    showToast("登录成功")
    await fetchTakeovers()
  } catch (error) {
    showToast(error.message)
  }
}

const submitRegister = async event => {
  event.preventDefault()
  const formData = new FormData(registerForm)
  let avatarUrl = getProfile()?.avatarUrl || defaultAvatarForGender(formData.get("gender"))
  try {
    if (selectedAvatarFile && !getToken()) await webLoginBySteamId(formData.get("steamId").trim())
    if (selectedAvatarFile) avatarUrl = await uploadAvatar(selectedAvatarFile)
    const payload = {
      nickname: formData.get("nickname").trim(),
      steamId: formData.get("steamId").trim(),
      gender: Number(formData.get("gender")),
      avatarUrl,
    }
    const result = await apiRequest("/api/auth/web-login", { method: "POST", json: payload, auth: false })
    localStorage.setItem(TOKEN_KEY, result.token)
    setProfile(result.user)
    selectedAvatarFile = null
    registerModal.close()
    profileModal.close()
    loginForm.elements.steamId.value = payload.steamId
    showToast("注册成功")
    await fetchTakeovers()
  } catch (error) {
    showToast(error.message)
  }
}

const submitCreate = async event => {
  event.preventDefault()
  if (!ensureLogin()) return
  normalizeCreateScheduleFields()
  const formData = new FormData(createForm)
  const scheduleType = Number(formData.get("scheduleType"))
  const payload = {
    title: formData.get("title").trim(),
    participantLimit: Number(formData.get("participantLimit")),
    scheduleType,
    startDate: scheduleType === 2 ? null : getPickerValue(createForm.elements.startDate) || null,
    endDate: scheduleType === 3 ? getPickerValue(createForm.elements.endDate) || null : null,
    playTime: getPickerValue(createForm.elements.playTime),
    description: formData.get("description").trim(),
  }

  try {
    if (createForm.dataset.editingId) {
      await apiRequest(`/api/admin/takeovers/${createForm.dataset.editingId}`, { method: "PUT", json: payload, admin: true })
      delete createForm.dataset.editingId
      showToast("接龙已保存")
    } else {
      await apiRequest("/api/takeovers", { method: "POST", json: payload })
      showToast("接龙创建成功")
    }
    createModal.close()
    createForm.reset()
    createForm.querySelectorAll("[data-picker]").forEach(input => setPickerValue(input, ""))
    setScheduleType(1)
    normalizeCreateScheduleFields()
    await fetchTakeovers()
  } catch (error) {
    showToast(error.message)
  }
}

const joinSelected = async () => {
  if (!ensureLogin() || !selectedId) return
  try {
    await apiRequest(`/api/takeovers/${selectedId}/join`, { method: "POST" })
    showToast("已加入接龙")
    await fetchTakeovers()
  } catch (error) {
    showToast(error.message)
  }
}

const leaveSelected = async () => {
  if (!ensureLogin() || !selectedId) return
  if (!window.confirm("确定退出这个接龙吗？")) return
  try {
    await apiRequest(`/api/takeovers/${selectedId}/leave`, { method: "POST" })
    showToast("已退出接龙")
    await fetchTakeovers()
  } catch (error) {
    showToast(error.message)
  }
}

const copySteamId = async steamId => {
  if (!steamId) return
  try {
    await navigator.clipboard.writeText(steamId)
    showToast("SteamID 已复制")
  } catch {
    const input = document.createElement("input")
    input.value = steamId
    document.body.appendChild(input)
    input.select()
    document.execCommand("copy")
    input.remove()
    showToast("SteamID 已复制")
  }
}

const submitAdmin = async event => {
  event.preventDefault()
  const password = new FormData(adminForm).get("password")
  try {
    const result = await apiRequest("/api/admin/login", { method: "POST", json: { password }, auth: false })
    localStorage.setItem(ADMIN_TOKEN_KEY, result.adminToken || result.token)
    adminMode = true
    adminModal.close()
    showToast("管理员模式已开启")
    if (selectedId) await fetchDetail(selectedId)
  } catch (error) {
    showToast(error.message)
  }
}

const exitAdminMode = async () => {
  localStorage.removeItem(ADMIN_TOKEN_KEY)
  adminMode = false
  adminModal.close()
  if (blockedUsersModal.open) blockedUsersModal.close()
  blockedPanel.innerHTML = ""
  blockedUsersPanel.innerHTML = ""
  showToast("已退出管理员模式")
  if (selectedId) await fetchDetail(selectedId)
}

const editSelected = () => {
  if (!selectedDetail || !getAdminToken()) return
  createForm.dataset.editingId = selectedDetail.id
  createForm.elements.title.value = selectedDetail.title
  createForm.elements.participantLimit.value = selectedDetail.limit || 4
  setScheduleType(selectedDetail.scheduleType || 1)
  setPickerValue(createForm.elements.startDate, selectedDetail.startDate || "")
  setPickerValue(createForm.elements.endDate, selectedDetail.endDate || "")
  setPickerValue(createForm.elements.playTime, selectedDetail.playTime || "")
  createForm.elements.description.value = selectedDetail.description || ""
  syncCreateScheduleFields()
  createModal.showModal()
}

const deleteSelected = async () => {
  if (!selectedId || !getAdminToken()) return
  if (!window.confirm("确定删除这个接龙吗？")) return
  try {
    await apiRequest(`/api/admin/takeovers/${selectedId}`, { method: "DELETE", admin: true })
    showToast("已删除")
    selectedId = ""
    await fetchTakeovers()
  } catch (error) {
    showToast(error.message)
  }
}

const openBlockConfirm = userId => {
  if (!userId || !getAdminToken()) return
  const member = selectedDetail?.members?.find(item => String(item.userId) === String(userId))
  pendingBlockUser = member || { userId }
  blockTargetText.textContent = member
    ? `将拉黑：${member.nickname || "未命名用户"}（SteamID：${member.steamId || "未填写"}）`
    : `将拉黑用户 ID：${userId}`
  blockConfirmForm.reset()
  blockConfirmForm.elements.reason.value = "web 管理操作"
  blockConfirmModal.showModal()
}

const blockUser = async (userId, reason) => {
  if (!userId || !getAdminToken()) return
  try {
    await apiRequest(`/api/admin/users/${userId}/block`, { method: "POST", json: { reason }, admin: true })
    showToast("已拉黑用户")
    if (selectedDetail?.members) {
      selectedDetail.members = selectedDetail.members.filter(member => String(member.userId) !== String(userId))
      selectedDetail.joined = selectedDetail.members.length
      renderDetail(selectedDetail)
    }
    await fetchTakeovers()
    await fetchDetail(selectedId)
    if (blockedUsersModal.open) await fetchBlockedUsers()
  } catch (error) {
    showToast(error.message)
  }
}

const submitBlockConfirm = async event => {
  event.preventDefault()
  if (!pendingBlockUser?.userId) return
  const reason = new FormData(blockConfirmForm).get("reason").trim()
  if (!reason) {
    showToast("请填写拉黑原因")
    return
  }
  await blockUser(pendingBlockUser.userId, reason)
  pendingBlockUser = null
  blockConfirmModal.close()
}

const unblockUser = async userId => {
  if (!userId || !getAdminToken()) return
  if (!window.confirm("确定移除该用户的拉黑状态吗？移除后对方将恢复接龙查看和操作权限。")) return
  try {
    await apiRequest(`/api/admin/users/${userId}/unblock`, { method: "POST", admin: true })
    showToast("已解除拉黑")
    await fetchBlockedUsers()
    if (selectedId) await fetchDetail(selectedId)
  } catch (error) {
    showToast(error.message)
  }
}

const blockedUsersMarkup = list =>
  list.length
    ? `<p class="form-note">共 ${list.length} 个拉黑用户</p>${list
        .map(
          user => `
            <div class="blocked-row">
              <span class="blocked-info">
                <strong>${escapeHtml(user.nickname || user.steamId || user.userId)}</strong>
                <small>${escapeHtml(user.steamId || "未填写 SteamID")}${user.reason ? ` · ${escapeHtml(user.reason)}` : ""}</small>
              </span>
              <button class="tiny-action" type="button" data-unblock="${escapeHtml(user.userId)}">移除拉黑</button>
            </div>
          `,
        )
        .join("")}`
    : '<p class="form-note">暂无黑名单用户</p>'

const openBlockedUsers = async () => {
  if (!getAdminToken()) return
  if (blockedSearchInput) blockedSearchInput.value = ""
  blockedUsersPanel.innerHTML = '<p class="form-note">正在加载黑名单...</p>'
  blockedUsersModal.showModal()
  await fetchBlockedUsers()
}

const fetchBlockedUsers = async () => {
  if (!getAdminToken()) {
    if (blockedPanel) blockedPanel.innerHTML = ""
    if (blockedUsersPanel) blockedUsersPanel.innerHTML = ""
    return
  }
  try {
    const data = await apiRequest(
      `/api/admin/blocked-users${buildQuery({ keyword: blockedSearchInput?.value.trim() || "" })}`,
      { admin: true },
    )
    const list = data?.list || []
    blockedUsersPanel.innerHTML = blockedUsersMarkup(list)
  } catch (error) {
    blockedUsersPanel.innerHTML = `<p class="form-note">${escapeHtml(error.message)}</p>`
  }
}

listEl.addEventListener("click", async event => {
  const card = event.target.closest(".takeover-card")
  if (!card) return
  selectedId = card.dataset.id
  renderList()
  const detail = await fetchDetail(selectedId)
  if (detail) openMobileDetail()
})

loadMoreButton?.addEventListener("click", () => {
  if (!loading && !loadingMore && hasMoreTakeovers()) fetchTakeovers({ append: true })
})

if (loadMoreButton && "IntersectionObserver" in window) {
  loadMoreObserver = new IntersectionObserver(
    entries => {
      const [entry] = entries
      if (entry?.isIntersecting && !loadMoreButton.hidden && !loadMoreButton.disabled && !loading && !loadingMore && hasMoreTakeovers()) {
        fetchTakeovers({ append: true })
      }
    },
    { rootMargin: "220px 0px" },
  )
  loadMoreObserver.observe(loadMoreButton)
}

detailEl.addEventListener("click", handleDetailAction)
detailModalContent.addEventListener("click", handleDetailAction)
mobileDetailQuery.addEventListener("change", closeMobileDetailAfterRefresh)

blockedUsersPanel?.addEventListener("click", event => {
  const userId = event.target.closest("[data-unblock]")?.dataset.unblock
  if (userId) unblockUser(userId)
})

let blockedSearchTimer = 0
blockedSearchInput?.addEventListener("input", () => {
  window.clearTimeout(blockedSearchTimer)
  blockedSearchTimer = window.setTimeout(fetchBlockedUsers, 260)
})

filterButtons.forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter
    filterButtons.forEach(item => item.classList.toggle("active", item === button))
    syncRangeFilter()
    fetchTakeovers()
  })
})

rangeStartDate.addEventListener("change", () => {
  if (getPickerValue(rangeEndDate) && getPickerValue(rangeStartDate) > getPickerValue(rangeEndDate)) {
    setPickerValue(rangeEndDate, getPickerValue(rangeStartDate))
  }
  fetchTakeovers()
})

rangeEndDate.addEventListener("change", () => {
  if (getPickerValue(rangeStartDate) && getPickerValue(rangeEndDate) < getPickerValue(rangeStartDate)) {
    setPickerValue(rangeStartDate, getPickerValue(rangeEndDate))
  }
  fetchTakeovers()
})

clearRangeFilter.addEventListener("click", () => {
  setPickerValue(rangeStartDate, "")
  setPickerValue(rangeEndDate, "")
  fetchTakeovers()
})

let searchTimer = 0
searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(fetchTakeovers, 260)
})

themeToggle.addEventListener("click", () => {
  const nextTheme = app.dataset.theme === "light" ? "dark" : "light"
  app.dataset.theme = nextTheme
  document.body.dataset.theme = nextTheme
  themeToggle.setAttribute("aria-label", nextTheme === "light" ? "切换深色模式" : "切换亮色模式")
})

profileButton.addEventListener("click", () => {
  const profile = getProfile()
  if (getToken()) {
    toggleAccountMenu()
    return
  }
  loginForm.elements.steamId.value = profile?.steamId || loginForm.elements.steamId.value || ""
  closeAccountMenu()
  profileModal.showModal()
})

accountDropdown.addEventListener("click", async event => {
  const action = event.target.closest("[data-account-action]")?.dataset.accountAction
  if (!action) return
  closeAccountMenu()
  if (action === "profile") {
    prepareRegisterForm(getProfile())
    registerModal.showModal()
  }
  if (action === "logout") {
    clearProfile()
    showToast("操作成功")
    await fetchTakeovers()
  }
})

openRegisterButton.addEventListener("click", () => {
  prepareRegisterForm(getProfile())
  profileModal.close()
  registerModal.showModal()
})

genderOptions.forEach(option => {
  option.addEventListener("click", () => setGender(option.dataset.gender))
})

scheduleTypeButton.addEventListener("click", toggleScheduleMenu)

scheduleTypeOptions.forEach(option => {
  option.addEventListener("click", () => {
    setScheduleType(option.dataset.value)
    normalizeCreateScheduleFields()
    closeScheduleMenu()
  })
})

document.addEventListener("click", event => {
  if (!event.target.closest(".select-field")) closeScheduleMenu()
  if (!event.target.closest("#accountMenu")) closeAccountMenu()
  if (!event.target.closest(".picker-field") && !event.target.closest("#pickerPopover") && !event.target.closest(".range-filter label")) {
    closePickerPopover()
  }
})

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeScheduleMenu()
  if (event.key === "Escape") closeAccountMenu()
  if (event.key === "Escape") closePickerPopover()
})

avatarInput.addEventListener("change", () => {
  const [file] = avatarInput.files || []
  selectedAvatarFile = file || null
  if (selectedAvatarObjectUrl) URL.revokeObjectURL(selectedAvatarObjectUrl)
  selectedAvatarObjectUrl = file ? URL.createObjectURL(file) : ""
  updateAvatarPreview(selectedAvatarObjectUrl || defaultAvatarForGender(profileGender.value))
})

stepperButtons.forEach(button => {
  button.addEventListener("click", () => {
    const input = button.closest(".stepper-field")?.querySelector("input")
    if (!input) return
    const min = Number(input.min || 0)
    const max = Number(input.max || 999)
    const next = Number(input.value || min) + (button.dataset.stepper === "up" ? 1 : -1)
    input.value = String(Math.min(max, Math.max(min, next)))
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
})

pickerFields.forEach(field => {
  const input = field.querySelector("input")
  field.addEventListener("click", event => {
    if (!input || event.target === input) return
    openPickerPopover(input)
  })
})

pickerInputs.forEach(input => {
  syncPickerDisplay(input)
  input.addEventListener("click", () => openPickerPopover(input))
  input.addEventListener("focus", () => openPickerPopover(input))
})

pickerPopover.addEventListener("click", event => {
  const nav = event.target.closest("[data-picker-nav]")?.dataset.pickerNav
  if (nav) {
    pickerMonth = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + Number(nav), 1)
    renderActivePicker()
    return
  }

  const dateValue = event.target.closest("[data-picker-date]")?.dataset.pickerDate
  if (dateValue && activePickerInput) {
    setPickerValue(activePickerInput, dateValue)
    closePickerPopover()
    return
  }

  if (event.target.closest("[data-picker-today]") && activePickerInput) {
    setPickerValue(activePickerInput, formatDateValue(new Date()))
    closePickerPopover()
    return
  }

  if (event.target.closest("[data-picker-clear]") && activePickerInput) {
    setPickerValue(activePickerInput, "")
    closePickerPopover()
    return
  }

  const hour = event.target.closest("[data-picker-hour]")?.dataset.pickerHour
  if (hour && activePickerInput) {
    const minute = (getPickerValue(activePickerInput) || "18:00").split(":")[1] || "00"
    setPickerValue(activePickerInput, `${hour}:${minute}`)
    renderActivePicker()
    return
  }

  const minute = event.target.closest("[data-picker-minute]")?.dataset.pickerMinute
  if (minute && activePickerInput) {
    const hourValue = (getPickerValue(activePickerInput) || "18:00").split(":")[0] || "18"
    setPickerValue(activePickerInput, `${hourValue}:${minute}`)
    renderActivePicker()
    return
  }

  if (event.target.closest("[data-picker-now]") && activePickerInput) {
    const now = new Date()
    setPickerValue(activePickerInput, `${padNumber(now.getHours())}:${padNumber(now.getMinutes())}`)
    renderActivePicker()
    return
  }

  if (event.target.closest("[data-picker-confirm]")) closePickerPopover()
})

createButton.addEventListener("click", () => {
  if (ensureLogin()) {
    setScheduleType(scheduleTypeInput.value || 1)
    normalizeCreateScheduleFields()
    closeScheduleMenu()
    createModal.showModal()
  }
})

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.close}`)?.close())
})

loginForm.addEventListener("submit", submitLogin)
registerForm.addEventListener("submit", submitRegister)
createForm.addEventListener("submit", submitCreate)
adminForm.addEventListener("submit", submitAdmin)
blockConfirmForm?.addEventListener("submit", submitBlockConfirm)

blockConfirmModal?.addEventListener("close", () => {
  pendingBlockUser = null
})

const bootstrap = async () => {
  const profile = getProfile()
  if (profile) setProfile(profile)
  document.body.dataset.theme = app.dataset.theme || "light"
  syncRangeFilter()
  normalizeCreateScheduleFields()
  if (getToken()) await fetchProfile().catch(error => showToast(error.message))
  await fetchTakeovers()
}

bootstrap()
