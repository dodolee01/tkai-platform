# TK AI FİNANCE — Hostinger VPS (Ubuntu 24.04) Kurulum Rehberi

Bu rehber projeyi bir Hostinger VPS üzerinde **iki yöntemle** çalıştırmayı anlatır:

- **Yöntem A — Docker (önerilen):** Tek komutla tüm servisler.
- **Yöntem B — Docker olmadan (Node.js + PM2 + Nginx).**

Mimari 3 servisten oluşur:

| Servis      | Teknoloji            | Port |
|-------------|----------------------|------|
| Frontend    | React + Vite (Nginx) | 3000 |
| API         | Express (Node.js)    | 5000 |
| PocketBase  | Veritabanı/Auth      | 8090 |

> **Güvenlik notu:** Binance API Key / Secret kod içinde tutulmaz. Kullanıcı bunları
> arayüzdeki "Binance Bağlantı" panelinden girer; değerler `TRADING_ENC_KEY` ile
> **AES-256-GCM** şifrelenerek sunucuda saklanır.

---

## 0. Kaynak Kodu Export (ZIP)

Yerel makinenizde proje kök dizininde:

```bash
# node_modules, dist ve .env hariç temiz bir arşiv
zip -r tkai-finance.zip . \
  -x "*/node_modules/*" -x "dist/*" -x "**/.env" \
  -x ".git/*" -x "**/pb_data/*.db-wal" -x "**/pb_data/*.db-shm"
```

VPS'e yükleyin:

```bash
scp tkai-finance.zip root@SUNUCU_IP:/opt/
ssh root@SUNUCU_IP
cd /opt && unzip tkai-finance.zip -d tkai-finance && cd tkai-finance
```

---

## 1. SSH Bağlantısı

```bash
ssh root@SUNUCU_IP
# veya kullanıcı: ssh kullanici@SUNUCU_IP
```

## 2. Sistem güncelleme

```bash
sudo apt update && sudo apt upgrade -y
```

---

# YÖNTEM A — Docker ile Kurulum (Önerilen)

## A.1 Docker kurulumu

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
# (opsiyonel) sudo'suz kullanım:
sudo usermod -aG docker $USER && newgrp docker
```

## A.2 Ortam değişkenleri

```bash
cd /opt/tkai-finance
cp .env.example .env
# Şifreleme anahtarlarını üretin:
echo "TRADING_ENC_KEY=$(openssl rand -hex 32)"    # çıktıyı .env'e yazın
echo "PB_ENCRYPTION_KEY=$(openssl rand -hex 16)"  # çıktıyı .env'e yazın
nano .env   # CORS_ORIGIN=https://alanadiniz.com  yazın
```

## A.3 Başlatma

```bash
docker compose up -d --build
docker compose ps          # servis durumları
docker compose logs -f     # loglar
```

- Frontend:   `http://SUNUCU_IP:3000`
- API health: `http://SUNUCU_IP:5000/health`
- PocketBase: `http://SUNUCU_IP:8090/_/`

Durdurma / güncelleme:

```bash
docker compose down                 # durdur
docker compose up -d --build        # kodu güncelledikten sonra yeniden derle
```

---

# YÖNTEM B — Docker Olmadan (Node.js + PM2)

## B.1 Node.js 22 (18+) kurulumu

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v22.x
```

## B.2 Bağımlılıklar + derleme

```bash
cd /opt/tkai-finance
npm install                          # tüm workspace'ler (apps/*)
npm run build                        # frontend üretim derlemesi -> dist/apps/web
```

## B.3 Ortam dosyaları

```bash
# API
cp apps/api/.env.example apps/api/.env
nano apps/api/.env    # PORT=5000, TRADING_ENC_KEY=$(openssl rand -hex 32), CORS_ORIGIN=...

# PocketBase şifreleme anahtarını export edin (PM2 ecosystem içinde de tanımlı)
export PB_ENCRYPTION_KEY=$(openssl rand -hex 16)
```

## B.4 PM2 ile başlatma + otomatik açılış

```bash
sudo npm install -g pm2
mkdir -p logs
pm2 start deploy/pm2/ecosystem.config.cjs
pm2 save
pm2 startup            # ekrandaki komutu kopyalayıp çalıştırın (systemd kaydı)
pm2 status
```

> Frontend `npm run start` (vite preview) 3000 portunda çalışır. Statik dosyaları
> doğrudan Nginx ile servis etmek isterseniz `dist/apps/web` klasörünü Nginx `root`
> olarak ayarlayın (aşağıdaki B.5 alternatifi).

## B.5 (Alternatif) Frontend'i Nginx ile statik servis etme

`deploy/nginx/web.conf` mantığını host Nginx'e taşıyın: `root /opt/tkai-finance/dist/apps/web;`
ve `/hcgi/api/` bloğunu `proxy_pass http://127.0.0.1:5000/;` yapın. Bu durumda
PM2'de `tkai-web` uygulamasını kaldırabilirsiniz.

