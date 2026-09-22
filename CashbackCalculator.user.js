// ==UserScript==
// @name         Cashback Calculator (All Brands)
// @namespace    http://tampermonkey.net/
// @version      2.0
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
    const BRANDS = [
        { id: 'B41', label: 'Brand 41', mode: 'tiered' },
        { id: 'B32', label: 'Brand 32', mode: 'percentage' },
        { id: 'B89', label: 'Brand 89', mode: 'percentage' },
        { id: 'B04', label: 'Brand 04', mode: 'percentage' },
        { id: 'B07', label: 'Brand 07', mode: 'percentage' },
    ];
    const STORAGE_KEY = 'cashbackCalc_selectedBrand';

    function getBrandById(id) {
        return BRANDS.find(b => b.id === id) || BRANDS[0];
    }
    function loadSavedBrandId() {
        try {
            let saved = localStorage.getItem(STORAGE_KEY);
            if (saved && BRANDS.some(b => b.id === saved)) return saved;
        } catch (e) {}
        return BRANDS[0].id;
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
                <h3 style="margin:0; font-size:15px; color:#00ff88;">🎰 Cashback Calc <span id="brandBadge" style="color:#ffaa00; font-size:13px; margin-left:4px;"></span> <span style="font-size:10px; color:#aaa; margin-left:4px;">v2.0</span></h3>
                <div>
                    <button id="btnSettingsCalc" style="background:none; border:none; color:#aaa; font-size:16px; cursor:pointer; padding:0; line-height:1; margin-right:8px;" title="Ayarlar">⚙</button>
                    <button id="btnCloseCalc" style="background:none; border:none; color:#aaa; font-size:16px; cursor:pointer; padding:0; line-height:1;" title="Kapat">✖</button>
                </div>
            </div>

            <!-- SETTINGS VIEW -->
            <div id="settingsView" style="display:none;">
                <div style="margin-bottom:12px;">
                    <label style="font-size:12px; color:#aaa; display:block; margin-bottom:4px;">Brand Seçimi:</label>
                    <select id="brandSelect" style="width:100%; padding:10px; border-radius:6px; background:#222; border:1px solid #555; color:#fff; font-size:14px; outline:none; box-sizing:border-box;">
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
                <div id="debugNote" style="font-size:10px; color:#aaa; margin-top:5px; text-align:center;">Sonuç hatalıysa ekranı tam aşağı kaydırıp tekrar basın.</div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', uiHTML);

    const btnToggleCalc = document.getElementById('btnToggleCalc');
    const bonusCalcPanel = document.getElementById('bonusCalcPanel');
    const btnCloseCalc = document.getElementById('btnCloseCalc');
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
    const bonusPercentageInput = document.getElementById('bonusPercentage');
    const financeSummary = document.getElementById('financeSummary');
    const txtTotalDeposit = document.getElementById('txtTotalDeposit');
    const txtTotalWithdrawal = document.getElementById('txtTotalWithdrawal');

    // ============================================================
    // AYARLAR / BRAND SEÇİMİ UI MANTIĞI
    // ============================================================
    function refreshBrandUI() {
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
    }

    brandSelect.addEventListener('change', () => {
        currentBrand = getBrandById(brandSelect.value);
        saveBrandId(currentBrand.id);
        refreshBrandUI();
    });

    btnSettingsCalc.addEventListener('click', () => {
        mainView.style.display = 'none';
        settingsView.style.display = 'block';
    });
    btnBackSettings.addEventListener('click', () => {
        settingsView.style.display = 'none';
        mainView.style.display = 'block';
    });

    btnToggleCalc.addEventListener('click', () => {
        bonusCalcPanel.style.display = bonusCalcPanel.style.display === 'none' ? 'block' : 'none';
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

            if (typeIdx === -1) typeIdx = 2;
            if (debitIdx === -1) debitIdx = 4;
            if (creditIdx === -1) creditIdx = 5;
            if (relBonusIdx === -1) relBonusIdx = 8;
            if (productIdx === -1) productIdx = 13;
            if (tranIdIdx === -1) tranIdIdx = 15;

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

            // --- 1. AŞAMA (ÖN TARAMA) ---
            rows.forEach(row => {
                let cells = row.cells;
                if (cells.length < 15) return;

                let type = cells[typeIdx].textContent.trim().toUpperCase();
                let product = cells[productIdx].textContent.trim().toUpperCase();
                let tranId = cells[tranIdIdx].textContent.trim();
                let debit = cleanMoney(cells[debitIdx].textContent);

                if (isExcludedProvider(product)) return;

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

                if (type === 'DEPOSIT') { tDeposit += amount; }
                else if (type === 'WITHDRAWAL') { rawWithdrawal += amount; }
                else if (type === 'WD_CANCEL' || type === 'WD_REJECT') { canceledWithdrawal += amount; }

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

            if (typeIdx === -1) typeIdx = 2;
            if (debitIdx === -1) debitIdx = 4;
            if (creditIdx === -1) creditIdx = 5;
            if (relBonusCreditIdx === -1) relBonusCreditIdx = 8;
            if (relBonusDebitIdx === -1) relBonusDebitIdx = 7;
            if (productIdx === -1) productIdx = 13;
            if (tranIdIdx === -1) tranIdIdx = 15;

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

            // --- 1. AŞAMA (ÖN TARAMA) ---
            rows.forEach(row => {
                let cells = row.cells;
                if (cells.length < 15) return;

                let type = cells[typeIdx].textContent.trim().toUpperCase();
                let product = cells[productIdx].textContent.trim().toUpperCase();
                let tranId = cells[tranIdIdx].textContent.trim();
                let debit = cleanMoney(cells[debitIdx].textContent);

                if (isExcludedProvider(product)) return;

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

                if (type === 'DEPOSIT') { tDeposit += amount; }
                else if (type === 'WITHDRAWAL') { rawWithdrawal += amount; }
                else if (type === 'WD_CANCEL' || type === 'WD_REJECT') { canceledWithdrawal += amount; }

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
        if (currentBrand.mode === 'tiered') {
            runCalculationB41(mode);
        } else {
            runCalculationStandard(mode);
        }
    }

    btnCalcCasino.addEventListener('click', () => runCalculation('casino'));
    btnCalcSports.addEventListener('click', () => runCalculation('sports'));

})();
