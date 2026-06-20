/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {
    userProfile?: {
      nickName: string
      steamId: string
      avatarUrl: string
      gender: 'male' | 'female'
    }
  }
}
