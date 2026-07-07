import { apiRequest, getUserToken, uploadImage } from '../../utils/api'
import { enableShareMenu, HOME_SHARE_TITLE } from '../../utils/share'

type FeedbackType = 'suggestion' | 'problem' | 'experience' | 'other'

const PROFILE_BG_URL = 'https://wechat-bot-images.oss-cn-hangzhou.aliyuncs.com/miniapp/uploads/2026/06/220-1782216063196384700-57523733eb66.png'
const FEEDBACK_IMAGE_UPLOAD_PATH = '/api/user-feedback/images'

Page({
  data: {
    backgroundUrl: PROFILE_BG_URL,
    feedbackTypes: [
      { label: '功能建议', value: 'suggestion' },
      { label: '问题反馈', value: 'problem' },
      { label: '体验吐槽', value: 'experience' },
      { label: '其他', value: 'other' },
    ],
    feedbackType: 'suggestion' as FeedbackType,
    content: '',
    contact: '',
    images: [] as string[],
    isUploading: false,
    isSubmitting: false,
  },

  onLoad() {
    enableShareMenu()
    if (!getUserToken()) {
      wx.redirectTo({ url: '/pages/index/index' })
    }
  },

  onShareAppMessage() {
    return {
      title: `意见反馈 - ${HOME_SHARE_TITLE}`,
      path: '/pages/feedback/feedback',
    }
  },

  onShareTimeline() {
    return {
      title: HOME_SHARE_TITLE,
      query: '',
    }
  },

  selectFeedbackType(event: WechatMiniprogram.TouchEvent) {
    const feedbackType = event.currentTarget.dataset.value as FeedbackType
    if (!['suggestion', 'problem', 'experience', 'other'].includes(feedbackType)) return
    this.setData({ feedbackType })
  },

  handleContentInput(event: WechatMiniprogram.Input) {
    this.setData({ content: String(event.detail.value || '') })
  },

  handleContactInput(event: WechatMiniprogram.Input) {
    this.setData({ contact: String(event.detail.value || '') })
  },

  chooseImages(event: WechatMiniprogram.CustomEvent<{ count?: number }>) {
    if (this.data.isUploading) return
    const count = Math.min(Number(event.detail.count || 1), 3 - this.data.images.length)
    if (count <= 0) return

    wx.chooseMedia({
      count,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: result => {
        const files = result.tempFiles.map(file => file.tempFilePath).filter(Boolean)
        if (!files.length) return

        this.setData({ isUploading: true })
        Promise.all(files.map(filePath => uploadImage(filePath, FEEDBACK_IMAGE_UPLOAD_PATH)))
          .then(urls => this.setData({ images: [...this.data.images, ...urls].slice(0, 3) }))
          .catch(error => wx.showToast({ title: error.message || '图片上传失败', icon: 'none' }))
          .finally(() => this.setData({ isUploading: false }))
      },
    })
  },

  removeImage(event: WechatMiniprogram.CustomEvent<{ index?: number }>) {
    const index = Number(event.detail.index)
    if (Number.isNaN(index)) return
    this.setData({ images: this.data.images.filter((_, itemIndex) => itemIndex !== index) })
  },

  previewImage(event: WechatMiniprogram.CustomEvent<{ index?: number }>) {
    const index = Number(event.detail.index || 0)
    const current = this.data.images[index]
    if (!current) return
    wx.previewImage({ current, urls: this.data.images })
  },

  submitFeedback() {
    const content = this.data.content.trim()
    const contact = this.data.contact.trim()

    if (!content) {
      wx.showToast({ title: '请输入反馈内容', icon: 'none' })
      return
    }
    if (content.length > 500) {
      wx.showToast({ title: '反馈内容最多 500 字', icon: 'none' })
      return
    }
    if (contact.length > 100) {
      wx.showToast({ title: '联系方式最多 100 字', icon: 'none' })
      return
    }

    this.setData({ isSubmitting: true })
    apiRequest({
      url: '/api/user-feedback',
      method: 'POST',
      data: {
        feedback_type: this.data.feedbackType,
        content,
        contact,
        images: this.data.images,
      },
    })
      .then(() => {
        wx.showToast({ title: '反馈已提交', icon: 'success' })
        setTimeout(() => wx.redirectTo({ url: '/pages/my-feedbacks/my-feedbacks' }), 700)
      })
      .catch(error => wx.showToast({ title: error.message || '提交失败', icon: 'none' }))
      .finally(() => this.setData({ isSubmitting: false }))
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack()
      return
    }
    wx.redirectTo({ url: '/pages/profile/profile' })
  },
})
