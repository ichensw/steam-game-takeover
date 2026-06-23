Component({
  properties: {
    mode: {
      type: String,
      value: 'date',
    },
    value: {
      type: String,
      value: '',
    },
    placeholder: {
      type: String,
      value: '请选择',
    },
    start: {
      type: String,
      value: '',
    },
    end: {
      type: String,
      value: '',
    },
  },

  methods: {
    handleChange(event: WechatMiniprogram.PickerChange) {
      this.triggerEvent('change', { value: event.detail.value })
    },
  },
})
