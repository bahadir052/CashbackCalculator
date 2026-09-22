// ==UserScript==
// @name         Cashback Calculator (All Brands)
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Casino ve Spor bahisleri için kayıp bonusu ve finans özeti hesaplayıcı. Brand 41 için kademeli sistem, diğer brandler için yüzdelik sistem.
// @author       BAHO
// @match        https://core-secundus.gmntc.com/*
// @match        https://sgp.gmntc.com/*
// @updateURL    https://raw.githubusercontent.com/bahadir052/CashbackCalculator/main/CashbackCalculator.user.js
// @downloadURL  https://raw.githubusercontent.com/bahadir052/CashbackCalculator/main/CashbackCalculator.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ============================================================
    // BRAND TANIMLARI
    // ============================================================
    // bonusKeyword: Bonus geçmişi (Bonuses) sekmesindeki "Plan" sütununda, o brand'in
    // anlık kayıp bonusunu tespit etmek için aranan anahtar kelime (büyük harfe çevrilip aranır).
    const BRANDS = [
        { id: 'B41', label: 'Brand 41', mode: 'tiered', bonusKeyword: 'PROGRESSIVE' },
        { id: 'B32', label: 'Brand 32', mode: 'percentage', bonusKeyword: 'INSTANT CB' },
        { id: 'B89', label: 'Brand 89', mode: 'percentage', bonusKeyword: 'INSTANT' },
        { id: 'B04', label: 'Brand 04', mode: 'percentage', bonusKeyword: 'INSTANT' },
        { id: 'B07', label: 'Brand 07', mode: 'percentage', bonusKeyword: 'INSTANT' },
    ];
    const STORAGE_KEY = 'cashbackCalc_selectedBrand';
    // @version ile senkron tutulmalı — her güncellemede birlikte artırılacak.
    const SCRIPT_VERSION = '2.1';
    const INFO_SEEN_VERSION_KEY = 'cashbackCalc_infoSeenVersion';

    function getBrandById(id) {
        return BRANDS.find(b => b.id === id) || null;
    }
    function loadSavedBrandId() {
        try {
            let saved = localStorage.getItem(STORAGE_KEY);
            if (saved && BRANDS.some(b => b.id === saved)) return saved;
        } catch (e) {}
        return null;
    }
    function saveBrandId(id) {
        try { localStorage.setItem(STORAGE_KEY, id); } catch (e) {}
    }

    let currentBrand = getBrandById(loadSavedBrandId());

    // ============================================================
    // ARAYÜZ OLUŞTURMA
    // ============================================================
    const brandOptionsHTML = BRANDS.map(b => `<option value="${b.id}">${b.label}</option>`).join('');

    const uiHTML = `
        <button id="btnToggleCalc" style="position:fixed; bottom:20px; right:20px; width:50px; height:50px; border-radius:25px; background:#00ff88; color:#000; font-size:24px; border:none; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.5); z-index:999999; display:flex; justify-content:center; align-items:center; transition:0.3s;" title="Hesaplayıcıyı Aç">
            🎰
        </button>

        <div id="bonusCalcPanel" style="position:fixed; bottom:80px; right:20px; width:340px; background:#1a1a24; color:#fff; font-family:Segoe UI, sans-serif; border-radius:12px; padding:15px; box-shadow:0 15px 35px rgba(0,0,0,0.9); z-index:999999; border: 1px solid #333; display:none;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #444; padding-bottom:10px; margin-bottom:12px;">
                <h3 style="margin:0; font-size:15px; color:#00ff88;">🎰 Cashback Calc <span id="brandBadge" style="color:#ffaa00; font-size:13px; margin-left:4px;"></span> <span style="font-size:10px; color:#aaa; margin-left:4px;">v2.1</span></h3>
                <div>
                    <button id="btnInfoCalc" style="background:none; border:none; color:#aaa; font-size:16px; cursor:pointer; padding:0; line-height:1; margin-right:8px;" title="Nasıl Kullanılır?">ℹ</button>
                    <button id="btnSettingsCalc" style="background:none; border:none; color:#aaa; font-size:16px; cursor:pointer; padding:0; line-height:1; margin-right:8px;" title="Ayarlar">⚙</button>
                    <button id="btnCloseCalc" style="background:none; border:none; color:#aaa; font-size:16px; cursor:pointer; padding:0; line-height:1;" title="Kapat">✖</button>
                </div>
            </div>

            <!-- INFO VIEW -->
            <div id="infoView" style="display:none;">
                <div style="font-size:12px; color:#ddd; line-height:1.6; max-height:360px; overflow-y:auto; margin-bottom:12px;">
                    <div style="color:#00ff88; font-weight:bold; margin-bottom:8px; font-size:13px;">Nasıl Kullanılır?</div>
                    <ol style="margin:0 0 12px 0; padding-left:18px;">
                        <li style="margin-bottom:6px;">Sağ üstteki <b>⚙ Ayarlar</b> ikonundan çalıştığın <b>Brand'i seç</b>. Bu seçim kaydedilir — aynı brand'de çalıştığın sürece bunu sadece <b>bir kere</b> yapman yeterli, tekrar seçmene gerek yok.</li>
                        <li style="margin-bottom:6px;">Oyuncunun <b>Bonuses</b> (bonus geçmişi) sayfasına gir.</li>
                        <li style="margin-bottom:6px;">Sonra <b>Transaction</b> sekmesine geç ve <b>her zaman son 24 saati</b> filtrele — daha önce bonus alınmış olsa bile artık kısa bir pencereye filtrelemene gerek yok, her durumda 24 saat filtrele.</li>
                    </ol>
                    <div style="background:#5a1010; border:1px solid #ff5555; padding:8px; border-radius:6px; margin-bottom:12px;">
                        <div style="color:#ff5555; font-weight:bold; margin-bottom:4px;">⚠️ Önemli:</div>
                        <div style="color:#ddd;">Transaction ekranında <b>"Show Details" toggle'ının AÇIK</b> olduğundan emin ol. Kapalıysa Real Debit, Playable Bonus gibi sütunlar ayrı gösterilmez ve hesaplama <b>0</b> çıkar.</div>
                    </div>
                    <div style="color:#ffaa00; font-weight:bold; margin-bottom:6px; font-size:12px;">Neden böyle?</div>
                    <p style="margin:0 0 8px 0;">Bonuses sayfasını ziyaret ettiğinde eklenti, o üyenin en son anlık kayıp bonusunun tam olarak ne zaman alındığını otomatik olarak hafızasına alıyor.</p>
                    <p style="margin:0 0 8px 0;">Transaction'a geçip 24 saati filtrelediğinde eklenti:</p>
                    <ul style="margin:0 0 8px 0; padding-left:18px;">
                        <li style="margin-bottom:4px;">Yatırım/çekim uygunluk kontrolünü <b>her zaman görünen tüm 24 saatlik pencereden</b> hesaplıyor,</li>
                        <li style="margin-bottom:4px;">Kayıp/kazanç (bonus tutarı) hesabını ise otomatik olarak <b>son bonus alım anından sonrasına</b> sınırlıyor.</li>
                    </ul>
                    <p style="margin:0 0 8px 0;">Yani eski sistemdeki gibi elle kısa bir pencereye filtreleme yapmana gerek yok — <b>her zaman 24 saat filtrele, gerisini eklenti hallediyor.</b> Bonuses sayfasına hiç girmezsen, eklenti eskisi gibi görünen tüm pencereyi hesaba katmaya devam eder.</p>
                    <p style="margin:0; color:#888; font-size:11px;">Panelde alt kısımdaki küçük yazı, hafızaya alınan son bonus bilgisini gösterir.</p>
                </div>
                <button id="btnBackInfo" style="width:100%; padding:10px; border-radius:8px; background:#333; color:#fff; font-weight:bold; border:none; cursor:pointer; font-size:13px;">
                    ← Geri
                </button>
            </div>

            <!-- SETTINGS VIEW -->
            <div id="settingsView" style="display:none;">
                <div style="margin-bottom:12px;">
                    <label style="font-size:12px; color:#aaa; display:block; margin-bottom:4px;">Brand Seçimi:</label>
                    <select id="brandSelect" style="width:100%; padding:10px; border-radius:6px; background:#222; border:1px solid #555; color:#fff; font-size:14px; outline:none; box-sizing:border-box;">
                        <option value="" disabled ${!currentBrand ? 'selected' : ''}>Seçiniz</option>
                        ${brandOptionsHTML}
                    </select>
                </div>
                <button id="btnBackSettings" style="width:100%; padding:10px; border-radius:8px; background:#333; color:#fff; font-weight:bold; border:none; cursor:pointer; font-size:13px;">
                    ← Geri
                </button>
            </div>

            <!-- MAIN VIEW -->
            <div id="mainView">
                <div id="percentageWrap" style="margin-bottom: 12px; display:none;">
                    <label style="font-size:12px; color:#aaa; display:block; margin-bottom:4px;">Kayıp Bonusu Yüzdesi (%):</label>
                    <input type="number" id="bonusPercentage" placeholder="Örn: 7 veya 10" style="width:100%; padding:10px; border-radius:6px; background:#222; border:1px solid #555; color:#fff; font-size:14px; outline:none; box-sizing:border-box;">
                </div>

                <div id="tieredWrap" style="margin-bottom: 12px; background:#222; padding:8px; border-radius:6px; border:1px solid #444; display:none;">
                    <label style="font-size:12px; color:#00ff88; display:block; text-align:center;">✓ Kademeli Limitsiz Nakit İade Aktif</label>
                </div>

                <div id="financeSummary" style="background:#1e1e28; padding:10px; border-radius:6px; margin-bottom:12px; border-left:4px solid #fff; display:none;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span style="color:#aaa; font-size:12px;">Toplam Yatırım:</span>
                        <span id="txtTotalDeposit" style="color:#00ff88; font-weight:bold; font-size:13px;">0.00 ₺</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span style="color:#aaa; font-size:12px;">Toplam Çekim:</span>
                        <span id="txtTotalWithdrawal" style="color:#ffaa00; font-weight:bold; font-size:13px;">0.00 ₺</span>
                    </div>
                </div>

                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <button id="btnCalcCasino" style="flex:1; padding:10px; border-radius:8px; background:#00e5ff; color:#000; font-weight:bold; border:none; cursor:pointer; font-size:13px; transition:0.2s;">
                        🎰 Casino Hesapla
                    </button>
                    <button id="btnCalcSports" style="flex:1; padding:10px; border-radius:8px; background:#ffaa00; color:#000; font-weight:bold; border:none; cursor:pointer; font-size:13px; transition:0.2s;">
                        ⚽ Spor Hesapla
                    </button>
                </div>

                <div id="bonusCalcResult" style="font-size:13px; max-height:400px; overflow-y:auto; display:none;"></div>
                <div id="bonusMemoryIndicator" style="font-size:10px; color:#888; margin-top:6px; text-align:center;"></div>
                <div id="debugNote" style="font-size:10px; color:#aaa; margin-top:5px; text-align:center;">Sonuç hatalıysa ekranı tam aşağı kaydırıp tekrar basın.</div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', uiHTML);

    const btnToggleCalc = document.getElementById('btnToggleCalc');
    const bonusCalcPanel = document.getElementById('bonusCalcPanel');
    const btnCloseCalc = document.getElementById('btnCloseCalc');
    const btnInfoCalc = document.getElementById('btnInfoCalc');
    const btnBackInfo = document.getElementById('btnBackInfo');
    const infoView = document.getElementById('infoView');
    const btnSettingsCalc = document.getElementById('btnSettingsCalc');
    const btnBackSettings = document.getElementById('btnBackSettings');
    const settingsView = document.getElementById('settingsView');
    const mainView = document.getElementById('mainView');
    const brandSelect = document.getElementById('brandSelect');
    const brandBadge = document.getElementById('brandBadge');
    const percentageWrap = document.getElementById('percentageWrap');
    const tieredWrap = document.getElementById('tieredWrap');

    const btnCalcCasino = document.getElementById('btnCalcCasino');
    const btnCalcSports = document.getElementById('btnCalcSports');
    const resultDiv = document.getElementById('bonusCalcResult');
    const bonusMemoryIndicator = document.getElementById('bonusMemoryIndicator');
    const bonusPercentageInput = document.getElementById('bonusPercentage');
    const financeSummary = document.getElementById('financeSummary');
    const txtTotalDeposit = document.getElementById('txtTotalDeposit');
    const txtTotalWithdrawal = document.getElementById('txtTotalWithdrawal');

    // ============================================================
    // AYARLAR / BRAND SEÇİMİ UI MANTIĞI
    // ============================================================
    function refreshBrandUI() {
        if (!currentBrand) {
            brandBadge.textContent = '| Brand seçilmedi';
            brandSelect.value = '';
            percentageWrap.style.display = 'none';
            tieredWrap.style.display = 'none';
            resultDiv.style.display = 'none';
            resultDiv.innerHTML = '';
            financeSummary.style.display = 'none';
            refreshBonusMemoryIndicator();
            return;
        }
        brandBadge.textContent = '| ' + currentBrand.label;
        brandSelect.value = currentBrand.id;
        if (currentBrand.mode === 'tiered') {
            percentageWrap.style.display = 'none';
            tieredWrap.style.display = 'block';
        } else {
            percentageWrap.style.display = 'block';
            tieredWrap.style.display = 'none';
        }
        // Brand değişince eski sonuçlar kafa karıştırmasın
        resultDiv.style.display = 'none';
        resultDiv.innerHTML = '';
        financeSummary.style.display = 'none';
        refreshBonusMemoryIndicator();
    }

    brandSelect.addEventListener('change', () => {
        if (!brandSelect.value) return;
        currentBrand = getBrandById(brandSelect.value);
        saveBrandId(currentBrand.id);
        refreshBrandUI();
    });

    btnSettingsCalc.addEventListener('click', () => {
        mainView.style.display = 'none';
        infoView.style.display = 'none';
        settingsView.style.display = 'block';
    });
    btnBackSettings.addEventListener('click', () => {
        settingsView.style.display = 'none';
        mainView.style.display = 'block';
    });

    function showInfoView() {
        mainView.style.display = 'none';
        settingsView.style.display = 'none';
        infoView.style.display = 'block';
    }
    function hasSeenInfoForCurrentVersion() {
        try {
            return localStorage.getItem(INFO_SEEN_VERSION_KEY) === SCRIPT_VERSION;
        } catch (e) { return true; }
    }
    function markInfoSeenForCurrentVersion() {
        try { localStorage.setItem(INFO_SEEN_VERSION_KEY, SCRIPT_VERSION); } catch (e) {}
    }

    btnInfoCalc.addEventListener('click', () => {
        showInfoView();
    });
    btnBackInfo.addEventListener('click', () => {
        infoView.style.display = 'none';
        mainView.style.display = 'block';
    });

    btnToggleCalc.addEventListener('click', () => {
        let willOpen = bonusCalcPanel.style.display === 'none';
        bonusCalcPanel.style.display = willOpen ? 'block' : 'none';
        if (willOpen && !hasSeenInfoForCurrentVersion()) {
            showInfoView();
            markInfoSeenForCurrentVersion();
        }
    });
    btnCloseCalc.addEventListener('click', () => {
        bonusCalcPanel.style.display = 'none';
    });

    refreshBrandUI();

    // ============================================================
    // ORTAK YARDIMCI FONKSİYONLAR
    // ============================================================
    function cleanMoney(val) {
        if (!val) return 0.0;
        let s = String(val).replace(/TRY|TL|€|\$|pre|post|,|\s/gi, '');
        let num = parseFloat(s);
        return isNaN(num) ? 0.0 : Math.abs(num);
    }

    // Provider (Product) sütununda "Even Bet Gaming" (poker sağlayıcısı) geçen satırlar hesaplamaya dahil edilmez.
    function isExcludedProvider(product) {
        return product.includes('EVEN BET GAMING');
    }

    // Brand 41: Kademeli Merdiven Bonusu Hesaplama Fonksiyonu
    function calculateTieredBonus(netLoss) {
        if (netLoss <= 0) return 0;
        let bonus = 0;
        let remaining = netLoss;

        // 1. Kademe: 0 - 10.000 (%10)
        let tier1 = Math.min(remaining, 10000);
        bonus += tier1 * 0.10;
        remaining -= tier1;
        if (remaining <= 0) return bonus;

        // 2. Kademe: 10.001 - 30.000 (%15) -> Bu aralık 20.000 TL kapsar
        let tier2 = Math.min(remaining, 20000);
        bonus += tier2 * 0.15;
        remaining -= tier2;
        if (remaining <= 0) return bonus;

        // 3. Kademe: 30.001 - 50.000 (%20) -> Bu aralık da 20.000 TL kapsar
        let tier3 = Math.min(remaining, 20000);
        bonus += tier3 * 0.20;
        remaining -= tier3;
        if (remaining <= 0) return bonus;

        // 4. Kademe: 50.001 ve üstü (%25) -> Kalan tüm tutar
        bonus += remaining * 0.25;

        return bonus;
    }

    function findTargetTable() {
        let tables = document.querySelectorAll('table');
        for (let tbl of tables) {
            if (tbl.textContent.includes('Real Debit') || tbl.textContent.includes('Date Time')) {
                return tbl;
            }
        }
        return null;
    }

    // ============================================================
    // BONUS HAFIZASI (ANLIK KAYIP BONUSU TAKİBİ)
    // ============================================================
    // "DD-MM-YYYY HH:mm:ss" formatındaki tarih metnini epoch ms'e çevirir.
    function parseTableDateTime(str) {
        if (!str) return null;
        let m = String(str).trim().match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
        if (!m) return null;
        let dd = Number(m[1]), mm = Number(m[2]), yyyy = Number(m[3]);
        let hh = Number(m[4]), min = Number(m[5]), ss = Number(m[6]);
        return new Date(yyyy, mm - 1, dd, hh, min, ss).getTime();
    }

    function getPlayerIdFromUrl() {
        let m = window.location.href.match(/\/players\/(\d+)\//);
        return m ? m[1] : null;
    }

    const BONUS_MEMORY_KEY = 'cashbackCalc_bonusMemory';
    const BONUS_MEMORY_TTL_MS = 7 * 60 * 1000; // 7 dakika

    function loadBonusMemoryStore() {
        try {
            return JSON.parse(localStorage.getItem(BONUS_MEMORY_KEY)) || {};
        } catch (e) { return {}; }
    }
    function saveBonusMemoryStore(store) {
        try { localStorage.setItem(BONUS_MEMORY_KEY, JSON.stringify(store)); } catch (e) {}
    }
    // 7 dakikayı geçen kayıtları temizler, geriye güncel store'u döner.
    function cleanExpiredBonusMemory() {
        let store = loadBonusMemoryStore();
        let now = Date.now();
        let changed = false;
        Object.keys(store).forEach(pid => {
            if (!store[pid] || (now - store[pid].capturedAt) > BONUS_MEMORY_TTL_MS) {
                delete store[pid];
                changed = true;
            }
        });
        if (changed) saveBonusMemoryStore(store);
        return store;
    }
    function getBonusMemoryForPlayer(playerId) {
        if (!playerId) return null;
        let store = cleanExpiredBonusMemory();
        return store[playerId] || null;
    }
    function setBonusMemoryForPlayer(playerId, data) {
        if (!playerId) return;
        let store = cleanExpiredBonusMemory();
        store[playerId] = Object.assign({}, data, { capturedAt: Date.now() });
        saveBonusMemoryStore(store);
    }

    function isBonusHistoryPage() {
        return window.location.href.includes('/detail/(popup:bonus-history)');
    }

    function findBonusHistoryTable() {
        let tables = document.querySelectorAll('table');
        for (let tbl of tables) {
            if (tbl.textContent.includes('Trigger Date') && tbl.textContent.includes('Plan')) {
                return tbl;
            }
        }
        return null;
    }

    // Bonuses (bonus-history) popup'ı açıkken tabloyu tarar, aktif brand'in anlık kayıp
    // bonusuna ait EN YENİ "Trigger Date"li satırı bulup player ID'ye göre hafızaya alır.
    function scanBonusHistory() {
        if (!isBonusHistoryPage()) return;
        if (!currentBrand) return;
        let playerId = getPlayerIdFromUrl();
        if (!playerId) return;

        let table = findBonusHistoryTable();
        if (!table) return;

        let thead = table.querySelector('thead tr');
        let tbody = table.querySelector('tbody');
        if (!thead || !tbody) return;

        let headers = Array.from(thead.cells).map(th => th.textContent.trim().toLowerCase().replace(/\s+/g, ' '));
        let planIdx = headers.findIndex(h => h.includes('plan'));
        let triggerDateIdx = headers.findIndex(h => h.includes('trigger date'));
        let amountIdx = headers.findIndex(h => h === 'amount');
        if (amountIdx === -1) amountIdx = headers.findIndex(h => h.includes('amount'));

        if (planIdx === -1 || triggerDateIdx === -1) return;

        let keyword = currentBrand.bonusKeyword;
        let bestTs = -Infinity;
        let bestDateText = "";
        let bestAmountText = "";

        tbody.querySelectorAll('tr').forEach(row => {
            let cells = row.cells;
            if (!cells[planIdx] || !cells[triggerDateIdx]) return;
            let planText = cells[planIdx].textContent.trim().toUpperCase();
            if (!planText.includes(keyword)) return;
            let ts = parseTableDateTime(cells[triggerDateIdx].textContent);
            if (ts === null) return;
            if (ts > bestTs) {
                bestTs = ts;
                bestDateText = cells[triggerDateIdx].textContent.trim();
                bestAmountText = (amountIdx !== -1 && cells[amountIdx]) ? cells[amountIdx].textContent.trim() : "";
            }
        });

        if (bestTs > -Infinity) {
            setBonusMemoryForPlayer(playerId, {
                triggerTs: bestTs,
                triggerDateText: bestDateText,
                amountText: bestAmountText,
                brandId: currentBrand.id
            });
            refreshBonusMemoryIndicator();
        }
    }

    // Panelde, geçerli oyuncu için hafızada tutulan anlık kayıp bonusu bilgisini küçük yazıyla gösterir.
    function refreshBonusMemoryIndicator() {
        if (!bonusMemoryIndicator) return;
        let playerId = getPlayerIdFromUrl();
        let mem = getBonusMemoryForPlayer(playerId);
        if (!currentBrand || !mem || mem.brandId !== currentBrand.id) {
            bonusMemoryIndicator.textContent = '';
            return;
        }
        let dakika = Math.floor((Date.now() - mem.capturedAt) / 60000);
        bonusMemoryIndicator.textContent = `Hafızadaki anlık kayıp bonusu: ${mem.triggerDateText}${mem.amountText ? ' - ' + mem.amountText : ''} (${dakika} dk önce tespit edildi)`;
    }

    setInterval(scanBonusHistory, 2000);
    setInterval(cleanExpiredBonusMemory, 30000);
    setInterval(refreshBonusMemoryIndicator, 5000);

    // ============================================================
    // BRAND 41 HESAPLAMA MANTIĞI (B41 Edition 1.3 ile birebir aynı)
    // ============================================================
    function runCalculationB41(mode) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<span style="color:#ffaa00;">Tablo taranıyor...</span>';

        try {
            let targetTable = findTargetTable();
            if (!targetTable) {
                resultDiv.innerHTML = '<span style="color:red;">Hata: Hesaplamaya uygun tablo bulunamadı!</span>';
                return;
            }

            let thead = targetTable.querySelector('thead tr');
            let tbody = targetTable.querySelector('tbody');

            let headers = Array.from(thead.cells).map(th => th.textContent.trim().toLowerCase().replace(/\s+/g, ' '));

            let typeIdx = headers.findIndex(h => h.includes('type'));
            let debitIdx = headers.findIndex(h => h.includes('real debit'));
            let creditIdx = headers.findIndex(h => h.includes('real credit'));
            let relBonusIdx = headers.findIndex(h => h.includes('released bonus credit'));
            let productIdx = headers.findIndex(h => h.includes('product') && !h.includes('amount'));
            let tranIdIdx = headers.findIndex(h => h.includes('game tran id') || h.includes('game id'));
            let dateTimeIdx = headers.findIndex(h => h.includes('date time'));

            if (typeIdx === -1) typeIdx = 2;
            if (debitIdx === -1) debitIdx = 4;
            if (creditIdx === -1) creditIdx = 5;
            if (relBonusIdx === -1) relBonusIdx = 8;
            if (productIdx === -1) productIdx = 13;
            if (tranIdIdx === -1) tranIdIdx = 15;
            if (dateTimeIdx === -1) dateTimeIdx = 1;

            let cBahis = 0, cKazanc = 0;
            let sBahis = 0, sKazanc = 0, sCashOutFarki = 0;
            let totalBonusRel = 0;
            let sporBahisHafizasi = {};
            let cashoutYapilanTranIdler = new Set();
            let missingCashOutIds = [];

            let tDeposit = 0;
            let rawWithdrawal = 0;
            let canceledWithdrawal = 0;

            let rows = tbody.querySelectorAll('tr');
            let islenenSatirCount = 0;

            // --- ANLIK KAYIP BONUSU KESİM NOKTASI (varsa) ---
            // Hafızada bu oyuncu/brand için geçerli bir bonus kaydı varsa VE bu tabloda
            // aynı zaman damgasına sahip bir CRE_BONUS satırı gerçekten bulunuyorsa,
            // oyun/bonus hesabı SADECE bu satırdan sonrasını kapsayacak. Deposit/Withdrawal
            // toplamları buna bakılmaksızın her zaman tüm görünen pencereyi kapsar.
            let cutoffTs = null;
            let bonusMemory = getBonusMemoryForPlayer(getPlayerIdFromUrl());
            if (bonusMemory && bonusMemory.brandId === currentBrand.id) {
                let matchFound = false;
                rows.forEach(row => {
                    let cells = row.cells;
                    if (cells.length < 15) return;
                    let type = cells[typeIdx].textContent.trim().toUpperCase();
                    if (type !== 'CRE_BONUS') return;
                    let ts = cells[dateTimeIdx] ? parseTableDateTime(cells[dateTimeIdx].textContent) : null;
                    if (ts !== null && ts === bonusMemory.triggerTs) matchFound = true;
                });
                if (matchFound) cutoffTs = bonusMemory.triggerTs;
            }

            // --- 1. AŞAMA (ÖN TARAMA) ---
            rows.forEach(row => {
                let cells = row.cells;
                if (cells.length < 15) return;

                let type = cells[typeIdx].textContent.trim().toUpperCase();
                let product = cells[productIdx].textContent.trim().toUpperCase();
                let tranId = cells[tranIdIdx].textContent.trim();
                let debit = cleanMoney(cells[debitIdx].textContent);

                if (isExcludedProvider(product)) return;

                if (cutoffTs !== null) {
                    let rowTs = cells[dateTimeIdx] ? parseTableDateTime(cells[dateTimeIdx].textContent) : null;
                    if (rowTs === null || rowTs <= cutoffTs) return;
                }

                if (type === 'GAME_BET' && tranId && tranId !== "") {
                    sporBahisHafizasi[tranId] = debit;
                }
                if (type === 'CASH_OUT' && tranId && tranId !== "") {
                    cashoutYapilanTranIdler.add(tranId);
                }
            });

            // --- 2. AŞAMA (ANA HESAPLAMA) ---
            rows.forEach((row) => {
                let cells = row.cells;
                if (cells.length < 15) return;

                let type = cells[typeIdx].textContent.trim().toUpperCase();
                let product = cells[productIdx].textContent.trim().toUpperCase();
                let tranId = cells[tranIdIdx].textContent.trim();
                let anaIslemNo = cells[0] ? cells[0].textContent.trim() : "Bilinmeyen";

                let debit = cleanMoney(cells[debitIdx].textContent);
                let credit = cleanMoney(cells[creditIdx].textContent);
                let relBonus = cleanMoney(cells[relBonusIdx].textContent);
                let amount = debit + credit;

                if (!type || type === "") return;
                if (isExcludedProvider(product)) return;

                islenenSatirCount++;
                let isSports = product.includes('BETBY') || product.includes('DIGITAIN');

                // Deposit/Withdrawal (uygunluk kontrolü için) her zaman TÜM görünen pencereyi kapsar.
                if (type === 'DEPOSIT') { tDeposit += amount; }
                else if (type === 'WITHDRAWAL') { rawWithdrawal += amount; }
                else if (type === 'WD_CANCEL' || type === 'WD_REJECT') { canceledWithdrawal += amount; }

                // Oyun/bonus hesabı, varsa cutoff'tan SONRAKİ satırlarla sınırlı.
                let rowTs = cells[dateTimeIdx] ? parseTableDateTime(cells[dateTimeIdx].textContent) : null;
                let beforeCutoff = cutoffTs !== null && (rowTs === null || rowTs <= cutoffTs);
                if (beforeCutoff) return;

                if (type === 'BONUS_REL' || type === 'CRE_BONUS') {
                    totalBonusRel += relBonus;
                }
                else if (isSports) {
                    if (type === 'GAME_BET') {
                        if (!(tranId && cashoutYapilanTranIdler.has(tranId))) {
                            sBahis += debit;
                        }
                    }
                    else if (type === 'GAME_WIN') { sKazanc += credit; }
                    else if (type === 'CASH_OUT') {
                        if (tranId && sporBahisHafizasi.hasOwnProperty(tranId)) {
                            let gameBetTutari = sporBahisHafizasi[tranId];
                            sCashOutFarki += (credit - gameBetTutari);
                        } else {
                            let gosterilecekId = (tranId && tranId.replace(/\s/g, '') !== "") ? tranId : ("Satır No: " + anaIslemNo);
                            missingCashOutIds.push(gosterilecekId);
                            sCashOutFarki += credit;
                        }
                    }
                } else {
                    if (type === 'GAME_BET' || type === 'GAME_WIN') {
                        cBahis += debit;
                        cKazanc += credit;
                    }
                }
            });

            let netWithdrawal = rawWithdrawal - canceledWithdrawal;
            if (netWithdrawal < 0) netWithdrawal = 0;

            txtTotalDeposit.innerText = tDeposit.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';
            txtTotalWithdrawal.innerText = netWithdrawal.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';
            financeSummary.style.display = 'block';
            refreshBonusMemoryIndicator();

            let missingWarningHTML = "";
            if (mode === 'sports' && missingCashOutIds.length > 0) {
                let uniqueMissing = [...new Set(missingCashOutIds)];
                missingWarningHTML = `
                    <div style="background:#5a1010; border:1px solid #ff5555; padding:10px; border-radius:6px; margin-bottom:10px;">
                        <div style="color:#ff5555; font-weight:bold; font-size:12px; margin-bottom:5px;">⚠️ DİKKAT: EKSİK CASH OUT!</div>
                        <div style="color:#ddd; font-size:11px; margin-bottom:5px;">Aşağıdaki işlemlere ait ilk bahis (GAME_BET) ekranda bulunamadı. Lütfen farkı manuel kontrol edin:</div>
                        <div style="color:#ffaa00; font-size:12px; word-break: break-all; font-family:monospace;">${uniqueMissing.join('<br>')}</div>
                    </div>
                `;
            }

            if (mode === 'casino') {
                let casinoNet = cBahis - cKazanc - totalBonusRel;
                let bonusTutari = calculateTieredBonus(casinoNet);

                resultDiv.innerHTML = `
                    <div style="background:#222; padding:10px; border-radius:6px; margin-bottom:10px; border-left:4px solid #00e5ff;">
                        <div style="color:#00e5ff; font-weight:bold; margin-bottom:6px; font-size:13px;">🎰 CASINO ÖZETİ</div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                            <span>Bahis:</span> <span style="color:#ddd;">${cBahis.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                            <span>Kazanç:</span> <span style="color:#ddd;">${cKazanc.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                            <span title="Tüm Bonuslar">Toplam Bonus_Rel:</span> <span style="color:#ff5555;">- ${totalBonusRel.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-top:5px; border-top:1px solid #444; padding-top:5px; font-weight:bold;">
                            <span style="color:#00e5ff;">CASINO NET:</span> <span style="color:#00e5ff;">${casinoNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                        </div>
                    </div>

                    <div style="background:#111; padding:12px; border-radius:6px; border:1px solid #00e5ff; text-align:center;">
                        <div style="color:#aaa; font-size:11px; margin-bottom:4px;">Okunan Satır Sayısı: ${islenenSatirCount}</div>
                        <div style="color:#aaa; font-size:14px; margin-bottom:8px;">NET KAYIP: <span style="color:#fff;">${casinoNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span></div>
                        <div style="border-top:1px dashed #444; padding-top:10px;">
                            <div style="color:#aaa; font-size:12px; margin-bottom:4px;">HESAPLANAN BONUS (Kademeli Sistem)</div>
                            <div style="color:#00ff88; font-size:22px; font-weight:bold;">${bonusTutari.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
                        </div>
                    </div>
                `;
            }
            else if (mode === 'sports') {
                let sporNet = sBahis - (sKazanc + totalBonusRel + sCashOutFarki);
                let bonusTutari = calculateTieredBonus(sporNet);

                resultDiv.innerHTML = missingWarningHTML + `
                    <div style="background:#222; padding:10px; border-radius:6px; margin-bottom:10px; border-left:4px solid #ffaa00;">
                        <div style="color:#ffaa00; font-weight:bold; margin-bottom:6px; font-size:13px;">⚽ SPOR ÖZETİ</div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                            <span>Bahis:</span> <span style="color:#ddd;">${sBahis.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                            <span>Kazanç:</span> <span style="color:#ddd;">${sKazanc.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                            <span title="Tüm Bonuslar">Toplam Bonus_Rel:</span> <span style="color:#ff5555;">- ${totalBonusRel.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                            <span>Cash Out Farkı:</span> <span style="color:#aaa;">${sCashOutFarki.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-top:5px; border-top:1px solid #444; padding-top:5px; font-weight:bold;">
                            <span style="color:#ffaa00;">SPOR NET:</span> <span style="color:#ffaa00;">${sporNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                        </div>
                    </div>

                    <div style="background:#111; padding:12px; border-radius:6px; border:1px solid #ffaa00; text-align:center;">
                        <div style="color:#aaa; font-size:11px; margin-bottom:4px;">Okunan Satır Sayısı: ${islenenSatirCount}</div>
                        <div style="color:#aaa; font-size:14px; margin-bottom:8px;">NET KAYIP: <span style="color:#fff;">${sporNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span></div>
                        <div style="border-top:1px dashed #444; padding-top:10px;">
                            <div style="color:#aaa; font-size:12px; margin-bottom:4px;">HESAPLANAN BONUS (Kademeli Sistem)</div>
                            <div style="color:#00ff88; font-size:22px; font-weight:bold;">${bonusTutari.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
                        </div>
                    </div>
                `;
            }
        } catch (err) {
            resultDiv.innerHTML = `<span style="color:red;">Hata: ${err.message}</span>`;
        }
    }

    // ============================================================
    // DİĞER BRANDLER HESAPLAMA MANTIĞI (Calculator 1.2 ile birebir aynı)
    // ============================================================
    function runCalculationStandard(mode) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<span style="color:#ffaa00;">Tablo taranıyor...</span>';

        let percentValue = parseFloat(bonusPercentageInput.value) || 0;

        try {
            let targetTable = findTargetTable();
            if (!targetTable) {
                resultDiv.innerHTML = '<span style="color:red;">Hata: Hesaplamaya uygun tablo bulunamadı!</span>';
                return;
            }

            let thead = targetTable.querySelector('thead tr');
            let tbody = targetTable.querySelector('tbody');

            let headers = Array.from(thead.cells).map(th => th.textContent.trim().toLowerCase().replace(/\s+/g, ' '));

            let typeIdx = headers.findIndex(h => h.includes('type'));
            let debitIdx = headers.findIndex(h => h.includes('real debit'));
            let creditIdx = headers.findIndex(h => h.includes('real credit'));
            let relBonusCreditIdx = headers.findIndex(h => h.includes('released bonus credit'));
            let relBonusDebitIdx = headers.findIndex(h => h.includes('released bonus debit'));
            let productIdx = headers.findIndex(h => h.includes('product') && !h.includes('amount'));
            let tranIdIdx = headers.findIndex(h => h.includes('game tran id') || h.includes('game id'));
            let dateTimeIdx = headers.findIndex(h => h.includes('date time'));

            if (typeIdx === -1) typeIdx = 2;
            if (debitIdx === -1) debitIdx = 4;
            if (creditIdx === -1) creditIdx = 5;
            if (relBonusCreditIdx === -1) relBonusCreditIdx = 8;
            if (relBonusDebitIdx === -1) relBonusDebitIdx = 7;
            if (productIdx === -1) productIdx = 13;
            if (tranIdIdx === -1) tranIdIdx = 15;
            if (dateTimeIdx === -1) dateTimeIdx = 1;

            let cBahis = 0, cKazanc = 0;
            let sBahis = 0, sKazanc = 0, sCashOutFarki = 0;
            let totalBonusRel = 0;
            let sporBahisHafizasi = {};
            let cashoutYapilanTranIdler = new Set();
            let missingCashOutIds = [];

            let tDeposit = 0;
            let rawWithdrawal = 0;
            let canceledWithdrawal = 0;

            let rows = tbody.querySelectorAll('tr');
            let islenenSatirCount = 0;

            // --- ANLIK KAYIP BONUSU KESİM NOKTASI (varsa) ---
            let cutoffTs = null;
            let bonusMemory = getBonusMemoryForPlayer(getPlayerIdFromUrl());
            if (bonusMemory && bonusMemory.brandId === currentBrand.id) {
                let matchFound = false;
                rows.forEach(row => {
                    let cells = row.cells;
                    if (cells.length < 15) return;
                    let type = cells[typeIdx].textContent.trim().toUpperCase();
                    if (type !== 'CRE_BONUS') return;
                    let ts = cells[dateTimeIdx] ? parseTableDateTime(cells[dateTimeIdx].textContent) : null;
                    if (ts !== null && ts === bonusMemory.triggerTs) matchFound = true;
                });
                if (matchFound) cutoffTs = bonusMemory.triggerTs;
            }

            // --- 1. AŞAMA (ÖN TARAMA) ---
            rows.forEach(row => {
                let cells = row.cells;
                if (cells.length < 15) return;

                let type = cells[typeIdx].textContent.trim().toUpperCase();
                let product = cells[productIdx].textContent.trim().toUpperCase();
                let tranId = cells[tranIdIdx].textContent.trim();
                let debit = cleanMoney(cells[debitIdx].textContent);

                if (isExcludedProvider(product)) return;

                if (cutoffTs !== null) {
                    let rowTs = cells[dateTimeIdx] ? parseTableDateTime(cells[dateTimeIdx].textContent) : null;
                    if (rowTs === null || rowTs <= cutoffTs) return;
                }

                if (type === 'GAME_BET' && tranId && tranId !== "") {
                    sporBahisHafizasi[tranId] = debit;
                }
                if (type === 'CASH_OUT' && tranId && tranId !== "") {
                    cashoutYapilanTranIdler.add(tranId);
                }
            });

            // --- 2. AŞAMA (ANA HESAPLAMA) ---
            rows.forEach((row) => {
                let cells = row.cells;
                if (cells.length < 15) return;

                let type = cells[typeIdx].textContent.trim().toUpperCase();
                let product = cells[productIdx].textContent.trim().toUpperCase();
                let tranId = cells[tranIdIdx].textContent.trim();
                let anaIslemNo = cells[0] ? cells[0].textContent.trim() : "Bilinmeyen";

                let debit = cleanMoney(cells[debitIdx].textContent);
                let credit = cleanMoney(cells[creditIdx].textContent);

                let relBonusCredit = cells[relBonusCreditIdx] ? cleanMoney(cells[relBonusCreditIdx].textContent) : 0;
                let relBonusDebit = cells[relBonusDebitIdx] ? cleanMoney(cells[relBonusDebitIdx].textContent) : 0;

                let amount = debit + credit + relBonusCredit + relBonusDebit;

                if (!type || type === "") return;
                if (isExcludedProvider(product)) return;

                islenenSatirCount++;
                let isSports = product.includes('BETBY') || product.includes('DIGITAIN');

                // Deposit/Withdrawal (uygunluk kontrolü için) her zaman TÜM görünen pencereyi kapsar.
                if (type === 'DEPOSIT') { tDeposit += amount; }
                else if (type === 'WITHDRAWAL') { rawWithdrawal += amount; }
                else if (type === 'WD_CANCEL' || type === 'WD_REJECT') { canceledWithdrawal += amount; }

                // Oyun/bonus hesabı, varsa cutoff'tan SONRAKİ satırlarla sınırlı.
                let rowTs = cells[dateTimeIdx] ? parseTableDateTime(cells[dateTimeIdx].textContent) : null;
                let beforeCutoff = cutoffTs !== null && (rowTs === null || rowTs <= cutoffTs);
                if (beforeCutoff) return;

                if (type === 'BONUS_REL' || type === 'CRE_BONUS') {
                    totalBonusRel += relBonusCredit;
                }
                else if (isSports) {
                    if (type === 'GAME_BET') {
                        if (!(tranId && cashoutYapilanTranIdler.has(tranId))) {
                            sBahis += debit;
                        }
                    }
                    else if (type === 'GAME_WIN') { sKazanc += credit; }
                    else if (type === 'CASH_OUT') {
                        if (tranId && sporBahisHafizasi.hasOwnProperty(tranId)) {
                            let gameBetTutari = sporBahisHafizasi[tranId];
                            sCashOutFarki += (credit - gameBetTutari);
                        } else {
                            let gosterilecekId = (tranId && tranId.replace(/\s/g, '') !== "") ? tranId : ("Satır No: " + anaIslemNo);
                            missingCashOutIds.push(gosterilecekId);
                            sCashOutFarki += credit;
                        }
                    }
                } else {
                    if (type === 'GAME_BET' || type === 'GAME_WIN') {
                        cBahis += debit;
                        cKazanc += credit;
                    }
                }
            });

            let netWithdrawal = rawWithdrawal - canceledWithdrawal;
            if (netWithdrawal < 0) netWithdrawal = 0;

            txtTotalDeposit.innerText = tDeposit.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';
            txtTotalWithdrawal.innerText = netWithdrawal.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺';
            financeSummary.style.display = 'block';
            refreshBonusMemoryIndicator();

            let missingWarningHTML = "";
            if (mode === 'sports' && missingCashOutIds.length > 0) {
                let uniqueMissing = [...new Set(missingCashOutIds)];
                missingWarningHTML = `
                    <div style="background:#5a1010; border:1px solid #ff5555; padding:10px; border-radius:6px; margin-bottom:10px;">
                        <div style="color:#ff5555; font-weight:bold; font-size:12px; margin-bottom:5px;">⚠️ DİKKAT: EKSİK CASH OUT!</div>
                        <div style="color:#ddd; font-size:11px; margin-bottom:5px;">Aşağıdaki işlemlere ait ilk bahis (GAME_BET) ekranda bulunamadı. Lütfen farkı manuel kontrol edin:</div>
                        <div style="color:#ffaa00; font-size:12px; word-break: break-all; font-family:monospace;">${uniqueMissing.join('<br>')}</div>
                    </div>
                `;
            }

            if (mode === 'casino') {
                let casinoNet = cBahis - cKazanc - totalBonusRel;
                let bonusTutari = casinoNet > 0 ? (casinoNet * (percentValue / 100)) : 0;

                resultDiv.innerHTML = `
                    <div style="background:#222; padding:10px; border-radius:6px; margin-bottom:10px; border-left:4px solid #00e5ff;">
                        <div style="color:#00e5ff; font-weight:bold; margin-bottom:6px; font-size:13px;">🎰 CASINO ÖZETİ</div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                            <span>Bahis:</span> <span style="color:#ddd;">${cBahis.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                            <span>Kazanç:</span> <span style="color:#ddd;">${cKazanc.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                            <span title="Tüm Bonuslar">Toplam Bonus_Rel:</span> <span style="color:#ff5555;">- ${totalBonusRel.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-top:5px; border-top:1px solid #444; padding-top:5px; font-weight:bold;">
                            <span style="color:#00e5ff;">CASINO NET:</span> <span style="color:#00e5ff;">${casinoNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                        </div>
                    </div>

                    <div style="background:#111; padding:12px; border-radius:6px; border:1px solid #00e5ff; text-align:center;">
                        <div style="color:#aaa; font-size:14px; margin-bottom:8px;">NET KAYIP: <span style="color:#fff;">${casinoNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span></div>
                        <div style="border-top:1px dashed #444; padding-top:10px;">
                            <div style="color:#aaa; font-size:12px; margin-bottom:4px;">HESAPLANAN BONUS (%${percentValue})</div>
                            <div style="color:#00ff88; font-size:22px; font-weight:bold;">${bonusTutari.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
                        </div>
                    </div>
                `;
            }
            else if (mode === 'sports') {
                let sporNet = sBahis - (sKazanc + totalBonusRel + sCashOutFarki);
                let bonusTutari = sporNet > 0 ? (sporNet * (percentValue / 100)) : 0;

                resultDiv.innerHTML = missingWarningHTML + `
                    <div style="background:#222; padding:10px; border-radius:6px; margin-bottom:10px; border-left:4px solid #ffaa00;">
                        <div style="color:#ffaa00; font-weight:bold; margin-bottom:6px; font-size:13px;">⚽ SPOR ÖZETİ</div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                            <span>Bahis:</span> <span style="color:#ddd;">${sBahis.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                            <span>Kazanç:</span> <span style="color:#ddd;">${sKazanc.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                            <span title="Tüm Bonuslar">Toplam Bonus_Rel:</span> <span style="color:#ff5555;">- ${totalBonusRel.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                            <span>Cash Out Farkı:</span> <span style="color:#aaa;">${sCashOutFarki.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-top:5px; border-top:1px solid #444; padding-top:5px; font-weight:bold;">
                            <span style="color:#ffaa00;">SPOR NET:</span> <span style="color:#ffaa00;">${sporNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span>
                        </div>
                    </div>

                    <div style="background:#111; padding:12px; border-radius:6px; border:1px solid #ffaa00; text-align:center;">
                        <div style="color:#aaa; font-size:14px; margin-bottom:8px;">NET KAYIP: <span style="color:#fff;">${sporNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</span></div>
                        <div style="border-top:1px dashed #444; padding-top:10px;">
                            <div style="color:#aaa; font-size:12px; margin-bottom:4px;">HESAPLANAN BONUS (%${percentValue})</div>
                            <div style="color:#00ff88; font-size:22px; font-weight:bold;">${bonusTutari.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺</div>
                        </div>
                    </div>
                `;
            }
        } catch (err) {
            resultDiv.innerHTML = `<span style="color:red;">Hata: ${err.message}</span>`;
        }
    }

    // ============================================================
    // BRAND'E GÖRE YÖNLENDİRME
    // ============================================================
    function runCalculation(mode) {
        if (!currentBrand) {
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '<span style="color:red;">Önce ⚙ Ayarlar\'dan bir Brand seçmelisin!</span>';
            return;
        }
        if (currentBrand.mode === 'tiered') {
            runCalculationB41(mode);
        } else {
            runCalculationStandard(mode);
        }
    }

    btnCalcCasino.addEventListener('click', () => runCalculation('casino'));
    btnCalcSports.addEventListener('click', () => runCalculation('sports'));

})();
