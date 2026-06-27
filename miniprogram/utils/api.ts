export type ApiResponse<T> = {
  success?: boolean
  code?: string
  message?: string
  data?: T
}

export type ApiRequestOptions = {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: WechatMiniprogram.IAnyObject
  tokenType?: 'user' | 'none'
}

type UploadResult = {
  url?: string
  objectKey?: string
}

type UploadResponse = ApiResponse<UploadResult> | UploadResult

const TOKEN_KEY = 'steam_takeover_token'
const API_BASE_URL_KEY = 'steam_takeover_api_base_url'
const DEFAULT_API_BASE_URL = 'https://debun.xyz/miniprogram-api'

let apiBaseUrl = (wx.getStorageSync(API_BASE_URL_KEY) as string) || DEFAULT_API_BASE_URL
let configPromise: Promise<string> | null = null

export const getUserToken = () => wx.getStorageSync(TOKEN_KEY) as string

export const isApiResponse = <T>(value: unknown): value is ApiResponse<T> =>
  !!value && typeof value === 'object' && 'success' in value

const trimSlash = (value: string) => value.replace(/\/+$/, '')

export const getApiBaseUrl = () => apiBaseUrl

const friendlyNetworkError = (message?: string, fallback = '网络异常，请稍后重试') =>
  message && !message.includes('request:fail') && !message.includes('ERR_') ? message : fallback

export const loadApiConfig = () => {
  if (configPromise) return configPromise
  configPromise = new Promise<string>(resolve => {
    wx.request<WechatMiniprogram.IAnyObject>({
      url: `${DEFAULT_API_BASE_URL}/api/app-config`,
      method: 'GET',
      success: response => {
        const body = response.data as ApiResponse<{ apiBaseUrl?: string }>
        const nextBaseUrl = body && body.success !== false && body.data && body.data.apiBaseUrl
          ? trimSlash(body.data.apiBaseUrl)
          : ''
        if (nextBaseUrl) {
          apiBaseUrl = nextBaseUrl
          wx.setStorageSync(API_BASE_URL_KEY, nextBaseUrl)
        }
        resolve(apiBaseUrl)
      },
      fail: () => resolve(apiBaseUrl),
    })
  })
  return configPromise
}

const parseUploadResponse = (value: string) => {
  try {
    return JSON.parse(value) as UploadResponse
  } catch {
    return null
  }
}

export const apiError = (body: ApiResponse<unknown> | null | undefined, fallback: string) => {
  const error = new Error((body && (body.message || body.code)) || fallback) as Error & { code?: string }
  error.code = body ? body.code : undefined
  return error
}

export const apiRequest = async <T>(options: string | ApiRequestOptions) => {
  const requestOptions = typeof options === 'string' ? { url: options } : options
  await loadApiConfig()
  return new Promise<T>((resolve, reject) => {
    const token = requestOptions.tokenType === 'none' ? '' : getUserToken()
    const header: WechatMiniprogram.IAnyObject = {
      'content-type': 'application/json',
    }
    if (token) {
      header.Authorization = `Bearer ${token}`
    }

    wx.request<WechatMiniprogram.IAnyObject>({
      url: `${apiBaseUrl}${requestOptions.url}`,
      method: requestOptions.method || 'GET',
      data: requestOptions.data,
      header,
      success: response => {
        const responseData = response.data as T | ApiResponse<T>
        const body = responseData as ApiResponse<T>
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(apiError(body, `请求失败：${response.statusCode}`))
          return
        }
        if (isApiResponse<T>(body)) {
          if (body.success === false) {
            reject(apiError(body, '请求失败'))
            return
          }
          resolve((body.data || null) as T)
          return
        }
        resolve(responseData as T)
      },
      fail: error => reject(new Error(friendlyNetworkError(error.errMsg))),
    })
  })
}

export const uploadImage = async (filePath: string) => {
  await loadApiConfig()
  return new Promise<string>((resolve, reject) => {
    const token = getUserToken()
    if (!token) {
      reject(new Error('请先登录'))
      return
    }

    wx.uploadFile({
      url: `${apiBaseUrl}/api/uploads/image`,
      filePath,
      name: 'file',
      header: {
        Authorization: `Bearer ${token}`,
      },
      success: response => {
        const body = parseUploadResponse(response.data)
        const uploadError =
          body && isApiResponse<UploadResult>(body) ? body.message || body.code : ''
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(uploadError || `上传失败：${response.statusCode}`))
          return
        }

        const data = body && isApiResponse<UploadResult>(body) ? body.data : body
        if (!data || !data.url) {
          reject(new Error('上传结果异常'))
          return
        }

        resolve(data.url)
      },
      fail: error => reject(new Error(friendlyNetworkError(error.errMsg, '图片上传失败，请稍后重试'))),
    })
  })
}
