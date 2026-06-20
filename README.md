# 兔兔窝游戏接龙

一个用于组织 Steam 游戏接龙队伍的微信小程序。

小程序首页展示接龙列表，用户可以查看接龙、加入接龙、创建接龙。身份识别使用微信小程序 `wx.login` 换取 `openid`，昵称、Steam ID、性别和头像由用户手动填写。

## 功能概览

- 进入小程序后静默登录，后端通过 `openid` 识别用户
- 黑名单用户进入后不展示接龙列表，并提示已被管理员拉黑
- 接龙列表支持关键词搜索和时间筛选
- 接龙卡片展示标题、人数、时间、介绍和已加入用户头像
- 接龙详情展示成员头像、昵称、Steam ID
- 用户可补充昵称、Steam ID、性别、头像
- 性别必填，头像非必填，默认头像按性别展示
- 支持创建接龙
- 支持加入接龙
- 管理员可登录管理模式
- 管理员可编辑、删除接龙
- 管理员可拉黑用户

## 技术栈

- 微信小程序原生开发
- TypeScript
- WXML
- WXSS

## 目录结构

```text
.
+-- docs
|   +-- backend-api-design.md   # 后端接口与库表设计文档
+-- miniprogram
|   +-- app.json
|   +-- app.ts
|   +-- app.wxss
|   +-- assets
|   |   +-- avatar-female.jpg   # 女生默认头像
|   |   +-- avatar-male.jpg     # 男生默认头像
|   |   +-- edit.svg            # 管理员入口图标
|   +-- pages
|   |   +-- index               # 首页、接龙列表、详情、创建、管理
|   |   +-- logs
|   +-- utils
+-- typings
+-- package.json
+-- project.config.json
+-- project.private.config.json
+-- tsconfig.json
```

## 本地运行

1. 使用微信开发者工具打开项目根目录。
2. 确认小程序目录为 `miniprogram`。
3. 在微信开发者工具中编译运行。

当前项目仍使用前端 mock 数据模拟接龙列表、登录状态和管理操作。正式接入后端时，需要把页面中的 mock 请求替换为真实接口。

## 后端对接

后端接口与库表设计见：

[docs/backend-api-design.md](docs/backend-api-design.md)

核心登录流程：

```text
进入小程序
  -> wx.login()
  -> POST /api/auth/wx-login
  -> 后端通过 code 换取 openid
  -> 后端返回 token、profileCompleted、blocked
  -> blocked = true 时不展示接龙列表
  -> blocked = false 时请求 GET /api/takeovers
```

注意事项：

- `openid` 必须由后端通过微信接口换取，不能在前端生成或伪造。
- 微信 `app_secret` 只能放在后端。
- 管理员密码不能写在小程序前端。
- 普通用户不应该看到其他用户的 `openid`。
- 拉黑用户应以 `userId` 或 `openid` 为准，不能只按 Steam ID 拉黑。

## 用户资料规则

用户需要填写：

- 昵称：必填
- Steam ID：必填
- 性别：必填，1 男，2 女
- 头像：非必填

默认头像位置：

```text
miniprogram/assets/avatar-male.jpg
miniprogram/assets/avatar-female.jpg
```

如果用户未上传头像，前端根据性别展示默认头像。

## 接龙时间类型

当前支持三种时间类型：

- 指定日期：选择某一天和固定时间
- 每天固定：每天同一固定时间
- 日期范围：选择开始日期、结束日期和固定时间

指定日期和日期范围不能选择今天之前的日期。

## 管理员模式

管理员入口位于页面左下角悬浮按钮。当前前端仍是原型逻辑，正式环境应改为：

```text
POST /api/admin/login
```

由后端校验管理员密码并返回短期有效的 admin token。编辑接龙、删除接龙、拉黑用户等管理接口都必须校验 admin token。

## 开发状态

当前项目主要完成了小程序前端原型和后端接口设计文档。后续重点是：

- 替换 mock 数据为真实接口
- 接入 `wx.login` 后端换取 `openid`
- 接入用户资料保存接口
- 接入接龙创建、查询、加入接口
- 接入管理员登录、编辑、删除、拉黑接口
- 完善接口异常提示和加载状态
