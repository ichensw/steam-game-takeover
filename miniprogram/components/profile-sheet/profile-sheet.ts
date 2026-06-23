Component({
  properties: {
    visible: { type: Boolean, value: false },
    mode: { type: String, value: 'complete' },
    nickname: { type: String, value: '' },
    steamId: { type: String, value: '' },
    steamIdLocked: { type: Boolean, value: false },
    gender: { type: String, value: '' },
    avatarUrl: { type: String, value: '' },
    maleAvatarUrl: { type: String, value: '' },
    femaleAvatarUrl: { type: String, value: '' },
    nicknameError: { type: String, value: '' },
    steamIdError: { type: String, value: '' },
    genderError: { type: String, value: '' },
    isUploading: { type: Boolean, value: false },
    isSaving: { type: Boolean, value: false },
  },

  methods: {
    close() {
      this.triggerEvent('close')
    },

    chooseAvatar() {
      this.triggerEvent('chooseavatar')
    },

    selectGender(event: WechatMiniprogram.TouchEvent) {
      this.triggerEvent('selectgender', { gender: event.currentTarget.dataset.gender })
    },

    handleNicknameInput(event: WechatMiniprogram.Input) {
      this.triggerEvent('nicknameinput', { value: event.detail.value })
    },

    handleSteamIdInput(event: WechatMiniprogram.Input) {
      this.triggerEvent('steamidinput', { value: event.detail.value })
    },

    save() {
      this.triggerEvent('save')
    },
  },
})
