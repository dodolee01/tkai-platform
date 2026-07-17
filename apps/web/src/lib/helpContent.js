// Static knowledge base + FAQ content for Help Center, FAQ and Support pages.

export const FAQ_CATEGORIES = [
    'Başlangıç',
    'İşlemler',
    'Stratejiler',
    'API',
    'Güvenlik',
    'Faturalama',
];

export const FAQS = [
    { id: 'f1', category: 'Başlangıç', q: 'TK AI FİNANCE nedir?', a: 'TK AI FİNANCE, Binance ve diğer borsalar üzerinde 25 katmanlı yapay zeka analiziyle otomatik alım-satım yapan gelişmiş bir işlem platformudur. Spot ve Futures piyasalarını destekler.' },
    { id: 'f2', category: 'Başlangıç', q: 'Hesabımı nasıl kurarım?', a: 'Yardım menüsünden Kurulum Sihirbazı’nı açarak 5 adımda Binance API bağlantısı, işlem ayarları, strateji seçimi ve risk parametrelerini yapılandırabilirsiniz.' },
    { id: 'f3', category: 'İşlemler', q: 'Bot işlemleri nasıl açıyor?', a: 'Bot, 500+ USDT-M Futures paritesini sürekli tarar ve ≥%90 güven skoru üreten sinyallerde işlem açar. Maksimum 20 eşzamanlı pozisyon, işlem başına %0,5 risk ve günlük %5 zarar limiti uygulanır.' },
    { id: 'f4', category: 'İşlemler', q: 'Günlük kâr hedefi nasıl çalışır?', a: 'Günlük %10 kâr hedefine ulaşıldığında bot otomatik olarak durur ve devam etmek isteyip istemediğinizi soran bir onay bandı gösterir.' },
    { id: 'f5', category: 'Stratejiler', q: 'Kaç strateji profili var?', a: '8 hazır profil bulunur: Başlangıç, Muhafazakar, Dengeli, Profesyonel, Usta, Gold, Elite ve Custom. Her biri risk seviyesi, kaldıraç ve filtreler açısından yapılandırılabilir.' },
    { id: 'f6', category: 'Stratejiler', q: 'Kendi stratejimi test edebilir miyim?', a: 'Evet. Backtesting bölümünden çoklu coin, zaman dilimi ve tarih aralığı seçerek gerçek geçmiş verilerle strateji performansını ölçebilirsiniz.' },
    { id: 'f7', category: 'API', q: 'REST API nasıl kullanılır?', a: 'API Dokümantasyonu sayfasından tüm v1 uç noktalarını inceleyebilir, JWT veya API anahtarıyla kimlik doğrulaması yapabilirsiniz. cURL, Python, JavaScript ve Go örnekleri mevcuttur.' },
    { id: 'f8', category: 'API', q: 'Webhook desteği var mı?', a: 'Evet. Webhook yönetiminden trade.opened, trade.closed, order.filled gibi olaylar için HMAC-SHA256 imzalı webhook’lar oluşturabilirsiniz.' },
    { id: 'f9', category: 'Güvenlik', q: 'API anahtarlarım güvende mi?', a: 'Binance API anahtarlarınız sunucuda AES-256-GCM ile şifrelenerek saklanır. Anahtarlar hiçbir zaman istemci koduna gömülmez.' },
    { id: 'f10', category: 'Güvenlik', q: 'İki faktörlü doğrulama var mı?', a: 'Hesap güvenliği için güçlü parola ve doğrulanmış e-posta zorunludur; borsa tarafında IP kısıtlaması ve 2FA kullanmanızı öneririz.' },
    { id: 'f11', category: 'Faturalama', q: 'Platform ücretli mi?', a: 'Temel işlem özellikleri kendi borsa API anahtarlarınızla çalışır. Kurumsal özellikler ve gelişmiş raporlama için farklı planlar sunulur.' },
    { id: 'f12', category: 'Faturalama', q: 'Aboneliğimi nasıl iptal ederim?', a: 'Ayarlar > Faturalama bölümünden aboneliğinizi istediğiniz zaman iptal edebilirsiniz; dönem sonuna kadar erişiminiz devam eder.' },
];

