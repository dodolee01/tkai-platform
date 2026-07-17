import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Shield, FileText, Cookie } from 'lucide-react';

const UPDATED = '16 Temmuz 2026';

const DOCS = {
	terms: {
		icon: FileText,
		title: 'Kullanım Koşulları',
		intro: 'TK AI FİNANCE platformunu kullanarak aşağıdaki koşulları kabul etmiş olursunuz.',
		sections: [
			['1. Hizmet Tanımı', 'TK AI FİNANCE, kullanıcıların kendi borsa API anahtarlarını bağlayarak yapay zeka destekli otomatik alım-satım stratejileri çalıştırmasına olanak tanıyan bir araçtır. Platform yatırım tavsiyesi vermez.'],
			['2. Risk Bildirimi', 'Kripto para ve türev ürün ticareti yüksek risk içerir. Geçmiş performans gelecekteki sonuçların garantisi değildir. Yalnızca kaybetmeyi göze alabileceğiniz sermaye ile işlem yapın. Tüm işlem kararlarının ve sonuçlarının sorumluluğu kullanıcıya aittir.'],
			['3. API Anahtarları', 'Borsa API anahtarlarınız AES-256-GCM ile şifrelenerek saklanır. Para çekme yetkisi olmayan (yalnızca işlem) anahtarlar kullanmanızı önemle tavsiye ederiz. Anahtarlarınızın güvenliğinden siz sorumlusunuz.'],
			['4. Sorumluluk Reddi', 'Platform "olduğu gibi" sunulur. Finansal kayıplar, borsa kesintileri, API hataları veya veri gecikmelerinden doğan zararlardan sorumlu değiliz.'],
			['5. Hesap Sonlandırma', 'Koşulların ihlali halinde hesabınızı askıya alma veya sonlandırma hakkımızı saklı tutarız.'],
		],
	},
	privacy: {
		icon: Shield,
		title: 'Gizlilik Politikası',
		intro: 'Verilerinizin nasıl toplandığını, kullanıldığını ve korunduğunu açıklarız (KVKK & GDPR uyumlu).',
		sections: [
			['1. Toplanan Veriler', 'Hesap bilgileri (e-posta, ad), şifrelenmiş borsa API anahtarları, işlem geçmişi, strateji ayarları ve platform kullanım metrikleri.'],
			['2. Verilerin Kullanımı', 'Verileriniz yalnızca hizmetin sunulması, otomatik işlem yürütülmesi, performans raporlaması ve platform iyileştirmesi için kullanılır. Verileriniz üçüncü taraflara satılmaz.'],
			['3. Veri Güvenliği', 'Hassas veriler şifrelenerek saklanır, iletim HTTPS/TLS ile korunur. Erişim kontrolü ve düzenli güvenlik güncellemeleri uygulanır.'],
			['4. GDPR/KVKK Hakları', 'Verilerinize erişme, düzeltme, silme ve dışa aktarma hakkına sahipsiniz. Talepleriniz için support@tkaifinance.com adresine yazın.'],
			['5. Veri Saklama', 'Veriler hesabınız aktif olduğu sürece saklanır. Hesap silme talebinizden sonra 30 gün içinde kalıcı olarak silinir.'],
		],
	},
	cookies: {
		icon: Cookie,
		title: 'Çerez Politikası',
		intro: 'Platformumuz deneyiminizi geliştirmek için çerezler kullanır.',
		sections: [
			['1. Zorunlu Çerezler', 'Oturum yönetimi ve kimlik doğrulama için gereklidir. Bunlar olmadan platform çalışamaz.'],
			['2. Analitik Çerezler', 'Google Analytics 4 aracılığıyla anonim kullanım istatistikleri toplar. IP adresleri anonimleştirilir.'],
			['3. Tercih Çerezleri', 'Tema, dil ve panel düzeni gibi ayarlarınızı hatırlar.'],
			['4. Çerez Yönetimi', 'Tarayıcı ayarlarınızdan çerezleri istediğiniz zaman silebilir veya engelleyebilirsiniz. Bu, bazı özelliklerin çalışmasını etkileyebilir.'],
		],
	},
};

function LegalPage() {
	const { doc } = useParams();
	const data = DOCS[doc] || DOCS.terms;
	const Icon = data.icon;

	return (
		<div className="min-h-screen grid-bg">
			<div className="max-w-3xl mx-auto px-5 py-14">
				<Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
					<ArrowLeft className="w-4 h-4" /> Panele dön
				</Link>

				<div className="flex items-center gap-4 mb-3">
					<span className="icon-badge w-12 h-12"><Icon className="w-6 h-6" /></span>
					<h1 className="font-display text-3xl font-bold gradient-text">{data.title}</h1>
				</div>
				<p className="text-muted-foreground mb-2">{data.intro}</p>
				<p className="text-xs text-muted-foreground/70 mb-10">Son güncelleme: {UPDATED}</p>

				<div className="space-y-6">
					{data.sections.map(([heading, body]) => (
						<section key={heading} className="glass rounded-2xl p-6">
							<h2 className="font-display text-lg font-semibold mb-2">{heading}</h2>
							<p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
						</section>
					))}
				</div>

				<div className="flex flex-wrap gap-3 mt-10 text-sm">
					<Link to="/legal/terms" className="text-primary hover:underline">Kullanım Koşulları</Link>
					<span className="text-muted-foreground/40">•</span>
					<Link to="/legal/privacy" className="text-primary hover:underline">Gizlilik Politikası</Link>
					<span className="text-muted-foreground/40">•</span>
					<Link to="/legal/cookies" className="text-primary hover:underline">Çerez Politikası</Link>
				</div>
			</div>
		</div>
	);
}

export default LegalPage;
