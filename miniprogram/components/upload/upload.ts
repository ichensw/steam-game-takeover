Component({
  properties: {
    images: {
      type: Array,
      value: [],
    },
    maxCount: {
      type: Number,
      value: 1,
    },
    isUploading: {
      type: Boolean,
      value: false,
    },
  },

  methods: {
    choose() {
      if (this.data.isUploading) return
      this.triggerEvent('choose', { count: Math.max(1, Number(this.data.maxCount) - this.data.images.length) })
    },
    remove(event: WechatMiniprogram.TouchEvent) {
      this.triggerEvent('remove', { index: event.currentTarget.dataset.index })
    },
    preview(event: WechatMiniprogram.TouchEvent) {
      this.triggerEvent('preview', { index: event.currentTarget.dataset.index })
    },
  },
})
