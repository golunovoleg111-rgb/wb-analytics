import ImportService, { ImportTypes } from '../services/ImportService.js';

const TYPE_RULES = [
    [ImportTypes.NOMENCLATURE, ['номенклатура']],
    [ImportTypes.SALES, ['продаж', 'продажи по дням']],
    [ImportTypes.STOCK_DAILY, ['остатки по дням', 'история остатков']],
    [ImportTypes.STOCK_CURRENT, ['текущие остатки']],
    [ImportTypes.PRICES, ['цены', 'скидки']],
    [ImportTypes.MARGIN, ['маржинальность', 'юнит-экономика']],
    [ImportTypes.ADS, ['реклама']]
];
const escapeHtml = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

function inferType(input) {
    const card = input.closest('.import-card, .card');
    const text = String(card?.textContent || '').toLowerCase();
    for (const [type, words] of TYPE_RULES) if (words.some(word => text.includes(word))) return type;
    return null;
}
function toast(message, kind = 'info') { window.showToast?.(message, kind); }
function ensureStyle() {
    if (document.getElementById('beltanee-import-controller-style')) return;
    const style = document.createElement('style'); style.id = 'beltanee-import-controller-style';
    style.textContent = `.beltanee-import-overlay{position:fixed;inset:0;z-index:100001;background:rgba(8,8,12,.66);backdrop-filter:blur(8px);display:grid;place-items:center;padding:20px}.beltanee-import-dialog{width:min(680px,94vw);max-height:86vh;overflow:auto;background:var(--bg-card,#fff);border:1px solid var(--border,#ddd);border-radius:18px;box-shadow:0 30px 100px rgba(0,0,0,.3);padding:24px}.beltanee-import-dialog h3{margin:0 0 6px}.beltanee-import-meta{color:var(--text-secondary,#777);font-size:12px;margin-bottom:16px}.beltanee-import-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.beltanee-import-stat{padding:12px;border-radius:10px;background:var(--bg-hover,#f5f5f5)}.beltanee-import-stat b{display:block;font-size:18px;margin-top:4px}.beltanee-import-sample{font-size:11px;overflow:auto;border:1px solid var(--border,#ddd);border-radius:10px}.beltanee-import-sample table{width:100%;border-collapse:collapse}.beltanee-import-sample td,.beltanee-import-sample th{padding:7px;border-bottom:1px solid var(--border,#ddd);text-align:left}.beltanee-import-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.beltanee-import-warn{padding:10px 12px;border-radius:10px;background:rgba(245,158,11,.1);color:#a16207;font-size:12px;margin-top:12px}`;
    document.head.appendChild(style);
}
function closeDialog() { document.getElementById('beltaneeImportOverlay')?.remove(); }
function renderPreview(result, onConfirm) {
    ensureStyle(); closeDialog();
    const p = result.preview || {}; const sample = p.sample || [];
    const overlay = document.createElement('div'); overlay.id = 'beltaneeImportOverlay'; overlay.className = 'beltanee-import-overlay';
    overlay.innerHTML = `<div class="beltanee-import-dialog"><h3>Проверка импорта</h3><div class="beltanee-import-meta">${escapeHtml(p.description || result.fileName)} · ${escapeHtml(result.fileName)}</div><div class="beltanee-import-stats"><div class="beltanee-import-stat">Строк<b>${p.sourceRows ?? 0}</b></div><div class="beltanee-import-stat">Записей<b>${p.recordCount ?? 0}</b></div><div class="beltanee-import-stat">Ошибок<b>${p.invalidRows ?? 0}</b></div><div class="beltanee-import-stat">Дубликатов<b>${p.duplicateRows ?? 0}</b></div></div>${p.dateFrom ? `<div class="beltanee-import-meta">Период: <strong>${escapeHtml(p.dateFrom)}</strong> — <strong>${escapeHtml(p.dateTo)}</strong></div>` : ''}${p.invalidRows ? `<div class="beltanee-import-warn">⚠️ Часть строк не прошла проверку. Они не будут записаны в базу.</div>` : ''}<div class="beltanee-import-sample"><table><thead><tr><th>Артикул</th><th>Группа</th><th>Цвет</th><th>Размер</th><th>Склад</th></tr></thead><tbody>${sample.map(r => `<tr><td>${escapeHtml(r.article)}</td><td>${escapeHtml(r.productGroupKey)}</td><td>${escapeHtml(r.color)}</td><td>${escapeHtml(r.size)}</td><td>${escapeHtml(r.warehouse)}</td></tr>`).join('')}</tbody></table></div><div class="beltanee-import-actions"><button class="btn btn-secondary" id="beltaneeImportCancel">Отмена</button><button class="btn btn-primary" id="beltaneeImportConfirm">Импортировать проверенные данные</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#beltaneeImportCancel').onclick = closeDialog;
    overlay.querySelector('#beltaneeImportConfirm').onclick = async () => { const button = overlay.querySelector('#beltaneeImportConfirm'); button.disabled = true; button.textContent = 'Импортируем…'; try { const committed = await onConfirm(); closeDialog(); toast(`Импорт завершён: ${committed.records?.length || 0} записей`, committed.errors?.length ? 'warning' : 'success'); window.dispatchEvent(new CustomEvent('beltanee:data-imported', { detail: committed })); } catch (error) { button.disabled = false; button.textContent = 'Импортировать проверенные данные'; toast(`Ошибка импорта: ${error.message}`, 'error'); } };
}

export function initImportController() {
    const page = document.getElementById('page-import'); if (!page || page.dataset.importControllerReady) return;
    page.dataset.importControllerReady = '1';
    document.addEventListener('change', async event => {
        const input = event.target; if (!(input instanceof HTMLInputElement) || input.type !== 'file' || !page.contains(input)) return;
        const file = input.files?.[0]; if (!file) return;
        const type = inferType(input);
        if (!type) { toast('Не удалось определить тип шаблона. Структура существующих шаблонов не изменена.', 'error'); return; }
        event.preventDefault(); event.stopImmediatePropagation();
        toast('Проверяем файл и структуру WB…', 'info');
        try {
            const preview = await ImportService.previewFile(file, type);
            if (preview.duplicateImport) { toast(preview.error, 'warning'); input.value = ''; return; }
            if (!preview.success && !preview.records?.length) throw new Error(preview.error || 'Файл не прошёл проверку');
            renderPreview(preview, () => ImportService.importFile(file, type));
        } catch (error) { toast(error.message, 'error'); }
        finally { input.value = ''; }
    }, true);
    window.BeltaneeImport = { ImportService, ImportTypes, previewFile: (file, type) => ImportService.previewFile(file, type), importFile: (file, type) => ImportService.importFile(file, type) };
}
