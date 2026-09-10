# Discord Fast Vanity URL Sniper & Auto MFA Refresh

HTTP/2 ve WebSocket altyapısını kullanarak Discord sunucularında düşen vanity URL (özel davet bağlantısı) taleplerini ultra düşük gecikme süresiyle otomatik olarak yakalayan gelişmiş bir sniper botu.

## 🚀 Özellikler

- **HTTP/2 & TLS Optimize:** `canary.discord.com` üzerine doğrudan IP üzerinden bağlı TLS socket havuzu ile maksimum istek hızı.
- **WebSocket Gateway Dinleme:** Sunucu güncellemelerini (`GUILD_UPDATE`) anlık tespit etme.
- **Otomatik MFA/2FA Yenileme:** Şifre doğrulaması üzerinden `mfa.txt` dosyasını otomatik güncelleyen `MFAClient` mimarisi.
- **Çoklu Session Desteği:** Paralel HTTP/2 stream'leri ile bağlantı havuzu yönetimi.

## 📦 Kurulum

1. Depoyu klonlayın veya indirin:
   ```bash
   git clone [https://github.com/kullaniciadi/discord-vanity-sniper.git](https://github.com/kullaniciadi/discord-vanity-sniper.git)
   cd discord-vanity-sniper
Gerekli Node.js paketlerini yükleyin:

Bash
npm install ws http2 tls fs net
Yapılandırma:

mfa.cjs dosyasındaki TOKEN ve PASSWORD alanlarını doldurun.

kod.js dosyasındaki TOKEN ve GUILD_ID alanlarını güncelleyin.

🛠️ Kullanım
MFA üretecini ve ana sniper botunu başlatmak için batch dosyalarını çalıştırabilirsiniz:

MFA Servisi: start_mfa.bat (node mfa.cjs)

Sniper Servisi: start_sniper.bat (node kod.js)
