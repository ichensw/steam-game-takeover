Component({
  properties: {
    takeover: {
      type: Object,
      value: {},
    },
  },

  methods: {
    handleTap() {
      this.triggerEvent('tapcard', { id: this.data.takeover.id })
    },
  },
})