---

## 3. Domain Bağlama + Nginx Reverse Proxy

### 3.1 DNS Ayarları (Hostinger hPanel > DNS Zone)

| Tip | İsim | Değer         |
|-----|------|---------------|
| A   | @    | SUNUCU_IP     |
| A   | www  | SUNUCU_IP     |

DNS yayılmasını bekleyin (`dig alanadiniz.com +short`).

### 3.2 Nginx

```bash
sudo apt install -y nginx
sudo cp deploy/nginx/tkai.conf /etc/nginx/sites-available/tkai
# tkai dosyasında "alanadiniz.com" -> kendi domain'iniz
sudo nano /etc/nginx/sites-available/tkai
sudo ln -s /etc/nginx/sites-available/tkai /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

> Docker kullanıyorsanız `/hcgi/api` isteklerini frontend container'ı (kendi Nginx'i)
> zaten `api:5000`'e yönlendirir. Docker kullanmıyorsanız `tkai.conf` içindeki
> `/hcgi/api/` bloğunu açın.

---

## 4. SSL Sertifikası (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d alanadiniz.com -d www.alanadiniz.com
# Otomatik yenileme testi:
sudo certbot renew --dry-run
```

Certbot 80 → 443 yönlendirmesini ve sertifikayı otomatik ekler.

---

## 5. Firewall (UFW)

```bash
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

> Dışarıya yalnızca 80/443 (ve SSH) açık kalır. 3000/5000/8090 portları
> **yalnızca sunucu içinden** erişilir — dışarı açmayın. Docker kullanıyorsanız
> `docker-compose.yml`'de bu portları host'a bind etmek yerine sadece iç ağda
> tutmak için `ports` satırlarını kaldırıp Nginx üzerinden erişebilirsiniz.

---

## 6. Veritabanı (PocketBase)

- **Admin paneli:** `https://alanadiniz.com/_/` (reverse proxy ile 8090'a yönlendirebilir
  veya SSH tüneli ile erişebilirsiniz: `ssh -L 8090:localhost:8090 root@SUNUCU_IP`).
- **Migrations:** `apps/pocketbase/pb_migrations/` içindeki dosyalar başlangıçta
  otomatik uygulanır.

### Yedekleme

```bash
# Docker (volume içindeki veri):
docker compose exec pocketbase tar czf - -C /app/apps/pocketbase pb_data > pb_backup_$(date +%F).tar.gz

# Docker olmadan:
tar czf pb_backup_$(date +%F).tar.gz -C apps/pocketbase pb_data

# Otomatik günlük yedek (crontab -e):
0 3 * * * cd /opt/tkai-finance && tar czf /opt/backups/pb_$(date +\%F).tar.gz -C apps/pocketbase pb_data
```

---

## 7. Güvenlik

- **API anahtarı şifreleme:** `TRADING_ENC_KEY` (AES-256-GCM). `openssl rand -hex 32`
  ile üretin, asla paylaşmayın, `.env` dışında saklamayın.
- **Rate limiting:** Express `express-rate-limit` ile küresel olarak etkin
  (`apps/api/src/middleware/global-rate-limit.js`). Ek olarak Nginx tarafında
  `limit_req_zone` tanımlanabilir.
- **Helmet:** güvenlik başlıkları API'de etkin.
- **Firewall:** yalnızca 80/443/SSH açık (Bölüm 5).
- `.env` dosyalarını git'e **eklemeyin** (`.gitignore` / `.dockerignore` hazır).

---

## 8. Monitoring (İzleme)

### PM2 (Yöntem B)

```bash
pm2 monit           # canlı CPU/RAM/log
pm2 logs            # tüm loglar
pm2 logs tkai-api   # tek servis
pm2 status
```

Loglar `logs/` klasöründe (`*.out.log`, `*.err.log`).

### Docker (Yöntem A)

```bash
docker compose logs -f            # tüm servisler
docker compose logs -f api        # tek servis
docker stats                      # CPU/RAM kullanımı
```

### Sağlık kontrolü

```bash
curl http://localhost:5000/health   # {"status":"ok"}
```

---

## Hızlı Referans

| İşlem                | Docker                              | PM2                          |
|----------------------|-------------------------------------|------------------------------|
| Başlat               | `docker compose up -d --build`      | `pm2 start deploy/pm2/ecosystem.config.cjs` |
| Durdur               | `docker compose down`               | `pm2 stop all`               |
| Log                  | `docker compose logs -f`            | `pm2 logs`                   |
| Yeniden başlat       | `docker compose restart`            | `pm2 restart all`            |
| Güncelleme sonrası   | `docker compose up -d --build`      | `npm run build && pm2 restart all` |
