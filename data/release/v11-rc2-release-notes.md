# FleetOS v1.1.0-rc2 — Vehicle Intelligence

**Sürüm:** 1.1.0-rc2  
**Release adı:** FleetOS Vehicle Intelligence RC-2  
**Branch:** v1.1-planning  
**Durum:** Release Candidate  
**Taban sürüm:** v1.0.1

FleetOS v1.1, filo verisini araç bazlı yönetici zekâsına dönüştüren Vehicle Intelligence programını tamamlar. RC-2; planlama, beş VI fazı, STB-2 stabilizasyonu ve yönetici karar katmanını tek release candidate paketinde sunar.

## Tamamlanan Fazlar

### V11-PLN-1 — Roadmap Planning
- v1.1 roadmap verisi ve planlama servisi
- `/roadmap/v1.1` yönetici roadmap sayfası
- `GET /api/roadmap/v1.1`

### VI-1 — Vehicle Intelligence Foundation
- Araç bazlı uygunluk, bakım, lastik, denetim ve finans birleşimi
- `/vehicle-intelligence` ve filo API
- Araç detay **Araç Zekâsı Özeti** bloğu

### VI-2 — Vehicle Health Score
- 100 puanlık sağlık skoru ve risk bandı
- `/vehicle-health` ve filo sağlık raporu
- Ana ekran **Filo Sağlığı** widget

### VI-3 — Vehicle Operational Timeline
- Birleşik operasyon geçmişi (evrak, bakım, lastik, denetim, finans)
- `/vehicle-timeline` filtreli geçmiş görünümü
- Araç detay operasyon önizlemesi

### VI-4 — Vehicle Profit / Risk Fusion
- Kârlılık + operasyonel risk füzyonu
- `/vehicle-profit-risk` karar matrisi
- Ana ekran **Kâr / Risk Özeti** widget

### VI-5 — Executive Vehicle Intelligence Dashboard
- VI-1…VI-4 üst düzey yönetici ekranı
- `/executive-vehicle-dashboard`
- Ana ekran **Yönetici Araç Zekâsı** widget

### STB-2 — v1.1 Stabilization
- Route, nav, dashboard yoğunluğu ve boş durum denetimi
- Türkçe terminoloji tutarlılığı
- Tam VI regresyon paketi

## Yeni Sayfalar

| Sayfa | Açıklama |
|-------|----------|
| `/roadmap/v1.1` | v1.1 roadmap |
| `/vehicle-intelligence` | Araç Zekâsı |
| `/vehicle-health` | Araç Sağlık Skoru |
| `/vehicle-timeline` | Araç Operasyon Geçmişi |
| `/vehicle-profit-risk` | Araç Kâr / Risk Analizi |
| `/executive-vehicle-dashboard` | Yönetici Araç Zekâsı |
| `/release/v1.1` | v1.1 Release Candidate |

## Yeni API'ler

- `GET /api/roadmap/v1.1`
- `GET /api/vehicle-intelligence` · `GET /api/vehicle-intelligence/:vehicleId`
- `GET /api/vehicle-health` · `GET /api/vehicle-health/:vehicleId`
- `GET /api/vehicle-timeline` · `GET /api/vehicle-timeline/:vehicleId`
- `GET /api/vehicle-profit-risk` · `GET /api/vehicle-profit-risk/:vehicleId`
- `GET /api/executive-vehicle-dashboard`
- `GET /api/release/v1.1`

## Ana Ekran Widget'ları (v1.1)

- **Filo Sağlığı** — ortalama skor, kritik/risk/izleme sayıları
- **Kâr / Risk Özeti** — net kâr, yıldız araçlar, acil öncelik
- **Yönetici Araç Zekâsı** — filo özeti ve en yüksek riskli araç

## Yönetici Yetenekleri

- Filo genelinde kârlılık, sağlık ve risk dağılımı
- Acil/yüksek öncelikli araç listesi ve önerilen aksiyonlar
- En iyi performans ve en yüksek risk tabloları
- Araç detayda kompakt zekâ, sağlık, geçmiş ve kâr/risk özetleri

## Bilinen Sınırlamalar

v1.1 bilinçli olarak RBAC, dış bildirim kanalları, sürücü yönetimi ve export motoru kapsamı dışındadır. Ayrıntılar `data/release/v11-known-issues.json` dosyasında listelenmiştir.
