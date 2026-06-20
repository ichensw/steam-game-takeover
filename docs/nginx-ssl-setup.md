# www.rabbits.ink Nginx SSL 配置

目标结构：

```text
https://www.rabbits.ink -> Nginx 443 -> http://127.0.0.1:8081
```

后端 Go 服务继续监听 `8081`，Nginx 负责 HTTPS 证书和微信小程序需要的域名访问。

## 1. 服务器安装 Nginx

CentOS / Alibaba Cloud Linux：

```bash
sudo yum install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

Ubuntu / Debian：

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

检查：

```bash
nginx -v
sudo systemctl status nginx
```

## 2. 开放安全组和防火墙

阿里云安全组放行：

```text
TCP 80
TCP 443
```

如果服务器本机启用了防火墙：

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

Ubuntu UFW：

```bash
sudo ufw allow 'Nginx Full'
```

## 3. 准备证书文件

服务器上创建证书目录：

```bash
sudo mkdir -p /etc/nginx/ssl/www.rabbits.ink
```

上传证书：

```text
/etc/nginx/ssl/www.rabbits.ink/full_chain.pem
/etc/nginx/ssl/www.rabbits.ink/private.key
```

注意：你现在本地只有 `full_chain.pem`，还缺少私钥文件。私钥通常叫：

```text
private.key
privkey.pem
www.rabbits.ink.key
```

没有私钥不能启用 HTTPS，需要从证书签发平台重新下载完整 Nginx 证书包，或者重新签发证书。

设置权限：

```bash
sudo chown -R root:root /etc/nginx/ssl/www.rabbits.ink
sudo chmod 600 /etc/nginx/ssl/www.rabbits.ink/private.key
sudo chmod 644 /etc/nginx/ssl/www.rabbits.ink/full_chain.pem
```

## 4. 添加 Nginx 配置

把本仓库的配置文件上传到服务器：

```text
docs/nginx-www-rabbits-ink.conf
```

放到：

```bash
/etc/nginx/conf.d/www.rabbits.ink.conf
```

配置内容已经包含：

```text
80 自动跳转 HTTPS
443 SSL
反向代理到 127.0.0.1:8081
上传大小 20MB
转发真实 IP
```

## 5. 后端监听建议

后端 `.env` 建议改成只监听本机：

```env
APP_ADDR=127.0.0.1:8081
```

然后重启后端服务。这样外部不能直接访问 `http://47.102.200.211:8081`，只能通过 HTTPS 域名访问。

## 6. 检查并重载 Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

测试：

```bash
curl -I https://www.rabbits.ink/api/auth/wx-login
```

如果返回 `405`、`400`、`404` 或 JSON 错误，都说明 HTTPS 反代已经通了；只要不是证书错误、连接失败或 502。

## 7. 小程序配置

前端接口地址改成：

```text
https://www.rabbits.ink
```

微信公众平台后台添加 request 合法域名：

```text
https://www.rabbits.ink
```

微信开发者工具里刷新项目配置：

```text
详情 -> 域名信息 -> 刷新
```

然后重新编译项目。

## 8. 常见问题

`nginx -t` 提示 `cannot load certificate key`：

```text
私钥文件不对，或者证书和私钥不是一对。
```

`https://www.rabbits.ink` 返回 502：

```text
后端服务没启动，或者 APP_ADDR 不是 127.0.0.1:8081 / :8081。
```

小程序仍提示 request 合法域名错误：

```text
前端还在请求 http://47.102.200.211:8081，或者微信后台没有添加 https://www.rabbits.ink，或者开发者工具没有刷新项目配置。
```
