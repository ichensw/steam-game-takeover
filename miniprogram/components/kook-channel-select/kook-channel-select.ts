export {}

type KookChannelNode = {
  id: string
  name: string
}

type KookChannelOption = {
  id: string
  name: string
  label: string
}

type ApiResponse<T> = {
  success?: boolean
  code?: string
  message?: string
  data?: T
}

const API_BASE_URL = 'https://rabbits.ink/miniprogram-api'
const TOKEN_KEY = 'steam_takeover_token'

const filterOptions = (options: KookChannelOption[], keyword: string) => {
  const normalizedKeyword = keyword.trim().toLowerCase()
  if (!normalizedKeyword) return options
  return options.filter(item => item.label.toLowerCase().includes(normalizedKeyword))
}

Component({
  properties: {
    value: {
      type: String,
      value: '',
    },
    label: {
      type: String,
      value: '',
      observer(value: string) {
        this.setData({
          searchText: value || '',
          filteredOptions: filterOptions(this.data.options, value || ''),
        })
      },
    },
  },

  data: {
    searchText: '',
    options: [] as KookChannelOption[],
    filteredOptions: [] as KookChannelOption[],
    showDropdown: false,
    isLoading: false,
  },

  lifetimes: {
    attached() {
      this.setData({ searchText: this.properties.label || '' })
    },
  },

  methods: {
    noop() {},

    openDropdown() {
      this.setData({ showDropdown: true })
      if (!this.data.options.length) {
        this.loadChannels()
      }
    },

    closeDropdown() {
      this.setData({ showDropdown: false })
    },

    loadChannels() {
      if (this.data.isLoading) return

      this.setData({ isLoading: true })
      const token = wx.getStorageSync(TOKEN_KEY) as string
      const header: WechatMiniprogram.IAnyObject = {
        'content-type': 'application/json',
      }
      if (token) {
        header.Authorization = `Bearer ${token}`
      }

      wx.request<WechatMiniprogram.IAnyObject>({
        url: `${API_BASE_URL}/api/kook/channels/all?type=2`,
        method: 'GET',
        header,
        success: response => {
          const body = response.data as ApiResponse<{ list?: KookChannelNode[] }>
          if (response.statusCode < 200 || response.statusCode >= 300 || body.success === false) {
            wx.showToast({ title: body.message || '频道加载失败', icon: 'none' })
            return
          }

          const result = body.data || (response.data as { list?: KookChannelNode[] })
          const list = result && Array.isArray(result.list) ? result.list : []
          const options = list.map(channel => ({
            id: channel.id,
            name: channel.name,
            label: channel.name,
          }))
          this.setData({
            options,
            filteredOptions: filterOptions(options, this.data.searchText),
          })
        },
        fail: () => {
          wx.showToast({ title: '频道加载失败', icon: 'none' })
        },
        complete: () => {
          this.setData({ isLoading: false })
        },
      })
    },

    handleSearchInput(event: WechatMiniprogram.Input) {
      const keyword = String(event.detail.value || '')
      this.setData({
        searchText: keyword,
        filteredOptions: filterOptions(this.data.options, keyword),
        showDropdown: true,
      })
      this.triggerEvent('change', { id: '', name: '', label: keyword })
    },

    selectChannel(event: WechatMiniprogram.TouchEvent) {
      const id = String(event.currentTarget.dataset.id || '')
      const selected = this.data.options.find(item => item.id === id)
      if (!selected) return

      this.setData({
        searchText: selected.label,
        showDropdown: false,
      })
      this.triggerEvent('change', selected)
    },

    clearChannel() {
      this.setData({
        searchText: '',
        filteredOptions: this.data.options,
        showDropdown: false,
      })
      this.triggerEvent('change', { id: '', name: '', label: '' })
    },
  },
})