export const HELP_CATEGORIES = [
    { key: 'getting-started', label: 'Başlangıç' },
    { key: 'trading', label: 'İşlemler' },
    { key: 'strategies', label: 'Stratejiler' },
    { key: 'api', label: 'API' },
    { key: 'security', label: 'Güvenlik' },
    { key: 'troubleshooting', label: 'Sorun Giderme' },
];

const body = (paras) => paras.map((p) => `<p>${p}</p>`).join('');

export const ARTICLES = [
    { id: 'gs-1', category: 'getting-started', title: 'Platforma ilk giriş', excerpt: 'Kaydolduktan sonra atmanız gereken ilk adımlar.', popular: true, updated: '2026-07-10', content: ['TK AI FİNANCE’a hoş geldiniz. İlk girişinizde karşınıza çıkan Kurulum Sihirbazı ile hesabınızı dakikalar içinde hazır hale getirebilirsiniz.', 'Sihirbaz beş adımdan oluşur: Binance API bağlantısı, işlem ayarları, strateji seçimi, risk parametreleri ve son onay.'] },
    { id: 'gs-2', category: 'getting-started', title: 'Binance API anahtarı oluşturma', excerpt: 'Borsada API anahtarı üretme rehberi.', popular: true, updated: '2026-07-11', content: ['Binance hesabınızda API Management bölümüne gidin ve yeni bir anahtar oluşturun.', 'Futures izinlerini etkinleştirin ve güvenlik için IP kısıtlaması ekleyin. Ardından anahtar ve gizli anahtarı Kurulum Sihirbazı’na girin.'] },
    { id: 'gs-3', category: 'getting-started', title: 'Panel genel bakış', excerpt: 'Ana panelin bölümleri.', updated: '2026-07-11', content: ['Ana panel; KPI kartları, canlı grafik ve AI Piyasa Analizi panelinden oluşur.', 'Sol menüden 16 farklı bölüme erişebilirsiniz.'] },
    { id: 'gs-4', category: 'getting-started', title: 'Bildirim merkezi', excerpt: 'Bildirimleri yönetme.', updated: '2026-07-12', content: ['Zil simgesinden tüm bildirimlerinizi görebilir, okundu olarak işaretleyebilir ve tercihlerinizi yönetebilirsiniz.'] },
    { id: 'gs-5', category: 'getting-started', title: 'Mobil kullanım', excerpt: 'Mobil cihazlarda platform.', updated: '2026-07-12', content: ['Arayüz tüm ekran boyutlarına duyarlıdır ve mobil cihazlarda tam işlevsellik sunar.'] },

    { id: 'tr-1', category: 'trading', title: 'Otomatik bot nasıl başlatılır', excerpt: 'Botu Başlat / Durdur.', popular: true, updated: '2026-07-13', content: ['Bot İşlemleri bölümünden “Botu Başlat” düğmesine tıklayarak otomatik işlemi etkinleştirin.', 'Durum KPI’ları bot durumunu, açık işlem sayısını ve günlük kârı gösterir.'] },
    { id: 'tr-2', category: 'trading', title: 'Manuel işlem açma', excerpt: 'Coin tarayıcı ile manuel işlem.', updated: '2026-07-13', content: ['Coin Arama panelinden bir parite seçip manuel olarak işlem açabilir veya kapatabilirsiniz.'] },
    { id: 'tr-3', category: 'trading', title: 'Risk yönetimi', excerpt: 'Risk limitleri.', popular: true, updated: '2026-07-13', content: ['İşlem başına risk, günlük zarar limiti, maksimum açık pozisyon ve kaldıraç limitleri ile sermayenizi koruyun.'] },
    { id: 'tr-4', category: 'trading', title: 'TP / SL ayarları', excerpt: 'Kâr al ve zarar durdur.', updated: '2026-07-14', content: ['Her işlem için otomatik kâr al (TP) ve zarar durdur (SL) seviyeleri risk/ödül oranına göre hesaplanır.'] },
    { id: 'tr-5', category: 'trading', title: 'Gelişmiş emir tipleri', excerpt: 'Iceberg, TWAP, OCO.', updated: '2026-07-14', content: ['Kurumsal bölümde Iceberg, TWAP, VWAP, trailing stop, bracket, OCO ve koşullu emirler desteklenir.'] },
    { id: 'tr-6', category: 'trading', title: 'İşlem günlüğü', excerpt: 'Trade journaling.', updated: '2026-07-14', content: ['İşlem Günlüğü, giriş/çıkış detaylarını, güven skorlarını ve AI görüşünü kaydeder; CSV/PDF olarak dışa aktarılabilir.'] },
    { id: 'tr-7', category: 'trading', title: 'Portföy merkezi', excerpt: 'Portföy takibi.', updated: '2026-07-15', content: ['Spot ve Futures bakiyelerini birleştirir; toplam/günlük/haftalık/aylık PnL ve kazanma oranını gösterir.'] },
    { id: 'tr-8', category: 'trading', title: 'Çoklu borsa desteği', excerpt: '7 borsa entegrasyonu.', updated: '2026-07-15', content: ['Binance, Bybit, OKX, Bitget, KuCoin, Gate.io ve MEXC desteklenir; her borsa için ayrı API anahtarı yönetilir.'] },

    { id: 'st-1', category: 'strategies', title: 'Strateji profillerini anlamak', excerpt: '8 hazır profil.', popular: true, updated: '2026-07-13', content: ['Her profil risk seviyesi (1-10), kaldıraç, maksimum işlem ve filtre setleriyle gelir.'] },
    { id: 'st-2', category: 'strategies', title: 'Custom strateji oluşturma', excerpt: 'Kendi stratejiniz.', updated: '2026-07-13', content: ['Custom profil ile tüm parametreleri kendiniz belirleyebilirsiniz.'] },
    { id: 'st-3', category: 'strategies', title: 'Backtesting rehberi', excerpt: 'Geçmiş veriyle test.', popular: true, updated: '2026-07-14', content: ['Backtest, gerçek OHLCV verileriyle stratejinizi çalıştırır ve kazanma oranı, PnL, max drawdown, Sharpe oranı gibi metrikler üretir.'] },
    { id: 'st-4', category: 'strategies', title: 'Özel indikatör oluşturucu', excerpt: 'Formül tabanlı indikatörler.', updated: '2026-07-14', content: ['SMA, EMA, RSI, MACD ve Bollinger Bantları kullanarak formül tabanlı özel indikatörler oluşturun.'] },
    { id: 'st-5', category: 'strategies', title: 'AI öğrenme sistemi', excerpt: 'Kendi kendine öğrenme.', updated: '2026-07-15', content: ['Sistem kazanan/kaybeden desenleri analiz eder ve strateji önerileri üretir.'] },
    { id: 'st-6', category: 'strategies', title: 'Piyasa istihbaratı', excerpt: 'Teknik göstergeler.', updated: '2026-07-15', content: ['10 teknik gösterge, Fear & Greed endeksi, funding rate ve balina uyarıları sunar.'] },

    { id: 'api-1', category: 'api', title: 'API kimlik doğrulama', excerpt: 'JWT ve API anahtarı.', popular: true, updated: '2026-07-13', content: ['v1 API’ye JWT token veya API anahtarı ile kimlik doğrulaması yapabilirsiniz.'] },
    { id: 'api-2', category: 'api', title: 'Rate limiting', excerpt: 'İstek limitleri.', updated: '2026-07-13', content: ['Genel uç noktalar 100 istek/15dk, hassas işlem uç noktaları daha düşük limitlerle sınırlıdır.'] },
    { id: 'api-3', category: 'api', title: 'Sayfalama ve filtreleme', excerpt: 'Liste uç noktaları.', updated: '2026-07-14', content: ['page ve perPage parametreleriyle sayfalama, filter ve sort ile sıralama yapabilirsiniz.'] },
    { id: 'api-4', category: 'api', title: 'Webhook imzaları', excerpt: 'HMAC-SHA256.', updated: '2026-07-14', content: ['Gelen webhook’lar HMAC-SHA256 imzasıyla doğrulanır.'] },
    { id: 'api-5', category: 'api', title: 'Kod örnekleri', excerpt: 'cURL, Python, JS, Go.', updated: '2026-07-15', content: ['API Dokümantasyonu sayfasında her uç nokta için çoklu dilde kod örnekleri bulunur.'] },

    { id: 'sec-1', category: 'security', title: 'API anahtarı şifreleme', excerpt: 'AES-256-GCM.', popular: true, updated: '2026-07-13', content: ['Anahtarlarınız sunucuda AES-256-GCM ile şifrelenir ve asla istemciye gönderilmez.'] },
    { id: 'sec-2', category: 'security', title: 'IP kısıtlaması', excerpt: 'Borsa güvenliği.', updated: '2026-07-14', content: ['Binance API anahtarınıza IP kısıtlaması ekleyerek güvenliği artırın.'] },
    { id: 'sec-3', category: 'security', title: 'Oturum güvenliği', excerpt: 'Token yönetimi.', updated: '2026-07-14', content: ['Oturum token’ları güvenli şekilde saklanır ve süresi dolduğunda otomatik yenilenir.'] },
    { id: 'sec-4', category: 'security', title: 'Veri gizliliği', excerpt: 'Gizlilik politikası.', updated: '2026-07-15', content: ['Verileriniz gizlilik politikamıza uygun olarak işlenir; detaylar için Yasal sayfasını inceleyin.'] },

    { id: 'ts-1', category: 'troubleshooting', title: 'Binance bağlantı hatası', excerpt: 'Bağlanamıyorum.', popular: true, updated: '2026-07-13', content: ['API anahtarınızın Futures izinlerine ve doğru IP kısıtlamasına sahip olduğundan emin olun.'] },
    { id: 'ts-2', category: 'troubleshooting', title: 'İşlem açılmıyor', excerpt: 'Bot işlem açmıyor.', updated: '2026-07-13', content: ['Yetersiz bakiye, güven skoru eşiği veya günlük zarar limiti işlem açılmasını engelleyebilir.'] },
    { id: 'ts-3', category: 'troubleshooting', title: 'Grafik yüklenmiyor', excerpt: 'Chart sorunları.', updated: '2026-07-14', content: ['Sayfayı yenileyin; sorun sürerse tarayıcı önbelleğini temizleyin.'] },
    { id: 'ts-4', category: 'troubleshooting', title: 'Bildirim gelmiyor', excerpt: 'Bildirim ayarları.', updated: '2026-07-14', content: ['Bildirim tercihlerinizi kontrol edin ve ilgili bildirim türünün etkin olduğundan emin olun.'] },
    { id: 'ts-5', category: 'troubleshooting', title: 'Yavaş performans', excerpt: 'Performans.', updated: '2026-07-15', content: ['Çok sayıda açık sekme performansı etkileyebilir; gereksiz sekmeleri kapatın.'] },
    { id: 'ts-6', category: 'troubleshooting', title: 'Destek ile iletişim', excerpt: 'Yardım alma.', updated: '2026-07-15', content: ['Sorununuz devam ederse Destek sayfasından bir talep oluşturun.'] },
].map((a) => ({ ...a, html: body(a.content) }));

export const SUPPORT_EMAIL = 'destek@tkaifinance.com';
