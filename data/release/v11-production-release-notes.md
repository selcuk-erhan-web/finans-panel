# FleetOS v1.1.0 — Vehicle Intelligence Production Release

**Sürüm:** 1.1.0  
**Release adı:** FleetOS Vehicle Intelligence  
**Release candidate:** 1.1.0-rc2  
**Durum:** Production  
**Support level:** stable

FleetOS v1.1, filo operasyon verisini araç bazlı yönetici zekâsına dönüştüren Vehicle Intelligence programını production olarak sertifika eder.

## Program Özeti

### Vehicle Intelligence Program (VI-1 → VI-5)
Araç bazlı uygunluk, bakım, lastik, denetim ve finans verileri tek zekâ katmanında birleştirildi. Yönetici ekranları filo genelinde karar verilebilir sinyaller üretir.

### Health Scoring (VI-2)
100 puanlık araç sağlık skoru, risk bandı ve filo sağlık özeti ile operasyonel zayıflıklar ölçülebilir hale geldi.

### Operational Timeline (VI-3)
Evrak, bakım, lastik, denetim ve finans olayları birleşik araç hafızasında toplandı.

### Profit / Risk Fusion (VI-4)
Kârlılık ve operasyonel risk tek füzyon katmanında birleştirildi; acil müdahale öncelikleri tanımlandı.

### Executive Vehicle Dashboard (VI-5)
VI-1…VI-4 çıktıları üst düzey yönetici ekranında toplandı; en iyi performans ve en yüksek risk araçları görünür kılındı.

### Stabilization (STB-2)
Route, nav, dashboard yoğunluğu, boş durumlar ve Türkçe terminoloji tutarlılığı doğrulandı.

### Release Candidate (RC-2)
Release envanteri, bilinen sorunlar ve readiness raporu production öncesi donduruldu.

## Temel Sonuçlar

- 5 yeni araç zekâsı sayfası ve 9 VI API endpoint production'da
- 3 yeni ana ekran widget'ı (Filo Sağlığı, Kâr/Risk, Yönetici Araç Zekâsı)
- Araç detay sayfasında kompakt zekâ, sağlık, geçmiş ve kâr/risk özetleri
- Tam regresyon paketi ile sertifika edildi

## Yönetici Yetenekleri

- Filo genelinde kâr, sağlık ve risk dağılımı
- Acil/yüksek öncelikli araç listesi ve önerilen aksiyonlar
- En iyi performans ve en yüksek risk tabloları
- Türkçe yönetici karar etiketleri ve içgörü mesajları

## Operasyonel Faydalar

- Araç bazlı operasyonel hafıza ve sinyal görünürlüğü
- Finansal performans ile operasyonel riskin aynı ekranda değerlendirilmesi
- Eksik veri ve kritik sinyallerin erken tespiti
- v1.0.1 uygunluk, bakım, lastik ve denetim modülleri üzerine inşa

## Bilinen Sınırlamalar

8 kayıtlı bilinen sorun production kapsamı dışındaki yetenekleri belgeler (RBAC, dış bildirim, export motoru vb.). Ayrıntılar `data/release/v11-known-issues.json`.
