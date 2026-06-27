export {}

import { apiRequest } from '../../utils/api'

type KookChannelNode = {
  id: string
  name: string
}

type KookChannelOption = {
  id: string
  name: string
  label: string
}

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
      apiRequest<{ list?: KookChannelNode[] }>('/api/kook/channels/all?type=2')
        .then(result => {
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
        })
        .catch(error => {
          wx.showToast({ title: error.message || '频道加载失败', icon: 'none' })
        })
        .finally(() => {
          this.setData({ isLoading: false })
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
